# Sistemas da mesa: o mestre escolhe (e configura) as regras

Rascunho de design, 2026-11-08. Nada implementado ainda. Cada fase abaixo é uma sessão própria.

## A ideia em 1 minuto

O mestre escolhe, ao criar a mesa, qual sistema ela usa:

1. **Lord of Mysteries (o de hoje).** O jogador monta a ficha no site e entra com o código. Nada muda para quem já joga.
2. **Sistema do mestre.** O mestre configura atributos, como rolar, vida, classes e habilidades. O jogador entra **sem ficha**,
   só com o código, e monta a ficha **dentro da mesa**, guiado pelas regras do mestre.
3. **Estilo MMO.** Sai do molde de D&D: nível e experiência, classes com papel (tanque, cura, dano), recursos próprios
   (mana, fúria, energia), habilidades com recarga, talentos e equipamento. Inspirado no gênero, com nomes e arte nossos.

**Decisão central:** não são 3 sistemas. É **um motor de regras** que lê as regras como **dados** (um JSON por mesa), e os
3 modos são **predefinições** desse motor. Motivo: hoje as regras estão escritas no código em dois lugares (JS e SQL); com
3 sistemas separados, toda correção seria feita 3 vezes. Com um motor, o modo 3 sai quase de graça depois do 2.

## Como as regras estão hoje (o que o motor precisa reproduzir)

- 6 atributos fixos: `forca`, `agil`, `vigor`, `intel`, `espir`, `pres`. Cada um é **4d6 descartando o menor** (3 a 18).
- Modificador: `floor((valor - 10) / 2)` (`js/state.js`).
- PV máximo: `10 + mod(vigor) * 2 + (9 - sequencia) * 3`. Sanidade máxima: `10 + mod(pres) * 2 + 5`. Há também Espiritualidade.
- Caminho (22) e Sequência (9 a 0) dão a progressão; ascender recalcula PV e mexe na Sanidade (`js/poder.js`).
- No banco, `privado.mod_da_ficha` lê `ficha.mods[attr]`, **que o próprio jogador manda**, e só limita a ±30.
  **Brecha atual:** um jogador que mexer no navegador pode mandar `mods.forca = 30`. O motor fecha isso (Fase A).

## O formato das regras (JSON por mesa)

```json
{
  "versao": 1,
  "base": "lotm",
  "atributos": [
    { "id": "forca", "nome": "Força", "abrev": "FOR" },
    { "id": "vigor", "nome": "Vigor", "abrev": "VIG" }
  ],
  "geracao": { "metodo": "4d6-menor", "rerrolar": 1 },
  "modificador": "floor((ATR - 10) / 2)",
  "recursos": [
    { "id": "pv",  "nome": "Pontos de Vida", "max": "10 + mod(VIG) * 2 + (9 - SEQ) * 3", "cor": "#e05a6a" },
    { "id": "san", "nome": "Sanidade",       "max": "10 + mod(PRE) * 2 + 5",            "cor": "#6fb4ff" }
  ],
  "progressao": { "tipo": "sequencia", "de": 9, "ate": 0 },
  "classes": [],
  "habilidades": "livres"
}
```

Peças:

- **`geracao.metodo`**: `4d6-menor` (hoje), `3d6`, `compra-de-pontos` (orçamento e custo por valor), `valores-fixos`
  (ex.: 15, 14, 13, 12, 10, 8 para distribuir) ou `livre` (o mestre aprova).
- **`recursos`**: barras da ficha (PV, Sanidade, mana, fúria...). `max` é uma fórmula; pode existir `regen` por turno.
- **`progressao`**: `sequencia` (LotM), `nivel` (com tabela de experiência) ou `nenhuma`.
- **`classes`**: nome, papel, dado de vida, atributo principal, recursos próprios, habilidades por nível.
- **`habilidades`**: `livres` (como hoje, o jogador propõe e o mestre aprova) ou uma lista fechada por classe.

### Fórmulas: uma mini-linguagem, nunca `eval`

`1d10 + mod(VIG)`, `10 + NIVEL * 2`, `max(1, mod(FOR))`. Só números, `+ - * /`, parênteses, dados `NdM`, as abreviações
dos atributos, `NIVEL`/`SEQ` e algumas funções (`mod`, `min`, `max`, `floor`). O mesmo intérprete pequeno existe em JS
(para mostrar prévia) e em SQL/plpgsql (para valer). **Executar texto do mestre como código seria um buraco de segurança.**
Fórmula inválida é recusada ao salvar, com a posição do erro.

### Regras no banco

- Tabela `mesa_regras (mesa_id, versao, regras jsonb, criado_em)`: o mestre escreve; o jogador lê as da mesa dele.
- A ficha guardada (`jogadores.ficha`) passa a ter `regras_versao`. O **servidor** calcula modificadores e máximos a partir
  dos atributos + regras; o que o navegador manda como `mods` deixa de valer.
- Mudar regras com a campanha rolando cria uma **versão nova**; fichas antigas continuam na versão delas até o mestre
  migrar (ou o jogador refazer). Nada quebra em silêncio.

## Modo 2: a ficha montada dentro da mesa

1. Jogador abre a Mesa do Destino, digita o código, sem ficha.
2. A mesa diz "esta mesa usa o sistema do mestre" e abre um **assistente de ficha** gerado pelas regras: atributos (no
   método escolhido), classe, recursos calculados, habilidades.
3. Rolagens de criação feitas **pelo servidor** (como o dado dos testes pedidos), para ninguém rolar até tirar 18.
4. O mestre pode exigir **aprovação** antes de a ficha valer.
5. A ficha fica guardada na mesa (e uma cópia local, para jogar offline como hoje).

## Modo 3: estilo MMO (predefinição "Aventura")

- **Progressão por nível** (1 a 20) e experiência dada pelo mestre.
- **Classes com papel**: tanque (protege, chama a atenção), cura (recupera), dano (à distância ou corpo a corpo), suporte.
- **Recursos por classe**: mana (regenera devagar), fúria (sobe ao levar/dar dano), energia (regenera rápido, limite baixo).
- **Recarga**: habilidade com `recarga: 3` só volta depois de 3 turnos na Roda. A Roda já tem rodadas e vez: é encaixar.
- **Ameaça**: criaturas do bestiário escolhem alvo por ameaça (o tanque "puxa"). Opcional, para o mestre ligar.
- **Talentos**: a cada N níveis, escolher 1 de 3 caminhos da classe.
- **Equipamento**: arma/armadura com bônus e nível de item; o mestre entrega como hoje entrega bênçãos.
- **Combate por turnos** (a Roda e o Duelo de hoje), não em tempo real: combina com mesa de RPG e com o que existe.

## Fases

| Fase | O que | Resultado visível | Risco |
|---|---|---|---|
| **A** | Motor + tabela `mesa_regras` + predefinição LotM igual a hoje; servidor passa a calcular os modificadores | Nenhum (tudo igual), **e fecha a brecha do `mods`** | médio (mexe no coração dos testes) |
| **B** | Editor de regras no Grimório + assistente de ficha dentro da mesa (modo 2) | Mestre cria o sistema dele | médio |
| **C** | Predefinição MMO: nível, classes, recursos, recarga e ameaça na Roda (modo 3) | Mesa estilo MMO | médio |
| **D** | Compartilhar sistemas entre mestres (exportar/importar JSON) | Biblioteca de sistemas | baixo |

Prova de cada fase: os testes atuais continuam passando (a predefinição LotM tem de ser idêntica ao de hoje), cenários
novos no Supabase falso, migração verificada com papéis reais numa transação desfeita, prints.

## Decisões do Pedro (2026-11-08)

1. **Ficha antiga no modo 2:** o **jogador escolhe**. A mesa oferece converter (quando os atributos batem com as regras)
   ou começar do zero.
2. **Mudar regras no meio da campanha:** **pode, com versões.** Fichas antigas seguem na versão delas até o mestre migrar
   ou o jogador refazer.
3. **Aprovação da ficha no modo 2:** **opcional, o mestre liga** nas configurações da mesa. Ligada, a ficha fica
   "pendente", como as habilidades propostas hoje.
4. **Modo 3:** ainda aberto. Proposta padrão: combate por turnos (a Roda), papéis tanque/cura/dano e recursos
   mana/fúria/energia na primeira versão. Decidir antes da Fase C.
5. **Ordem:** **Fase A primeiro.** Motor + predefinição LotM idêntica ao de hoje + servidor calculando os modificadores
   (fecha a brecha do `mods`). Uma sessão própria, partindo deste arquivo.
