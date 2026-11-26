import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FlightSim } from '@/three/flight/sim';
import { flightInput as IN, flightTel as TEL, flightUi, resetFlightInput } from '@/experience/flight';
import type { FleetId } from '@/content/fleet';

function fly(id: FleetId, verbose = false) {
  resetFlightInput(); flightUi.set({ auto: false, phase: 'start' });
  const craft = { group: new THREE.Group(), axisH: 2.2, systems: { trem: new THREE.Group() } } as never;
  const sim = new FlightSim(); sim.start(id, craft, 0, 0);
  let t = 0, maxAlt = 0; const dt = 1 / 60;
  const log = (l: string) => verbose && console.log(l, sim.phase, 'V', sim.V.toFixed(1), 'alt', TEL.alt.toFixed(0), 'p', sim.pitch.toFixed(2), 'x', sim.pos.x.toFixed(0), 'z', sim.pos.z.toFixed(0), 'yaw', sim.yaw.toFixed(2));
  for (let i = 0; i < 60 * 150; i++) {
    t += dt;
    if (i === 60 * 5) IN.takeoff = true;
    if (i === 60 * 50) flightUi.set({ auto: true });
    sim.step(dt, t, 0, false, null); maxAlt = Math.max(maxAlt, TEL.alt);
    if (i % 600 === 0) log('t' + t.toFixed(0));
  }
  const cruiseAlt = TEL.alt;
  IN.land = true;
  let parkedAt = -1;
  for (let i = 0; i < 60 * 600; i++) { t += dt; sim.step(dt, t, 0, false, null); if (i % 1200 === 0) log('L' + t.toFixed(0)); if (sim.phase === 'parked') { parkedAt = t; break; } }
  log('end');
  return { maxAlt, cruiseAlt, parkedAt, x: sim.pos.x, z: sim.pos.z };
}

describe('test drive: decolagem, voo livre e pouso automático', () => {
  for (const id of ['legacy-450', 'matrix', 'citation-cj2-plus'] as FleetId[]) {
    it(`${id} decola, sobe em voo livre e pousa na pista`, () => {
      const r = fly(id, id === 'legacy-450');
      expect(r.maxAlt).toBeGreaterThan(300);
      expect(r.parkedAt).toBeGreaterThan(0);
      // pousa na pista mais próxima: aeródromo da Frota (z 122) ou ilha (z 600)
      const main = Math.abs(r.z - 122) < 26 && r.x < 80 && r.x > -1500;
      const island = Math.abs(r.z - 600) < 26 && r.x < -9050 && r.x > -10480;
      expect(main || island).toBe(true);
    });
  }
});

describe('test drive: controles V8', () => {
  const setup = () => {
    resetFlightInput(); flightUi.set({ auto: false, phase: 'start', crash: null, landing: null });
    const craft = { group: new THREE.Group(), axisH: 2.2, systems: { trem: new THREE.Group() }, seats: [], floorY: 0 } as never;
    const sim = new FlightSim(); sim.start('legacy-450', craft, 0, 0);
    let t = 0; const dt = 1 / 60;
    const run = (secs: number, f?: (i: number) => void) => { for (let i = 0; i < secs * 60; i++) { t += dt; f?.(i); sim.step(dt, t, 0, false, null); } };
    run(6); IN.takeoff = true; run(35); // decola e sobe
    return { sim, run };
  };
  it('sem comando o nariz volta ao horizonte (não sobe sozinho)', () => {
    const { sim, run } = setup();
    run(20);
    const a0 = TEL.alt; run(20);
    expect(Math.abs(TEL.alt - a0)).toBeLessThan(120);
    expect(Math.abs(sim.pitch)).toBeLessThan(0.08);
  });
  it('segurando W faz um looping completo (passa invertido)', () => {
    const { sim, run } = setup();
    run(10); // ganha altura/velocidade
    let inverted = false;
    IN.pitch = 1; run(9, () => { const up = new THREE.Vector3(0, 1, 0).applyQuaternion(sim.att); if (up.y < -0.5) inverted = true; }); IN.pitch = 0;
    expect(inverted).toBe(true);
    expect(sim.phase).toBe('air');
  });
  it('acelerador para baixo reduz a velocidade e o freio reduz mais', () => {
    const { sim, run } = setup();
    const v0 = sim.V; IN.throttle = -1; run(8); IN.throttle = 0;
    expect(sim.V).toBeLessThan(v0 - 15);
    const v1 = sim.V; IN.brake = true; run(2); IN.brake = false;
    expect(sim.V).toBeLessThan(v1);
  });
  it('mergulhar no mar termina em queda na água', () => {
    const { sim, run } = setup();
    // vira para o mar (oeste/−x já é o rumo de decolagem; a costa fica a ~4 km) e mergulha
    run(30);
    IN.pitch = -1; run(3); IN.pitch = 0;
    run(60);
    expect(sim.phase).toBe('crashed');
    expect(flightUi.get().crash).toBe('water');
  });
});
