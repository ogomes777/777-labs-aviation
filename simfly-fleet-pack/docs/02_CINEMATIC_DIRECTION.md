# Direção cinematográfica / Hangar

## Storyboard (progresso local 0..1; valores iniciais ajustáveis)
| P | Cena | Comportamento |
|---|---|---|
| 0–.12 | Da nuvem ao pátio | Portal da cabine dispara transição para apron realista, sem barra ou frame vazio. Assets começam a carregar antes do clique. |
| .12–.22 | A frota | Copy com mesma fonte aprovada e varredura azul aplicada apenas aos glifos; jato PNG de marca cruza esquerda→direita, freia, flutua discretamente atrás/ao lado, sem cobrir menu. |
| .22–.30 | Estabelecimento | Grande plano do hangar com cinco aeronaves distintas, solo refletivo moderado e luz natural, sem avião levitando no chão. |
| .30–.92 | Seleção | Cinco zonas de permanência. Cards horizontais por scroll/touch; câmera desloca e aproxima avião selecionado, outros continuam estacionados mais afastados com luz menos intensa; sem teleporte. |
| .92–1 | Continuação | Saída conforme fluxo existente, sem travar usuário. |

Inspeção é modo explícito dentro do capítulo, não um segundo scroll global. Ao clicar Ver por dentro, guardar pose, índice e progresso, estabilizar câmera; raio-X 0.5–0.9s; expansão de sistemas 0.7–1.1s; painel discreto e modelo navegável. Voltar restaura pose/progresso e libera scroll. Cancelamento funciona em qualquer fase.

## Composição
Hangar com portas altas, estrutura metálica, pátio, céu natural, concreto/piso com roughness variada e marcações discretas; arquitetura de escala aeronáutica. Cinco posições com distância e sem colisão de asas; ajustar após envelope validado. Sem modelos que atravessam parede, piso ou outros. Aeronaves estacionadas com trem apoiado no solo; só o PNG editorial flutua. Sombras reais/contact shadows, ambientes HDRI autorizados, reflexo controlado, metal pintado e vidro de cockpit fisicamente coerentes. Nada de neon de videogame; luz azul aparece na interface e seleção, não contamina a livery.

## Tipografia / glass
Reusar fontes locais da landing. `A frota.` com máscara de gradiente azul/branco móvel, peso/escala fixos, sem fundo retangular no hover. Card vidro azul com borda 1px translúcida, reflexo superior sutil e contraste AA, blur apenas nos pequenos cards, nunca fullscreen. Selecionado: título legível, micro brilho de borda, sem salto de altura. Não criar seis caixas por avião; card mostra fabricante, modelo, ano e classificação, status e até 3 fatos, mais `Ver por dentro` e `Consultar`. Detalhes restantes em expansão. Disponibilidade sujeita a confirmação.

## Scroll/touch
No desktop, mapear progresso para cinco zonas, usar histerese pequena na troca de índice; clique em card move a mesma timeline. No mobile, arraste horizontal e gesto vertical preservam navegação; capturar pointer só no viewer durante drag, `touch-action: pan-y` na faixa e área dedicada `none` somente durante orbit se necessário. Sem bloquear gesto vertical por página inteira. Sem duplicar RAF. Respeitar `prefers-reduced-motion` com transições curtas e sem movimento contínuo.

## Copy e microvida
“A frota.” mantém largura e peso da fonte. Varredura periódica 3–5s, pico suave e breve; hover/teclado reforça azul sem criar painel. Motivo PNG com amplitude 3–8px / roll ~1° no máximo, desligar fora da cena. Não inserir balões, partículas grandes ou glow exagerado. Exigir capturas 16:9 e mobile. Render 4K para marketing pode ser offline; não impor DPR 4K ao navegador.
