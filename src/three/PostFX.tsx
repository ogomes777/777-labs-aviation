'use client';
import { forwardRef, useMemo } from 'react';
import { EffectComposer, Bloom, DepthOfField, Vignette, ToneMapping, N8AO, SMAA } from '@react-three/postprocessing';
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode, type DepthOfFieldEffect, type BloomEffect } from 'postprocessing';
import * as THREE from 'three';

/**
 * Grade fílmico: S-curve de contraste, split-toning (sombras frias / altas quentes), saturação e temperatura
 * por cena. Executa após o tone mapping (display-referred).
 */
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      uniform float uContrast; uniform float uSat; uniform float uWarm; uniform float uLift; uniform float uExposure; uniform vec3 uShadow; uniform vec3 uHigh; uniform float uTheme;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = max(inputColor.rgb, 0.0) * uExposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 tone = mix(uShadow, uHigh, smoothstep(0.05, 0.75, l));
        c *= mix(vec3(1.0), tone, 0.9);
        c = mix(vec3(l), c, uSat);
        c *= vec3(1.0 + uWarm * 0.06, 1.0 + uWarm * 0.01, 1.0 - uWarm * 0.07);
        vec3 s = c / (c + 0.18);
        c = mix(c, c * (1.0 + uContrast * (s - 0.5) * 1.4), 1.0);
        c = c + uLift * (1.0 - c);
        if (uTheme > 0.001) {
          // tema Crepúsculo: só a família azul gira para índigo/violeta; laranjas do pôr do sol e neutros ficam
          vec3 h = clamp(c, 0.0, 1.0);
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 pp = mix(vec4(h.bg, K.wz), vec4(h.gb, K.xy), step(h.b, h.g));
          vec4 qq = mix(vec4(pp.xyw, h.r), vec4(h.r, pp.yzx), step(pp.x, h.r));
          float dd = qq.x - min(qq.w, qq.y);
          vec3 hsv = vec3(abs(qq.z + (qq.w - qq.y) / (6.0 * dd + 1e-10)), dd / (qq.x + 1e-10), qq.x);
          float blue = smoothstep(0.42, 0.5, hsv.x) * (1.0 - smoothstep(0.74, 0.8, hsv.x));
          vec3 wh = vec3(hsv.x + 0.062 * blue, hsv.y * (1.0 - 0.08 * blue), hsv.z);
          vec3 r = wh.z * mix(vec3(1.0), clamp(abs(fract(wh.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0), wh.y);
          r = mix(r, r * vec3(1.02, 0.99, 1.04), 0.6); // neutros levemente lavanda
          c = mix(c, r, uTheme);
        }
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uContrast', new THREE.Uniform(0.18)], ['uExposure', new THREE.Uniform(1)], ['uSat', new THREE.Uniform(1.08)], ['uWarm', new THREE.Uniform(0.3)], ['uLift', new THREE.Uniform(0.012)], ['uTheme', new THREE.Uniform(0)],
        ['uShadow', new THREE.Uniform(new THREE.Color(0.92, 0.97, 1.07))], ['uHigh', new THREE.Uniform(new THREE.Color(1.05, 1.0, 0.93))],
      ]),
    });
  }
}

/** Saneamento HDR: zera NaN e limita valores infinitos antes de bloom/DOF (evita manchas pretas em qualquer GPU). */
class SanitizeEffect extends Effect {
  constructor() {
    super('SanitizeEffect', /* glsl */ `
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        if (any(isnan(c)) || any(isinf(c))) {
          vec2 px = 1.0 / resolution;
          vec3 n = texture2D(inputBuffer, uv + vec2(px.x, 0.0)).rgb + texture2D(inputBuffer, uv - vec2(px.x, 0.0)).rgb;
          c = any(isnan(n)) || any(isinf(n)) ? vec3(0.5) : n * 0.5;
        }
        outputColor = vec4(clamp(c, 0.0, 8.0), inputColor.a);
      }`, { attributes: EffectAttribute.CONVOLUTION });
  }
}

/** Nitidez relativa (segura para HDR): realça microcontraste de luminância sem estourar realces. */
class SharpenEffect extends Effect {
  constructor(amount = 0.55) {
    super('SharpenEffect', /* glsl */ `
      uniform float uAmount;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec2 px = 1.0 / resolution;
        vec3 c = inputColor.rgb;
        vec3 n = (texture2D(inputBuffer, uv + vec2(px.x, 0.0)).rgb + texture2D(inputBuffer, uv - vec2(px.x, 0.0)).rgb
                + texture2D(inputBuffer, uv + vec2(0.0, px.y)).rgb + texture2D(inputBuffer, uv - vec2(0.0, px.y)).rgb) * 0.25;
        float lc = dot(c, vec3(0.2126, 0.7152, 0.0722)), ln = dot(n, vec3(0.2126, 0.7152, 0.0722));
        float k = clamp((lc - ln) / (ln + 0.25), -0.5, 0.5);
        outputColor = vec4(max(c * (1.0 + k * uAmount), 0.0), inputColor.a);
      }`, { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map<string, THREE.Uniform>([['uAmount', new THREE.Uniform(amount)]]) });
  }
}

/** Guarda final: qualquer NaN que algum estágio produza vira o branco quente do realce (nunca mancha preta). */
class FinalGuardEffect extends Effect {
  constructor() {
    super('FinalGuardEffect', /* glsl */ `
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        bool bad = any(isnan(c)) || any(isinf(c));
        outputColor = vec4(bad ? vec3(1.0, 0.95, 0.86) : clamp(c, 0.0, 1.0), 1.0);
      }`);
  }
}

class SpeedBlurEffect extends Effect {
  constructor() {
    super('SpeedBlurEffect', /* glsl */ `
      uniform float uStrength; uniform vec2 uCenter;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec2 dir = uv - uCenter;
        float edge = smoothstep(0.18, 0.75, length(dir * vec2(1.0, 0.7)));
        float k = uStrength * edge;
        if (k < 0.0004) { outputColor = inputColor; return; }
        vec4 acc = inputColor;
        for (int i = 1; i <= 7; i++) { acc += texture2D(inputBuffer, uv - dir * k * float(i)); }
        outputColor = acc / 8.0;
      }`, { attributes: EffectAttribute.CONVOLUTION, uniforms: new Map<string, THREE.Uniform>([['uStrength', new THREE.Uniform(0)], ['uCenter', new THREE.Uniform(new THREE.Vector2(0.62, 0.5))]]) });
  }
}

export interface FXHandles { dof: DepthOfFieldEffect | null; bloom: BloomEffect | null; grade: GradeEffect; speed: SpeedBlurEffect | null; ao: { configuration: { intensity: number; aoRadius: number } } | null }
export const fx: FXHandles = { dof: null, bloom: null, grade: null as unknown as GradeEffect, speed: null, ao: null };

const Grade = forwardRef<GradeEffect>(function Grade(_, ref) {
  const effect = useMemo(() => new GradeEffect(), []);
  fx.grade = effect;
  return <primitive ref={ref} object={effect} dispose={null} />;
});

const Sanitize = forwardRef<SanitizeEffect>(function Sanitize(_, ref) {
  const effect = useMemo(() => new SanitizeEffect(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

const Sharpen = forwardRef<SharpenEffect, { amount?: number }>(function Sharpen({ amount = 0.55 }, ref) {
  const effect = useMemo(() => new SharpenEffect(amount), [amount]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

const FinalGuard = forwardRef<FinalGuardEffect>(function FinalGuard(_, ref) {
  const effect = useMemo(() => new FinalGuardEffect(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

const SpeedBlur = forwardRef<SpeedBlurEffect>(function SpeedBlur(_, ref) {
  const effect = useMemo(() => new SpeedBlurEffect(), []);
  fx.speed = effect;
  return <primitive ref={ref} object={effect} dispose={null} />;
});

export default function PostFX({ quality, level, focus, dof = true }: { quality: 'high' | 'balanced'; level: number; focus: THREE.Vector3; dof?: boolean }) {
  if (quality === 'high' && level >= 2) {
    if (level < 3 || !dof) fx.ao = null;
    if (!dof) fx.dof = null;
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
        <Sanitize />
        {level >= 3 && dof ? <N8AO ref={(e: unknown) => { fx.ao = e as FXHandles['ao']; }} aoRadius={1.1} distanceFalloff={0.6} intensity={2.2} quality="medium" halfRes screenSpaceRadius={false} /> : <></>}
        {dof ? <DepthOfField ref={(e: DepthOfFieldEffect | null) => { fx.dof = e; }} target={focus} focalLength={0.02} bokehScale={1.2} height={720} /> : <></>}
        <Sharpen amount={0.3} />
        <Bloom ref={(e: BloomEffect | null) => { fx.bloom = e; }} mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={0.42} radius={0.6} />
        <SpeedBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Grade />
        <Vignette offset={0.32} darkness={0.5} />
        <FinalGuard />
        {/* antisserrilhado morfológico na imagem final: linhas de pátio e bordas das aeronaves sem "andar" */}
        <SMAA />
      </EffectComposer>
    );
  }
  fx.dof = null; fx.ao = null;
  if (level <= 0) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Grade />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      <Sanitize />
      <Sharpen amount={0.25} />
      <Bloom ref={(e: BloomEffect | null) => { fx.bloom = e; }} mipmapBlur luminanceThreshold={0.95} intensity={0.4} radius={0.6} levels={5} />
      <SpeedBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Grade />
      <Vignette offset={0.3} darkness={0.45} />
      <FinalGuard />
      <SMAA />
    </EffectComposer>
  );
}
