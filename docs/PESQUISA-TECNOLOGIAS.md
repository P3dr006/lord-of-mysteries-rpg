# Pesquisa: tecnologias para o futuro do Lord of the Mysteries RPG

*Relatório de 2026-11-07. Foco: o que encaixa num projeto HTML + CSS + JavaScript puro, publicado no GitHub Pages, com Supabase como banco, e o que vale (ou não) adotar quando ele crescer ou quando quisermos subir a estética.*

---

## Resumo em 1 minuto

1. **Não troque de linguagem.** HTML/CSS/JS é o certo para um site que roda no navegador. O que muda é *como* escrevemos esse JS.
2. **O maior salto de estética é de graça:** o CSS de 2025–2026 já faz transições entre telas, animações ligadas à rolagem, popovers e janelas nativas que antes pediam biblioteca. Zero dependência, zero risco.
3. **Segurança de tipos sem compilar:** TypeScript via **JSDoc + `checkJs`** pega erros antes de chegarem à mesa, sem mudar um arquivo `.js`.
4. **Bibliotecas pontuais que valem a pena:** **GSAP** (cenas dramáticas: decreto, Roda, sussurro), **dados 3D** (`@3d-dice/dice-box`), **Howler.js** (som), **Rive/Lottie** (selo de cera animado, sigilos vivos).
5. **Quando o Grimório passar de ~2.000 linhas:** componentes com **Lit** (sem build) ou **Svelte 5 + Vite** (com build). Não React.
6. **Supabase continua.** Dois ajustes para escalar: imagens no **Storage** (hoje vão dentro das linhas do banco) e **Broadcast** no tempo real quando houver muitas mesas ao mesmo tempo.

---

## Onde o projeto está hoje

| Item | Situação |
|---|---|
| Código | ~6.700 linhas de JS e CSS, 20 scripts clássicos (`<script src>`), sem build |
| Maior arquivo | `js/painel.js` (~1.450 linhas, uma IIFE com estado `S`) |
| Banco | Supabase (Postgres + RLS + funções `security definer` + Realtime `postgres_changes`) |
| SDK | `supabase-js@2.118.0` via jsDelivr **com SRI** (hash de integridade) — já protegido contra CDN adulterado |
| Imagens da mesa | comprimidas no navegador (até 440 KB) e guardadas **como base64 dentro das linhas** |
| Testes | Playwright + axe-core + Supabase falso em memória; 497 testes |
| Hospedagem | GitHub Pages (estático) |

**Pontos fortes que nenhuma mudança deve perder:** abre com dois cliques (sem build), regras de segurança no banco (não no navegador), testes de acessibilidade, visual autoral.

---

## Nível 0 — A própria plataforma (sem instalar nada)

O navegador de 2026 resolve sozinho muita coisa que o projeto hoje faz à mão com JS. Isso é o que mais combina com o "arroz e feijão": **mais estética, menos código**.

| Recurso | O que faria no projeto | Por que encaixa | Suporte |
|---|---|---|---|
| **View Transitions** (`document.startViewTransition`, e entre páginas com `@view-transition`) | Troca de abas do Grimório, abrir a ficha, ir do `index.html` para o `mestre.html` com o sigilo "voando" de um lugar ao outro | Uma linha de JS + CSS; o navegador faz o morph. Hoje cada animação de troca é manual | Chrome, Firefox e Safari (Baseline) |
| **Scroll-driven animations** (`animation-timeline: scroll()/view()`) | Escada de Poder acendendo conforme rola, névoa da capa, constelação girando com a rolagem | Roda fora da thread principal: mais suave que ouvir `scroll` no JS | Chrome 115, Firefox 133, Safari 18.2 |
| **`<dialog>` + `closedby` e `popover`** | Decreto, confirmações, janelas da criatura, dicas (`popover="hint"`) | Foco preso, Esc e fundo vêm prontos; hoje o `janela()` e o `prenderFoco` fazem isso à mão | `popover` Baseline; `closedby`/`hint` no Interop 2026 (usar com fallback) |
| **`@starting-style` + `transition-behavior: allow-discrete`** | Animar a *entrada* de elementos que nascem (cartas, faixa da Roda) só com CSS | Elimina `setTimeout` de classe "entrando" | Baseline |
| **Anchor positioning** | Balões presos a botões (tooltip do selo, menu de figura) | Posição calculada pelo CSS | Ainda irregular — **esperar** ou usar com fallback |
| **`@property`** | Animar gradientes e brilhos (aura do Caminho pulsando de cor) | Hoje gradiente não anima; com `@property` anima | Baseline |
| **Container queries + `:has()`** | Carta do jogador que se rearranja pelo espaço que tem, não pela tela | Menos `@media`, componentes que se adaptam onde forem colocados | Baseline |

**Recomendação:** começar por aqui. Cada item pode entrar sozinho, com teste, sem tocar no resto.

---

## Nível 1 — Ferramentas que não mudam o código

### TypeScript "invisível" (JSDoc + `checkJs`)
- **O que é:** comentários `/** @param {string} nome */` + um `tsconfig.json` com `"checkJs": true`. O editor e um comando (`npx tsc --noEmit`) apontam erros de tipo.
- **Por que encaixa:** os arquivos continuam `.js` e o site continua sem build. Pega exatamente o tipo de bug que já tivemos (campo `undefined`, nome de função trocado) antes de rodar os testes.
- **Custo:** baixo; pode entrar arquivo por arquivo.

### Biome (lint + formatação)
- Um único binário que acha código morto, variáveis não usadas e formata. Mais rápido e mais simples que ESLint + Prettier.
- **Por que encaixa:** reduz revisão manual e diffs barulhentos.

### Vite (só quando quisermos build)
- **O que dá:** juntar e minificar os 20 scripts, cache-busting automático (fim do "recarregue a página" após publicar), módulos ES (`import`/`export`), servidor local com recarga instantânea. Suporta várias páginas (`index.html` + `mestre.html`, modo `mpa`).
- **Custo:** passa a existir um passo de build e o GitHub Pages publica a pasta gerada (via GitHub Actions).
- **Quando:** junto com a adoção de componentes (Nível 3). Sozinho, o ganho não paga a perda do "abre com dois cliques".

---

## Nível 2 — Bibliotecas pontuais (entram só onde fazem diferença)

| Biblioteca | Onde usar | Por que | Peso / licença |
|---|---|---|---|
| **GSAP 3.15** | Decreto com selo de cera, giro da Roda do Destino, sussurro chegando, Escada de Poder | Linha do tempo (sequenciar 5 animações com atrasos e easing) é onde CSS puro sofre. Desde a compra pela Webflow, **todos os plugins são gratuitos**, inclusive uso comercial | ~25 KB; licença própria "sem custo" |
| **Motion** (ex-Framer Motion, versão JS) | Alternativa mais leve ao GSAP para animações de estado (abrir/fechar) | MIT, API pequena | ~5–18 KB |
| **@3d-dice/dice-box** | Dado 3D com física rolando na mesa ao fazer um teste | O momento do dado é o coração do RPG; roda em *web worker* (não trava a página). O resultado continua vindo do servidor: o dado 3D só **anima até o número sorteado** (já é assim hoje) | BabylonJS + Ammo; pesado, carregar só quando abrir a mesa |
| **Howler.js** | Sons do `som.js` | Lida com autoplay bloqueado, sprites de áudio e volume por canal em todos os navegadores | ~10 KB, MIT |
| **Rive** ou **Lottie** | Selo de cera derretendo, sigilos do Caminho "respirando", olhos do Bestiário | Animações vetoriais feitas num editor visual, leves e nítidas em qualquer tela; o Rive tem máquina de estados (reage a hover/clique) | Rive runtime ~100 KB+; Lottie ~60 KB |
| **tsParticles** ou **PixiJS** | Névoa, brasas da Roda, poeira estelar da capa | GPU (WebGL) aguenta milhares de partículas onde canvas 2D engasga | Pixi é grande; usar só se a névoa virar marca do site |
| **Dexie / idb-keyval** | Fichas e anotações guardadas no IndexedDB | `localStorage` tem ~5 MB e é síncrono; IndexedDB guarda muito mais (retratos) sem travar | 2–30 KB |
| **Workbox (PWA)** | "Instalar" o site no celular, abrir a ficha offline | Jogador usa no celular na mesa; ícone na tela inicial e funciona sem internet | Só um *service worker* + manifest |
| **Zod** ou **Valibot** | Validar a ficha que chega do navegador e a importada de arquivo | Esquema único para "ficha válida" em vez de checagens espalhadas | Valibot ~1–5 KB |
| **DOMPurify** | Se um dia aceitarmos texto rico (negrito, links) de jogadores | Hoje tudo passa por `esc()` e está seguro; DOMPurify é o padrão se o HTML do usuário for permitido | ~20 KB |

**Regra para todas:** versão fixa + hash SRI (como já fazemos com o supabase-js) ou cópia local em `vendor/`. Nunca `@latest`.

---

## Nível 3 — Componentes (quando o Grimório crescer)

O `painel.js` é uma IIFE de ~1.450 linhas com estado compartilhado. Funciona, mas cada recurso novo deixa o arquivo mais difícil de ler (e mais caro de manter, inclusive em tokens). As opções:

| Opção | Como é | Encaixe neste projeto |
|---|---|---|
| **Lit** (Web Components, ~5 KB) | `<carta-jogador>`, `<roda-batalha>` como tags HTML próprias | **Melhor sem build.** Dá para migrar um pedaço por vez: o resto do painel continua igual. Os componentes são padrão do navegador e duram |
| **Svelte 5** (compilado, ~3 KB) | Arquivos `.svelte` com HTML/CSS/JS juntos; reatividade com *runes* | **Melhor com build (Vite).** Código mais curto que qualquer outro; ótimo para telas cheias de estado como o Grimório. Exige o passo de compilação |
| **Alpine.js** (~15 KB) | Atributos `x-data`, `x-on` no HTML | Bom para interações pequenas (abas, menus). Para um painel do tamanho do Grimório vira atributo demais |
| **htmx** | O servidor devolve pedaços de HTML | **Não serve:** nosso "servidor" é o Supabase, que devolve JSON |
| **React / Next.js** | Ecossistema enorme | **Exagero:** ~45 KB+, build obrigatório, reescrita total. O ganho não paga o custo aqui |

**Recomendação:** se for manter sem build, **Lit**, começando por um componente novo (por exemplo a próxima feature) em vez de reescrever o que funciona. Se aceitar um build, **Svelte 5 + Vite**, também começando por uma tela nova.

---

## Linguagens: vale trocar?

| Linguagem | Veredito |
|---|---|
| **JavaScript** | Fica. É a língua do navegador |
| **TypeScript** | Sim, mas primeiro pelo caminho JSDoc (Nível 1). Arquivos `.ts` só se adotarmos Vite |
| **SQL (Postgres)** | Fica, e é onde mora a segurança (RLS + funções). Continuar escrevendo regra de negócio aqui, não no navegador |
| **Rust/Go → WebAssembly** | Não. Serve para cálculo pesado (edição de vídeo, física); um RPG de mesa não precisa |
| **Python/Node como servidor próprio** | Não, por enquanto. O Supabase já é o servidor. Para lógica extra existem as **Edge Functions** (TypeScript/Deno no próprio Supabase) |

---

## Supabase: ajustes para escalar

1. **Imagens no Supabase Storage em vez de base64 nas linhas.** Hoje um retrato de 440 KB vai dentro da linha do sussurro/bestiário: cada leitura da lista baixa todas as imagens, e o tempo real reenvia tudo. Com Storage (bucket privado + RLS por mesa), a linha guarda só o caminho, o navegador usa cache e a lista fica leve. **É o ajuste de maior impacto quando houver mais mesas.**
2. **Realtime: Broadcast em vez de `postgres_changes` quando crescer.** A documentação do Supabase recomenda Broadcast por padrão: `postgres_changes` checa a RLS de cada assinante em cada mudança e processa em fila única. Para poucas mesas, o que temos é ótimo; com dezenas simultâneas, um gatilho que chama `realtime.broadcast_changes` em canal privado escala muito melhor.
3. **Edge Functions** para tarefas que não cabem em SQL (ex.: gerar PDF da ficha, enviar convite por e-mail).
4. **Proteção de senha vazada** (Auth › Policies): ligar. É o único aviso de segurança pendente no painel.

---

## Segurança (vale para qualquer caminho)

- **Content-Security-Policy** via `<meta http-equiv>` no `index.html` e `mestre.html` (o GitHub Pages não deixa mandar cabeçalhos): permitir só o próprio site, `cdn.jsdelivr.net` e o domínio do Supabase. Se algum dia entrar um script injetado, o navegador bloqueia. **Hoje não temos CSP** — é o reforço mais barato da lista.
- **SRI em todo script externo** (já feito no supabase-js; manter para qualquer biblioteca nova).
- **Regras no banco, nunca no navegador** (como nos efeitos secretos): continuar.
- **Dependabot** no GitHub para avisar de versões com falha conhecida.

---

## Roteiro sugerido

| Fase | O que | Esforço | Risco | Ganho |
|---|---|---|---|---|
| 1 | CSP + proteção de senha vazada | baixo | baixo | segurança |
| 2 | View Transitions, `@starting-style`, `@property`, scroll-driven (CSS) | baixo | baixo | **estética** |
| 3 | JSDoc + `checkJs` + Biome | baixo | nenhum | menos bugs |
| 4 | GSAP nas cenas (decreto, Roda, sussurro) + dados 3D | médio | baixo | **estética** |
| 5 | Imagens no Storage | médio | médio (migração de dados) | escala e velocidade |
| 6 | PWA (instalar no celular, offline) | médio | baixo | uso na mesa |
| 7 | Lit (sem build) ou Svelte + Vite (com build) para telas novas | alto | médio | manutenção |
| 8 | Realtime via Broadcast | médio | médio | escala (só quando houver muitas mesas) |

---

## O que eu não recomendo agora

- **Reescrever em React/Next/Angular:** custo de semanas, ganho pequeno para o tamanho atual.
- **Tailwind:** o visual autoral do projeto (pergaminho, selos, sigilos) vive de CSS próprio; utilitários genéricos puxam para o "genérico" que você não quer.
- **Three.js/Pixi no site inteiro:** pesa no celular. Usar só em momentos (dado 3D, névoa da capa).
- **Bibliotecas sem versão fixa ou sem SRI.**

---

## Fontes

- Vite (MPA, vanilla-ts, Vite 7 só ESM): [guia multipágina Vite + JS](https://dev.to/mochamadboval/multipage-vite-vanilla-javascript-3i0l), [curso NSWI153](https://teaching.mff.cuni.cz/nswi153-web/practicals/05-javascript-project.php), [guia Vite 7](https://ai-void.pages.dev/guides/vite-comprehensive-learning-guide)
- GSAP gratuito e Motion: [Webflow: GSAP becomes free](https://webflow.com/updates/gsap-becomes-free), [README GSAP 3.15](https://cdn.jsdelivr.net/npm/gsap@3.15.0/README.md), [Motion vs GSAP (OpenReplay)](https://blog.openreplay.com/motion-vs-gsap/), [ferramentas de animação 2026](https://www.youngju.dev/blog/culture/2026-05-16-web-animation-tools-2026-rive-lottie-spline-motion-gsap-mit-anime-js-theatre-deep-dive.en)
- Dados 3D: [dice-box](https://github.com/3d-dice/dice-box), [fantasticdice.games](https://fantasticdice.games/), [dice-box-threejs](https://github.com/CaffeinatedTech/dice-box-threejs), [Codrops: dados com Three.js](https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/)
- Componentes: [Lit vs Svelte 2026](https://www.pkgpulse.com/guides/lit-vs-svelte-2026), [htmx vs Alpine 2026](https://www.pkgpulse.com/guides/htmx-vs-alpinejs-2026), [htmx vs Alpine vs vanilla](https://dev.to/_6638a39c349d7e9c85ee20/htmx-vs-alpinejs-vs-vanilla-js-lightweight-frontend-approaches-compared-2026-3pf5)
- CSS moderno: [Interop 2026 (web.dev)](https://web.dev/blog/interop-2026), [CSS moderno em 2026](https://alexcloudstar.com/blog/modern-css-2026-features/), [View Transitions e scroll](https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026)
- Supabase Realtime: [Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks), [Extensões/Broadcast](https://supabase.com/docs/guides/realtime/extensions), [Escolher recurso de realtime](https://flaviocopes.com/courses/supabase/choose-a-realtime-feature/)

*Observação: versões e suporte de navegador mudam rápido; antes de adotar cada item, conferir a página oficial (npm, MDN/caniuse) no dia.*
