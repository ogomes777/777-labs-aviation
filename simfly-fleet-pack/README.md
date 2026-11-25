# SIMFLY / SET77 LABS — MASTER EXECUTION PACK V6

Pacote consolidado para Claude Code. Não é a landing, não é patch aplicado, não contém modelos GLB finais das cinco aeronaves; inclui pesquisa, especificação, starter de lógica, ferramentas de validação, referências visuais, ativos aprovados, baseline dos patches e agora também a camada completa de **hover/touch previews** pedida para a anatomia e para o hangar/frota.

## Delta principal da V6
- Adiciona especificação completa de **pré-visualização por hotspot** antes da seleção.
- Expande a experiência para **desktop (cursor)** e **mobile/touch (toque/press)**.
- Define cards/placas de preview com **PNG transparente**, **still render** e **microvídeo loop** quando houver asset suficiente.
- Cria catálogo inicial `data/preview-catalog.json` para a seção de anatomia e para a frota/hangar.
- Adiciona agente e skill dedicados para a camada de preview.
- Atualiza as regras para evitar hotspot morto, underline indesejado, preview sem conteúdo e transição redundante.

## Começar no Windows
1. Extraia o ZIP. Abra o checkout existente `SIMFLY_LOCAL_7777/projeto` no Claude Code. Preserve o projeto e não substitua a pasta `src`.
2. Mantenha o pacote em pasta acessível. Para instalar agentes e skills, copie as pastas `.claude/agents` e `.claude/skills` para o checkout, mesclando sem sobrescrever nomes existentes; mescle as regras de `CLAUDE.md` com as do projeto. Copie os diretórios `docs`, `data`, `starter`, `scripts`, `references`, `baseline` para uma subpasta `simfly-fleet-pack` se desejar; informe esse caminho no prompt (agentes devem localizar raiz do pacote). Alternativamente mantenha este pacote inteiro e peça ao Claude para instalar apenas os arquivos de configuração ausentes. Não copie os patches históricos sobre código atual.
3. Cole `PROMPT_EXECUTAR.md` no Claude Code. Informe caminho absoluto do checkout e pacote. Confira permissões de leitura e edição. O agente deve fazer auditoria inicial antes de rodar qualquer comando.
4. Validar catálogo: `python scripts/validate_pack.py` na raiz deste pacote. Teste starter opcional com Node 22.6+ (suporte a strip types): `node --experimental-strip-types starter/fleet-core.test.mjs`. Validação de assets: `python scripts/validate_assets.py CAMINHO_REPO data/asset-manifest.template.json --release` (deve falhar até completar manifesto e assets). Esses testes não são validação da landing.

## Conteúdo
- 14 agentes e 14 skills com formato de descoberta Claude Code.
- 5 dossiês e JSON de anúncios; 116 conceitos técnicos; 580 avaliações de aplicabilidade (não peças prontas).
- Especificação adicional para **hover/touch previews** em `docs/11_HOVER_TOUCH_PREVIEWS.md`.
- Catálogo inicial de previews em `data/preview-catalog.json`.
- 20 links de fontes e documentação; matriz CSV/JSON, manifesto de assets, scripts de validação, starter TS e teste.
- Referências originais enviadas e recortes de marca; baseline dos patches V23–V28 disponíveis.

## O que a V6 obriga o Claude a executar
- Na seção superior de anatomia: todo hotspot/sistema deve abrir **preview flutuante** antes da seleção, com nome, função curta e imagem/vídeo do sistema.
- Na seção Frota/Hangar: antes de entrar no atlas interno do avião, hotspots do exemplar selecionado devem revelar **preview contextual** da peça/sistema.
- Em touch/mobile: toque simples abre preview; segundo toque ou CTA interno confirma a seleção.
- Durante seleção real: o preview some e entra a experiência 3D/x-ray/explode já definida.

## Limitações / correções
Não temos documentação técnica licenciada completa, serial, pintura em todos os ângulos, planta exata e configuração real de cada unidade. Não prometer cada parafuso idêntico. Matrix é pistão turboalimentado e não pressurizado, corrigido neste pack. O status dos anúncios é histórico e deve ser confirmado. O código existente foi parcialmente inspecionado em patches; não foi testado um checkout completo. O escopo foi organizado em gates para controlar custo e impedir regressões. Nenhuma alteração no repo remoto ou produção. A camada de preview foi especificada em profundidade, mas ainda depende de geração/coleta de assets correspondentes no checkout final.
