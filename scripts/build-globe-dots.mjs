// Gera pontos de terra para o globo a partir do Natural Earth 110m (domínio público) via world-atlas (ISC).
// Saída: src/content/globe-dots.json — [lat, lon] quantizados (0.1°). Executado em build-time, não em runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';
const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);
const dots = [];
// Distribuição aproximadamente uniforme na esfera: passo em latitude constante, passo em longitude ∝ 1/cos(lat)
const step = 1.55; // graus
for (let lat = -58; lat <= 82; lat += step) {
  const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step));
  for (let i = 0; i < n; i++) {
    const lon = -180 + (i + (Math.abs(Math.round(lat / step)) % 2) * 0.5) * (360 / n);
    if (geoContains(land, [lon, lat])) dots.push([Math.round(lat * 10) / 10, Math.round(lon * 10) / 10]);
  }
}
writeFileSync(new URL('../src/content/globe-dots.json', import.meta.url), JSON.stringify(dots));
console.log('globe dots:', dots.length);
