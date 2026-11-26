import * as THREE from 'three';
import type { FleetCraftBuild } from '../fleet/airframe';
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
  private t0 = 0; private wp = 0; private landStage: 'join' | 'final' = 'join';
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

  start(id: FleetId, craft: FleetCraftBuild, gy: number, time: number) {
    if (this.craft !== craft) { this.saved.pos.copy(craft.group.position); this.saved.rot.copy(craft.group.rotation); this.saved.vis = craft.group.visible; }
    this.id = id; this.craft = craft; this.perf = perfFor(id);
    this.axisH = craft.axisH; this.size = FLEET_SPECS[id].envelope.length;
    this.pos.set(RW_X0 - 30 - this.size * 0.5, gy + this.axisH, RW_Z);
    this.yaw = Math.PI; this.pitch = 0; this.roll = 0; this.V = 0; this.spool = 0; this.thr = 0; this.gear = true; this.nose = 0;
    this.syncAttFromEuler();
    this.setPhase('start'); this.t0 = time; this.wp = 0; this.camInit = false; this.maneuver = null; this.nextManeuver = 10; this.sinkY = 0;
    flightUi.set({ crash: null, landing: null });
    TEL.piston = this.perf.piston;
    this.rotors = [];
    craft.group.traverse((o) => { if (o.name === 'propeller' || o.name === 'fan') this.rotors.push(o); });
    this.rotorAng = 0;
  }
  stop() {
    const c = this.craft;
    this.rotors.forEach((r) => { r.rotation.x = 0; }); this.rotors = [];
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
    const P = this.perf;
    const auto = flightUi.get().auto;
    if (IN.restart) { IN.restart = false; this.start(this.id!, c, gy, time - 10); }
    const agl = () => this.pos.y - gy - this.axisH;
    let pitchCmd = 0, rollTarget: number | null = null, thrTarget = this.thr;

    // ---------- fases de solo ----------
    if (this.phase === 'start') { thrTarget = 0.12; if (time - this.t0 > (P.piston ? 2.2 : 3.6)) this.setPhase('ready'); }
    if (this.phase === 'ready') { thrTarget = 0.12; if (IN.takeoff || IN.pitch > 0.5 || IN.throttle > 0.5 || auto) { IN.takeoff = false; this.setPhase('roll'); } }
    if (this.phase === 'parked') { thrTarget = 0.1; this.V = damp(this.V, 0, 2, dt); if (IN.takeoff || IN.pitch > 0.5 || IN.throttle > 0.5) { IN.takeoff = false; this.setPhase('roll'); flightUi.set({ landing: null }); } }
    if (this.phase === 'crashed') {
      // destroços: afunda na água, fica caído no chão
      this.sinkY = Math.min(this.sinkY + dt * (flightUi.get().crash === 'water' ? 0.9 : 0), this.axisH + 2.5);
      c.group.position.set(this.pos.x, this.pos.y - this.sinkY, this.pos.z);
      this.writeCamera(dt, gy, portrait, seat);
      return;
    }
    if (IN.land && this.phase === 'air') { IN.land = false; this.syncEulerFromAtt(); this.landStage = this.pos.x > 2500 && Math.cos(wrapPi(this.yaw - Math.PI)) > 0.5 ? 'final' : 'join'; flightUi.set({ auto: false }); this.maneuver = null; this.setPhase('approach'); }
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
        const glide = Math.max(0, (this.pos.x - TOUCH_X) * GS);
        if (this.landStage === 'join') {
          const jx = 6200, jz = RW_Z;
          tgtHdg = Math.atan2(-(jz - this.pos.z), jx - this.pos.x);
          tgtAlt = Math.max(320, Math.min(600, (this.pos.x - TOUCH_X) * GS));
          thrTarget = clamp(0.35 + (P.vapp * 1.35 - this.V) * 0.05, 0.05, 1);
          if (Math.hypot(jx - this.pos.x, jz - this.pos.z) < 900) this.landStage = 'final';
        } else {
          const e = this.pos.z - RW_Z;
          tgtHdg = Math.PI - clamp(e * 0.006, -0.6, 0.6);
          tgtAlt = glide;
          thrTarget = clamp(0.3 + (P.vapp - this.V) * 0.06, 0.02, 1);
          if (agl() < 320) this.gear = true;
          if (this.pos.x < RW_X1 + 200) this.landStage = 'join';
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
      if (IN.throttle !== 0) { this.thr = clamp(this.thr + IN.throttle * dt * 0.6, 0, 1); thrTarget = this.thr; }
      this.fwd.set(1, 0, 0).applyQuaternion(this.att);
      const vMin = P.vr * 0.9, vTop = P.vmax;
      const vT = vMin + (vTop - vMin) * this.spool;
      let acc = (vT - this.V) * 0.22 - G * this.fwd.y * 0.75;
      if (IN.brake) acc -= 9; // freio aerodinâmico (spoilers)
      this.V = clamp(this.V + acc * dt, P.vr * 0.55, vTop * 1.12);
      // trem
      if (this.gear && agl() > 35 && this.phase === 'air' && this.fwd.y > 0) this.gear = false;
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
    c.systems.trem.visible = this.gear;
    this.rotorAng += (1 / 60) * (this.perf.piston ? 4 + this.spool * 34 : 3 + this.spool * 46);
    for (const r of this.rotors) r.rotation.x = this.rotorAng;
  }

  private writeCamera(dt: number, gy: number, portrait: boolean, seat: number | null) {
    const c = this.craft!; const view = flightUi.get().view;
    const ql = performance.now() - IN.lookAt > 2600;
    if (ql) { IN.lookYaw = damp(IN.lookYaw, 0, 1.4, dt); IN.lookPitch = damp(IN.lookPitch, 0, 1.4, dt); }
    const q = c.group.quaternion;
    this.upL.set(0, 1, 0).applyQuaternion(q);
    const s = FLEET_SPECS[this.id!];
    if (view === 'seat' && seat !== null && c.seats[seat]) {
      // vista da poltrona escolhida na planta: altura dos olhos, olhando para a janela do lado da poltrona
      const se = c.seats[seat];
      const side = Math.sign(se.pos.z) || 1;
      this.tmp.set(se.pos.x - se.facing * 0.15, c.floorY + (this.id === 'matrix' ? 0.9 : 1.1), se.pos.z * 0.85);
      this.tmp2.set(this.tmp.x + se.facing * 2.2 + Math.cos(IN.lookYaw) * 0, this.tmp.y - 0.12 + Math.sin(IN.lookPitch) * 1.5, this.tmp.z + side * 2.6 + Math.sin(IN.lookYaw) * 2.2);
      this.tmp.applyQuaternion(q).add(c.group.position); this.tmp2.applyQuaternion(q).add(c.group.position);
      this.eye.copy(this.tmp); this.target.copy(this.tmp2); this.camUp.copy(this.upL); this.inside = true; this.camInit = true;
      return;
    }
    if (view === 'cockpit') {
      this.tmp.set(this.size * 0.5 - s.Ln * 0.95, s.R * 1.12 + 0.35, 0).applyQuaternion(q).add(c.group.position);
      this.tmp2.set(Math.cos(IN.lookYaw) * 60, -4 + Math.sin(IN.lookPitch) * 40, -Math.sin(IN.lookYaw) * 60).applyQuaternion(q).add(this.tmp);
      this.eye.copy(this.tmp); this.target.copy(this.tmp2); this.camUp.copy(this.upL); this.inside = false; this.camInit = true;
      return;
    }
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
