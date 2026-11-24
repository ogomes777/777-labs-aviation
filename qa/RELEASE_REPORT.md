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

## Testes executados (resultados reais)
| Suíte | Resultado | Arquivo |
|---|---|---|
| Typecheck (`tsc --noEmit`) | ✔ sem erros | — |
| Unitários (Vitest) — validação, haversine, curvas | ✔ 10/10 | `tests/unit/core.test.ts` |
| E2E Playwright — desktop 1440×900 + mobile 390×844 | ✔ **36/36** (4 pulados por serem de outro viewport) | `qa/e2e-results.txt` |
| Build de produção (`next build`) | ✔ | — |
| Clique real na inspeção (desmontar, foco em peça, planta, poltrona, helicóptero) | ✔ sem erros de página | `qa/screenshots/inspect/*` |

Casos E2E cobertos (de `06_QA/TESTES_E2E.md`): carga sem erros e sem scroll horizontal; tier alto com todos os efeitos sem erros; H1/CTA antes do WebGL; landmarks/H1 único/skip link; navegação "Explorar" (cinemático e reduzido) com foco no título; menu modal (mouse, Enter, Escape, foco devolvido); scroll reverso rápido sem congelar; galeria por botões e teclado (1→4→1); swipe nativo da galeria no mobile; perspectivas do hangar; anatomia (sistema + vista explodida); destinos (filtro, seleção, distância, envio ao formulário); frota (carrossel, inspeção, peça, planta, Escape); formulário (origem=destino, data passada, passageiros >20, consentimento, foco no primeiro erro); modo demo nunca promete envio; API 422/demo; reduced motion sem canvas e com conteúdo íntegro; WebGL desligado com stills e CTA; preferência de movimento persistida.

## Desempenho medido (`qa/performance/*.json`)
| Modo | LCP | CLS | INP aprox. |
|---|---|---|---|
| Desktop cinemático (tier alto) | 132 ms | 0,0001 | *ver nota* |
| Desktop leve (sem WebGL) | 204 ms | 0 | 112 ms |
| Mobile cinemático (balanceado) | 108 ms | 0 | 248 ms |
| Mobile reduzido | 148 ms | 0 | 128 ms |

**Custo de CPU do loop de direção por quadro:** 0,3–0,9 ms de média em todos os capítulos (orçamento de 60 fps: 16,7 ms) — `qa/performance/cpu-per-frame.json`.

**Nota honesta:** no tier alto, o INP e as long tasks medidos aqui (segundos) são dominados pelo desenho via SwiftShader, que bloqueia a thread principal por contrapressão de GPU emulada. Isso não mede GPU real. Mitigações implementadas e ativas em qualquer aparelho: compilação assíncrona de shaders antes do primeiro desenho e para cada aeronave da frota; construção da frota apenas em ociosidade; cache de programas unificado entre variantes; regulador de qualidade 0–3 por FPS real com histerese e DPR adaptativo; error boundary que desliga a pós-produção se a GPU não suportar algum recurso. **Pendente:** medir FPS/INP em aparelhos físicos (desktop com GPU integrada, Android de entrada, iPhone).

## Checklist de aceite (`06_QA/CHECKLIST_ACEITE.md`)
| Item | Pts | Avaliação |
|---|---|---|
| Hero original, H1 < 3 s | 5/5 | LCP ≤ 0,2 s; H1 é HTML |
| Curvas e luz sem jump | 5/5 | véus de luminância (nunca preto), câmera amortecida, foco com inércia, roll de operador, adaptação de exposição |
| Câmera exterior→interior coerente | 5/5 | cabine modelada dentro da mesma geometria; mesmo sistema de coordenadas |
| Galeria sem overflow indesejado | 5/5 | E2E sem scroll horizontal; swipe nativo no mobile |
| 2 modos visuais com contraste | 5/5 | sky pearl / night hangar / ivory / cabin; painéis com vidro para contraste |
| Botões/menus/âncoras funcionais | 5/5 | E2E |
| Form valida entradas e consentimento | 5/5 | Zod cliente + servidor; E2E |
| Status demo vs envio real | 5/5 | "Demonstração concluída: nenhum pedido foi enviado"; modo real só com 2xx |
| Seleção reativa (card/modelo/hotspot) | 5/5 | frota, peças, poltronas, destinos, perspectivas |
| Scroll volta corretamente | 5/5 | E2E scroll reverso |
| LCP/CLS/INP medidos e reportados | 4/5 | medidos; INP do tier alto não representativo (GPU emulada) |
| Animação não bloqueia scroll | 4/5 | CPU 0,3–0,9 ms/quadro; sem medição de GPU real |
| WebGL sem vazamentos | 4/5 | dispose em todas as construções; não perfilado com heap snapshot |
| Mídia por dispositivo / carregamento progressivo | 5/5 | poster AVIF/WebP desktop/mobile, vídeo mp4/webm desktop/mobile, frota em idle |
| Breakpoints revisados | 4/5 | 1440×900 e 390×844 com evidência; 320/768 não capturados |
| Reduced motion preserva conteúdo | 5/5 | E2E |
| Teclado + foco + labels | 5/5 | E2E |
| Mobile sem hijack/overflow | 5/5 | E2E |
| README, build, deploy preview, testes | 3/5 | README, build e testes ✔; **deploy não publicado** (sem credencial Vercel) |
| Mídia/licenças verificadas | 5/5 | `docs/ASSETS_E_LICENCAS.md` |
| **Total** | **94/100** | zero bugs críticos conhecidos |

## Bugs encontrados e corrigidos durante o QA
1. Pós-produção: efeito com transformação de UV + convolução derrubava todo o canvas no tier alto → removido; error boundary adicionada; teste E2E do tier alto.
2. Céu desenhado por cima do jato (material transparente sem teste de profundidade).
3. Faces da fuselagem invertidas (revestimento interno invisível).
4. Pilones e raiz da asa atravessando a parede da cabine.
5. Intro do H1: dois controladores na mesma propriedade (GSAP intro × timeline de scroll) e `y` herdado do CSS.
6. Navegação por âncora chegava antes da revelação (foco impossível).
7. Manchas pretas nos realces da cabine no tier alto: isoladas por eliminação (balanceado limpo → nível 0 limpo → sem DOF/AO ainda manchado) até a aberração cromática/ruído de película, que interagiam mal com valores HDR; ambos removidos (grão migrou para camada CSS) e adicionados dois guardas (saneamento HDR antes da pós e guarda de NaN no fim). O flare anamórfico experimental também foi removido por gerar faixas fantasmas.
8. Foco do formulário fora da ordem visual; seleção de peça desfeita pelo clique; mapa 2D cobrindo filtros no mobile; índice de carrossel ambíguo em viewport largo.

## Limites e próximos passos
- **Deploy:** publicar na Vercel requer um token cadastrado em `api.vercel.com` nos segredos do ambiente; depois, `vercel deploy --prod`.
- **Fontes de referência** (Casko Luxury, Angelin, Chasa Marelo, Moonscape): comerciais/demo; substituídas por OFL equivalentes. Com licença e arquivos, a troca é feita em `src/app/layout.tsx`.
- **Repositório remoto:** `gh` sem token válido nesta sessão; o repositório git local está completo.
- Testes em dispositivos físicos e Lighthouse em rede real (CrUX) quando houver URL pública.
