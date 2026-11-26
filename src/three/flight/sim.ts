import * as THREE from 'three';
import type { FleetCraftBuild } from '../fleet/airframe';
import { FLEET_SPECS } from '../fleet/specs';
import type { FleetId } from '@/content/fleet';
import { flightInput as IN, flightTel as TEL, flightUi } from '@/experience/flight';

/**
 * Test drive — dinâmica de voo simplificada (crível, não certificada) e piloto automático.
 * Convenções do gerador: nariz em +x local, +z local = asa direita; yaw = π aponta o nariz para −x
 * (direção de decolagem da pista 27 do aeródromo da Frota). Rolagem positiva = asa direita baixa.
 * Velocidades são visuais por classe de aeronave (rotulado na interface como simulação ilustrativa).
 */
const G = 9.81;
const RW_Z = 122, RW_X0 = 60, RW_X1 = -1400, RW_HALF = 26;
const TOUCH_X = -230, GS = Math.tan(THREE.MathUtils.degToRad(3));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface Perf { vr: number; vapp: number; vcruise: number; vmax: number; accel: number; spoolK: number; piston: boolean }
function perfFor(id: FleetId): Perf {
  if (id === 'matrix') return { vr: 36, vapp: 42, vcruise: 78, vmax: 95, accel: 4.2, spoolK: 2.4, piston: true };
  if (id === 'citation-cj2-plus') return { vr: 52, vapp: 58, vcruise: 128, vmax: 160, accel: 5.8, spoolK: 1.2, piston: false };
  return { vr: 58, vapp: 64, vcruise: 145, vmax: 180, accel: 6.2, spoolK: 1.1, piston: false };
}
// rota cênica do voo livre: sobe sobre a costa, cruza o mar acima das nuvens, desce e retorna
const SCENIC: [number, number, number][] = [[-5200, 650, 1400], [-7600, 1500, 7200], [-1500, 1650, 10500], [6800, 1250, 7600], [8200, 900, 900], [3600, 700, -3600], [-2600, 1100, -3000]];

export class FlightSim {
  id: FleetId | null = null;
  craft: FleetCraftBuild | null = null;
  private saved = { pos: new THREE.Vector3(), rot: new THREE.Euler(), vis: true };
  pos = new THREE.Vector3();
  yaw = Math.PI; pitch = 0; roll = 0; V = 0; spool = 0; thr = 0; gear = true;
  /** atitude visual extra (nariz alto na aproximação/arredondamento) — não altera a trajetória */
  nose = 0;
  phase: 'start' | 'ready' | 'roll' | 'air' | 'approach' | 'rollout' | 'parked' = 'start';
  private t0 = 0; private wp = 0; private landStage: 'join' | 'final' = 'join';
  private perf: Perf = perfFor('legacy-450');
  get vmax() { return this.perf.vmax; }
  private axisH = 2; private size = 20;
  eye = new THREE.Vector3(); target = new THREE.Vector3();
  private camInit = false;
  private fwd = new THREE.Vector3(); private up = new THREE.Vector3(); private tmp = new THREE.Vector3(); private tmp2 = new THREE.Vector3();
  private q = new THREE.Quaternion();

  start(id: FleetId, craft: FleetCraftBuild, gy: number, time: number) {
    this.id = id; this.craft = craft; this.perf = perfFor(id);
    this.axisH = craft.axisH; this.size = FLEET_SPECS[id].envelope.length;
    this.saved.pos.copy(craft.group.position); this.saved.rot.copy(craft.group.rotation); this.saved.vis = craft.group.visible;
    this.pos.set(RW_X0 - 30 - this.size * 0.5, gy + this.axisH, RW_Z);
    this.yaw = Math.PI; this.pitch = 0; this.roll = 0; this.V = 0; this.spool = 0; this.thr = 0; this.gear = true;
    this.setPhase('start'); this.t0 = time; this.wp = 0; this.camInit = false;
    TEL.piston = this.perf.piston;
  }
  stop() {
    const c = this.craft;
    if (c) { c.group.position.copy(this.saved.pos); c.group.rotation.copy(this.saved.rot); c.group.visible = this.saved.vis; c.systems.trem.visible = true; }
    this.craft = null; this.id = null;
  }
  private setPhase(p: FlightSim['phase']) { if (this.phase !== p) { this.phase = p; flightUi.set({ phase: p }); } }

  /** um passo da simulação; retorna nada — escreve pose, câmera e telemetria */
  step(dt: number, time: number, gy: number, portrait: boolean) {
    const c = this.craft; if (!c) return;
    const P = this.perf;
    const auto = flightUi.get().auto;
    if (IN.restart) { IN.restart = false; this.start(this.id!, c, gy, time); }
    const agl = () => this.pos.y - gy - this.axisH;
    let pitchCmd = 0, rollTarget: number | null = null, thrTarget = this.thr;

    // ---------- fases ----------
    if (this.phase === 'start') { thrTarget = 0.12; if (time - this.t0 > (P.piston ? 2.2 : 3.6)) this.setPhase('ready'); }
    if (this.phase === 'ready') { thrTarget = 0.12; if (IN.takeoff || IN.pitch > 0.5 || IN.throttle > 0.5 || auto) { IN.takeoff = false; this.setPhase('roll'); } }
    if (this.phase === 'parked') { thrTarget = 0.1; this.V = damp(this.V, 0, 2, dt); if (IN.takeoff || IN.pitch > 0.5) { IN.takeoff = false; this.start(this.id!, c, gy, time - 10); this.setPhase('roll'); } }
    if (IN.land && (this.phase === 'air')) { IN.land = false; this.landStage = this.pos.x > 2500 && Math.cos(wrapPi(this.yaw - Math.PI)) > 0.5 ? 'final' : 'join'; flightUi.set({ auto: false }); this.setPhase('approach'); }
    IN.land = false;

    let onGround = this.phase === 'start' || this.phase === 'ready' || this.phase === 'roll' || this.phase === 'rollout' || this.phase === 'parked';

    if (this.phase === 'roll') {
      thrTarget = 1;
      this.V += P.accel * this.spool * dt;
      // rotação automática em Vr (ou antes, se o piloto puxar depois de 85% de Vr)
      if (this.V > P.vr || (this.V > P.vr * 0.85 && IN.pitch > 0.3)) pitchCmd = 0.9;
      if (this.pitch > 0.12 && this.V > P.vr * 0.98) { this.setPhase('air'); this.pos.y += 0.05; }
    } else if (this.phase === 'rollout') {
      thrTarget = 0.05;
      this.V = Math.max(0, this.V - (this.V > 25 ? 4.2 : 2.6) * dt); // freios + reversores
      this.pitch = damp(this.pitch, 0, 3, dt);
      if (this.V < 1.5) { this.V = 0; this.setPhase('parked'); }
    }

    if (this.phase === 'air' || this.phase === 'approach') {
      // ---------- comandos: piloto, voo livre ou pouso automático ----------
      let tgtHdg: number | null = null, tgtAlt: number | null = null, tgtV = P.vcruise * (0.55 + 0.45 * this.thr);
      if (this.phase === 'approach') {
        const glide = Math.max(0, (this.pos.x - TOUCH_X) * GS);
        if (this.landStage === 'join') {
          const jx = 6200, jz = RW_Z;
          tgtHdg = Math.atan2(-(jz - this.pos.z), jx - this.pos.x);
          tgtAlt = Math.max(320, Math.min(600, (this.pos.x - TOUCH_X) * GS));
          tgtV = P.vapp * 1.35;
          if (Math.hypot(jx - this.pos.x, jz - this.pos.z) < 900) this.landStage = 'final';
        } else {
          const e = this.pos.z - RW_Z;
          tgtHdg = Math.PI - clamp(e * 0.006, -0.6, 0.6);
          tgtAlt = glide;
          tgtV = P.vapp;
          if (agl() < 320) this.gear = true;
          if (this.pos.x < RW_X1 + 200) { this.landStage = 'join'; } // arremetida: passou do fim da pista
        }
        thrTarget = clamp(0.35 + (tgtV - this.V) * 0.06, 0.05, 1);
      } else if (auto) {
        const w = SCENIC[this.wp % SCENIC.length];
        tgtHdg = Math.atan2(-(w[2] - this.pos.z), w[0] - this.pos.x);
        tgtAlt = w[1];
        if (Math.hypot(w[0] - this.pos.x, w[2] - this.pos.z) < 1200) this.wp++;
        thrTarget = 0.78;
      }
      if (tgtHdg !== null) {
        // yaw é "rumo matemático" (forward = cos yaw, −sin yaw): erro positivo = virar à esquerda
        const err = wrapPi(tgtHdg - this.yaw);
        rollTarget = clamp(-err * 1.4, -0.5, 0.5);
      }
      if (tgtAlt !== null) {
        const flare = this.phase === 'approach' && this.landStage === 'final' && agl() < 7;
        const onFinal = this.phase === 'approach' && this.landStage === 'final';
        const ff = onFinal ? -this.V * GS : 0; // descida da rampa de 3° (antecipação)
        const vsT = flare ? -1.5 : clamp(ff + (tgtAlt - agl()) * 0.3, -9, 11);
        const pitchT = Math.asin(clamp(vsT / Math.max(this.V, 20), -0.35, 0.4));
        this.nose = damp(this.nose, flare ? 0.07 : onFinal ? 0.03 : 0, 2, dt);
        pitchCmd = clamp((pitchT - this.pitch) * 3, -1, 1);
      }
      // piloto humano sempre pode intervir (desliga o voo livre)
      if (Math.abs(IN.pitch) > 0.05 || Math.abs(IN.roll) > 0.05) {
        if (auto) flightUi.set({ auto: false });
        if (this.phase === 'approach' && (Math.abs(IN.pitch) > 0.4 || Math.abs(IN.roll) > 0.4)) this.setPhase('air');
        pitchCmd = IN.pitch; rollTarget = null;
      }
      if (IN.throttle !== 0) thrTarget = clamp(this.thr + IN.throttle * dt * 0.6, 0.1, 1);
      else if (this.phase === 'air' && !auto) thrTarget = Math.max(this.thr, 0.62);

      // ---------- atitude ----------
      this.pitch = clamp(this.pitch + pitchCmd * 0.55 * dt, -0.38, 0.42);
      if (rollTarget !== null) this.roll = damp(this.roll, rollTarget, 1.6, dt);
      else if (Math.abs(IN.roll) > 0.05) this.roll = clamp(this.roll + IN.roll * 1.25 * dt, -1.0, 1.0);
      else this.roll = damp(this.roll, 0, 0.7, dt); // nivelamento automático
      this.yaw += (-G * Math.tan(this.roll) / Math.max(this.V, 30)) * dt;

      // ---------- energia ----------
      const vT = P.vcruise * 0.42 + (P.vmax - P.vcruise * 0.42) * this.spool;
      this.V += ((vT - this.V) * 0.16 - G * Math.sin(this.pitch) * 0.55) * dt;
      // perda de sustentação: abaixo de 0,85 Vr o nariz cai sozinho
      if (this.V < P.vr * 0.85) this.pitch = damp(this.pitch, -0.12, 1.2, dt);
      this.V = clamp(this.V, P.vr * 0.6, P.vmax * 1.05);
      // trem: recolhe após a decolagem, baixa automaticamente em aproximação baixa e lenta
      if (this.gear && agl() > 35 && this.phase === 'air' && this.pitch > 0) this.gear = false;
      if (!this.gear && agl() < 120 && this.V < P.vapp * 1.25 && this.pitch < 0.05) this.gear = true;
    } else if (onGround) {
      this.roll = damp(this.roll, 0, 4, dt);
      if (this.phase !== 'roll') this.pitch = damp(this.pitch, 0, 3, dt);
      else this.pitch = clamp(this.pitch + pitchCmd * 0.22 * dt, 0, 0.16);
    }
    onGround = this.phase === 'start' || this.phase === 'ready' || this.phase === 'roll' || this.phase === 'rollout' || this.phase === 'parked';
    this.thr = damp(this.thr, thrTarget, 2.5, dt);
    this.spool = damp(this.spool, this.thr, P.spoolK, dt);

    // ---------- integração ----------
    const cp = Math.cos(this.pitch);
    this.fwd.set(Math.cos(this.yaw) * cp, Math.sin(this.pitch), -Math.sin(this.yaw) * cp);
    if (onGround) this.fwd.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.pos.addScaledVector(this.fwd, this.V * dt);
    const ground = gy + this.axisH;
    if (this.pos.y <= ground && (onGround || this.fwd.y <= 0)) {
      const onRunway = this.pos.x < RW_X0 + 40 && this.pos.x > RW_X1 - 100 && Math.abs(this.pos.z - RW_Z) < RW_HALF;
      this.pos.y = ground;
      if (this.phase === 'air' || this.phase === 'approach') {
        // toque: na pista (ou campo plano) vira corrida de pouso; trem sempre baixa antes
        this.gear = true; this.roll = 0;
        if (this.pitch > 0.02 || onRunway) { this.pitch = Math.max(0, this.pitch); this.setPhase('rollout'); }
        else { this.pitch = 0.08; this.pos.y = ground + 0.5; }
      }
    }
    // limites do mundo: teto e raio (volta suavemente)
    if (this.pos.y > gy + 3200) this.pitch = Math.min(this.pitch, 0);

    // ---------- pose ----------
    c.group.position.copy(this.pos);
    if (!(this.phase === 'approach' || this.phase === 'air')) this.nose = damp(this.nose, 0, 3, dt);
    c.group.rotation.set(0, this.yaw, 0); c.group.rotateZ(this.pitch + this.nose); c.group.rotateX(this.roll);
    c.group.visible = true;
    c.systems.trem.visible = this.gear;

    // ---------- telemetria ----------
    TEL.speed = this.V; TEL.alt = Math.max(0, agl()); TEL.vs = this.V * Math.sin(this.pitch);
    TEL.hdg = ((((Math.PI / 2 - this.yaw) * 180) / Math.PI) % 360 + 360) % 360 + 0; // 0 = norte (−z)
    TEL.spool = this.spool; TEL.throttle = this.thr; TEL.onGround = onGround; TEL.gear = this.gear;

    // ---------- câmera ----------
    const view = flightUi.get().view;
    const ql = performance.now() - IN.lookAt > 2600;
    if (ql) { IN.lookYaw = damp(IN.lookYaw, 0, 1.4, dt); IN.lookPitch = damp(IN.lookPitch, 0, 1.4, dt); }
    this.q.setFromEuler(c.group.rotation);
    if (view === 'cockpit') {
      const s = FLEET_SPECS[this.id!];
      this.tmp.set(this.size * 0.5 - s.Ln * 0.95, s.R * 1.12 + 0.35, 0).applyQuaternion(this.q).add(this.pos);
      this.tmp2.set(Math.cos(IN.lookYaw) * 60, -4 + Math.sin(IN.lookPitch) * 40, -Math.sin(IN.lookYaw) * 60).applyQuaternion(this.q).add(this.tmp);
      this.eye.copy(this.tmp); this.target.copy(this.tmp2); this.camInit = true;
    } else {
      const d = this.size * (portrait ? 2.3 : 1.85) + 8;
      const yawC = this.yaw + Math.PI + IN.lookYaw;
      const pc = clamp(0.2 + IN.lookPitch, -0.25, 1.25);
      // a câmera segue a proa (sem rolagem) para o horizonte ficar estável
      this.tmp.set(Math.cos(yawC) * Math.cos(pc) * d, Math.sin(pc) * d + this.size * 0.12, -Math.sin(yawC) * Math.cos(pc) * d).add(this.pos);
      if (this.tmp.y < gy + 1.2) this.tmp.y = gy + 1.2;
      this.up.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.tmp2.copy(this.pos).addScaledVector(this.up, this.size * 0.35);
      if (!this.camInit) { this.eye.copy(this.tmp); this.target.copy(this.tmp2); this.camInit = true; }
      const k = 1 - Math.exp(-(IN.lookAt && !ql ? 9 : 4.2) * dt);
      this.eye.lerp(this.tmp, k); this.target.lerp(this.tmp2, 1 - Math.exp(-10 * dt));
    }
  }
}
