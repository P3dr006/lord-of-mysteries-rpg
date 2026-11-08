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
(ou "Criar conta" e confirme pelo link do e-mail). Senha nova: mínimo de 10 caracteres, com minúscula,
maiúscula e número (regra igual à do Supabase; contas antigas continuam entrando). Crie uma mesa: o código de 6 letras aparece em destaque.
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

**Bestiário (fichas de criatura):** aba Bestiário. "Nova criatura": retrato (reduzido no navegador como nas pistas), nome,
tipo, perigo (1 a 5 olhos), PV, Defesa, os 6 modificadores, Horror, até 12 poderes (um dado no efeito, como "2d6+3",
vira botão de rolar), o que os jogadores veem e notas secretas. O bestiário é **do mestre**, vale em todas as mesas dele
e continua quando uma mesa é apagada. Na carta: **Chamar** (vira figura com PV cheio, iniciativa = Agilidade e os
modificadores; repetir numera "Lobo 2"), **Ficha** (rolar poderes e, com o resultado, "Ferir" ou "Abalar a mente" um
jogador, o que manda a ordem com o nome do poder) e **Revelar** (sussurro para todos com retrato, nome e descrição; números
e notas nunca saem). No Duelo, a figura que veio do bestiário usa o atributo escolhido.

**Habilidades da mesa:** o jogador conectado à mesa propõe pela própria ficha (nome, o que faz, efeito, custo; até 5
esperando). No Grimório aparece "Pedidos de poder" (com Sequência, Caminho e quantas habilidades ele já tem) e a carta ganha
"✦ proposta". O mestre **aprova**, **modifica** (e aprova, com recado) ou **rejeita** (com motivo). Na ficha do jogador, o
mestre também **concede**, **edita** e **tira** habilidades. O jogador recebe cada decisão como um decreto com selo de cera
(também o que chegou enquanto estava fora, uma vez só) e vê na ficha: aprovadas, aguardando e recusadas (que pode dispensar).
Sem mesa, o formulário continua anotando habilidades locais, como antes.

**Dados do mestre:** em Dados, rolagens locais (d4 a d%, quantidade e modificador). Nada vai ao servidor.

**Presença:** cada carta tem uma vela: acesa quando o jogador está com a mesa aberta, apagada (fumaça) quando saiu.

**Tirar da mesa / apagar mesa:** na ficha do jogador, "Tirar da mesa" (pede confirmação; ele é avisado e pode voltar
com o código). Na lista de mesas, "Apagar" exige digitar o código da mesa e some com tudo dela.

**Batalhas (Roda do Destino):** na aba Cena, "Nova batalha" com nome e com os jogadores e figuras marcados (sem
batalha ativa, todos vêm marcados). Até 4 ao mesmo tempo (ex.: Cais e Catedral), cada uma com ordem, rodada e "Próximo turno"
próprios; o topo do Grimório mostra uma faixa por batalha. Ninguém fica em duas. No meio da luta: "Entra na batalha" rola a
iniciativa e encaixa o novo participante sem roubar a vez de ninguém; o × tira alguém (se era a vez dele, passa ao próximo; vazia,
a batalha termina). Cada jogador só vê a faixa da batalha em que está. Começo, entradas, saídas e fim vão para a Crônica.

**Revelar criatura:** o Revelar do Bestiário pergunta para quem: todos, ninguém (barrado), quem está numa batalha, ou cada um.

**Bênçãos, maldições e selos:** na ficha do jogador, "Abençoar, amaldiçoar ou selar": bênção (+N) ou maldição (−N) num
atributo, selar uma habilidade (volta depois) ou tirar uma habilidade. Avisando, o jogador recebe o decreto com selo de cera e vê
o efeito em "Sobre você" e na habilidade (⛓ selada / ✕ perdida). **Em segredo**, o jogador não recebe nada (a RLS esconde a
linha) e a ficha dele continua igual, mas o modificador vale nos testes secretos, no Duelo e na iniciativa; no teste aberto o
jogador vê o número sem o segredo e o mestre vê o total real (coluna `oculto`). Depois dá para Revelar, Desfazer avisando
(sussurro "O selo se rompe" etc.) ou Em silêncio. A carta mostra o resumo (ex.: "✦ 1 bênção · ☠ 1 maldição oculta").

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
| `bestiario` | **só o dono** (mestre com e-mail) | só o dono; anônimo nunca |
| `habilidades` | o mestre; o jogador só as suas (enquanto está na mesa) | mestre concede/edita/apaga; jogador só por `propor_habilidade` e `retirar_habilidade` |

Bestiário e habilidades: `20261110_bestiario_e_habilidades.sql`, verificado em 39 cenários com papéis reais **sem aplicar**
(mestre, outro mestre, 2 jogadores, intruso, visitante; inclui: jogador não se autoaprova, limite de 5, outro mestre não vê,
apagar a ficha mantém a figura, apagar a mesa mantém o bestiário).

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

Migração `20261111_batalhas_e_efeitos.sql` (**ainda não aplicada**): `encontros` com várias batalhas por mesa
(`id`, `nome`, `jogadores`, `sairam`; o jogador lê só a sua), funções `iniciar_batalha`, `regirar_batalha`,
`passar_turno`, `encerrar_batalha`, `entrar_na_batalha`, `sair_da_batalha` (as antigas de encontro foram removidas);
tabela `efeitos` (só o mestre escreve; o jogador lê só os próprios não secretos; limite de 30 por gatilho);
`privado.mod_do_jogador` / `mod_visivel` somam os efeitos em `rolar_secreto`, `responder_pedido` e no Duelo;
`segredos_pedido.oculto` e `resultados_mestre` com o total real. Verificada em 35 cenários com papéis reais, desfeita no fim.

## Migrações sem o chat (economiza contexto)

`tools/migracao.js` roda a migração direto no banco, sem o SQL passar pela conversa:

- `node tools/migracao.js verificar supabase/migrations/X.sql verificacao.sql`: migração + cenários numa transação que é
  **sempre desfeita**; mostra só a linha `RESULTADO`.
- `node tools/migracao.js aplicar supabase/migrations/X.sql --sim`: aplica e registra em `supabase_migrations`.

Configuração (uma vez, feita pelo Pedro no terminal dele, **nunca** no projeto nem no chat):
1. Supabase > Project Settings > Database > Connection string (URI, "Session pooler"), com a senha do banco.
2. `setx SUPABASE_DB_URL "postgresql://..."` e abrir um terminal novo.
3. Se o Node reclamar do certificado: baixar em Database > SSL Configuration e `setx SUPABASE_DB_CA "C:\caminho\prod-ca.crt"`.

Travas: só aceita o projeto lotm-rpg, só lê `.sql`, verifica o TLS (não há modo inseguro), nunca imprime a URL nem a senha
(nem em erros), `aplicar` exige `--sim`. Sem a variável, as migrações continuam pelo conector do Supabase.

Testes enxutos: `npm run test:quieto` (só falhas + placar) e `node tests/mestre.js --quieto --ate=7d` (para depois da seção).

## Configuração que falta no painel do Supabase

Em **Authentication → URL Configuration**: Site URL e Redirect URLs =
`https://p3dr006.github.io/lord-of-mysteries-rpg/` (e `.../mestre.html`). Sem isso, o link de confirmação
do e-mail leva para o endereço errado. Confira também se "Confirm email" está ligado.

### Anti-robô (Cloudflare Turnstile) — opcional, desligado por padrão

O código já está pronto: com `CONFIG.captcha.chave` vazia (`js/config.js`) nada é pedido. Para ligar, **nesta ordem**
(se o Supabase for ligado antes de o site enviar o token, o login para de funcionar, até o dos jogadores):
1. Cloudflare (conta grátis) → **Turnstile → Add widget**: hostname `p3dr006.github.io`, modo **Managed**.
2. Copie a **Site Key** (pública) para `captcha.chave` em `js/config.js` e publique o site.
3. Só então, no Supabase: **Authentication → Attack Protection → Enable CAPTCHA**, provedor **Turnstile**, e cole a
   **Secret Key** ali. A Secret Key **nunca** vai no código nem no chat.
Para desligar: Supabase primeiro (desliga o CAPTCHA), depois esvazie `captcha.chave` e publique.

Lembretes: o plano grátis não tem backup e **pausa após 1 semana sem uso** (reative no painel).
