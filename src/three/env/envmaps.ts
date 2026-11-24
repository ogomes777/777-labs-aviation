import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Mapas de ambiente procedurais (PMREM). Substituem HDRIs licenciados. */
export function buildEnvMaps(gl: THREE.WebGLRenderer, skyDome: THREE.Mesh) {
  const pmrem = new THREE.PMREMGenerator(gl);
  const out: Record<'sky' | 'hangar' | 'studio' | 'cabin', THREE.Texture> = {} as never;

  // céu: cúpula + nuvens claras abaixo
  {
    const sc = new THREE.Scene();
    const dome = skyDome.clone();
    (dome.material as THREE.ShaderMaterial) = (skyDome.material as THREE.ShaderMaterial).clone();
    (dome.material as THREE.ShaderMaterial).depthTest = true;
    dome.scale.setScalar(0.03);
    sc.add(dome);
    const below = new THREE.Mesh(new THREE.CircleGeometry(80, 32), new THREE.MeshBasicMaterial({ color: '#f1e3df' }));
    below.rotation.x = -Math.PI / 2; below.position.y = -6;
    sc.add(below);
    out.sky = pmrem.fromScene(sc, 0.02).texture;
    below.geometry.dispose(); (below.material as THREE.Material).dispose(); (dome.material as THREE.Material).dispose();
  }
  // hangar: escuro, com barras de luz no teto e softbox lateral
  {
    const sc = new THREE.Scene();
    sc.background = new THREE.Color('#050709');
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4.2) });
    const soft = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 2.0) });
    const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.13, 0.15) });
    for (let i = -2; i <= 2; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.6), strip);
      m.rotation.x = Math.PI / 2; m.position.set(0, 9, i * 4.5); sc.add(m);
    }
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), soft); s1.position.set(-6, 3, -16); sc.add(s1);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(30, 2), cool); s2.position.set(0, 1, 18); s2.rotation.y = Math.PI; sc.add(s2);
    out.hangar = pmrem.fromScene(sc, 0.03).texture;
    sc.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    strip.dispose(); soft.dispose(); cool.dispose();
  }
  // estúdio marfim
  {
    const room = new RoomEnvironment();
    out.studio = pmrem.fromScene(room, 0.04).texture;
    room.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
  }
  // cabine: sala quente
  {
    const sc = new THREE.Scene();
    sc.background = new THREE.Color('#2a1f17');
    const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.6) });
    const wall = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.45, 0.36), side: THREE.BackSide });
    const box = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 3), wall); sc.add(box);
    for (const z of [-1.2, 1.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.15), warm); m.rotation.x = Math.PI / 2; m.position.set(0, 1.3, z); sc.add(m); }
    const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3.0) });
    for (let x = -4; x <= 4; x += 2) for (const z of [-1.45, 1.45]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), win); m.position.set(x, 0.3, z); m.lookAt(x, 0.3, 0); sc.add(m); }
    out.cabin = pmrem.fromScene(sc, 0.02).texture;
    sc.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    warm.dispose(); wall.dispose(); win.dispose();
  }
  pmrem.dispose();
  return out;
}
