# Ideias para a mesa: efeitos, selos e batalhas

Registro de design de três recursos pedidos pelo Pedro.

> **Status: implementadas** (publicadas em 2026-11-07): as três abaixo. Ficou de fora: mudar PV/Sanidade máximos e duração automática
> (por N cenas ou só no próximo teste); hoje o efeito vale até o mestre desfazer. Detalhes em docs/MESTRE.md.

## 1. Controle da ficha do jogador: bênçãos e maldições (buff e nerf)

O mestre altera a ficha do jogador a qualquer momento, **avisando ou em segredo**.

- **O que pode mudar:** modificadores dos atributos, PV e Sanidade máximos e Espiritualidade, por exemplo.
- **Avisando:** o jogador recebe a cena (como o decreto com selo) e vê o efeito marcado na ficha, ex.: "Bênção da Deusa: +2 Força".
- **Em segredo:** o efeito vale nas rolagens feitas pelo servidor (teste secreto, teste aberto, Duelo, Roda), mas a ficha do
  jogador continua mostrando o número antigo. Só o mestre vê o valor real e o motivo.
- **Duração:** até o mestre tirar, por N cenas ou só no próximo teste.
- No Grimório, a carta do jogador mostra os efeitos ativos (ex.: "✦ 1 bênção · ☠ 1 maldição oculta").
- Entra na Crônica.

Observação técnica: hoje o modificador vem da ficha que o navegador do jogador manda. O efeito precisa morar no servidor
(numa tabela própria, que o jogador não lê quando é secreto) e ser somado em `mod_da_ficha`, senão o jogador poderia
descobrir ou desfazer.

## 2. Bloqueio e perda de habilidade

Vale a mesma ideia de avisar ou não.

- **Bloquear:** a habilidade fica selada (ex.: "selada por 3 cenas" ou "até quebrar a maldição") e depois volta.
  - Avisando: aparece com corrente/lacre na ficha e o motivo.
  - Em segredo: o jogador ainda vê a habilidade, mas, quando tentar usar, o mestre sabe que ela falha.
    O Grimório mostra "bloqueada em segredo".
- **Perder:** a habilidade some de vez.
  - Avisando: cena de perda (selo quebrado, a habilidade se desfazendo).
  - Em segredo: ela continua na ficha do jogador, mas o mestre sabe que não funciona mais.
- Vale para as habilidades da mesa e as do Caminho.
- Desbloquear e devolver também, com ou sem aviso.
- Entra na Crônica.

## 3. Batalhas com quem o mestre escolher (e mais de uma ao mesmo tempo)

- **Revelar criatura para quem eu quiser:** escolher um jogador, alguns ou todos (hoje o "Revelar" vai para todos).
- **Batalha com participantes escolhidos:** a Roda do Destino deixa marcar quais jogadores entram (hoje entram todos) e quais
  figuras/criaturas.
- **Duas (ou mais) batalhas simultâneas na mesma sessão:** ex.: o grupo se separou, uma luta no cais e outra na catedral.
  Cada batalha tem o próprio nome, a própria ordem de turnos, rodada e figuras. O Grimório mostra as batalhas lado a lado
  (ou em abas) e o mestre passa o turno de cada uma separadamente.
- **Entrar e sair no meio da batalha:** adicionar ou retirar jogador (ou criatura) a qualquer momento, sem reiniciar a Roda.
  Quem entra rola a iniciativa e é encaixado na ordem; quem sai some da ordem sem pular a vez de ninguém.
- Cada jogador só vê a faixa da batalha em que está (e "É a sua vez" só dela).
- Entra na Crônica: "Batalha do Cais — Audrey entra na rodada 3", "Klein foge na rodada 5".

Observação técnica: hoje existe um encontro por mesa (`encontros`, chave = mesa_id). Vai precisar de várias batalhas por mesa
(id próprio) e da lista de participantes de cada uma; o jogador só lê as batalhas em que está.
