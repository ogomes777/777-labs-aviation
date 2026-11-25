---
name: hotspot-previews
description: Implementar previews por hover, focus e touch antes da seleção de hotspots.
---
# Hotspot previews

Quando usar: ao implementar ou corrigir a camada de preview anterior à seleção, tanto na anatomia quanto na frota/hangar.

Checklist:
1. Ler `docs/11_HOVER_TOUCH_PREVIEWS.md` e `data/preview-catalog.json`.
2. Modelar estados `open`, `armedForTouch`, `selected` e `closing`.
3. Garantir hover/focus/click em desktop e tap/tap-confirm em mobile.
4. Renderizar preview com nome, função e media (`png`, `video`, `fallback`).
5. Ancorar o painel ao hotspot com flip inteligente.
6. Pausar/descarregar mídia ao fechar.
7. Verificar que a seleção final ainda aciona o atlas 3D/x-ray/explode.
