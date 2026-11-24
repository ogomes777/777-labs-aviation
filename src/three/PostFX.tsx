'use client';
import { forwardRef, useMemo } from 'react';
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration, Vignette, Noise, ToneMapping, N8AO, SMAA } from '@react-three/postprocessing';
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode, type DepthOfFieldEffect, type BloomEffect } from 'postprocessing';
import * as THREE from 'three';

/**
 * Grade fílmico: S-curve de contraste, split-toning (sombras frias / altas quentes), saturação e temperatura
 * por cena. Executa após o tone mapping (display-referred).
 */
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      uniform float uContrast; uniform float uSat; uniform float uWarm; uniform float uLift; uniform float uExposure; uniform vec3 uShadow; uniform vec3 uHigh;
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
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uContrast', new THREE.Uniform(0.18)], ['uExposure', new THREE.Uniform(1)], ['uSat', new THREE.Uniform(1.08)], ['uWarm', new THREE.Uniform(0.3)], ['uLift', new THREE.Uniform(0.012)],
        ['uShadow', new THREE.Uniform(new THREE.Color(0.92, 0.97, 1.07))], ['uHigh', new THREE.Uniform(new THREE.Color(1.05, 1.0, 0.93))],
      ]),
    });
  }
}

class LensEffect extends Effect {
  constructor() {
    super('LensEffect', /* glsl */ `
      uniform float uDistort; uniform float uStreak; uniform vec3 uTint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 acc = vec3(0.0);
        for (int i = -7; i <= 7; i++) {
          if (i == 0) continue;
          float fi = float(i);
          vec3 sm = texture2D(inputBuffer, uv + vec2(fi * 0.011, 0.0)).rgb;
          float l = max(dot(sm, vec3(0.2126, 0.7152, 0.0722)) - 1.1, 0.0);
          acc += l * (1.0 - abs(fi) / 8.0);
        }
        outputColor = vec4(inputColor.rgb + uTint * acc * uStreak, inputColor.a);
      }`, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([['uDistort', new THREE.Uniform(0.035)], ['uStreak', new THREE.Uniform(0.12)], ['uTint', new THREE.Uniform(new THREE.Color(0.75, 0.82, 1.0))]]),
    });
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

export interface FXHandles { dof: DepthOfFieldEffect | null; bloom: BloomEffect | null; grade: GradeEffect; speed: SpeedBlurEffect | null; lens: LensEffect | null; ao: { configuration: { intensity: number; aoRadius: number } } | null }
export const fx: FXHandles = { dof: null, bloom: null, grade: null as unknown as GradeEffect, speed: null, lens: null, ao: null };

const Grade = forwardRef<GradeEffect>(function Grade(_, ref) {
  const effect = useMemo(() => new GradeEffect(), []);
  fx.grade = effect;
  return <primitive ref={ref} object={effect} dispose={null} />;
});

const Lens = forwardRef<LensEffect>(function Lens(_, ref) {
  const effect = useMemo(() => new LensEffect(), []);
  fx.lens = effect;
  return <primitive ref={ref} object={effect} dispose={null} />;
});

const SpeedBlur = forwardRef<SpeedBlurEffect>(function SpeedBlur(_, ref) {
  const effect = useMemo(() => new SpeedBlurEffect(), []);
  fx.speed = effect;
  return <primitive ref={ref} object={effect} dispose={null} />;
});

export default function PostFX({ quality, level, focus }: { quality: 'high' | 'balanced'; level: number; focus: THREE.Vector3 }) {
  if (quality === 'high' && level >= 2) {
    if (level < 3) fx.ao = null;
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
        {level >= 3 ? <N8AO ref={(e: unknown) => { fx.ao = e as FXHandles['ao']; }} aoRadius={1.1} distanceFalloff={0.6} intensity={2.2} quality="medium" halfRes screenSpaceRadius={false} /> : <></>}
        <DepthOfField ref={(e: DepthOfFieldEffect | null) => { fx.dof = e; }} target={focus} focalLength={0.03} bokehScale={2.4} height={540} />
        <Bloom ref={(e: BloomEffect | null) => { fx.bloom = e; }} mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.55} radius={0.72} />
        <Lens />
        <SpeedBlur />
        <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0003)} radialModulation modulationOffset={0.45} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Grade />
        <Vignette offset={0.32} darkness={0.5} />
        <SMAA />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.14} />
      </EffectComposer>
    );
  }
  fx.dof = null; fx.ao = null; fx.lens = null;
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
      <Bloom ref={(e: BloomEffect | null) => { fx.bloom = e; }} mipmapBlur luminanceThreshold={0.95} intensity={0.45} radius={0.6} levels={5} />
      <SpeedBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Grade />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
  );
}
