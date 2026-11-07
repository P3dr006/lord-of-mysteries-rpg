# Parte do mestre

Decisões do autor:

- O jogador **não escolhe a dificuldade**. A mesa de dados só rola e mostra o número.
- **1 natural e 20 natural** são só efeito visual e sonoro. O mestre decide o que acontece.
- O mestre tem **dois tipos de teste**:
  - **Secreto:** só o mestre vê. O jogador não recebe pedido nem resultado.
  - **Aberto:** o jogador recebe o pedido, rola, e o resultado aparece para os dois.
  - Em ambos, a **dificuldade e o "passou ou não" ficam só com o mestre**.

## Como usar

**Mestre:** abra `mestre.html` (na capa: "Abrir o Grimório do Mestre"). Entre com e-mail e senha
(ou "Criar conta" e confirme pelo link do e-mail). Crie uma mesa: o código de 6 letras aparece em destaque.
No painel: jogadores ao vivo (PV, Sanidade, modificadores), formulário de teste (para quem, atributo, o que é
testado, dado, dificuldade), botões **Pedir teste aberto** e **Rolar em segredo** (aceita "Todos os jogadores"),
e a lista de resultados com dificuldade e veredito.

**Jogador:** na ficha, abra a Mesa do Destino → aba **Testes** → "Mesa online", digite o código e entre
(sem conta; o nome é o do personagem). Quando o mestre pede um teste, o botão da mesa ganha um selo e o pedido
aparece no topo da aba Testes. "Rolar" pede o dado ao servidor e a animação para no número sorteado lá.
A ficha (modificadores, PV, Sanidade, Caminho, Sequência) vai ao mestre quando muda. Ao recarregar a página,
o jogador volta sozinho para a mesa. "Sair da mesa" remove o jogador.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `js/config.js` | URL e chave **pública** do Supabase (a `sb_publishable_` é feita para ficar no navegador) |
| `js/mestre.js` | Cliente (`Rede`): baixa o supabase-js **só quando usado**, versão fixa 2.118.0 + hash SRI; mestre e jogador guardam sessões separadas |
| `js/painel.js` + `mestre.html` | Grimório do Mestre |
| `js/jogador.js` | Lado do jogador na aba Testes; envia a ficha quando ela é salva |
| `js/mesa.js` | `Mesa.rolar({ fixo: [n] })` anima até um número já decidido |
| `tests/mestre.js` | 70 testes com um Supabase falso (`tests/supabase-falso.js`) que imita a RLS e as funções |

Para trocar a versão do supabase-js: mude a URL em `js/mestre.js` e recalcule o hash
(`curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A`). O teste confere o hash com a CDN.

## Banco (Supabase, projeto `lotm-rpg`) — já aplicado

Arquivo: `supabase/migrations/20261106_mesa_do_mestre.sql`. Tudo com RLS.

| Tabela | Quem lê | Quem escreve |
|---|---|---|
| `mesas` | o mestre | função `criar_mesa` (exige login por e-mail) |
| `jogadores` | o mestre e o próprio jogador | `entrar_na_mesa`; o jogador atualiza só a sua ficha |
| `pedidos` | o mestre; o jogador só os `aberto` dele | `pedir_teste`, `rolar_secreto` |
| `segredos_pedido` (dificuldade) | **só o mestre** | só por função |
| `resultados` | o mestre; o jogador só os `aberto` dele | só por função |
| `resultados_mestre` (visão) | só o mestre | — |

O dado é rolado **no servidor** (`responder_pedido`, `rolar_secreto`); o site só anima até o número.
No teste secreto o modificador vem de `ficha.mods.<atributo>` do jogador. No aberto, o modificador vem do
navegador do jogador (o dado não); opção futura: usar a ficha também no aberto.

Verificado em 24 cenários com papéis reais (mestre, 2 jogadores anônimos, visitante sem login).

## Configuração que falta no painel do Supabase

Em **Authentication → URL Configuration**: Site URL e Redirect URLs =
`https://p3dr006.github.io/lord-of-mysteries-rpg/` (e `.../mestre.html`). Sem isso, o link de confirmação
do e-mail leva para o endereço errado. Confira também se "Confirm email" está ligado.

Lembretes: o plano grátis não tem backup e **pausa após 1 semana sem uso** (reative no painel).
