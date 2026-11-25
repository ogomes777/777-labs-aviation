# Atlas técnico / máquina de estados

Estados: `browse`, `entering`, `xray`, `exploded`, `system`, `part`, `subpart`, `floorplan`, `interior`, `exiting`, `fallback`. Eventos: `SELECT_MODEL`, `OPEN`, `SCAN_DONE`, `EXPLODE_DONE`, `SELECT_SYSTEM`, `SELECT_PART`, `SELECT_SUBPART`, `TOGGLE_EXPLODE`, `SET_VIEW`, `BACK`, `CLOSE`, `ASSET_ERROR`, `LEAVE_CHAPTER`. Cada evento cancela transições antigas por token, evitando atualização assíncrona fora de ordem. Um único selectedAircraftId, selectedNodeId, viewMode e explosionAmount (0..1). O rótulo de montar/desmontar deriva do alvo/estado, nunca de um boolean desconectado do progresso. Ao voltar, remontar ou restaurar estado explicitamente; nenhum botão “ver conjunto” redundante. Breadcrumb: frota > avião > sistema > peça.

## Raio-X
A casca translúcida deve revelar geometria real interna disponível, em passes de material bem controlados. Evitar z-fighting e transparência de todas as malhas de uma vez; usar clipping planes locais com limpeza/restauração e materiais clonados quando necessário. Separar highlight da translucidez. Scan em azul com intensidade discreta e curta; efeito de falha só estilizado e não cintilação de tela. Sem luz de alerta confundida com status real.

## Exploded view
Para cada nó: base local TRS congelado, parentId, vetor de separação no espaço local do pai, pivô, bounding box. `position = basePosition + explodeVector * easedAmount`; nunca acumular deslocamento por frame. Filhos seguem pai; subpeças recebem seus próprios vetores relativos. Em isolamento, ocultar outros grupos sem apagar objetos; reframe via bounding box e bounding sphere do nó selecionado. Não retornar avião inteiro se nó inválido: item indisponível e diagnóstico. Rotação por mouse/dedo, pinch/zoom, reset de vista e teclas. Câmara sem saltos usando target interpolado; limitar clipping e distância.

## Planta e corte
Vista superior ortográfica e corte longitudinal em geometria comum à cabine; alternar planta 2D anotada, 3D isométrico, cabine e vista exterior. Contorno, zonas, nomes, portas e dimensões só quando verificados. Cotas em metros com fonte e versão. Sem layout de apartamento genérico. Se unidade não confirmada, aviso “Configuração ilustrativa do modelo” sempre visível. `Cabine` deve enquadrar interior real (não mesh da fuselagem inteira); `Motor` deve focar propulsor e componentes, com acesso a corte quando existente.

## UI
Sistema sem botão aparente até seleção, então pill glass azul sem underline adicional. Subpeças agrupadas e com busca opcional. Um texto por seleção: nome, função em 1–2 frases, relação com conjunto; aprofundamento em painel secundário. Hotspots em coordenadas de nó, oclusão e escala estável; mostrar apenas do nível corrente. Nenhuma peça com botão morto. Keyboard focus, aria-pressed, escape, retorno de foco. Não habilitar seleção de malha ausente: separar relatório de lacunas da experiência de compra.


## Camada de preview anterior à seleção
Antes de qualquer seleção, cada hotspot principal e subhotspot habilitado deve abrir preview contextual por hover/focus/touch. Usar `data/preview-catalog.json` como base. Preview some ao confirmar seleção e a máquina de estados entra em `system`/`part` normalmente. Em touch: primeiro toque prepara (`armed`), segundo toque confirma. Evitar underline; usar pill glass e glow azul.