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
```

Cada teste reproduz um defeito já encontrado; se algum voltar, o teste falha.
