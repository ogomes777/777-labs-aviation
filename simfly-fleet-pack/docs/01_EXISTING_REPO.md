# Integração com a landing existente

Evidência local: README do pacote SIMFLY_LOCAL_7777 aponta `ogomes777/777-labs-aviation`, branch histórica `simfly/hero-cinematic-v1`, Next.js, servidor 7777. Não se assume que esta ainda é a branch ativa. Produção informada pelo usuário: https://777-labs-aviation.vercel.app/. O ZIP não contém checkout completo, `.git`, node_modules ou credenciais.

## Pontos observados no patch V23 (revalidar no checkout V28+)
- `src/components/ExperienceRoot.tsx`: importa frame, ui, clamp, formBridge, fleetDwell, fleetProgressFor de `@/experience/director`; carrega `@/three/Experience` dinamicamente; ScrollTrigger + Lenis no desktop; atualização de frame.chapters e frame.t; ordem histórica `[0,1,2,4,5,6,3,7,8]`.
- Seleção horizontal: `[data-fleet-track]`, `[data-chapter="3"]`, `.fcard`, `ui.get().fleetIndex`, `frame.fleetSwipe`, `frame.fleet`. Há lógica de câmera sincronizada com `fleetDwell`. Não criar outro ScrollTrigger que disputa x/índice. Reutilizar ou substituir atomicamente.
- `ui.get().inspect`, `assembled`, `inspectPart` são limpos ao sair do capítulo 3; validar no estado atual. Não presumir assinatura de componentes não vistos.
- V28 patch: `src/components/CabinCinema27.tsx`, `src/styles/global.css`, `src/three/env/traffic.ts`, `src/components/ExperienceRoot.tsx`. Portal hangar, timeline cabine vertical e helicóptero movido por tempo. Preservar.
- V27/V28 patches históricos e V23 ExperienceRoot estão em `baseline/` como referência. Não executar os instaladores em sequência sem conferir estado; eles são histórico, não release novo.
- V23 contém `public/media/simfly-plane-cutout.png`, `simfly-plane-approach-3840.png`, dorsal e cursor; o pacote inclui os assets aprovados disponíveis localmente. Use o recorte como motivo narrativo, nunca como representação de um dos cinco modelos do anúncio.

## Auditoria obrigatória
`git status --short`, `git branch --show-current`, `git log -5 --oneline`, inspecionar package.json/lock, `rg 'fleetDwell|fleetIndex|inspectPart|data-fleet-track|sf27-hangar-gate|data-chapter' src`, listar cenas, GLB, texturas, routes. Não presumir stack R3F: verificar se Three puro/R3F. Rodar comandos existentes de typecheck/lint/build e gravar baseline. Não executar scripts destrutivos. Se working tree sujo, isolar alterações e preservar modificações do usuário. Planejar arquivos reais antes de editar.

## Arquitetura proposta (nomes adaptáveis)
`src/content/fleet/` dados tipados e manifest; `src/components/fleet/FleetSection`, `FleetRail`, `FleetInspector`, `FloorplanView`, `PartExplorer`, `FleetFallback`; `src/three/fleet/` asset loader, staging, xray/explode, camera, picking; `src/styles/fleet.css`; `public/media/fleet/<id>/...`. Se já houver equivalentes, estender em vez de duplicar. Não substituir diretor global por novo framework. Integração via store e um adaptador de chapter progress; uma autoridade de posição, uma de seleção, uma de câmera.
