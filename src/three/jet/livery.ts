import * as THREE from 'three';
import type { JetSpec } from './spec';

const TAU = Math.PI * 2;
const CHAMPAGNE = '#b39466';

/** Pintura original da fuselagem desenhada em canvas no espaço (d/L, θ/2π). */
export function fuselageLivery(s: JetSpec, W: number) {
  const H = W / 4;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const X = (d: number) => (d / s.L) * W;
  const Y = (th: number) => (1 - (((th % TAU) + TAU) % TAU) / TAU) * H;
  // base pérola
  g.fillStyle = '#efeeeb';
  g.fillRect(0, 0, W, H);
  // ventre prata com transição suave (θ = 3π/2)
  const belly = g.createLinearGradient(0, Y(1.5 * Math.PI + 0.95), 0, Y(1.5 * Math.PI - 0.95));
  belly.addColorStop(0, 'rgba(196,201,206,0)');
  belly.addColorStop(0.35, 'rgba(196,201,206,0.85)');
  belly.addColorStop(0.65, 'rgba(196,201,206,0.85)');
  belly.addColorStop(1, 'rgba(196,201,206,0)');
  g.fillStyle = belly;
  g.fillRect(0, Math.min(Y(1.5 * Math.PI + 0.95), Y(1.5 * Math.PI - 0.95)), W, Math.abs(Y(1.5 * Math.PI - 0.95) - Y(1.5 * Math.PI + 0.95)));
  // frisos champagne nos dois lados, subindo levemente na cauda
  const stripe = (side: 1 | -1, off: number, width: number) => {
    g.beginPath();
    for (let i = 0; i <= 400; i++) {
      const d = 1.0 + (s.L - 2.2) * (i / 400);
      const k = Math.max(0, (d - (s.L - s.Lt)) / s.Lt);
      const th0 = -0.16 + off + 0.5 * k * k;
      const th = side === 1 ? th0 : Math.PI - th0;
      const x = X(d), y = Y(th);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineWidth = width * (W / 4096);
    g.strokeStyle = CHAMPAGNE;
    g.stroke();
  };
  for (const side of [1, -1] as const) { stripe(side, 0, 5); stripe(side, -0.045, 2); }
  // linhas de painel discretas
  g.strokeStyle = 'rgba(120,128,136,0.35)';
  g.lineWidth = 1.2 * (W / 4096);
  for (const d of [s.Ln - 0.2, s.Ln + 0.15, s.L - s.Lt + 0.3, s.L - s.Lt * 0.45]) { g.beginPath(); g.moveTo(X(d), 0); g.lineTo(X(d), H); g.stroke(); }
  // porta principal (lado esquerdo, θ ≈ π)
  const d0 = s.Ln + 0.35, d1 = s.Ln + 1.25;
  const tTop = Math.PI - 0.72, tBot = Math.PI + 0.62;
  g.strokeStyle = 'rgba(110,116,124,0.75)';
  g.lineWidth = 2.2 * (W / 4096);
  roundRect(g, X(d0), Y(tTop), X(d1) - X(d0), Y(tBot) - Y(tTop), 14 * (W / 4096));
  g.stroke();
  g.fillStyle = 'rgba(110,116,124,0.6)';
  g.fillRect(X(d0 + 0.12), Y(Math.PI - 0.05), 22 * (W / 4096), 6 * (W / 4096));
  // marca conceitual no cone de cauda (os dois lados, orientação corrigida por lado)
  const label = (side: 1 | -1) => {
    const d = s.L - s.Lt * 0.62;
    const th = side === 1 ? 0.05 : Math.PI - 0.05;
    g.save();
    g.translate(X(d), Y(th));
    if (side === 1) g.scale(-1, 1); else g.scale(1, -1);
    g.font = `500 ${Math.round(34 * (W / 4096))}px Manrope, Arial, sans-serif`;
    g.fillStyle = 'rgba(70,78,88,0.85)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('777 · LABS', 0, 0);
    g.restore();
  };
  label(1); label(-1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Deriva com a marca 777 (metade +z: TE→LE, metade −z: LE→TE). */
export function finLivery(W = 1024) {
  const H = W / 2;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efeeeb';
  g.fillRect(0, 0, W, H);
  const mark = (cx: number, mirror: boolean) => {
    g.save();
    g.translate(cx, H * 0.5);
    if (mirror) g.scale(-1, 1);
    g.fillStyle = CHAMPAGNE;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `400 ${Math.round(H * 0.26)}px "Bodoni Moda", Georgia, serif`;
    g.fillText('777', 0, -H * 0.02);
    g.fillStyle = 'rgba(80,88,98,0.9)';
    g.font = `600 ${Math.round(H * 0.045)}px Manrope, Arial, sans-serif`;
    g.fillText('L A B S   A V I A T I O N', 0, H * 0.16);
    g.restore();
  };
  mark(W * 0.27, true);
  mark(W * 0.73, false);
  // filete champagne na raiz
  g.fillStyle = CHAMPAGNE;
  g.fillRect(0, H * 0.94, W, H * 0.012);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Asa: bordo de ataque metálico. Retorna mapa de cor + mapa roughness(G)/metalness(B). */
export function wingMaps() {
  const H = 256;
  const col = document.createElement('canvas'); col.width = 4; col.height = H;
  const mr = document.createElement('canvas'); mr.width = 4; mr.height = H;
  const a = col.getContext('2d')!, b = mr.getContext('2d')!;
  for (let y = 0; y < H; y++) {
    const v = 1 - y / H; // flipY
    const le = Math.exp(-Math.pow((v - 0.5) / 0.035, 2));
    const r = Math.round(239 - le * 40), gg = Math.round(238 - le * 36), bb = Math.round(235 - le * 30);
    a.fillStyle = `rgb(${r},${gg},${bb})`; a.fillRect(0, y, 4, 1);
    const rough = Math.round(255 * (0.34 - le * 0.16)), metal = Math.round(255 * (0.12 + le * 0.85));
    b.fillStyle = `rgb(0,${rough},${metal})`; b.fillRect(0, y, 4, 1);
  }
  const m = new THREE.CanvasTexture(col); m.colorSpace = THREE.SRGBColorSpace;
  const r = new THREE.CanvasTexture(mr);
  return { map: m, mr: r };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const X0 = Math.min(x, x + w), Y0 = Math.min(y, y + h), W = Math.abs(w), H = Math.abs(h);
  g.beginPath();
  g.moveTo(X0 + r, Y0);
  g.arcTo(X0 + W, Y0, X0 + W, Y0 + H, r);
  g.arcTo(X0 + W, Y0 + H, X0, Y0 + H, r);
  g.arcTo(X0, Y0 + H, X0, Y0, r);
  g.arcTo(X0, Y0, X0 + W, Y0, r);
  g.closePath();
}
