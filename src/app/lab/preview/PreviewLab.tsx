'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildJet } from '@/three/jet/buildJet';
import { createAnatomy24 } from '@/three/anatomy24';
import { CUT } from '@/three/jet/materials';
import { buildFleetCraft, SYSTEMS } from '@/three/fleet/airframe';
import type { FleetId, SystemId } from '@/content/fleet';
import type { PartId } from '@/content/site';

type Req = { kind: 'fleet'; id: FleetId; sys: SystemId; view?: 'side' | 'top' | 'front' | 'three4' } | { kind: 'anatomy'; part: PartId; detail: string | null };
const state = { req: null as Req | null, frames: 0, resolve: null as null | (() => void) };

/** Direção de câmera por sistema (frente-esquerda-alto como padrão). */
const DIRS: Record<SystemId, [number, number, number]> = {
  fuselagem: [0.62, 0.32, -1], asas: [0.25, 1.1, -0.75], propulsao: [0.7, 0.28, -1], empenagem: [-0.6, 0.35, -1],
  trem: [0.55, 0.12, -1], cabine: [0.3, 0.9, -1], portas: [0.75, 0.22, -1],
};

function Fleet({ id }: { id: FleetId }) {
  const { camera, scene } = useThree();
  const craft = useMemo(() => buildFleetCraft(id, { textureSize: 2048, detail: 1 }), [id]);
  useEffect(() => { craft.group.traverse((o) => { if (o.name.startsWith('contact-shadow')) o.visible = false; }); return () => craft.dispose(); }, [craft]);
  const box = useMemo(() => new THREE.Box3(), []);
  useFrame(() => {
    const r = state.req; if (!r || r.kind !== 'fleet') return;
    CUT.constant = 1e7;
    if (r.view) {
      craft.isolate(null); craft.setXray(0); craft.focusPart(null);
      craft.group.updateMatrixWorld(true); box.setFromObject(craft.group);
      const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const cam = camera as THREE.PerspectiveCamera; cam.fov = r.view === 'three4' ? 26 : 6; cam.updateProjectionMatrix();
      const dir = r.view === 'side' ? new THREE.Vector3(0, 0, -1) : r.view === 'top' ? new THREE.Vector3(0, 1, 0.0001) : r.view === 'front' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0.75, 0.22, -1).normalize();
      const ext = r.view === 'top' ? Math.max(sz.x, sz.z / cam.aspect) : r.view === 'front' ? Math.max(sz.z, sz.y * cam.aspect) / cam.aspect : Math.max(sz.x / cam.aspect, sz.y);
      const dist = (ext * 0.56) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (r.view === 'three4' ? 0.55 : 1);
      cam.position.copy(c).addScaledVector(dir, dist); cam.up.set(r.view === 'top' ? -1 : 0, r.view === 'top' ? 0 : 1, 0); cam.lookAt(c); cam.near = dist * 0.5; cam.far = dist * 2; cam.updateProjectionMatrix();
      return;
    }
    (camera as THREE.PerspectiveCamera).up.set(0, 1, 0);
    const cabin = r.sys === 'cabine', door = r.sys === 'portas';
    craft.isolate(cabin || door ? null : r.sys);
    craft.setXray(cabin ? 1 : 0);
    if (door) for (const s of SYSTEMS) craft.systems[s].visible = s === 'fuselagem' || s === 'portas' || s === 'asas' || s === 'trem';
    const target = cabin ? craft.systems.fuselagem : door ? craft.systems.portas : craft.systems[r.sys];
    craft.group.updateMatrixWorld(true);
    box.setFromObject(target);
    if (door) box.expandByVector(new THREE.Vector3(2.6, 1.2, 0.6));
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const d = new THREE.Vector3(...DIRS[r.sys]).normalize();
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 30; cam.updateProjectionMatrix();
    // encaixe pela caixa projetada (peças alongadas preenchem o quadro)
    cam.position.copy(sph.center).addScaledVector(d, 100); cam.lookAt(sph.center); cam.updateMatrixWorld();
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse));
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), tanH = tanV * cam.aspect;
    let dist = 0;
    for (const c of corners) { const depth = -c.z - 100; dist = Math.max(dist, Math.abs(c.x) / tanH - depth, Math.abs(c.y) / tanV - depth); }
    dist *= cabin ? 0.82 : 1.08;
    cam.position.copy(sph.center).addScaledVector(d, dist);
    cam.lookAt(sph.center);
    void scene;
  });
  return <primitive object={craft.group} />;
}

function Anatomy() {
  const { camera, size } = useThree();
  const jet = useMemo(() => buildJet('XR', { textureSize: 2048, detail: 1 }), []);
  const an = useMemo(() => createAnatomy24(jet), [jet]);
  useEffect(() => () => { an.dispose(); jet.dispose(); }, [an, jet]);
  useFrame((_, dt) => {
    const r = state.req; if (!r || r.kind !== 'anatomy') return;
    CUT.constant = r.part === 'cabine' ? 0.34 : 1e7;
    jet.parts.trem.visible = true;
    an.restoreFrame();
    an.apply(camera as THREE.PerspectiveCamera, r.part, r.detail, 0, 0.65, false, Math.min(dt, 0.05), 1.2, size.width, size.height);
  });
  return <primitive object={jet.group} />;
}

function Driver() {
  useFrame(() => { state.frames++; if (state.resolve && state.frames > 50) { const r = state.resolve; state.resolve = null; requestAnimationFrame(() => r()); } });
  const { gl, scene } = useThree();
  useEffect(() => {
    RectAreaLightUniformsLib.init();
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env; scene.environmentIntensity = 0.9; scene.background = null;
    gl.toneMapping = THREE.ACESFilmicToneMapping; gl.localClippingEnabled = true;
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return <>
    <directionalLight position={[-8, 12, -10]} intensity={2.4} color="#fff3e4" />
    <directionalLight position={[10, 4, 8]} intensity={0.8} color="#cfe0ff" />
    <hemisphereLight args={['#eaf2ff', '#3a3f46', 0.6]} />
  </>;
}

export default function PreviewLab() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(location.search) : null;
  const kind = q?.get('kind') ?? 'fleet';
  const id = (q?.get('id') ?? 'legacy-450') as FleetId;
  const ready = useRef(false);
  useEffect(() => {
    if (ready.current) return; ready.current = true;
    (window as unknown as { __preview: (r: Req) => Promise<void> }).__preview = (r: Req) => new Promise<void>((res) => { state.req = r; state.frames = 0; state.resolve = res; });
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent' }}>
      <Canvas id="lab" shadows={false} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false }} dpr={1} camera={{ fov: 30, near: 0.05, far: 400, position: [10, 4, -20] }} style={{ background: 'transparent' }}>
        <Driver />
        {kind === 'anatomy' ? <Anatomy /> : <Fleet id={id} />}
      </Canvas>
    </div>
  );
}
