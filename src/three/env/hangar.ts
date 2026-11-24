import * as THREE from 'three';

/** Arquitetura do hangar (paredes, barras de luz) — o piso refletivo é montado no JSX (drei) por tier. */
export function createHangar(groundY: number) {
  const group = new THREE.Group();
  group.name = 'hangar';
  const disposables: { dispose: () => void }[] = [];
  const T = <O extends { dispose: () => void }>(o: O) => { disposables.push(o); return o; };
  const wallMat = T(new THREE.MeshStandardMaterial({ color: '#0c1015', roughness: 0.9, metalness: 0.1, transparent: true }));
  const finMat = T(new THREE.MeshStandardMaterial({ color: '#0e1217', roughness: 0.8, metalness: 0.1, transparent: true }));
  const lightMat = T(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.3), transparent: true, toneMapped: true }));
  const slitMat = T(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.38, 0.3), transparent: true }));
  const back = new THREE.Mesh(T(new THREE.PlaneGeometry(420, 40)), wallMat);
  back.position.set(-80, groundY + 20, 26);
  back.rotation.y = Math.PI;
  group.add(back);
  for (let i = -48; i <= 14; i++) {
    const fin = new THREE.Mesh(T(new THREE.BoxGeometry(0.5, 30, 1.2)), finMat);
    fin.position.set(i * 4.2, groundY + 15, 25.2);
    group.add(fin);
    if (i % 5 === 0) {
      const slit = new THREE.Mesh(T(new THREE.PlaneGeometry(0.08, 18)), slitMat);
      slit.position.set(i * 4.2 + 2.1, groundY + 9, 25.5);
      slit.rotation.y = Math.PI;
      group.add(slit);
    }
  }
  const bars = new THREE.Group(); group.add(bars);
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(T(new THREE.BoxGeometry(240, 0.12, 0.5)), lightMat);
    bar.position.set(-75, groundY + 17, i * 5 + 4);
    bars.add(bar);
  }
  const mats = [wallMat, finMat, lightMat, slitMat];
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
