'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { damp, frame, pulse, ramp, ui, clamp, fleetDwell } from '@/experience/director';
import { buildTracks, sampleTracks, GLOBE_CENTER, type Track } from '@/experience/cameraPath';
import { domRefs } from '@/experience/domRefs';
import { buildJet, type JetBuild } from './jet/buildJet';
import { CUT } from './jet/materials';
import { createAnatomy24 } from './anatomy24';
import { groundY, SPECS } from './jet/spec';
import { createCloudPuffs, createCloudSea, createSkyDome, lerpPalette, SKY_PALETTES } from './env/sky';
import { createEnvMaps, type EnvKey } from './env/envmaps';
import { createBlueprintGrid, createHangar } from './env/hangar';
import { createGlobe, facing } from './globe/globe';
import { createContrails } from './env/contrails';
import { createAirflow } from './env/airflow';
import PostFX, { fx } from './PostFX';
import { createTraffic } from './env/traffic';
import { applyInspect } from './inspector';
import { buildFleetCraft, type FleetCraftBuild } from './fleet/airframe';
import { FLEET_SPECS } from './fleet/specs';
import { FLEET } from '@/content/fleet';
import { prefs } from '@/i18n';
import { createFlightWorld } from './flight/world';
import { FlightSim } from './flight/sim';
import { flightUi } from '@/experience/flight';
import { DESTINATIONS } from '@/content/destinations';
import type { PartId, VariantId, ViewId } from '@/content/site';

type Q = 'high' | 'balanced';

/** Se a pós-produção falhar (GPU sem suporte a algum recurso), a cena continua sem efeitos. */
class FXBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('[777] pós-produção desativada:', e); }
  render() { return this.state.failed ? null : this.props.children; }
}
const C = (hex: string) => new THREE.Color(hex);
/** V6: fila de estacionamento no pátio (z) e posição de destaque da aeronave escolhida (mais perto da câmera) */
const ROW_Z = 30, FRONT_Z = 6;
const BG = { hangar: C('#06080b'), studio: C('#f1eee7'), cabin: C('#20170f'), globe: C('#081428') };


function World({ quality, onReady }: { quality: Q; onReady: () => void }) {
  const { gl, scene, camera, size } = useThree();
  const perf = ui.useStore((st) => st.perf);
  const dofOn = ui.useStore((st) => st.dof);
  const floorOn = ui.useStore((st) => st.floor);
  const canvasReady = ui.useStore((st) => st.canvasReady);
  const [fxOn, setFxOn] = useState(false);
  // a cena aparece primeiro; bloom/DOF/AO entram logo depois (não bloqueiam o primeiro quadro)
  useEffect(() => { if (!canvasReady) return; const id = window.setTimeout(() => setFxOn(true), 500); return () => window.clearTimeout(id); }, [canvasReady]);
  const cam = camera as THREE.PerspectiveCamera;
  const variant = ui.useStore((s) => s.variant);
  const detail = quality === 'high' ? 1 : 0.7;

  // ---------- construção (memoizada) ----------
  const env = useMemo(() => {
    const sky = createSkyDome(SKY_PALETTES.dawn);
    const sea = createCloudSea(SKY_PALETTES.dawn, quality === 'high' ? 5 : 4);
    sea.mesh.position.y = -70;
    const puffs = createCloudPuffs(SKY_PALETTES.dawn, quality === 'high' ? 90 : 40);
    const skyGroup = new THREE.Group();
    skyGroup.add(sky.mesh, sea.mesh, puffs.mesh);
    const gy = groundY(SPECS.XR);
    const hangar = createHangar(gy);
    const grid = createBlueprintGrid(gy);
    const maps = createEnvMaps(gl, sky.mesh);
    maps.get('sky');
    return { sky, sea, puffs, skyGroup, hangar, grid, maps, gy };
  }, [gl, quality]);

  const jet = useMemo<JetBuild>(() => buildJet(variant, { textureSize: quality === 'high' ? 2048 : 1024, detail }), [variant, quality, detail]);
  const anatomy24 = useMemo(() => createAnatomy24(jet), [jet]);
  useEffect(() => () => { anatomy24.dispose(); jet.dispose(); }, [jet, anatomy24]);
  useEffect(() => () => {
    env.sea.mesh.geometry.dispose(); (env.sea.mesh.material as THREE.Material).dispose();
    env.sky.mesh.geometry.dispose(); (env.sky.mesh.material as THREE.Material).dispose();
    env.puffs.dispose(); env.hangar.dispose(); env.grid.dispose();
    env.maps.dispose();
  }, [env]);

  // posições de estacionamento do pátio calculadas das dimensões reais de cada tipo
  useEffect(() => {
    env.hangar.setStands(FLEET.map((f) => {
      const sp = FLEET_SPECS[f.id]; const L = sp.fusL ?? sp.envelope.length;
      const tipD = sp.wing.d + (sp.envelope.span / 2) * Math.tan(THREE.MathUtils.degToRad(sp.wing.sweep)) + sp.wing.tip * 0.5;
      return { x: f.x, z: ROW_Z, length: sp.envelope.length, span: sp.envelope.span, noseX: f.x + L / 2 + (sp.nose === 'prop' ? 0.4 : 0), tipX: f.x + L / 2 - tipD };
    }));
  }, [env]);
  const contrails = useMemo(() => createContrails(), []);
  useEffect(() => { contrails.place(jet.exhausts); jet.group.add(contrails.group); return () => { jet.group.remove(contrails.group); }; }, [jet, contrails]);
  useEffect(() => () => contrails.dispose(), [contrails]);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const airflow = useMemo(() => createAirflow(jet, quality === 'high' ? 90 : 50), [jet, quality]);
  useEffect(() => { jet.group.add(airflow.mesh); return () => { jet.group.remove(airflow.mesh); airflow.dispose(); }; }, [jet, airflow]);
  const flow = useRef({ sea: 0, puff: 0, fan: 0 });

  // ---------- frota SimFly: cinco aeronaves anunciadas (ilustração paramétrica calibrada), construídas em idle ----------
  type Craft = FleetCraftBuild & { x: number; halo?: THREE.Mesh };
  const lineup = useMemo(() => { const g = new THREE.Group(); g.name = 'lineup'; return g; }, []);
  const crafts = useRef<Craft[]>([]);
  // ---------- vida do aeroporto: tráfego pousando (mesmo gerador da frota) e carrinhos de pátio ----------
  const life = useMemo(() => {
    const g = new THREE.Group(); g.name = 'airport-life';
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!; const r = x.createRadialGradient(64, 64, 1, 64, 64, 64); r.addColorStop(0, 'rgba(255,250,240,1)'); r.addColorStop(0.22, 'rgba(255,235,200,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, 128, 128);
    const glow = new THREE.CanvasTexture(c); glow.colorSpace = THREE.SRGBColorSpace;
    const spr = (color: string, size: number) => { const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s2.scale.set(size, size, 1); return s2; };
    // carrinhos de pátio (estilo golf cart de apoio): carroceria, assento, capota, rodas, faróis e lanternas
    const body = new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.35, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.7 });
    const carts: { obj: THREE.Group; off: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const cart = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.25), body); b.position.y = 0.65; cart.add(b);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.1), dark); seat.position.set(-0.3, 1.2, 0); cart.add(seat);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.3), body); roof.position.set(-0.1, 2.05, 0); cart.add(roof);
      for (const [px, pz] of [[0.75, 0.55], [0.75, -0.55], [-0.95, 0.55], [-0.95, -0.55]]) { const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), dark); p2.position.set(px, 1.5, pz); cart.add(p2); }
      for (const [px, pz] of [[0.8, 0.62], [0.8, -0.62], [-0.8, 0.62], [-0.8, -0.62]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14), dark); w.rotation.x = Math.PI / 2; w.position.set(px, 0.28, pz); cart.add(w); }
      for (const pz of [0.4, -0.4]) { const h = spr('#fff6e0', 1.6); h.position.set(1.25, 0.7, pz); cart.add(h); const t2 = spr('#ff3a2a', 0.8); t2.position.set(-1.25, 0.7, pz); cart.add(t2); }
      g.add(cart); carts.push({ obj: cart, off: i / 3 });
    }
    return { group: g, carts, spr, dispose: () => { glow.dispose(); body.dispose(); dark.dispose(); } };
  }, []);
  useEffect(() => () => life.dispose(), [life]);
  type Traffic = FleetCraftBuild & { off: number; mode: 'land' | 'takeoff' | 'over' | 'parked'; land: THREE.Sprite; strobes: THREE.Sprite[]; beacon: THREE.Sprite; smoke: THREE.Sprite[] };
  const traffic2 = useRef<Traffic[]>([]);
  useEffect(() => {
    let cancelled = false;
    const todo = [...FLEET];
    // prioridade adaptativa: ociosidade enquanto o visitante está no céu; urgente ao se aproximar do hangar/frota
    const ric = (window as unknown as { requestIdleCallback?: (c: () => void, o?: object) => number }).requestIdleCallback;
    const idle = (cb: () => void) => {
      const wait = () => { if (cancelled) return; if (frame.t > 1.1) window.setTimeout(cb, 60); else if (ric) ric(() => window.setTimeout(wait, 400), { timeout: 1500 }); else window.setTimeout(wait, 500); };
      wait();
    };
    const next = () => {
      if (cancelled) return;
      const item = todo.shift();
      if (!item) {
        // depois da frota: dois jatos de tráfego em ciclo de pouso (ilustração do mesmo gerador, sem rótulo comercial)
        if (!cancelled) {
          // aeronave real estacionada dentro do hangar de portão aberto (nariz para o portão)
          const hb = buildFleetCraft('praetor-500', { textureSize: 1024, detail: 0.6 });
          hb.group.position.set(-193, env.gy + hb.axisH, 61); hb.group.rotation.y = 0.95;
          life.group.add(hb.group);
          traffic2.current.push(Object.assign(hb, { off: 0, mode: 'parked' as const, land: life.spr('#000000', 0.01), strobes: [], beacon: life.spr('#000000', 0.01), smoke: [] }));
        }
        ([['praetor-600', 'land', 0], ['citation-cj2-plus', 'takeoff', 0.35], ['legacy-450', 'over', 0.6]] as const).forEach(([id, mode, off]) => {
          if (cancelled) return;
          const tb = buildFleetCraft(id, { textureSize: 512, detail: 0.45 });
          tb.group.traverse((o) => { if (o.name.startsWith('contact-shadow')) o.visible = false; });
          const land = life.spr('#fffaf0', 16); land.position.set(tb.size / 2 + 0.6, -0.4, 0); tb.group.add(land);
          const strobes = [-1, 1].map((sd) => { const st2 = life.spr('#ffffff', 5); st2.position.set(0, 0, sd * FLEET_SPECS[id].envelope.span * 0.5); tb.group.add(st2); return st2; });
          const beacon = life.spr('#ff2a1a', 3.2); beacon.position.set(0, FLEET_SPECS[id].R + 0.25, 0); tb.group.add(beacon);
          // fumaça de pneu no toque (só no pouso)
          const smoke = [-1, 1].map((sd) => { const sp = life.spr('#cfc8bd', 3); sp.material.blending = THREE.NormalBlending; sp.position.set(-1.5, -tb.axisH + 0.4, sd * FLEET_SPECS[id].gear.track / 2); tb.group.add(sp); return sp; });
          life.group.add(tb.group);
          traffic2.current.push(Object.assign(tb, { off, mode, land, strobes, beacon, smoke }));
        });
        return;
      }
      let b: FleetCraftBuild;
      try { b = buildFleetCraft(item.id, { textureSize: 2048, detail: quality === 'high' ? 1 : 0.85 }); }
      catch (err) { console.error('[simfly] falha ao construir', item.id, err); idle(next); return; }
      b.group.position.set(item.x, env.gy + b.axisH, ROW_Z);
      const c: Craft = Object.assign(b, { x: item.x });
      // halo de apresentação no chão (aparece quando esta aeronave é a escolhida)
      {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const gx = cv.getContext('2d')!; const rg = gx.createRadialGradient(128, 128, 10, 128, 128, 128);
        rg.addColorStop(0, 'rgba(225,240,255,0.55)'); rg.addColorStop(0.45, 'rgba(140,195,255,0.22)'); rg.addColorStop(0.8, 'rgba(90,160,255,0.06)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        gx.fillStyle = rg; gx.fillRect(0, 0, 256, 256);
        const ht = new THREE.CanvasTexture(cv); ht.colorSpace = THREE.SRGBColorSpace;
        const sp = FLEET_SPECS[item.id];
        const hm = new THREE.Mesh(new THREE.PlaneGeometry(sp.envelope.length * 1.25, sp.envelope.span * 1.05), new THREE.MeshBasicMaterial({ map: ht, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        hm.rotation.x = -Math.PI / 2; hm.position.y = -b.axisH + 0.03; hm.renderOrder = -1; hm.name = 'presentation-halo';
        b.group.add(hm); c.halo = hm;
        const prevDispose = b.dispose; c.dispose = () => { prevDispose(); ht.dispose(); hm.geometry.dispose(); (hm.material as THREE.Material).dispose(); };
      }
      lineup.add(c.group);
      // compila os shaders desta aeronave fora da thread principal antes de ela aparecer
      const done = () => {
        if (cancelled) { lineup.remove(c.group); c.dispose(); return; }
        crafts.current.push(c);
        if (new URLSearchParams(location.search).has('qa')) (window as unknown as { __777fleet: unknown }).__777fleet = crafts.current;
        idle(next);
      };
      // pré-compila as duas variantes (vívida e translúcida) para o destaque não travar ao rolar
      const compile = (): Promise<unknown> => (gl.compileAsync ? gl.compileAsync(c.group, camera, scene) : Promise.resolve());
      c.setFade(0.5);
      compile().then(() => { c.setFade(1); return compile(); }).then(done, done);
    };
    const start = window.setTimeout(() => idle(next), 1800);
    return () => { cancelled = true; window.clearTimeout(start); crafts.current.forEach((c) => { lineup.remove(c.group); c.dispose(); }); crafts.current = []; traffic2.current.forEach((t) => { life.group.remove(t.group); t.dispose(); }); traffic2.current = []; };
  }, [lineup, quality, gl, camera, scene, env.gy, life]);
  const traffic = useMemo(() => createTraffic(), []);
  useEffect(() => () => traffic.dispose(), [traffic]);
  const inspectP = useRef(0);
  const lastRegion = useRef<string | null>(null);

  // globo: construído só quando o visitante se aproxima de Destinos
  const globeHolder = useMemo(() => new THREE.Group(), []);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  useEffect(() => () => { globeRef.current?.dispose(); globeRef.current = null; }, [quality]);

  const tracks = useRef<Track[]>([]);
  useEffect(() => { tracks.current = buildTracks(jet, size.width / size.height); }, [jet, size.width, size.height]);

  // ---------- luzes ----------
  const lights = useMemo(() => {
    RectAreaLightUniformsLib.init();
    const sun = new THREE.DirectionalLight('#fff4e6', 3.0); sun.position.set(-72, 34, 60);
    const hemi = new THREE.HemisphereLight('#cfe0f2', '#f3dcd4', 0.8);
    const key = new THREE.RectAreaLight('#fff0dc', 0, 9, 2.2); key.position.set(-7, 6.5, -9); key.lookAt(-2, 0.6, 0);
    const rim = new THREE.DirectionalLight('#c9d3de', 0); rim.position.set(14, 9, 34);
    const cab = [0, 1, 2].map(() => { const p = new THREE.PointLight('#ffc98c', 0, 5.5, 1.7); return p; });
    // luz do céu entrando pelas janelas (fria) — contraste com as sancas quentes
    const winL = new THREE.RectAreaLight('#dbe6ff', 0, 12, 0.7);
    const winR = new THREE.RectAreaLight('#dbe6ff', 0, 12, 0.7);
    const g = new THREE.Group(); g.add(sun, hemi, key, rim, winL, winR, ...cab);
    return { g, sun, hemi, key, rim, cab, winL, winR };
  }, []);
  // ---------- test drive (V7) ----------
  const flightWorld = useMemo(() => createFlightWorld(env.gy), [env.gy]);
  useEffect(() => () => flightWorld.dispose(), [flightWorld]);
  const sim = useMemo(() => new FlightSim(), []);
  const flightHidden = useRef<THREE.Object3D[] | null>(null);
  useEffect(() => {
    jet.cabin.lightSpots.forEach((p, i) => lights.cab[i].position.copy(p));
    const s = jet.spec, cx = jet.fus.x((s.cabinStart + s.cabinEnd) / 2), w = s.R - 0.16;
    lights.winL.width = lights.winR.width = s.cabinEnd - s.cabinStart - 1;
    lights.winL.position.set(cx, 0.22, -w); lights.winL.lookAt(cx, -0.2, 0);
    lights.winR.position.set(cx, 0.22, w); lights.winR.lookAt(cx, -0.2, 0);
  }, [jet, lights]);

  const floorRef = useRef<THREE.Mesh>(null);
  // concreto do pátio: placas de 5 m com juntas, variação de tom, manchas de óleo e marcas de pneu (textura original)
  const apronTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8a8780'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,250,240' : '30,28,24'},${0.03 + Math.random() * 0.05})`; g.fillRect(i * 256, j * 256, 256, 256); }
    for (let k = 0; k < 26000; k++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,250' : '20,18,16'},${Math.random() * 0.07})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2); }
    for (let k = 0; k < 7; k++) { const x = Math.random() * 1024, y = Math.random() * 1024, r = 18 + Math.random() * 46; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,26,22,0.28)'); gr.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(40,36,32,0.18)'; g.lineWidth = 9; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, 300 + k * 160); g.bezierCurveTo(340, 260 + k * 170, 680, 380 + k * 120, 1024, 320 + k * 160); g.stroke(); }
    g.strokeStyle = 'rgba(28,26,24,0.24)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i * 256); g.lineTo(1024, i * 256); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(380 / 20, 108 / 20); t.anisotropy = 8;
    return t;
  }, []);
  useEffect(() => () => apronTex.dispose(), [apronTex]);
  const perfMon = useRef({ bad: 0, acc: 0, n: 0, cool: 4, good: 0, max: quality === 'high' ? 4 : 2, lock: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === 'lock' });
  // começa leve e sobe só quando o aparelho prova fluidez (tier alto inicia no nível 2, balanceado no 1)
  useEffect(() => { ui.set({ perf: perfMon.current.lock ? (quality === 'high' ? 3 : 1) : quality === 'high' ? 2 : 1 }); }, [quality]);
  const tmp = useMemo(() => ({ vel: new THREE.Vector3(), prevEye: new THREE.Vector3(), right: new THREE.Vector3(), roll: 0, camEye: null as THREE.Vector3 | null, eye: new THREE.Vector3(), target: new THREE.Vector3(), vEye: new THREE.Vector3(), vTarget: new THREE.Vector3(), bg: new THREE.Color(), proj: new THREE.Vector3(), wobble: new THREE.Euler(), pal: {} as Record<string, THREE.Color>, viewW: 0, explode: 0, camTgt: null as THREE.Vector3 | null, oc: new THREE.Vector3(), rv: new THREE.Vector3(), xray: 0, fleetIdx: 0, fogK: 1, fleetCamX: 0, lastIns: null as string | null, lastDest: null as string | null, globeYaw: 0, globePitch: 0, firstFrame: true, hotStill: 0 }), []);

  // ---------- configuração do renderer ----------
  useEffect(() => {
    gl.localClippingEnabled = true;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    scene.background = new THREE.Color('#e9dcd8');
    scene.fog = new THREE.FogExp2('#efd3cc', 0.0016);
  }, [gl, scene]);

  // ---------- loop de direção ----------
  useFrame((state, rawDt) => {
    const cpu0 = performance.now();
    const dt = Math.min(rawDt, 1 / 20);
    // ----- regulador de desempenho: mede o FPS real e ajusta o nível (com histerese) -----
    const pm = perfMon.current;
    if (rawDt > 0.25) { pm.acc = 0; pm.n = 0; pm.cool = Math.max(pm.cool, 2); } // volta de pausa/aba: não conta como FPS baixo
    else if (!pm.lock && !frame.freezeClock && !document.hidden) {
      pm.acc += rawDt; pm.n += 1;
      if (pm.acc > 1.2) {
        const fps = pm.n / pm.acc; pm.acc = 0; pm.n = 0;
        const lvl = ui.get().perf;
        pm.cool -= 1.2;
        pm.bad = fps < 40 ? (pm.bad ?? 0) + 1 : 0;
        // só reduz a resolução com FPS baixo sustentado (3 janelas seguidas ≈ 3,6 s) — sem quedas súbitas de qualidade
        if (((pm.bad ?? 0) >= 3 || fps < 22) && lvl > 1 && pm.cool <= 0) { ui.set({ perf: lvl - 1 }); pm.cool = 6; pm.good = 0; pm.bad = 0; }
        else if (fps > 57) { pm.good += 1.2; if (pm.good > 8 && lvl < pm.max && pm.cool <= 0) { ui.set({ perf: lvl + 1 }); pm.cool = 6; pm.good = 0; } }
        else pm.good = 0;
      }
    }
    if (!frame.freezeClock) frame.clock += dt;
    const time = frame.clock;
    // amortecimento do tempo global; saltos longos (navegação) cortam direto
    if (Math.abs(frame.t - frame.ts) > 1.2) frame.ts = frame.t;
    else frame.ts = damp(frame.ts, frame.t, frame.freezeClock ? 1000 : 5.5, dt);
    // Tempo editorial contínuo; IDs e poses legadas são preservados.
    const sequence = frame.ts;
    const handoff = (id: string, boundary: number) => {
      if (Math.abs(frame.t - boundary) > 0.12) return -1;
      const el = document.getElementById(id);
      if (!el) return -1;
      const y = el.getBoundingClientRect().top;
      return y > 0 && y < window.innerHeight ? 1 - y / window.innerHeight : -1;
    };
    const toFleet = handoff('frota', 6);
    const toDest = handoff('destinos', 7);
    let slot = sequence;
    if (toFleet >= 0) slot = toFleet < .5 ? 5.99999 : 6;
    if (toDest >= 0) slot = toDest < .5 ? 6.99999 : 7;
    const raw = slot < 3 ? slot : slot < 6 ? slot + 1 : slot < 7 ? slot - 3 : slot;
    const inFleet = slot >= 6 && slot < 7;
    const t = slot < 3 ? slot : slot < 6 ? slot : inFleet ? 2.9999 : slot < 8 ? 6.32 + (slot - 7) * .68 : slot - 1;
    const trk = tracks.current;
    if (!trk.length) return;
    const s = jet.spec;
    anatomy24.restoreFrame();
    const anatomyActive = !inFleet && t >= 3.34 && t < 3.985;
    const current = ui.get();
    if ((!anatomyActive || Math.abs(frame.chapters[4] - current.anatomyManualAt) > .12) && (current.explodeManual !== null || current.part !== null)) {
      ui.set({ explodeManual: null, part: null, anatomyDetail: null, anatomyAngle: 0, anatomyPitch: .65, anatomySubExplode: false });
    }
    const st = ui.get();

    // ----- câmera -----
    let fov = sampleTracks(trk, slot >= 5 && slot < 6 ? 5 + Math.min(1, (t - 5) / .88) : t, tmp.eye, tmp.target);
    // Final window shot now belongs to the cabin-to-fleet handoff, not the old globe.
    if (slot >= 5 && slot < 6 && t > 5.88) {
      const w = jet.cabin.spots.janela;
      const q = ramp(t, 5.88, 5.9999);
      const flight = toFleet >= 0 ? ramp(toFleet,0,.48) : 0;
      tmp.vTarget.copy(w.target).sub(w.eye).normalize();
      tmp.vEye.copy(w.target).addScaledVector(tmp.vTarget, 1.35 * q + 9 * ramp(t,5.94,5.9999) + 65 * flight);
      tmp.eye.lerp(tmp.vEye, q);
      tmp.target.lerp(tmp.vEye.addScaledVector(tmp.vTarget, 12 + flight * 60), q);
      fov = THREE.MathUtils.lerp(fov, 54, q);
    }
    if (inFleet) {
      const p = raw - 3;
      const all = crafts.current;
      const idx = frame.fleetSwipe ? frame.fleet : fleetDwell(p);
      tmp.fleetIdx = idx;
      const i0 = Math.floor(Math.min(idx, FLEET.length - 1)), f0 = idx - i0;
      const i1 = Math.min(FLEET.length - 1, i0 + 1);
      const portrait = window.innerWidth < window.innerHeight;
      const gy = env.gy;
      // câmera-protagonista: dolly até a escolhida, distância pelo tamanho real dela (Matrix e CJ2+ também ficam grandes),
      // enquadramento vertical pela lente: escolhida no terço superior, acima dos cards; a fila fica atrás como cenário
      const selX = THREE.MathUtils.lerp(FLEET[i0].x, FLEET[i1].x, f0);
      const sz = THREE.MathUtils.lerp(FLEET_SPECS[FLEET[i0].id].envelope.length, FLEET_SPECS[FLEET[i1].id].envelope.length, f0);
      const span = THREE.MathUtils.lerp(FLEET_SPECS[FLEET[i0].id].envelope.span, FLEET_SPECS[FLEET[i1].id].envelope.span, f0);
      const aspect = window.innerWidth / window.innerHeight;
      const vf = THREE.MathUtils.degToRad(portrait ? 34 : 40) / 2;
      const fit = (Math.max(sz, span * 0.8) * 0.62) / (Math.tan(vf) * aspect);
      const dist = Math.max(12, fit) * (portrait ? 0.6 : 1.12);
      const camX = selX;
      tmp.fleetCamX = camX;
      tmp.fogK = 1;
      const eh = 2.6 + sz * 0.16;
      const angSel = Math.atan2(eh - 2.1, dist);
      const look = angSel + (portrait ? 0.1 : 0.13);
      // retrato: desloca o quadro para o lado do nariz (+x) para a aeronave inteira caber centralizada
      const nx = portrait ? sz * 0.2 : 0;
      tmp.vEye.set(camX + sz * (portrait ? 0.32 : 0.3), gy + eh, FRONT_Z - dist);
      tmp.vTarget.set(camX - sz * 0.04 + nx, gy + eh - Math.tan(look) * (dist + 40), FRONT_Z + 40);
      const into = 1; // corte direto para o enquadramento da Frota (o véu do céu mascara a passagem)
      tmp.eye.lerp(tmp.vEye, into); tmp.target.lerp(tmp.vTarget, into);
      fov = THREE.MathUtils.lerp(fov, portrait ? 34 : 40, into);
      // inspeção: atlas da aeronave (órbita 360°, sistema isolado, planta, vista sentado)
      const ins = st.inspect ? all.find((c) => c.id === st.inspect) : null;
      tmp.viewW = damp(tmp.viewW, ins ? 1 : 0, 2.6, dt);
      if (ins) {
        const gp = ins.group.position;
        if (ins.seats.length < 0) { // planta 3D desativada: a planta agora é 2D técnica (DOM)
          // planta: de cima, teto cortado na linha das janelas, cabine inteira no quadro (nariz à esquerda)
          let x0 = Infinity, x1 = -Infinity; for (const se of ins.seats) { x0 = Math.min(x0, se.pos.x); x1 = Math.max(x1, se.pos.x); }
          const cx = gp.x + (x0 + x1) / 2, len = x1 - x0 + 2.4;
          const h = (len * 1.55 + 3) * (portrait ? 2.1 : 1);
          const shift = portrait ? 0 : len * 0.42;
          tmp.vEye.set(cx - shift, gp.y + ins.floorY + h, portrait ? -0.05 : -h * 0.08);
          tmp.vTarget.set(cx - shift, gp.y + ins.floorY, 0);
        } else if (st.inspectMode === 'seat' && st.seat !== null && ins.seats[st.seat]) {
          // vista sentado: altura dos olhos, olhando para frente e levemente para a janela
          const se = ins.seats[st.seat];
          tmp.vEye.set(gp.x + se.pos.x - se.facing * 0.18, gp.y + ins.floorY + (ins.id === 'matrix' ? 0.92 : 1.12), se.pos.z * 0.92);
          tmp.vTarget.set(tmp.vEye.x + se.facing * 3.2, tmp.vEye.y - 0.22, se.pos.z * 1.35);
        } else {
          const b = (st.inspectSystem && st.inspectPart ? ins.partBounds(st.inspectPart) : null) ?? (st.inspectSystem ? ins.bounds[st.inspectSystem] : null);
          const c = tmp.oc.set(gp.x, gp.y - ins.axisH * 0.12, gp.z);
          if (b) ins.group.localToWorld(c.copy(b.center));
          const rad = b ? b.radius : ins.size * 0.55;
          const d = (b ? rad * 2.5 + 1.4 : rad * 2.2) * (portrait ? 1.65 : 1);
          const yaw = -1.04 + frame.orbitYaw, pitch = clamp(0.2 + frame.orbitPitch, 0.02, 1.35);
          tmp.vEye.set(c.x + d * Math.cos(pitch) * Math.cos(yaw), c.y + d * Math.sin(pitch), c.z + d * Math.cos(pitch) * Math.sin(yaw));
          tmp.vTarget.copy(c);
          // composição: libera o painel (direita no desktop, base no celular)
          if (!portrait) { tmp.rv.copy(tmp.vTarget).sub(tmp.vEye).cross(THREE.Object3D.DEFAULT_UP).normalize().multiplyScalar(rad * 0.45); tmp.vEye.add(tmp.rv); tmp.vTarget.add(tmp.rv); }
          else { tmp.vEye.y -= rad * 0.5; tmp.vTarget.y -= rad * 0.5; }
        }
      }
      if (tmp.viewW > 0.001 && (ins || tmp.viewW > 0.01)) { tmp.eye.lerp(tmp.vEye, tmp.viewW); tmp.target.lerp(tmp.vTarget, tmp.viewW); fov = THREE.MathUtils.lerp(fov, st.inspectMode === 'seat' ? 56 : 36, tmp.viewW); }
      // câmera do atlas amortecida (troca de sistema/planta sem salto; órbita com inércia curta)
      if (ins) {
        tmp.camEye = tmp.camEye ?? tmp.eye.clone(); tmp.camTgt = tmp.camTgt ?? tmp.target.clone();
        const k = 1 - Math.exp(-(st.motion === 'reduced' ? 30 : st.inspectMode === 'parts' ? 5 : 3.2) * dt);
        tmp.camEye.lerp(tmp.eye, k); tmp.camTgt.lerp(tmp.target, k);
        tmp.eye.copy(tmp.camEye); tmp.target.copy(tmp.camTgt);
      } else { tmp.camEye = null; tmp.camTgt = null; }
    }
    // perspectivas manuais no hangar (Exterior / Cabine / Detalhes)
    const viewActive = st.view && !inFleet && t > 2.05 && t < 2.99 ? 1 : 0;
    if (!inFleet) tmp.viewW = damp(tmp.viewW, viewActive, 3.2, dt);
    if (!inFleet && tmp.viewW > 0.001 && st.view) {
      viewPose(jet, st.view, tmp.vEye, tmp.vTarget);
      tmp.eye.lerp(tmp.vEye, tmp.viewW);
      tmp.target.lerp(tmp.vTarget, tmp.viewW);
      fov = THREE.MathUtils.lerp(fov, st.view === 'detalhes' ? 34 : 38, tmp.viewW);
    }
    // parallax sutil (somente fora da cabine)
    const outside = t < 1.15 || (t > 1.9 && t < 4.4) || t > 6.4;
    const par = inFleet ? 0 : outside ? 0.35 : 0.04; // frota: câmera firme (linhas da pista não 'andam' com o mouse)
    tmp.eye.x += frame.px * par * (t > 3.2 && t < 4.4 ? 0.2 : 1);
    tmp.eye.y += frame.py * par * 0.5;
    cam.position.copy(tmp.eye);
    cam.lookAt(tmp.target);
    // câmera na mão: micro-oscilação orgânica (soma de senos), menor dentro da cabine
    if (st.motion === 'cinematic' && !frame.freezeClock && !inFleet) {
      const amp = (outside ? 0.0011 : 0.0006) + 0.0012 * (1 - ramp(t, 0.6, 1.0));
      cam.rotateX((Math.sin(time * 0.71) * 0.5 + Math.sin(time * 1.37 + 1.1) * 0.3 + Math.sin(time * 2.3 + 2.0) * 0.2) * amp);
      cam.rotateY((Math.sin(time * 0.53 + 0.4) * 0.5 + Math.sin(time * 1.19 + 2.2) * 0.3 + Math.sin(time * 1.9 + 0.7) * 0.2) * amp);
      // trepidação de turbulência em alta frequência (só em voo, fora da cabine)
      const buf = (1 - ramp(t, 0.7, 1.0)) * (t < 1.2 ? 1 : 0) + (t > 7 ? 0.4 : 0);
      cam.rotateZ((Math.sin(time * 9.1) * 0.6 + Math.sin(time * 14.3 + 1.3) * 0.4) * 0.00045 * buf);
    }
    // foquista: o ponto de foco tem inércia própria (rack focus); no início do hero o foco parte das nuvens próximas
    // foco nasce no alvo e corre entre planos (com inércia) quando o alvo muda
    if (tmp.firstFrame) focus.copy(tmp.target);
    focus.lerp(tmp.target, frame.freezeClock ? 1 : 1 - Math.exp(-2.4 * dt));
    // roll de operador: inclina levemente na direção do movimento lateral (grua/drone)
    tmp.vel.copy(cam.position).sub(tmp.prevEye).divideScalar(Math.max(dt, 1e-3));
    tmp.prevEye.copy(cam.position);
    tmp.right.setFromMatrixColumn(cam.matrixWorld, 0);
    const lateral = tmp.vel.dot(tmp.right);
    tmp.roll = damp(tmp.roll, clamp(-lateral * 0.0035, -0.045, 0.045), 2.5, dt);
    if (!frame.freezeClock && Math.abs(tmp.roll) > 1e-4) cam.rotateZ(tmp.roll);
    const wantNear = inFleet && !(st.inspect && st.inspectMode === 'seat') ? 0.5 : 0.02;
    if (Math.abs(cam.fov - fov) > 0.01 || cam.near !== wantNear) { cam.fov = fov; cam.near = wantNear; cam.updateProjectionMatrix(); }

    // ----- pesos de cena -----
    const skyA = 1 - ramp(t, 1.755, 1.765);
    const hangarW = ramp(t, 1.755, 1.765) * (1 - ramp(t, 3.0, 3.25));
    const studioW = ramp(t, 3.0, 3.25) * (1 - ramp(t, 4.6, 4.85));
    const skyB = ramp(t, 4.6, 4.85) * (1 - ramp(t, 6.29, 6.31));
    const globeW = ramp(t, 6.29, 6.31) * (1 - ramp(t, 6.995, 7.0));
    const epi = ramp(t, 6.999, 7.001);
    const skyW = Math.max(skyA, skyB, epi);

    // fundo
    tmp.bg.copy(BG.hangar).multiplyScalar(hangarW);
    tmp.bg.add(BG.studio.clone().multiplyScalar(studioW));
    tmp.bg.add(BG.globe.clone().multiplyScalar(globeW));
    if (t > 4.55 && t < 4.85) tmp.bg.lerp(C('#e9dcd8'), skyB);
    (scene.background as THREE.Color).copy(tmp.bg);

    // céu (paleta dawn → dusk no epílogo)
    env.skyGroup.visible = skyW > 0.001;
    if (env.skyGroup.visible) {
      const pal = lerpPalette(SKY_PALETTES.dawn, SKY_PALETTES.dusk, epi, tmp.pal);
      const su = env.sky.uniforms, cu = env.sea.uniforms, pu = env.puffs.uniforms;
      su.uZenith.value.copy(pal.zenith); su.uHorizon.value.copy(pal.horizon); su.uGlow.value.copy(pal.glow); su.uBelow.value.copy(pal.below);
      cu.uLit.value.copy(pal.lit); cu.uShade.value.copy(pal.shade); cu.uDeep.value.copy(pal.deep); cu.uHaze.value.copy(pal.haze);
      pu.uLit.value.copy(pal.lit); pu.uShade.value.copy(pal.shade); pu.uHaze.value.copy(pal.haze);
      su.uOpacity.value = skyW; cu.uOpacity.value = skyW; cu.uCinemaOcean.value = slot >= 5 && slot < 6 ? ramp(t,5.72,5.95) : 0; pu.uOpacity.value = skyW;
      cu.uTime.value = time; pu.uTime.value = time;
      cu.uCam.value.copy(cam.position);
      env.sea.mesh.position.x = cam.position.x; env.sea.mesh.position.z = cam.position.z;
      env.sea.mesh.position.y = epi > 0 ? -40 : -70;
      env.puffs.mesh.visible = true;
    }
    // névoa atmosférica
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(skyW > 0.5 ? tmp.pal.haze ?? C('#efd3cc') : inFleet ? C('#a2826a') : tmp.bg);
    fog.density = skyA > 0.5 ? 0.0019 : epi > 0 ? 0.0018 : hangarW > 0.5 ? (inFleet ? 0.0013 * tmp.fogK : 0.012) : 0.0;

    // hangar / estúdio
    env.hangar.group.visible = hangarW > 0.001 || (t > 1.75 && t < 3.25);
    env.hangar.setOpacity(hangarW);
    if (hangarW > 0.01) env.hangar.update(time);
    env.hangar.bars.visible = !(inFleet && st.inspect && st.inspectMode !== 'parts');
    env.grid.mesh.visible = studioW > 0.001;
    env.grid.uniforms.uOpacity.value = studioW;
    // monta/desmonta o piso (com folga) — fora do hangar ele não existe e não custa nada
    const wantFloor = t > 1.6 && t < 3.3;
    if (wantFloor !== st.floor) ui.set({ floor: wantFloor });
    if (floorRef.current) {
      floorRef.current.visible = hangarW > 0.02;
      const fm = floorRef.current.material as THREE.MeshStandardMaterial & { mixStrength?: number };
      fm.color.set('#cfcbc3').lerp(BG.studio, 1 - hangarW);
      if (fm.mixStrength !== undefined) fm.mixStrength = 0.9 * hangarW; // concreto do pátio com leve brilho de umidade
    }

    // globo
    if (!globeRef.current && t > 5.6) {
      const g = createGlobe(quality); g.root.position.copy(GLOBE_CENTER); globeHolder.add(g.root); globeRef.current = g;
    }
    const globe = globeRef.current;
    if (globe) globe.root.visible = globeW > 0.001;
    if (globe && globe.root.visible) {
      globe.setOpacity(1);
      const dest = st.destination ? DESTINATIONS.find((d) => d.id === st.destination) : null;
      if (st.destination !== tmp.lastDest) { globe.setArc(st.destination); tmp.lastDest = st.destination; }
      const reduce = st.motion === 'reduced';
      let ty: number, tp: number;
      if (dest) { const f = facing(dest.lat * 0.6 + -23.55 * 0.4, dest.lon * 0.6 + -46.63 * 0.4); ty = f.yaw; tp = f.pitch * 0.8; }
      else { const f = facing(-12, -42); ty = f.yaw + (reduce ? 0 : Math.sin(time * 0.12) * 0.12); tp = f.pitch * 0.6; } // sempre o lado das rotas; deriva sutil, sem girar para longe
      ty += frame.globeYaw; tp = clamp(tp + frame.globePitch, -0.9, 0.9);
      tmp.globeYaw = damp(tmp.globeYaw, ty, 2.4, dt);
      tmp.globePitch = damp(tmp.globePitch, tp, 2.4, dt);
      globe.spin.rotation.y = tmp.globeYaw;
      globe.root.rotation.x = tmp.globePitch;
      const visible = new Set(DESTINATIONS.filter((d) => st.region === 'todos' || d.region === st.region).map((d) => d.id));
      globe.update(dt, st.destination, visible, time);
    }

    // ----- jato -----
    const jg = jet.group;
    // V6: no hangar só aparecem as cinco aeronaves anunciadas; o avião conceitual segue no restante do filme
    jg.visible = (t < 6.31 || epi > 0) && !inFleet;
    const gearDown = t > 1.76 && t < 7 ? 1 : 0;
    jet.parts.trem.visible = gearDown > 0;
    if (epi > 0) {
      const e = clamp((t - 7) / 1);
      jg.position.set(-150 + e * 260, 18 + e * 6, -40);
      jg.rotation.set(0.02, 0, 0.05);
      jg.scale.setScalar(1);
    } else {
      jg.position.set(0, 0, 0);
      const flying = skyA;
      const calm = 1 - ramp(t, 0.7, 0.95);
      tmp.wobble.set(Math.sin(time * 0.5) * 0.006 * calm * flying, 0, (Math.sin(time * 0.37) * 0.012 + 0.03) * calm * flying);
      jg.rotation.copy(tmp.wobble);
      jg.position.y = Math.sin(time * 0.6) * 0.12 * calm * flying;
    }
    // vista explodida (manual > scroll)
    const explodeScroll = raw < 4 ? 0 : ramp(t, 3.4, 3.62) * (1 - ramp(t, 3.86, 4.0));
    const ex = st.explodeManual ?? explodeScroll;
    tmp.explode = damp(tmp.explode, ex, 4, dt);
    const e = tmp.explode;
    // A UI follows the rendered geometry, including automatic scroll and reverse.
    const exploded = st.anatomyExploded ? e > .09 : e > .16;
    if (exploded !== st.anatomyExploded) ui.set({ anatomyExploded: exploded });
    (Object.keys(jet.parts) as PartId[]).forEach((id) => {
      const off = jet.explode[id];
      if (id === 'asas') {
        jet.parts.asas.children.forEach((m) => { const side = m.name.endsWith('-1') && !m.name.endsWith('--1') ? 1 : -1; m.position.set(0, off.y * e, side * 2.6 * e); });
      } else if (id === 'motores') {
        jet.parts.motores.children.forEach((m) => { const z = (m as THREE.Object3D).position.z; if (m.type === 'Group') m.position.set(m.position.x, (m.userData.y0 ??= m.position.y) + off.y * e, (m.userData.z0 ??= z) + Math.sign(m.userData.z0) * 1.6 * e); else m.position.set(0, off.y * e, 0); });
      } else jet.parts[id].position.copy(off).multiplyScalar(e);
    });
    // corte do teto (cutaway)
    let cut = 100;
    if (t > 3.98 && t < 4.82) {
      const down = ramp(t, 4.0, 4.25), up = ramp(t, 4.62, 4.8);
      cut = THREE.MathUtils.lerp(s.R + 1.6, 0.34, down) + up * 3;
    }
    if (inFleet && st.inspect && st.inspectMode !== 'parts') {
      // planta: teto cortado na linha das janelas; vista sentado: teto volta quando a câmera está abaixo dele
      const insC = crafts.current.find((c) => c.id === st.inspect);
      const cy = insC ? insC.group.position.y + insC.cutY : 0.32;
      cut = st.inspectMode === 'seat' ? (cam.position.y < cy + 0.55 ? 100 : cy) : 100;
    }
    if (anatomyActive && st.part === 'cabine') cut = 100;
    CUT.constant = cut;

    // ----- mapas de ambiente e luzes -----
    const insidePortal = t > 1.32 && t < 1.76;
    const inCabin = t > 4.66 && t < 6.31;
    const envKey = insidePortal || inCabin ? 'cabin' : skyW > 0.5 && t < 1.76 ? 'sky' : epi > 0 ? 'sky' : inFleet ? 'sky' : hangarW > 0.5 ? 'hangar' : 'studio';
    const want = (k: EnvKey) => { if (!env.maps.has(k)) env.maps.get(k); };
    if (t > 0.85) { want('cabin'); }
    if (t > 1.45) { want('hangar'); }
    if (raw > 3.5) { want('studio'); }
    const envTex = env.maps.get(envKey as EnvKey);
    if (scene.environment !== envTex) scene.environment = envTex;
    const inside = insidePortal || inCabin;
    const wantDof = !(anatomyActive && st.part); // DOF/AO validados dentro da cabine após remover CA e ruído (causa real dos artefatos)
    if (wantDof !== st.dof) ui.set({ dof: wantDof });
    scene.environmentIntensity = inside ? 0.37 : envKey === 'hangar' ? 0.2 : envKey === 'studio' ? 0.7 : 0.5;
    lights.sun.intensity = inside ? 0 : 2.6 * Math.max(skyA, epi) + 0.5 * studioW;
    lights.hemi.intensity = inside ? 0.05 : 0.32 * Math.max(skyA, epi) + 1.1 * studioW + (inFleet ? 0.7 : 0.02) * hangarW;
    lights.key.intensity = 30 * hangarW;
    // a luz-chave e o contraluz acompanham a câmera ao longo da fila da frota
    const kx = inFleet ? tmp.target.x : 0;
    if (Math.abs(lights.key.position.x - (kx - 7)) > 0.01) { lights.key.position.set(kx - 7, 6.5, -9); lights.key.lookAt(kx - 2, 0.6, 0); lights.rim.position.set(kx + 14, 9, 34); lights.rim.target.position.set(kx, 0, 0); lights.rim.target.updateMatrixWorld(); }
    lights.rim.intensity = (inFleet ? 4.4 : 2.4) * hangarW;
    if (inFleet) lights.rim.color.set('#ffc98a'); else lights.rim.color.set('#c9d3de');
    const cabinLight = inside ? 1 : hangarW > 0.5 ? 0.9 : 0.3;
    lights.cab.forEach((l) => { l.intensity = (inside ? 0.74 : 1.1) * cabinLight; });
    const day = inside ? (inCabin ? 1 : 0.8) : 0;
    lights.winL.intensity = lights.winR.intensity = 2.15 * day;
    if (fx.ao) {
      // na travessia da janela a câmera fica a centímetros da geometria: AO desligada (evita artefatos de profundidade)
      const ao = 2.6 * (inCabin ? 1 : 0) + 2.0 * hangarW + 1.4 * studioW + 0.6 * Math.max(skyA, epi) * (t < 1.0 ? 1 : 0);
      fx.ao.configuration.intensity = damp(fx.ao.configuration.intensity, ao, 3, dt);
      fx.ao.configuration.aoRadius = inside ? 0.6 : 1.6;
    }
    jet.cabin.glow.forEach((m, i) => { m.emissiveIntensity = (i === 0 ? 1.65 : 1.15) * (0.4 + 0.6 * cabinLight); });

    // ----- velocidade: nuvens passando, turbinas girando, ar escorrendo -----
    const flying = Math.max(skyA, skyB, epi);
    const fr = flow.current;
    if (frame.freezeClock) { fr.sea = time * 0.2; fr.puff = time * 58; } // render determinístico (pipeline de mídia)
    else { fr.sea += dt * 0.2 * flying; fr.puff += dt * 58 * flying; } // ≈ 62 m/s aparentes no mar de nuvens
    env.sea.uniforms.uFlow.value = fr.sea;
    env.puffs.uniforms.uFlow.value = fr.puff;
    const fanSpeed = flying > 0.5 ? 46 : hangarW > 0.5 ? 0.7 : 0;
    fr.fan = frame.freezeClock ? time * fanSpeed : fr.fan + dt * fanSpeed;
    jet.fans.forEach((f) => { f.rotation.x = fr.fan; });
    airflow.uniforms.uTime.value = time;
    airflow.uniforms.uOpacity.value = Math.max(skyA * (1 - ramp(t, 0.85, 1.02)), epi * 0.6);
    airflow.mesh.visible = airflow.uniforms.uOpacity.value > 0.01;
    if (fx.speed) fx.speed.uniforms.get('uStrength')!.value = 0.0018 * skyA * (1 - ramp(t, 0.75, 1.0)) + 0.0012 * epi;

    // ----- rastros de condensação -----
    contrails.uniforms.uTime.value = time;
    contrails.uniforms.uOpacity.value = Math.max(skyA * (1 - ramp(t, 0.85, 1.05)), epi);
    contrails.group.visible = contrails.uniforms.uOpacity.value > 0.01;

    // ----- lente e grade por cena (exposição de câmera, não filtro) -----
    const W = { sky: Math.max(skyA, epi), hangar: hangarW, studio: studioW, cabin: insidePortal || inCabin ? 1 : 0, globe: globeW };
    if (fx.dof) {
      const bokeh = 0.9 * W.sky * (t < 1.1 || epi > 0 ? 1 : 0.4) + (inFleet ? 0.35 : 1.4) * W.hangar + 0.30 * W.cabin * (t > 4.85 ? 1 : 0.3); // frota nítida
      fx.dof.bokehScale = damp(fx.dof.bokehScale, bokeh, 3, dt);
    }
    if (fx.grade) {
      const u = fx.grade.uniforms;
      const warm = 0.05 * W.sky + 0.12 * W.hangar - 0.05 * W.studio + 0.14 * W.cabin - 0.25 * W.globe;
      const contrast = 0.24 * W.sky + 0.3 * W.hangar + 0.08 * W.studio + 0.22 * W.cabin + 0.2 * W.globe;
      const sat = 1.1 * W.sky + 1.0 * W.hangar + 0.92 * W.studio + 1.06 * W.cabin + 1.0 * W.globe;
      u.get('uWarm')!.value = damp(u.get('uWarm')!.value, warm + (inFleet ? 0.05 : 0), 3, dt);
      u.get('uContrast')!.value = damp(u.get('uContrast')!.value, contrast, 3, dt);
      u.get('uSat')!.value = damp(u.get('uSat')!.value, Math.max(0.9, sat + (inFleet ? 0.16 : 0)), 3, dt);
      // adaptação de exposição do sensor: entra na cabine escura e a imagem clareia aos poucos (e vice-versa)
      const expo = 0.94 * W.sky + 1.1 * W.hangar + 0.98 * W.studio + 1.2 * W.cabin + 1.02 * W.globe;
      u.get('uExposure')!.value = frame.freezeClock ? Math.max(0.9, expo) : damp(u.get('uExposure')!.value, Math.max(0.9, expo), 0.9, dt);
      const th = prefs.get().theme === 'dusk' ? 1 : 0;
      u.get('uTheme')!.value = Math.abs(u.get('uTheme')!.value - th) < 0.002 ? th : damp(u.get('uTheme')!.value, th, 4, Math.min(rawDt, 0.1));
    }
    {
    }

    // ----- frota: visibilidade, rotores ociosos, desmontagem -----
    lineup.visible = hangarW > 0.01 && t < 3.2;
    // ----- vida do aeroporto -----
    life.group.visible = lineup.visible;
    if (life.group.visible) {
      const gy = env.gy;
      // carrinhos: circuito retangular no pátio (frente da fila ↔ limite do pátio)
      const loop = [[70, -34], [-170, -34], [-170, 48], [70, 48]] as const;
      const per = [240, 82, 240, 82], total = 644;
      life.carts.forEach((c) => {
        let d = ((time * 6.5) / total + c.off) % 1 * total, k = 0;
        while (d > per[k]) { d -= per[k]; k = (k + 1) % 4; }
        const a = loop[k], b2 = loop[(k + 1) % 4], f = d / per[k];
        c.obj.position.set(a[0] + (b2[0] - a[0]) * f, gy, a[1] + (b2[1] - a[1]) * f);
        c.obj.rotation.y = Math.atan2(-(b2[1] - a[1]), b2[0] - a[0]);
      });
      // tráfego vivo: pouso (3°, arredondamento, toque com fumaça, frenagem), decolagem (espera, rolagem acelerada,
      // rotação, subida, recolhimento do trem) e sobrevoo alto com inclinação; anticolisão, navegação e strobes
      traffic2.current.forEach((tr) => {
        if (tr.mode === 'parked') return;
        const D3 = Math.tan(THREE.MathUtils.degToRad(3));
        let x = 0, y = tr.axisH, z = 122, pitch = 0, roll = 0, yaw = Math.PI, gear = true, landOn = 1;
        let smokeT = -1;
        if (tr.mode === 'land') {
          const P = 46, sT = ((time + tr.off * P) % P);
          const tTouch = 27; const xT = -270;
          if (sT < tTouch) { const v = 68; x = xT + v * (tTouch - sT); const h = D3 * (x - xT); const fl = Math.min(1, Math.max(0, (x - xT) / 170)); y = tr.axisH + h * (0.3 + 0.7 * fl) + (1 - fl) * 0.6 * (1 - Math.min(1, (tTouch - sT) / 2)); pitch = 0.045 + 0.05 * (1 - fl); roll = Math.sin(time * 0.9) * 0.012 * fl; }
          else { const q = sT - tTouch; x = xT - (60 * q - 2.6 * q * q * 0.5 * Math.min(1, q / 18) * (q < 22 ? 1 : 0)) ; if (q >= 22) x = xT - (60 * 22 - 1.3 * 22 * 22 * 0.5 * 1) - 6 * (q - 22); pitch = Math.max(0, 0.04 - q * 0.02); smokeT = q; landOn = q < 8 ? 1 : 0.3; }
        } else if (tr.mode === 'takeoff') {
          const P = 54, sT = ((time + tr.off * P) % P);
          if (sT < 5) { x = 40; landOn = 0.6; }
          else if (sT < 27) { const q = sT - 5; x = 40 - 1.15 * q * q; }
          else { const q = sT - 27; const v = 50.6 + 1.6 * q; x = 40 - 1.15 * 22 * 22 - (50.6 * q + 0.8 * q * q); y = tr.axisH + Math.max(0, q - 1.2) * (5.5 + 0.35 * q); pitch = Math.min(0.15, q * 0.09) - Math.max(0, q - 8) * 0.004; gear = q < 4.5; roll = q > 10 ? Math.sin(q * 0.3) * 0.02 : 0; void v; }
        } else {
          const P = 74, sT = ((time + tr.off * P) % P);
          yaw = 0; z = 520; x = -1700 + sT * 46; y = 210 + Math.sin(sT * 0.08) * 8; roll = -0.1 + Math.sin(time * 0.35) * 0.04; pitch = 0.01; gear = false; landOn = 0.15;
        }
        tr.group.position.set(x, env.gy + y, z);
        tr.group.rotation.set(0, yaw, 0); tr.group.rotateZ(pitch); tr.group.rotateX(roll);
        tr.group.visible = x < 1650 && x > -1650;
        tr.systems.trem.visible = gear;
        (tr.land.material as THREE.SpriteMaterial).opacity = landOn;
        const on = (time * 1.15 + tr.off) % 1 < 0.06 ? 1 : 0;
        tr.strobes.forEach((sp) => { (sp.material as THREE.SpriteMaterial).opacity = on; });
        (tr.beacon.material as THREE.SpriteMaterial).opacity = (time * 1.3 + tr.off * 3) % 1 < 0.12 ? 1 : 0.05;
        tr.smoke.forEach((sp, k) => { const m = sp.material as THREE.SpriteMaterial; if (smokeT >= 0 && smokeT < 2.6) { const g2 = smokeT / 2.6; m.opacity = (1 - g2) * 0.55; sp.scale.setScalar(1.5 + g2 * 9 + k * 0.4); sp.position.x = -1.5 + smokeT * 7; } else m.opacity = 0; });
      });
    }
    const target = st.inspect && !st.assembled ? 1 : 0;
    const prevP = inspectP.current;
    inspectP.current = clamp(prevP + Math.sign(target - prevP) * dt / (st.motion === 'reduced' ? 0.25 : 2.0));
    const xrT = !st.flight && inFleet && st.inspect && ((st.fleetXray && st.inspectMode === 'parts') || st.inspectMode === 'plan') ? 1 : 0; // planta = raio-X; nunca em voo
    tmp.xray = xrT === 0 && tmp.xray < 0.004 ? 0 : damp(tmp.xray, xrT, st.motion === 'reduced' ? 40 : 1.9, Math.min(rawDt, 0.1));
    if (inFleet || prevP > 0) {
      crafts.current.forEach((c) => {
        if (st.flight && c.id === st.flight) return; // a aeronave em voo é do simulador (pose, visibilidade do casco, interior)
        if (c.id === st.inspect || (prevP > 0 && c.id === tmp.lastIns)) applyInspect(c.entries, inspectP.current, st.fleetPreview, time);
        c.setXray(c.id === st.inspect ? tmp.xray : 0);
        // destaque: a escolhida taxia para perto da câmera e gira em 3/4; as demais recuam, se afastam e ficam translúcidas
        const k = FLEET.findIndex((f) => f.id === c.id);
        const near = st.inspect ? (c.id === st.inspect ? 1 : 0) : Math.max(0, 1 - Math.abs(tmp.fleetIdx - k));
        const w = near * near * (3 - 2 * near);
        const side = Math.sign(k - tmp.fleetIdx);
        const tx = FLEET[k].x + side * 6 * (1 - w);
        const tz = THREE.MathUtils.lerp(ROW_Z + (st.inspect ? 10 : 2.5), FRONT_Z, w);
        const tyaw = st.inspect ? 0 : 0.42 * w;
        const lam = st.motion === 'reduced' ? 40 : 5.2;
        const rdt = Math.min(rawDt, 0.25); // tempo real: a coreografia não desacelera em aparelhos lentos
        c.group.position.x = damp(c.group.position.x, tx, lam, rdt);
        c.group.position.z = damp(c.group.position.z, tz, lam, rdt);
        c.group.rotation.y = damp(c.group.rotation.y, tyaw, lam, rdt);
        c.setFade(st.flight ? 1 : st.inspect ? (c.id === st.inspect ? 1 : 0.22) : 0.7 + 0.3 * w);
        if (c.halo) (c.halo.material as THREE.MeshBasicMaterial).opacity = (st.inspect || st.flight ? 0 : 1) * w * w * (0.85 + 0.15 * Math.sin(time * 1.6));
        c.isolate(c.id === st.inspect && st.inspectMode === 'parts' ? st.inspectSystem : null);
        c.focusPart(c.id === st.inspect && st.inspectMode === 'parts' && st.inspectSystem ? st.inspectPart : null);
      });
      if (st.inspect) tmp.lastIns = st.inspect;
    }

    // ----- V6: hotspots da aeronave ativa (pré-seleção) projetados no DOM -----
    const hl = domRefs.fleetHotLayer;
    if (hl) {
      const settled = Math.abs(tmp.fleetIdx - Math.round(tmp.fleetIdx)) < 0.035;
      const fsec = document.getElementById('frota'); const fr2 = fsec?.getBoundingClientRect();
      const fleetOnScreen = !!fr2 && fr2.top <= 2 && fr2.bottom >= size.height - 2 && !st.flight && Number(document.documentElement.style.getPropertyValue('--fleet-out') || 0) < 0.05;
      const tgt = st.inspect ? crafts.current.find((c) => c.id === st.inspect) : settled ? crafts.current.find((c) => c.id === FLEET[Math.round(clamp(tmp.fleetIdx, 0, FLEET.length - 1))].id) : undefined;
      // estabilidade real: câmera parada E aeronave no lugar há ~0,3 s (sem pontinhos soltos entre um avião e outro)
      const camStill = tmp.vel.length() < 0.35;
      const craftHome = !!tgt && (st.inspect ? true : Math.abs(tgt.group.position.z - FRONT_Z) < 0.25);
      tmp.hotStill = camStill && craftHome ? (tmp.hotStill ?? 0) + dt : 0;
      const show = !!tgt && inFleet && fleetOnScreen && (tmp.hotStill ?? 0) > 0.3 && (st.inspect ? st.inspectMode === 'parts' && !st.inspectSystem && tmp.viewW > 0.85 && inspectP.current < 0.02 : tmp.viewW < 0.05 && ramp(raw - 3, 0.0, 0.1) > 0.98);
      hl.dataset.visible = show ? 'true' : 'false';
      if (show && tgt) {
        hl.dataset.aircraft = tgt.id;
        domRefs.fleetHotspots.forEach((el, sid) => {
          const ref = tgt.anchorRefs[sid];
          if (!ref) { el.style.display = 'none'; return; }
          ref.obj.updateWorldMatrix(true, false);
          tmp.proj.copy(ref.local); ref.obj.localToWorld(tmp.proj); tmp.proj.project(cam);
          const hx = (tmp.proj.x * 0.5 + 0.5) * size.width, hy = (-tmp.proj.y * 0.5 + 0.5) * size.height;
          el.style.display = tmp.proj.z > 1 || hx < 18 || hx > size.width - 18 || hy < 70 || hy > size.height - 18 ? 'none' : '';
          el.style.transform = `translate3d(${((tmp.proj.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-tmp.proj.y * 0.5 + 0.5) * size.height).toFixed(1)}px, 0)`;
        });
      }
    }

    // ----- marcadores de poltrona (DOM) -----
    const seatLayer = domRefs.seatLayer;
    if (seatLayer) {
      const insC = st.inspect ? crafts.current.find((c) => c.id === st.inspect) : null;
      const show = !!insC && inFleet && st.inspectMode === 'plan' && tmp.viewW > 0.85;
      seatLayer.dataset.visible = show ? 'true' : 'false';
      if (show && insC) domRefs.seats.forEach((el, i) => {
        const se = insC.seats[i];
        if (!se) { el.style.display = 'none'; return; }
        el.style.display = '';
        tmp.proj.set(insC.group.position.x + se.pos.x, insC.group.position.y + insC.floorY + 0.5, se.pos.z).project(cam);
        el.style.transform = `translate3d(${((tmp.proj.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-tmp.proj.y * 0.5 + 0.5) * size.height).toFixed(1)}px, 0)`;
      });
    }

    // ----- tráfego de fundo (céu): reage ao cursor -----
    traffic.group.visible = Math.max(skyA, skyB, epi) > 0.5;
    if (traffic.group.visible) { traffic.update(time, frame.px, frame.py); if (slot >= 5 && slot < 6 && t > 5.65) traffic.windowPass(cam, ramp(t,5.65,5.9999), time); }

    // ----- rede de rotas no globo + traço conectando a janela ao globo -----
    if (globe?.root.visible && lastRegion.current !== st.region) {
      lastRegion.current = st.region;
      globe.setNetwork(DESTINATIONS.filter((d) => st.region === 'todos' || d.region === st.region).map((d) => d.id));
    }
    if (!globe?.root.visible) lastRegion.current = null;
    const route = domRefs.route;
    if (route) {
      const on = slot >= 7 && slot < 8 && t > 6.32 && t < 6.75;
      route.style.opacity = on ? String(Math.min(1, ramp(t, 5.96, 6.08)) * (1 - ramp(t, 6.6, 6.75))) : '0';
      if (on) {
        const sx = size.width * 0.5, sy = size.height * 0.46;
        let ex = size.width * 0.36, ey = size.height * 1.05;
        if (t > 6.3 && globe) { globe.origin().getWorldPosition(tmp.proj); tmp.proj.project(cam); ex = (tmp.proj.x * 0.5 + 0.5) * size.width; ey = (-tmp.proj.y * 0.5 + 0.5) * size.height; }
        const draw = ramp(t, 5.98, 6.5);
        route.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx + size.width * 0.2).toFixed(1)},${(sy + size.height * 0.3).toFixed(1)} ${(ex - size.width * 0.15).toFixed(1)},${(ey - size.height * 0.35).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
        route.style.strokeDashoffset = String(1 - draw);
      }
    }

    // ----- véu de transição (luminância contínua, nunca preto) -----
    const vPortal = pulse(t, 1.62, 1.74, 1.79, 1.95);
    const transition = (q: number) => q < 0 ? 0 : pulse(q, .04, .44, .56, .96);
    const vFleet = transition(toFleet);
    const vDest = transition(toDest);
    const vWindow = !inFleet && slot >= 5 && slot < 6 ? ramp(t, 5.93, 5.9999) : 0;
    // V25: real sky pass; a brief light veil only masks the actual scene cut.
    void vWindow;
    const skyPass = toFleet < 0 ? 0 : pulse(toFleet,.28,.49,.51,.76);
    void vFleet;
    const veil = Math.max(vPortal, vDest, skyPass);
    if (domRefs.veil) {
      domRefs.veil.style.opacity = veil.toFixed(3);
      domRefs.veil.style.backgroundImage = '';
      domRefs.veil.style.backgroundSize = '';
      domRefs.veil.style.backgroundPosition = '';
      domRefs.veil.style.backgroundColor = skyPass > .001 ? '#e5f0fa' : (Math.max(vFleet, vDest) > 0.01 ? '#0d1724' : '#e8cfae');
    }
    frame.veil = veil;

    // ----- V24: camera and mesh isolation use the same renderer -----
    if (!inFleet && slot >= 5 && slot < 6 && t > 5.98) jg.visible = false;
    const isolated = anatomy24.apply(cam, anatomyActive ? st.part : null, anatomyActive ? st.anatomyDetail : null, st.anatomyAngle, st.anatomyPitch, anatomyActive && st.anatomySubExplode, dt, time, size.width, size.height);
    if (isolated) { cam.getWorldDirection(tmp.proj); focus.copy(cam.position).addScaledVector(tmp.proj, Math.max(1, cam.position.distanceTo(tmp.target))); }
    // ----- hotspots projetados (DOM) -----
    const layer = domRefs.hotspotLayer;
    const hsVis = t > 3.42 && t < 3.97;
    if (layer) {
      layer.dataset.visible = hsVis ? 'true' : 'false';
      if (hsVis) {
        domRefs.hotspots.forEach((el, id) => {
          el.style.display = isolated ? 'none' : '';
          const a = id === 'fuselagem' ? jet.anchors.cabine.clone().add(new THREE.Vector3(3,0,0)) : jet.anchors[id];
          tmp.proj.copy(a);
          const off = jet.explode[id];
          if (id === 'asas') tmp.proj.z += -2.6 * e; else if (id === 'motores') { tmp.proj.y += off.y * e; tmp.proj.z += -1.6 * e; } else tmp.proj.addScaledVector(off, e);
          tmp.proj.applyMatrix4(jg.matrixWorld).project(cam);
          const x = (tmp.proj.x * 0.5 + 0.5) * size.width, y = (-tmp.proj.y * 0.5 + 0.5) * size.height;
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        });
      }
    }

    if (hsVis) anatomy24.project(cam, st.part, st.anatomyDetail, size.width, size.height);
    // ----- test drive: sobrescreve câmera, céu e cena no fim do quadro (as cenas aprovadas seguem intactas) -----
    {
      const fid = st.flight;
      const craft = fid ? crafts.current.find((c) => c.id === fid) : null;
      if (fid && craft && sim.id !== fid) {
        sim.start(fid, craft, env.gy, time);
        const names = new Set(['grass', 'sky-dome', 'ridge-ring']);
        flightHidden.current = [];
        env.hangar.group.traverse((o) => { if ((names.has(o.name) || o.renderOrder === -9) && o.visible) { o.visible = false; flightHidden.current!.push(o); } });
        crafts.current.forEach((c) => { c.setFade(1); c.setXray(0); c.isolate(null); });
      }
      if ((!fid || !craft) && sim.id) {
        sim.stop();
        flightHidden.current?.forEach((o) => { o.visible = true; }); flightHidden.current = null;
        flightWorld.group.visible = false;
        env.sea.mesh.visible = true; env.puffs.mesh.visible = true;
      }
      if (sim.id && craft) {
        // celular em pé: a câmera gira 90° com lente de paisagem (o canvas não é girado — medição e custo intactos)
        const rot = flightUi.get().rotate && size.width < size.height;
        const portrait = size.width < size.height && !rot;
        const fx2 = Number(new URLSearchParams(location.search).get('flightx')) || 1;
        const sdt = Math.min(rawDt, 0.1) * fx2; const n = Math.ceil(sdt / 0.05);
        for (let i = 0; i < n; i++) sim.step(sdt / n, time, env.gy, portrait, st.seat);
        cam.position.copy(sim.eye); cam.up.copy(sim.camUp); cam.lookAt(sim.target); cam.up.set(0, 1, 0);
        // sensação de velocidade: lente abre com a velocidade, trepidação na pista e na camada de nuvens
        const vk = clamp(sim.V / sim.vmax, 0, 1);
        const agl = sim.pos.y - env.gy;
        const inCloud = clamp(1 - Math.abs(agl - 1080) / 320, 0, 1);
        const shake = (sim.phase === 'roll' || sim.phase === 'rollout' ? 0.0022 * vk : 0) + 0.0016 * inCloud * vk + 0.0005 * vk * vk;
        if (st.motion !== 'reduced' && shake > 0) { cam.rotateX(Math.sin(time * 31.7) * shake + Math.sin(time * 17.3) * shake * 0.6); cam.rotateY(Math.sin(time * 23.1 + 1.3) * shake * 0.7); }
        const vw = flightUi.get().view; const baseFov = vw === 'seat' ? 70 : vw === 'cockpit' ? 64 : portrait ? 58 : 46;
        let wantFov = Math.round((baseFov + vk * vk * 9) * 10) / 10;
        if (rot) {
          // fov vertical do canvas em pé = fov horizontal da paisagem equivalente
          const land = size.height / size.width;
          wantFov = Math.round(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(wantFov) / 2) * land)) * 10) / 10;
          cam.rotateZ(Math.PI / 2);
        }
        const wantNearF = sim.inside ? 0.1 : 0.5; // 0,1 m: precisão de profundidade no horizonte (sem chão/água piscando)
        if (Math.abs(cam.fov - wantFov) > 0.01 || cam.near !== wantNearF || cam.far !== 60000) { cam.fov = wantFov; cam.near = wantNearF; cam.far = 60000; cam.updateProjectionMatrix(); }
        focus.copy(sim.target);
        // cena: aeródromo da Frota + mundo do voo + o céu da janela da cabine (cúpula e mar de nuvens)
        lineup.visible = true; life.group.visible = true; env.hangar.group.visible = true;
        jg.visible = false;
        if (globeRef.current) globeRef.current.root.visible = false;
        flightWorld.group.visible = true;
        flightWorld.update(cam.position, time);
        const pal = lerpPalette(SKY_PALETTES.dawn, SKY_PALETTES.dusk, 0.55, tmp.pal);
        env.skyGroup.visible = false; // o voo usa o céu atmosférico próprio (world.ts)
        const su = env.sky.uniforms, cu = env.sea.uniforms;
        su.uZenith.value.copy(pal.zenith); su.uHorizon.value.copy(pal.horizon); su.uGlow.value.copy(pal.glow); su.uBelow.value.copy(pal.haze); su.uOpacity.value = 1;
        su.uSun.value.copy(lights.sun.position).normalize();
        env.sky.mesh.position.copy(cam.position);
        cu.uLit.value.copy(pal.lit); cu.uShade.value.copy(pal.shade); cu.uDeep.value.copy(pal.deep); cu.uHaze.value.copy(pal.haze);
        cu.uOpacity.value = 1; cu.uCinemaOcean.value = 0; cu.uTime.value = time; cu.uCam.value.copy(cam.position);
        // mar de nuvens acima de ~1.300 m: abaixo dele o céu fica aberto e o chão visível
        env.sea.mesh.visible = false; // o mar de nuvens 'estalava' ao subir — o voo usa só nuvens volumétricas
        env.puffs.mesh.visible = false;
        const sk = flightWorld.skyU;
        sk.uSun.value.copy(lights.sun.position).normalize();
        sk.uZenith.value.set('#1d4a96'); sk.uHorizon.value.set('#c9dcf0'); sk.uHaze.value.copy(pal.haze).lerp(C('#dfe8f2'), 0.45); sk.uSunCol.value.set('#fff0d4');
        const fu = flightWorld.earthU, ku = flightWorld.cloudU;
        fu.uSun.value.copy(su.uSun.value); ku.uSun.value.copy(su.uSun.value);
        fu.uHaze.value.copy(sk.uHaze.value); ku.uHaze.value.copy(sk.uHaze.value); fu.uSky.value.set('#5d86c4');
        ku.uLit.value.set('#fffaf2'); ku.uShade.value.set('#8d9bb2');
        { const hu = flightWorld.highU; hu.uSun.value.copy(su.uSun.value); hu.uHaze.value.copy(sk.uHaze.value); hu.uLit.value.set('#fffaf4'); hu.uShade.value.set('#a3afc4'); }
        const fog = scene.fog as THREE.FogExp2;
        fog.color.copy(sk.uHaze.value); fog.density = 0.00012;
        (scene.background as THREE.Color).set('#c9dcf0');
        lights.sun.intensity = 2.5; lights.hemi.intensity = 0.62; lights.key.intensity = 0; lights.rim.intensity = 0.8;
        if (fx.dof) fx.dof.bokehScale = 0;
        if (fx.speed) fx.speed.uniforms.get('uStrength')!.value = st.motion === 'reduced' ? 0 : 0.0032 * vk * vk;
        flightWorld.wispU.uOpacity.value = sim.phase === 'air' || sim.phase === 'approach' ? clamp((vk - 0.45) / 0.4, 0, 1) * 0.9 * (agl > 60 ? 1 : 0) : 0;
        flightWorld.wispU.uLit.value.set('#fffaf2'); flightWorld.wispU.uShade.value.set('#9aa7bc'); flightWorld.wispU.uHaze.value.copy(sk.uHaze.value); flightWorld.wispU.uSun.value.copy(sk.uSun.value);
      }
    }
    if (tmp.firstFrame) { tmp.firstFrame = false; if (new URLSearchParams(location.search).has('qa')) (window as unknown as { __777env: unknown }).__777env = { ...env, gl }; }
    // custo de CPU do loop de direção (sem o desenho da GPU), média móvel — exposto para QA
    const cpu = performance.now() - cpu0;
    frame.cpuMs = frame.cpuMs * 0.95 + cpu * 0.05; frame.cpuMax = Math.max(frame.cpuMax, cpu);
    if (!frame.ready) { frame.ready = true; requestAnimationFrame(() => onReady()); }
  });

  return (
    <>
      <primitive object={lights.g} />
      <primitive object={env.skyGroup} />
      <primitive object={env.hangar.group} />
      <primitive object={env.grid.mesh} />
      <primitive object={globeHolder} />
      <primitive object={flightWorld.group} />
      <primitive object={jet.group} />
      <primitive object={lineup} />
      <primitive object={life.group} />
      <primitive object={traffic.group} />
      {fxOn ? <FXBoundary><PostFX quality={quality} level={perf} focus={focus} dof={dofOn} /></FXBoundary> : null}
      {floorOn && <mesh ref={floorRef} rotation-x={-Math.PI / 2} position={[-50, env.gy, -2]} visible={false}>
        <planeGeometry args={[380, 108]} />
        {quality === 'high' && perf >= 3 ? (
          <MeshReflectorMaterial blur={[400, 120]} resolution={768} mixBlur={1} mixStrength={3.2} roughness={0.75} depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#cfcbc3" metalness={0.1} mirror={0.3} map={apronTex} />
        ) : (
          <meshStandardMaterial color="#cfcbc3" roughness={0.8} metalness={0.05} map={apronTex} />
        )}
      </mesh>}
    </>
  );
}

const vA = new THREE.Vector3();
function viewPose(jet: JetBuild, view: ViewId, eye: THREE.Vector3, target: THREE.Vector3) {
  const s = jet.spec;
  if (view === 'exterior') { eye.set(26, 0.2, -24); target.set(2, -0.4, 0); return; }
  if (view === 'cabine') {
    const sp = jet.cabin.spots.lounge.target;
    eye.set(sp.x + 1.2, 0.55, -4.6); target.set(sp.x - 0.6, 0.05, 0); return;
  }
  // detalhes: nacele esquerda
  let eng: THREE.Object3D | undefined;
  jet.parts.motores.children.forEach((c) => { if (c.type === 'Group' && c.position.z < 0) eng = c; });
  const p = eng ? vA.copy(eng.position) : vA.set(-6, 0.4, -2.6);
  eye.set(p.x + 5.2 * s.engine, p.y + 0.6, p.z - 3.6); target.set(p.x + 0.3, p.y, p.z);
}

/** Orçamento de pixels por nível: a resolução segue o tamanho da tela (2K/4K não explodem a GPU). */
function useBudgetDpr() {
  const perf = ui.useStore((s) => s.perf);
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const calc = () => {
      // nível 4: resolução nativa até 4K (só em aparelhos que provaram folga de FPS)
      const budget = [0.9e6, 1.5e6, 2.3e6, 3.4e6, 8.4e6][perf] ?? 1.5e6; // nível 2 já cobre 1080p nativo
      const css = Math.max(1, window.innerWidth * window.innerHeight);
      setDpr(Math.round(Math.max(0.6, Math.min(window.devicePixelRatio || 1, Math.sqrt(budget / css), 2)) * 100) / 100);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [perf]);
  return dpr;
}

/**
 * Pausa a GPU quando o canvas está 100% coberto (vídeo do hero, jornada/globo opacos, nuvens) ou a aba está oculta.
 * Era o maior desperdício do site: um terço da rolagem renderizando 3D invisível.
 */
function RenderGate() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let last = '';
    const covered = () => {
      if (ui.get().flight || !frame.ready) return false;
      const op = (el: Element | null) => { if (!el) return 0; const st = (el as HTMLElement).style; return st.visibility === 'hidden' ? 0 : Number(st.opacity || 0); };
      if (document.querySelector('dialog.sfm[open]')) return true; // menu opaco aberto: nada roda por trás
      const cont = document.querySelector<HTMLElement>('.simfly-continuum');
      if (cont && cont.dataset.handoff !== 'true' && op(cont) >= 0.999) return true; // na passagem para a anatomia o 3D já acorda aquecido
      if (op(document.querySelector('.simfly-cloud-bridge')) >= 0.999) return true;
      const hero = document.getElementById('top');
      if (hero) { const r = hero.getBoundingClientRect(); if (r.top <= 0 && r.bottom >= innerHeight) return true; }
      return false;
    };
    const tick = () => {
      const mode = document.hidden || covered() ? 'never' : 'always';
      if (mode !== last) { last = mode; setFrameloop(mode); }
    };
    const id = window.setInterval(tick, 120);
    addEventListener('scroll', tick, { passive: true });
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => { window.clearInterval(id); removeEventListener('scroll', tick); document.removeEventListener('visibilitychange', tick); setFrameloop('always'); };
  }, [setFrameloop]);
  return null;
}

export default function Experience({ quality, onReady }: { quality: Q; onReady: () => void }) {
  const dpr = useBudgetDpr();
  return (
    <Canvas
      className="scene-canvas"
      aria-hidden="true"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 30, near: 0.02, far: 7000, position: [27, 4.2, 58] }}
      frameloop="always"
      flat={false}
    >
      <World quality={quality} onReady={onReady} />
      <RenderGate />
    </Canvas>
  );
}
export type { VariantId };
