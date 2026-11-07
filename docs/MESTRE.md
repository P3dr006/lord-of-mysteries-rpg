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

**Sussurros e pistas:** no Grimório, "Sussurros e pistas" manda texto e/ou imagem (carta, mapa, retrato) para
um jogador ou para todos (também pelo botão "Sussurrar" na ficha do jogador). A imagem é reduzida no navegador do
mestre (até 1280 px, WebP, ~330 KB no máximo). No jogador, a cena aparece na hora (névoa, palavras surgindo, a pista
em papel envelhecido); o que chegou enquanto ele estava fora aparece quando ele volta. "Guardar na memória" marca
como lido, e o mestre vê quem leu. As pistas ficam na aba Testes para reler. "Para todos" é guardado uma vez só.

**Corpo e mente:** no Grimório, escolha o jogador (ou todos), PV ou Sanidade, quanto e um motivo (o jogador vê).
"Causar dano"/"Abalar a mente" e "Curar"/"Acalmar". Como PV e Sanidade vivem no navegador do jogador, o mestre manda
uma **ordem**; o navegador do jogador aplica uma única vez (o servidor garante), anima a ficha e mostra o golpe na tela
(vermelho e tremor para PV, roxo para a mente, dourado na cura). Se o jogador estiver fora, aplica quando voltar.
A lista mostra "aplicado" ou "aguardando o jogador". Os valores ficam entre 0 e o máximo.

**Modo Terror da mesa:** o botão no topo do painel liga/desliga para todos, inclusive quem entrar depois. O jogador
pode desligar o próprio (o Terror pisca e tem som forte); a mesa não força de novo, e só desliga o que ela ligou.

**Notas secretas:** na ficha do jogador, "Notas secretas" (só o mestre lê e escreve; salva sozinha). A carta mostra
"✎ nota secreta" quando existe uma.

**Abas do Grimório:** Jogadores ficam sempre à esquerda; à direita, **Ações** (Teste, Duelo, Corpo e mente),
**Cena** (Roda do Destino, Figuras), **Segredos** (Sussurros e pistas), **Crônica** (Resultados e diário) e **Dados**.
A aba escolhida é lembrada; setas do teclado trocam de aba.

**Roda do Destino (iniciativa):** em Cena, "Girar a Roda": o servidor rola d20 + Agilidade (da ficha) de cada jogador e
d20 + bônus das figuras marcadas. A ordem aparece numa faixa no topo do Grimório (quem está na vez tem a chama; a carta
dele ganha "na vez") e numa faixa no canto da tela dos jogadores (que pode ser recolhida). Quando chega a vez de alguém,
aparece "É a sua vez" na tela dele. "Próximo turno" avança; a volta completa abre a rodada seguinte. "Encerrar" some
com a Roda de todos.

**Duelo (teste contestado):** em Ações, escolha o que está em jogo, os dois lados (jogadores ou figuras) e o atributo
de cada jogador. O servidor rola os dois (figura usa o bônus). Com "os jogadores do duelo veem" marcado, quem está no
duelo vê a cena com os dois números; desmarcado, só o mestre. Quem leva a melhor aparece; o que acontece, o mestre decide.

**Figuras da cena (NPCs):** em Cena, nome, bônus e PV (opcional), com −5/−1/+1/+5. Só o mestre vê; entram na Roda e
nos Duelos.

**Crônica da sessão:** em Crônica, "Registrar um momento" e "Ler a crônica": uma página de pergaminho com tudo em ordem
(testes com dificuldade e veredito, duelos, sussurros, golpes, Terror e momentos). Dá para imprimir e baixar em .md.
Só o mestre lê.

**Dados do mestre:** em Dados, rolagens locais (d4 a d%, quantidade e modificador). Nada vai ao servidor.

**Presença:** cada carta tem uma vela: acesa quando o jogador está com a mesa aberta, apagada (fumaça) quando saiu.

**Tirar da mesa / apagar mesa:** na ficha do jogador, "Tirar da mesa" (pede confirmação; ele é avisado e pode voltar
com o código). Na lista de mesas, "Apagar" exige digitar o código da mesa e some com tudo dela.

**Teste aberto à prova de trapaça:** o modificador do teste aberto agora vem da ficha guardada no servidor (a mesma que o
mestre vê), não do que o navegador manda. Modificador ilegível na ficha vale 0 em vez de dar erro.

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
| `sussurros` | o mestre; o jogador só os dele e os "para todos" da mesa dele | `sussurrar` (só o mestre) |
| `sussurros_leituras` | o mestre; o jogador só as próprias | `ler_sussurro` |
| `ordens` (dano, cura, Terror) | o mestre; o jogador só as dele | `ordenar` (só o mestre); `aplicar_ordem` (uma vez) |
| `notas_mestre` | **só o mestre** | só o mestre (direto na tabela) |
| `mesas.terror` | lido por `estado_da_mesa` (mestre e jogadores da mesa) | `ordenar(..., 'terror', 1/0)` |

| `figuras` (NPCs) | **só o mestre** | só o mestre (direto na tabela) |
| `encontros` (Roda) | o mestre e os jogadores da mesa | `iniciar_encontro`, `proximo_turno`, `encerrar_encontro` (só o mestre) |
| `disputas` (Duelos) | o mestre; o jogador só os visíveis em que está | `disputar` (só o mestre; o servidor rola) |
| `cronica` | **só o mestre** | só o mestre (direto na tabela) |

Cena: `20261109_cena.sql`, verificado em 28 cenários com papéis reais **sem aplicar** (inclui: +30 mandado pelo navegador
vira +3 da ficha; ficha com `"agil":"abc"` não quebra a rolagem; apagar a mesa leva tudo junto; outro mestre não mexe).

Controle do mestre: `20261108_controle_do_mestre.sql`, verificado em 31 cenários com papéis reais **sem aplicar**
(a migração e os testes rodaram numa transação desfeita no fim). Aplicar no banco junto com a publicação do site.

Sussurros: `20261107_sussurros.sql`, `…b_sussurros_corrige_leitura.sql` (achado na verificação: um `null`
deixava quem estava fora da mesa marcar como lido) e `…c_sussurros_tem_imagem.sql`. Verificados em 19 cenários com
papéis reais (mestre, 2 jogadores, intruso, visitante), dentro de uma transação desfeita no fim.

O dado é rolado **no servidor** (`responder_pedido`, `rolar_secreto`); o site só anima até o número.
No teste secreto o modificador vem de `ficha.mods.<atributo>` do jogador. No aberto, o modificador vem do
navegador do jogador (o dado não); opção futura: usar a ficha também no aberto.

Verificado em 24 cenários com papéis reais (mestre, 2 jogadores anônimos, visitante sem login).

## Configuração que falta no painel do Supabase

Em **Authentication → URL Configuration**: Site URL e Redirect URLs =
`https://p3dr006.github.io/lord-of-mysteries-rpg/` (e `.../mestre.html`). Sem isso, o link de confirmação
do e-mail leva para o endereço errado. Confira também se "Confirm email" está ligado.

Lembretes: o plano grátis não tem backup e **pausa após 1 semana sem uso** (reative no painel).
