# Desenvolvimento

Como o código é verificado, testado e migrado. O guia de uso do mestre está em [MESTRE.md](MESTRE.md).

## Migrações pela linha de comando

`tools/migracao.js` roda a migração direto no banco, pela conexão de `SUPABASE_DB_URL`:

- `node tools/migracao.js verificar supabase/migrations/X.sql verificacao.sql`: migração + cenários numa transação que é
  **sempre desfeita**; mostra só a linha `RESULTADO`.
- `node tools/migracao.js aplicar supabase/migrations/X.sql --sim`: aplica e registra em `supabase_migrations`.

A conexão vem só da variável de ambiente `SUPABASE_DB_URL` (ou do `.env`, a partir do modelo `.env.example`, com
`npm run migracao -- verificar ...`).

Travas: só aceita o projeto deste site, só lê `.sql`, verifica o TLS (não há modo inseguro), nunca imprime a URL nem a
senha (nem em erros), e `aplicar` exige `--sim`.

## Animações

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

## Verificação de código

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
