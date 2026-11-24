# G0 — Inventário do Master Pack e Gap Analysis
Data: 24/11/2026 · Executor: Claude (Claude Code, sessão cloud)

## 1. O que foi lido
- `README.md`, `CLAUDE.md`, `PROMPT_CLAUDE_EXECUCAO.md`, `00_COMECE_AQUI/BRIEF_MESTRE.md`
- `02_RESEARCH/{AUDITORIA_VIDEOS, MATRIZ_REFERENCIAS, ORIGEM_E_CONFIANCA}.md`
- `03_DIRECAO/{STORYBOARD_SCROLL, DESIGN_SYSTEM, MICRO_INTERACOES}.md`
- `04_ENGENHARIA/{ARQUITETURA, RECEITAS_CINEMATICAS, PERFORMANCE_ACESSIBILIDADE, LEADS_ANALYTICS_LGPD, AUDITORIA_DOM_E_SCROLL}.md`
- `05_ASSETS/PLANO_ASSETS.md`, `06_QA/{CHECKLIST_ACEITE, TESTES_E2E}.md`, `07_COMERCIAL/OFERTA_CLIENTES_AVIACAO.md`
- `.claude/agents/*` (6 agentes) e `.claude/skills/*` (4 skills) — copiados para este repositório e usados como checklists de cada gate.
- `starter-demo/` (HTML/CSS/JS) — usado como baseline funcional: menu, galeria por botão/teclado, form validado e reduced motion foram **mantidos e superados** no projeto de produção.

## 2. Mídia original inspecionada
8 MP4 (464×832, 48–59 fps) + 3 JPEG (750×1334). Inspeção: folhas de contato como índice + extração de tiles a 2–4 fps nos trechos-chave diretamente dos MP4 com ffmpeg.

| Arquivo | O que é conteúdo de site/peça | O que é UI do Instagram (excluído) | Uso no projeto |
|---|---|---|---|
| zip1 06.39.00 | portal de janela (moldura marfim espessa → mar de nuvens rosa/azul), "Fly in / Luxury", globo preto, cutaway superior da fuselagem sobre nuvens com zonas em hover, bilhete, suíte/quarto, voo final | barra vermelha de gravação, corações, contadores, legendas "One Claude skill…", painéis de código sobrepostos | portal (cena 02), cutaway (cena 04→05), sequência de cabine |
| zip1 06.39.17 | conceito "Aurelia" (tipografia serif grande, jet sobre pôr do sol, globo de rotas dourado), "Legacy" (hangar noturno, interior âmbar, "Where to next?") | busca, perfis, legendas | iluminação do hangar e tom âmbar da cabine; hierarquia tipográfica |
| zip1 06.39.37 | catálogo técnico marfim: avião de cima, highlight azul, exploded view, componentes | captions, notebook físico, rua | cena 04 Anatomia (exploded + outline azul) — **conceitual**, sem specs |
| zip2 06.32.17 | "Vela": jet acima das nuvens, perspectiva traseira/lateral | clipe lenis.dev, centro de controle iOS | hero; Lenis apenas como técnica opcional |
| zip2 06.32.27 | jet de frente sobre nuvens → porta → cabine → corredor → quarto → janela → nuvens; globo de partículas; cortes longitudinais | DM, reações, legendas | continuidade espacial exterior→interior; globo de pontos |
| zip2 06.32.32 | peça generativa (cidade → lounge → suíte → avião) com marca de companhia aérea | tudo do Reel; **marca de terceiro não utilizada** | só referência de luz/encadeamento |
| zip2 06.32.43 / 06.32.53 | variações do conceito de cutaway/bilhete do zip1 | Reel comparativo de IAs | comparação de estados; nada reutilizado |
| JPEG ×3 | "Aero Jet" UI (Dribbble/IG): editorial branco, turbina frontal, jet oblíquo, grid técnico | moldura do Instagram | regras de composição (crop, escala, branco editorial) |

**Nenhum pixel, marca, texto ou trilha dos originais entra no build.** Todo asset de produção é gerado pelo próprio projeto (ver §5).

## 3. Sites de referência
Os 3 domínios do fundador e cases foram tratados conforme `ORIGEM_E_CONFIANCA.md` (níveis A–F). Este ambiente cloud tem rede restrita a registro de pacotes/proxy; **não foi feita inspeção DOM/DevTools ao vivo** desses sites. Os padrões aproveitados (janela-portal, 2 atos exterior/interior, globo com filtro, quote From/To/Date/Pax) vêm das descrições documentadas no pack, marcadas como inspiração, não engenharia reversa.

## 4. Decisões de arquitetura (derivadas do pack)
| Requisito | Decisão |
|---|---|
| Aeronave 3D real, sem modelo licenciado disponível | **Geometria paramétrica original gerada em código** (fuselagem lofted com seções elípticas, asas NACA, motores por torno, janelas como furos reais via shader). Blender não está instalado neste ambiente; o gerador é a fonte e pode exportar GLB para refino em Blender. |
| Continuidade de câmera exterior→interior | Um único `<Canvas>` fixo, um único sistema de coordenadas (metros, nariz em +X). Cabine modelada **dentro** da fuselagem, na escala real da cena. Câmera em spline Catmull-Rom indexada por progresso global. |
| Transição vídeo↔3D sem piscar | Poster do hero é renderizado **da mesma cena WebGL em t=0**; o canvas só aparece após o 1º frame, por cima de um poster idêntico. |
| Hero em vídeo quando poupa GPU | Loop de nuvens renderizado offline a partir do próprio shader (ffmpeg H.264/VP9) usado no tier Lite. |
| Galeria/fotos de cabine | Renders da própria cabine 3D (mesma topologia), não IA nem banco de imagens. |
| Globo | Pontos de terra do Natural Earth 110m (domínio público) em build-time; arcos Bézier; fallback SVG equiretangular. |
| Form | 2 etapas + resumo, validação Zod client+server, honeypot, rate limit; sem webhook configurado responde **"Demonstração concluída: nenhum pedido foi enviado"**. |

## 5. Gap analysis (o que falta vs. o pack pede)
| Item do pack | Status | Mitigação |
|---|---|---|
| GLB licenciado/Blender | indisponível | modelo paramétrico original; Asset Gate "modelo fotográfico de fabricante" permanece **fora de escopo** (não usamos aeronave real) |
| Filme de nuvens filmado | indisponível | shader procedural original + vídeo renderizado dele |
| HDR de hangar licenciado | indisponível | environment procedural (Lightformers/PMREM) |
| Inspeção DOM ao vivo dos sites | não executada (rede) | registrado como limite |
| Repositório GitHub remoto | `gh` sem token válido nesta sessão | repo git local completo; deploy direto na Vercel |
| Teste em iPhone/Android físicos | indisponível | emulação Playwright 390×844 + SwiftShader; documentado como limite |
| Dados reais de aeronave, rotas, tarifas | **proibidos pelo brief** | conteúdo qualitativo, distâncias calculadas por fórmula (ortodrômica) com aviso |
