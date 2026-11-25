# CLAUDE.md — CONTRATO DE EXECUÇÃO 777 LABS AVIATION

## Papel
Você lidera a implementação de uma experiência premium de aviação executiva **original**. O objetivo é surpreender visualmente e gerar solicitações qualificadas, com estética de cinema e engenharia robusta. Não criar um template genérico.

## Fonte da verdade
1. `00_COMECE_AQUI/BRIEF_MESTRE.md` e `03_DIRECAO/STORYBOARD_SCROLL.md`.
2. `02_RESEARCH/MATRIZ_REFERENCIAS.md` e `01_REFERENCIAS/ORIGINAIS/`.
3. `04_ENGENHARIA/*`, `06_QA/*` e `07_COMERCIAL/*`.
Priorize vídeos originais sobre deduções das folhas de contato. Não invente dados de aeronaves, credenciais, frota, certificação, taxas ou voos.

## Modo de execução
- Antes de cada fase, produza uma frase de hipótese visual, lista curta de arquivos alterados, benchmark de referência e testes.
- Faça uma fase funcional ponta a ponta antes de sofisticar a próxima. Sem heros falsos, seções oculta/sem implementação, botões sem ação, páginas quebradas ou links `#` inertes.
- Descreva a árvore real do repositório depois de criada, não finja ter criado arquivos inexistentes.
- Respeite prefers-reduced-motion, keyboard navigation, vídeo sem autoplay sonoro, progressive enhancement e HTML semântico.
- Não faça hotlink de imagem/vídeo terceiro como asset de produção sem direitos. Não copie códigos fechados nem burle paywall, login ou bloqueios.
- Use tecnologia 3D apenas onde a interação demanda perspectiva real, não por compulsão por biblioteca.
- Se um modelo 3D licenciado não existir, implemente **fallback original elegante** e deixe Asset Gate bloqueado até o modelo ficar pronto.
- Diferencie concept de operadora real. A CTA pode coletar interesse em demonstração; não simular emissão/pagamento de bilhete.

## Gates de aceite
`G0`: refs lidas e classificadas; `G1`: direção e wireframe; `G2`: hero cinematográfico; `G3`: avião/cabine e galerias; `G4`: formulário funcional; `G5`: mobile e performance; `G6`: QA e deploy.
Cada gate exige evidência em screenshot 1440×900 e 390×844 + lista de testes concluídos.

## Stack recomendada
Next.js + TypeScript + CSS variables, GSAP/ScrollTrigger, React Three Fiber + Drei para 3D, Lenis só quando necessário e sincronizado ao ticker; Blender para GLB. Não carregar GSAP, Framer Motion e bibliotecas de scroll concorrentes para controlar a mesma propriedade.

## Diretriz de qualidade
Referência é padrão de movimento e composição, NÃO cópia de marca. Tom audiovisual: elegância silenciosa, passagem de escala, continuidade de câmera, iluminação crível. Meta de 60 FPS em aparelho-alvo realista, degradando com graça em mobile sem WebGL.

## Extensão SimFly MASTER V6 (mesclada de `simfly-fleet-pack/CLAUDE.md`)
- Pacote de execução em `simfly-fleet-pack/` (docs, data, starter, scripts, referências). Ler `simfly-fleet-pack/docs/00_EXECUTION.md` antes de alterar a Frota.
- A seção de anatomia mantém **um único avião conceitual** (o atual); recebe apenas a camada de preview por hover/foco/toque. As cinco aeronaves reais vivem **somente** no capítulo Frota/Hangar.
- Fonte comercial: `simfly-fleet-pack/data/fleet.json` → `src/content/fleet.ts`. Matrix é monomotor a pistão turboalimentado, não pressurizado, não é jato.
- Modelos 3D das cinco aeronaves são ilustrações paramétricas calibradas por dimensões públicas do tipo, sempre rotuladas; o Asset Gate de GLB licenciado por exemplar continua bloqueado até recebermos material/licença.
- Preview é pré-seleção (hover/focus abre, click confirma; toque 1 arma, toque 2 ou CTA confirma). Nenhum hotspot morto; sem asset visual → fallback explícito.
- Progresso persistente em `FLEET_PROGRESS.md`. Não publicar em produção sem autorização expressa do usuário.
