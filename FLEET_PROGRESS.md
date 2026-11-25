# FLEET_PROGRESS — SimFly MASTER V6 (relatório contínuo)

Branch de desenvolvimento: `simfly/v6-master` (criada a partir de `simfly/v28-approved-baseline` @ `340bb7d`, verificada com `git fsck`).
Base aprovada preservada: `simfly/v28-approved-baseline` não é alterada. **Nada publicado em produção.**
Ambiente local: `npx next dev -p 7777` → http://localhost:7777 (QA cinematográfico em headless: `?qa=1&quality=balanced&perf=lock`).
Pacote V6: `simfly-fleet-pack/` (docs, data, starter, scripts, referências). Agentes/skills do pacote mesclados em `.claude/` sem sobrescrever os existentes. Regras mescladas no `CLAUDE.md`.

## Escopo confirmado pelo usuário (25/11/2026)
- Seção de **anatomia** (capítulo 04, avião único conceitual): **permanece com um único avião**; recebe somente a camada de preview hover/foco/toque.
- Seção **Frota/Hangar** (capítulo 07, `data-chapter="3"`): troca a frota fictícia (Meridian/Solstice/Aurora/Horizon/Zenith) pelas **cinco aeronaves anunciadas** pela SimFly.
- Executar o pacote completo (V5 + V6), sem regressões, sem deploy.

| Gate | Status | Evidências | Bloqueios |
|---|---|---|---|
| G0 auditoria | concluído | tsc OK, vitest 10/10, capturas base em `qa/v6/base/` | — |
| G1 fluxo comercial | implementado | `src/content/fleet.ts`; cards com fabricante/tipo/ano/categoria corrigida/status + 3 fatos + Detalhes; CTA WhatsApp pré-preenchido (sem envio automático) + e-mail | disponibilidade/status precisam de confirmação da SimFly antes de produção |
| G2 exteriores | implementado (ilustrativo) | `src/three/fleet/{specs,airframe}.ts`; envelope L×E×A calibrado por EASA/Embraer | GLB licenciado por exemplar: **Asset Gate bloqueado** (sem material/licença) |
| G3 atlas | implementado | hotspots + preview (hover/foco/toque armado), sistema isolado, raio-X, desmontagem, órbita 360° (drag/teclado), breadcrumb | microvídeos de preview não produzidos (somente PNG/WebP) |
| G4 plantas/cabines | implementado (ilustrativo) | planta com teto cortado + poltronas pela capacidade anunciada, rótulo "Configuração ilustrativa" | plantas reais dos exemplares não fornecidas |
| G5 QA | em andamento | ver "Resultados" | dispositivo físico móvel não disponível neste ambiente |

## Decisões e evidências de pesquisa (aviation-researcher, 25/11/2026)
- simfly.site (Lovable SPA): 5 anúncios confirmados; contato WhatsApp +55 34 99138-6000 / contato@simfly.com.br; nenhum preço publicado.
- **Imagens do portfólio:** 4 de 5 têm metadado IPTC "Made with Google AI" (trainedAlgorithmicMedia); a do Praetor 500 tem marca d'água ©dbfoto.com. **Não usar como referência geométrica nem como foto do exemplar.** Nenhuma imagem da SimFly foi copiada para o projeto.
- Matrix: EASA TCDS IM.A.077 §D — monomotor a pistão turboalimentado, **não pressurizado**, seis lugares, hélice Hartzell 80 pol (3 pás). O rótulo "Jato leve" do anúncio foi corrigido na UI e registrado em `FLEET[].audit`.
- Envelopes (m): Legacy 450 19,68 × 20,25* × 6,43 (*EASA informa 19,25 m; secundárias 20,25 m — conflito exibido no atlas); Praetor 500 19,68 × 21,50 × 6,43; Praetor 600 20,74 × 21,50 × 6,44; Matrix 8,81 × 13,11 × 3,44; CJ2+ 14,53 × 15,09 × 4,32 (EASA IM.A.078; cauda em T confirmada).
- Diferença visível Legacy 450 × Praetor 500: winglets maiores/redesenhados (ANAC OE). Geometria do winglet: não verificada → ilustrativa.
- Janelas por lado (ilustrações Embraer): EMB-545 = 5, Praetor 600 = 7. Matrix/CJ2+: não verificado (aproximação).
- "9 pax"/"12 pax" do anúncio são capacidade máxima; padrão Embraer 7/8. Mantido como "passageiros anunciados".

## Arquivos alterados / rollback
- Novos: `src/three/fleet/specs.ts`, `src/three/fleet/airframe.ts`, `src/components/preview/{usePreview.ts,HotspotPreview.tsx}`, `src/content/previews.ts`, `src/app/lab/preview/*` (só dev; 404 em produção), `scripts/render-previews.mjs`, `scripts/png2webp.py`, `public/media/previews/**`, `simfly-fleet-pack/**`, `FLEET_PROGRESS.md`.
- Alterados: `src/content/fleet.ts` (frota real), `src/components/FleetShowroom.tsx`, `src/components/AnatomyPanel.tsx` (só preview), `src/three/Experience.tsx` (fila real, câmera do atlas, raio-X, isolamento, hotspots; avião conceitual oculto apenas no hangar), `src/experience/{director,domRefs}.ts`, `src/components/ExperienceRoot.tsx` (reset do atlas), `src/lib/analytics.ts`, `src/styles/global.css` (bloco V6 no fim), `tsconfig.json` (exclui o pacote), `CLAUDE.md`.
- Rollback: `git checkout simfly/v28-approved-baseline` (base intacta) ou `git revert` dos commits V6.

## Pendências por modelo (dependências de assets/documentação)
- Todos: fotos licenciadas dos dois lados, topo, frente, traseira e interior do **exemplar**; planta da configuração anunciada; serial/matrícula se autorizado; confirmação de status.
- Legacy 450: resolver envergadura (ANAC TCDS EA-2014T04); layout 8 pax + lavatório.
- Praetor 500: forma do winglet; planta 9 pax.
- Praetor 600: planta/galley/lavatório; carenagem ventral (skid) não modelada.
- Matrix: lado/posição da porta (não verificado), número de pás do exemplar (S/N), cockpit.
- CJ2+: janelas, porta, cockpit e pintura do exemplar.

## Rodada de fidelidade visual (pedido do usuário: "tem que ser igual aos aviões da landing SimFly")
- Referências usadas (estudo, não publicadas): vistas superior/lateral **cotadas** das brochuras Embraer Praetor 500/600 (out/2020, p.19) renderizadas em 240 dpi; foto lateral Commons `Piper_PA-46_Matrix_Deurne_03.JPG` (CC BY-SA); imagens dos cards da landing SimFly (somente pintura/aparência — 4/5 são IA).
- Medido (escala pela envergadura 21,50 m e comprimento 19,68/20,74 m): largura da fuselagem 2,33 m; fuselagem EMB-545 ≈ 17,85 m e EMB-550 ≈ 18,9 m (o comprimento total inclui as pontas do estabilizador em T); raiz da asa a ~6,5 m do nariz (P500), corda de raiz ~4,4 m com **quebra do bordo de fuga** (~30% da semienvergadura), enflechamento do bordo de ataque ~32°; naceles ~3,65 m centradas a 13,45 m (P500) / 14,55 m (P600), 2,0 m do eixo; deriva ~46° com filete dorsal; porta logo atrás do cockpit (4,4 m P500 / 4,65 m P600); janelas 5 (EMB-545) / 7 (EMB-550).
- Aplicado no gerador: nariz longo e caído (Embraer/Citation), comprimento de fuselagem real + estabilizador até o comprimento total, quebra do bordo de fuga, filete dorsal, naceles maiores e mais altas, janelas laterais de cockpit, capô longo do Matrix, janelas do Matrix mais altas/maiores.
- Pinturas fiéis aos cards da landing: Legacy 450 pérola + ventre marinho subindo à cauda, deriva/naceles marinho, filete dourado; Praetor 500 branco + dois frisos escuros; Praetor 600 branco + ventre/deriva pretos e naceles escuras; Matrix branco + ventre preto e filete dourado; CJ2+ branco + faixa marinho e dourado em curva.
- Comparativos lado a lado gerados por `scripts/render-views.mjs` (vistas lateral/superior/frontal/3-4 do laboratório `/lab/preview`, só em dev).
- Limite honesto: igualdade "de exemplar" (cada detalhe, matrícula, interior real) exige fotos/documentos dos aviões anunciados; as fotos da landing não servem como prova geométrica.


## Rodada "pátio de preparação" (pedido do usuário, 25/11/2026 noite)
- Envergadura do Legacy 450 fechada em **20,25 m (66 ft 5 in)**: AOPA 2016 (ficha do fabricante), Airport-Technology e tabela Legacy 450/500; coerente com o Praetor 500 (+~0,63 m por winglet → 21,50 m). O 19,25 m do TCDS EASA é tratado como erro de digitação (nota no atlas).
- Para-brisa do Matrix refeito como peça envolvente contínua com montante central e fundo escuro pintado (sem frestas).
- Cenário trocado de hangar para **pátio de preparação de aviação executiva ao entardecer**: concreto com brilho de umidade (refletor por tier), terminal/hangar FBO ao fundo com três portões abertos e interior aquecido, bloco de vidro com janelas quentes, torres de holofote com halo, linhas de táxi/entrada/parada, luzes azuis de táxi, cones nas posições, céu dourado, serra e sol baixo, pista distante com luzes. Luz de sol quente por trás (rim), hemisférica de exterior, mapa de ambiente "sky".
- Coreografia: as cinco aeronaves estacionadas lado a lado (fila em z=34) sempre no quadro; a escolhida pelo scroll/toque **taxia para frente** (z=−14), centraliza e gira para 3/4; as demais **recuam, se afastam lateralmente e ficam translúcidas** (opacidade 0,3; 0,16 durante o atlas). Interpolação contínua com o índice da galeria; movimento em tempo real (independe do FPS); variantes de shader pré-compiladas.
- "A frota.": varredura azul + brilho que respira (mesma linguagem das copys acima). Jato SimFly em PNG (asset aprovado) entra da esquerda, freia e flutua pulsante atrás da copy, menor/minimalista; some no atlas; estático com reduced motion.

## Atlas de peças (V6)
- Toda malha tem ID de peça ligado ao catálogo; cobertura verificada no navegador: 100% dos itens listados no atlas têm malha real em cada aeronave (Matrix sem winglet/turbina; CJ2+ sem winglet; lavatório só no Legacy, conforme anúncio).
- Novas micropeças: radome/capô, luzes de navegação, pitots/antenas, freios, cockpit (painel + assentos de tripulação), compressor/câmara/turbina/eixo/caixa de acessórios, cárter/cilindros/turbo/intercooler, tanques de combustível.
- Selecionar uma peça isola a malha (demais em fantasma de raio-X) e reenquadra a câmera.

## Próxima ação concreta
Regenerar previews após cada mudança de geometria (`node scripts/render-previews.mjs fleet && python3 -I scripts/png2webp.py public/media/previews`), capturas 1440×900/390×844, build de produção e e2e.

## Resultados e medições reais
- tsc OK; vitest 19/19 (inclui `tests/unit/fleet.test.ts`: dados do anúncio, Matrix ≠ jato, CTA, envelopes, catálogo de previews com mídia existente).
- Fluxo desktop (Playwright, swiftshader): hover → preview → clique → sistema isolado → raio-X → conjunto → abrir em camadas (rótulo vira "Montar aeronave") → órbita → planta → Escape volta um nível. OK.
- Fluxo mobile 390×844: 1º toque arma o preview (data-armed=true, sem abrir o atlas); CTA confirma e abre o sistema. OK.
- Carga da fila: 5 aeronaves construídas em ~10 s no headless (corrigida inanição do requestIdleCallback com `timeout`). 37–62 mil triângulos por aeronave.
- Previews: 78 WebP (35 frota + 43 anatomia) ≈ 0,8 MB, carregados só ao abrir o card.
- FPS: medição em swiftshader (CPU) não representa GPU real — medição em dispositivo físico pendente.
