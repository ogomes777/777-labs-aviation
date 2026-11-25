# SIMFLY / SET77 — regras do projeto

Leia `docs/00_EXECUTION.md` antes de editar código. Este diretório é um pacote de execução, não substitui o repositório da landing. Se instalado no repo, respeite o CLAUDE.md existente (mescle, não sobrescreva).

- Escopo inicial: capítulo Frota (07, `data-chapter="3"` no patch observado), portal vindo da cabine e integração mínima. Preservar hero, globo, cursor aprovado, anatomia anterior e contatos.
- Fonte comercial `data/fleet.json`, pesquisa `docs/aircraft`, catálogo e cobertura em `data/`. Não confundir avião conceitual da marca com cinco exemplares anunciados.
- Não publicar peça não mapeada, render substituto enganoso, status de estoque sem confirmação ou planta inventada apresentada como real. Matrix não é jato e não é pressurizada.
- Não fazer deploy, reset, force push, instalar dependências indiscriminadamente ou substituir projeto sem autorização. Fazer branch/backup e mudanças pequenas, verificáveis.
- Usar agentes em `.claude/agents` e skills em `.claude/skills`; ler arquivos de contexto sob demanda. Rodar testes e registrar evidências, não declarar sucesso sem medição.
- Para o modo técnico: 360 com drag, X-ray real de camadas, peça isolada e desmontável, voltar ao scroll sem salto. Sem caixas desnecessárias; azul, glass, tipografia e narrativa existentes.
- Novo requisito obrigatório da V6: antes da seleção de qualquer sistema/hotspot, abrir preview contextual por hover/focus/touch, com card ou placa leve contendo nome, função curta e imagem PNG transparente ou microvídeo loop do sistema/peça. Preview é pré-seleção; seleção abre a experiência 3D detalhada.
- Em mobile/touch, primeiro toque abre preview; segundo toque (ou CTA do preview) confirma. Em desktop, hover abre e click confirma. Hotspot sem asset suficiente deve mostrar fallback informativo explícito, nunca comportamento morto.
- Registrar progresso em `FLEET_PROGRESS.md` no repositório de destino, atualizando status de cada gate. Nunca marcar como pronto um ativo ainda pendente.
