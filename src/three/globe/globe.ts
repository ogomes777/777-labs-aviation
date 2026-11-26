import * as THREE from 'three';
import dots from '@/content/globe-dots.json';
import { DESTINATIONS, ORIGIN } from '@/content/destinations';

export const GLOBE_R = 2.6;

export function latLonToVec(lat: number, lon: number, r: number, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const th = THREE.MathUtils.degToRad(lon + 180);
  return out.set(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

/** yaw/pitch para trazer (lat, lon) ao centro voltado para +z. */
export function facing(lat: number, lon: number) {
  const p = latLonToVec(lat, lon, 1);
  return { yaw: -Math.atan2(p.x, p.z), pitch: THREE.MathUtils.degToRad(lat) };
}

export function createGlobe(quality: 'high' | 'balanced') {
  const root = new THREE.Group(); // pitch
  const spin = new THREE.Group(); // yaw
  root.add(spin);
  const disposables: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { disposables.push(o); return o; };

  // oceano escuro com borda fresnel
  const oceanMat = T(new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } }, transparent: true,
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying vec3 vN; varying vec3 vV; uniform float uOpacity;
      void main(){ float nv = max(dot(vN, vV), 0.0); float f = pow(1.0 - nv, 2.2);
        vec3 L = normalize(vec3(-0.45, 0.42, 0.78));
        float dl = dot(vN, L);
        vec3 base = mix(vec3(0.012, 0.024, 0.05), vec3(0.04, 0.085, 0.16), smoothstep(-0.3, 0.8, dl));
        vec3 H = normalize(L + vV); float spec = pow(max(dot(vN, H), 0.0), 60.0) * 0.55 + pow(max(dot(vN, H), 0.0), 8.0) * 0.06;
        vec3 rim = vec3(0.42, 0.68, 1.0);
        gl_FragColor = vec4(base + vec3(0.6, 0.8, 1.0) * spec * smoothstep(0.0, 0.3, dl) + rim * f * (0.55 + 0.45 * smoothstep(-0.2, 0.6, dl)), uOpacity);
        #include <colorspace_fragment>
      }`,
  }));
  spin.add(new THREE.Mesh(T(new THREE.SphereGeometry(GLOBE_R, quality === 'high' ? 96 : 56, quality === 'high' ? 64 : 40)), oceanMat));

  // atmosfera (back-side, aditiva)
  const atmoMat = T(new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } }, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying vec3 vN; varying vec3 vV; uniform float uOpacity;
      void main(){ float d = abs(dot(vN, vV)); float f = pow(clamp(d, 0.0, 1.0), 3.2) * 1.25;
        gl_FragColor = vec4(vec3(0.42, 0.68, 1.0) * f, f * uOpacity);
        #include <colorspace_fragment>
      }`,
  }));
  const atmo = new THREE.Mesh(T(new THREE.SphereGeometry(GLOBE_R * 1.2, 64, 48)), atmoMat);
  root.add(atmo);
  // borda de luz (frente, aditiva): o contorno do planeta acende como na órbita real
  const rimMat = T(new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying vec3 vN; varying vec3 vV; uniform float uOpacity;
      void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * f * 0.9, f * uOpacity);
        #include <colorspace_fragment>
      }`,
  }));
  root.add(new THREE.Mesh(T(new THREE.SphereGeometry(GLOBE_R * 1.012, 64, 48)), rimMat));

  // pontos de terra
  const pts = dots as [number, number][];
  const pos = new Float32Array(pts.length * 3);
  const tmp = new THREE.Vector3();
  pts.forEach(([la, lo], i) => { latLonToVec(la, lo, GLOBE_R * 1.003, tmp); pos.set([tmp.x, tmp.y, tmp.z], i * 3); });
  const dg = T(new THREE.BufferGeometry());
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dotMat = T(new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 26 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color('#dfe6ee') } }, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `uniform float uSize; varying float vFacing; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normalize(position)); vFacing = dot(n, normalize(-mv.xyz)); gl_PointSize = uSize / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uOpacity; uniform vec3 uColor; varying float vFacing; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; float a = smoothstep(0.5, 0.25, r) * smoothstep(-0.05, 0.35, vFacing); gl_FragColor = vec4(uColor, a * 0.85 * uOpacity);
      #include <colorspace_fragment>
    }`,
  }));
  spin.add(new THREE.Points(dg, dotMat));

  // marcadores
  const markerGeo = T(new THREE.SphereGeometry(0.035, 16, 12));
  const ringGeo = T(new THREE.RingGeometry(0.06, 0.075, 40));
  const markers = new Map<string, { dot: THREE.Mesh; ring: THREE.Mesh; mat: THREE.MeshBasicMaterial; ringMat: THREE.MeshBasicMaterial; pos: THREE.Vector3 }>();
  const mkMarker = (id: string, lat: number, lon: number, color: string) => {
    const p = latLonToVec(lat, lon, GLOBE_R * 1.01);
    const mat = T(new THREE.MeshBasicMaterial({ color, transparent: true }));
    const ringMat = T(new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, opacity: 0 }));
    const dot = new THREE.Mesh(markerGeo, mat); dot.position.copy(p);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.copy(p); ring.lookAt(p.clone().multiplyScalar(2));
    spin.add(dot, ring);
    markers.set(id, { dot, ring, mat, ringMat, pos: p });
  };
  mkMarker('origin', ORIGIN.lat, ORIGIN.lon, '#d8bf94');
  DESTINATIONS.forEach((d) => mkMarker(d.id, d.lat, d.lon, '#f4f6f8'));

  // arco animado origem → destino
  const arcMat = T(new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  let arc: THREE.Mesh | null = null;
  let arcLen = 0;
  const setArc = (id: string | null) => {
    if (arc) { spin.remove(arc); arc.geometry.dispose(); arc = null; }
    if (!id) return;
    const m = markers.get(id), o = markers.get('origin');
    if (!m || !o) return;
    const a = o.pos.clone(), b = m.pos.clone();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dist = a.distanceTo(b);
    mid.setLength(GLOBE_R * (1.02 + dist * 0.16));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.TubeGeometry(curve, 96, 0.009, 8, false);
    arcLen = geo.index!.count;
    geo.setDrawRange(0, 0);
    arc = new THREE.Mesh(geo, arcMat);
    spin.add(arc);
  };
  // malha de rotas: todos os destinos visíveis, traços finos com desenho escalonado
  const netMat = T(new THREE.MeshBasicMaterial({ color: '#8fcaff', transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }));
  let net: { mesh: THREE.Mesh; count: number; delay: number }[] = [];
  let netT = 0;
  const setNetwork = (ids: string[]) => {
    net.forEach((n) => { spin.remove(n.mesh); n.mesh.geometry.dispose(); });
    net = [];
    netT = 0;
    const o = markers.get('origin');
    if (!o) return;
    ids.forEach((id, i) => {
      const m = markers.get(id); if (!m) return;
      const a = o.pos.clone(), b = m.pos.clone();
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.setLength(GLOBE_R * (1.02 + a.distanceTo(b) * 0.16));
      const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 96, 0.006, 6, false);
      const count = geo.index!.count; geo.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geo, netMat); spin.add(mesh);
      net.push({ mesh, count, delay: i * 0.09 });
    });
  };
  let draw = 0;
  const update = (dt: number, selected: string | null, visibleIds: Set<string>, time: number) => {
    netT += dt;
    net.forEach((n) => { const k = Math.min(1, Math.max(0, (netT - n.delay) * 1.1)); n.mesh.geometry.setDrawRange(0, Math.floor(n.count * (1 - Math.pow(1 - k, 3)) / 3) * 3); });
    netMat.opacity = selected ? 0.18 : 0.38;
    if (arc) { draw = Math.min(1, draw + dt * 0.9); arc.geometry.setDrawRange(0, Math.floor(arcLen * (1 - Math.pow(1 - draw, 3)) / 3) * 3); }
    markers.forEach((m, id) => {
      const vis = id === 'origin' || visibleIds.has(id);
      const target = vis ? 1 : 0.15;
      m.mat.opacity += (target - m.mat.opacity) * Math.min(1, dt * 6);
      const sel = id === selected;
      m.ringMat.opacity += ((sel ? 1 : 0) - m.ringMat.opacity) * Math.min(1, dt * 6);
      const pulse = 1 + 0.25 * Math.sin(time * 3);
      m.ring.scale.setScalar(sel ? pulse : 1);
      m.dot.scale.setScalar(sel ? 1.5 : 1);
    });
  };
  return {
    root, spin, atmo,
    setArc: (id: string | null) => { draw = 0; setArc(id); },
    setNetwork,
    origin: () => markers.get('origin')!.dot,
    update,
    setOpacity: (o: number) => { oceanMat.uniforms.uOpacity.value = o; atmoMat.uniforms.uOpacity.value = o; dotMat.uniforms.uOpacity.value = o; },
    dispose: () => { if (arc) arc.geometry.dispose(); net.forEach((n) => n.mesh.geometry.dispose()); disposables.forEach((d) => d.dispose()); },
  };
}
