# Parte do mestre

Decisões do autor:

- O jogador **não escolhe a dificuldade**. A mesa de dados só rola e mostra o número.
- **1 natural e 20 natural** são só efeito visual e sonoro. O mestre decide o que acontece.
- O mestre tem **dois tipos de teste**:
  - **Secreto:** só o mestre vê. O jogador não recebe pedido nem resultado.
  - **Aberto:** o jogador recebe o pedido, rola, e o resultado aparece para os dois.
  - Em ambos, a **dificuldade e o "passou ou não" ficam só com o mestre**.

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
No teste secreto o modificador vem de `ficha.mods.<atributo>` do jogador.
Jogadores entram sem conta (login anônimo do Supabase) com o código da mesa de 6 letras.

Verificado em 24 cenários com papéis reais (mestre, 2 jogadores anônimos, visitante sem login).

## Falta fazer (site)

- Cliente do Supabase em `js/mestre.js` (usa `js/config.js`), carregado só se houver rede.
- Tela do mestre: login, criar mesa, painel ao vivo (PV e Sanidade), pedir teste aberto, rolar secreto, resultados.
- Lado do jogador: entrar na mesa com o código, receber pedidos na Mesa do Destino, enviar a ficha (`mods`, PV, Sanidade).
- O site continua funcionando sem rede e sem banco.
