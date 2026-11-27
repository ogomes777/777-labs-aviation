import * as THREE from 'three';
import { WIN, type JetSpec } from './spec';

/** Plano de corte do cutaway (mantém y <= constant). Compartilhado por fuselagem e interior. */
export const CUT = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e7); // neutro: nada é cortado até o cutaway pedir
export const CUT_PLANES = [CUT];

export interface WindowUniforms { [k: string]: THREE.IUniform }

export function windowUniforms(s: JetSpec, radius: number): WindowUniforms {
  return {
    uL: { value: s.L }, uR: { value: radius }, uD0: { value: s.winD0 }, uPitch: { value: s.winPitch },
    uN: { value: s.windows }, uW: { value: WIN.w }, uH: { value: WIN.h }, uTh: { value: WIN.theta }, uE: { value: WIN.n },
  };
}

/** Injeta abertura das janelas (descarta fragmentos dentro das superelipses) num material padrão do three. */
export function withWindows<T extends THREE.Material>(mat: T, uniforms: WindowUniforms, key: string): T {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fus;\nvarying vec2 vFus;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFus = fus;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vFus;
uniform float uL, uR, uD0, uPitch, uN, uW, uH, uTh, uE;`)
      .replace('#include <clipping_planes_fragment>', `
{
  float d = vFus.x * uL;
  float th = vFus.y * 6.28318530718;
  float j = clamp(floor((d - uD0) / uPitch + 0.5), 0.0, uN - 1.0);
  float dx = (d - (uD0 + j * uPitch)) / (uW * 0.5);
  float a1 = abs(th - uTh);
  float a2 = abs(th - (3.14159265359 - uTh));
  float dth = min(a1, a2) * uR / (uH * 0.5);
  if (pow(abs(dx), uE) + pow(abs(dth), uE) < 1.0) discard;
}
#include <clipping_planes_fragment>`);
  };
  mat.customProgramCacheKey = () => `win-${key}`;
  return mat;
}

export interface JetMaterials {
  paint: THREE.MeshPhysicalMaterial;
  wing: THREE.MeshPhysicalMaterial;
  stab: THREE.MeshPhysicalMaterial;
  fin: THREE.MeshPhysicalMaterial;
  nacelle: THREE.MeshPhysicalMaterial;
  polished: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  cockpitGlass: THREE.MeshPhysicalMaterial;
  rubber: THREE.MeshStandardMaterial;
  strut: THREE.MeshStandardMaterial;
  fairing: THREE.MeshPhysicalMaterial;
}

export function paintMaterial(map?: THREE.Texture) {
  return new THREE.MeshPhysicalMaterial({
    color: '#e6e5e1', map: map ?? null, roughness: 0.26, metalness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1,
  });
}
