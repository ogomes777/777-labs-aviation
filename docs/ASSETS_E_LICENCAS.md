# Assets, fontes de mídia e licenças

Todo asset visual de produção é **gerado por este projeto**. Nenhum pixel, vídeo, modelo, marca ou texto das referências (Reels, sites, cases) é usado.

| Asset | Origem | Licença / direito |
|---|---|---|
| Aeronaves (Meridian XR, Solstice M, Aurora L, Horizon TP, Zenith H) | Geometria paramétrica em código: `src/three/jet/*` (fuselagem lofted, aerofólios NACA 4 dígitos, tornos de nacela) | Original do projeto |
| Cabine (lounge, mesa, divã, suíte, galley) | `src/three/jet/cabin.ts` | Original |
| Pinturas, frisos, marca "777" na deriva, texturas de madeira/couro/carpete | Canvas 2D gerado em runtime | Original |
| Céu, mar de nuvens, véus de nuvem, rastros, filetes de ar | Shaders GLSL próprios (`src/three/env/*`) | Original |
| Mapas de ambiente (reflexos) | PMREM gerado de cenas procedurais (`envmaps.ts`) + `RoomEnvironment` do three.js (MIT) | Original / MIT |
| Globo: contornos de terra | Natural Earth 110m, via pacote `world-atlas` (ISC), convertido em pontos em build-time (`scripts/build-globe-dots.mjs`) | Domínio público |
| Poster, stills, cards da galeria, imagem social, loop de vídeo do hero | Renderizados da própria cena WebGL por `scripts/render-media.mjs` (Playwright + ffmpeg) | Original |
| Grão de película | Ruído gerado em Python (`public/media/grain.png`) | Original |
| Tipografia | Bodoni Moda, Manrope, Pinyon Script (Fontsource, auto-hospedadas) | SIL Open Font License 1.1 |
| Bibliotecas | Next.js, React, three.js, R3F, drei, postprocessing, n8ao, Lenis, Zod (MIT); GSAP (licença padrão GreenSock, uso gratuito) | Ver `package.json` |

## Nomenclatura
`public/media/still-<capítulo>[-m].webp`, `cabin-<microcena>.webp`, `poster-<desktop|mobile>.<avif|webp>`, `hero-<desktop|mobile>.<mp4|webm>`.

## O que NÃO é afirmado
Nenhuma aeronave representa modelo certificado, capacidade, alcance, preço ou disponibilidade. Componentes listados na inspeção são termos gerais da aviação (função genérica), não especificações. Destinos são inspirações; distâncias são calculadas por haversine.
