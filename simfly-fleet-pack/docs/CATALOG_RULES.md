# Atlas de engenharia visual

116 conceitos de peças/sistemas; 580 combinações de avaliação para as cinco aeronaves. Isso NÃO é uma lista de peças certificada, nem contagem de meshes prontos. `candidate` significa aplicabilidade provável e ainda não validada; `verify` exige confirmação específica; `not-applicable` exclui por categoria do projeto. Nenhuma entrada é habilitada em produção sem geometria e fonte de variante.

## Hierarquia
Aeronave > sistema > conjunto > peça > subpeça. Catálogo fornece descrições funcionais e lista inicial de subcomponentes a investigar. Não criar uma esfera genérica para uma peça ausente. Usar material didático somente com label visível. Cada peça publicada precisa de nó real, bounding box não nula, hotspot e seleção própria, descrição, fonte e classificação de fidelidade. Exibir referências somente sob demanda.

## Aplicabilidade
`all` = conceito comum, arquitetura pode variar; `jet` = turbofan/cabine pressurizada nos quatro jatos do escopo; `piston` = Matrix; `emb` = família EMB-545/550; `check` = confirmar existência. Não publicar slats, reversores, APU, winglets, radar, anti-ice ou qualquer opcional por dedução. Para Matrix, não inserir pressurização, turbofan ou cabine de jato. Para a estrutura/propulsão, usar referências de tipo; documentação exata de exemplar sob autorização.

## Mapeamento visual
Cada registro recebe caminho de nós/glTF, `parentId`, centro local, direção de separação no espaço do pai, distância ilustrativa, pivô, nível de detalhe, fotos de referência, status da revisão. Fixadores visíveis podem ser ilustrativos sem part number; não ensinar montagem, torques, reparos ou inspeções como procedimento. Desmontagem da UI é visual e não sequência de manutenção.
