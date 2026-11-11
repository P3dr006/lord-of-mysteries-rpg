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
mestre (até 1280 px, WebP, ~185 KB) e vai para o Storage (veja "Imagens no Storage"). No jogador, a cena aparece na hora (névoa, palavras surgindo, a pista
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

**NPCs (no Bestiário):** "Novo NPC" (ou trocar Criatura/NPC no topo do editor) abre o bloco "Quem é": Caminho (guarda o
id de `js/caminhos.js`, então renomear um Caminho não quebra fichas), Sequência 9 a 0 ou nenhuma, facção, relação com o
grupo (aliado, amigável, neutro, desconfiado, hostil), onde achar, personalidade, até 10 falas prontas e até 8 camadas de
segredo. Na ficha: **Sussurrar** uma fala (vai entre aspas, com o retrato, para quem você escolher), **Revelar** uma
camada (manda só aquela camada e a marca como revelada; as outras nunca saem do Grimório) e **Ocultar de novo** (só
desmarca, para reusar o NPC em outra mesa). Filtros Tudo / Criaturas / NPCs com contagem; a busca acha nome, tipo, Caminho
e facção. Chamar à cena, Duelo, Roda e batalhas funcionam igual às criaturas. Virar criatura limpa os campos de pessoa.

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

**Sequência na mesa:** a Sequência que vale nas rolagens é a do servidor, não a que a ficha do site declara. Quando o jogador
ascende na escada de poder, a cerimônia continua igual para ele, mas vira um **pedido de ascensão**: aparece na fila "Pedidos
de ascensão" (com a digestão da poção, para ajudar a decidir) e a carta ganha "▲ ascensão". Aprovando, a Sequência muda na
hora; recusando (com recado), a ficha dele volta. Na ficha do jogador, "Elevar" e "Rebaixar" mudam direto. Em todos os casos
ele recebe o selo de cera. Quem entra numa mesa começa na Sequência 9; se a ficha do site estiver adiante, o pedido chega sozinho.

**Ficha montada na mesa** (opcional, Fase B2 de [SISTEMAS-DA-MESA.md](SISTEMAS-DA-MESA.md)): no cabeçalho da mesa, ligue a pena
"Ficha montada na mesa". O jogador entra só com o código e monta a ficha num assistente (Atributos, Origem, Selar) guiado pelas
regras em vigor; os atributos são **rolados pelo servidor** (`rolar_ficha`) e só rolam de novo se você **Liberar nova ficha** ou
recusar. Ele também pode trazer a ficha do site, se os atributos batem com as regras; ficha trazida sempre espera a sua aprovação.
Com o selo "Aprovar cada ficha" aceso, toda ficha nova cai na fila **Fichas para aprovar** (com recado), e até lá o jogador
joga sem modificador. Cada ficha fica na versão das regras em que foi feita; o botão **Migrar** na carta do jogador passa para
a versão em vigor quando os atributos continuam valendo. Desligar a pena devolve a ficha do site. O Teste lista os atributos
da regra em vigor, e o servidor recusa atributo que não existe nela.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `js/config.js` | URL e chave **pública** do Supabase (a `sb_publishable_` é feita para ficar no navegador) |
| `js/mestre.js` | Cliente (`Rede`): baixa o supabase-js **só quando usado**, versão fixa 2.118.0 + hash SRI; mestre e jogador guardam sessões separadas |
| `js/painel.js` + `mestre.html` | Grimório do Mestre |
| `js/jogador.js` | Lado do jogador na aba Testes; envia a ficha quando ela é salva |
| `js/mesa.js` | `Mesa.rolar({ fixo: [n] })` anima até um número já decidido |
| `tests/mestre.js` | Cerca de 490 testes com um Supabase falso (`tests/supabase-falso.js`) que imita a RLS e as funções |

Para trocar a versão do supabase-js: mude a URL em `js/mestre.js` e recalcule o hash
(`curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A`). O teste confere o hash com a CDN.

## Banco (Supabase)

Tudo com RLS: o navegador só lê o que a política permite e só escreve pelas funções do servidor.

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
| `efeitos` (bênçãos, maldições, selos) | o mestre; o jogador só os próprios avisados | só o mestre |
| `mesa_regras` (versões das regras) | o mestre e os jogadores da mesa | só o mestre (versão nova; nada é sobrescrito) |
| `jogadores.sequencia` | o mestre e o próprio jogador | só por função: `julgar_ascensao`, `definir_sequencia` |
| `ascensoes` (pedidos de ascensão) | o mestre; o jogador só os seus | jogador por `pedir_ascensao`; mestre por `julgar_ascensao`, `definir_sequencia` |
| `fichas_mesa` (ficha montada na mesa) | o mestre; o jogador só a sua | só por função: `rolar_ficha`, `enviar_ficha`, `converter_ficha`, `julgar_ficha`, `liberar_ficha`, `migrar_ficha` |

O dado é rolado **no servidor** (`responder_pedido`, `rolar_secreto`); o site só anima até o número.
Desde `20261115_regras_da_mesa.sql`, o modificador **não** vem mais de `ficha.mods` (que o navegador manda): o servidor calcula
a partir de `ficha.base` (os dados rolados, 3 a 18), Caminho, Raça e Sequência, com as regras da mesa (`mesa_regras`, a versão mais
nova; sem regras = predefinição `lotm`, idêntica ao site). Vale para o teste secreto, o aberto, a Roda e o Duelo. Ao gravar a ficha,
um gatilho regrava `mods`, `attrs`, `pvMax`, `sanMax`, `espMax`, `maximos` e `regras_versao`: o mestre vê o número verdadeiro.
Fórmulas das regras: mini-linguagem sem `eval` (números, `+ - * /`, parênteses, `NdM`, abreviações, `SEQ`, `NIVEL`, `mod/min/max/floor`),
com o mesmo intérprete em `js/regras.js` e em plpgsql; fórmula inválida é recusada com a posição. A Sequência vem de
`jogadores.sequencia` (o navegador não decide). Na mesa com ficha montada, a base vem de `fichas_mesa` (dados rolados pelo servidor), na versão das
regras em que a ficha foi feita.

As migrações ficam em `supabase/migrations/` (em ordem) e os cenários de verificação de cada uma em `supabase/verificacoes/`.
Ferramentas, testes e o Storage de imagens: [DESENVOLVIMENTO.md](DESENVOLVIMENTO.md).
