// Pipeline de mídia ORIGINAL: renderiza poster, stills, cards da galeria, OG e o loop de vídeo do hero
// a partir da própria cena WebGL do projeto (servidor local em :3777). Saída em public/media.
// Uso: node scripts/render-media.mjs [stills|video|all]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gotoT, waitReady } from './qa-lib.mjs';

const mode = process.argv[2] ?? 'all';
const BASE = 'http://localhost:3777/?qa=1&perf=lock&quality=high';
const OUT = 'public/media';
const TMP = 'qa/tmp/render';
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(w, h, base = BASE) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.setDefaultTimeout(120000);
  await page.goto(base, { waitUntil: 'networkidle' });
  await waitReady(page);
  await page.addStyleTag({ content: 'main,header,.rail,.consent-bar,.cursor,.scene-index,.route-layer{visibility:hidden!important}' });
  await page.evaluate(() => { window.__777.frame.freezeClock = true; window.__777.frame.clock = 0; });
  return page;
}
const enc = (png, base, { q = 78, avif = false, resize } = {}) => {
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGB')
${resize ? `im = im.resize((${resize[0]}, ${resize[1]}), Image.LANCZOS)` : ''}
im.save(${JSON.stringify(base + '.webp')}, 'WEBP', quality=${q}, method=6)
${avif ? `im.save(${JSON.stringify(base + '.avif')}, 'AVIF', quality=${q - 18})` : ''}
`;
  execFileSync('python3', ['-I', '-c', py]);
};

if (mode === 'stills' || mode === 'all') {
  const stills = [['hero', 0], ['portal', 1.5], ['aeronave', 2.3], ['frota', 3.36], ['engenharia', 4.62], ['interior', 5.25], ['experiencia', 6.0], ['destinos', 7.7], ['epilogo', 8.96]];
  for (const [vw, vh, suffix] of [[1600, 1000, ''], [900, 1600, '-m']]) {
    const page = await open(vw, vh);
    for (const [id, t] of stills) {
      await gotoT(page, t, { settle: id === 'frota' ? 9000 : 2600 });
      const png = `${TMP}/still-${id}${suffix}.png`;
      await page.screenshot({ path: png });
      enc(png, `${OUT}/still-${id}${suffix}`, { q: 72 });
      if (id === 'hero') enc(png, `${OUT}/poster-${suffix ? 'mobile' : 'desktop'}`, { q: 74, avif: true, resize: suffix ? [900, 1600] : [1920, 1200] });
      if (id === 'engenharia' && !suffix) {
        // âncoras dos hotspots no still (posições normalizadas) para o modo leve
        await page.evaluate(() => { document.querySelector('.hotspots').dataset.visible = 'true'; });
        const anchors = await page.evaluate(() => {
          const out = {};
          document.querySelectorAll('.hotspot').forEach((el, i) => {
            const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform);
            const ids = ['fuselagem', 'asas', 'motores', 'empenagem', 'trem', 'cabine'];
            if (m) out[ids[i]] = [Number(m[1]) / innerWidth, Number(m[2]) / innerHeight].map((v) => Math.round(v * 1000) / 1000);
          });
          return out;
        });
        writeFileSync('src/content/anatomy-anchors.json', JSON.stringify(anchors));
        console.log('anchors', anchors);
      }
      console.log('still', id + suffix);
    }
    await page.close();
  }
  // cards da galeria (mesma cabine 3D) e imagem social
  const page = await open(1280, 800);
  for (const [id, t] of [['lounge', 6.0], ['mesa', 6.3333], ['suite', 6.6667], ['janela', 7.0]]) {
    await gotoT(page, t, { settle: 2600 });
    const png = `${TMP}/cabin-${id}.png`;
    await page.screenshot({ path: png });
    enc(png, `${OUT}/cabin-${id}`, { q: 76, resize: [880, 550] });
    console.log('card', id);
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await gotoT(page, 0, { settle: 2600 });
  await page.screenshot({ path: `${OUT}/og.jpg`, type: 'jpeg', quality: 86 });
  await page.close();
}

if (mode === 'video' || mode === 'all') {
  // loop de 6 s a 24 fps; 1 s extra é misturado sobre o início para costura invisível
  const FPS = 24, LEN = 5, EXTRA = 1;
  for (const [w, h, name] of [[1280, 720, 'hero-desktop'], [720, 1280, 'hero-mobile']]) {
    const dir = `${TMP}/${name}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const page = await open(w, h, BASE.replace('quality=high', 'quality=balanced'));
    await gotoT(page, 0, { settle: 2000 });
    const total = (LEN + EXTRA) * FPS;
    for (let i = 0; i < total; i++) {
      await page.evaluate((c) => { window.__777.frame.clock = c; }, i / FPS);
      await page.waitForTimeout(60);
      await page.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
    }
    await page.close();
    const py = `
from PIL import Image
import os
d=${JSON.stringify(dir)}; F=${FPS}; L=${LEN}
os.makedirs(d+'/loop', exist_ok=True)
for i in range(L*F):
    a = Image.open(f'{d}/f{i:04d}.jpg')
    if i < F:
        b = Image.open(f'{d}/f{i+L*F:04d}.jpg')
        w = i / F
        a = Image.blend(b, a, w)
    a.save(f'{d}/loop/l{i:04d}.jpg', quality=93)
`;
    execFileSync('python3', ['-I', '-c', py]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', `${dir}/loop/l%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', `${OUT}/${name}.mp4`]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', `${dir}/loop/l%04d.jpg`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-an', `${OUT}/${name}.webm`]);
    console.log('video', name);
  }
}
await browser.close();
