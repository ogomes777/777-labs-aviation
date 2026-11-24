# 777 LABS AVIATION — Concept by SET77 Labs

**Produção:** https://777-labs-aviation.vercel.app

Showroom cinematográfico **conceitual** de aviação executiva: um único filme interativo, conduzido pelo scroll e pelo toque, do céu ao hangar, da frota à cabine, dos destinos à conversa.

> 777 LABS AVIATION é uma marca conceitual criada pela SET77 Labs para demonstrar experiência digital. Não opera voos, não possui aeronaves, frota, AOC ou licenças, e não comercializa fretamentos. O formulário funciona em **modo demonstração**: valida tudo (cliente e servidor) e não envia nada sem uma integração configurada.

## A jornada (9 capítulos, uma câmera)
| # | Capítulo | O que acontece |
|---|---|---|
| 1 | Atmosfera | Jato 3D sobre o mar de nuvens ao amanhecer; turbinas girando, filetes de ar, rastros, véus de nuvem atravessando a lente |
| 2 | Limiar | A câmera atravessa a janela; a luz quente da cabine toma o lugar do céu |
| 3 | Aeronave | Hangar escuro, luz rasante; perspectivas Exterior / Cabine / Detalhes |
| 4 | Frota | Galeria horizontal ligada ao scroll: a câmera percorre 5 aeronaves (3 jatos, turboélice, helicóptero). **Ver por dentro**: desmonta e monta peça por peça; **Planta**: teto cortado e poltronas; escolha uma e veja a vista sentado |
| 5 | Anatomia | Estúdio marfim, vista de planta, sistemas com pontos e vista explodida |
| 6 | Interior | Cutaway do teto e mergulho até o corredor |
| 7 | Cabine | Lounge, mesa, suíte e janela — a câmera percorre a cabine 3D |
| 8 | Destinos | O traço nasce na janela e desce até o globo; malha de rotas, filtros, distância calculada |
| 9 | Contato + epílogo | Formulário em vidro sobre o céu do entardecer, com tráfego aéreo ao fundo |

## Stack
Next.js 16 (App Router) · TypeScript · GSAP ScrollTrigger · Lenis (só desktop, sincronizado ao ticker do GSAP) · three.js · React Three Fiber · drei · postprocessing (N8AO, DOF, bloom, efeitos próprios de lente/grade/velocidade) · Zod.

## Rodar
```bash
npm ci
npm run prepare:data   # pontos do globo (Natural Earth) + fontes OFL locais (já versionados)
npm run build && npm start   # http://localhost:3000
```
Qualidade/QA por URL: `?quality=high|balanced|lite`, `?motion=cinematic|lite|reduced`, `?webgl=0`, `?perf=lock`, `?qa=1`.

## Testes
```bash
npm run typecheck
npm test                    # unitários (Vitest)
npx playwright test         # E2E desktop 1440×900 e mobile 390×844
node scripts/qa-vitals.mjs  # LCP / CLS / INP aproximado / long tasks
```

## Mídia original
Toda imagem e vídeo vem da própria cena: `npm run render:media` (servidor em :3777) gera poster, stills dos capítulos, cards da galeria, imagem social e o loop de nuvens do modo Leve. Ver `docs/ASSETS_E_LICENCAS.md`.

## Desempenho e acessibilidade
- Tiers por capacidade (WebGL2, toque, CPU/memória, economia de dados, renderizador por software) + **regulador em tempo real** que mede o FPS e ajusta efeitos e resolução (níveis 0–3, com histerese).
- H1, CTA e formulário são HTML semântico, nunca dependem do WebGL; o bundle 3D é carregado depois do primeiro paint.
- `prefers-reduced-motion` e o seletor "Movimento" (Cinemático / Leve / Reduzido) removem pins, scrub e animações sem esconder conteúdo. Sem WebGL: modo Leve com imagens da mesma cena.
- Navegação por teclado, foco visível, skip link, diálogos com Escape, carrosséis com setas, galeria/frota com swipe nativo no mobile (sem sequestro do scroll).

## Integração real do formulário
Defina `INQUIRY_WEBHOOK_URL` (e opcionalmente `INQUIRY_WEBHOOK_SECRET`) — a API só confirma após resposta 2xx do destino. Ver `.env.example`.

## Documentos
`docs/G0_INVENTARIO.md` (inventário e gaps) · `docs/ASSETS_E_LICENCAS.md` · `qa/RELEASE_REPORT.md` (aceite) · `CLAUDE.md` (contrato de execução) · `.claude/agents`, `.claude/skills`.
