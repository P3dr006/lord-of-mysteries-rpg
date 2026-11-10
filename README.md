# Lord of the Mysteries RPG

Criador de personagem e mesa online para um RPG de mesa inspirado em *Lord of the Mysteries*.
HTML, CSS e JavaScript puros, sem build: abre com duplo clique e funciona offline.

**No ar:** <https://p3dr006.github.io/lord-of-mysteries-rpg/> · Grimório do mestre: [`mestre.html`](https://p3dr006.github.io/lord-of-mysteries-rpg/mestre.html)

## O que tem

**Para o jogador** (`index.html`)
- Criação guiada da ficha: identidade, atributos rolados em 4d6 com dados animados, **astrolábio dos 22 Caminhos**
  (gire o d22 ou escolha o sigilo), raça e origem, traço e artefato selado.
- Ficha completa: radar de atributos, PV e Sanidade, escada de Sequências (9 a 0) com digestão da poção, habilidades,
  pôster para compartilhar e exportação em JSON. Vários personagens salvos no próprio navegador.
- **Mesa do Destino:** dados livres e, com o código do mestre, testes pedidos, sussurros e pistas, a Roda do Destino
  (iniciativa), duelos, bênçãos e maldições, e a ficha montada dentro da mesa quando o mestre usa regras próprias.

**Para o mestre** (`mestre.html`, o Grimório)
- Mesas com código de 6 caracteres, jogadores ao vivo, testes abertos e secretos (a dificuldade nunca chega ao jogador).
- Cena: figuras, batalhas simultâneas com participantes escolhidos, duelos, crônica, Modo Terror.
- Bestiário e NPCs reutilizáveis, habilidades propostas pelos jogadores (aprovar, modificar, recusar), efeitos avisados ou secretos.
- **Livro de regras:** o mestre define atributos, modificador, recursos e bônus em frases; um motor de fórmulas sem `eval`
  roda igual no navegador e no banco. Fichas montadas na mesa têm os dados rolados pelo servidor e aprovação opcional.

Tudo o que é online é opcional: sem internet, o resto do site funciona igual.

## Como rodar

Abra o `index.html` no navegador. Não há instalação nem build.

Para desenvolver e testar:

```bash
npm install
npx playwright install chromium
```

## Testes e verificação

```bash
npm test               # bateria completa (vários minutos): segredos, robustez, ficha, acessibilidade, áudio, mesa online
npm run test:quieto    # a mesma bateria, mostrando só o resumo e as falhas
npm run test:mestre    # mesa online contra um Supabase falso em memória (não toca no banco real)
npm run test:a11y      # acessibilidade: axe-core, teclado, "reduzir movimento", contraste
npm run verificar      # tipos (TypeScript checkJs) + lint (Biome), meta de zero avisos
```

Cada teste reproduz um defeito já encontrado: se ele voltar, o teste falha. As versões das ferramentas ficam fixas no
`package-lock.json`. `node tests/mestre.js --ate=<seção>` para no meio, e `PRINTS=<pasta>` salva capturas de tela.

## Estrutura

| Pasta / arquivo | Conteúdo |
|---|---|
| `index.html`, `mestre.html` | As duas páginas (site do jogador e Grimório). Scripts e CSS com `?v=` para furar o cache do GitHub Pages |
| `js/` | Um script clássico por assunto: `app.js` (fluxo da ficha), `constelacao.js`, `poder.js`, `mesa.js`, `jogador.js`, `painel.js`, `regras.js` (motor de regras), `ficha-mesa.js`, `editor-regras.js`… Tipos em `js/tipos.d.ts` |
| `css/style.css` | Todo o visual; nenhum controle nativo do navegador fica à vista |
| `img/sigilos/` | Os 22 sigilos dos Caminhos (WebP, 256 px) |
| `supabase/migrations/` | Migrações do banco, em ordem; `supabase/verificacoes/` tem os cenários de cada uma |
| `tests/` | Testes com Playwright; `supabase-falso.js` imita a RLS e as funções do banco |
| `tools/` | Migrações pela linha de comando, verificador de segredos, medição de som, migração de imagens |
| `docs/` | Documentação (abaixo) |

## Banco de dados

A mesa online usa o Supabase (Postgres com RLS). Regras do projeto:

- O navegador nunca decide números que importam: dados de testes e de criação de ficha, modificadores e máximos são
  calculados no servidor.
- Toda migração é verificada com papéis reais numa transação **sempre desfeita** antes de ser aplicada:

```bash
node tools/migracao.js verificar supabase/migrations/X.sql supabase/verificacoes/X.sql
node tools/migracao.js aplicar supabase/migrations/X.sql --sim
```

A conexão vem só da variável de ambiente `SUPABASE_DB_URL`. Para não digitar em todo terminal, copie o `.env.example` para `.env`
(ignorado pelo git) e use `npm run migracao -- verificar ...`. Detalhes em [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md).

## Documentação

- [docs/MESTRE.md](docs/MESTRE.md): guia do Grimório e quem lê e escreve cada tabela do banco.
- [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md): migrações, animações, verificação de código e o Storage de imagens.
- [docs/SISTEMAS-DA-MESA.md](docs/SISTEMAS-DA-MESA.md): o motor de regras por mesa, fases e decisões de design.
- [docs/PESQUISA-TECNOLOGIAS.md](docs/PESQUISA-TECNOLOGIAS.md): roteiro técnico (tipos, lint, animações, imagens, PWA).
- [docs/IDEIAS.md](docs/IDEIAS.md): registro de design de efeitos, selos e batalhas simultâneas.

## Som

Todos os sons são sintetizados no navegador (Web Audio), sem arquivos de áudio. Cada som tem um ganho medido por
`tools/medir-som.js` para todos chegarem ao mesmo volume percebido:

```bash
npm run medir-som      # mostra o volume de cada som
npm run calibrar-som   # recalcula os ganhos (grava em js/som.js)
```

## Proteção contra segredos

1. **Uma vez por clone**, rode `npm run proteger`: ativa os hooks de `.githooks`, que conferem o que vai em cada commit
   e todos os arquivos versionados antes de cada push.
2. O `.gitignore` já ignora `.env*` (só o modelo `.env.example`, sem valores, vai ao GitHub), `*.local.js`, chaves e credenciais.
3. `npm run segredos` confere tudo agora; `npm run segredos:historico` audita os commits antigos.

Pode ficar no código: a URL do projeto e a chave **pública** (`sb_publishable_…`) em `js/config.js`.
Nunca: senha do banco, `service_role`, `sb_secret_…`, tokens pessoais. Uma linha com o comentário `segredo-ok` é
ignorada (só para valores públicos de propósito). Como segunda camada, ligue no GitHub o *Secret scanning* e o
*Push protection* (*Settings → Code security*).

## Aviso

Projeto de fã, sem fins comerciais. *Lord of the Mysteries* e seu universo pertencem ao autor, Cuttlefish That Loves
Diving, e aos seus editores.
