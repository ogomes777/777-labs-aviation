# Performance, acessibilidade e testes

## Orçamento proposto (medir e ajustar, não garantias)
- Desktop alvo 60 fps (16,7 ms/frame); mobile médio alvo 30–60 fps; p95 frame <= 33 ms em dispositivo de referência durante interação. Registrar máquina, GPU, resolução, browser, DPR, qualidade e gravação. Não afirmar 120 fps universal.
- Uma instância renderer/canvas por cena ativa; preferir reutilizar renderer existente. DPR adaptativo 1–1.75; mobile 1–1.25. Não forçar render 4K. Carregar LOD de fundo e protagonista primeiro; lazy-load anatomy/cabin no hover/intent e gate, limitar concorrência a 2–3 downloads. Objetivo inicial: protagonistas <= 5 MB cada exterior comprimido, fundo <= 1 MB por avião; orçamento total do capítulo inicial <= 12 MB; maiores sob demanda e medição. Texturas 1K–2K para fundo, 2K–4K para close seletivo. Proposta revisável após perfil real.
- Draw calls, triângulos e VRAM medir via renderer.info; evitar transparência múltipla e shadow maps grandes; usar cache e descarte seguro com referências. Não atualizar estado React a cada frame. Pausar fora de tela e quando tab oculta. Sem WebGL: catálogo acessível e fotos autorizadas; sem fingir que 2D é 360.

## Matriz de teste
- desktop 1920×1080, 1366×768; tablet 768×1024; mobile 390×844 e 360×800. Chrome/Edge/Firefox/Safari quando disponíveis; dispositivo físico mobile obrigatório antes de publicação.
- Scroll para frente/volta: hero, nuvens, globo, anatomia, cabine, gate, frota, próxima seção. Sem flashes, scroll preso, cursor trocado ou quebra de chapter index. Refresh no meio e resize durante inspeção.
- Cinco cards: ordem, ano, categoria, status, seleção, modelo, posição, câmera, livery, CTA com modelo correto. Cada opção habilitada leva a mesh correto, AABB > 0, nó não vazio e descrição; abrir/fechar 20x; trocar de avião durante load; zero promessas rejeitadas sem tratamento.
- X-ray/explode: reversível, sem drift, sem z-fighting, sem desaparecimento do modelo, subpeças isoladas, retorno à pose inicial. Planta/corte/cabine coerentes com modelo. Drag mouse, touch, pinch, teclado, Escape e foco.
- Simular perda de WebGL, asset ausente, erro de rede, slow 4G, modo reduced motion, tab oculta. Botão consultar continua funcional e acessível.
- Testar `npm run` scripts existentes; typecheck, lint, build e teste navegador. Usar Playwright se já disponível ou adicionar apenas após justificativa. Registrar screenshots antes/depois de todos os cinco modelos e vídeo do fluxo, métricas reais e lista de lacunas. Não publicar só porque TypeScript compilou.


## Previews (V6)
Medir impacto dos previews de hover/touch: pré-carregar somente previews do avião ativo e das categorias principais; lazy load dos subitens. Garantir fechamento e pausa do vídeo ao sair do hotspot. Nenhum preview deve reduzir a fluidez do scroll principal nem causar layout shift perceptível.