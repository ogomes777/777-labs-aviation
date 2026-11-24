import * as THREE from 'three';

/**
 * Desmontagem/montagem coreografada: cada componente tem um vetor de deslocamento, uma janela de tempo
 * escalonada e um leve giro. Progresso 0 = montado, 1 = desmontado. Totalmente reversível.
 */
export interface InspectEntry { part: string; obj: THREE.Object3D; base: THREE.Vector3; baseRot: THREE.Euler; off: THREE.Vector3; w: [number, number]; spin: number }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function jetEntries(group: THREE.Group, turboprop: boolean): InspectEntry[] {
  const out: InspectEntry[] = [];
  const add = (part: string, obj: THREE.Object3D | undefined, off: THREE.Vector3, w: [number, number], spin = 0) => {
    if (!obj) return;
    out.push({ part, obj, base: obj.position.clone(), baseRot: obj.rotation.clone(), off, w, spin });
  };
  const by = (name: string) => group.getObjectByName(name);
  add('cabine', by('cabine'), V(0, 4.6, 0), [0.0, 0.42]);
  add('para-brisa', by('windshield'), V(1.2, 1.8, 0), [0.08, 0.48], 0.2);
  group.getObjectByName('asas')?.children.forEach((w) => add('asas', w, V(0, -0.9, (w.name.endsWith('--1') ? -1 : 1) * 6.4), [0.14, 0.62]));
  add('carenagem', by('fairing'), V(0, turboprop ? 2.4 : -2.4, 0), [0.2, 0.6]);
  const motores = group.getObjectByName('motores');
  motores?.children.forEach((c) => {
    if (c.type === 'Group') {
      const side = Math.sign(c.position.z) || 1;
      add(turboprop ? 'nacela' : 'pilone', c, V(turboprop ? 0 : 0, turboprop ? -1.8 : 1.8, side * (turboprop ? 1.2 : 4.4)), [0.24, 0.7]);
      c.children.forEach((m) => {
        if (m.name === 'lip') add('entrada', m, V(2.1, 0, 0), [0.56, 0.94]);
        if (m.name === 'rotor') add(turboprop ? 'helice' : 'fan', m, V(turboprop ? 1.8 : 1.5, 0, 0), [0.6, 0.96], 0.6);
        if (m.name === 'fan-disc') add('fan', m, V(1.1, 0, 0), [0.6, 0.96]);
        if (m.name === 'exhaust-cone') add('escape', m, V(-1.9, 0, 0), [0.58, 0.95]);
        if (m.name === 'spinner-cap') add('helice', m, V(2.3, 0, 0), [0.62, 0.98]);
      });
    } else if (c.name === 'pylon') { const g = (c as THREE.Mesh).geometry; g.computeBoundingSphere(); add('pilone', c, V(0, 0.9, Math.sign(g.boundingSphere!.center.z || 1) * 2.0), [0.3, 0.72]); }
  });
  add('deriva', by('fin'), V(-2.6, 4.0, 0), [0.34, 0.8], 0.05);
  add('estabilizador', by('stab'), V(-3.4, 6.0, 0), [0.4, 0.86], 0.1);
  group.getObjectByName('trem')?.children.forEach((g) => add('trem', g, V(0, -2.8, 0), [0.46, 0.92]));
  return out;
}

export function heliEntries(group: THREE.Group): InspectEntry[] {
  const out: InspectEntry[] = [];
  const add = (part: string, name: string, off: THREE.Vector3, w: [number, number], spin = 0) => {
    const obj = group.getObjectByName(name); if (!obj) return;
    out.push({ part, obj, base: obj.position.clone(), baseRot: obj.rotation.clone(), off, w, spin });
  };
  add('rotor', 'rotor-main', V(0, 3.4, 0), [0, 0.5], 0.4);
  add('mastro', 'mast', V(0, 2.1, 0), [0.14, 0.6]);
  add('carenagem', 'cowling', V(0, 1.3, 0), [0.22, 0.66]);
  add('rotor-cauda', 'tail-rotor', V(-1.4, 0.2, 1.8), [0.3, 0.76], 0.5);
  add('empenagem', 'tail-fin', V(-1.2, 1.6, 0), [0.36, 0.82]);
  add('empenagem', 'tail-stab', V(-1.6, 2.2, 0), [0.4, 0.86]);
  add('esquis', 'skids', V(0, -1.9, 0), [0.44, 0.9]);
  add('para-brisa', 'windshield', V(1.6, 0.5, 0), [0.5, 0.95], 0.1);
  return out;
}

export function applyInspect(entries: InspectEntry[], p: number, focus: string | null, time: number) {
  for (const e of entries) {
    const k = ease(Math.min(1, Math.max(0, (p - e.w[0]) / (e.w[1] - e.w[0]))));
    const hl = focus === e.part ? (0.14 + 0.04 * Math.sin(time * 3)) * k : 0;
    e.obj.position.copy(e.base).addScaledVector(e.off, k + hl);
    e.obj.rotation.set(e.baseRot.x, e.baseRot.y + e.spin * k, e.baseRot.z);
  }
}
