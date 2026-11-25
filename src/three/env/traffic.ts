import * as THREE from 'three';

/**
 * Tráfego de fundo: jatos e helicópteros distantes cruzando o céu em profundidades diferentes,
 * dando a sensação contínua de viagem. Geometria leve (low-poly), sem textura.
 */
export function createTraffic() {
  const group = new THREE.Group(); group.name = 'traffic';
  const D: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { D.push(o); return o; };
  const mat = T(new THREE.MeshStandardMaterial({ color: '#e9e6e0', roughness: 0.35, metalness: 0.2 }));
  const dark = T(new THREE.MeshStandardMaterial({ color: '#59606a', roughness: 0.5, metalness: 0.3 }));
  const discMat = T(new THREE.MeshBasicMaterial({ color: '#444a52', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  const jet = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(T(new THREE.CapsuleGeometry(1.1, 14, 6, 14)), mat); body.rotation.z = Math.PI / 2; g.add(body);
    const wingShape = new THREE.Shape(); wingShape.moveTo(2, 0); wingShape.lineTo(-3, 12); wingShape.lineTo(-5, 12); wingShape.lineTo(-3, 0); wingShape.lineTo(-3, -12); wingShape.lineTo(-5, -12); wingShape.lineTo(-3, 0); wingShape.closePath();
    const w = new THREE.Mesh(T(new THREE.ExtrudeGeometry(wingShape, { depth: 0.25, bevelEnabled: false })), mat); w.rotation.x = Math.PI / 2; w.position.y = -0.6; g.add(w);
    const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(-3, 4.2); finShape.lineTo(-4.6, 4.2); finShape.lineTo(-3.6, 0); finShape.closePath();
    const fin = new THREE.Mesh(T(new THREE.ExtrudeGeometry(finShape, { depth: 0.2, bevelEnabled: false })), mat); fin.position.set(-5, 0.6, -0.1); g.add(fin);
    for (const z of [-1.9, 1.9]) { const e = new THREE.Mesh(T(new THREE.CylinderGeometry(0.55, 0.45, 3, 10)), dark); e.rotation.z = Math.PI / 2; e.position.set(-4.5, 0.6, z); g.add(e); }
    return { g, rotors: [] as THREE.Object3D[] };
  };
  const heli = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(T(new THREE.SphereGeometry(1.4, 16, 12)), mat); body.scale.set(1.6, 1, 1); g.add(body);
    const boom = new THREE.Mesh(T(new THREE.CylinderGeometry(0.18, 0.4, 6.5, 8)), mat); boom.rotation.z = Math.PI / 2; boom.position.set(-4.8, 0.4, 0); g.add(boom);
    const rotor = new THREE.Group(); rotor.position.y = 1.7; g.add(rotor);
    const disc = new THREE.Mesh(T(new THREE.CircleGeometry(5.6, 40)), discMat); disc.rotation.x = -Math.PI / 2; rotor.add(disc);
    const blade = new THREE.Mesh(T(new THREE.BoxGeometry(11, 0.06, 0.3)), dark); rotor.add(blade);
    const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
    return { g, rotors: [rotor] };
  };
  // trajetórias: [tipo, z, y, direção, velocidade m/s, fase, escala]
  const paths: [('jet' | 'heli'), number, number, 1 | -1, number, number, number][] = [
    ['jet', -520, 40, 1, 90, 0.1, 1], ['jet', -900, 120, -1, 110, 0.55, 1.2], ['heli', -260, -6, -1, 45, 0.3, 1],
    ['jet', 420, 70, -1, 95, 0.8, 1], ['heli', 300, 12, 1, 40, 0.65, 1], ['jet', -1300, 210, 1, 130, 0.35, 1.4],
  ];
  const actors = paths.map(([kind, z, y, dir, speed, phase, scale]) => {
    const a = kind === 'jet' ? jet() : heli();
    a.g.scale.setScalar(scale);
    a.g.rotation.y = dir === 1 ? 0 : Math.PI;
    group.add(a.g);
    return { ...a, z, y, dir, speed, phase, span: 2600 };
  });
  const wp = new THREE.Vector3(), wr = new THREE.Vector3(), wu = new THREE.Vector3(), wf = new THREE.Vector3();
  let windowEpoch = -1, windowLast = -1;
  return {
    group,
    update: (time: number, px: number, py: number) => {
      for (const a of actors) {
        a.g.visible = true;
        const u = ((time * a.speed) / a.span + a.phase) % 1;
        a.g.position.set(a.dir * (u * a.span - a.span / 2) + px * (a.z < 0 ? 18 : -18), a.y + py * 6 + Math.sin(time * 0.3 + a.phase * 9) * 2, a.z);
        a.g.rotation.z = Math.sin(time * 0.4 + a.phase * 5) * 0.03;
        a.rotors.forEach((r) => { r.rotation.y = time * 22; });
      }
    },
    windowPass(cam: THREE.Camera, p: number, time: number) {
      cam.updateMatrixWorld(true); cam.getWorldDirection(wf); wr.setFromMatrixColumn(cam.matrixWorld,0); wu.setFromMatrixColumn(cam.matrixWorld,1);
      // Two existing distant actors, no new geometry; motion follows the same scroll.
      actors.forEach((a,i)=>{ a.g.visible = i===2; if(!a.g.visible)return;
        if (windowEpoch < 0 || time < windowLast || time-windowLast > .65) windowEpoch = time;
        windowLast = time;
        const z=240+40*p;
        const halfWidth=cam instanceof THREE.PerspectiveCamera ? z*Math.tan(THREE.MathUtils.degToRad(cam.fov*.5))*cam.aspect : z*.75;
        const elapsed=Math.max(0,time-windowEpoch);
        // Wrap only outside the visible camera frustum, never reverse or stop on screen.
        const phase=((.19+elapsed*.068+p*.16)%1+1)%1;
        const x=(1.34-2.68*phase)*halfWidth;
        wp.copy(cam.position).addScaledVector(wf,z).addScaledVector(wr,x).addScaledVector(wu,(-.16+Math.sin(time*.42)*.012)*z);
        a.g.position.copy(wp); a.g.rotation.set(0,Math.atan2(-wr.z,wr.x)+Math.PI,Math.sin(time*.5)*.025);
      });
    },
    dispose: () => D.forEach((d) => d.dispose()),
  };
}
