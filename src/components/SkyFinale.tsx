'use client';
import { useEffect, useRef } from 'react';
import { skyWake } from './skyWake';

/**
 * Céu do final (V11): ao descer do hangar, um banco de nuvens brancas e azuis sobe e cobre a cena;
 * por baixo, um céu contínuo (sticky) acompanha "Aeronaves que buscamos", o contato e o rodapé,
 * ficando mais profundo à medida que se desce. Tudo amarrado ao scroll/toque:
 *   --sky-in   0→1  o banco de nuvens sobe sobre o fim do hangar
 *   --sky-open 0→1  as nuvens se abrem (o céu aparece)
 *   --sky-deep 0→1  o céu escurece até o azul profundo do contato/rodapé
 *   --sky-prog 0→1  descida pelo céu (as camadas de nuvem sobem em paralaxe)
 * Céu vivo: um shader 2D desenha as nuvens (formando, derivando com o vento, sombreadas pela luz) e cada
 * aeronave — movida pelo scroll — empurra, torce e abre a nuvem por onde passa; o rastro cicatriza aos poucos.
 * Sem WebGL ou com movimento reduzido, ficam as camadas de imagem (CSS) como fallback.
 */

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const N = 36; // 12 pontos de rastro por aeronave
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime, uOpen, uDeep, uProg;
uniform vec4 uA[${N}]; uniform vec4 uB[${N}];
uniform vec3 uShadow, uLight, uNightS, uNightL;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= .5; } return v; }
// densidade de uma camada: domain warping lento (a nuvem se forma e se desfaz) + forma de cúmulo
float layer(vec2 q, float t, float lo, float hi){
  float w = fbm(q * .8 + vec2(t * .021, -t * .013));
  float n = fbm(q * 1.35 + vec2(w * 1.1, w * .6) + vec2(t * .008, 0.));
  return smoothstep(lo, hi, n);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y; vec2 p = vec2(uv.x * asp, uv.y);
  float t = uTime;
  // ---- ar deslocado pelas aeronaves: empurra para fora, torce em vórtice e abre um canal ----
  vec2 disp = vec2(0.); float cut = 0.;
  for (int i = 0; i < ${N}; i++){
    vec4 a = uA[i]; if (a.w < .002) continue;
    vec4 b = uB[i];
    vec2 d = p - vec2(a.x * asp, a.y); float r = a.z;
    float g = exp(-dot(d, d) / (r * r));
    vec2 perp = vec2(-d.y, d.x);
    float spin = b.z * (.8 + .4 * sin(t * 1.7 + float(i) * 1.3));
    disp += (d * .55 + perp * spin * 1.25 + b.xy * r * .35) * g * a.w;
    cut += g * a.w;
  }
  cut = clamp(cut, 0., 1.);
  float desc = uProg * 1.6; // descendo pelo céu: as nuvens sobem
  // camada alta (véus finos), camada média (fiapos que cruzam), banco baixo (cúmulos)
  vec2 qh = (p - disp * .25) * vec2(.9, 2.4) + vec2(t * .006, desc * 1.1 + 3.);
  float dh = layer(qh, t * .6, .56, .86) * smoothstep(.45, .8, uv.y + desc * .25) * .55;
  vec2 qm = (p - disp * .8) * vec2(1.05, 2.) + vec2(t * .024, desc * 1.7 + 7.);
  float dm = layer(qm, t, .5, .78) * smoothstep(.12, .42, uv.y) * smoothstep(.98, .62, uv.y) * .9;
  vec2 qb = (p - disp) * vec2(.85, 1.25) + vec2(t * .012, desc * 2.2 - 1.);
  float hb = uv.y - .06 - (fbm(vec2(p.x * 1.1 + t * .01, desc)) - .5) * .32 + desc * .05;
  float db = layer(qb, t * .8, .4, .7) * smoothstep(.5, .05, hb);
  // canal aberto pela aeronave, com borda levemente mais densa (a nuvem empurrada se acumula)
  float ring = cut * (1. - cut) * 4.;
  float keep = 1. - cut * .72;
  dm = dm * keep + ring * dm * .35; db = db * keep + ring * db * .3; dh *= 1. - cut * .5;
  // luz: amostra deslocada em direção à luz (alto à direita) → base sombreada, topo iluminado
  vec2 L = vec2(.054, .084);
  float lb = layer(qb + L * vec2(.85, 1.25), t * .8, .4, .7);
  float lm = layer(qm + L * vec2(1.05, 2.), t, .55, .8);
  float shB = clamp(.62 + (db - lb) * 1.4 + uv.y * .25, 0., 1.);
  float shM = clamp(.7 + (dm - lm) * 1.2, 0., 1.);
  vec3 S = mix(uShadow, uNightS, uDeep), Lc = mix(uLight, uNightL, uDeep);
  vec3 cb = mix(S, Lc, shB), cm = mix(S, Lc, shM), ch = Lc;
  // composição (de trás para frente), alfa pré-multiplicado
  float vis = (.35 + .65 * uOpen) * (1. - .45 * uDeep);
  float ah = dh * vis * .8, am = dm * vis, ab = clamp(db * 1.15, 0., 1.) * vis;
  vec3 col = ch * ah; float al = ah;
  col = cm * am + col * (1. - am); al = am + al * (1. - am);
  col = cb * ab + col * (1. - ab); al = ab + al * (1. - ab);
  col += Lc * ring * .06 * vis; // brilho úmido na borda do canal
  float dither = (hash(gl_FragCoord.xy + t) - .5) / 255.;
  gl_FragColor = vec4(col + dither * al, al);
}`;

type Pt = { x: number; y: number; r: number; s: number; dx: number; dy: number; born: number; spin: number };

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
  const uRes = U('uRes'), uTime = U('uTime'), uOpen = U('uOpen'), uDeep = U('uDeep'), uProg = U('uProg'), uA = U('uA'), uB = U('uB');
  const uShadow = U('uShadow'), uLight = U('uLight'), uNightS = U('uNightS'), uNightL = U('uNightL');
  const A = new Float32Array(N * 4), B = new Float32Array(N * 4);
  const trails: Pt[][] = [[], [], []];
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const palette = () => {
    const dusk = document.documentElement.dataset.theme === 'dusk';
    gl.uniform3fv(uShadow, hex(dusk ? '#aeb0dc' : '#a9c3e4')); gl.uniform3fv(uLight, hex(dusk ? '#fbf9ff' : '#ffffff'));
    gl.uniform3fv(uNightS, hex(dusk ? '#1b1648' : '#10284d')); gl.uniform3fv(uNightL, hex(dusk ? '#5a5498' : '#5d7fb2'));
  };
  palette();
  const themeObs = new MutationObserver(palette); themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let W = 0, H = 0;
  const resize = () => {
    const k = innerWidth < 860 ? 0.5 : 0.56; // nuvem é macia: meia resolução, ampliada pelo navegador
    const w = Math.max(2, Math.round(innerWidth * k)), h = Math.max(2, Math.round(innerHeight * k));
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  let raf = 0, dead = false;
  const t0 = performance.now();
  const v = (name: string) => Number(finale.style.getPropertyValue(name) || 0);
  const frame = (now: number) => {
    raf = 0;
    if (dead || document.hidden || finale.dataset.skyActive !== 'true') return; // dorme fora da tela
    resize();
    const time = (now - t0) / 1000;
    // rastro: guarda pontos por onde cada aeronave passou; o ponto vivo acompanha a aeronave
    const vh = innerHeight, vw = innerWidth;
    skyWake.planes.forEach((pl, i) => {
      const tr = trails[i]; if (!tr) return;
      if (pl.on > 0.01) {
        const last = tr[tr.length - 1];
        const moved = !last || Math.hypot(pl.x - last.x, pl.y - last.y) > pl.r * 0.35;
        if (moved) { tr.push({ x: pl.x, y: pl.y, r: pl.r, s: pl.on, dx: pl.vx, dy: pl.vy, born: time, spin: tr.length % 2 ? 1 : -1 }); if (tr.length > 12) tr.shift(); }
        else { last.s = pl.on; last.born = time; }
      }
    });
    A.fill(0); B.fill(0);
    let j = 0;
    outer: for (const tr of trails) for (const q of tr) {
      const age = time - q.born, life = Math.exp(-age / 2.8);
      if (life < 0.01) continue;
      const m = Math.hypot(q.dx, q.dy) || 1;
      A[j * 4] = q.x / vw; A[j * 4 + 1] = 1 - q.y / vh; A[j * 4 + 2] = (q.r / vh) * (0.8 + Math.min(1.2, age * 0.45)); A[j * 4 + 3] = q.s * life;
      B[j * 4] = q.dx / m; B[j * 4 + 1] = -q.dy / m; B[j * 4 + 2] = q.spin;
      if (++j >= N) break outer;
    }
    gl.uniform2f(uRes, W, H); gl.uniform1f(uTime, time);
    gl.uniform1f(uOpen, v('--sky-open')); gl.uniform1f(uDeep, v('--sky-deep')); gl.uniform1f(uProg, v('--sky-prog'));
    gl.uniform4fv(uA, A); gl.uniform4fv(uB, B);
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
    const wanted = finale.querySelector<HTMLElement>('#procuramos');
    const d = document.documentElement;
    let raf = 0, lastTone = '';
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    const update = () => {
      raf = 0;
      const vh = innerHeight, r = finale.getBoundingClientRect();
      const skyIn = clamp((vh * 1.05 - r.top) / (vh * 1.05));
      const open = clamp((vh * 0.15 - r.top) / (vh * 0.95));
      const wb = wanted ? wanted.getBoundingClientRect().bottom : r.top + vh;
      const deep = clamp((vh * 1.15 - wb) / (vh * 0.9));
      finale.style.setProperty('--sky-in', skyIn.toFixed(4));
      finale.style.setProperty('--sky-open', open.toFixed(4));
      finale.style.setProperty('--sky-deep', deep.toFixed(4));
      finale.style.setProperty('--sky-prog', clamp(-r.top / Math.max(1, r.height - vh)).toFixed(4));
      // header: vidro claro enquanto o céu claro está atrás dele
      const tone = r.top < 72 && deep < 0.55 ? 'light' : '';
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
        <i className="sf-skybank__l1" /><i className="sf-skybank__l2" /><i className="sf-skybank__l3" />
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
