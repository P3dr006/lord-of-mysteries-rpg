# Lord of the Mysteries RPG

Site de RPG com ficha de personagem, dados animados e constelação de Caminhos.

## Como usar

Abra o `index.html` com duplo clique. Não precisa instalar nada nem fazer build.

## Testes

Os testes de robustez (fichas salvas inválidas, ascensão repetida, cliques durante animações,
texto longo, janelas e teclado) ficam em `tests/` e usam o Playwright:

```
npm install
npx playwright install chromium
npm test            # robustez + ficha
npm run test:ficha  # só a ficha útil (vários personagens, PV/Sanidade, habilidades)
npm run test:a11y   # acessibilidade (axe-core, teclado, "reduzir movimento", rótulos, contraste)
npm run test:audio  # volume dos sons, controle de volume, silenciar, aba em segundo plano (~1 min)
```

Cada teste reproduz um defeito já encontrado; se algum voltar, o teste falha.

## Som

Todos os sons são sintetizados no navegador (Web Audio), sem arquivos de áudio. Cada som tem um ganho próprio,
medido por `tools/medir-som.js`, para que todos cheguem ao mesmo volume percebido. Se você mexer em algum som:

```
npm run medir-som       # mostra o volume de cada som
npm run calibrar-som    # recalcula os ganhos (grava em js/som.js)
```
