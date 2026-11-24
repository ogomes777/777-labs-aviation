// Copia fontes OFL (Fontsource) para src/app/fonts — auto-hospedadas, sem chamada externa em runtime.
import { copyFileSync, mkdirSync } from 'node:fs';
const out = new URL('../src/app/fonts/', import.meta.url);
mkdirSync(out, { recursive: true });
const files = [
  ['@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-standard-normal.woff2', 'BodoniModa-Variable.woff2'],
  ['@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-standard-italic.woff2', 'BodoniModa-Variable-Italic.woff2'],
  ['@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', 'Manrope-Variable.woff2'],
  ['@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2', 'Cormorant-Variable.woff2'],
  ['@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2', 'Cormorant-Variable-Italic.woff2'],
  ['@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2', 'PinyonScript-Regular.woff2'],
];
for (const [src, dst] of files) {
  copyFileSync(new URL(`../node_modules/${src}`, import.meta.url), new URL(dst, out));
  console.log('font', dst);
}
