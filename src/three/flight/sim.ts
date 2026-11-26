import * as THREE from 'three';
import type { FleetCraftBuild } from '../fleet/airframe';
import { buildCabin, type CabinBuild } from '../fleet/cabin';
import { FLEET_SPECS } from '../fleet/specs';
import type { FleetId } from '@/content/fleet';
import { flightInput as IN, flightTel as TEL, flightUi } from '@/experience/flight';
import { isWater, ISLAND } from './terrain';

/**
 * Test drive — dinâmica de voo arcade crível (não certificada).
 * Atitude em QUATÉRNIO: permite looping (para frente e para trás), tonneau 360° e voo invertido.
 * Convenções do gerador: nariz em +x local, +y local = teto, +z local = asa direita.
 * Pista 27 do aeródromo da Frota: decolagem/pouso no rumo −x. Ilha com pista no mar (ISLAND), mesmo rumo.
 * Velocidades são visuais por classe de aeronave (rotulado na interface como simulação ilustrativa).
 */
const G = 9.81;
const RW_Z = 122, RW_X0 = 60, RW_X1 = -1400, RW_HALF = 26;
const TOUCH_X = -230, GS = Math.tan(THREE.MathUtils.degToRad(3));
// pistas pousáveis (ambas no rumo −x): aeródromo da Frota e ilha
const RWYS = [{ z: RW_Z, thr: RW_X0, end: RW_X1, touch: TOUCH_X }, { z: ISLAND.rz, thr: ISLAND.rx0, end: ISLAND.rx1, touch: ISLAND.rx0 - 220 }];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);

interface Perf { vr: number; vapp: number; vcruise: number; vmax: number; accel: number; spoolK: number; piston: boolean }
function perfFor(id: FleetId): Perf {
  if (id === 'matrix') return { vr: 36, vapp: 42, vcruise: 92, vmax: 120, accel: 4.2, spoolK: 2.4, piston: true };
  if (id === 'citation-cj2-plus') return { vr: 52, vapp: 58, vcruise: 190, vmax: 225, accel: 5.8, spoolK: 1.2, piston: false };
  return { vr: 58, vapp: 64, vcruise: 235, vmax: 262, accel: 6.2, spoolK: 1.1, piston: false };
}
// rota cênica do voo livre: costa, mar, ilha, acima das nuvens, retorno
const SCENIC: [number, number, number][] = [[-5200, 700, 1400], [-9800, 1400, 3200], [-7600, 1600, 7600], [-1500, 1700, 10500], [6800, 1300, 7600], [8200, 900, 900], [3600, 800, -3600], [-2600, 1100, -3000]];
type Phase = 'start' | 'ready' | 'roll' | 'air' | 'approach' | 'rollout' | 'parked' | 'crashed';
type Maneuver = { kind: 'roll' | 'loop'; t: number; dur: number } | null;

export class FlightSim {
  id: FleetId | null = null;
  craft: FleetCraftBuild | null = null;
  private saved = { pos: new THREE.Vector3(), rot: new THREE.Euler(), vis: true };
  pos = new THREE.Vector3();
  /** atitude (fonte da verdade no ar) */
  att = new THREE.Quaternion();
  yaw = Math.PI; pitch = 0; roll = 0; V = 0; spool = 0; thr = 0; gear = true;
  nose = 0;
  phase: Phase = 'start';
  private t0 = 0; private wp = 0; private landStage: 'join' | 'final' = 'join'; private rw = RWYS[0]; private joinFar = false;
  private perf: Perf = perfFor('legacy-450');
  get vmax() { return this.perf.vmax; }
  private axisH = 2; private size = 20;
  eye = new THREE.Vector3(); target = new THREE.Vector3();
  /** "cima" da câmera (acompanha manobras; nivelado em voo normal) */
  camUp = new THREE.Vector3(0, 1, 0);
  /** câmera dentro da aeronave (cockpit/poltrona): o loop 3D usa plano próximo menor */
  inside = false;
  private camInit = false;
  private fwd = new THREE.Vector3(); private upL = new THREE.Vector3(); private tmp = new THREE.Vector3(); private tmp2 = new THREE.Vector3();
  private qa = new THREE.Quaternion(); private eul = new THREE.Euler(0, 0, 0, 'YZX');
  private rotors: THREE.Object3D[] = [];
  private rotorAng = 0;
  private maneuver: Maneuver = null; private nextManeuver = 10; private manIdx = 0;
  private sinkY = 0;
  /** trem: 1 baixado, 0 recolhido (animado ~3 s, como no avião real) */
  private gearK = 1; private lastDt = 1 / 60; private simT = 0;
  /** interior de luxo (poltrona/cockpit), montado na primeira vista de dentro */
  private interior: CabinBuild | null = null; private insideOn = false; private panelT = 0;
  private walkPos = new THREE.Vector3(); private lastView = '';
  private gearLegs: { o: THREE.Object3D; kind: 'nose' | 'R' | 'L' }[] = [];
  /** luzes de navegação, strobes, beacon e farol de pouso */
  private lights: { g: THREE.Group; nav: THREE.Sprite[]; strobe: THREE.Sprite[]; beacon: THREE.Sprite[]; land: THREE.Sprite[] } | null = null;

  start(id: FleetId, craft: FleetCraftBuild, gy: number, time: number) {
    if (this.craft !== craft) { this.saved.pos.copy(craft.group.position); this.saved.rot.copy(craft.group.rotation); this.saved.vis = craft.group.visible; }
    this.id = id; this.craft = craft; this.perf = perfFor(id);
    this.axisH = craft.axisH; this.size = FLEET_SPECS[id].envelope.length;
    this.pos.set(RW_X0 - 30 - this.size * 0.5, gy + this.axisH, RW_Z);
    this.yaw = Math.PI; this.pitch = 0; this.roll = 0; this.V = 0; this.spool = 0; this.thr = 0; this.gear = true; this.nose = 0;
    this.syncAttFromEuler();
    this.setPhase('start'); this.t0 = this.simT; void time; this.wp = 0; this.camInit = false; this.maneuver = null; this.nextManeuver = 10; this.sinkY = 0;
    flightUi.set({ crash: null, landing: null });
    TEL.piston = this.perf.piston;
    this.rotors = [];
    craft.group.traverse((o) => { if (o.name === 'propeller' || o.name === 'fan') this.rotors.push(o); });
    this.rotorAng = 0;
    this.gearK = 1; this.gearLegs = [];
    craft.systems.trem.children.forEach((o) => { o.rotation.set(0, 0, 0); o.scale.setScalar(1); if (o.name.startsWith('gear-')) this.gearLegs.push({ o, kind: o.name === 'gear-nose' ? 'nose' : o.name.endsWith('R') ? 'R' : 'L' }); });
    this.buildLights(craft);
  }
  private buildLights(craft: FleetCraftBuild) {
    this.disposeLights();
    if (typeof document === 'undefined') return;
    const g = craft.group;
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    g.position.set(0, 0, 0); g.quaternion.identity(); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(craft.systems.asas);
    const all = new THREE.Box3().setFromObject(g);
    g.position.copy(p0); g.quaternion.copy(q0); g.updateMatrixWorld(true);
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x2 = cv.getContext('2d')!; const r = x2.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.85)'); r.addColorStop(0.45, 'rgba(255,255,255,0.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    x2.fillStyle = r; x2.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const grp = new THREE.Group(); grp.name = 'flight-lights';
    const mk = (color: string, size: number, x: number, y: number, z: number) => {
      const m = new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const sp = new THREE.Sprite(m); sp.scale.setScalar(size); sp.position.set(x, y, z); sp.userData.size = size; sp.renderOrder = 5; grp.add(sp); return sp;
    };
    const span = Math.max(box.max.z, -box.min.z), tipX = (box.min.x + box.max.x) / 2 - (box.max.x - box.min.x) * 0.15, tipY = box.max.y;
    const sz = Math.max(0.6, this.size * 0.05);
    const nav = [mk('#ff2a1e', sz, tipX, tipY, -span), mk('#2bff7a', sz, tipX, tipY, span), mk('#ffffff', sz * 0.8, all.min.x + 0.15, all.max.y * 0.55, 0)];
    const strobe = [mk('#ffffff', sz * 3.2, tipX - 0.1, tipY, -span - 0.05), mk('#ffffff', sz * 3.2, tipX - 0.1, tipY, span + 0.05)];
    const beacon = [mk('#ff3020', sz * 1.9, (all.min.x + all.max.x) * 0.5, all.max.y * 0.62, 0), mk('#ff3020', sz * 1.9, (all.min.x + all.max.x) * 0.5 + 0.6, -this.axisH * 0.42, 0)];
    const land = [mk('#fff4dc', sz * 2.6, all.max.x - this.size * 0.12, -this.axisH * 0.55, 0.3), mk('#fff4dc', sz * 2.6, all.max.x - this.size * 0.12, -this.axisH * 0.55, -0.3)];
    g.add(grp);
    this.lights = { g: grp, nav, strobe, beacon, land };
    grp.userData.tex = tex;
  }
  private disposeLights() {
    const L = this.lights; if (!L) return;
    L.g.parent?.remove(L.g);
    L.g.children.forEach((o) => ((o as THREE.Sprite).material as THREE.Material).dispose());
    (L.g.userData.tex as THREE.Texture | undefined)?.dispose();
    this.lights = null;
  }
  private updateLights(time: number) {
    const L = this.lights; if (!L) return;
    const fl = (s: THREE.Sprite, k: number) => { s.visible = k > 0.01; s.scale.setScalar((s.userData.size as number) * (0.35 + 0.65 * k)); (s.material as THREE.SpriteMaterial).opacity = Math.min(1, k); };
    const ph = time % 1.2; // strobe: duplo flash a cada 1,2 s
    const st = ph < 0.05 || (ph > 0.14 && ph < 0.19) ? 1 : 0;
    L.strobe.forEach((s) => fl(s, this.phase === 'start' || this.phase === 'parked' ? 0 : st));
    const bp = (time * 1.1) % 1; const bk = bp < 0.18 ? Math.sin((bp / 0.18) * Math.PI) : 0; // beacon rotativo
    L.beacon.forEach((s) => fl(s, bk));
    L.nav.forEach((s) => fl(s, 0.9));
    const ld = this.gearK > 0.5 && this.phase !== 'parked' && this.phase !== 'crashed' ? 1 : 0;
    L.land.forEach((s) => fl(s, ld));
  }
  private setInside(on: boolean) {
    const c = this.craft; if (!c || on === this.insideOn) return;
    if (on && !this.interior && typeof document !== 'undefined') { this.interior = buildCabin(FLEET_SPECS[this.id!], c.fuse, c.fusL, { lux: true }); c.group.add(this.interior.group); }
    this.insideOn = on;
    if (this.interior) this.interior.group.visible = on;
    // por dentro o casco externo some: o céu, a asa e os motores aparecem pelas janelas recortadas no forro
    c.systems.fuselagem.visible = !on; c.systems.portas.visible = !on; c.systems.cabine.visible = !on;
  }
  stop() {
    const c = this.craft;
    this.setInside(false);
    if (this.interior) { this.interior.group.parent?.remove(this.interior.group); this.interior.dispose(); this.interior = null; }
    this.rotors.forEach((r) => { r.rotation.x = 0; }); this.rotors = [];
    this.disposeLights();
    this.gearLegs.forEach(({ o }) => { o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.visible = true; }); this.gearLegs = [];
    if (c) { c.group.position.copy(this.saved.pos); c.group.rotation.copy(this.saved.rot); c.group.visible = this.saved.vis; c.systems.trem.visible = true; }
    this.craft = null; this.id = null;
  }
  private setPhase(p: Phase) { if (this.phase !== p) { this.phase = p; flightUi.set({ phase: p as never }); } }
  private syncAttFromEuler() { this.eul.set(this.roll, this.yaw, this.pitch, 'YZX'); this.att.setFromEuler(this.eul); }
  private syncEulerFromAtt() { this.eul.setFromQuaternion(this.att, 'YZX'); this.yaw = this.eul.y; this.pitch = this.eul.z; this.roll = this.eul.x; }
  private onAnyRunway(x: number, z: number) {
    const main = x < RW_X0 + 40 && x > RW_X1 - 100 && Math.abs(z - RW_Z) < RW_HALF;
    const isl = Math.abs(z - ISLAND.rz) < ISLAND.rw / 2 + 4 && x < ISLAND.rx0 + 30 && x > ISLAND.rx1 - 60;
    return main || isl;
  }
  private crash(kind: 'ground' | 'water') {
    this.setPhase('crashed'); this.V = 0; this.thr = 0; this.maneuver = null; this.sinkY = 0;
    flightUi.set({ crash: kind, auto: false });
  }

  step(dt: number, time: number, gy: number, portrait: boolean, seat: number | null) {
    const c = this.craft; if (!c) return;
    this.lastDt = dt; this.simT += dt;
    const P = this.perf;
    const auto = flightUi.get().auto;
    if (IN.restart) { IN.restart = false; this.start(this.id!, c, gy, time); this.t0 -= 10; }
    const agl = () => this.pos.y - gy - this.axisH;
    let pitchCmd = 0, rollTarget: number | null = null, thrTarget = this.thr;

    // ---------- fases de solo ----------
    if (this.phase === 'start') { thrTarget = 0.12; if (this.simT - this.t0 > (P.piston ? 2.2 : 3.6)) this.setPhase('ready'); }
    if (this.phase === 'ready') { thrTarget = 0.12; if (IN.takeoff || IN.pitch > 0.5 || IN.throttle > 0.5 || auto) { IN.takeoff = false; this.setPhase('roll'); } }
    if (this.phase === 'parked') { thrTarget = 0.1; this.V = damp(this.V, 0, 2, dt); if (IN.takeoff || IN.pitch > 0.5 || IN.throttle > 0.5) { IN.takeoff = false; this.setPhase('roll'); flightUi.set({ landing: null }); } }
    if (this.phase === 'crashed') {
      // destroços: afunda na água, fica caído no chão
      this.sinkY = Math.min(this.sinkY + dt * (flightUi.get().crash === 'water' ? 0.9 : 0), this.axisH + 2.5);
      c.group.position.set(this.pos.x, this.pos.y - this.sinkY, this.pos.z);
      this.writeCamera(dt, gy, portrait, seat);
      return;
    }
    if (IN.land && this.phase === 'air') {
      IN.land = false; this.syncEulerFromAtt();
      // pista mais próxima (pelo ponto de aproximação final, 4,2 km antes da cabeceira)
      this.rw = RWYS.reduce((a, b) => (Math.hypot(b.thr + 4200 - this.pos.x, b.z - this.pos.z) < Math.hypot(a.thr + 4200 - this.pos.x, a.z - this.pos.z) ? b : a));
      this.landStage = 'join'; this.joinFar = false;
      flightUi.set({ auto: false }); this.maneuver = null; this.setPhase('approach');
    }
    IN.land = false;

    let onGround = this.phase === 'start' || this.phase === 'ready' || this.phase === 'roll' || this.phase === 'rollout' || this.phase === 'parked';

    if (this.phase === 'roll') {
      thrTarget = 1;
      this.V += P.accel * this.spool * dt;
      if (this.V > P.vr || (this.V > P.vr * 0.85 && IN.pitch > 0.3)) pitchCmd = 0.9;
      if (this.pitch > 0.12 && this.V > P.vr * 0.98) { this.setPhase('air'); this.pos.y += 0.05; this.thr = 0.85; this.syncAttFromEuler(); }
    } else if (this.phase === 'rollout') {
      thrTarget = 0.05;
      this.V = Math.max(0, this.V - (this.V > 25 ? 4.2 : 2.6) * dt);
      this.pitch = damp(this.pitch, 0, 3, dt);
      if (this.V < 1.5) { this.V = 0; this.setPhase('parked'); }
    }

    if (this.phase === 'air' || this.phase === 'approach') {
      this.syncEulerFromAtt();
      const manual = Math.abs(IN.pitch) > 0.05 || Math.abs(IN.roll) > 0.05;
      if (manual && auto) flightUi.set({ auto: false });
      if (manual && this.phase === 'approach' && (Math.abs(IN.pitch) > 0.4 || Math.abs(IN.roll) > 0.4)) this.setPhase('air');

      // ---------- guiado (pouso automático / voo livre) ----------
      let tgtHdg: number | null = null, tgtAlt: number | null = null;
      if (this.phase === 'approach') {
        const R = this.rw;
        const sNeed = (v: number) => clamp((v - P.vr * 0.9) / (P.vmax - P.vr * 0.9), 0, 1); // potência que sustenta a velocidade
        if (this.landStage === 'join') {
          const jx = R.thr + (this.joinFar ? 7000 : 3600), jz = R.z;
          tgtHdg = Math.atan2(-(jz - this.pos.z), jx - this.pos.x);
          tgtAlt = this.joinFar ? 480 : 330;
          const tv = Math.min(P.vapp * 2.5, P.vmax * 0.88);
          thrTarget = clamp(sNeed(tv) + (tv - this.V) * 0.03, 0.05, 1);
          if (Math.hypot(jx - this.pos.x, jz - this.pos.z) < 900) {
            if (Math.cos(wrapPi(this.yaw - Math.PI)) > 0.3) { this.landStage = 'final'; }
            else this.joinFar = !this.joinFar; // chegou de frente: dá a volta e alinha
          }
        } else {
          const e = this.pos.z - R.z;
          tgtHdg = Math.PI - clamp(e * 0.006, -0.6, 0.6);
          tgtAlt = Math.max(0, (this.pos.x - R.touch) * GS);
          const dThr = this.pos.x - R.thr, tv = P.vapp * (1 + clamp((dThr - 900) / 2400, 0, 0.55));
          thrTarget = clamp(sNeed(tv) + (tv - this.V) * 0.05, 0.02, 1);
          if (agl() < 320) this.gear = true;
          if (this.pos.x < R.end + 200) { this.landStage = 'join'; this.joinFar = true; } // arremetida
        }
      } else if (auto && !manual) {
        const w = SCENIC[this.wp % SCENIC.length];
        tgtHdg = Math.atan2(-(w[2] - this.pos.z), w[0] - this.pos.x);
        tgtAlt = w[1];
        if (Math.hypot(w[0] - this.pos.x, w[2] - this.pos.z) < 1200) this.wp++;
        thrTarget = 0.95;
        // acrobacias do voo livre: tonneaux e loopings intercalados, só com altura e asas niveladas
        this.nextManeuver -= dt;
        if (!this.maneuver && this.nextManeuver <= 0 && agl() > 500 && Math.abs(this.roll) < 0.25 && Math.abs(this.pitch) < 0.25) {
          const kind = (['roll', 'loop', 'roll', 'roll', 'loop'] as const)[this.manIdx++ % 5];
          this.maneuver = { kind, t: 0, dur: kind === 'roll' ? 2.6 : 6.4 };
        }
      }
      if (tgtHdg !== null && !this.maneuver) rollTarget = clamp(-wrapPi(tgtHdg - this.yaw) * 1.4, -0.55, 0.55);
      if (tgtAlt !== null && !this.maneuver) {
        const onFinal = this.phase === 'approach' && this.landStage === 'final';
        const flare = onFinal && agl() < 7;
        const ff = onFinal ? -this.V * GS : 0;
        const vsT = flare ? -1.5 : clamp(ff + (tgtAlt - agl()) * 0.3, -9, 11);
        const pitchT = Math.asin(clamp(vsT / Math.max(this.V, 20), -0.35, 0.4));
        this.nose = damp(this.nose, flare ? 0.07 : onFinal ? 0.03 : 0, 2, dt);
        pitchCmd = clamp((pitchT - this.pitch) * 3, -1, 1);
      }

      // ---------- atitude por taxas locais (quatérnio) ----------
      let pr = 0, rr = 0, yr = 0; // taxas em rad/s: arfagem (z local), rolagem (x local), guinada (y local)
      if (this.maneuver) {
        const m = this.maneuver; m.t += dt;
        if (m.kind === 'roll') rr = (Math.PI * 2) / m.dur; else pr = (Math.PI * 2) / m.dur;
        if (m.t >= m.dur) { this.maneuver = null; this.nextManeuver = 9 + Math.random() * 6; }
      } else if (manual) {
        // manche: quanto mais tempo segura, mais forte (rampa); sem limite de ângulo → looping e 360°
        IN.hold = Math.min(1, (IN.hold ?? 0) + dt * 1.6);
        const gain = 0.6 + 0.4 * IN.hold;
        pr = IN.pitch * 1.8 * gain;   // looping completo em ~3,5 s
        rr = IN.roll * 4.8 * gain;    // tonneau 360° em ~1,3 s
        yr = -IN.roll * 0.55;         // leme coordenado: a curva responde já no início
      } else {
        IN.hold = 0;
        if (rollTarget !== null) rr = clamp((rollTarget - this.roll) * 1.8, -1.2, 1.2);
        else if (Math.abs(this.roll) < 1.35) rr = -this.roll * 0.9; // nivela as asas
        if (tgtAlt !== null) pr = pitchCmd * 0.55;
        else if (Math.abs(this.pitch) < 1.2 && Math.abs(this.roll) < 1.35) pr = -this.pitch * 0.55; // nariz volta ao horizonte: não sobe sozinho
      }
      // perda de sustentação: abaixo de 0,8 Vr o nariz cai
      if (this.V < P.vr * 0.8) pr -= 0.6;
      this.qa.setFromAxisAngle(AX_Z, pr * dt); this.att.multiply(this.qa);
      this.qa.setFromAxisAngle(AX_X, rr * dt); this.att.multiply(this.qa);
      this.qa.setFromAxisAngle(AX_Y, yr * dt); this.att.multiply(this.qa);
      // curva por inclinação (eixo vertical do mundo), proporcional ao seno da inclinação e à velocidade
      this.syncEulerFromAtt();
      // curva arcade forte (não some em alta velocidade): inclinou, virou
      const bankTurn = -Math.sin(this.roll) * Math.cos(this.pitch) * (0.95 + 6 / Math.max(this.V, 30));
      this.qa.setFromAxisAngle(AX_Y, bankTurn * dt); this.att.premultiply(this.qa);
      this.att.normalize();
      this.syncEulerFromAtt();

      // ---------- acelerador e energia ----------
      if (IN.throttle !== 0) { this.thr = clamp(this.thr + IN.throttle * dt * 1.1, 0, 1); thrTarget = this.thr; }
      this.fwd.set(1, 0, 0).applyQuaternion(this.att);
      const vMin = P.vr * 0.9, vTop = P.vmax;
      const vT = vMin + (vTop - vMin) * this.spool;
      let acc = (vT - this.V) * (vT > this.V ? 0.34 : 0.26) - G * this.fwd.y * 0.75;
      if (IN.throttle > 0) acc += P.accel * 0.6 * (1 - this.V / (vTop * 1.12)); // empurrão do acelerador (sente a potência)
      if (IN.brake) acc -= 14; // freio aerodinâmico (spoilers)
      this.V = clamp(this.V + acc * dt, P.vr * 0.55, vTop * 1.12);
      // trem
      if (this.gear && agl() > 30 && this.phase === 'air' && this.fwd.y > -0.03) this.gear = false; // positivo de subida: recolhe
      if (!this.gear && agl() < 90 && this.V < P.vapp * 1.3 && this.fwd.y < 0.05) this.gear = true;
    } else if (onGround) {
      this.roll = damp(this.roll, 0, 4, dt);
      if (this.phase !== 'roll') this.pitch = damp(this.pitch, 0, 3, dt);
      else this.pitch = clamp(this.pitch + pitchCmd * 0.22 * dt, 0, 0.16);
      this.syncAttFromEuler();
    }
    onGround = this.phase === 'start' || this.phase === 'ready' || this.phase === 'roll' || this.phase === 'rollout' || this.phase === 'parked';
    this.thr = damp(this.thr, thrTarget, 2.5, dt);
    this.spool = damp(this.spool, this.thr, P.spoolK, dt);

    // ---------- integração ----------
    if (onGround) this.fwd.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    else this.fwd.set(1, 0, 0).applyQuaternion(this.att);
    this.pos.addScaledVector(this.fwd, this.V * dt);
    const ground = gy + this.axisH;
    if (this.pos.y <= ground && (onGround || this.fwd.y <= 0.02)) {
      const onRunway = this.onAnyRunway(this.pos.x, this.pos.z);
      this.pos.y = ground;
      if (this.phase === 'air' || this.phase === 'approach') {
        const vs = this.V * this.fwd.y; // m/s (negativo = descendo)
        const water = isWater(this.pos.x, this.pos.z);
        this.syncEulerFromAtt();
        const level = Math.abs(this.roll) < 0.3 && this.pitch > -0.12;
        if (water) this.crash('water');
        else if (!onRunway || vs < -7 || !level || this.V > P.vapp * 1.9) this.crash('ground');
        else {
          // pouso: nota pela razão de descida
          const fpm = Math.round(-vs * 196.85);
          flightUi.set({ landing: { fpm, grade: fpm < 180 ? 'perfect' : fpm < 420 ? 'good' : 'firm' } });
          this.gear = true; this.roll = 0; this.pitch = Math.max(0, this.pitch);
          this.setPhase('rollout');
        }
        if ((this.phase as Phase) === 'crashed') { this.writePose(c); this.writeCamera(dt, gy, portrait, seat); return; }
      }
    }
    if (this.pos.y > gy + 4500) { this.syncEulerFromAtt(); if (this.pitch > 0) { this.qa.setFromAxisAngle(AX_Z, -0.6 * dt); this.att.multiply(this.qa); } }

    this.writePose(c);
    // ---------- telemetria ----------
    TEL.speed = this.V; TEL.alt = Math.max(0, agl()); TEL.vs = this.V * this.fwd.y;
    TEL.hdg = ((((Math.PI / 2 - this.yaw) * 180) / Math.PI) % 360 + 360) % 360;
    TEL.spool = this.spool; TEL.throttle = this.thr; TEL.onGround = onGround; TEL.gear = this.gear;
    TEL.pitch = this.pitch; TEL.roll = this.roll;
    this.writeCamera(dt, gy, portrait, seat);
  }

  private writePose(c: FleetCraftBuild) {
    c.group.position.copy(this.pos);
    if (!(this.phase === 'approach' || this.phase === 'air')) this.nose *= 0.9;
    if (this.phase === 'air' || this.phase === 'approach' || this.phase === 'crashed') {
      c.group.quaternion.copy(this.att);
      if (Math.abs(this.nose) > 1e-3) { this.qa.setFromAxisAngle(AX_Z, this.nose); c.group.quaternion.multiply(this.qa); }
    } else { c.group.rotation.set(0, this.yaw, 0); c.group.rotateZ(this.pitch + this.nose); c.group.rotateX(this.roll); this.att.copy(c.group.quaternion); }
    c.group.visible = true;
    // trem: nariz recolhe para a frente, principais para dentro (em direção ao eixo)
    const gt = this.gear ? 1 : 0;
    this.gearK += clamp(gt - this.gearK, -this.lastDt / 3.2, this.lastDt / 3.2);
    const e = this.gearK * this.gearK * (3 - 2 * this.gearK), a = (1 - e) * Math.PI * 0.5;
    for (const L of this.gearLegs) {
      if (L.kind === 'nose') L.o.rotation.set(0, 0, a); else L.o.rotation.set(L.kind === 'R' ? a : -a, 0, 0);
      L.o.scale.setScalar(1 - (1 - e) * 0.25);
      L.o.visible = this.gearK > 0.03;
    }
    c.systems.trem.visible = this.gearLegs.length ? true : this.gear;
    this.updateLights(performance.now() / 1000);
    this.rotorAng += (1 / 60) * (this.perf.piston ? 4 + this.spool * 34 : 3 + this.spool * 46);
    for (const r of this.rotors) r.rotation.x = this.rotorAng;
  }

  private writeCamera(dt: number, gy: number, portrait: boolean, seat: number | null) {
    const c = this.craft!; const view = flightUi.get().view;
    const insideV = view === 'seat' || view === 'walk' || view === 'cockpit';
    const ql = performance.now() - IN.lookAt > 2600 && !insideV; // por dentro o olhar fica onde a pessoa deixou (360° livre)
    if (ql) { IN.lookYaw = damp(IN.lookYaw, 0, 1.4, dt); IN.lookPitch = damp(IN.lookPitch, 0, 1.4, dt); }
    const q = c.group.quaternion;
    this.upL.set(0, 1, 0).applyQuaternion(q);
    const s = FLEET_SPECS[this.id!];
    const inView = (view === 'seat' && seat !== null && !!c.seats[seat]) || view === 'walk'; // cabine = primeira pessoa limpa, por fora (sem painel)
    this.setInside(inView);
    const I = this.interior;
    if (inView && I) {
      // olhar 360°: arrastar gira a cabeça (guinada no eixo da aeronave, elevação limitada)
      const look = (eye: THREE.Vector3, dir: THREE.Vector3) => {
        this.qa.setFromAxisAngle(AX_Y, IN.lookYaw); dir.applyQuaternion(this.qa);
        const side = this.tmp2.set(-dir.z, 0, dir.x).normalize();
        this.qa.setFromAxisAngle(side, clamp(IN.lookPitch * 0.9, -0.9, 1.1)); dir.applyQuaternion(this.qa);
        this.tmp.copy(eye).applyQuaternion(q).add(c.group.position);
        this.eye.copy(this.tmp);
        this.target.copy(eye).addScaledVector(dir, 3).applyQuaternion(q).add(c.group.position);
        this.camUp.copy(this.upL); this.inside = true; this.camInit = true;
      };
      const seatEye = (i: number) => {
        return I.seats[i].eye.clone();
      };
      if (view === 'walk') {
        // primeira pessoa: levanta da poltrona (ou do assento do piloto) e caminha pelo corredor
        if (this.lastView !== 'walk') {
          this.walkPos.copy(seat !== null && I.seats[seat] ? seatEye(seat) : I.pilotEye); this.walkPos.z = 0; // levanta para o corredor
          const se = seat !== null ? I.seats[seat] : null;
          if (this.lastView === 'seat' && se) { const F0 = se.facing === 0 ? new THREE.Vector3(0, 0, -se.side) : new THREE.Vector3(se.facing, 0, 0); const d0 = se.win.clone().sub(se.eye); d0.y = 0; d0.normalize().multiplyScalar(0.93).addScaledVector(F0, 0.07); IN.lookYaw += Math.atan2(-d0.z, d0.x); }
          else if (this.lastView !== 'cockpit') IN.lookYaw = Math.PI;
        }
        const yawW = IN.lookYaw;
        const fwd = this.tmp.set(Math.cos(yawW), 0, -Math.sin(yawW)), rgt = this.tmp2.set(Math.sin(yawW), 0, Math.cos(yawW));
        this.walkPos.addScaledVector(fwd, IN.walkF * 1.25 * dt).addScaledVector(rgt, IN.walkS * 0.9 * dt);
        this.walkPos.y = damp(this.walkPos.y, I.walk.eyeY, 5, dt);
        const yNow = this.walkPos.y; I.walk.clamp(this.walkPos); this.walkPos.y = Math.min(yNow, this.walkPos.y); // nunca acima do teto
        // passada: leve balanço da cabeça
        const bob = (Math.abs(IN.walkF) + Math.abs(IN.walkS)) > 0.1 ? Math.sin(this.simT * 7.5) * 0.012 : 0;
        this.lastView = view;
        look(this.walkPos.clone().add(new THREE.Vector3(0, bob, 0)), new THREE.Vector3(1, -0.04, 0));
        if ((this.panelT += dt) > 0.08) { this.panelT = 0; I.updatePanel({ pitch: this.pitch, roll: this.roll, speed: this.V, alt: TEL.alt, hdg: TEL.hdg, vs: TEL.vs }); }
        return;
      }
      if (view !== this.lastView && this.lastView === 'walk') IN.lookYaw = 0; // de volta à poltrona: olhar padrão do lugar
      this.lastView = view;
      if (view === 'seat' && seat !== null && I.seats[seat]) {
        // poltrona escolhida na planta: olhos na altura de quem está sentado, olhando à frente e um pouco para a janela
        const se = I.seats[seat];
        const F = se.facing === 0 ? new THREE.Vector3(0, 0, -se.side) : new THREE.Vector3(se.facing, 0, 0);
        const eye = seatEye(seat);
        // olhar abre direto na janela ao lado (a vista é o ponto), com um pouco da cabine à frente
        // abre centrado na janela (já sentado, rosto na janela)
        const tw = se.win.clone().sub(eye); tw.y = 0; tw.normalize();
        const dir = tw.multiplyScalar(0.93).addScaledVector(F, 0.07); dir.y = -0.16; dir.normalize(); // nivelado: horizonte na janela
        look(eye, dir);
      } else {
        look(I.pilotEye.clone(), new THREE.Vector3(1, -0.13, 0.02).normalize());
      }
      if ((this.panelT += dt) > 0.08) { this.panelT = 0; I.updatePanel({ pitch: this.pitch, roll: this.roll, speed: this.V, alt: TEL.alt, hdg: TEL.hdg, vs: TEL.vs }); }
      return;
    }
    if (view === 'cockpit') {
      // primeira pessoa limpa: olhos sobre o nariz, só o céu, o mar e a proa (sem painel nem molduras)
      this.tmp.set(this.size * 0.5 - s.Ln * 0.95, s.R * 1.12 + 0.35, 0).applyQuaternion(q).add(c.group.position);
      this.tmp2.set(Math.cos(IN.lookYaw) * 60, -4 + Math.sin(IN.lookPitch) * 40, -Math.sin(IN.lookYaw) * 60).applyQuaternion(q).add(this.tmp);
      this.eye.copy(this.tmp); this.target.copy(this.tmp2); this.camUp.copy(this.upL); this.inside = false; this.camInit = true; this.lastView = view;
      return;
    }
    this.lastView = view;
    this.inside = false;
    // externa: atrás e acima, no referencial da aeronave quando ela manobra; nivelada em voo normal
    this.syncEulerFromAtt();
    const man = clamp(Math.max((Math.abs(this.pitch) - 0.5) / 0.6, (Math.abs(this.roll) - 0.9) / 0.6, this.maneuver ? 1 : 0), 0, 1);
    const d = (this.size * (portrait ? 2.3 : 1.85) + 8) * IN.zoom;
    const yawC = this.yaw + Math.PI + IN.lookYaw;
    const pc = clamp(0.2 + IN.lookPitch, -0.25, 1.25);
    this.tmp.set(Math.cos(yawC) * Math.cos(pc) * d, Math.sin(pc) * d + this.size * 0.12, -Math.sin(yawC) * Math.cos(pc) * d).add(c.group.position);
    if (man > 0) {
      // modo manobra: câmera presa à cauda, acompanha looping e tonneau
      this.fwd.set(1, 0, 0).applyQuaternion(q);
      this.tmp2.copy(c.group.position).addScaledVector(this.fwd, -d).addScaledVector(this.upL, d * 0.22);
      this.tmp.lerp(this.tmp2, man);
    }
    if (this.tmp.y < gy + 1.2) this.tmp.y = gy + 1.2;
    this.fwd.set(1, 0, 0).applyQuaternion(q);
    this.tmp2.copy(c.group.position).addScaledVector(this.fwd, this.size * 0.35);
    if (!this.camInit) { this.eye.copy(this.tmp); this.target.copy(this.tmp2); this.camInit = true; }
    const k = 1 - Math.exp(-(IN.lookAt && !ql ? 9 : 4.6 + man * 4) * dt);
    this.eye.lerp(this.tmp, k); this.target.lerp(this.tmp2, 1 - Math.exp(-10 * dt));
    this.tmp.set(0, 1, 0).lerp(this.upL, man * 0.85 + 0.12).normalize();
    this.camUp.lerp(this.tmp, 1 - Math.exp(-5 * dt)).normalize();
  }
}
