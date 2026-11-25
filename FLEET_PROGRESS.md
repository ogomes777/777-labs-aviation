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

## Próxima ação concreta
Ver seção "Resultados" — após QA visual, ajustar composição/hangar e registrar medições.

## Resultados e medições reais
(preenchido ao fim de cada rodada de QA)
