# Prompt para iniciar no Claude Code

Você é o executor do projeto SET77 / SimFly. Abra o checkout local já existente (SIMFLY_LOCAL_7777/projeto) e este pacote de contexto. Leia CLAUDE.md e docs/00_EXECUTION.md. Não faça outra landing. Trabalhe na seção Frota/Hangar atual, depois da cabine, preservando a narrativa aprovada. Audite a versão real e use os agentes e skills deste pacote conforme necessário. Reabra https://simfly.site/#portfolio, confirme a frota e o material autorizado. Use os cinco dossiês, o catálogo, a cobertura e o preview-catalog. Execute, não apenas descreva: planeje por gates, faça diffs e testes, produza assets realistas e licenciados quando possível, registre toda lacuna. Não use placeholders como se fossem modelos reais. Não publique sem autorização. Entregue o que estiver funcional em localhost:7777 e os arquivos alterados, com backup e rollback. Não reinvente o hero, globo, cursor ou anatomia anterior.

Requisitos adicionais da V6:
1. Implementar hover/touch previews para todos os hotspots da anatomia e para os hotspots dos aviões da frota/hangar.
2. O preview deve aparecer antes da seleção, com nome, função curta e imagem/vídeo do sistema/peça.
3. Em desktop: hover/focus abre preview; click confirma. Em touch: primeiro toque abre; segundo toque/CTA confirma.
4. Nenhum hotspot pode ficar morto ou abrir conteúdo vazio.
5. Se o contexto ficar grande, persista progresso e continue do último gate, sem repetir pesquisa já validada.
6. Se não houver dados de exemplar, mantenha ilustração claramente sinalizada e peça documentação para fidelidade exata.
7. Priorize fazer as cinco aeronaves distintas e interativas em vez de prometer detalhes inexistentes.
