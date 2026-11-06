# Parte do mestre (planejado, ainda não feita)

Decisões do autor:

- O jogador **não escolhe a dificuldade**. A mesa de dados só rola e mostra o número.
- **1 natural e 20 natural** são só efeito visual e sonoro. Nada é perdido ou ganho
  automaticamente: o mestre diz o que acontece (perda de Sanidade, consequências etc.).
- Futuramente haverá uma **área do mestre**, com banco de dados:
  1. o mestre escolhe um jogador e **pede um teste** (atributo, dado, dificuldade);
  2. o pedido aparece para o jogador, que **rola** na mesa;
  3. no fim da rolagem, o **resultado e se passou ou não** aparecem na tela do mestre.

Pontos técnicos para quando chegar a hora:

- O resultado da mesa já guarda `rotulo`, `total`, dados rolados e modificador
  (ver `P.historico` em `js/mesa.js`); basta enviá-lo ao banco.
- A comparação com a dificuldade acontece só no lado do mestre.
- Precisa de um banco compartilhado entre mestre e jogadores (ainda a definir).
