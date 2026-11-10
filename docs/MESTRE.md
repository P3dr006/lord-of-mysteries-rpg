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

NPCs: `20261113_npcs_no_bestiario.sql`, verificado em 22 cenários com papéis reais **sem aplicar**
(`supabase/verificacoes/20261113_npcs_no_bestiario.sql`: criatura antiga continua, todos os checks, dono fora do grant,
outro mestre não lê nem altera, jogador anônimo não lê nem insere, camada revelada fica salva).

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
Desde `20261115_regras_da_mesa.sql`, o modificador **não** vem mais de `ficha.mods` (que o navegador manda): o servidor calcula
a partir de `ficha.base` (os dados rolados, 3 a 18), Caminho, Raça e Sequência, com as regras da mesa (`mesa_regras`, a versão mais
nova; sem regras = predefinição `lotm`, idêntica ao site). Vale para o teste secreto, o aberto, a Roda e o Duelo. Ao gravar a ficha,
um gatilho regrava `mods`, `attrs`, `pvMax`, `sanMax`, `espMax`, `maximos` e `regras_versao`: o mestre vê o número verdadeiro.
Fórmulas das regras: mini-linguagem sem `eval` (números, `+ - * /`, parênteses, `NdM`, abreviações, `SEQ`, `NIVEL`, `mod/min/max/floor`),
com o mesmo intérprete em `js/regras.js` e em plpgsql; fórmula inválida é recusada com a posição. Verificada em 83 cenários com
papéis reais, desfeita (`supabase/verificacoes/20261115_regras_da_mesa.sql`). Resta: a Sequência ainda é declarada pelo jogador.

Verificado em 24 cenários com papéis reais (mestre, 2 jogadores anônimos, visitante sem login).

Migração `20261111_batalhas_e_efeitos.sql` (**ainda não aplicada**): `encontros` com várias batalhas por mesa
(`id`, `nome`, `jogadores`, `sairam`; o jogador lê só a sua), funções `iniciar_batalha`, `regirar_batalha`,
`passar_turno`, `encerrar_batalha`, `entrar_na_batalha`, `sair_da_batalha` (as antigas de encontro foram removidas);
tabela `efeitos` (só o mestre escreve; o jogador lê só os próprios não secretos; limite de 30 por gatilho);
`privado.mod_do_jogador` / `mod_visivel` somam os efeitos em `rolar_secreto`, `responder_pedido` e no Duelo;
`segredos_pedido.oculto` e `resultados_mestre` com o total real. Verificada em 35 cenários com papéis reais, desfeita no fim.

## Migrações pela linha de comando

`tools/migracao.js` roda a migração direto no banco, pela conexão de `SUPABASE_DB_URL`:

- `node tools/migracao.js verificar supabase/migrations/X.sql verificacao.sql`: migração + cenários numa transação que é
  **sempre desfeita**; mostra só a linha `RESULTADO`.
- `node tools/migracao.js aplicar supabase/migrations/X.sql --sim`: aplica e registra em `supabase_migrations`.

Configuração (uma vez, feita pelo Pedro no terminal dele, **nunca** no projeto nem no chat):
1. Supabase > Project Settings > Database > Connection string (URI, "Session pooler"), com a senha do banco.
2. `setx SUPABASE_DB_URL "postgresql://..."` e abrir um terminal novo.
3. Se o Node reclamar do certificado: baixar em Database > SSL Configuration e `setx SUPABASE_DB_CA "C:\caminho\prod-ca.crt"`.

Travas: só aceita o projeto lotm-rpg, só lê `.sql`, verifica o TLS (não há modo inseguro), nunca imprime a URL nem a senha
(nem em erros), `aplicar` exige `--sim`. Sem a variável, as migrações continuam pelo conector do Supabase.

Dados 3D e cenas com GSAP (fase 4 do roteiro; **tudo é enfeite opcional**, o conteúdo já está na página e as animações CSS continuam):

- `js/animar.js`: baixa o **GSAP 3.15.0** da CDN com hash de integridade (sha384), só quando a mesa liga. Sem rede ou com
  "reduzir movimento" ligado, `Animar.pode()` é falso e tudo cai nas animações CSS de sempre. Nenhuma mudança na CSP
  (`cdn.jsdelivr.net` já estava liberada). Para trocar a versão: baixe o arquivo, calcule o sha384 e atualize `src` e `sri`.
- `js/dado3d.js`: d4, d6, d8, d12 e d20 em CSS 3D (sólidos de verdade, faces numeradas com opostos somando lados+1). O dado
  **nunca decide o número**: `Mesa.rolar` já tem o valor (do servidor, nos testes pedidos pelo mestre) e o dado gira, quica
  e pousa nessa face. d10, d22 e d100 usam a animação 2D de antes. O elemento termina com `data-valor` e `aria-label`.
  (O dice-box foi descartado: a física dele decide o número e não dá para forçá-lo, o que quebraria o teste do servidor.)
- `js/cenas.js`: linhas do tempo do GSAP para o sussurro (palavras saem do desfoque, pista se desdobra), o decreto (o selo
  carimba com impacto e um anel) e a virada de turno da Roda (mola, chama e rolagem até o token). A classe `gs` desliga as
  animações CSS dos elementos conduzidos pelo GSAP.

Verificação de código (fase 3 do roteiro; só ferramentas de desenvolvimento, o site continua sem build):

- `npm run verificar` = `npm run tipos` + `npm run lint`. **O normal é terminar sem nenhuma linha de erro.**
- `npm run tipos`: TypeScript lê os `.js` (`checkJs`, `tsconfig.json`) e acha nome de função trocado, chamada com argumentos
  demais e valor de tipo errado. `js/tipos.d.ts` só afrouxa as propriedades de DOM mais usadas (o site não carrega esse arquivo).
  Falsos alarmes conhecidos ficam com `// @ts-expect-error` e o motivo ao lado.
- `npm run lint`: Biome (só verifica, não reformata). `biome.jsonc` explica cada regra desligada. Se aparecer um aviso
  novo, é sinal real: corrija ou comente com `biome-ignore` e o motivo.
- Os 6 módulos globais (`Rede`, `Mesa`, `Jogador`, `Efeitos`, `Poster`, `Som`) são `Object.freeze(...)`: o verificador só
  acusa nome de propriedade errado em objeto fechado, e ninguém altera módulo depois de criado.

Testes enxutos: `npm run test:quieto` (só falhas + placar) e `node tests/mestre.js --quieto --ate=7d` (para depois da seção).

## Imagens no Storage (fase 5 do roteiro, migração `20261114_imagens_no_storage`)

As imagens saíram das linhas do banco: a linha guarda só o **caminho** do arquivo no bucket privado `imagens`
(até 300 KB, só WebP/JPEG/PNG). Para mostrar, o site pede uma **URL assinada** (vale 1 h, reaproveitada enquanto vale,
então o navegador usa o cache). As regras ficam no banco (RLS em `storage.objects`), nunca no navegador:

- `bestiario/<mestre>/<uuid>.webp`: retrato de criatura/NPC. Só o dono (com e-mail) envia, vê e apaga.
- `mesas/<mesa>/<uuid>.webp`: imagem de pista. Só o mestre da mesa envia e apaga. O jogador **só consegue assinar** o
  arquivo se existir um sussurro visível a ele apontando para ele (para ele ou "para todos"). Sussurro apagado = acabou.
- **Revelar criatura copia** o retrato para a pasta da mesa (uma cópia por sussurro): apagar a pista não apaga o retrato
  nem a pista dos outros. Trocar/tirar retrato, apagar sussurro, criatura ou mesa apaga o arquivo pela API
  (o SQL não apaga arquivos: gatilho `storage.protect_objects_delete`). Se a API falhar, o arquivo fica órfão, sem quebrar nada.
- Ajudantes no módulo `Rede` (`js/mestre.js`): `enviarImagem`, `copiarImagem`, `apagarImagens`, `apagarPasta`, `urlsDasImagens`.
- CSP de `index.html` e `mestre.html`: `img-src` inclui `https://adkecwrxjmmzqxnmwips.supabase.co`.
- **Transição:** a coluna base64 antiga (`imagem`) continua lida e aceita (a função `sussurrar` de 5 argumentos também,
  para abas com o site antigo). Uma linha nunca tem as duas. Depois de migrar tudo, uma migração futura pode apagar as colunas.

Ordem para publicar: (1) `node tools/migracao.js aplicar supabase/migrations/20261114_imagens_no_storage.sql --sim`
(o site novo chama `sussurrar` com 6 argumentos: sem a migração, sussurrar falha); (2) push do site;
(3) `node tools/migrar-imagens.js` (ensaio, só lê) e depois `node tools/migrar-imagens.js --sim`, que envia as imagens antigas
e troca o base64 pelo caminho. O `--sim` precisa de `SUPABASE_SECRET_KEY` (`sb_secret_…`, painel > Project Settings >
API Keys) **só** em variável do Windows (`setx`); ela passa por cima da RLS, por isso só esse script a usa. Idempotente:
rodar de novo só pega o que faltou.

## Configuração que falta no painel do Supabase

Em **Authentication → URL Configuration**: Site URL e Redirect URLs =
`https://p3dr006.github.io/lord-of-mysteries-rpg/` (e `.../mestre.html`). Sem isso, o link de confirmação
do e-mail leva para o endereço errado. Confira também se "Confirm email" está ligado.

### Limites contra abuso (migração `20261112`)

- **Código de mesa errado:** 15 erros por hora por usuário; depois disso a entrada é bloqueada até passar uma hora.
  O banco devolve *vazio* (e não erro) para código inexistente, porque um erro desfaria o registro da tentativa;
  o site traduz o vazio em "Mesa não encontrada".
- **Código sorteado** com `gen_random_uuid()` (criptográfico), 6 caracteres de um alfabeto de 32.
- **Imagens:** o navegador do mestre reduz para WebP (até 1280 px; alvo de ~185 KB, descendo a qualidade só se precisar) e
  o banco recusa acima de 300 mil caracteres. Redesenhar no canvas apaga os metadados (EXIF, GPS).
- **Bestiário:** no máximo 100 criaturas por mestre (gatilho `bestiario_limite`).
- Verificação com papéis reais: `supabase/verificacoes/20261112_endurece_codigo_e_imagens.sql`.

### Anti-robô (Cloudflare Turnstile) — opcional, desligado por padrão

O código já está pronto: com `CONFIG.captcha.chave` vazia (`js/config.js`) nada é pedido. Para ligar, **nesta ordem**
(se o Supabase for ligado antes de o site enviar o token, o login para de funcionar, até o dos jogadores):
1. Cloudflare (conta grátis) → **Turnstile → Add widget**: hostname `p3dr006.github.io`, modo **Managed**.
2. Copie a **Site Key** (pública) para `captcha.chave` em `js/config.js` e publique o site.
3. Só então, no Supabase: **Authentication → Attack Protection → Enable CAPTCHA**, provedor **Turnstile**, e cole a
   **Secret Key** ali. A Secret Key **nunca** vai no código nem no chat.
Para desligar: Supabase primeiro (desliga o CAPTCHA), depois esvazie `captcha.chave` e publique.

Lembretes: o plano grátis não tem backup e **pausa após 1 semana sem uso** (reative no painel).
