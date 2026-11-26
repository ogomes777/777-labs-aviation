import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * V6 — Campo de aviação executiva ao entardecer (o lugar onde as aeronaves pousam, taxiam e são preparadas).
 * Marcações e luzes seguem a lógica visual do ICAO Anexo 14 (ilustrativo, não é um aeródromo real):
 * pista de 45 m com eixo tracejado 30/20 m, 12 faixas de cabeceira, numeração, zona de toque, luzes de borda
 * brancas, cabeceira verde, PAPI e luzes de aproximação com lampejo sequencial; táxi com eixo amarelo, luzes
 * azuis e marcação de espera; torre de controle com farol giratório; hangar de portão aberto com interior
 * iluminado; terminal envidraçado; torres de holofote com feixe volumétrico; biruta; cones de pátio;
 * um jato em aproximação/pouso contínuo ao fundo. API: { group, bars, setOpacity, update, setCones, dispose }.
 * Eixos: aeronaves em fila ao longo de x (z ≈ 24), câmera em z negativo olhando +z.
 */
export function createHangar(groundY: number) {
  const group = new THREE.Group();
  group.name = 'airfield';
  const disposables: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { disposables.push(o); return o; };
  const mats: THREE.Material[] = [];
  const baseOpacity = new Map<THREE.Material, number>();
  const M = <O extends THREE.Material>(m: O) => { T(m); m.transparent = true; mats.push(m); baseOpacity.set(m, m.opacity); return m; };
  const gy = groundY;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const merge = (geos: THREE.BufferGeometry[], mat: THREE.Material, name: string, parent: THREE.Object3D = group) => {
    const g = mergeGeometries(geos.map((q) => (q.index ? q.toNonIndexed() : q)))!; geos.forEach((q) => q.dispose());
    const m = new THREE.Mesh(T(g), mat); m.name = name; parent.add(m); return m;
  };
  const flat = (w: number, d: number, x: number, z: number, y = 0.01) => { y = y * 4; const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, gy + y, z); return g; };
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = T(new THREE.CanvasTexture(c)); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const glowTex = (inner: string, mid: string) => canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 1, 64, 64, 64); r.addColorStop(0, inner); r.addColorStop(0.22, mid); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const lampGlow = glowTex('rgba(255,250,240,1)', 'rgba(255,230,190,0.35)');
  const sprite = (tex: THREE.Texture, color: string, size: number, pos: THREE.Vector3, parent: THREE.Object3D = group) => {
    const m = M(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false })); const s = new THREE.Sprite(m); s.scale.set(size, size, 1); s.position.copy(pos); parent.add(s); return s;
  };
  const updaters: ((t: number) => void)[] = [];

  // ---------- geografia ----------
  const TW_Z = 66, RW_Z = 122, RW_W = 45, RW_X0 = 60, RW_X1 = -1400;     // táxi, pista (cabeceira 27 em x = +60)
  const asphalt = (shade: string) => canvasTex(512, 512, (g) => { g.fillStyle = shade; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 9000; i++) { const v = Math.random(); g.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); } });
  {
    // faixa de táxi e pista (asfalto), grama entre elas e além
    const tw = asphalt('#2f3033'); tw.wrapS = tw.wrapT = THREE.RepeatWrapping; tw.repeat.set(90, 3);
    const twm = new THREE.Mesh(T(flat(1800, 24, -300, TW_Z, 0.004)), M(new THREE.MeshStandardMaterial({ map: tw, roughness: 0.9 }))); twm.name = 'taxiway'; group.add(twm);
    const rw = asphalt('#28292b'); rw.wrapS = rw.wrapT = THREE.RepeatWrapping; rw.repeat.set(140, 4);
    const rwm = new THREE.Mesh(T(flat(RW_X0 - RW_X1 + 400, RW_W + 6, (RW_X0 + RW_X1) / 2 + 200, RW_Z, 0.006)), M(new THREE.MeshStandardMaterial({ map: rw, roughness: 0.85 }))); rwm.name = 'runway'; group.add(rwm);
    const grass = canvasTex(256, 256, (g) => { g.fillStyle = '#3b4230'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '120,130,80' : '20,24,14'},${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 2); } });
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(320, 320);
    const gm = new THREE.Mesh(T(flat(8000, 8000, -300, 0, -0.03)), M(new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }))); gm.name = 'grass'; group.add(gm);
  }
  // ---------- marcações (ICAO Anexo 14, ilustrativo) ----------
  {
    const white: THREE.BufferGeometry[] = [], yellow: THREE.BufferGeometry[] = [];
    // eixo da pista 30 m / 20 m, 0,9 m de largura; faixas laterais
    for (let x = RW_X0 - 120; x > RW_X1; x -= 50) white.push(flat(30, 0.9, x - 15, RW_Z, 0.02));
    for (const s of [-1, 1]) white.push(flat(RW_X0 - RW_X1, 0.9, (RW_X0 + RW_X1) / 2, RW_Z + s * (RW_W / 2 - 0.6), 0.02));
    // cabeceira: 12 faixas de 30 m × 1,8 m
    for (let i = 0; i < 12; i++) { const z = RW_Z - RW_W / 2 + 3 + i * 3.6 + (i >= 6 ? 3 : 0); white.push(flat(30, 1.8, RW_X0 - 21, z, 0.02)); }
    white.push(flat(1.8, RW_W - 1, RW_X0 - 3, RW_Z, 0.02));
    // zona de toque (pares de faixas) e ponto de visada
    for (const [x, n] of [[RW_X0 - 210, 3], [RW_X0 - 360, 2], [RW_X0 - 510, 2], [RW_X0 - 660, 1]] as const) for (const s of [-1, 1]) for (let k = 0; k < n; k++) white.push(flat(22.5, 1.8, x, RW_Z + s * (6 + k * 3.3), 0.02));
    for (const s of [-1, 1]) white.push(flat(48, 9, RW_X0 - 420, RW_Z + s * 10, 0.021));
    merge(white, M(new THREE.MeshBasicMaterial({ color: '#d9d7d0', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })), 'runway-markings');
    // número da pista "27" (aproximação vindo de +x)
    const num = canvasTex(256, 512, (g) => { g.clearRect(0, 0, 256, 512); g.fillStyle = '#e4e2da'; g.font = 'bold 300px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(128, 256); g.rotate(Math.PI / 2); g.fillText('27', 0, 0); g.restore(); });
    const nm = new THREE.Mesh(T(flat(18, 9, RW_X0 - 58, RW_Z, 0.022)), M(new THREE.MeshBasicMaterial({ map: num, transparent: true, depthWrite: false }))); nm.name = 'runway-designator'; group.add(nm);
    // táxi: eixo amarelo 0,15 m; saídas para a pista; marcação de espera (2 contínuas + 2 tracejadas)
    yellow.push(flat(1800, 0.16, -300, TW_Z, 0.02));
    for (const x of [-30, -230, -430]) {
      yellow.push(flat(0.16, RW_Z - TW_Z, x, (RW_Z + TW_Z) / 2, 0.02));
      for (let k = 0; k < 2; k++) yellow.push(flat(14, 0.15, x, RW_Z - RW_W / 2 - 22 - k * 0.5, 0.021));
      for (let k = 0; k < 2; k++) for (let d = -6; d <= 6; d += 2.4) yellow.push(flat(1.2, 0.15, x + d, RW_Z - RW_W / 2 - 24 - k * 0.5, 0.021));
      // asfalto da saída
      const ex = flat(18, RW_Z - TW_Z - RW_W / 2, x, TW_Z + (RW_Z - RW_W / 2 - TW_Z) / 2, 0.003); white.length; yellow.length;
      group.add(new THREE.Mesh(T(ex), mats.find((m) => m instanceof THREE.MeshStandardMaterial && (m as THREE.MeshStandardMaterial).map?.repeat.y === 3) ?? M(new THREE.MeshStandardMaterial({ color: '#2f3033' }))));
    }
    // limite do pátio (as linhas de cada posição são desenhadas por setStands)
    yellow.push(flat(240, 0.18, -60, 52));
    merge(yellow, M(new THREE.MeshBasicMaterial({ color: '#c99a26', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })), 'taxi-markings');
  }
  // ---------- luzes do aeródromo (instanciadas; acendem com o bloom) ----------
  const lamp = T(new THREE.SphereGeometry(0.22, 8, 6));
  const inst = (color: THREE.Color, pts: THREE.Vector3[], name: string, scale = 1) => {
    const im = new THREE.InstancedMesh(lamp, M(new THREE.MeshBasicMaterial({ color })), pts.length); const m4 = new THREE.Matrix4();
    pts.forEach((p, i) => { m4.makeScale(scale, scale, scale).setPosition(p); im.setMatrixAt(i, m4); }); im.name = name; group.add(im); return im;
  };
  {
    const edge: THREE.Vector3[] = [], blue: THREE.Vector3[] = [], green: THREE.Vector3[] = [], red: THREE.Vector3[] = [];
    for (let x = RW_X0; x > RW_X1; x -= 60) for (const s of [-1, 1]) edge.push(V3(x, gy + 0.35, RW_Z + s * (RW_W / 2 + 1.5)));
    for (let z = RW_Z - RW_W / 2; z <= RW_Z + RW_W / 2; z += 3) green.push(V3(RW_X0 + 1, gy + 0.3, z));
    for (let x = 160; x > -1200; x -= 30) for (const s of [-1, 1]) blue.push(V3(x, gy + 0.3, TW_Z + s * 12.5));
    inst(new THREE.Color(3.2, 2.9, 2.3), edge, 'runway-edge-lights');
    inst(new THREE.Color(0.6, 3.2, 1.0), green, 'threshold-lights');
    inst(new THREE.Color(0.5, 1.3, 3.6), blue, 'taxi-edge-lights', 0.8);
    // PAPI (4 unidades à esquerda da pista): 2 brancas + 2 vermelhas = trajetória correta
    for (let i = 0; i < 4; i++) red.push(V3(RW_X0 - 300, gy + 0.6, RW_Z - RW_W / 2 - 15 - i * 9));
    const papi = inst(new THREE.Color(3, 3, 3), red, 'papi', 1.6);
    const cRed = new THREE.Color(3.4, 0.25, 0.2), cWhite = new THREE.Color(3.2, 3.1, 2.9);
    for (let i = 0; i < 4; i++) papi.setColorAt(i, i < 2 ? cRed : cWhite);
    // luzes de aproximação (barras transversais + lampejo sequencial "coelho")
    const app: THREE.Vector3[] = [];
    for (let k = 1; k <= 18; k++) for (let j = -2; j <= 2; j++) app.push(V3(RW_X0 + k * 30, gy + 0.6 + k * 0.05, RW_Z + j * 1.1));
    inst(new THREE.Color(2.6, 2.4, 2.0), app, 'approach-lights', 0.9);
    const rabbit = Array.from({ length: 18 }, (_, k) => sprite(lampGlow, '#ffffff', 7, V3(RW_X0 + (18 - k) * 30, gy + 1.2, RW_Z)));
    updaters.push((t) => { const ph = (t * 2) % 1; const on = Math.floor(ph * 18); rabbit.forEach((sp, k) => { (sp.material as THREE.SpriteMaterial).opacity = (k === on ? 1 : 0) * (baseOpacity.get(sp.material)! * curOpacity); }); });
  }
  // ---------- torre de controle ----------
  {
    const tg = new THREE.Group(); tg.name = 'control-tower'; tg.position.set(95, gy, 205); group.add(tg);
    const concrete = M(new THREE.MeshStandardMaterial({ color: '#b8b2a7', roughness: 0.8 }));
    const shaft = new THREE.Mesh(T(new THREE.CylinderGeometry(3.2, 4.2, 40, 24)), concrete); shaft.position.y = 20; tg.add(shaft);
    const deck = new THREE.Mesh(T(new THREE.CylinderGeometry(7.5, 5.5, 3, 8)), concrete); deck.position.y = 41.5; tg.add(deck);
    const cabGlass = M(new THREE.MeshStandardMaterial({ color: '#1b2a33', emissive: new THREE.Color('#5fa0c8'), emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.8 }));
    const cab = new THREE.Mesh(T(new THREE.CylinderGeometry(8.4, 7.4, 6, 8, 1, true)), cabGlass); cab.position.y = 46; tg.add(cab);
    const roof = new THREE.Mesh(T(new THREE.CylinderGeometry(5.5, 8.8, 1.6, 8)), concrete); roof.position.y = 49.8; tg.add(roof);
    const mast = new THREE.Mesh(T(new THREE.CylinderGeometry(0.15, 0.2, 9, 8)), concrete); mast.position.y = 55; tg.add(mast);
    const obst = sprite(glowTex('rgba(255,60,40,1)', 'rgba(255,40,20,0.4)'), '#ff3a2a', 5, V3(0, 59.5, 0), tg);
    const beacon = new THREE.Group(); beacon.position.y = 51.2; tg.add(beacon);
    const bg = sprite(glowTex('rgba(120,255,160,1)', 'rgba(60,255,120,0.4)'), '#7dffa8', 9, V3(1.2, 0, 0), beacon);
    const bw = sprite(lampGlow, '#ffffff', 9, V3(-1.2, 0, 0), beacon);
    updaters.push((t) => {
      const o = curOpacity;
      (obst.material as THREE.SpriteMaterial).opacity = (Math.sin(t * 3) > 0 ? 1 : 0.15) * o;
      const a = t * 2.4; (bg.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.cos(a)) ** 6 * o; (bw.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.cos(a + Math.PI)) ** 6 * o;
    });
  }
  // ---------- terminal envidraçado (além da pista) ----------
  {
    const glass = canvasTex(1024, 128, (g) => {
      g.fillStyle = '#0d1218'; g.fillRect(0, 0, 1024, 128);
      for (let i = 0; i < 64; i++) for (let j = 0; j < 2; j++) { const lit = Math.random() > 0.2; const grd = g.createLinearGradient(0, j * 64, 0, j * 64 + 60); grd.addColorStop(0, lit ? '#ffd7a0' : '#2a3542'); grd.addColorStop(1, lit ? '#e89a52' : '#18202a'); g.fillStyle = grd; g.fillRect(i * 16 + 1.5, j * 64 + 3, 13, 58); }
    });
    const gm = M(new THREE.MeshStandardMaterial({ map: glass, emissiveMap: glass, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.5 }));
    const body = M(new THREE.MeshStandardMaterial({ color: '#2b3036', roughness: 0.6, metalness: 0.6 }));
    const tb = new THREE.Group(); tb.name = 'terminal'; tb.position.set(-140, gy, 250); group.add(tb);
    const front = new THREE.Mesh(T(new THREE.PlaneGeometry(220, 12)), gm); front.position.set(0, 7, -9.8); front.rotation.y = Math.PI; tb.add(front);
    const box = new THREE.Mesh(T(new THREE.BoxGeometry(224, 15, 18)), body); box.position.y = 7.5; tb.add(box);
    const canopy = new THREE.Mesh(T(new THREE.BoxGeometry(230, 0.8, 26)), body); canopy.position.set(0, 15.4, -3); tb.add(canopy);
    const soffit = new THREE.Mesh(T(new THREE.PlaneGeometry(228, 24)), M(new THREE.MeshStandardMaterial({ color: '#d9c6ad', emissive: new THREE.Color('#ffc98e'), emissiveIntensity: 0.7, roughness: 0.6 }))); soffit.rotation.x = Math.PI / 2; soffit.position.set(0, 14.95, -3); tb.add(soffit);
    const edge = new THREE.Mesh(T(new THREE.BoxGeometry(228, 0.5, 0.4)), M(new THREE.MeshStandardMaterial({ color: '#2b3036', metalness: 0.7, roughness: 0.4 }))); edge.position.set(0, 15.4, -16); tb.add(edge);
  }
  // ---------- hangar de portão aberto (lado direito, em ângulo) ----------
  {
    const hg = new THREE.Group(); hg.name = 'open-hangar'; hg.position.set(-178, gy, 40); hg.rotation.y = -0.62; group.add(hg);
    const W = 64, H = 22, D = 54;
    const shell = M(new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.55, metalness: 0.75, side: THREE.DoubleSide }));
    const geos: THREE.BufferGeometry[] = [];
    const bx = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); geos.push(g); };
    bx(W, 0.6, D, 0, H, D / 2); bx(0.6, H, D, -W / 2, H / 2, D / 2); bx(0.6, H, D, W / 2, H / 2, D / 2); bx(W, H, 0.6, 0, H / 2, D);
    bx(W + 2, 3.5, 1.2, 0, H - 1.75, 0);                                                       // verga do portão
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) bx(4.2, H - 3.5, 0.5, s * (W / 2 + 2.4 + i * 4.3), (H - 3.5) / 2, -1.2 - i * 1.4); // folhas recolhidas (separadas: sem conflito de profundidade)
    merge(geos, shell, 'hangar-shell', hg);
    // interior iluminado: piso epóxi claro, luminárias, parede do fundo quente
    const floorMat = M(new THREE.MeshStandardMaterial({ color: '#d7d4cc', roughness: 0.25, metalness: 0.1, emissive: new THREE.Color('#5a4630'), emissiveIntensity: 0.25 }));
    const fl = new THREE.Mesh(T(new THREE.PlaneGeometry(W - 1, D - 1)), floorMat); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.12, D / 2); hg.add(fl);
    const back = new THREE.Mesh(T(new THREE.PlaneGeometry(W - 1, H - 1)), M(new THREE.MeshStandardMaterial({ color: '#c7b49a', emissive: new THREE.Color('#ffb36b'), emissiveIntensity: 0.45 }))); back.position.set(0, H / 2, D - 1.2); back.rotation.y = Math.PI; hg.add(back);
    const lights: THREE.BufferGeometry[] = []; for (let z = 6; z < D; z += 8) for (const x of [-18, 0, 18]) { const g = new THREE.BoxGeometry(10, 0.12, 0.5); g.translate(x, H - 0.5, z); lights.push(g); }
    merge(lights, M(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.5) })), 'hangar-lights', hg);
    const spill = new THREE.Mesh(T(flat(W, 36, 0, -16, 0.015).translate(0, -gy, 0)), M(new THREE.MeshBasicMaterial({ map: glowTex('rgba(255,210,150,0.55)', 'rgba(255,190,120,0.25)'), blending: THREE.AdditiveBlending, depthWrite: false }))); spill.scale.set(1, 1, 1); hg.add(spill);
    // jato estacionado lá dentro (silhueta simples, ilustrativa)
    const jetMat = M(new THREE.MeshStandardMaterial({ color: '#f2f1ee', roughness: 0.3, metalness: 0.2 }));
    const jg: THREE.BufferGeometry[] = [];
    { const f = new THREE.CapsuleGeometry(1.1, 16, 6, 16); f.rotateZ(Math.PI / 2); f.translate(0, 2.6, 26); jg.push(f); }
    { const w = new THREE.BoxGeometry(5, 0.25, 19); w.translate(1, 1.9, 26); jg.push(w); }
    { const fin = new THREE.BoxGeometry(3, 4.2, 0.25); fin.translate(-8, 5.2, 26); jg.push(fin); }
    { const st = new THREE.BoxGeometry(2.2, 0.2, 7); st.translate(-8.8, 7.3, 26); jg.push(st); }
    for (const s of [-1, 1]) { const n = new THREE.CylinderGeometry(0.62, 0.62, 3, 14); n.rotateZ(Math.PI / 2); n.translate(-5.2, 3.3, 26 + s * 2); jg.push(n); }
    merge(jg, jetMat, 'hangar-jet', hg);
  }
  // ---------- torres de holofote: cabeça inclinada, feixe volumétrico e poça de luz ----------
  const bars = new THREE.Group(); bars.name = 'apron-floodlights'; group.add(bars);
  {
    const poleMat = M(new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.45, metalness: 0.85 }));
    const headMat = M(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 3.2, 2.8) }));
    const beamTex = canvasTex(64, 256, (g) => { const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, 'rgba(255,235,200,0.55)'); grd.addColorStop(0.6, 'rgba(255,225,180,0.12)'); grd.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 256); });
    const beamMat = M(new THREE.MeshBasicMaterial({ map: beamTex, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.22 }));
    const poolMat = M(new THREE.MeshBasicMaterial({ map: glowTex('rgba(255,230,190,0.5)', 'rgba(255,215,170,0.22)'), blending: THREE.AdditiveBlending, depthWrite: false }));
    const poles: THREE.BufferGeometry[] = [], heads: THREE.BufferGeometry[] = [];
    for (const x of [34, -10, -56, -102, -146]) {
      const z = 54, h = 26;
      const pg = new THREE.CylinderGeometry(0.25, 0.42, h, 10); pg.translate(x, gy + h / 2, z); poles.push(pg);
      const cross = new THREE.BoxGeometry(5.4, 0.3, 0.3); cross.translate(x, gy + h, z); poles.push(cross);
      for (let k = -1; k <= 1; k++) { const hd = new THREE.BoxGeometry(1.4, 0.18, 1.0); hd.rotateX(-0.55); hd.translate(x + k * 1.8, gy + h - 0.55, z - 0.5); heads.push(hd); }
      // feixe: cone aberto do refletor até o pátio, inclinado para as aeronaves
      const cone = new THREE.ConeGeometry(8, h, 24, 1, true); cone.translate(0, -h / 2, 0); cone.rotateX(0.55); cone.translate(x, gy + h - 0.8, z - 1);
      const beam = new THREE.Mesh(T(cone), beamMat); beam.renderOrder = 5; bars.add(beam);
      const pool = new THREE.Mesh(T(flat(34, 34, x, z - 14, 0.02)), poolMat); bars.add(pool);
      sprite(lampGlow, '#fff2dc', 7, V3(x, gy + h - 0.4, z - 0.9), bars);
    }
    merge(poles, poleMat, 'flood-poles'); merge(heads, headMat, 'flood-heads', bars);
  }
  // ---------- biruta (laranja/branca), balançando ----------
  {
    const ws = new THREE.Group(); ws.name = 'windsock'; ws.position.set(28, gy, RW_Z - RW_W / 2 - 12); group.add(ws);
    const pole = new THREE.Mesh(T(new THREE.CylinderGeometry(0.08, 0.1, 7, 8)), M(new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 0.6, roughness: 0.4 }))); pole.position.y = 3.5; ws.add(pole);
    const sock = new THREE.Group(); sock.position.y = 6.8; ws.add(sock);
    const stripes = canvasTex(256, 32, (g) => { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#f2f2f2' : '#ff5a1a'; g.fillRect(i * 51.2, 0, 51.2, 32); } });
    const sg = new THREE.CylinderGeometry(0.22, 0.45, 3.4, 16, 1, true); sg.rotateZ(Math.PI / 2); sg.translate(-1.7, 0, 0);
    const sm = new THREE.Mesh(T(sg), M(new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide, roughness: 0.8 }))); sock.add(sm);
    updaters.push((t) => { sock.rotation.y = 0.35 + Math.sin(t * 0.7) * 0.12; sock.rotation.z = -0.12 + Math.sin(t * 1.9) * 0.04; });
  }
  // ---------- céu ao entardecer, nuvens rasas, serra e luzes da cidade no horizonte ----------
  {
    const sky = canvasTex(64, 512, (g) => { const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#13285a'); grd.addColorStop(0.3, '#3a66a8'); grd.addColorStop(0.52, '#c7866a'); grd.addColorStop(0.68, '#ffb066'); grd.addColorStop(0.78, '#ffe3b4'); grd.addColorStop(0.8, '#2b2826'); grd.addColorStop(1, '#171514'); g.fillStyle = grd; g.fillRect(0, 0, 64, 512); });
    void sky;
    const domeTex = canvasTex(64, 1024, (g) => { const grd = g.createLinearGradient(0, 0, 0, 1024); grd.addColorStop(0, '#0f2252'); grd.addColorStop(0.22, '#2f5d9f'); grd.addColorStop(0.38, '#8fa6c4'); grd.addColorStop(0.45, '#e9a979'); grd.addColorStop(0.49, '#ffd9a6'); grd.addColorStop(0.505, '#b7a593'); grd.addColorStop(0.6, '#5d6150'); grd.addColorStop(1, '#3c4034'); g.fillStyle = grd; g.fillRect(0, 0, 64, 1024); });
    const dome = new THREE.Mesh(T(new THREE.SphereGeometry(4200, 64, 32)), M(new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide, fog: false, depthWrite: false })));
    dome.position.set(-40, gy, 0); dome.renderOrder = -11; dome.name = 'sky-dome'; group.add(dome);
    const clouds = canvasTex(1024, 256, (g) => { g.clearRect(0, 0, 1024, 256); for (let i = 0; i < 70; i++) { const x = Math.random() * 1024, y = 60 + Math.random() * 120, r = 30 + Math.random() * 90; const c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, 'rgba(255,214,170,0.22)'); c.addColorStop(1, 'rgba(255,190,150,0)'); g.fillStyle = c; g.fillRect(x - r, y - r * 0.4, r * 2, r * 0.8); } });
    const cm = new THREE.Mesh(T(new THREE.PlaneGeometry(3600, 320)), M(new THREE.MeshBasicMaterial({ map: clouds, fog: false, depthWrite: false, opacity: 0.9 }))); cm.position.set(-300, gy + 190, 1250); cm.rotation.y = Math.PI; cm.renderOrder = -9; group.add(cm);
    const ridge = canvasTex(2048, 128, (g) => { const grd = g.createLinearGradient(0, 30, 0, 128); grd.addColorStop(0, '#59607a'); grd.addColorStop(1, '#9c95a0'); g.fillStyle = grd; g.beginPath(); g.moveTo(0, 128); for (let x = 0; x <= 2048; x += 8) g.lineTo(x, 70 - 30 * Math.sin(x * 0.004) * Math.sin(x * 0.011 + 1) - 10 * Math.sin(x * 0.04)); g.lineTo(2048, 128); g.closePath(); g.fill(); for (let i = 0; i < 520; i++) { g.fillStyle = `rgba(255,${190 + Math.random() * 50},${120 + Math.random() * 60},${0.5 + Math.random() * 0.5})`; g.fillRect(Math.random() * 2048, 100 + Math.random() * 26, 1.6, 1.6); } });
    ridge.wrapS = THREE.RepeatWrapping; ridge.repeat.set(3, 1);
    const rm = new THREE.Mesh(T(new THREE.CylinderGeometry(2600, 2600, 170, 96, 1, true)), M(new THREE.MeshBasicMaterial({ map: ridge, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true })));
    rm.position.set(-40, gy + 70, 0); rm.renderOrder = -8; rm.name = 'ridge-ring'; group.add(rm);
    const sun = new THREE.Mesh(T(new THREE.PlaneGeometry(380, 380)), M(new THREE.MeshBasicMaterial({ map: glowTex('rgba(255,246,222,1)', 'rgba(255,196,120,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))); sun.position.set(160, gy + 85, 1180); sun.rotation.y = Math.PI; sun.renderOrder = -7; group.add(sun);
  }
  // ---------- cones de pátio (instanciados; posicionados pela cena nas pontas de asa e cauda) ----------
  const CONE_MAX = 40;
  const coneBody = (() => { const g = new THREE.LatheGeometry([new THREE.Vector2(0.17, 0), new THREE.Vector2(0.155, 0.08), new THREE.Vector2(0.035, 0.7), new THREE.Vector2(0.001, 0.71)], 20); g.translate(0, 0.04, 0); return T(g); })();
  const coneBand = (() => { const g = new THREE.LatheGeometry([new THREE.Vector2(0.125, 0.28), new THREE.Vector2(0.1, 0.36)], 20); const g2 = new THREE.LatheGeometry([new THREE.Vector2(0.085, 0.46), new THREE.Vector2(0.066, 0.53)], 20); const m = mergeGeometries([g, g2])!; g.dispose(); g2.dispose(); m.scale(1.04, 1, 1.04); m.translate(0, 0.04, 0); return T(m); })();
  const coneBase = (() => { const g = new THREE.BoxGeometry(0.4, 0.04, 0.4); g.translate(0, 0.02, 0); return T(g); })();
  const cones = [
    new THREE.InstancedMesh(coneBody, M(new THREE.MeshStandardMaterial({ color: '#ff5e1f', roughness: 0.55, emissive: new THREE.Color('#3a1206'), emissiveIntensity: 0.6 })), CONE_MAX),
    new THREE.InstancedMesh(coneBand, M(new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.3, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.35 })), CONE_MAX),
    new THREE.InstancedMesh(coneBase, M(new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.8 })), CONE_MAX),
  ];
  cones.forEach((c) => { c.count = 0; c.name = 'apron-cones'; group.add(c); });
  const standMat = M(new THREE.MeshBasicMaterial({ color: '#c99a26', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  let standMesh: THREE.Mesh | null = null;
  /** posições de estacionamento: eixo sob a aeronave, barra de parada à frente do nariz, cones nas pontas de asa e cauda */
  const setStands = (stands: { x: number; z: number; length: number; span: number; noseX: number; tipX: number }[]) => {
    const geos: THREE.BufferGeometry[] = []; const pts: { x: number; z: number }[] = [];
    for (const st of stands) {
      geos.push(flat(st.length + 8, 0.16, st.x - 2, st.z, 0.02));
      geos.push(flat(0.22, 5, st.noseX + 1.6, st.z, 0.021));
      geos.push(flat(0.16, 3, st.noseX + 3.2, st.z, 0.021));
      pts.push({ x: st.tipX, z: st.z - st.span / 2 - 1.1 }, { x: st.tipX, z: st.z + st.span / 2 + 1.1 }, { x: st.x - st.length / 2 - 2.2, z: st.z }, { x: st.noseX + 2.4, z: st.z - 2.2 });
    }
    if (standMesh) { group.remove(standMesh); standMesh.geometry.dispose(); }
    standMesh = merge(geos, standMat, 'stand-markings');
    const m4 = new THREE.Matrix4(); const n = Math.min(CONE_MAX, pts.length);
    cones.forEach((c) => { for (let i = 0; i < n; i++) { m4.makeTranslation(pts[i].x, gy, pts[i].z); c.setMatrixAt(i, m4); } c.count = n; c.instanceMatrix.needsUpdate = true; });
  };

  let curOpacity = 1;
  return {
    group,
    bars,
    setOpacity: (o: number) => { curOpacity = o; mats.forEach((m) => { m.opacity = (baseOpacity.get(m) ?? 1) * o; m.visible = o > 0.01; }); },
    update: (t: number) => { for (const u of updaters) u(t); },
    setStands,
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
