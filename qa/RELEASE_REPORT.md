# RELEASE REPORT — 777 LABS AVIATION
Data: 24/11/2026 · Build: Next.js 16.4.6 (produção) · Ambiente de QA: container Linux, Chromium headless com **SwiftShader** (GPU emulada em CPU)

> Limite de medição: o ambiente não tem GPU física nem dispositivos reais. Screenshots, fluxos e Web Vitals foram medidos aqui; FPS e custo de GPU **não** representam hardware real (o SwiftShader roda a poucos quadros por segundo). O regulador adaptativo de desempenho foi validado por lógica e por QA com `?perf=lock`, não por medição em aparelhos físicos.

## Gates
| Gate | Status | Evidência |
|---|---|---|
| G0 inventário + gaps | ✔ | `docs/G0_INVENTARIO.md` |
| G1 tokens, direção, protótipo | ✔ | `src/styles/tokens.css`, `src/experience/*`, gerador paramétrico `src/three/jet/*` |
| G2 hero + janela-portal + hangar | ✔ | `qa/screenshots/{desktop,mobile}/t0.00 … t2.30` |
| G3 frota, anatomia, cutaway, cabine, galeria | ✔ | `qa/screenshots/inspect/*`, `t3.*`, `t4.*`, `t6.*` |
| G4 globo, formulário, API, epílogo | ✔ | `t7.*`, `t8.*`, testes E2E de formulário/API |
| G5 fallbacks, mídia gerada, reduced motion, performance | ✔ (ver limites) | `public/media/*`, `qa/performance/vitals.json`, testes de reduced motion / WebGL off |
| G6 CI, testes, deploy, relatório | ◐ | CI em `.github/workflows/ci.yml`; deploy de produção **bloqueado** (sem credencial Vercel nesta sessão) |
