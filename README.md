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

## Proteção contra segredos

Para nada indevido (senhas, chaves secretas, arquivos `.env`) ir parar no GitHub:

1. **Uma vez por clone**, rode `npm run proteger`. Isso ativa os hooks da pasta `.githooks`:
   - antes de cada **commit**, confere o que está sendo commitado;
   - antes de cada **push**, confere todos os arquivos versionados.
2. O `.gitignore` já ignora `.env*`, `*.local.js`, chaves (`*.pem`, `*.key`) e credenciais.
3. `npm run segredos` confere tudo agora; `npm run segredos:historico` audita todos os commits antigos.
4. `npm run test:segredos` testa o próprio verificador.

O que **pode** ficar no código: a URL do projeto e a chave pública (`sb_publishable_…` ou `anon`) em `js/config.js`.
O que **nunca** pode: senha do banco, `service_role`, `sb_secret_…`, tokens pessoais.
Uma linha com o comentário `segredo-ok` é ignorada (só para valores públicos de propósito).

Observação: `git commit --no-verify` pula os hooks. Como segunda camada, ative no GitHub, em
*Settings → Code security*, o **Secret scanning** e o **Push protection**.
