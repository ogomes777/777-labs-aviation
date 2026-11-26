import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Fuselage } from '../jet/fuselage';
import type { FleetSpec, CabinZone } from './specs';

/**
 * Interior de luxo por aeronave, montado a partir da planta de fábrica em `specs.ts` (mesma fonte da planta 2D).
 * Coordenadas locais da aeronave: x = L/2 − d (nariz em +x), y para cima, z = lado (+ direita, − esquerda/porta).
 * O forro tem janelas recortadas exatamente onde estão as janelas do casco, e o cockpit tem para-brisa aberto —
 * na vista de dentro o casco externo some e o céu aparece pelas janelas.
 * Acabamento ilustrativo (couro, nogueira, mármore): configuração de fábrica da brochura, não do exemplar.
 */
export interface CabinBuild {
  group: THREE.Group;
  /** poltronas de passageiro na ordem de `spec.cabin.seats` */
  seats: { pos: THREE.Vector3; facing: 1 | -1 | 0; side: -1 | 1 }[];
  /** olho do piloto (assento esquerdo) */
  pilotEye: THREE.Vector3;
  /** caminhar pela cabine (primeira pessoa): altura dos olhos em pé e limites do piso livre */
  walk: { eyeY: number; clamp: (p: THREE.Vector3) => THREE.Vector3 };
  /** atualiza as telas do painel (atitude, velocidade, altitude, proa) */
  updatePanel: (t: { pitch: number; roll: number; speed: number; alt: number; hdg: number; vs: number }) => void;
  dispose: () => void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let seedN = 3;
const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);

/** nogueira com veio (folha de madeira contínua) */
const walnutTex = () => canvasTex(512, 512, (g) => {
  g.fillStyle = '#4a2f1f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 180; i++) {
    const y = rnd() * 512, a = 0.04 + rnd() * 0.1, wv = 4 + rnd() * 18;
    g.strokeStyle = `rgba(${rnd() > 0.5 ? '25,14,8' : '120,78,48'},${a})`; g.lineWidth = 0.6 + rnd() * 2.4;
    g.beginPath(); for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin(x * 0.012 + i) * wv + Math.sin(x * 0.05 + i * 3) * 2); g.stroke();
  }
});
/** mármore claro com veios */
const marbleTex = () => canvasTex(512, 512, (g) => {
  g.fillStyle = '#ece8e1'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(120,112,104,${0.08 + rnd() * 0.18})`; g.lineWidth = 0.5 + rnd() * 2;
    let x = rnd() * 512, y = rnd() * 512; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 30; k++) { x += (rnd() - 0.3) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
});
/** carpete de lã (textura fina) */
const carpetTex = () => canvasTex(256, 256, (g) => {
  g.fillStyle = '#857766'; g.fillRect(0, 0, 256, 256);
  const im = g.getImageData(0, 0, 256, 256); const d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
  g.strokeStyle = 'rgba(60,50,40,0.18)'; g.lineWidth = 1;
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
});

/** poltrona executiva (giratória), ocupante olhando para +x; encosto em −x */
function seatGeometries(sc: number) {
  const L: THREE.BufferGeometry[] = [], T: THREE.BufferGeometry[] = [];
  const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w * sc, h * sc, d * sc, 3, r * sc);
  const pan = rb(0.56, 0.15, 0.6, 0.06); pan.translate(0.02 * sc, 0.45 * sc, 0); L.push(pan);
  const back = rb(0.17, 0.74, 0.6, 0.07); back.rotateZ(-0.12); back.translate(-0.27 * sc, 0.86 * sc, 0); L.push(back);
  const head = rb(0.12, 0.2, 0.42, 0.06); head.rotateZ(-0.14); head.translate(-0.22 * sc, 1.25 * sc, 0); L.push(head);
  for (const s of [1, -1]) {
    const arm = rb(0.5, 0.1, 0.11, 0.04); arm.translate(-0.02 * sc, 0.66 * sc, s * 0.33 * sc); L.push(arm);
    const side = rb(0.52, 0.22, 0.07, 0.03); side.translate(-0.02 * sc, 0.53 * sc, s * 0.33 * sc); L.push(side);
    const pip = rb(0.5, 0.02, 0.115, 0.008); pip.translate(-0.02 * sc, 0.715 * sc, s * 0.33 * sc); T.push(pip);
  }
  const base = new THREE.CylinderGeometry(0.2 * sc, 0.24 * sc, 0.06 * sc, 24); base.translate(0, 0.03 * sc, 0); T.push(base);
  const post = new THREE.CylinderGeometry(0.06 * sc, 0.08 * sc, 0.32 * sc, 16); post.translate(0, 0.21 * sc, 0); T.push(post);
  const merge = (a: THREE.BufferGeometry[]) => { const n = a.map((g) => (g.index ? g.toNonIndexed() : g)); const m = mergeGeometries(n)!; a.forEach((g) => g.dispose()); n.forEach((g) => g.dispose()); return m; };
  return { leather: merge(L), trim: merge(T) };
}

/** telas do painel: PFD com atitude viva e MFD com mapa */
function makeDisplays() {
  const W = 512, H = 384;
  const pfdC = document.createElement('canvas'); pfdC.width = W; pfdC.height = H;
  const pfd = new THREE.CanvasTexture(pfdC); pfd.colorSpace = THREE.SRGBColorSpace;
  const g = pfdC.getContext('2d')!;
  const drawPfd = (t: { pitch: number; roll: number; speed: number; alt: number; hdg: number; vs: number }) => {
    g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.beginPath(); g.rect(90, 30, W - 180, H - 90); g.clip();
    g.translate(W / 2, H / 2 - 20); g.rotate(-t.roll);
    const py = t.pitch * 360;
    g.fillStyle = '#2f78d6'; g.fillRect(-500, -900 + py, 1000, 900);
    g.fillStyle = '#7a4a22'; g.fillRect(-500, py, 1000, 900);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-500, py); g.lineTo(500, py); g.stroke();
    g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.textAlign = 'center';
    for (let k = -3; k <= 3; k++) { if (!k) continue; const y = py - k * 10 * (360 / 57.3); const w = k % 2 ? 30 : 60; g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); if (!(k % 2)) { g.fillText(String(Math.abs(k * 10)), -w - 16, y + 5); g.fillText(String(Math.abs(k * 10)), w + 16, y + 5); } }
    g.restore();
    // símbolo da aeronave
    g.strokeStyle = '#ffd400'; g.lineWidth = 5; g.beginPath(); g.moveTo(W / 2 - 80, H / 2 - 20); g.lineTo(W / 2 - 25, H / 2 - 20); g.lineTo(W / 2, H / 2 - 5); g.lineTo(W / 2 + 25, H / 2 - 20); g.lineTo(W / 2 + 80, H / 2 - 20); g.stroke();
    // fitas de velocidade e altitude
    g.fillStyle = 'rgba(40,40,48,0.92)'; g.fillRect(8, 30, 76, H - 90); g.fillRect(W - 84, 30, 76, H - 90);
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
    g.fillStyle = '#000'; g.fillRect(10, H / 2 - 38, 72, 36); g.fillRect(W - 82, H / 2 - 38, 72, 36);
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(10, H / 2 - 38, 72, 36); g.strokeRect(W - 82, H / 2 - 38, 72, 36);
    g.fillStyle = '#fff'; g.fillText(String(Math.round(t.speed * 1.944)), 46, H / 2 - 12); g.fillText(String(Math.round((t.alt * 3.281) / 10) * 10), W - 46, H / 2 - 12);
    g.font = '13px sans-serif'; g.fillStyle = '#9fe0ff';
    for (let k = -3; k <= 3; k++) { if (!k) continue; g.fillText(String(Math.max(0, Math.round(t.speed * 1.944 / 10) * 10 + k * 10)), 46, H / 2 - 16 - k * 34); g.fillText(String(Math.max(0, Math.round(t.alt * 3.281 / 100) * 100 + k * 100)), W - 46, H / 2 - 16 - k * 34); }
    // proa
    g.fillStyle = 'rgba(40,40,48,0.95)'; g.fillRect(120, H - 54, W - 240, 46);
    g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText(String(Math.round(t.hdg)).padStart(3, '0') + '°', W / 2, H - 24);
    g.font = '12px sans-serif'; g.fillStyle = t.vs >= 0 ? '#8dff9a' : '#ffb17a'; g.fillText((t.vs >= 0 ? '+' : '') + Math.round(t.vs * 196.85) + ' FPM', W - 46, H - 70);
    pfd.needsUpdate = true;
  };
  drawPfd({ pitch: 0, roll: 0, speed: 0, alt: 0, hdg: 270, vs: 0 });
  const mfd = canvasTex(512, 384, (m) => {
    m.fillStyle = '#05080c'; m.fillRect(0, 0, 512, 384);
    m.fillStyle = '#0c2a4a'; m.fillRect(10, 40, 492, 334);
    m.fillStyle = '#2c4f2a'; m.beginPath(); m.moveTo(10, 220); m.bezierCurveTo(140, 160, 260, 250, 360, 190); m.bezierCurveTo(420, 160, 470, 200, 502, 180); m.lineTo(502, 374); m.lineTo(10, 374); m.fill();
    m.fillStyle = '#3c6a36'; m.beginPath(); m.ellipse(120, 120, 46, 22, 0.2, 0, Math.PI * 2); m.fill();
    m.strokeStyle = '#ff40ff'; m.lineWidth = 3; m.beginPath(); m.moveTo(256, 330); m.lineTo(300, 210); m.lineTo(120, 120); m.stroke();
    m.fillStyle = '#fff'; m.beginPath(); m.moveTo(256, 316); m.lineTo(246, 340); m.lineTo(266, 340); m.fill();
    m.strokeStyle = 'rgba(255,255,255,0.35)'; m.lineWidth = 1; for (const r of [70, 140, 210]) { m.beginPath(); m.arc(256, 330, r, Math.PI * 1.15, Math.PI * 1.85); m.stroke(); }
    m.fillStyle = '#1b2430'; m.fillRect(0, 0, 512, 34);
    m.fillStyle = '#9fe0ff'; m.font = 'bold 16px sans-serif'; m.fillText('MAP · NAV', 14, 23);
    m.fillStyle = '#8dff9a'; m.fillText('N1 92.4  92.6', 300, 23);
  });
  return { pfd, mfd, drawPfd };
}

/**
 * Painéis de comando (texturas): piloto automático/FGP, overhead, painéis inferiores e pedestal — fileiras de
 * botões com legenda, seletores e anunciadores, no arranjo típico de cada suíte (Fusion, Pro Line 21, G1000).
 */
function switchPanelTex(kind: 'fgp' | 'overhead' | 'lower' | 'pedestal', suite: 'fusion' | 'pl21' | 'g1000') {
  const W = kind === 'overhead' ? 512 : 1024, H = kind === 'fgp' ? 128 : kind === 'overhead' ? 512 : 256;
  return canvasTex(W, H, (g) => {
    g.fillStyle = suite === 'g1000' ? '#2a2c30' : '#33363b'; g.fillRect(0, 0, W, H);
    const lab = (t: string, x: number, y: number, sz = 11, c = '#e9edf2') => { g.fillStyle = c; g.font = `600 ${sz}px sans-serif`; g.textAlign = 'center'; g.fillText(t, x, y); };
    const btn = (x: number, y: number, w: number, h: number, t: string, on = false) => {
      g.fillStyle = '#1b1d20'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = '#484c52'; g.fillRect(x, y, w, h);
      g.fillStyle = on ? '#7dffa0' : '#1e6b3a'; g.fillRect(x + w * 0.25, y + 3, w * 0.5, 3);
      lab(t, x + w / 2, y + h - 6, Math.min(11, h * 0.36));
    };
    const knob = (x: number, y: number, r: number, t: string) => {
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#6a6f76'); gr.addColorStop(1, '#141619');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d8dde3'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - r * 0.8); g.stroke();
      lab(t, x, y + r + 12, 10, '#cfd5dc');
    };
    const tog = (x: number, y: number, t: string) => { g.fillStyle = '#15171a'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d9dde2'; g.fillRect(x - 2.5, y - 16, 5, 16); lab(t, x, y + 18, 9, '#cfd5dc'); };
    if (kind === 'fgp') {
      // painel de guiagem de voo (glareshield): seletores de velocidade, proa, altitude e modos
      const modes = suite === 'g1000' ? ['AP', 'FD', 'HDG', 'NAV', 'APR', 'ALT', 'VS', 'FLC', 'BC', 'NOSE↑', 'NOSE↓'] : ['FD', 'HDG', 'NAV', 'APPR', 'BC', 'FLC', 'VS', 'ALT', 'VNAV', 'AP', 'YD', 'B/C', 'SPD', 'FD'];
      const kn = suite === 'g1000' ? [['HDG', 90], ['CRS', 930], ['ALT', 820]] : [['CRS 1', 60], ['SPD', 230], ['HDG', 360], ['ALT', 760], ['CRS 2', 964]];
      for (const [t, x] of kn) knob(Number(x), 54, 22, String(t));
      const avail = (suite === 'g1000' ? [140, 760] : [100, 920]);
      const n = modes.length, bw = Math.min(46, (avail[1] - avail[0]) / n - 6);
      modes.forEach((t, i) => { const x = avail[0] + i * ((avail[1] - avail[0]) / n) + 6; if (kn.some(([, kx]) => Math.abs(Number(kx) - x - bw / 2) < 34)) return; btn(x, 26, bw, 46, t, t === 'AP' || t === 'FD' || t === 'HDG' || t === 'ALT'); });
      g.fillStyle = '#05080a'; for (const x of [300, 600]) { g.fillRect(x, 84, 120, 28); } g.fillStyle = '#ffb347'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.fillText('FL 410', 360, 104); g.fillText('250 KT', 660, 104);
    } else if (kind === 'overhead') {
      // overhead: elétrica, combustível, pressurização, antigelo, luzes externas, motor
      const groups = ['ELEC', 'FUEL', 'PRESS', 'ANTI-ICE', 'LIGHTS', 'ENGINE', 'HYD', 'AIR COND'];
      groups.forEach((gname, gi) => {
        const cx = (gi % 2) * (W / 2), cy = Math.floor(gi / 2) * (H / 4);
        g.strokeStyle = '#d8dde3'; g.lineWidth = 1; g.strokeRect(cx + 8, cy + 8, W / 2 - 16, H / 4 - 16);
        lab(gname, cx + W / 4, cy + 22, 11);
        for (let k = 0; k < 5; k++) btn(cx + 20 + k * 46, cy + 32, 38, 38, ['ON', 'AUTO', 'OFF', 'NORM', 'ALT'][k], (gi + k) % 3 === 0);
        if (gi === 4) for (let k = 0; k < 5; k++) tog(cx + 40 + k * 48, cy + 95, ['NAV', 'STRB', 'BCN', 'LDG', 'TAXI'][k]);
      });
    } else if (kind === 'lower') {
      // painéis inferiores: áudio, trem, freio, luzes, alternador/bateria (pistão) ou ECS/SPDBRK (jato)
      const set = suite === 'g1000' ? ['BAT', 'ALT', 'AVNX', 'FUEL PMP', 'PITOT HT', 'NAV', 'STROBE', 'LDG', 'TAXI', 'DEICE'] : ['COM 1', 'COM 2', 'NAV 1', 'NAV 2', 'ADF', 'DME', 'MKR', 'PA', 'CAB', 'EMER', 'XPDR', 'WX'];
      set.forEach((t, i) => (suite === 'g1000' ? tog(40 + i * ((W - 80) / set.length), 150, t) : btn(20 + i * ((W - 40) / set.length), 40, (W - 40) / set.length - 10, 40, t, i % 4 === 0)));
      // alavanca do trem (roda)
      g.fillStyle = '#d9dde2'; g.fillRect(W - 90, 120, 10, 90); g.beginPath(); g.arc(W - 85, 118, 16, 0, Math.PI * 2); g.fill(); lab('GEAR', W - 85, 236, 12);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#22ff66'; g.beginPath(); g.arc(W - 150 + i * 20, 130, 6, 0, Math.PI * 2); g.fill(); }
      knob(120, 200, 18, 'PANEL'); knob(200, 200, 18, 'FLOOD');
    } else {
      // pedestal: rádios, FMS/controlador, trim, flaps
      lab(suite === 'fusion' ? 'TOUCH CONTROLLER' : suite === 'pl21' ? 'CDU · FMS' : 'COM · NAV', W / 2, 26, 14);
      g.fillStyle = '#05080a'; g.fillRect(W * 0.18, 40, W * 0.64, 110);
      g.fillStyle = '#7fd4ff'; g.font = 'bold 18px monospace'; g.textAlign = 'left';
      ['ACT  SBGR → KMIA', 'COM1 121.500  COM2 118.300', 'NAV1 110.30   XPDR 2000 ALT', 'FUEL 8 420 LB  ETA 06:45'].forEach((t, i) => g.fillText(t, W * 0.2, 66 + i * 24));
      for (let i = 0; i < 12; i++) btn(W * 0.08 + (i % 6) * W * 0.14, 170 + Math.floor(i / 6) * 40, W * 0.11, 32, ['1', '2', '3', 'PREV', 'NEXT', 'EXEC', 'DIR', 'FPL', 'LEGS', 'PERF', 'PROG', 'MENU'][i]);
    }
  });
}

export function buildCabin(s: FleetSpec, f: Fuselage, L: number, opts: { lux: boolean; clip?: THREE.Plane[] }): CabinBuild {
  const group = new THREE.Group(); group.name = opts.lux ? 'cabin-lux' : 'cabin-layout';
  const disp: { dispose: () => void }[] = [];
  const tr = <T extends { dispose: () => void }>(o: T) => { disp.push(o); return o; };
  const fx = (d: number) => L / 2 - d;
  const prop = s.nose === 'prop';
  const C = s.cabin; const floorY = C.floor;
  const inset = prop ? 0.05 : 0.08;
  const sc = prop ? 0.78 : s.R < 1 ? 0.9 : 1;
  const ledge = prop ? 0 : s.R < 1 ? 0.05 : 0.15;
  /** meia-largura interna da parede numa altura y (seção circular da cabine) */
  const wallZ = (d: number, y: number) => {
    const p = f.profile(d); const cy = (p.top + p.bot) / 2, ry = (p.top - p.bot) / 2 - inset, w = p.w - inset;
    const k = Math.min(1, Math.abs((y - cy) / Math.max(0.01, ry)));
    return w * Math.sqrt(1 - k * k);
  };
  seedN = 3 + s.R * 1000;
  const clip = opts.clip ?? null;
  // por dentro, o sol não ilumina tudo (sem sombras): luz direta atenuada, interior vive de luz indireta e das sancas
  const INSIDE = '#include <lights_fragment_end>\n reflectedLight.directDiffuse *= 0.16; reflectedLight.directSpecular *= 0.2; reflectedLight.indirectSpecular *= 0.55;';
  const dim = (m: THREE.Material) => { if (opts.lux) m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', INSIDE); }; return m; };
  const std = (p: THREE.MeshPhysicalMaterialParameters) => { const m = tr(new THREE.MeshPhysicalMaterial(p)); if (clip) m.clippingPlanes = clip; return dim(m) as THREE.MeshPhysicalMaterial; };
  const wTex = opts.lux ? tr(walnutTex()) : null, mTex = opts.lux ? tr(marbleTex()) : null, cTex = opts.lux ? tr(carpetTex()) : null;
  const M = {
    leather: std({ color: '#cdb594', roughness: 0.48, sheen: 0.6, sheenColor: new THREE.Color('#f3dfc2'), sheenRoughness: 0.55 }),
    crew: std({ color: '#2b2928', roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#8a8580') }),
    trim: std({ color: '#d9d3c9', roughness: 0.3, metalness: 0.7, envMapIntensity: 0.35 }),
    walnut: std({ color: wTex ? '#ffffff' : '#5a3a26', map: wTex, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.4 }),
    marble: std({ color: mTex ? '#ffffff' : '#ece8e1', map: mTex, roughness: 0.18, clearcoat: 0.6 }),
    carpet: std({ color: cTex ? '#ffffff' : '#857766', map: cTex, roughness: 0.96 }),
    lining: std({ color: '#f2ede5', roughness: 0.86, emissive: new THREE.Color('#3a2e22'), emissiveIntensity: opts.lux ? 0.9 : 0, side: THREE.DoubleSide }),
    led: std({ color: '#fff3dc', emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 2.4, roughness: 0.4 }),
    panel: std({ color: '#1b1e22', roughness: 0.6, metalness: 0.3 }),
    suede: std({ color: '#121315', roughness: 0.95 }),
  };
  if (cTex) cTex.repeat.set(3, 2);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, parent: THREE.Object3D = group) => { tr(geo); const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.xray = 'solid'; parent.add(m); return m; };
  const box = (w: number, h: number, d: number, r = 0.02) => new RoundedBoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d), 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1));

  // ---------- extensão do interior ----------
  const lav = C.zones.find((z) => z.kind === 'lav');
  const crewD = prop ? C.start + 0.45 : C.start - 0.95;
  const panelD = crewD - (prop ? 0.72 : 0.92);
  const shell0 = panelD - (prop ? 0.25 : 0.45);
  const shell1 = lav ? lav.d0 + 0.02 : C.end;

  // ---------- forro + cockpit: uma casca com janelas e para-brisa recortados ----------
  if (opts.lux) {
    const nu = Math.max(24, Math.round((shell1 - shell0) / 0.08)), nv = 56;
    const pts: number[] = [], idx: number[] = [];
    const thF = (d: number) => { const p = f.profile(d); const cy = (p.top + p.bot) / 2, ry = (p.top - p.bot) / 2 - inset; return Math.asin(Math.max(-0.98, Math.min(0.98, (floorY - cy) / ry))); };
    for (let i = 0; i <= nu; i++) {
      const d = shell0 + ((shell1 - shell0) * i) / nu; const t0 = thF(d);
      for (let j = 0; j <= nv; j++) { const th = t0 + ((Math.PI - 2 * t0) * j) / nv; const q = f.point(d, th, inset); pts.push(q.x, q.y, q.z); }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex(idx); g.computeVertexNormals();
    const shellMat = M.lining.clone(); tr(shellMat);
    const wn = s.windows;
    const wsD1 = panelD + (prop ? 0.55 : 0.32);
    shellMat.onBeforeCompile = (sh) => {
      sh.uniforms.uWin = { value: new THREE.Vector4(wn.d0, wn.pitch, wn.n, wn.th ?? 0.2) };
      sh.uniforms.uWinS = { value: new THREE.Vector2(wn.w * 1.04, wn.h * 1.04) };
      sh.uniforms.uGeo = { value: new THREE.Vector4(L / 2, s.R - inset, wsD1, shell0) };
      sh.uniforms.uCab = { value: new THREE.Vector2(C.start, prop ? 1 : 0) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', INSIDE).replace('#include <common>', `#include <common>
        varying vec3 vLoc; uniform vec4 uWin; uniform vec2 uWinS; uniform vec4 uGeo; uniform vec2 uCab;
        float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float d = uGeo.x - vLoc.x;
          float th = atan(vLoc.y, abs(vLoc.z));
          // janelas da cabine
          float i = clamp(floor((d - uWin.x) / uWin.y + 0.5), 0.0, uWin.z - 1.0);
          vec2 q = vec2(d - (uWin.x + i * uWin.y), (th - uWin.w) * uGeo.y);
          float sd = rbox(q, uWinS * 0.5, min(uWinS.x, uWinS.y) * 0.45);
          if (d > uCab.x - 0.05) {
            if (sd < 0.0) { if (q.y > uWinS.y * 0.5 - 0.05) diffuseColor.rgb = vec3(0.86, 0.83, 0.78); else discard; }
            else if (sd < 0.022) diffuseColor.rgb = vec3(0.22, 0.2, 0.19);
            else if (sd < 0.075) diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.022, 0.075, sd);
          }
          // cockpit: para-brisa e janelas laterais
          if (d < uGeo.z && d > uGeo.w + 0.05) {
            float post = abs(th - 1.5708);
            if (th > 0.3 && post > 0.03) discard;
          }
          if (d >= uGeo.z + 0.06 && d < uGeo.z + 0.66 && th > 0.12 && th < 0.62) discard;
          if (d < uGeo.z + 0.7) diffuseColor.rgb *= 0.32; // cockpit em tons escuros (antirreflexo)
        }`);
    };
    const sm = mesh(g, shellMat, 'lining'); sm.renderOrder = 0;
    // sancas de LED no teto (luz indireta quente)
    for (const sd of [1, -1]) {
      const y = floorY + (prop ? 0.98 : s.R < 1 ? 1.22 : 1.55);
      const zz = wallZ((C.start + shell1) / 2, y) * 0.86;
      const strip = new THREE.BoxGeometry(Math.max(0.1, shell1 - C.start - 0.25), 0.012, 0.035);
      const m = mesh(strip, M.led, 'led'); m.position.set(fx((C.start + shell1) / 2), y, sd * zz);
    }
  }

  // antepara traseira (cabines sem toalete, ex. Matrix: divisória do bagageiro traseiro)
  if (opts.lux && !lav) {
    const d = shell1; const p = f.profile(d); const cy = (p.top + p.bot) / 2, ry = (p.top - p.bot) / 2 - inset;
    const t0 = Math.asin(Math.max(-0.98, Math.min(0.98, (floorY - cy) / ry)));
    const pts: THREE.Vector2[] = []; for (let j = 0; j <= 40; j++) { const th = t0 + ((Math.PI - 2 * t0) * j) / 40; const q = f.point(d, th, inset - 0.01); pts.push(new THREE.Vector2(q.z, q.y)); }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 8); g.rotateY(Math.PI / 2); g.translate(fx(d), 0, 0);
    mesh(g, M.lining, 'bulkhead');
    const net = mesh(box(0.02, 0.5, wallZ(d, floorY + 0.4) * 1.6, 0.01), M.suede, 'bulkhead'); net.position.set(fx(d) + 0.02, floorY + 0.35, 0);
  }

  // ---------- piso ----------
  {
    const d0 = opts.lux ? shell0 + 0.1 : C.start, d1 = shell1;
    const n = 24, pts: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const d = d0 + ((d1 - d0) * i) / n, w = wallZ(d, floorY + 0.01);
      pts.push(fx(d), floorY, -w, fx(d), floorY, w); uv.push(d / 2, 0, d / 2, w);
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const a = g.index!.array as Uint16Array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; } g.computeVertexNormals(); }
    mesh(g, M.carpet, 'floor');
  }

  // ---------- poltronas ----------
  const sg = seatGeometries(sc); tr(sg.leather); tr(sg.trim);
  const seats: CabinBuild['seats'] = [];
  const seatZ = (d: number, side: number) => side * (wallZ(d, floorY + 0.5) - ledge - 0.31 * sc);
  C.seats.forEach((st, i) => {
    const g = new THREE.Group(); g.name = `seat-${i + 1}`;
    let z = seatZ(st.d, st.side);
    if (st.facing === 0) z = st.side * (wallZ(st.d, floorY + 0.5) - 0.34 * sc);
    g.position.set(fx(st.d), floorY, z);
    g.rotation.y = st.facing === 1 ? 0 : st.facing === -1 ? Math.PI : st.side * (Math.PI / 2);
    const onDivan = st.facing === 0 && C.zones.some((z) => z.kind === 'divan' && z.side === st.side && st.d > z.d0 && st.d < z.d1);
    if (!onDivan) {
      const a = new THREE.Mesh(sg.leather, M.leather); a.name = `seat-${i + 1}`; a.userData.xray = 'solid';
      const b = new THREE.Mesh(sg.trim, M.trim); b.name = `seat-${i + 1}`; b.userData.xray = 'solid';
      g.add(a, b);
    }
    group.add(g);
    seats.push({ pos: V(fx(st.d), floorY, z), facing: st.facing, side: st.side });
  });

  // ---------- móveis da planta ----------
  const furn = (z: CabinZone) => {
    const dm = (z.d0 + z.d1) / 2, len = z.d1 - z.d0;
    if (z.kind === 'table') {
      const tz = z.side * (wallZ(dm, floorY + 0.72) - ledge - 0.26 * sc);
      const top = mesh(box(len, 0.03, 0.52 * sc, 0.012), M.walnut, 'table'); top.position.set(fx(dm), floorY + 0.7 * (prop ? 0.85 : 1), tz);
      const edge = mesh(box(len + 0.01, 0.008, 0.53 * sc, 0.004), M.trim, 'table'); edge.position.set(fx(dm), top.position.y - 0.018, tz);
    } else if (z.kind === 'divan') {
      const zz = z.side * (wallZ(dm, floorY + 0.5) - 0.34 * sc);
      const base = mesh(box(len, 0.36, 0.62 * sc, 0.03), M.walnut, 'divan'); base.position.set(fx(dm), floorY + 0.18, zz);
      const cush = mesh(box(len - 0.12, 0.16, 0.6 * sc, 0.06), M.leather, 'divan'); cush.position.set(fx(dm), floorY + 0.44, zz);
      const back = mesh(box(len - 0.12, 0.62, 0.16, 0.07), M.leather, 'divan'); back.position.set(fx(dm), floorY + 0.8, zz + z.side * 0.24 * sc); back.rotation.x = -z.side * 0.1;
      for (const e of [z.d0 + 0.05, z.d1 - 0.05]) { const arm = mesh(box(0.1, 0.32, 0.62 * sc, 0.04), M.leather, 'divan'); arm.position.set(fx(e), floorY + 0.52, zz); }
    } else if (z.kind === 'galley' || z.kind === 'wardrobe' || z.kind === 'refresh' || z.kind === 'credenza') {
      const h = z.kind === 'credenza' ? 0.66 : z.kind === 'refresh' ? (prop ? 0.7 : 0.95) : Math.min(1.72, (prop ? 1.0 : s.R < 1 ? 1.32 : 1.72));
      const depth = z.kind === 'credenza' ? 0.4 : z.kind === 'refresh' ? 0.34 : 0.6;
      const zz = z.side * (wallZ(dm, floorY + h * 0.5) - depth / 2);
      const body = mesh(box(len, h, depth, 0.02), M.walnut, z.kind); body.position.set(fx(dm), floorY + h / 2, zz);
      if (z.kind !== 'wardrobe') {
        const ctH = z.kind === 'galley' ? 0.98 : h;
        const ct = mesh(box(len + 0.02, 0.035, depth + 0.04, 0.01), M.marble, z.kind); ct.position.set(fx(dm), floorY + ctH, zz - z.side * 0.02);
        if (opts.lux) { const lg = mesh(new THREE.BoxGeometry(len - 0.06, 0.01, 0.02), M.led, 'led'); lg.position.set(fx(dm), floorY + ctH - 0.03, zz - z.side * (depth / 2 + 0.005)); }
        if (z.kind === 'galley') { const up = mesh(box(len, 0.5, depth * 0.7, 0.02), M.walnut, z.kind); up.position.set(fx(dm), floorY + 1.4, zz + z.side * depth * 0.15); }
      }
      // puxadores cromados
      for (let k = 0; k < Math.max(1, Math.round(len / 0.35)); k++) { const hdl = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), M.trim, z.kind); hdl.position.set(fx(z.d0 + (k + 0.5) * (len / Math.max(1, Math.round(len / 0.35)))), floorY + h * 0.62, zz - z.side * (depth / 2 + 0.008)); }
    } else if (z.kind === 'lav') {
      // antepara de popa com porta de correr em nogueira (o toalete com cinto fica atrás)
      const d = z.d0; const pts: THREE.Vector2[] = [];
      const p = f.profile(d); const cy = (p.top + p.bot) / 2, ry = (p.top - p.bot) / 2 - inset;
      const t0 = Math.asin(Math.max(-0.98, Math.min(0.98, (floorY - cy) / ry)));
      for (let j = 0; j <= 40; j++) { const th = t0 + ((Math.PI - 2 * t0) * j) / 40; const q = f.point(d, th, inset - 0.01); pts.push(new THREE.Vector2(q.z, q.y)); }
      const shape = new THREE.Shape(pts);
      const dw = prop ? 0.5 : s.R < 1 ? 0.56 : 0.66, dh = Math.min(1.75, (p.top - inset) - floorY - 0.12);
      // antepara fechada (a porta de correr é um painel à frente dela): nada atravessa para fora da cabine
      const g = new THREE.ShapeGeometry(shape, 8); g.rotateY(Math.PI / 2); g.translate(fx(d), 0, 0);
      const wall = mesh(g, M.lining, 'lavatory');
      void wall;
      const door = mesh(box(0.03, dh, dw, 0.01), M.walnut, 'lavatory'); door.position.set(fx(d) + 0.02, floorY + dh / 2, 0);
      const hdl = mesh(new THREE.BoxGeometry(0.02, 0.22, 0.014), M.trim, 'lavatory'); hdl.position.set(fx(d) + 0.04, floorY + dh * 0.52, dw * 0.38);
    }
  };
  C.zones.forEach(furn);

  // ---------- aparadores laterais (ledge) com tampo de nogueira e friso cromado ----------
  if (ledge > 0) {
    const blocks = C.zones.filter((z) => z.side !== 0 && ['galley', 'wardrobe', 'divan', 'refresh', 'credenza', 'entry'].includes(z.kind));
    for (const side of [-1, 1] as const) {
      const cuts = blocks.filter((z) => z.side === side).map((z) => [z.d0, z.d1] as const).sort((a, b) => a[0] - b[0]);
      let d = C.start + 0.05; const end = (lav ? lav.d0 : C.end) - 0.05;
      const runs: [number, number][] = [];
      for (const [a, b] of cuts) { if (a > d + 0.2) runs.push([d, Math.min(a, end)]); d = Math.max(d, b); }
      if (end > d + 0.2) runs.push([d, end]);
      for (const [a, b] of runs) {
        const dm = (a + b) / 2, y = floorY + 0.62;
        const zz = side * (wallZ(dm, y) - ledge / 2 + 0.01);
        const top = mesh(box(b - a, 0.03, ledge, 0.01), M.walnut, 'ledge'); top.position.set(fx(dm), y, zz);
        const rail = mesh(new THREE.BoxGeometry(b - a, 0.008, 0.01), M.trim, 'ledge'); rail.position.set(fx(dm), y + 0.02, zz - side * (ledge / 2 - 0.004));
      }
    }
  }

  // ---------- cockpit ----------
  const ck = new THREE.Group(); ck.name = 'cockpit-lux'; group.add(ck);
  let updatePanel: CabinBuild['updatePanel'] = () => {};
  const pilotZ = -(prop ? 0.29 : s.R < 1 ? 0.36 : 0.44);
  const pilotEye = V(fx(crewD) + 0.08, floorY + (prop ? 0.86 : 1.06), pilotZ);
  {
    const cp = s.cabin.cockpit;
    // assentos de tripulação
    const cg = seatGeometries(sc * 0.95); tr(cg.leather); tr(cg.trim);
    for (const side of [-1, 1]) { const m = new THREE.Mesh(cg.leather, M.crew); m.name = 'crew-seat'; m.userData.xray = 'solid'; m.position.set(fx(crewD), floorY, side * Math.abs(pilotZ)); ck.add(m); const t = new THREE.Mesh(cg.trim, M.trim); t.name = 'crew-seat'; t.position.copy(m.position); ck.add(t); }
    // painel principal, glareshield e console central
    const pw = wallZ(panelD, floorY + 0.7) * 2 * 0.96;
    const ph = prop ? 0.42 : 0.5, py = floorY + (prop ? 0.62 : 0.74);
    const pan = mesh(box(0.1, ph, pw, 0.02), M.panel, 'panel', ck); pan.position.set(fx(panelD), py, 0);
    const gl = mesh(box(0.32, 0.05, pw * 0.98, 0.02), M.suede, 'panel', ck); gl.position.set(fx(panelD) - 0.1, py + ph / 2 + 0.02, 0);
    const ped = mesh(box(0.75, 0.42, prop ? 0.18 : 0.3, 0.03), M.panel, 'panel', ck); ped.position.set(fx(panelD) - 0.42, floorY + 0.36, 0); ped.rotation.z = 0.25;
    if (opts.lux) {
      const D = makeDisplays(); tr(D.pfd); tr(D.mfd);
      const scr = (tex: THREE.Texture) => tr(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      const pfdM = scr(D.pfd), mfdM = scr(D.mfd);
      const inch = cp.displays.inch * 0.0254;
      const dw = cp.displays.portrait ? inch * 0.6 : inch * 0.8, dh = cp.displays.portrait ? inch * 0.8 : inch * 0.6;
      const n = cp.displays.n;
      const gap = Math.min(0.03, (pw - n * dw) / (n + 1));
      for (let k = 0; k < n; k++) {
        const isPfd = n === 3 ? k !== 1 : k === 0 || k === n - 1;
        const wk = prop && k === 1 ? dw * 1.35 : dw, hk = prop && k === 1 ? dh * 1.35 : dh;
        const zc = (k - (n - 1) / 2) * (dw + gap) * (prop ? 1.12 : 1);
        const bez = mesh(box(0.02, hk + 0.03, wk + 0.03, 0.006), M.suede, 'displays', ck); bez.position.set(fx(panelD) - 0.055, py + 0.02, zc);
        const pl = new THREE.PlaneGeometry(wk, hk); pl.rotateY(-Math.PI / 2);
        const sm = mesh(pl, isPfd ? pfdM : mfdM, 'displays', ck); sm.position.set(fx(panelD) - 0.067, py + 0.02, zc);
      }
      if (cp.displays.pedestal) { const pl = new THREE.PlaneGeometry(0.2, 0.15); pl.rotateY(-Math.PI / 2); pl.rotateZ(0.9); const sm = mesh(pl, mfdM, 'displays', ck); sm.position.set(fx(panelD) - 0.5, floorY + 0.6, 0); }
      updatePanel = (t) => D.drawPfd(t);
    }
    // comando de voo: sidestick nos consoles externos (Embraer) ou manche (Citation, Matrix)
    for (const side of [-1, 1]) {
      const z0 = side * Math.abs(pilotZ);
      if (cp.control === 'sidestick') {
        const con = mesh(box(0.5, 0.12, 0.14, 0.03), M.panel, 'panel', ck); con.position.set(fx(crewD) + 0.25, floorY + 0.62, side * (Math.abs(pilotZ) + 0.36));
        const st = mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.16, 12), M.suede, 'panel', ck); st.position.set(fx(crewD) + 0.38, floorY + 0.75, side * (Math.abs(pilotZ) + 0.36)); st.rotation.z = -0.25;
        const grip = mesh(box(0.06, 0.1, 0.05, 0.02), M.suede, 'panel', ck); grip.position.set(fx(crewD) + 0.36, floorY + 0.85, side * (Math.abs(pilotZ) + 0.36));
      } else {
        const col = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10), M.panel, 'panel', ck); col.rotation.z = Math.PI / 2; col.position.set(fx(panelD) - 0.22, py - 0.05, z0);
        const yoke = mesh(new THREE.TorusGeometry(prop ? 0.1 : 0.12, 0.016, 8, 24, Math.PI), M.suede, 'panel', ck); yoke.rotation.set(0, Math.PI / 2, Math.PI); yoke.position.set(fx(panelD) - 0.43, py + 0.02, z0);
        const hub = mesh(box(0.05, 0.06, 0.1, 0.015), M.trim, 'panel', ck); hub.position.set(fx(panelD) - 0.43, py - 0.04, z0);
      }
    }
    // manetes no console central
    const colors = cp.levers === 3 ? ['#1d1d1f', '#2d6fd6', '#d63a2d'] : ['#d9dde2', '#d9dde2'];
    colors.forEach((c, k) => {
      const lm = tr(new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: c === '#d9dde2' ? 0.9 : 0.1 }));
      const lv = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), M.trim, 'panel', ck); lv.position.set(fx(panelD) - 0.38, floorY + 0.64, (k - (colors.length - 1) / 2) * 0.045); lv.rotation.z = -0.4;
      const kn = mesh(new THREE.SphereGeometry(0.02, 12, 8), lm, 'panel', ck); kn.position.set(fx(panelD) - 0.35, floorY + 0.71, (k - (colors.length - 1) / 2) * 0.045);
    });
    // painéis de botões (piloto automático no glareshield, inferiores, pedestal) — arranjo por suíte
    if (opts.lux) {
      const suite = cp.suite.includes('Fusion') ? 'fusion' : cp.suite.includes('21') ? 'pl21' : 'g1000';
      const tm = (t: THREE.Texture) => dim(tr(new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.2, emissive: new THREE.Color('#ffffff'), emissiveMap: t, emissiveIntensity: 0.32 })));
      const fgp = tr(switchPanelTex('fgp', suite)), low = tr(switchPanelTex('lower', suite)), pedT = tr(switchPanelTex('pedestal', suite));
      const fg = new THREE.PlaneGeometry(pw * 0.62, pw * 0.62 / 8); fg.rotateY(-Math.PI / 2); fg.rotateZ(-0.5);
      const fm = mesh(fg, tm(fgp), 'panel', ck); fm.position.set(fx(panelD) - 0.2, py + ph / 2 + 0.065, 0);
      const lg = new THREE.PlaneGeometry(pw * 0.9, pw * 0.9 / 4); lg.rotateY(-Math.PI / 2);
      const lm2 = mesh(lg, tm(low), 'panel', ck); lm2.position.set(fx(panelD) - 0.052, py - ph / 2 + pw * 0.9 / 8 - 0.02, 0); lm2.scale.set(1, 0.6, 1);
      const pg = new THREE.PlaneGeometry(prop ? 0.16 : 0.27, prop ? 0.1 : 0.2); pg.rotateX(-Math.PI / 2); pg.rotateY(-Math.PI / 2);
      const pm2 = mesh(pg, tm(pedT), 'panel', ck); pm2.position.set(fx(panelD) - 0.62, floorY + 0.5, 0); pm2.rotation.z = 0.25;
      // pedais do leme e coluna do painel
      for (const side of [-1, 1]) for (const e of [-0.09, 0.09]) { const pd2 = mesh(box(0.05, 0.2, 0.08, 0.01), M.trim, 'panel', ck); pd2.position.set(fx(panelD) - 0.08, floorY + 0.14, side * Math.abs(pilotZ) + e); pd2.rotation.z = 0.5; }
      // standby e luzes de alerta principais
      for (const side of [-1, 1]) { const ma = mesh(box(0.012, 0.03, 0.05, 0.004), M.led, 'panel', ck); ma.position.set(fx(panelD) - 0.21, py + ph / 2 + 0.03, side * Math.abs(pilotZ) * 0.9); }
      // HUD do piloto (Embraer: HGS-3500 + EVS, opcional) — vidro combinador
      if (cp.control === 'sidestick') { const hg = new THREE.PlaneGeometry(0.16, 0.12); hg.rotateY(-Math.PI / 2); const hm = new THREE.Mesh(tr(hg), tr(new THREE.MeshBasicMaterial({ color: '#9dffc4', transparent: true, opacity: 0.025, depthWrite: false }))); hm.name = 'panel'; hm.position.set(pilotEye.x + 0.28, pilotEye.y + 0.02, pilotZ); ck.add(hm); }
      // manete de flaps e speedbrake (jatos)
      if (!prop) { const fl = mesh(box(0.05, 0.08, 0.025, 0.008), M.trim, 'panel', ck); fl.position.set(fx(panelD) - 0.48, floorY + 0.68, 0.11); const sb = mesh(box(0.04, 0.06, 0.02, 0.008), M.suede, 'panel', ck); sb.position.set(fx(panelD) - 0.48, floorY + 0.68, -0.11); }
    }
    // painel superior (jatos)
    if (cp.overhead && opts.lux) {
      const oy = (f.profile(crewD).top - inset) - 0.1;
      const ov = mesh(box(0.6, 0.06, 0.42, 0.02), M.panel, 'panel', ck); ov.position.set(fx(crewD) + 0.35, oy, 0); ov.rotation.z = -0.15;
      const ot = tr(switchPanelTex('overhead', 'fusion'));
      const og = new THREE.PlaneGeometry(0.56, 0.4); og.rotateX(Math.PI / 2); og.rotateY(Math.PI / 2);
      const om = mesh(og, tr(new THREE.MeshStandardMaterial({ map: ot, emissive: new THREE.Color('#ffffff'), emissiveMap: ot, emissiveIntensity: 0.3, roughness: 0.6 })), 'panel', ck); om.position.set(fx(crewD) + 0.35, oy - 0.032, 0); om.rotation.z = -0.15;
    }
    // antepara do cockpit com passagem (jatos)
    if (!prop && opts.lux) {
      const d = C.start; const p = f.profile(d); const cy = (p.top + p.bot) / 2, ry = (p.top - p.bot) / 2 - inset;
      const t0 = Math.asin(Math.max(-0.98, Math.min(0.98, (floorY - cy) / ry)));
      const pts: THREE.Vector2[] = []; for (let j = 0; j <= 40; j++) { const th = t0 + ((Math.PI - 2 * t0) * j) / 40; const q = f.point(d, th, inset - 0.01); pts.push(new THREE.Vector2(q.z, q.y)); }
      const shape = new THREE.Shape(pts);
      const dw = s.R < 1 ? 0.5 : 0.62, dh = Math.min(1.78, (p.top - inset) - floorY - 0.08);
      const hole = new THREE.Path(); hole.moveTo(-dw / 2, floorY); hole.lineTo(dw / 2, floorY); hole.lineTo(dw / 2, floorY + dh); hole.lineTo(-dw / 2, floorY + dh); hole.closePath(); shape.holes.push(hole);
      const g = new THREE.ShapeGeometry(shape, 8); g.rotateY(-Math.PI / 2); g.translate(fx(d), 0, 0);
      mesh(g, M.walnut, 'bulkhead');
    }
  }

  // hangar: mescla os móveis estáticos por material (poucas chamadas de desenho por aeronave)
  if (!opts.lux) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map<string, { mat: THREE.Material; name: string; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
    group.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      let p: THREE.Object3D | null = m; let inSeat = false; while (p) { if (p.name.startsWith('seat-')) inSeat = true; p = p.parent; }
      if (inSeat) return;
      const name = m.name === 'lavatory' || m.name === 'floor' || m.name === 'crew-seat' || m.name === 'displays' ? m.name : m.parent?.name === 'cockpit-lux' ? 'panel' : 'furnishing';
      const k = `${(m.material as THREE.Material).uuid}|${name}`;
      let b = buckets.get(k); if (!b) { b = { mat: m.material as THREE.Material, name, geos: [], meshes: [] }; buckets.set(k, b); }
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); b.geos.push(g); b.meshes.push(m);
    });
    for (const b of buckets.values()) {
      if (b.meshes.length < 2) continue;
      const merged = mergeGeometries(b.geos); b.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      b.meshes.forEach((m) => m.parent?.remove(m));
      const mm = new THREE.Mesh(tr(merged), b.mat); mm.name = b.name; mm.userData.xray = 'solid'; group.add(mm);
    }
  }
  // primeira pessoa: em pé onde a cabine permite (Embraer 1,83 m; CJ2+ 1,45 m curvado; Matrix 1,19 m agachado)
  const eyeY = floorY + (prop ? 0.92 : s.R < 1 ? 1.2 : 1.5);
  const wd0 = prop ? C.start + 0.85 : crewD + 0.2, wd1 = (lav ? lav.d0 : C.end) - 0.28;
  const walk = {
    eyeY,
    clamp: (q: THREE.Vector3) => {
      const d = Math.min(wd1, Math.max(wd0, L / 2 - q.x));
      const hw = Math.max(0.04, Math.min(wallZ(d, eyeY + 0.1) - 0.12, wallZ(d, eyeY - 0.35) - 0.3)); // a cabeça não atravessa a curva do teto
      q.x = L / 2 - d; q.z = Math.max(-hw, Math.min(hw, q.z)); q.y = eyeY;
      return q;
    },
  };
  return { group, seats, pilotEye, walk, updatePanel, dispose: () => disp.forEach((d) => d.dispose()) };
}
