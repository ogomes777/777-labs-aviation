# Hover / touch previews — anatomia + frota/hangar

## Objetivo
Antes de o usuário selecionar um sistema, peça ou subpeça, a interface deve fornecer uma prévia contextual instantânea. Essa prévia serve para orientar a escolha sem desmontar o avião ainda. O comportamento vale para:
1. Capítulo superior de anatomia (avião único conceitual).
2. Capítulo de Frota/Hangar (cinco aeronaves comerciais).

## Princípio de UX
- **Preview é pré-seleção**: informa e seduz.
- **Seleção é aprofundamento**: entra em x-ray, explode, isolamento, planta ou interior.
- O preview não substitui o atlas; ele prepara o usuário para o clique.

## Tipos de preview permitidos
1. **PNG transparente / render still** do sistema ou peça.
2. **Microvídeo loop** (2 a 5 s) de desmontagem/rotação/isometria, sem áudio, preferencialmente `.webm` ou `.mp4` leve.
3. **Fallback informativo** com silhueta/ícone técnico + descrição curta, quando o asset visual ainda não existir.

## Conteúdo mínimo do preview
- Nome do sistema/peça.
- Categoria (ex.: sistema, conjunto, subcomponente).
- Função curta em 1 frase.
- Visual: PNG ou microvídeo.
- Indicador opcional de disponibilidade: `preview`, `ilustração`, `documentação pendente`.

## Regras de ativação
### Desktop
- `mouseenter` / `pointerenter` / `focus` abre preview.
- `mouseleave` fecha com pequeno delay (80–140 ms) para evitar flicker.
- `click` seleciona de fato.

### Touch / mobile
- Primeiro toque abre preview e trava o hotspot como `armed`.
- Segundo toque no mesmo hotspot, ou CTA do preview, confirma a seleção.
- Toque fora fecha preview.
- Press longo pode abrir versão ampliada do preview quando útil.

## Regras visuais
- Card glass azul/branco, leve, profundidade real, blur controlado.
- Pode ser card, placa ou painel flutuante. Em alguns cenários, uma imagem PNG “solta” é aceitável desde que exista um pequeno bloco textual e uma moldura visual sutil.
- Não usar underline persistente no pill ativo; usar cápsula glass preenchida ou halo.
- Glow azul mais intenso no hotspot quando preview aberto.
- Preview nunca deve tampar totalmente a peça selecionada.

## Posicionamento
- Preferir ancoragem ao hotspot com deslocamento inteligente e flip horizontal/vertical quando próximo à borda.
- Se não houver espaço, deslocar para zona segura do viewport.
- Em capítulos de interior/cabine, o preview pode aparecer centralizado ou em área de HUD, desde que não polua.

## Seção superior (anatomia)
- Hotspots principais: fuselagem, asas, motores, empenagem, trem de pouso, cabine.
- Antes de clicar, mostrar preview do sistema.
- Após escolher o sistema, subhotspots da peça também devem suportar preview (ex.: para-brisa, janelas, longarinas, aileron, flap, fan, compressor, leme, profundor, amortecedor etc.).
- Quando o subitem não tiver malha própria ainda, mostrar fallback explícito com status `a detalhar`.

## Seção frota/hangar
- O avião atualmente ativo na galeria horizontal deve expor hotspots antes da desmontagem.
- Hotspots principais por exemplar: fuselagem, asa, motorização/propulsão, cockpit/cabine, trem, empenagem, portas/acessos.
- `Ver por dentro` ou equivalente não elimina o preview; ele continua existindo na camada anterior.
- Ao passar o cursor na área do avião, exibir hotspots progressivamente; não mostrar todos de forma poluída desde o primeiro frame.
- O preview deve refletir a aeronave selecionada, não o avião conceitual genérico.

## Performance
- Máximo sugerido: 1 preview visual ativo por vez.
- PNGs com resolução suficiente para retina, mas comprimidos.
- Microvídeos curtos, silenciosos, autoplay apenas quando o preview estiver visível.
- Pausar e descarregar mídia fora do viewport.
- Evitar gerar material dinâmico caro durante o hover; pré-carregar apenas os previews das peças principais do avião ativo.

## Acessibilidade
- Preview acionável por teclado (`focus`, `enter`, `space`).
- `aria-describedby` ou painel com relação explícita ao hotspot.
- Em touch, CTA claro para avançar.
- Em fallback, informar que o preview visual detalhado está pendente.

## Estado sugerido
```ts
previewState = {
  section: 'anatomy' | 'fleet',
  aircraftId: string | null,
  nodeId: string | null,
  open: boolean,
  armedForTouch: boolean,
  anchorRect: DOMRect | null,
  mediaKind: 'png' | 'video' | 'fallback',
}
```

## Critérios de aceite
- Hover/touch abre preview em todos os hotspots habilitados.
- Nenhum hotspot morto.
- Preview fecha sem flicker.
- Seleção continua funcionando.
- Mobile consegue pré-visualizar antes de abrir o modo detalhado.
- Layout permanece premium, clean e cinematográfico.
