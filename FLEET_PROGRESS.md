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


## Rodada "aeroporto vivo" (26/11/2026)
- Cenário refeito como **campo de aviação executiva** com elementos que só existem em aeroporto, seguindo a lógica visual ICAO Anexo 14 (ilustrativo): pista 45 m com eixo 30/20 m, 12 faixas de cabeceira, "27", zona de toque e ponto de visada, luzes de borda/cabeceira, PAPI, luzes de aproximação com lampejo sequencial; táxi com eixo amarelo, luzes azuis e marcação de espera; torre de controle com farol giratório e luz de obstáculo; terminal envidraçado aceso; hangar de portão aberto com interior iluminado e jato dentro; torres de holofote com feixe e poça de luz; biruta; cones reais (corpo laranja, faixas refletivas, base) nas pontas de asa/cauda de cada posição; linha de eixo e barra de parada por aeronave calculadas pelas dimensões do tipo; concreto em placas com juntas, manchas e marcas de pneu.
- Vida: dois jatos de tráfego (mesmo gerador da frota, sem rótulo comercial) em ciclos de pouso defasados — aproximação a 3°, arredondamento, toque e frenagem, farol de pouso e strobes; três carrinhos de pátio circulando com faróis e lanternas.
- Câmera-protagonista: dolly até a escolhida com distância calculada pelo tamanho real dela (Matrix/CJ2+ não ficam menores que os jatos ao fundo); enquadramento vertical pela lente acima dos cards; não escolhidas mais visíveis (opacidade 0,6).
- PNG SimFly menor e mais vívido (saturação + glow pulsante), mesma animação; cards mobile enxutos (1 fato visível, ações compactas).

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
- E2E completo (build de produção limpo, desktop+mobile, 25/11 noite): 26 passaram (todos os da Frota, galeria, destinos, formulário, API); 14 falharam. **Os mesmos 14 falham na base aprovada `simfly/v28-approved-baseline` intacta** (rodado em worktree separado): testes legados do herói/anatomia/resiliência que procuram o link "Explorar" e "zero canvas", removidos/alterados pela V28. Não são regressões da V6; atualizar esses testes é tarefa à parte (exige decidir o comportamento esperado do herói V28).

## Publicação em produção (autorizada pelo usuário em 26/11/2026)
- Testes antes do deploy: tsc OK; vitest 19/19; build de produção OK; E2E (Frota, formulário, galeria, destinos, estrutura) 19 passaram, 1 falhou — "H1 e CTA antes do WebGL" no mobile, que já falha na base V28 aprovada intacta (legado, não regressão).
- Deploy Vercel `dpl_49ZcMZNhrKGdUPCiB2i22KW2b4bA` (target production) a partir de `simfly/v6-master` @ `55fc8f7`, via conector Vercel (fonte GitHub).
- Verificado em https://777-labs-aviation.vercel.app: HTML com a frota real (Legacy 450 … Matrix, sem Meridian/Solstice), `/lab/preview` = 404, previews WebP = 200.
- Rollback: promover o deploy de produção anterior `dpl_H2bHBUndXNE8hRJVqBgnewRqxaaa` no painel da Vercel (marcado como candidato a rollback).

## Rodada de correções (26/11/2026, pós-produção)
- Câmera: corte direto para o enquadramento da Frota (removida a mistura de 2–3 s com a pose do capítulo anterior).
- Piscar (linhas, vidros, portões): plano próximo da câmera = 0,5 m na Frota (0,02 m só na cabine/vista sentado) + marcações com polygonOffset e camadas separadas.
- PNG SimFly entra junto com "A frota." (amarrado ao progresso do capítulo).
- 360°: rotação no loop 3D (frame.orbitYaw/Pitch), sem re-render React ao arrastar — verificada.
- "Ver por dentro": raio-X automático (~2,2 s) e volta ao normal; depois a pessoa escolhe sistema/peça — verificado.
- Planta: substituída por planta técnica 2D (SVG em metros, mesma especificação do 3D): casco, cockpit, porta, janelas, poltronas clicáveis → vista sentado, lavatório só no Legacy, cotas só com fonte.
- Cards: ano e "Detalhes" não cortam mais. Aeronaves em resolução maior (textura 2048, detalhe 0,85–1).
- Removidos a seção Destinos (globo de baixo) e o formulário de viagem; contato direto SimFly (WhatsApp/e-mail) mantém #planejar; testes dos recursos removidos excluídos.
- Testes: tsc OK, vitest 19/19, build OK; E2E subset 12 passaram; "menu abre/fecha" no mobile é instável (2/3 passam isolado; menu não foi alterado).
- Publicado em produção (autorizado pelo usuário): deploy `dpl_2HK2FPLhAuBCs9KEGU6XUhpuRrZC` de `simfly/v6-master` @ `2214c8c`. Verificado em https://777-labs-aviation.vercel.app: contato direto presente, seção Destinos e formulário de viagem ausentes, frota real, `/lab/preview` = 404. Rollback: promover `dpl_49ZcMZNhrKGdUPCiB2i22KW2b4bA` (versão anterior da V6).

## Rodada de correções (26/11/2026, 3ª)
- Rolar/arrastar com o atlas aberto fecha o painel e segue para a próxima aeronave (verificado: legacy-450 → índice 2 sem clicar em Fechar); a área do 360 não bloqueia mais a roda nem o toque vertical (sem data-lenis-prevent; touch-action pan-y).
- Raio-X contínuo: camada fresnel sobreposta surge enquanto a pele esmaece (e o inverso), em tempo real; sem troca brusca de material.
- 360: sem seleção de texto ao arrastar; aviso "Arraste · 360°" minimalista no canto, sem caixa; "Redefinir vista" volta ângulo, sistema, peça, montagem e raio-X.
- Cenário em 360°: domo de céu completo, serra em anel com tom atmosférico, chão de campo em todas as direções (sem fundo preto); marquise do terminal com forro iluminado.
- "A frota." e PNG SimFly menores; o PNG não some mais ao abrir o atlas. Planta com entrada premium e posicionada fora do painel. Desmontagem com deslocamentos maiores.
- (4ª) Peça isolada: camadas de raio-X ocultas durante o foco (causavam a peça aparecer "fantasma"/como outra). Cenário: marcas de pneu na zona de toque da pista, anel de nuvens em todo o 360°, jato real (gerador da frota) estacionado no hangar de portão aberto no lugar da silhueta.
- Publicado em produção (autorizado): deploy `dpl_4rHiJTyJyH9LTnXKC2ucqoCQtWRt` de `simfly/v6-master` @ `b011a5c` — READY e com alias em https://777-labs-aviation.vercel.app (confirmado pela Vercel). Antes: regressão do atlas (fechava ao abrir aeronave não destacada) encontrada pelos E2E e corrigida; E2E da frota 12/12 em build limpa. Observação de QA: `pkill -f "next start"` não encerra o `next-server` filho — encerrar pelo PID para não testar contra build antiga. Rollback: promover `dpl_2HK2FPLhAuBCs9KEGU6XUhpuRrZC`.

## Rodada V7 — 2026-11-26 (header, idiomas, temas, copy SimFly, test drive)

Pedido do usuário (manhã de 26/11): header estilo Araras/Apple glass, idiomas e temas funcionais, copy no contexto real da SimFly (intermediação de compra e venda BR/EUA), limpeza de microcopy, correções de seção, globo final, test drive jogável e desempenho.

Feito e verificado localmente:
- Header de vidro em cápsula: tema (Céu/Noite) e idiomas à esquerda, logo SimFly vetorizada (traçada da marca do site oficial, sem a frase) no centro com o jato da marca cruzando a barra, "Fale conosco" (WhatsApp) e menu à direita. Menu em folha de vidro com os capítulos do site comercial (Sobre, Serviços, Portfólio, Procuramos, Contato), girando como dado no hover/toque.
- 9 idiomas com troca ao vivo (pt, en, es, it, fr, de, ja, zh, ko): catálogo `src/i18n/messages/*`, carregamento sob demanda, detecção do navegador, `?lang=`. Tudo traduzido, inclusive frota, atlas, anatomia, planta e voo.
- Tema Noite na mesma paleta azul (branco → marinho, marinho → gelo, azul → céu); 3D com gradação de luar em espaço linear; mídia com leve ajuste noturno.
- Copy reescrita a partir de simfly.site; seções novas Serviços (em "Entre partir e chegar"), Procuramos (R66, King Air C90 GTX 2018, Citation Sovereign — dados do site) e Contato. Sem preços ou dados inventados.
- Removidos: cards de cidades do globo, "03 / DESTINOS" e demais rótulos, índice de capítulo, barra de scroll do hero, contagens, ícones/setas, divisórias entre seções. Rótulo de ilustração 3D mantido (regra do projeto).
- Nuvens após o hero dissolvem durante a travessia (fim da placa parada).
- Anatomia: o ponto da cauda ficava sob o painel (prévia não abria) — corrigido com camada acima.
- "Entre partir e chegar": sem borrão escuro e sem dourado; brilho azul mais presente.
- Globos: atmosfera e borda de luz mais fortes, rotas em azul-gelo aditivo; o globo final mantém o lado das rotas e gira por arraste (mouse 2 eixos, toque horizontal). Cards da frota saem antes do globo entrar.
- Test drive (botão único na Planta): mesma aeronave e mesmo aeródromo da Frota; partida de motores com som sintetizado (Web Audio, sem arquivos), decolagem, voo livre (piloto automático cênico sobre o litoral, o mar e acima das nuvens), pouso automático na pista com arredondamento e frenagem, decolar de novo; WASD/setas, Shift/Ctrl, Espaço, L, F, C, M, Esc; manche virtual no toque; 360° arrastando; no celular em pé a cena gira sozinha para paisagem. Mundo procedural (talhões, praia, oceano com reflexo do sol, nuvens volumétricas em mosaico), sem imagens chapadas. Teste unitário `tests/unit/flight.test.ts` (Legacy 450, Matrix, CJ2+ decolam, sobem e pousam dentro da pista).
- Desempenho: o WebGL pausa quando o canvas está 100% coberto (hero em vídeo, jornada/globo opacos, nuvens) — antes renderizava 3D invisível em ~1/3 da rolagem.

Pendências honestas: FPS medido só em swiftshader (sem aparelho real); logo traçada de um raster de 360 px (se a SimFly enviar SVG/PNG 4K original, trocar `src/components/SimFlyLogo.tsx`).

### Publicação V7 em produção
- dpl_YAtz92xhfP4dMAFgFEk1ycCLA5Mf (commit c510c83), READY, alias 777-labs-aviation.vercel.app. Autorizado pelo usuário em 26/11 ("pode subir pra produção… não precisa me pedir").
- Rollback: dpl_4rHiJTyJyH9LTnXKC2ucqoCQtWRt (V6, b011a5c).
- Testes: unitários 22/22; E2E da Frota e do menu passando; falhas E2E restantes são as legadas da base V28 (canvas do globo 2D em modo reduzido, link "Explorar", timeouts de cenas cinemáticas no swiftshader).
- Complemento V7: dpl_5qaha3akDcRf4UY2rS4q5K8bW1ap (commit aed3e24) — hélice/fans girando no voo, hangar com chapa metálica, cobertura e janelas altas, globo final em marinho realista com borda de luz. Rollback: dpl_YAtz92xhfP4dMAFgFEk1ycCLA5Mf.

### V7.2 — header premium, menu de aviação, tema Crepúsculo (26/11)
- Segundo tema refeito como "Crepúsculo" (índigo/violeta claro); "Noite" (escuro demais) e "Glacial" (turquesa puxando para verde) descartados a pedido. 3D gira só a família azul, mantendo o pôr do sol.
- Header: vidro mais forte com borda especular, logo cromada com profundidade, jato da marca maior em órbita ondulada passando por trás e pela frente da logo, ícone vazado de aviãozinho de papel (abre o WhatsApp), botão de idiomas compacto.
- Menu: opaco (a página e o 3D pausam por trás), capítulos centralizados em Instrument Serif girando como dado, fundo animado de carta aérea (mapa em pontos, rotas e jatos), sem botão de WhatsApp, modos de movimento discretos.
- V7.3 em produção: dpl_3U15AWXXvyi4rj5ivqfGZCNRr6vq (7884fef) — header azul sólido de ponta a ponta, sem borda e sem o jato animado; ícone de contato em carta; tema Crepúsculo com gradação de vídeo mais sutil (índigo profundo + véu rosé). Rollback: dpl_4hK1r4LMc7pcf6RqfmQvpRREPaZS.
- V7.4 em produção: dpl_88DvFDz63F9Xfcc3YrBKLoJ3fHfe (5a51fe4) — volta a cápsula de vidro estilo Apple (escolha do usuário), sem o jato, com ícone de carta, logo em relevo e tinta adaptativa: vidro escuro em cenas escuras/hero/globo, vidro fosco claro com logo marinho em cenas claras. Rollback: dpl_3U15AWXXvyi4rj5ivqfGZCNRr6vq (barra sólida).
- V7.5 em produção: dpl_5aTQSVPS7Pj2H944PipSHyKd7U25 (aa55e0c) — vidro do header com tom interpolado (@property, 0,9 s, sem saltos) e decidido pela cena visível (claro: Sobre, anatomia, serviços, cabine; escuro: hero, globo, saída pela janela, frota, final); mais profundidade (reflexo interno, sombra interna, borda especular). Rollback: dpl_88DvFDz63F9Xfcc3YrBKLoJ3fHfe.
- V7.6 em produção: dpl_8XXhihT3rmWdpQqMn4rYYRH9a4yH (f5e223b) — luz do globo contida no quadro e apagando em degradê no handoff; 3D acorda aquecido antes da anatomia e o medidor de FPS ignora o intervalo de pausa (causa da travada/queda de qualidade); copys de serviços somem mais cedo; copys pequenas de contexto em todas as frases da cabine (SimFly / Lounge, Mesa, Suíte, Janela); portão do hangar volta à fonte original (linha no título + "para venda." em itálico). Rollback: dpl_5aTQSVPS7Pj2H944PipSHyKd7U25.

### V8 — test drive completo e frota sem defeitos (26/11)
- Frota: fim do pisca dos não escolhidos (depthWrite alternava no limiar 0,6), queda de qualidade só com FPS baixo sustentado, hotspots só com a frota na tela e o avião centrado, troca de avião mais rápida (Lenis 0,75 s + card imediato), planta com raio-X no 3D e varredura de scanner.
- Voo: atitude em quatérnio (looping para frente/trás, tonneau 360°, voo invertido), curva forte, manche com rampa, nariz volta ao horizonte sem comando (não sobe sozinho), acelerador direto até a velocidade máxima real do tipo (+ um pouco) e freio aerodinâmico (Espaço/botão), queda no chão/afogamento com caveira e "tentar de novo", pouso só na pista 27 ou na pista da ilha, nota do pouso por razão de descida, voo livre com tonneaux e loopings, câmera que acompanha manobras, zoom (roda/pinça) e inércia no 360°, vista da poltrona escolhida na planta.
- Mundo: céu atmosférico próprio (zênite, horizonte, halo/disco do sol, cirros), nuvens com volume (atlas com luz assada, borda prateada, ordenadas por distância), mar de nuvens removido no voo (estalava ao subir), oceano com ondas direcionais quebradas por ruído, subsuperfície, brilho do sol e espuma, LOD por pixel (sem cintilação lá do alto), ilha com pista iluminada, chão do mundo abaixo do asfalto (a pista parecia grama).
- Testes: 26 unitários (7 de voo: decolagem/voo livre/pouso automático ×3, sem subida sozinho, looping, acelerador/freio, queda no mar).
- V8 em produção: dpl_A2SEYdYUnuVHYEwtqUrJxy8ckHLf (53617de). Rollback: dpl_8XXhihT3rmWdpQqMn4rYYRH9a4yH.

### V9 — interiores reais, primeira pessoa e voo realista (26/11)
- Plantas de fábrica por tipo (fonte única para planta 2D e interior 3D, em `specs.ts`): Legacy 450 = proxy Praetor 500 layout (a) (club de 4 + 3 individuais + toalete com cinto = 8); Praetor 500 layout (c) (divã de 2 + club de 4 + 2 individuais + toalete = 9); Praetor 600 "Aft Cabin Double Divan" (assento lateral + club de 4 + 2 divãs de 3 + toalete = 12); Matrix (2 pilotos + club de 4, airstair traseira esquerda, bagageiros dianteiro/traseiro, sem galley/toalete); CJ2+ (refreshment center à esquerda, club central de 4, 2 de frente, saída de emergência à direita, toalete com cinto). Fontes: brochuras Embraer Praetor 500/600 (out/2020), AOPA 2008, anúncio Textron 525A-0369. Exemplar real continua a confirmar.
- EMB-545 com 6 janelas por lado (fonte secundária); Praetor 600 com 7.
- Interior de luxo no voo (`cabin.ts`): forro com janelas recortadas no lugar das janelas do casco (o céu aparece), sancas de LED, couro, nogueira, mármore, carpete, mesas, divãs, galley, armários, anteparas com porta; cockpit em primeira pessoa por suíte (Pro Line Fusion 3 telas 15,1" + controlador no pedestal, sidesticks, overhead, HUD; Pro Line 21 3 telas retrato + manches; G1000 2 PFD + MFD + manche + 3 manetes), PFD com atitude/velocidade/altitude/proa ao vivo, painel de piloto automático, painéis de botões, pedestal, pedais.
- Passageiro: poltrona escolhida na planta abre olhando para a janela; 360° livre; "Levantar e andar" (WASD/manche) em primeira pessoa pela cabine com o avião em voo livre; voltar à poltrona; vista externa a qualquer momento.
- Voo: pouso automático vai à pista mais próxima (Frota ou ilha) mantendo velocidade, dá a volta se chegar de frente, arremete se passar; trem recolhe/baixa animado (~3 s); luzes de navegação, strobe duplo, beacon e farol de pouso; aceleração e freio mais fortes; legenda de teclas fixa no canto.
- Mundo: nuvens novas (cúmulos couve-flor com oclusão, duas camadas, deriva com o vento, borda que evolui), mar sem "tecido" (ondulação alongada no vento, rugosidade com a distância, trilha de brilho do sol, manchas de vento, água rasa clara), praia de largura variável com areia molhada e restinga; plano próximo 0,1 m por dentro (sem chão/água piscando).
- Frota: casco sempre sólido (resto de raio-X 0,997 deixava a fuselagem transparente), hotspots só com câmera e avião parados, câmera da frota estável e nítida, SMAA (linhas do pátio sem "andar").
- V9 (ajustes pedidos durante a rodada): cockpit com olhos mais altos e painel/glareshield mais baixos (para-brisa domina a vista, HUD combinador removido, painel de guiagem na aba do glareshield); poltrona com o rosto alinhado à janela à frente do encosto, janelas Embraer maiores (0,40 × 0,52 m); andar com colisão (poltronas, móveis, vão da antepara do cockpit, teto), anteparas fechadas; couro matelassê, painéis de nogueira com friso champanhe, molduras de madeira nas janelas, teto com luz indireta e spots de leitura; altura dos olhos limitada pelo teto real (Matrix 1,19 m).
- Testes: 26 unitários; E2E da frota 4/4; QA visual (planta, poltrona, 360°, andar, cockpit) em scripts/qa/interior.mjs.
