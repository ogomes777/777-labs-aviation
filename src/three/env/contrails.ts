import * as THREE from 'three';

/** Rastros de condensação: cones longos com fade longitudinal, borda suave por fresnel e turbulência. */
export function createContrails() {
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#fff6ef') } };
  const len = 420;
  const geo = new THREE.CylinderGeometry(0.22, 4.2, len, 24, 64, true);
  geo.translate(0, -len / 2, 0);
  geo.rotateZ(-Math.PI / 2); // eixo +y → +x... após rotação o cone segue para −x
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `
      varying float vU; varying vec3 vN; varying vec3 vV; uniform float uTime;
      void main(){
        vU = clamp(-position.x / ${len.toFixed(1)}, 0.0, 1.0);
        vec3 p = position;
        p.y += sin(vU * 18.0 + uTime * 0.4) * vU * 1.4;
        p.z += cos(vU * 13.0 + uTime * 0.3) * vU * 1.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vU; varying vec3 vN; varying vec3 vV; uniform float uOpacity; uniform vec3 uColor;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float a = smoothstep(0.0, 0.025, vU) * (1.0 - smoothstep(0.25, 1.0, vU)) * edge * 0.5;
        gl_FragColor = vec4(uColor, a * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
  const group = new THREE.Group();
  const meshes = [new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat)];
  meshes.forEach((m) => { m.renderOrder = 4; m.frustumCulled = false; group.add(m); });
  return {
    group, uniforms,
    place: (exhausts: THREE.Vector3[]) => exhausts.forEach((p, i) => meshes[i]?.position.copy(p)),
    dispose: () => { geo.dispose(); mat.dispose(); },
  };
}
