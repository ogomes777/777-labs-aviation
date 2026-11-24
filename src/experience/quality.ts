import type { MotionMode, Quality } from './director';

export interface Capabilities { webgl: boolean; software: boolean; quality: Quality; motion: MotionMode; reasons: string[] }

const PREF_KEY = '777:motion';

export function readMotionPreference(): MotionMode | null {
  try { const v = localStorage.getItem(PREF_KEY); return v === 'cinematic' || v === 'lite' || v === 'reduced' ? v : null; } catch { return null; }
}
export function writeMotionPreference(m: MotionMode | null) {
  try { if (m) localStorage.setItem(PREF_KEY, m); else localStorage.removeItem(PREF_KEY); } catch { /* storage indisponível */ }
}

/**
 * Detecção de capacidade sem depender só de deviceMemory.
 * Overrides para QA: ?quality=high|balanced|lite, ?webgl=0, ?motion=reduced|lite|cinematic
 */
export function detectCapabilities(): Capabilities {
  const reasons: string[] = [];
  const q = new URLSearchParams(location.search);
  let webgl = false;
  let software = false;
  let integrated = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (gl) {
      webgl = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      software = /swiftshader|llvmpipe|softpipe|software/i.test(r);
      // GPU integrada/móvel (exceto Apple Silicon, que aguenta o tier alto)
      integrated = !/apple m\d/i.test(r) && /intel|uhd|iris|mali|adreno|powervr|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(r);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { webgl = false; }
  if (q.get('webgl') === '0') { webgl = false; reasons.push('webgl=0 (override)'); }
  if (!webgl) reasons.push('WebGL2 indisponível');

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const saveData = !!nav.connection?.saveData;
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMem = (nav.deviceMemory ?? 8) <= 4;

  let quality: Quality = 'high';
  if (coarse || small) { quality = 'balanced'; reasons.push('tela pequena/toque'); }
  if (lowCpu && lowMem) { quality = 'balanced'; reasons.push('CPU/memória modestas'); }
  if (integrated) { quality = 'balanced'; reasons.push('GPU integrada'); }
  if (software) { quality = 'lite'; reasons.push('renderizador por software'); }
  if (saveData) { quality = 'lite'; reasons.push('economia de dados'); }
  if (!webgl) quality = 'lite';
  const forced = q.get('quality');
  if (forced === 'high' || forced === 'balanced' || forced === 'lite') { quality = forced; reasons.push(`quality=${forced} (override)`); }
  if (!webgl) quality = 'lite';

  let motion: MotionMode = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'cinematic';
  if (motion === 'reduced') reasons.push('prefers-reduced-motion');
  const saved = readMotionPreference();
  if (saved) { motion = saved; reasons.push(`preferência salva: ${saved}`); }
  const fm = q.get('motion');
  if (fm === 'reduced' || fm === 'lite' || fm === 'cinematic') motion = fm;
  if (quality === 'lite' && motion === 'cinematic') motion = 'lite';
  return { webgl, software, quality, motion, reasons };
}
