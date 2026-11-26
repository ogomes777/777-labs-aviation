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
    sim.step(dt, t, 0, false); maxAlt = Math.max(maxAlt, TEL.alt);
    if (i % 600 === 0) log('t' + t.toFixed(0));
  }
  const cruiseAlt = TEL.alt;
  IN.land = true;
  let parkedAt = -1;
  for (let i = 0; i < 60 * 600; i++) { t += dt; sim.step(dt, t, 0, false); if (i % 1200 === 0) log('L' + t.toFixed(0)); if (sim.phase === 'parked') { parkedAt = t; break; } }
  log('end');
  return { maxAlt, cruiseAlt, parkedAt, x: sim.pos.x, z: sim.pos.z };
}

describe('test drive: decolagem, voo livre e pouso automático', () => {
  for (const id of ['legacy-450', 'matrix', 'citation-cj2-plus'] as FleetId[]) {
    it(`${id} decola, sobe em voo livre e pousa na pista`, () => {
      const r = fly(id, id === 'legacy-450');
      expect(r.maxAlt).toBeGreaterThan(300);
      expect(r.parkedAt).toBeGreaterThan(0);
      expect(Math.abs(r.z - 122)).toBeLessThan(26); // dentro da largura da pista
      expect(r.x).toBeLessThan(80); expect(r.x).toBeGreaterThan(-1500);
    });
  }
});
