'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { damp, frame, pulse, ramp, ui, clamp, fleetDwell } from '@/experience/director';
import { buildTracks, sampleTracks, GLOBE_CENTER, type Track } from '@/experience/cameraPath';
import { domRefs } from '@/experience/domRefs';
import { buildJet, type JetBuild } from './jet/buildJet';
import { CUT } from './jet/materials';
import { groundY, SPECS, type AircraftId } from './jet/spec';
import { createCloudPuffs, createCloudSea, createSkyDome, lerpPalette, SKY_PALETTES } from './env/sky';
import { buildEnvMaps } from './env/envmaps';
import { createBlueprintGrid, createHangar } from './env/hangar';
import { createGlobe, facing } from './globe/globe';
import { createContrails } from './env/contrails';
import { createAirflow } from './env/airflow';
import PostFX, { fx } from './PostFX';
import { createTraffic } from './env/traffic';
import { buildHeli } from './jet/heli';
import { applyInspect, heliEntries, jetEntries, type InspectEntry } from './inspector';
import { FLEET, type FleetId } from '@/content/fleet';
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
const BG = { hangar: C('#06080b'), studio: C('#f1eee7'), cabin: C('#20170f'), globe: C('#070b12') };
const HIGHLIGHT = C('#2f63ff');

function World({ quality, onReady }: { quality: Q; onReady: () => void }) {
  const { gl, scene, camera, size } = useThree();
  const setDpr = useThree((st) => st.setDpr);
  const perf = ui.useStore((st) => st.perf);
  const dofOn = ui.useStore((st) => st.dof);
  const cam = camera as THREE.PerspectiveCamera;
  const variant = ui.useStore((s) => s.variant);
  const detail = quality === 'high' ? 1 : 0.7;

  // ---------- construção (memoizada) ----------
  const env = useMemo(() => {
    const sky = createSkyDome(SKY_PALETTES.dawn);
    const sea = createCloudSea(SKY_PALETTES.dawn, quality === 'high' ? 6 : 4);
    sea.mesh.position.y = -70;
    const puffs = createCloudPuffs(SKY_PALETTES.dawn, quality === 'high' ? 150 : 70);
    const skyGroup = new THREE.Group();
    skyGroup.add(sky.mesh, sea.mesh, puffs.mesh);
    const gy = groundY(SPECS.XR);
    const hangar = createHangar(gy);
    const grid = createBlueprintGrid(gy);
    const globe = createGlobe(quality);
    globe.root.position.copy(GLOBE_CENTER);
    const maps = buildEnvMaps(gl, sky.mesh);
    return { sky, sea, puffs, skyGroup, hangar, grid, globe, maps, gy };
  }, [gl, quality]);

  const jet = useMemo<JetBuild>(() => buildJet(variant, { textureSize: quality === 'high' ? 4096 : 2048, detail }), [variant, quality, detail]);
  useEffect(() => () => jet.dispose(), [jet]);
  useEffect(() => () => {
    env.sea.mesh.geometry.dispose(); (env.sea.mesh.material as THREE.Material).dispose();
    env.sky.mesh.geometry.dispose(); (env.sky.mesh.material as THREE.Material).dispose();
    env.puffs.dispose(); env.hangar.dispose(); env.grid.dispose(); env.globe.dispose();
    Object.values(env.maps).forEach((t) => t.dispose());
  }, [env]);

  const contrails = useMemo(() => createContrails(), []);
  useEffect(() => { contrails.place(jet.exhausts); jet.group.add(contrails.group); return () => { jet.group.remove(contrails.group); }; }, [jet, contrails]);
  useEffect(() => () => contrails.dispose(), [contrails]);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const airflow = useMemo(() => createAirflow(jet, quality === 'high' ? 90 : 50), [jet, quality]);
  useEffect(() => { jet.group.add(airflow.mesh); return () => { jet.group.remove(airflow.mesh); airflow.dispose(); }; }, [jet, airflow]);
  const flow = useRef({ sea: 0, puff: 0, fan: 0 });

  // ---------- frota: fila de aeronaves no hangar, construída progressivamente em idle ----------
  type Craft = { id: FleetId; group: THREE.Group; fans: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; disc?: THREE.Mesh }[]; entries: InspectEntry[]; x: number; size: number; seats: { pos: THREE.Vector3; facing: 1 | -1 }[]; floorY: number; dispose: () => void };
  const lineup = useMemo(() => { const g = new THREE.Group(); g.name = 'lineup'; return g; }, []);
  const crafts = useRef<Craft[]>([]);
  const mainCraft = useMemo<Craft>(() => ({ id: 'XR', group: jet.group, fans: jet.fans.map((o) => ({ obj: o, axis: 'x' as const })), entries: jetEntries(jet.group, false), x: 0, size: jet.spec.L, seats: jet.cabin.seats, floorY: jet.cabin.floorY, dispose: () => {} }), [jet]);
  useEffect(() => {
    let cancelled = false;
    const todo = FLEET.filter((f) => f.id !== 'XR');
    // prioridade adaptativa: ociosidade enquanto o visitante está no céu; urgente ao se aproximar do hangar/frota
    const ric = (window as unknown as { requestIdleCallback?: (c: () => void, o?: object) => number }).requestIdleCallback;
    const idle = (cb: () => void) => { if (frame.t > 1.4 || !ric) window.setTimeout(cb, frame.t > 1.4 ? 16 : 200); else ric(cb, { timeout: 5000 }); };
    const next = () => {
      if (cancelled) return;
      const item = todo.shift(); if (!item) return;
      let c: Craft;
      if (item.id === 'H') {
        const h = buildHeli({ textureSize: quality === 'high' ? 2048 : 1024 });
        h.group.position.set(item.x, groundY(SPECS.XR) + 1.81, 0);
        c = { id: 'H', group: h.group, fans: h.fans, entries: heliEntries(h.group), x: item.x, size: h.length, seats: [], floorY: 0, dispose: h.dispose };
      } else {
        const b = buildJet(item.id as AircraftId, { textureSize: quality === 'high' ? 2048 : 1024, detail: 0.62 });
        b.group.position.set(item.x, groundY(SPECS.XR) - groundY(b.spec), 0);
        c = { id: item.id, group: b.group, fans: b.fans.map((o) => ({ obj: o, axis: 'x' as const })), entries: jetEntries(b.group, b.spec.kind === 'turboprop'), x: item.x, size: b.spec.L, seats: b.cabin.seats, floorY: b.cabin.floorY, dispose: b.dispose };
      }
      lineup.add(c.group);
      // compila os shaders desta aeronave fora da thread principal antes de ela aparecer
      const done = () => { crafts.current.push(c); idle(next); };
      (gl.compileAsync ? gl.compileAsync(c.group, camera, scene) : Promise.resolve()).then(done, done);
    };
    const start = window.setTimeout(() => idle(next), 1800);
    return () => { cancelled = true; window.clearTimeout(start); crafts.current.forEach((c) => { lineup.remove(c.group); c.dispose(); }); crafts.current = []; };
  }, [lineup, quality, gl, camera, scene]);
  const traffic = useMemo(() => createTraffic(), []);
  useEffect(() => () => traffic.dispose(), [traffic]);
  const inspectP = useRef(0);
  const lastRegion = useRef<string | null>(null);

  const tracks = useRef<Track[]>([]);
  useEffect(() => { tracks.current = buildTracks(jet, size.width / size.height); }, [jet, size.width, size.height]);

  // ---------- luzes ----------
  const lights = useMemo(() => {
    RectAreaLightUniformsLib.init();
    const sun = new THREE.DirectionalLight('#ffe2c8', 3.2); sun.position.set(-78, 20, 60);
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
  useEffect(() => {
    jet.cabin.lightSpots.forEach((p, i) => lights.cab[i].position.copy(p));
    const s = jet.spec, cx = jet.fus.x((s.cabinStart + s.cabinEnd) / 2), w = s.R - 0.16;
    lights.winL.width = lights.winR.width = s.cabinEnd - s.cabinStart - 1;
    lights.winL.position.set(cx, 0.22, -w); lights.winL.lookAt(cx, -0.2, 0);
    lights.winR.position.set(cx, 0.22, w); lights.winR.lookAt(cx, -0.2, 0);
  }, [jet, lights]);

  const floorRef = useRef<THREE.Mesh>(null);
  const perfMon = useRef({ acc: 0, n: 0, cool: 4, good: 0, max: quality === 'high' ? 3 : 1, lock: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === 'lock' });
  useEffect(() => { if (quality !== 'high' && ui.get().perf > 1) ui.set({ perf: 1 }); }, [quality]);
  useEffect(() => { const d = [1, 1.15, 1.4, Math.min(1.75, window.devicePixelRatio || 1)][perf]; setDpr(Math.min(window.devicePixelRatio || 1, d)); }, [perf, setDpr]);
  const tmp = useMemo(() => ({ fgFocus: new THREE.Vector3(), focusGoal: new THREE.Vector3(), dir: new THREE.Vector3(), vel: new THREE.Vector3(), prevEye: new THREE.Vector3(), right: new THREE.Vector3(), roll: 0, camEye: null as THREE.Vector3 | null, eye: new THREE.Vector3(), target: new THREE.Vector3(), vEye: new THREE.Vector3(), vTarget: new THREE.Vector3(), bg: new THREE.Color(), proj: new THREE.Vector3(), wobble: new THREE.Euler(), pal: {} as Record<string, THREE.Color>, viewW: 0, explode: 0, lastPart: null as PartId | null, lastDest: null as string | null, globeYaw: 0, globePitch: 0, firstFrame: true }), []);

  // ---------- compilação assíncrona antes do primeiro desenho ----------
  const setFrameloop = useThree((st) => st.setFrameloop);
  useEffect(() => {
    let alive = true;
    setFrameloop('never');
    const go = () => { if (alive) setFrameloop('always'); };
    const t = window.setTimeout(go, 4000); // nunca prende a experiência
    (gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve()).then(go, go);
    return () => { alive = false; window.clearTimeout(t); };
  }, [gl, scene, camera, setFrameloop, jet]);

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
    if (!pm.lock && !frame.freezeClock && !document.hidden) {
      pm.acc += rawDt; pm.n += 1;
      if (pm.acc > 1.2) {
        const fps = pm.n / pm.acc; pm.acc = 0; pm.n = 0;
        const lvl = ui.get().perf;
        pm.cool -= 1.2;
        if (fps < 42 && lvl > 0 && pm.cool <= 0) { ui.set({ perf: lvl - 1 }); pm.cool = 3.5; pm.good = 0; }
        else if (fps > 57) { pm.good += 1.2; if (pm.good > 8 && lvl < pm.max && pm.cool <= 0) { ui.set({ perf: lvl + 1 }); pm.cool = 6; pm.good = 0; } }
        else pm.good = 0;
      }
    }
    if (!frame.freezeClock) frame.clock += dt;
    const time = frame.clock;
    // amortecimento do tempo global; saltos longos (navegação) cortam direto
    if (Math.abs(frame.t - frame.ts) > 1.2) frame.ts = frame.t;
    else frame.ts = damp(frame.ts, frame.t, frame.freezeClock ? 1000 : 5.5, dt);
    const raw = frame.ts;
    // capítulo 3 = frota (trilha própria); depois dele a linha do tempo original continua deslocada em 1
    const t = raw < 3 ? raw : raw < 4 ? 2.9999 : raw - 1;
    const inFleet = raw >= 3 && raw < 4;
    const trk = tracks.current;
    if (!trk.length) return;
    const s = jet.spec;
    const st = ui.get();

    // ----- câmera -----
    let fov = sampleTracks(trk, t, tmp.eye, tmp.target);
    if (inFleet) {
      const p = raw - 3;
      const all = [mainCraft, ...crafts.current].sort((a, b) => b.x - a.x);
      const idx = frame.fleetSwipe ? frame.fleet : fleetDwell(p);
      const i0 = Math.floor(Math.min(idx, FLEET.length - 1)), f0 = idx - i0;
      const xA = FLEET[i0].x, xB = FLEET[Math.min(FLEET.length - 1, i0 + 1)].x;
      const sz = (id: FleetId) => all.find((c) => c.id === id)?.size ?? 20;
      const size = THREE.MathUtils.lerp(sz(FLEET[i0].id), sz(FLEET[Math.min(FLEET.length - 1, i0 + 1)].id), f0);
      const x = THREE.MathUtils.lerp(xA, xB, f0);
      const portraitK = size.valueOf() && (window.innerWidth < window.innerHeight ? 1.9 : 1);
      const dist = Math.max(22, size * 1.5) * portraitK;
      tmp.vEye.set(x + 2 + size * 0.12, 1.6, -dist);
      tmp.vTarget.set(x + size * 0.05, portraitK > 1 ? -4.4 : -1.4, 0);
      const into = ramp(p, 0.0, 0.1);
      tmp.eye.lerp(tmp.vEye, into); tmp.target.lerp(tmp.vTarget, into);
      fov = THREE.MathUtils.lerp(fov, 30, into);
      // inspeção: aproxima em 3/4
      const ins = st.inspect ? all.find((c) => c.id === st.inspect) : null;
      tmp.viewW = damp(tmp.viewW, ins ? 1 : 0, 2.6, dt);
      if (ins) {
        const gp = ins.group.position;
        if (st.inspectMode === 'plan' && ins.seats.length) {
          // planta: de cima, teto cortado, nariz à esquerda
          tmp.vEye.set(ins.x - (portraitK > 1 ? 0 : ins.size * 0.2), ins.size * (portraitK > 1 ? 2.2 : 1.05), portraitK > 1 ? 0.01 : -3);
          tmp.vTarget.set(ins.x - (portraitK > 1 ? 0 : ins.size * 0.2), gp.y + ins.floorY, 0);
          if (portraitK > 1) { tmp.vEye.x -= 0.6; }
        } else if (st.inspectMode === 'seat' && st.seat !== null && ins.seats[st.seat]) {
          // vista sentado: altura dos olhos, olhando para frente e levemente para a janela
          const se = ins.seats[st.seat];
          tmp.vEye.set(gp.x + se.pos.x - se.facing * 0.18, gp.y + ins.floorY + 1.12, se.pos.z * 0.92);
          tmp.vTarget.set(tmp.vEye.x + se.facing * 3.2, tmp.vEye.y - 0.22, se.pos.z * 1.35);
        } else {
          tmp.vEye.set(ins.x + ins.size * 0.62, 4.2, -ins.size * 1.05 * portraitK);
          tmp.vTarget.set(ins.x - ins.size * (portraitK > 1 ? 0.04 : 0.24), portraitK > 1 ? -2.6 : 0.6, 0);
        }
      }
      if (tmp.viewW > 0.001 && (ins || tmp.viewW > 0.01)) { tmp.eye.lerp(tmp.vEye, tmp.viewW); tmp.target.lerp(tmp.vTarget, tmp.viewW); fov = THREE.MathUtils.lerp(fov, st.inspectMode === 'seat' ? 56 : st.inspectMode === 'plan' ? 32 : 36, tmp.viewW); }
      // a câmera da poltrona amortece mais devagar: entra pela planta e desce até o assento
      if (ins && st.inspectMode !== 'parts') { tmp.camEye = tmp.camEye ?? tmp.eye.clone(); tmp.camEye.lerp(tmp.eye, 1 - Math.exp(-3.2 * dt)); tmp.eye.copy(tmp.camEye); } else tmp.camEye = null;
    }
    // perspectivas manuais no hangar (Exterior / Cabine / Detalhes)
    const viewActive = st.view && t > 2.05 && t < 2.99 ? 1 : 0;
    if (!inFleet) tmp.viewW = damp(tmp.viewW, viewActive, 3.2, dt);
    if (!inFleet && tmp.viewW > 0.001 && st.view) {
      viewPose(jet, st.view, tmp.vEye, tmp.vTarget);
      tmp.eye.lerp(tmp.vEye, tmp.viewW);
      tmp.target.lerp(tmp.vTarget, tmp.viewW);
      fov = THREE.MathUtils.lerp(fov, st.view === 'detalhes' ? 34 : 38, tmp.viewW);
    }
    // parallax sutil (somente fora da cabine)
    const outside = t < 1.15 || (t > 1.9 && t < 4.4) || t > 6.4;
    const par = outside ? 0.35 : 0.04;
    tmp.eye.x += frame.px * par * (t > 3.2 && t < 4.4 ? 0.2 : 1);
    tmp.eye.y += frame.py * par * 0.5;
    cam.position.copy(tmp.eye);
    cam.lookAt(tmp.target);
    // câmera na mão: micro-oscilação orgânica (soma de senos), menor dentro da cabine
    if (st.motion === 'cinematic' && !frame.freezeClock) {
      const amp = (outside ? 0.0011 : 0.0006) + 0.0012 * (1 - ramp(t, 0.6, 1.0));
      cam.rotateX((Math.sin(time * 0.71) * 0.5 + Math.sin(time * 1.37 + 1.1) * 0.3 + Math.sin(time * 2.3 + 2.0) * 0.2) * amp);
      cam.rotateY((Math.sin(time * 0.53 + 0.4) * 0.5 + Math.sin(time * 1.19 + 2.2) * 0.3 + Math.sin(time * 1.9 + 0.7) * 0.2) * amp);
      // trepidação de turbulência em alta frequência (só em voo, fora da cabine)
      const buf = (1 - ramp(t, 0.7, 1.0)) * (t < 1.2 ? 1 : 0) + (t > 7 ? 0.4 : 0);
      cam.rotateZ((Math.sin(time * 9.1) * 0.6 + Math.sin(time * 14.3 + 1.3) * 0.4) * 0.00045 * buf);
    }
    // foquista: o ponto de foco tem inércia própria (rack focus); no início do hero o foco parte das nuvens próximas
    tmp.fgFocus.copy(cam.position).addScaledVector(cam.getWorldDirection(tmp.dir), 9);
    tmp.focusGoal.copy(tmp.fgFocus).lerp(tmp.target, ramp(t, 0.015, 0.16) * (frame.freezeClock ? 1 : 1));
    if (t > 0.2 || frame.freezeClock) tmp.focusGoal.copy(tmp.target);
    focus.lerp(tmp.focusGoal, frame.freezeClock ? 1 : 1 - Math.exp(-2.4 * dt));
    // roll de operador: inclina levemente na direção do movimento lateral (grua/drone)
    tmp.vel.copy(cam.position).sub(tmp.prevEye).divideScalar(Math.max(dt, 1e-3));
    tmp.prevEye.copy(cam.position);
    tmp.right.setFromMatrixColumn(cam.matrixWorld, 0);
    const lateral = tmp.vel.dot(tmp.right);
    tmp.roll = damp(tmp.roll, clamp(-lateral * 0.0035, -0.045, 0.045), 2.5, dt);
    if (!frame.freezeClock && Math.abs(tmp.roll) > 1e-4) cam.rotateZ(tmp.roll);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }

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
      su.uOpacity.value = skyW; cu.uOpacity.value = skyW; pu.uOpacity.value = skyW;
      cu.uTime.value = time; pu.uTime.value = time;
      cu.uCam.value.copy(cam.position);
      env.sea.mesh.position.x = cam.position.x; env.sea.mesh.position.z = cam.position.z;
      env.sea.mesh.position.y = epi > 0 ? -40 : -70;
      env.puffs.mesh.visible = true;
    }
    // névoa atmosférica
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(skyW > 0.5 ? tmp.pal.haze ?? C('#efd3cc') : tmp.bg);
    fog.density = skyA > 0.5 ? 0.0019 : epi > 0 ? 0.0018 : hangarW > 0.5 ? 0.012 : 0.0;

    // hangar / estúdio
    env.hangar.group.visible = hangarW > 0.001 || (t > 1.75 && t < 3.25);
    env.hangar.setOpacity(hangarW);
    env.hangar.bars.visible = !(inFleet && st.inspect && st.inspectMode !== 'parts');
    env.grid.mesh.visible = studioW > 0.001;
    env.grid.uniforms.uOpacity.value = studioW;
    if (floorRef.current) {
      floorRef.current.visible = hangarW > 0.02;
      const fm = floorRef.current.material as THREE.MeshStandardMaterial & { mixStrength?: number };
      fm.color.set('#07090c').lerp(BG.studio, 1 - hangarW);
      if (fm.mixStrength !== undefined) fm.mixStrength = 3.2 * hangarW;
    }

    // globo
    env.globe.root.visible = globeW > 0.001;
    if (env.globe.root.visible) {
      env.globe.setOpacity(1);
      const dest = st.destination ? DESTINATIONS.find((d) => d.id === st.destination) : null;
      if (st.destination !== tmp.lastDest) { env.globe.setArc(st.destination); tmp.lastDest = st.destination; }
      const reduce = st.motion === 'reduced';
      let ty: number, tp: number;
      if (dest) { const f = facing(dest.lat * 0.6 + -23.55 * 0.4, dest.lon * 0.6 + -46.63 * 0.4); ty = f.yaw; tp = f.pitch * 0.8; }
      else { const f = facing(-10, -40); ty = f.yaw + (reduce ? 0 : time * 0.04); tp = f.pitch * 0.6; }
      ty += frame.globeYaw; tp = clamp(tp + frame.globePitch, -0.9, 0.9);
      tmp.globeYaw = damp(tmp.globeYaw, ty, 2.4, dt);
      tmp.globePitch = damp(tmp.globePitch, tp, 2.4, dt);
      env.globe.spin.rotation.y = tmp.globeYaw;
      env.globe.root.rotation.x = tmp.globePitch;
      const visible = new Set(DESTINATIONS.filter((d) => st.region === 'todos' || d.region === st.region).map((d) => d.id));
      env.globe.update(dt, st.destination, visible, time);
    }

    // ----- jato -----
    const jg = jet.group;
    jg.visible = t < 6.31 || epi > 0;
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
    (Object.keys(jet.parts) as PartId[]).forEach((id) => {
      const off = jet.explode[id];
      if (id === 'asas') {
        jet.parts.asas.children.forEach((m) => { const side = m.name.endsWith('-1') && !m.name.endsWith('--1') ? 1 : -1; m.position.set(0, off.y * e, side * 2.6 * e); });
      } else if (id === 'motores') {
        jet.parts.motores.children.forEach((m) => { const z = (m as THREE.Object3D).position.z; if (m.type === 'Group') m.position.set(m.position.x, (m.userData.y0 ??= m.position.y) + off.y * e, (m.userData.z0 ??= z) + Math.sign(m.userData.z0) * 1.6 * e); else m.position.set(0, off.y * e, 0); });
      } else jet.parts[id].position.copy(off).multiplyScalar(e);
    });
    // destaque azul da peça selecionada
    if (st.part !== tmp.lastPart || tmp.firstFrame) {
      (Object.keys(jet.partMaterials) as PartId[]).forEach((id) => jet.partMaterials[id].forEach((m) => {
        const mm = m as THREE.MeshStandardMaterial;
        if (!('emissive' in mm) || id === 'cabine') return;
        mm.emissive.copy(id === st.part ? HIGHLIGHT : C('#000000'));
        mm.emissiveIntensity = id === st.part ? 0.55 : 1;
      }));
      tmp.lastPart = st.part;
    }
    // corte do teto (cutaway)
    let cut = 100;
    if (t > 3.98 && t < 4.82) {
      const down = ramp(t, 4.0, 4.25), up = ramp(t, 4.62, 4.8);
      cut = THREE.MathUtils.lerp(s.R + 1.6, 0.34, down) + up * 3;
    }
    if (inFleet && st.inspect && st.inspectMode !== 'parts') {
      // planta: teto cortado na linha das janelas; vista sentado: teto volta quando a câmera está abaixo dele
      cut = st.inspectMode === 'seat' && cam.position.y < 0.9 ? 100 : 0.32;
    }
    CUT.constant = cut;

    // ----- mapas de ambiente e luzes -----
    const insidePortal = t > 1.32 && t < 1.76;
    const inCabin = t > 4.66 && t < 6.31;
    const envKey = insidePortal || inCabin ? 'cabin' : skyW > 0.5 && t < 1.76 ? 'sky' : epi > 0 ? 'sky' : hangarW > 0.5 ? 'hangar' : 'studio';
    const envTex = env.maps[envKey];
    if (scene.environment !== envTex) scene.environment = envTex;
    const inside = insidePortal || inCabin;
    const wantDof = true; // DOF/AO validados dentro da cabine após remover CA e ruído (causa real dos artefatos)
    if (wantDof !== st.dof) ui.set({ dof: wantDof });
    scene.environmentIntensity = inside ? 0.26 : envKey === 'hangar' ? 0.2 : envKey === 'studio' ? 0.7 : 0.5;
    lights.sun.intensity = inside ? 0 : 2.6 * Math.max(skyA, epi) + 0.5 * studioW;
    lights.hemi.intensity = inside ? 0.05 : 0.32 * Math.max(skyA, epi) + 1.1 * studioW + 0.02 * hangarW;
    lights.key.intensity = 30 * hangarW;
    // a luz-chave e o contraluz acompanham a câmera ao longo da fila da frota
    const kx = inFleet ? tmp.target.x : 0;
    if (Math.abs(lights.key.position.x - (kx - 7)) > 0.01) { lights.key.position.set(kx - 7, 6.5, -9); lights.key.lookAt(kx - 2, 0.6, 0); lights.rim.position.set(kx + 14, 9, 34); lights.rim.target.position.set(kx, 0, 0); lights.rim.target.updateMatrixWorld(); }
    lights.rim.intensity = 2.4 * hangarW;
    const cabinLight = inside ? 1 : hangarW > 0.5 ? 0.9 : 0.3;
    lights.cab.forEach((l) => { l.intensity = (inside ? 0.9 : 1.1) * cabinLight; });
    const day = inside ? (inCabin ? 1 : 0.8) : 0;
    lights.winL.intensity = lights.winR.intensity = 1.8 * day;
    if (fx.ao) {
      // na travessia da janela a câmera fica a centímetros da geometria: AO desligada (evita artefatos de profundidade)
      const ao = 2.6 * (inCabin ? 1 : 0) + 2.0 * hangarW + 1.4 * studioW + 0.6 * Math.max(skyA, epi) * (t < 1.0 ? 1 : 0);
      fx.ao.configuration.intensity = damp(fx.ao.configuration.intensity, ao, 3, dt);
      fx.ao.configuration.aoRadius = inside ? 0.6 : 1.6;
    }
    jet.cabin.glow.forEach((m, i) => { m.emissiveIntensity = (i === 0 ? 2.2 : 1.4) * (0.4 + 0.6 * cabinLight); });

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
    if (fx.speed) fx.speed.uniforms.get('uStrength')!.value = 0.0042 * skyA * (1 - ramp(t, 0.75, 1.0)) + 0.0025 * epi;

    // ----- rastros de condensação -----
    contrails.uniforms.uTime.value = time;
    contrails.uniforms.uOpacity.value = Math.max(skyA * (1 - ramp(t, 0.85, 1.05)), epi);
    contrails.group.visible = contrails.uniforms.uOpacity.value > 0.01;

    // ----- lente e grade por cena (exposição de câmera, não filtro) -----
    const W = { sky: Math.max(skyA, epi), hangar: hangarW, studio: studioW, cabin: insidePortal || inCabin ? 1 : 0, globe: globeW };
    if (fx.dof) {
      const bokeh = 3.2 * W.sky * (t < 1.1 || epi > 0 ? 1 : 0.4) + 2.2 * W.hangar + 1.6 * W.cabin * (t > 4.85 ? 1 : 0.3);
      fx.dof.bokehScale = damp(fx.dof.bokehScale, bokeh, 3, dt);
    }
    if (fx.grade) {
      const u = fx.grade.uniforms;
      const warm = 0.35 * W.sky + 0.12 * W.hangar - 0.05 * W.studio + 0.65 * W.cabin - 0.25 * W.globe;
      const contrast = 0.16 * W.sky + 0.3 * W.hangar + 0.08 * W.studio + 0.22 * W.cabin + 0.2 * W.globe;
      const sat = 1.1 * W.sky + 1.0 * W.hangar + 0.92 * W.studio + 1.06 * W.cabin + 1.0 * W.globe;
      u.get('uWarm')!.value = damp(u.get('uWarm')!.value, warm, 3, dt);
      u.get('uContrast')!.value = damp(u.get('uContrast')!.value, contrast, 3, dt);
      u.get('uSat')!.value = damp(u.get('uSat')!.value, Math.max(0.9, sat), 3, dt);
      // adaptação de exposição do sensor: entra na cabine escura e a imagem clareia aos poucos (e vice-versa)
      const expo = 0.94 * W.sky + 1.1 * W.hangar + 0.98 * W.studio + 1.2 * W.cabin + 1.02 * W.globe;
      u.get('uExposure')!.value = frame.freezeClock ? Math.max(0.9, expo) : damp(u.get('uExposure')!.value, Math.max(0.9, expo), 0.9, dt);
    }
    {
    }

    // ----- frota: visibilidade, rotores ociosos, desmontagem -----
    lineup.visible = hangarW > 0.01 && t < 3.2;
    crafts.current.forEach((c) => { c.fans.forEach((fa) => { if (fa.axis === 'y') fa.obj.rotation.y = time * (c.id === 'H' ? 0.6 : 0.7); else if (fa.axis === 'z') fa.obj.rotation.z = time * 1.2; else fa.obj.rotation.x = time * 0.7; if (fa.disc) (fa.disc.material as THREE.MeshBasicMaterial).opacity = 0; }); });
    const target = st.inspect && !st.assembled ? 1 : 0;
    const prevP = inspectP.current;
    inspectP.current = clamp(prevP + Math.sign(target - prevP) * dt / 2.4);
    if (inFleet || prevP > 0) {
      const all = [mainCraft, ...crafts.current];
      all.forEach((c) => { if (c.id === st.inspect || (prevP > 0 && c.id === (tmp as unknown as { lastIns?: string }).lastIns)) applyInspect(c.entries, inspectP.current, st.inspectPart, time); });
      if (st.inspect) (tmp as unknown as { lastIns?: string }).lastIns = st.inspect;
    }

    // ----- marcadores de poltrona (DOM) -----
    const seatLayer = domRefs.seatLayer;
    if (seatLayer) {
      const insC = st.inspect ? [mainCraft, ...crafts.current].find((c) => c.id === st.inspect) : null;
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
    if (traffic.group.visible) traffic.update(time, frame.px, frame.py);

    // ----- rede de rotas no globo + traço conectando a janela ao globo -----
    if (env.globe.root.visible && lastRegion.current !== st.region) {
      lastRegion.current = st.region;
      env.globe.setNetwork(DESTINATIONS.filter((d) => st.region === 'todos' || d.region === st.region).map((d) => d.id));
    }
    if (!env.globe.root.visible) lastRegion.current = null;
    const route = domRefs.route;
    if (route) {
      const on = t > 5.96 && t < 6.75;
      route.style.opacity = on ? String(Math.min(1, ramp(t, 5.96, 6.08)) * (1 - ramp(t, 6.6, 6.75))) : '0';
      if (on) {
        const sx = size.width * 0.5, sy = size.height * 0.46;
        let ex = size.width * 0.36, ey = size.height * 1.05;
        if (t > 6.3) { env.globe.origin().getWorldPosition(tmp.proj); tmp.proj.project(cam); ex = (tmp.proj.x * 0.5 + 0.5) * size.width; ey = (-tmp.proj.y * 0.5 + 0.5) * size.height; }
        const draw = ramp(t, 5.98, 6.5);
        route.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} C${(sx + size.width * 0.2).toFixed(1)},${(sy + size.height * 0.3).toFixed(1)} ${(ex - size.width * 0.15).toFixed(1)},${(ey - size.height * 0.35).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
        route.style.strokeDashoffset = String(1 - draw);
      }
    }

    // ----- véu de transição (luminância contínua, nunca preto) -----
    const vPortal = pulse(t, 1.62, 1.74, 1.79, 1.95);
    const vGlobe = pulse(t, 6.16, 6.28, 6.32, 6.5);
    const vFleet = pulse(raw, 3.86, 3.93, 3.975, 4.06);
    const veil = Math.max(vPortal, vGlobe, vFleet);
    if (domRefs.veil) {
      domRefs.veil.style.opacity = veil.toFixed(3);
      domRefs.veil.style.backgroundColor = vFleet > 0.01 ? '#f1eee7' : vPortal >= vGlobe ? '#e8cfae' : '#f2eee8';
    }
    frame.veil = veil;

    // ----- hotspots projetados (DOM) -----
    const layer = domRefs.hotspotLayer;
    const hsVis = t > 3.42 && t < 3.97;
    if (layer) {
      layer.dataset.visible = hsVis ? 'true' : 'false';
      if (hsVis) {
        domRefs.hotspots.forEach((el, id) => {
          const a = jet.anchors[id];
          tmp.proj.copy(a);
          const off = jet.explode[id];
          if (id === 'asas') tmp.proj.z += -2.6 * e; else if (id === 'motores') { tmp.proj.y += off.y * e; tmp.proj.z += -1.6 * e; } else tmp.proj.addScaledVector(off, e);
          tmp.proj.applyMatrix4(jg.matrixWorld).project(cam);
          const x = (tmp.proj.x * 0.5 + 0.5) * size.width, y = (-tmp.proj.y * 0.5 + 0.5) * size.height;
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        });
      }
    }

    if (tmp.firstFrame) { tmp.firstFrame = false; }
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
      <primitive object={env.globe.root} />
      <primitive object={jet.group} />
      <primitive object={lineup} />
      <primitive object={traffic.group} />
      {frame.freezeClock && quality === 'high' && false ? null : <FXBoundary><PostFX quality={quality} level={perf} focus={focus} dof={dofOn} /></FXBoundary>}
      <mesh ref={floorRef} rotation-x={-Math.PI / 2} position={[-80, env.gy, 0]} visible={false}>
        <planeGeometry args={[520, 220]} />
        {quality === 'high' && perf >= 3 ? (
          <MeshReflectorMaterial blur={[400, 120]} resolution={768} mixBlur={1} mixStrength={3.2} roughness={0.75} depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#0a0d11" metalness={0.5} mirror={0.6} />
        ) : (
          <meshStandardMaterial color="#0a0d11" roughness={0.4} metalness={0.4} />
        )}
      </mesh>
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

export default function Experience({ quality, onReady }: { quality: Q; onReady: () => void }) {
  return (
    <Canvas
      className="scene-canvas"
      aria-hidden="true"
      dpr={quality === 'high' ? [1, 1.6] : [1, 1.25]}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 30, near: 0.02, far: 7000, position: [27, 4.2, 58] }}
      frameloop="always"
      flat={false}
    >
      <World quality={quality} onReady={onReady} />
    </Canvas>
  );
}
export type { VariantId };
