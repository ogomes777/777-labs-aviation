'use client';
import { useEffect, useRef } from 'react';

/**
 * Céu do final (V11): ao descer do hangar, um banco de nuvens brancas e azuis sobe e cobre a cena;
 * por baixo, um céu contínuo (sticky) acompanha "Aeronaves que buscamos", o contato e o rodapé,
 * ficando mais profundo à medida que se desce. Tudo amarrado ao scroll/toque:
 *   --sky-in   0→1  o banco de nuvens sobe sobre o fim do hangar
 *   --sky-open 0→1  as nuvens se abrem (o céu aparece)
 *   --sky-deep 0→1  o céu clareia até o azul-bebê/branco do contato e rodapé
 *   --sky-prog 0→1  descida pelo céu (as camadas de nuvem sobem em paralaxe)
 * Céu vivo: um shader 2D desenha as nuvens (formando devagar, derivando com o vento, sombreadas pela luz),
 * emoldurando a cena; o scroll/toque faz o céu subir em paralaxe. Nada de arrasto/deformação atrás das aeronaves.
 * Sem WebGL ou com movimento reduzido, ficam as camadas de imagem (CSS) como fallback.
 */

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime, uOpen, uDeep, uProg;
uniform vec3 uShadow, uLight, uNightS, uNightL;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
// poucas oitavas: massas macias e fofas (nada de textura granulada/"neve")
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p; a *= .52; } return v; }
float puff(vec2 q, float t){
  float w = fbm(q * .6 + vec2(t * .012, t * .007));
  return fbm(q + vec2(w * .7, w * .35) + vec2(t * .006, 0.));
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y; vec2 p = vec2(uv.x * asp, uv.y);
  float t = uTime;
  float desc = uProg * 1.4; // descendo pelo céu: as nuvens sobem devagar
  vec2 q = p;
  // banco macio: bordas laterais e base, céu limpo no meio (como um enquadramento)
  float side = max(smoothstep(.42, .0, uv.x), smoothstep(.58, 1., uv.x));
  float low = smoothstep(.52, .0, uv.y - desc * .04);
  // retrato (celular): sem colunas laterais — nuvens espalhadas e banco na base
  float wide = clamp((asp - .6) / .6, 0., 1.);
  float frame = clamp(max(side * .9 * wide, low) + mix(.26, .12, wide), 0., 1.);
  float n1 = puff(q * vec2(1.7, 2.3) + vec2(0., desc * 1.1), t);
  float d1 = smoothstep(.47, .57, n1 * (.52 + .62 * frame));
  // véu alto, muito leve, que cruza devagar
  float n2 = puff(q * vec2(.7, 2.2) + vec2(t * .01, desc * .6 + 5.), t * .7);
  float d2 = smoothstep(.56, .74, n2) * .32 * smoothstep(.3, .75, uv.y);
  // luz suave vinda de cima: topo branco, base azul-clara (nunca cinza)
  float n1l = puff(q * vec2(1.7, 2.3) + vec2(0., desc * 1.1) + vec2(.05, .08), t);
  float shade = clamp(.62 + (n1 - n1l) * 4.5 + uv.y * .2, 0., 1.);
  vec3 S = mix(uShadow, uNightS, uDeep), Lc = mix(uLight, uNightL, uDeep);
  vec3 c1 = mix(S, Lc, shade);
  float vis = (.4 + .6 * uOpen) * (1. - .55 * uDeep); // contato: menos nuvem, mais limpo
  float a2 = d2 * vis, a1 = d1 * vis * .96;
  vec3 col = Lc * a2; float al = a2;
  col = c1 * a1 + col * (1. - a1); al = a1 + al * (1. - a1);
  float dither = (hash(gl_FragCoord.xy + t) - .5) / 255.;
  gl_FragColor = vec4(col + dither * al, al);
}`;

function startSky(canvas: HTMLCanvasElement, finale: HTMLElement): (() => void) | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uOpen = U('uOpen'), uDeep = U('uDeep'), uProg = U('uProg');
  const uShadow = U('uShadow'), uLight = U('uLight'), uNightS = U('uNightS'), uNightL = U('uNightL');
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const palette = () => {
    const dusk = document.documentElement.dataset.theme === 'dusk';
    gl.uniform3fv(uShadow, hex(dusk ? '#d9d6f2' : '#d6e5f6')); gl.uniform3fv(uLight, hex(dusk ? '#fbf9ff' : '#ffffff'));
    gl.uniform3fv(uNightS, hex(dusk ? '#ece9fa' : '#e6f0fa')); gl.uniform3fv(uNightL, hex(dusk ? '#ffffff' : '#ffffff'));
  };
  palette();
  const themeObs = new MutationObserver(palette); themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let W = 0, H = 0;
  const resize = () => {
    const k = innerWidth < 860 ? 0.24 : 0.34; // nuvem é macia: meia resolução, ampliada pelo navegador
    const w = Math.max(2, Math.round(innerWidth * k)), h = Math.max(2, Math.round(innerHeight * k));
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  let raf = 0, dead = false, lastFrame = 0;
  const t0 = performance.now();
  const v = (name: string) => Number(finale.style.getPropertyValue(name) || 0);
  const frame = (now: number) => {
    raf = 0;
    if (dead || document.hidden || finale.dataset.skyActive !== 'true') return; // dorme fora da tela
    if (now - lastFrame < 32) { raf = requestAnimationFrame(frame); return; }
    lastFrame = now;
    resize();
    const time = (now - t0) / 1000;
    gl.uniform2f(uRes, W, H); gl.uniform1f(uTime, time);
    gl.uniform1f(uOpen, v('--sky-open')); gl.uniform1f(uDeep, v('--sky-deep')); gl.uniform1f(uProg, v('--sky-prog'));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };
  document.addEventListener('visibilitychange', wake);
  const mo = new MutationObserver(wake); mo.observe(finale, { attributes: true, attributeFilter: ['data-sky-active'] });
  const lost = (e: Event) => { e.preventDefault(); dead = true; delete canvas.parentElement?.dataset.gl; };
  canvas.addEventListener('webglcontextlost', lost);
  wake();
  return () => {
    dead = true; cancelAnimationFrame(raf); themeObs.disconnect(); mo.disconnect();
    document.removeEventListener('visibilitychange', wake); canvas.removeEventListener('webglcontextlost', lost);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

export default function SkyFinale() {
  const root = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const finale = root.current?.closest<HTMLElement>('.finale');
    if (!finale) return;
    const jet = finale.querySelector<HTMLElement>('#planejar');
    const d = document.documentElement;
    let raf = 0, lastTone = '';
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    const update = () => {
      raf = 0;
      const vh = innerHeight, r = finale.getBoundingClientRect();
      const skyIn = clamp((vh * 1.05 - r.top) / (vh * 1.05));
      const open = clamp((vh * 0.15 - r.top) / (vh * 0.95));
      // contato/rodapé: o céu clareia para azul-bebê e branco enquanto a turbina gira
      const jr = jet?.getBoundingClientRect();
      const jp = jr ? clamp((vh - jr.top) / jr.height) : 0;
      const deep = clamp((jp - 0.12) / 0.5);
      finale.style.setProperty('--sky-in', skyIn.toFixed(4));
      finale.style.setProperty('--sky-open', open.toFixed(4));
      finale.style.setProperty('--sky-deep', deep.toFixed(4));
      finale.style.setProperty('--sky-prog', clamp(-r.top / Math.max(1, r.height - vh)).toFixed(4));
      // header: vidro claro enquanto o céu claro está atrás dele
      const tone = r.top < 72 ? 'light' : '';
      if (tone !== lastTone) { lastTone = tone; if (tone) d.dataset.skyTone = tone; else delete d.dataset.skyTone; }
      const active = r.top < vh * 1.2 && r.bottom > 0 ? 'true' : 'false';
      if (finale.dataset.skyActive !== active) finale.dataset.skyActive = active;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
    update();
    // céu vivo (shader) — só com movimento completo; senão, as camadas de imagem seguram o visual
    let stopSky: (() => void) | null = null;
    const sky = cv.current?.parentElement;
    if (cv.current && sky && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stopSky = startSky(cv.current, finale);
      if (stopSky) sky.dataset.gl = 'on';
    }
    return () => { cancelAnimationFrame(raf); removeEventListener('scroll', queue); removeEventListener('resize', queue); delete d.dataset.skyTone; stopSky?.(); };
  }, []);
  return (
    <div ref={root} className="sf-skywrap" aria-hidden="true">
      {/* banco de nuvens que sobe sobre o fim do hangar (transição) */}
      <div className="sf-skybank">
        <i className="sf-skybank__l1" /><i className="sf-skybank__l2" /><i className="sf-skybank__l3" /><i className="sf-skybank__l4" />
      </div>
      {/* céu contínuo atrás de todo o final */}
      <div className="sf-sky">
        <i className="sf-sky__grad" />
        <i className="sf-sky__sun" />
        <canvas ref={cv} className="sf-sky__gl" />
        <i className="sf-sky__far" />
        <i className="sf-sky__wisp sf-sky__wisp--1" />
        <i className="sf-sky__wisp sf-sky__wisp--2" />
        <i className="sf-sky__mid" />
        <i className="sf-sky__wisp sf-sky__wisp--3" />
        <i className="sf-sky__near sf-sky__near--l" />
        <i className="sf-sky__near sf-sky__near--r" />
        <i className="sf-sky__fog" />
      </div>
    </div>
  );
}
