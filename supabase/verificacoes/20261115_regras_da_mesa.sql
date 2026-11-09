-- Verificação da migração 20261115 com papéis reais (authenticated). Roda dentro de uma transação que é SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261115_regras_da_mesa.sql supabase/verificacoes/20261115_regras_da_mesa.sql
-- Os casos de fórmula são os de tests/formulas-casos.json (os mesmos que o JS roda em tests/mestre.js).
-- Os números esperados das fichas foram calculados por js/regras.js (que é idêntico ao site de hoje: 9660 combinações).
do $$
declare
  mestre uuid := gen_random_uuid(); outro uuid := gen_random_uuid(); jog uuid := gen_random_uuid(); jog2 uuid := gen_random_uuid(); fora uuid := gen_random_uuid();
  cod text; mid uuid; r jsonb; f jsonb; n int; v numeric; pid uuid; bid uuid; falhas text := ''; ok_ int := 0; regras1 jsonb; regras_ruins jsonb; lotm jsonb;
  ctx_atr jsonb := '{"nomes":["ATR"],"vars":{"VIG":14,"PRE":8,"FOR":18,"SEQ":7,"NIVEL":3,"ATR":15},"dados":false,"validar":false}';
  ctx_ficha jsonb; ctx_dados jsonb; mn int := 99; mx int := 0; i int;
  forjada jsonb := '{"v":2,"base":{"forca":12,"agil":15,"vigor":9,"intel":16,"espir":13,"pres":8},"caminhoId":"louco","racaId":"humano","seq":7,"mods":{"forca":30,"agil":30,"vigor":30,"intel":30,"espir":30,"pres":30},"attrs":{"forca":60},"pvMax":999,"sanMax":999,"espMax":999}';
begin
  ctx_ficha := jsonb_build_object('nomes', '["FOR","AGI","VIG","INT","ESP","PRE","SEQ","NIVEL"]'::jsonb, 'vars', ctx_atr -> 'vars', 'modf', privado.regras_lotm() ->> 'modificador', 'dados', false, 'validar', false);
  ctx_dados := ctx_ficha || '{"dados":true}';

  -- ---------- 1) intérprete: os mesmos casos do JS (valor e posição do erro) ----------
  v := privado.formula('1 + 2 * 3', ctx_ficha); if v is not distinct from 7 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '1 + 2 * 3' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('(1 + 2) * 3', ctx_ficha); if v is not distinct from 9 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '(1 + 2) * 3' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('floor((3 - 10) / 2)', ctx_atr); if v is not distinct from -4 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'floor((3 - 10) / 2)' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('floor((ATR - 10) / 2)', ctx_atr); if v is not distinct from 2 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'floor((ATR - 10) / 2)' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('(ATR - 10) / 2', ctx_atr); if v is not distinct from 2 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '(ATR - 10) / 2' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('1 / 3 * 3', ctx_ficha); if v is not distinct from 1 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '1 / 3 * 3' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('-2 - -3', ctx_ficha); if v is not distinct from 1 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '-2 - -3' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('--5', ctx_ficha); if v is not distinct from 5 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '--5' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('max(1, 2, 7) + min(4, 2)', ctx_ficha); if v is not distinct from 9 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'max(1, 2, 7) + min(4, 2)' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('10 + mod(VIG) * 2 + (9 - SEQ) * 3', ctx_ficha); if v is not distinct from 20 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '10 + mod(VIG) * 2 + (9 - SEQ) ' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('10 + mod(PRE) * 2 + 5', ctx_ficha); if v is not distinct from 13 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '10 + mod(PRE) * 2 + 5' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('mod(FOR) + NIVEL', ctx_ficha); if v is not distinct from 7 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'mod(FOR) + NIVEL' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('max(1, mod(PRE))', ctx_ficha); if v is not distinct from 1 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'max(1, mod(PRE))' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('vig * 2', ctx_ficha); if v is not distinct from 28 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'vig * 2' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('10 / 0', ctx_ficha); if v is not distinct from null then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '10 / 0' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('10 / (SEQ - 7) + 1', ctx_ficha); if v is not distinct from null then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '10 / (SEQ - 7) + 1' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('9999 * 9999', ctx_ficha); if v is not distinct from 9999 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '9999 * 9999' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('-9999 * 9999', ctx_ficha); if v is not distinct from -9999 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '-9999 * 9999' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('7 / 2', ctx_ficha); if v is not distinct from 3 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '7 / 2' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('-7 / 2', ctx_ficha); if v is not distinct from -4 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '-7 / 2' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('  12  ', ctx_atr); if v is not distinct from 12 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '  12  ' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  begin perform privado.formula('', ctx_ficha); falhas := falhas || ' [aceitou ' || '' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: a fórmula está vazia' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('   ', ctx_ficha); falhas := falhas || ' [aceitou ' || '   ' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: a fórmula está vazia' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '   ' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('1 +', ctx_ficha); falhas := falhas || ' [aceitou ' || '1 +' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 4: a fórmula terminou antes da hora' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '1 +' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('(1 + 2', ctx_ficha); falhas := falhas || ' [aceitou ' || '(1 + 2' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 7: faltou fechar o parêntese' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '(1 + 2' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('2 $ 3', ctx_ficha); falhas := falhas || ' [aceitou ' || '2 $ 3' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 3: símbolo não permitido: "$"' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '2 $ 3' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('FOO + 1', ctx_ficha); falhas := falhas || ' [aceitou ' || 'FOO + 1' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: nome desconhecido: FOO' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'FOO + 1' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('1 + mod(ATR)', ctx_atr); falhas := falhas || ' [aceitou ' || '1 + mod(ATR)' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 5: mod() não é permitido aqui' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '1 + mod(ATR)' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('VIG + 1', ctx_atr); falhas := falhas || ' [aceitou ' || 'VIG + 1' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: nome desconhecido: VIG' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'VIG + 1' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('3d', ctx_dados); falhas := falhas || ' [aceitou ' || '3d' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 3: faltou o número de lados do dado' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '3d' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('0d6', ctx_dados); falhas := falhas || ' [aceitou ' || '0d6' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: dado com quantidade fora de 1 a 100' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '0d6' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('2d1', ctx_dados); falhas := falhas || ' [aceitou ' || '2d1' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 3: dado com lados fora de 2 a 1000' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '2d1' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('1d6x', ctx_dados); falhas := falhas || ' [aceitou ' || '1d6x' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 4: faltou um operador' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '1d6x' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('3VIG', ctx_ficha); falhas := falhas || ' [aceitou ' || '3VIG' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 2: faltou um operador' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '3VIG' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('2d6 + 1', ctx_ficha); falhas := falhas || ' [aceitou ' || '2d6 + 1' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: dados não são permitidos aqui' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '2d6 + 1' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('1 2', ctx_ficha); falhas := falhas || ' [aceitou ' || '1 2' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 3: esperava + - * / ou o fim' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '1 2' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('min(1)', ctx_ficha); falhas := falhas || ' [aceitou ' || 'min(1)' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: min() recebe de 2 a 10 valores' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'min(1)' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('floor(1, 2)', ctx_ficha); falhas := falhas || ' [aceitou ' || 'floor(1, 2)' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: floor() recebe 1 valor' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'floor(1, 2)' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('sqrt(4)', ctx_ficha); falhas := falhas || ' [aceitou ' || 'sqrt(4)' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: função desconhecida: sqrt' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'sqrt(4)' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('max(1 2)', ctx_ficha); falhas := falhas || ' [aceitou ' || 'max(1 2)' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 7: esperava , ou )' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'max(1 2)' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('* 3', ctx_ficha); falhas := falhas || ' [aceitou ' || '* 3' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: esperava um número, um nome ou (' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '* 3' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('1234567', ctx_ficha); falhas := falhas || ' [aceitou ' || '1234567' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: número grande demais (máximo 6 algarismos)' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '1234567' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('((((((((((((((((((((((1))))))))))))))))))))))', ctx_ficha); falhas := falhas || ' [aceitou ' || '((((((((((((((((((((((1)))))))' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 21: aninhamento fundo demais (máximo 20)' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '((((((((((((((((((((((1)))))))' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1', ctx_ficha); falhas := falhas || ' [aceitou ' || '1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 201: fórmula longa demais (máximo 200 caracteres)' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+' || ': ' || sqlerrm || ']'; end if; end;
  -- dados de verdade: 2d6 fica entre 2 e 12 e as pontas aparecem
  for i in 1..400 loop v := privado.formula('2d6', ctx_dados); mn := least(mn, v::int); mx := greatest(mx, v::int); end loop;
  if mn = 2 and mx = 12 then ok_ := ok_ + 1; else falhas := falhas || ' [2d6 de ' || mn || ' a ' || mx || ']'; end if;
  -- validar: dado vale a quantidade e divisão por zero vale 0 (não recusa uma fórmula boa por causa dos valores de teste)
  if privado.formula('3d6 + 10 / (SEQ - 9)', ctx_dados || '{"validar":true,"vars":{"SEQ":9}}') = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [modo validar]'; end if;

  -- ---------- 2) predefinição lotm: os números do site de hoje ----------
  r := privado.calcular_ficha(privado.regras_lotm(), forjada);
  if r = '{"attrs":{"forca":12,"agil":15,"vigor":10,"intel":17,"espir":15,"pres":9},"mods":{"forca":1,"agil":2,"vigor":0,"intel":3,"espir":2,"pres":-1},"maximos":{"pv":16,"san":13,"esp":18}}'::jsonb
  then ok_ := ok_ + 1; else falhas := falhas || ' [lotm ficha 1: ' || r || ']'; end if;
  r := privado.calcular_ficha(privado.regras_lotm(), '{"base":{"forca":18,"agil":18,"vigor":18,"intel":18,"espir":18,"pres":18},"caminhoId":"tirano","racaId":"dragao","seq":0}');
  if r = '{"attrs":{"forca":28,"agil":21,"vigor":21,"intel":23,"espir":22,"pres":19},"mods":{"forca":9,"agil":5,"vigor":5,"intel":6,"espir":6,"pres":4},"maximos":{"pv":47,"san":23,"esp":40}}'::jsonb
  then ok_ := ok_ + 1; else falhas := falhas || ' [lotm ficha 2: ' || r || ']'; end if;
  r := privado.calcular_ficha(privado.regras_lotm(), '{"base":{"forca":3,"agil":3,"vigor":3,"intel":3,"espir":3,"pres":3},"seq":9}');
  if r = '{"attrs":{"forca":3,"agil":3,"vigor":3,"intel":3,"espir":3,"pres":3},"mods":{"forca":-4,"agil":-4,"vigor":-4,"intel":-4,"espir":-4,"pres":-4},"maximos":{"pv":2,"san":7,"esp":2}}'::jsonb
  then ok_ := ok_ + 1; else falhas := falhas || ' [lotm ficha 3: ' || r || ']'; end if;
  -- base fora de 3..18, texto ou fração não vale (e Sequência inválida vira 9)
  r := privado.calcular_ficha(privado.regras_lotm(), '{"base":{"forca":19,"agil":2,"vigor":"14","intel":10.5},"caminhoId":"louco","seq":"0"}');
  if r = '{"attrs":{},"mods":{},"maximos":{"pv":null,"san":null,"esp":null}}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [base invalida: ' || r || ']'; end if;
  -- as regras ruins são recusadas com o campo e a posição (a mesma mensagem do JS)
  begin perform privado.validar_regras(privado.regras_lotm() || '{"modificador":"floor((ATR - 10) / 2"}'); falhas := falhas || ' [regra ruim aceita]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (modificador): Fórmula inválida na posição 21: esperava , ou )' then ok_ := ok_ + 1; else falhas := falhas || ' [msg modificador: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(privado.regras_lotm(), '{recursos,1,max}', '"10 + mod(XYZ)"')); falhas := falhas || ' [recurso ruim aceito]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (recursos[1].max): Fórmula inválida na posição 10: nome desconhecido: XYZ' then ok_ := ok_ + 1; else falhas := falhas || ' [msg recurso: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(privado.regras_lotm(), '{atributos,2,abrev}', '"SEQ"')); falhas := falhas || ' [abrev reservada aceita]';
  exception when sqlstate '22023' then if sqlerrm like 'Regras inválidas (atributos[2].abrev)%' then ok_ := ok_ + 1; else falhas := falhas || ' [msg abrev: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(privado.regras_lotm() || '{"recursos":[{"id":"pv","max":"2d6"}]}'); falhas := falhas || ' [dado no max aceito]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  perform privado.validar_regras(privado.regras_lotm()); ok_ := ok_ + 1;   -- a predefinição passa na própria validação

  lotm := privado.regras_lotm();
  regras1 := privado.regras_lotm() || '{"modificador":"ATR - 10"}';
  regras1 := jsonb_set(regras1, '{recursos,0,max}', '"100 + mod(VIG)"');
  regras_ruins := privado.regras_lotm() || '{"modificador":"floor((ATR - 10) / 2"}';

  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (outro,  'authenticated', 'authenticated', 'o-' || outro || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,  'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog2, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (fora, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

  -- ---------- 3) mestre cria a mesa; o papel authenticated não chama o intérprete direto ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  cod := public.criar_mesa('Mesa das regras');
  select id into mid from public.mesas where codigo = cod;
  begin perform privado.formula('1', '{}'); falhas := falhas || ' [authenticated chamou privado.formula]'; exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin perform privado.calcular_ficha('{}', '{}'); falhas := falhas || ' [authenticated chamou calcular_ficha]'; exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ---------- 4) a brecha: jogador entra com mods forjados (+30) ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Klein', forjada);
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if f -> 'mods' = '{"forca":1,"agil":2,"vigor":0,"intel":3,"espir":2,"pres":-1}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [mods gravados: ' || coalesce(f -> 'mods', 'null') || ']'; end if;
  if (f ->> 'pvMax')::int = 16 and (f ->> 'sanMax')::int = 13 and (f ->> 'espMax')::int = 18 and (f -> 'attrs' ->> 'forca')::int = 12 and (f ->> 'regras_versao')::int = 0
  then ok_ := ok_ + 1; else falhas := falhas || ' [maximos/attrs gravados: ' || f || ']'; end if;
  -- forjar de novo por update direto também não vale
  update public.jogadores set ficha = forjada || '{"mods":{"forca":30}}' where mesa_id = mid and user_id = jog;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f -> 'mods' ->> 'forca')::int = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [update forjado: ' || (f -> 'mods') || ']'; end if;
  -- o segundo jogador: base inválida (19 e texto) e sem base na Agilidade
  perform set_config('request.jwt.claims', json_build_object('sub', jog2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Audrey', '{"base":{"forca":19,"pres":"18"},"mods":{"forca":30,"agil":30,"pres":30}}');
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog2;
  if f -> 'mods' = '{}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [mods de base invalida: ' || (f -> 'mods') || ']'; end if;
  -- quem está fora não lê as regras
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.mesa_regras; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [jogador viu regras inexistentes]'; end if;

  -- ---------- 5) as rolagens usam o calculado: teste secreto, teste aberto, Roda e Duelo ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  r := public.rolar_secreto(mid, jog, 'Força bruta', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 1 and (r ->> 'total')::int = (r ->> 'dado')::int + 1 then ok_ := ok_ + 1; else falhas := falhas || ' [secreto: ' || r || ']'; end if;
  r := public.rolar_secreto(mid, jog2, 'Força de Audrey', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [secreto base invalida: ' || r || ']'; end if;
  pid := public.pedir_teste(mid, jog, 'Decifrar', 'intel', 20, 12);
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  r := public.responder_pedido(pid, 30);
  if (r ->> 'modificador')::int = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [aberto: ' || r || ']'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  bid := public.iniciar_batalha(mid, 'Beco', array[jog, jog2], null);
  select ordem into r from public.encontros where id = bid;
  if (select (x ->> 'bonus')::int from jsonb_array_elements(r) x where x ->> 'id' = jog::text) = 2
     and (select (x ->> 'bonus')::int from jsonb_array_elements(r) x where x ->> 'id' = jog2::text) = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [roda: ' || r || ']'; end if;
  r := public.disputar(mid, 'Queda de braço', 'jogador', jog::text, 'forca', 'jogador', jog2::text, 'pres', true);
  if (r -> 'a' ->> 'mod')::int = 1 and (r -> 'b' ->> 'mod')::int = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [duelo: ' || r || ']'; end if;
  -- bênção continua somando por cima do calculado
  insert into public.efeitos (mesa_id, user_id, tipo, atributo, valor, rotulo) values (mid, jog, 'bencao', 'forca', 2, 'Bênção do Louco');
  r := public.rolar_secreto(mid, jog, 'Força abençoada', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [bencao: ' || r || ']'; end if;

  -- ---------- 6) mesa_regras: o mestre cria versões, regra ruim é recusada, o jogador só lê ----------
  begin insert into public.mesa_regras (mesa_id, regras) values (mid, regras_ruins); falhas := falhas || ' [regra ruim gravada]';
  exception when sqlstate '22023' then if sqlerrm like '%posição 21%' then ok_ := ok_ + 1; else falhas := falhas || ' [msg insert: ' || sqlerrm || ']'; end if; end;
  insert into public.mesa_regras (mesa_id, regras) values (mid, regras1) returning versao into n;
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [versao 1: ' || n || ']'; end if;
  begin insert into public.mesa_regras (mesa_id, versao, regras) values (mid, 50, regras1); falhas := falhas || ' [mestre escolheu a versao]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  -- a rolagem já usa as regras novas (modificador = ATR - 10: Força 12 -> +2)
  r := public.rolar_secreto(mid, jog2, 'Nada', 'agil', 20, 10);   -- jog2 sem base continua 0
  if (r ->> 'modificador')::int = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [jog2 regras novas: ' || r || ']'; end if;
  delete from public.efeitos where mesa_id = mid;
  r := public.rolar_secreto(mid, jog, 'Força nova', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [regras novas na rolagem: ' || r || ']'; end if;
  -- outro mestre não cria regras nesta mesa nem as lê
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  begin insert into public.mesa_regras (mesa_id, regras) values (mid, regras1); falhas := falhas || ' [outro mestre criou regras]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  select count(*) into n from public.mesa_regras where mesa_id = mid; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [outro mestre leu regras]'; end if;
  -- o jogador da mesa lê; regrava a ficha e ela passa para a versão 1
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.mesa_regras where mesa_id = mid; if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [jogador leu ' || n || ' regras]'; end if;
  begin insert into public.mesa_regras (mesa_id, regras) values (mid, regras1); falhas := falhas || ' [jogador criou regras]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  update public.jogadores set ficha = ficha where mesa_id = mid and user_id = jog;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f -> 'mods' ->> 'forca')::int = 2 and (f ->> 'pvMax')::int = 100 and (f ->> 'regras_versao')::int = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [ficha na versao 1: ' || f || ']'; end if;
  -- quem não está na mesa não lê
  perform set_config('request.jwt.claims', json_build_object('sub', fora, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.mesa_regras; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [intruso leu regras]'; end if;
  -- o mestre cria a versão 2; apagar a mesa leva as regras junto
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  insert into public.mesa_regras (mesa_id, regras) values (mid, lotm) returning versao into n;
  if n = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [versao 2: ' || n || ']'; end if;
  r := public.rolar_secreto(mid, jog, 'De volta ao lotm', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [versao 2 na rolagem: ' || r || ']'; end if;
  begin update public.mesa_regras set regras = regras1 where mesa_id = mid; falhas := falhas || ' [mestre reescreveu uma versao]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  delete from public.mesas where id = mid;
  execute 'reset role';
  select count(*) into n from public.mesa_regras where mesa_id = mid; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [regras sobraram apos apagar a mesa]'; end if;

  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
