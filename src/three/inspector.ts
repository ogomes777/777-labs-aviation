import * as THREE from 'three';

/**
 * Desmontagem/montagem coreografada: cada componente tem um vetor de deslocamento, uma janela de tempo
 * escalonada e um leve giro. Progresso 0 = montado, 1 = desmontado. Totalmente reversível.
 */
export interface InspectEntry { part: string; obj: THREE.Object3D; base: THREE.Vector3; baseRot: THREE.Euler; off: THREE.Vector3; w: [number, number]; spin: number }
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function applyInspect(entries: InspectEntry[], p: number, focus: string | null, time: number) {
  for (const e of entries) {
    const k = ease(Math.min(1, Math.max(0, (p - e.w[0]) / (e.w[1] - e.w[0]))));
    const hl = focus === e.part ? (0.14 + 0.04 * Math.sin(time * 3)) * k : 0;
    e.obj.position.copy(e.base).addScaledVector(e.off, k + hl);
    e.obj.rotation.set(e.baseRot.x, e.baseRot.y + e.spin * k, e.baseRot.z);
  }
}
