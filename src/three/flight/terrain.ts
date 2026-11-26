/**
 * Geografia do test drive compartilhada entre a física (JS) e o shader da terra (GLSL):
 * mesma costa procedural em volta do aeródromo da Frota e uma ilha com pista no mar, no mesmo rumo da pista 27.
 */
export const ISLAND = { cx: -9800, cz: 600, ax: 1150, az: 640, rz: 600, rx0: -9800 + 680, rx1: -9800 - 680, rw: 40 };

const fract = (x: number) => x - Math.floor(x);
function hash(x: number, y: number) {
  let px = fract(x * 123.34), py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d; py += d;
  return fract(px * py);
}
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}
function fbm(x: number, y: number) { let v = 0, a = 0.5; for (let i = 0; i < 5; i++) { v += a * noise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 17.1; a *= 0.5; } return v; }

/** distância (m) até a costa do continente: < 0 em terra, > 0 no mar */
export function coastDist(x: number, z: number) {
  const qx = x + 500, qz = (z - 900) * 1.25;
  return Math.hypot(qx, qz) - (3500 + 1300 * (fbm(x * 0.00042, z * 0.00042) - 0.5) * 2 + 260 * fbm(x * 0.003, z * 0.003));
}
/** < 0 dentro da ilha */
export function islandDist(x: number, z: number) {
  return Math.hypot((x - ISLAND.cx) / ISLAND.ax, (z - ISLAND.cz) / ISLAND.az) - (1 + 0.12 * (fbm(x * 0.002, z * 0.002) - 0.5) * 2);
}
export const isWater = (x: number, z: number) => coastDist(x, z) > 20 && islandDist(x, z) > 0.02;
