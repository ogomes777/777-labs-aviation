import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * V6 — Pátio de preparação de aviação executiva ao entardecer (o "lugar onde eles pousam e decolam"):
 * concreto do pátio (piso refletivo montado no JSX), terminal/hangar FBO ao fundo com portões abertos e interior
 * aquecido, torres de holofote, faixa de vidro do terminal, linhas de táxi, céu dourado e serra no horizonte.
 * Geometria original e leve (mesclada por material). API preservada: { group, bars, setOpacity, dispose }.
 * Eixos: aeronaves ao longo de x (fila em z ≈ +16), câmera em z negativo, edifício em z = +62.
 */
export function createHangar(groundY: number) {
  const group = new THREE.Group();
  group.name = 'ramp';
  const disposables: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { disposables.push(o); return o; };
  const mats: THREE.Material[] = [];
  const M = <O extends THREE.Material>(m: O) => { T(m); m.transparent = true; mats.push(m); return m; };
  const gy = groundY;
  const BZ = 104, X0 = 90, X1 = -190, W = X0 - X1, CX = (X0 + X1) / 2, BH = 17;
  const merge = (geos: THREE.BufferGeometry[], mat: THREE.Material, name: string, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(T(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)))!), mat); m.name = name; parent.add(m); geos.forEach((g) => g.dispose()); return m;
  };
  const box = (list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };

  // ---------- materiais ----------
  const facade = M(new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.55, metalness: 0.7 }));
  const trim = M(new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.3, metalness: 0.95 }));
  const interior = M(new THREE.MeshStandardMaterial({ color: '#8a7764', roughness: 0.8, metalness: 0.1, emissive: new THREE.Color('#ff9f4d'), emissiveIntensity: 0.22 }));
  const led = M(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.3, 1.9) }));
  const amber = M(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.9, 0.9) }));
  const pole = M(new THREE.MeshStandardMaterial({ color: '#3a3f45', roughness: 0.5, metalness: 0.8 }));

  // ---------- terminal/hangar FBO ao fundo: três portões abertos + bloco de vidro ----------
  const doors = [-124, -50, 24];
  const DW = 48, DH = 12.5;
  {
    const fac: THREE.BufferGeometry[] = [], tr: THREE.BufferGeometry[] = [], inn: THREE.BufferGeometry[] = [], lights: THREE.BufferGeometry[] = [];
    // fachada em faixas, recortada nos portões
    let x = X1;
    const edges = doors.flatMap((c) => [c - DW / 2, c + DW / 2]).sort((a, b) => a - b);
    const solids: [number, number][] = [];
    for (let i = 0; i < edges.length; i += 2) { solids.push([x, edges[i]]); x = edges[i + 1]; }
    solids.push([x, X0]);
    for (const [a, b] of solids) if (b - a > 0.5) box(fac, b - a, BH, 2, (a + b) / 2, gy + BH / 2, BZ);
    for (const c of doors) {
      box(fac, DW, BH - DH, 2, c, gy + DH + (BH - DH) / 2, BZ);                 // verga
      box(tr, DW + 1.2, 0.5, 2.4, c, gy + DH, BZ - 0.2);                         // friso da verga
      // interior aquecido (paredes, teto com luminárias) — profundidade de hangar
      box(inn, DW - 1, 0.4, 36, c, gy + DH + 2, BZ + 18);
      box(inn, DW - 1, DH + 2, 0.4, c, gy + (DH + 2) / 2, BZ + 36);
      for (const s of [-1, 1]) box(inn, 0.4, DH + 2, 36, c + s * (DW / 2 - 0.5), gy + (DH + 2) / 2, BZ + 18);
      for (let z = BZ + 6; z < BZ + 34; z += 6) box(lights, DW - 6, 0.1, 0.4, c, gy + DH + 1.7, z);
      // folhas do portão recolhidas
      for (const s of [-1, 1]) box(tr, 1.6, DH, 3, c + s * (DW / 2 + 0.9), gy + DH / 2, BZ - 0.8);
    }
    // platibanda e linha de LED do topo
    box(tr, W, 0.9, 2.6, CX, gy + BH + 0.45, BZ - 0.2);
    box(lights, W - 4, 0.14, 0.2, CX, gy + BH - 0.2, BZ - 1.25);
    merge(fac, facade, 'fbo-facade'); merge(tr, trim, 'fbo-trim'); merge(inn, interior, 'fbo-interior');
    const bars = new THREE.Group(); bars.name = 'fbo-lights'; group.add(bars);
    merge(lights, led, 'fbo-led', bars);
    (group as THREE.Group & { _bars?: THREE.Group })._bars = bars;
  }
  // bloco de vidro do terminal (janelas quentes) entre os portões
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d')!; g.fillStyle = '#10161d'; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { const on = Math.random() > 0.25; g.fillStyle = on ? `rgba(255,${180 + Math.random() * 50},${110 + Math.random() * 40},${0.55 + Math.random() * 0.4})` : 'rgba(40,52,64,0.9)'; g.fillRect(i * 16 + 2, j * 32 + 4, 12, 24); }
    const tex = T(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const glass = M(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.6 }));
    for (const x of [(-124 + -50) / 2, (-50 + 24) / 2, 66]) { const m = new THREE.Mesh(T(new THREE.PlaneGeometry(9.5, 10)), glass); m.position.set(x, gy + 7.5, BZ - 1.05); m.rotation.y = Math.PI; group.add(m); }
  }
  // torres de holofote ao longo do pátio
  {
    const poles: THREE.BufferGeometry[] = [], heads: THREE.BufferGeometry[] = [];
    const xs: number[] = []; for (let x = X0 - 20; x > X1 + 10; x -= 38) xs.push(x);
    for (const x of xs) {
      const g = new THREE.CylinderGeometry(0.22, 0.32, 24, 10); g.translate(x, gy + 12, BZ - 14); poles.push(g);
      box(heads, 3.2, 0.5, 1.2, x, gy + 24.2, BZ - 14.4);
    }
    merge(poles, pole, 'flood-poles'); merge(heads, led, 'flood-heads');
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gg = gc.getContext('2d')!; const rg = gg.createRadialGradient(64, 64, 2, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,245,225,0.95)'); rg.addColorStop(0.25, 'rgba(255,220,170,0.35)'); rg.addColorStop(1, 'rgba(255,200,140,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
    const gt = T(new THREE.CanvasTexture(gc)); gt.colorSpace = THREE.SRGBColorSpace;
    const glowMat = M(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (const x of xs) { const sp = new THREE.Sprite(glowMat); sp.scale.set(9, 9, 1); sp.position.set(x, gy + 24, BZ - 14.8); group.add(sp); }
  }
  // linhas do pátio: táxi à frente, linhas de entrada para cada posição e barras de parada
  {
    const lineMat = M(new THREE.MeshBasicMaterial({ color: '#9c7a30' }));
    const lines: THREE.BufferGeometry[] = [];
    const ln = (w: number, d: number, x: number, z: number, rot = 0) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(rot); g.translate(x, gy + 0.012, z); lines.push(g); };
    ln(W, 0.24, CX, 8);
    for (const x of [0, -24, -48, -70, -88]) { ln(0.2, 30, x, 27); ln(5, 0.24, x, 44); }
    merge(lines, lineMat, 'apron-lines');
    // luzes azuis de borda de táxi (acendem com o bloom)
    const lamp = T(new THREE.SphereGeometry(0.16, 8, 6));
    const blue = M(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.3, 3.4) }));
    const inst = new THREE.InstancedMesh(lamp, blue, 48); const m4 = new THREE.Matrix4();
    for (let i = 0; i < 48; i++) { m4.makeTranslation(40 - i * 3.6, gy + 0.18, i % 2 ? 4 : 12); inst.setMatrixAt(i, m4); }
    inst.name = 'taxi-edge-lights'; group.add(inst);
    // calços e cones discretos nas posições (preparação de voo)
    const cone = T(new THREE.ConeGeometry(0.22, 0.7, 12)); cone.translate(0, 0.35, 0);
    const coneMat = M(new THREE.MeshStandardMaterial({ color: '#e0582a', roughness: 0.6, emissive: new THREE.Color('#40140a'), emissiveIntensity: 0.4 }));
    const cones = new THREE.InstancedMesh(cone, coneMat, 10);
    [0, -24, -48, -70, -88].forEach((x, i) => { m4.makeTranslation(x + 7, gy, 47); cones.setMatrixAt(i * 2, m4); m4.makeTranslation(x - 7, gy, 47); cones.setMatrixAt(i * 2 + 1, m4); });
    group.add(cones);
  }
  // céu do entardecer + serra + sol baixo (fundo de cena, sem névoa)
  {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#0f1d36'); grd.addColorStop(0.34, '#34507c'); grd.addColorStop(0.58, '#b98468'); grd.addColorStop(0.72, '#f3bd86'); grd.addColorStop(0.79, '#ffe0b0'); grd.addColorStop(0.8, '#2e2a28'); grd.addColorStop(1, '#1a1817');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 512);
    const tex = T(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(T(new THREE.PlaneGeometry(3400, 700)), M(new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false })));
    sky.position.set(CX, gy + 200, 1000); sky.rotation.y = Math.PI; sky.renderOrder = -10; group.add(sky);
    const s2 = document.createElement('canvas'); s2.width = 1024; s2.height = 128;
    const h = s2.getContext('2d')!; h.fillStyle = '#262529'; h.beginPath(); h.moveTo(0, 128);
    for (let x = 0; x <= 1024; x += 8) h.lineTo(x, 72 - 34 * Math.sin(x * 0.006) * Math.sin(x * 0.017 + 1) - 12 * Math.sin(x * 0.05));
    h.lineTo(1024, 128); h.closePath(); h.fill();
    const st = T(new THREE.CanvasTexture(s2)); st.colorSpace = THREE.SRGBColorSpace;
    const ridge = new THREE.Mesh(T(new THREE.PlaneGeometry(3000, 150)), M(new THREE.MeshBasicMaterial({ map: st, fog: false, depthWrite: false })));
    ridge.position.set(CX, gy + 46, 920); ridge.rotation.y = Math.PI; ridge.renderOrder = -9; group.add(ridge);
    const gc = document.createElement('canvas'); gc.width = gc.height = 256;
    const gg = gc.getContext('2d')!; const rg = gg.createRadialGradient(128, 128, 4, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,240,210,1)'); rg.addColorStop(0.18, 'rgba(255,205,140,0.7)'); rg.addColorStop(1, 'rgba(255,170,90,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 256, 256);
    const sunTex = T(new THREE.CanvasTexture(gc)); sunTex.colorSpace = THREE.SRGBColorSpace;
    const sun = new THREE.Mesh(T(new THREE.PlaneGeometry(320, 320)), M(new THREE.MeshBasicMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    sun.position.set(CX + 160, gy + 60, 960); sun.rotation.y = Math.PI; sun.renderOrder = -8; group.add(sun);
    // pista distante com luzes de borda, atrás do edifício (vista nas laterais)
    const lamp = T(new THREE.SphereGeometry(0.35, 8, 6));
    const edgeMat = M(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.6, 1.9) }));
    const edges = new THREE.InstancedMesh(lamp, edgeMat, 120); const m4 = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) { const x = CX - 900 + i * 30; m4.makeTranslation(x, gy + 0.3, 300); edges.setMatrixAt(i * 2, m4); m4.makeTranslation(x, gy + 0.3, 345); edges.setMatrixAt(i * 2 + 1, m4); }
    group.add(edges);
    const far = new THREE.Mesh(T(new THREE.PlaneGeometry(3000, 900)), M(new THREE.MeshStandardMaterial({ color: '#3d3b38', roughness: 0.9 })));
    far.rotation.x = -Math.PI / 2; far.position.set(CX, gy - 0.05, 520); group.add(far);
  }
  const bars = (group as THREE.Group & { _bars?: THREE.Group })._bars!;
  return {
    group,
    bars,
    setOpacity: (o: number) => { mats.forEach((m) => { m.opacity = o; m.visible = o > 0.01; }); },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/** Grade técnica marfim para a cena de anatomia. */
export function createBlueprintGrid(groundY: number) {
  const uniforms = { uOpacity: { value: 0 }, uLine: { value: new THREE.Color('#5d7286') }, uAccent: { value: new THREE.Color('#2f5bd6') } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP; uniform float uOpacity; uniform vec3 uLine, uAccent;
      float grid(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
      void main(){
        float minor = grid(vP, 1.0, 1.0) * 0.22;
        float major = grid(vP, 5.0, 1.2) * 0.5;
        float axis = (1.0 - min(abs(vP.y) / fwidth(vP.y) / 1.4, 1.0)) * 0.7;
        float r = length(vP);
        float ring = (1.0 - min(abs(r - 19.0) / fwidth(r) / 1.2, 1.0)) * 0.45;
        float fade = 1.0 - smoothstep(16.0, 34.0, r);
        float a = max(max(minor, major), ring) * fade;
        vec3 col = mix(uLine, uAccent, axis);
        gl_FragColor = vec4(col, max(a, axis * fade) * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = groundY + 0.01;
  mesh.renderOrder = 1;
  return { mesh, uniforms, dispose: () => { mesh.geometry.dispose(); mat.dispose(); } };
}
