import { chromium } from 'playwright';
import fs from 'node:fs';
// Gera bancos de nuvem do céu final por ruído fractal (fBm) + luz por densidade na direção do sol.
// Saída: PNG com alfa (branco iluminado, sombra azulada). Uso: node scripts/gen-clouds.mjs <pasta>
const out = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage();
const shots = await p.evaluate(() => {
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b2 = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b2 - a) * u + (c - a) * v + (a - b2 - c + d) * u * v; };
  const fbm = (x, y, s, o = 6) => { let f = 0, a = 0.5, fr = 1; for (let i = 0; i < o; i++) { f += a * noise(x * fr, y * fr, s + i * 17); fr *= 2.03; a *= 0.5; } return f; };
  const make = (W, H, opt) => {
    const w = Math.round(W * opt.res), h = Math.round(H * opt.res);
    const D = new Float32Array(w * h), R = new Float32Array(w * h);
    const sc = opt.scale / w;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = x * sc, ny = y * sc * 1.15;
      // contorno de topo ondulado (torres) e base densa
      const top = opt.top + opt.towerAmp * (fbm(x / w * opt.towerFreq, 3.1, opt.seed + 5, 3) - 0.5) * 2;
      const yy = y / h;
      const shape = Math.min(1, Math.max(0, (yy - top) / opt.soft)) * (opt.bottomFade ? 1 - Math.max(0, (yy - 0.88) / 0.12) : 1);
      const warp = fbm(nx * 0.6 + 7, ny * 0.6, opt.seed + 9, 3);
      const n = fbm(nx + warp * 1.2, ny + warp * 0.6, opt.seed);
      let dd = (n * 1.15 + shape * 0.95 - 1.0) * opt.sharp;
      const side = Math.min(x, w - 1 - x) / (w * 0.07); dd *= Math.min(1, side);
      D[y * w + x] = Math.max(0, Math.min(1, dd)); R[y * w + x] = Math.max(0, Math.min(3, dd));
    }
    // luz: soma de densidade em direção ao sol (cima-direita) → sombra azulada embaixo, topo branco
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const img = g.createImageData(w, h), px = img.data;
    const st = Math.max(1, Math.round(h / 90));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = D[i]; if (a <= 0) continue;
      let acc = 0; for (let k = 1; k <= 8; k++) { const yy = y - k * st, xx = x + Math.round(k * st * 0.5); if (yy < 0 || xx >= w) break; acc += R[yy * w + xx]; }
      const lit = Math.max(0, 1 - acc * 0.06) * (0.82 + 0.18 * Math.min(1, R[i] / 2.2 > 1 ? 1 : 1 - R[i] / 6));
      const amb = 0.55 + 0.45 * (1 - y / h); // céu ilumina mais em cima
      const l = Math.min(1, 0.32 + 0.68 * lit * (0.75 + 0.25 * amb));
      const o = i * 4;
      px[o] = Math.round(132 + (255 - 132) * l); px[o + 1] = Math.round(160 + (254 - 160) * l); px[o + 2] = Math.round(205 + (250 - 205) * l);
      px[o + 3] = Math.round(Math.pow(a, 0.8) * 255);
    }
    g.putImageData(img, 0, 0);
    const big = document.createElement('canvas'); big.width = W; big.height = H; const bg = big.getContext('2d');
    bg.imageSmoothingQuality = 'high'; bg.drawImage(c, 0, 0, W, H);
    return big.toDataURL('image/png');
  };
  return {
    'sky-bank-a': make(2400, 1000, { res: 0.6, seed: 11, scale: 7, top: 0.38, towerAmp: 0.2, towerFreq: 5, soft: 0.42, sharp: 2.6, bottomFade: false }),
    'sky-bank-b': make(2400, 1000, { res: 0.6, seed: 29, scale: 6, top: 0.45, towerAmp: 0.24, towerFreq: 4, soft: 0.38, sharp: 2.4, bottomFade: false }),
    'sky-puff': make(1800, 1100, { res: 0.6, seed: 47, scale: 5, top: 0.3, towerAmp: 0.3, towerFreq: 2.5, soft: 0.35, sharp: 2.8, bottomFade: true }),
    'sky-veil': make(2400, 700, { res: 0.5, seed: 83, scale: 9, top: 0.42, towerAmp: 0.12, towerFreq: 7, soft: 0.5, sharp: 1.6, bottomFade: true }),
  };
});
for (const [k, v] of Object.entries(shots)) fs.writeFileSync(`${out}/${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
await b.close();
