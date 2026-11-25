# Execução mestre V5 — contrato de entrega

## Ordem de leitura e trabalho
1. `CLAUDE.md`, `docs/01_EXISTING_REPO.md`, `docs/RESEARCH_SOURCES.md`, `docs/02_CINEMATIC_DIRECTION.md` e `data/fleet.json`.
2. Auditar branch e versão realmente presentes. Produzir mapa de integração, capturas de baseline e medir performance antes de alterar.
3. Ler os cinco dossiês de `docs/aircraft/`; validar as informações com fabricante, autoridade e cliente. Reabrir https://simfly.site/#portfolio e comparar com prints originais. Não extrapolar o estado atual de anúncios antigos.
4. Construir contrato e protótipo funcional do hangar, depois importar assets finais de uma aeronave piloto (Legacy 450). Só expandir para as demais quando seleção, X-ray, planta, 360 e desmontagem estiverem validados. Fazer trabalho paralelo em assets, não editar simultaneamente os mesmos arquivos.
5. Integrar as outras quatro aeronaves com identidade visual própria; testar catálogo completo e cobertura. Revisar visual em cada modelo e em mobile.
6. Entregar alteração no repo/patch, assets licenciados, inventário, logs de testes e instruções localhost:7777. Somente publicar mediante ordem do usuário.

## Gates e critérios de parada
G0: baseline e branch verificados; nenhum arquivo original sobrescrito sem backup.
G1: 5 cards corretos e fluxos comerciais funcionando; render com 5 aeronaves ou proxies explicitamente rotulados em DEV.
G2: 5 assets externos com silhueta aprovada, pintura rastreável, 360 real. Sem nomes fictícios.
G3: X-ray, explosão, isolamento e navegação de peças funcionais por todos os modelos. Só habilitar item com mesh real; catálogo de lacunas separado, visível ao responsável, não mascarado.
G4: plantas ortográficas, cortes e interior coerentes; precisão específica apenas quando cliente fornecer documentos de exemplar.
G5: QA de scroll bidirecional, touch, resize, WebGL perdido, teclado, carregamento, acessibilidade, tráfego e performance. Capturas e números reais. Não publicar com regressões graves.

## Escopo de entrega e autoridade
Não é necessário fazer cinco aeronaves em uma única resposta ou gastar tokens repetindo material: executar ondas com checkpoints, dentro da mesma branch. Usar `FLEET_PROGRESS.md` como memória local: tarefas, fontes, arquivos, testes, blockers e próximos passos. Se uma malha não existir, solicitar material/licença ao responsável ou produzir visual ilustrativo aprovado; nunca chamar de reprodução exata. Não depender de APIs pagas ou download de assets sem aprovação de custo e licença. Priorizar funcionalidade real a quantidade de itens.


## Extensão V6: camada de preview
Antes de abrir qualquer sistema, implementar camada de preview por hotspot nas duas seções técnicas. A entrada em detalhe só acontece após confirmação do usuário. Usar o agente `preview-interaction-director` quando estiver desenhando esse comportamento.