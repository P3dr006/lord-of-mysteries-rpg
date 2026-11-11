-- Verificação da migração 20261118 (nível, classes e recursos de classe) com papéis reais (authenticated). Transação SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261118_nivel_e_classes.sql supabase/verificacoes/20261118_nivel_e_classes.sql
-- Os casos de fórmula, de ficha, de nível e de regras ruins são os de tests/formulas-casos.json (os mesmos que o JS roda em tests/mestre.js).
do $$
declare
  mestre uuid := gen_random_uuid(); jog uuid := gen_random_uuid(); jog2 uuid := gen_random_uuid(); fora uuid := gen_random_uuid();
  cod text; mid uuid; cod2 text; mid2 uuid; r jsonb; f jsonb; f0 jsonb; n int; v numeric; s int; falhas text := ''; ok_ int := 0; e text; vig int; pv int;
  av jsonb := '{"versao":1,"base":"aventura","atributos":[{"id":"forca","nome":"Força","abrev":"FOR"},{"id":"agil","nome":"Agilidade","abrev":"AGI"},{"id":"vigor","nome":"Vigor","abrev":"VIG"},{"id":"intel","nome":"Intelecto","abrev":"INT"},{"id":"espir","nome":"Espiritualidade","abrev":"ESP"},{"id":"pres","nome":"Presença","abrev":"PRE"}],"geracao":{"metodo":"4d6-menor","min":3,"max":18},"total":"max(1, ATR)","modificador":"floor((ATR - 10) / 2)","bonus":{},"recursos":[{"id":"pv","nome":"Pontos de Vida","max":"10 + DV + mod(VIG) + (NIVEL - 1) * (DV / 2 + mod(VIG))","cor":"#e05a6a"},{"id":"mana","nome":"Mana","max":"20 + mod(ESP) * 4 + NIVEL * 5","cor":"#5b8cff","so":"mana"},{"id":"furia","nome":"Fúria","max":"100","cor":"#e0652a","so":"furia"},{"id":"energia","nome":"Energia","max":"40 + mod(AGI) * 2","cor":"#e8c84a","so":"energia"}],"progressao":{"tipo":"nivel","de":1,"ate":20,"xp":[0,100,300,600,1000,1500,2100,2800,3600,4500,5500,6600,7800,9100,10500,12000,13600,15300,17100,19000]},"classes":[{"id":"sentinela","nome":"Sentinela","papel":"tanque","recurso":"furia","principal":"vigor","dv":12,"desc":"Fica na frente e atrai os golpes para si. A fúria cresce a cada pancada, dada ou levada."},{"id":"lamparineiro","nome":"Lamparineiro","papel":"cura","recurso":"mana","principal":"espir","dv":8,"desc":"Mantém a chama do grupo acesa: fecha feridas e devolve o fôlego a quem caiu."},{"id":"duelista","nome":"Duelista","papel":"dano","recurso":"energia","principal":"agil","dv":10,"desc":"Golpes rápidos, de perto ou à distância. A energia volta depressa, mas acaba logo."},{"id":"arauto","nome":"Arauto","papel":"suporte","recurso":"mana","principal":"pres","dv":8,"desc":"Ergue o estandarte: fortalece os aliados e atrapalha os inimigos."}],"habilidades":"livres"}'::jsonb;
  ctx_ficha jsonb; ctx_classe jsonb;
begin
  ctx_ficha := jsonb_build_object('nomes', '["FOR","AGI","VIG","INT","ESP","PRE","SEQ","NIVEL"]'::jsonb, 'vars', '{"VIG":14,"PRE":8,"FOR":18,"SEQ":7,"NIVEL":3,"ATR":15,"DV":10}'::jsonb, 'modf', av ->> 'modificador', 'dados', false, 'validar', false);
  ctx_classe := ctx_ficha || jsonb_build_object('nomes', '["FOR","AGI","VIG","INT","ESP","PRE","SEQ","NIVEL","DV"]'::jsonb);

  -- ---------- 1) intérprete: DV (os mesmos casos do JS) ----------
  v := privado.formula('DV + 1', ctx_classe); if v is not distinct from 11 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'DV + 1' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('10 + DV + mod(VIG) + (NIVEL - 1) * (DV / 2 + mod(VIG))', ctx_classe); if v is not distinct from 36 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || '10 + DV + mod(VIG) + (NIVEL - ' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('DV / 4', ctx_classe); if v is not distinct from 2 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'DV / 4' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('max(DV, NIVEL * 5)', ctx_classe); if v is not distinct from 15 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'max(DV, NIVEL * 5)' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  v := privado.formula('dv * 2 - NIVEL', ctx_classe); if v is not distinct from 17 then ok_ := ok_ + 1; else falhas := falhas || ' [valor ' || 'dv * 2 - NIVEL' || ' = ' || coalesce(v::text, 'nulo') || ']'; end if;
  begin perform privado.formula('DV + 1', ctx_ficha); falhas := falhas || ' [aceitou ' || 'DV + 1' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: nome desconhecido: DV' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'DV + 1' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('dv(2)', ctx_classe); falhas := falhas || ' [aceitou ' || 'dv(2)' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 1: função desconhecida: dv' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'dv(2)' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('DV 2', ctx_classe); falhas := falhas || ' [aceitou ' || 'DV 2' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 4: esperava + - * / ou o fim' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || 'DV 2' || ': ' || sqlerrm || ']'; end if; end;
  begin perform privado.formula('2DV', ctx_classe); falhas := falhas || ' [aceitou ' || '2DV' || ']';
  exception when sqlstate '22023' then if sqlerrm = 'Fórmula inválida na posição 3: faltou o número de lados do dado' then ok_ := ok_ + 1; else falhas := falhas || ' [erro ' || '2DV' || ': ' || sqlerrm || ']'; end if; end;

  -- ---------- 2) a ficha Aventura calculada (os mesmos números do js/regras.js) e o nível pela XP ----------
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":14,"intel":10,"espir":12,"pres":9},"classeId":"sentinela","nivel":5}'::jsonb) -> 'maximos'; if r = '{"pv":56,"furia":100}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 0: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":14,"intel":10,"espir":12,"pres":9},"classeId":"duelista","nivel":1}'::jsonb) -> 'maximos'; if r = '{"pv":22,"energia":44}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 1: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":14,"intel":10,"espir":12,"pres":9},"classeId":"lamparineiro","nivel":20}'::jsonb) -> 'maximos'; if r = '{"pv":134,"mana":124}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 2: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":3,"intel":10,"espir":18,"pres":9},"classeId":"lamparineiro","nivel":20}'::jsonb) -> 'maximos'; if r = '{"pv":14,"mana":136}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 3: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":14,"intel":10,"espir":12,"pres":9},"classeId":"arauto","nivel":0}'::jsonb) -> 'maximos'; if r = '{"pv":20,"mana":29}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 4: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":14,"intel":10,"espir":12,"pres":9},"classeId":""}'::jsonb) -> 'maximos'; if r = '{"pv":null}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 5: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10,"agil":15,"vigor":14,"intel":10,"espir":12,"pres":9},"classeId":"mago","nivel":7}'::jsonb) -> 'maximos'; if r = '{"pv":null}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 6: ' || r || ']'; end if;
  r := privado.calcular_ficha(av, '{"base":{"forca":10},"classeId":"sentinela","nivel":3}'::jsonb) -> 'maximos'; if r = '{"pv":null,"furia":100}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [ficha 7: ' || r || ']'; end if;
  if privado.nivel_por_xp(av, 0) = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 0: ' || privado.nivel_por_xp(av, 0) || ']'; end if;
  if privado.nivel_por_xp(av, 99) = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 99: ' || privado.nivel_por_xp(av, 99) || ']'; end if;
  if privado.nivel_por_xp(av, 100) = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 100: ' || privado.nivel_por_xp(av, 100) || ']'; end if;
  if privado.nivel_por_xp(av, 299) = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 299: ' || privado.nivel_por_xp(av, 299) || ']'; end if;
  if privado.nivel_por_xp(av, 300) = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 300: ' || privado.nivel_por_xp(av, 300) || ']'; end if;
  if privado.nivel_por_xp(av, 4499) = 9 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 4499: ' || privado.nivel_por_xp(av, 4499) || ']'; end if;
  if privado.nivel_por_xp(av, 4500) = 10 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 4500: ' || privado.nivel_por_xp(av, 4500) || ']'; end if;
  if privado.nivel_por_xp(av, 18999) = 19 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 18999: ' || privado.nivel_por_xp(av, 18999) || ']'; end if;
  if privado.nivel_por_xp(av, 19000) = 20 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 19000: ' || privado.nivel_por_xp(av, 19000) || ']'; end if;
  if privado.nivel_por_xp(av, 9999999) = 20 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel 9999999: ' || privado.nivel_por_xp(av, 9999999) || ']'; end if;
  if privado.nivel_por_xp(privado.regras_lotm(), 5000) = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [nivel lotm]'; end if;
  r := privado.calcular_ficha(privado.regras_lotm(), '{"base":{"forca":12,"agil":15,"vigor":9,"intel":16,"espir":13,"pres":8},"caminhoId":"louco","racaId":"humano","seq":7,"classeId":"sentinela"}');
  if r -> 'maximos' = '{"pv":16,"san":13,"esp":18}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [lotm mudou: ' || r || ']'; end if;

  -- ---------- 3) regras ruins: a mesma mensagem do JS ----------
  perform privado.validar_regras(av); ok_ := ok_ + 1;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,0,papel}', '"mago"'::jsonb)); falhas := falhas || ' [aceitou classes,0,papel]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[0].papel): papel: tanque, cura, dano ou suporte' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,0,papel: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,1,recurso}', '"vigor"'::jsonb)); falhas := falhas || ' [aceitou classes,1,recurso]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[1].recurso): recurso de classe: mana, furia ou energia' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,1,recurso: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,2,principal}', '"sorte"'::jsonb)); falhas := falhas || ' [aceitou classes,2,principal]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[2].principal): atributo principal: um atributo que existe' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,2,principal: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,3,dv}', '3'::jsonb)); falhas := falhas || ' [aceitou classes,3,dv]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[3].dv): dado de vida: inteiro de 4 a 20' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,3,dv: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,0,dv}', '21'::jsonb)); falhas := falhas || ' [aceitou classes,0,dv]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[0].dv): dado de vida: inteiro de 4 a 20' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,0,dv: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,1,id}', '"sentinela"'::jsonb)); falhas := falhas || ' [aceitou classes,1,id]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[1].id): id: de 1 a 12 letras minúsculas, sem repetir' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,1,id: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,2,nome}', '""'::jsonb)); falhas := falhas || ' [aceitou classes,2,nome]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[2].nome): nome: de 1 a 30 letras' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,2,nome: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{classes,0,desc}', '"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'::jsonb)); falhas := falhas || ' [aceitou classes,0,desc]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (classes[0].desc): descrição: até 200 letras' then ok_ := ok_ + 1; else falhas := falhas || ' [classes,0,desc: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{recursos,1,so}', '"vigor"'::jsonb)); falhas := falhas || ' [aceitou recursos,1,so]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (recursos[1].so): recurso de classe: mana, furia ou energia' then ok_ := ok_ + 1; else falhas := falhas || ' [recursos,1,so: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{progressao,xp,19}', '17000'::jsonb)); falhas := falhas || ' [aceitou progressao,xp,19]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (progressao.xp): tabela de XP: 20 valores inteiros crescentes, começando em 0 (até 1000000)' then ok_ := ok_ + 1; else falhas := falhas || ' [progressao,xp,19: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{progressao,xp,0}', '5'::jsonb)); falhas := falhas || ' [aceitou progressao,xp,0]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (progressao.xp): tabela de XP: 20 valores inteiros crescentes, começando em 0 (até 1000000)' then ok_ := ok_ + 1; else falhas := falhas || ' [progressao,xp,0: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{progressao,xp,5}', '"muito"'::jsonb)); falhas := falhas || ' [aceitou progressao,xp,5]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (progressao.xp): tabela de XP: 20 valores inteiros crescentes, começando em 0 (até 1000000)' then ok_ := ok_ + 1; else falhas := falhas || ' [progressao,xp,5: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{atributos,0,abrev}', '"DV"'::jsonb)); falhas := falhas || ' [aceitou atributos,0,abrev]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (atributos[0].abrev): abreviação: de 2 a 4 letras maiúsculas, sem repetir nem usar nome reservado' then ok_ := ok_ + 1; else falhas := falhas || ' [atributos,0,abrev: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{recursos,0,max}', '"10 + DV + XP"'::jsonb)); falhas := falhas || ' [aceitou recursos,0,max]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (recursos[0].max): Fórmula inválida na posição 11: nome desconhecido: XP' then ok_ := ok_ + 1; else falhas := falhas || ' [recursos,0,max: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{progressao,xp}', (av -> 'progressao' -> 'xp') - 19)); falhas := falhas || ' [aceitou xp curta]';
  exception when sqlstate '22023' then if sqlerrm = 'Regras inválidas (progressao.xp): tabela de XP: 20 valores inteiros crescentes, começando em 0 (até 1000000)' then ok_ := ok_ + 1; else falhas := falhas || ' [xp curta: ' || sqlerrm || ']'; end if; end;
  begin perform privado.validar_regras(jsonb_set(av, '{progressao,xp}', '"muito"')); falhas := falhas || ' [aceitou xp texto]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  perform privado.validar_regras(jsonb_set(av, '{progressao,tipo}', '"sequencia"') #- '{progressao,xp}'); ok_ := ok_ + 1;

  -- ---------- 4) a mesa Aventura: o mestre salva as regras e liga a ficha montada na mesa ----------
  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,  'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog2, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (fora, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  cod := public.criar_mesa('Mesa da Aventura'); select id into mid from public.mesas where codigo = cod;
  cod2 := public.criar_mesa('Mesa LotM'); select id into mid2 from public.mesas where codigo = cod2;
  insert into public.mesa_regras (mesa_id, regras) values (mid, av);
  begin insert into public.mesa_regras (mesa_id, regras) values (mid, jsonb_set(av, '{classes,0,papel}', '"mago"')); falhas := falhas || ' [salvou regra ruim]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  perform public.configurar_mesa(mid, true, false);
  perform public.configurar_mesa(mid2, true, false);

  -- ---------- 5) o jogador rola, escolhe a classe e sela ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Klein', '{"v":2,"nivel":20,"xp":99999,"classeId":"duelista"}');
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f ->> 'nivel')::int = 1 and (f ->> 'xp')::int = 0 and not f ? 'classeId' then ok_ := ok_ + 1; else falhas := falhas || ' [entrada forjada: ' || f || ']'; end if;
  perform public.rolar_ficha(mid);
  begin perform public.enviar_ficha(mid, '', ''); falhas := falhas || ' [selou sem classe]';
  exception when sqlstate '22023' then if sqlerrm = 'Escolha uma das classes desta mesa.' then ok_ := ok_ + 1; else falhas := falhas || ' [sem classe: ' || sqlerrm || ']'; end if; end;
  begin perform public.enviar_ficha(mid, '', '', 'mago'); falhas := falhas || ' [classe inventada]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  if public.enviar_ficha(mid, '', '', 'sentinela') = 'aprovada' then ok_ := ok_ + 1; else falhas := falhas || ' [nao aprovou]'; end if;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  select (base ->> 'vigor')::int into vig from public.fichas_mesa where mesa_id = mid and user_id = jog;
  pv := 10 + 12 + floor((vig - 10) / 2.0)::int;
  if (select classe_id from public.fichas_mesa where mesa_id = mid and user_id = jog) = 'sentinela' and f ->> 'classeId' = 'sentinela'
     and (f -> 'maximos' ->> 'pv')::int = pv and (f ->> 'pvMax')::int = pv and (f -> 'maximos' ->> 'furia')::int = 100 and not (f -> 'maximos') ? 'mana' and not (f -> 'maximos') ? 'energia' then ok_ := ok_ + 1;
  else falhas := falhas || ' [ficha selada: ' || f || ' vig ' || vig || ']'; end if;
  -- forjar no site não muda nível, XP nem classe; as colunas não são do jogador
  update public.jogadores set ficha = ficha || '{"nivel":20,"xp":99999,"classeId":"duelista"}' where mesa_id = mid and user_id = jog;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f ->> 'nivel')::int = 1 and (f ->> 'xp')::int = 0 and f ->> 'classeId' = 'sentinela' then ok_ := ok_ + 1; else falhas := falhas || ' [forjou: ' || f || ']'; end if;
  begin update public.jogadores set nivel = 20 where mesa_id = mid and user_id = jog; falhas := falhas || ' [jogador mudou nivel]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin update public.jogadores set xp = 5000 where mesa_id = mid and user_id = jog; falhas := falhas || ' [jogador mudou xp]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin update public.fichas_mesa set classe_id = 'duelista' where mesa_id = mid and user_id = jog; falhas := falhas || ' [jogador trocou a classe]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin perform public.dar_xp(mid, array[jog], 1000, ''); falhas := falhas || ' [jogador se deu XP]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into public.marcos (mesa_id, user_id, xp, de, para) values (mid, jog, 1, 1, 20); falhas := falhas || ' [jogador inseriu marco]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  perform set_config('request.jwt.claims', json_build_object('sub', jog2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Audrey', '{"v":2}');

  -- ---------- 6) o mestre dá XP: o nível sobe sozinho, marco e Crônica ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select ficha into f0 from public.jogadores where mesa_id = mid and user_id = jog;
  r := public.dar_xp(mid, array[jog], 350, '  A queda do Lorde Sombrio ');
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if jsonb_array_length(r) = 1 and (r -> 0 ->> 'para')::int = 3 and (select nivel || '|' || xp from public.jogadores where mesa_id = mid and user_id = jog) = '3|350'
     and (f ->> 'nivel')::int = 3 and (f ->> 'xp')::int = 350 and (f -> 'maximos' ->> 'pv')::int = pv + 2 * (6 + floor((vig - 10) / 2.0)::int) then ok_ := ok_ + 1;
  else falhas := falhas || ' [xp 350: ' || r || ' ' || (f -> 'maximos') || ']'; end if;
  if exists (select 1 from public.marcos where mesa_id = mid and user_id = jog and xp = 350 and de = 1 and para = 3 and motivo = 'A queda do Lorde Sombrio') then ok_ := ok_ + 1; else falhas := falhas || ' [marco]'; end if;
  if exists (select 1 from public.cronica where mesa_id = mid and texto = '✦ Klein ganha 350 XP — A queda do Lorde Sombrio')
     and exists (select 1 from public.cronica where mesa_id = mid and texto = '▲ Klein chega ao nível 3') then ok_ := ok_ + 1; else falhas := falhas || ' [cronica]'; end if;
  -- ao grupo (lista vazia): todos recebem; quem não sobe também ganha o marco
  r := public.dar_xp(mid, '{}', 50, null);
  if jsonb_array_length(r) = 2 and (select nivel || '|' || xp from public.jogadores where mesa_id = mid and user_id = jog2) = '1|50'
     and (select nivel || '|' || xp from public.jogadores where mesa_id = mid and user_id = jog) = '3|400'
     and exists (select 1 from public.marcos where mesa_id = mid and user_id = jog2 and de = 1 and para = 1 and motivo is null) then ok_ := ok_ + 1;
  else falhas := falhas || ' [grupo: ' || r || ']'; end if;
  r := public.dar_xp(mid, null, 19000, 'Fim da campanha');
  if (select nivel from public.jogadores where mesa_id = mid and user_id = jog) = 20 then ok_ := ok_ + 1; else falhas := falhas || ' [teto]'; end if;
  begin perform public.dar_xp(mid, array[jog], 0, ''); falhas := falhas || ' [aceitou 0 XP]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  begin perform public.dar_xp(mid, array[jog], 100001, ''); falhas := falhas || ' [aceitou 100001 XP]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  begin perform public.dar_xp(mid, array[fora], 10, ''); falhas := falhas || ' [deu XP a quem nao esta]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  begin perform public.dar_xp(mid2, null, 10, ''); falhas := falhas || ' [XP em mesa sem nivel]';
  exception when sqlstate '22023' then if sqlerrm = 'As regras desta mesa não usam nível.' then ok_ := ok_ + 1; else falhas := falhas || ' [sem nivel: ' || sqlerrm || ']'; end if; end;

  -- ---------- 7) quem lê os marcos ----------
  select count(*) into n from public.marcos where mesa_id = mid; if n = 5 then ok_ := ok_ + 1; else falhas := falhas || ' [mestre leu ' || n || ']'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', jog2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.marcos; if n = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [jog2 leu ' || n || ']'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', fora, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.marcos; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [fora leu ' || n || ']'; end if;

  -- ---------- 8) mesa sem classes: a chamada antiga (3 valores) continua valendo e a classe é ignorada ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod2, 'Klein', '{"v":2}');
  perform public.rolar_ficha(mid2);
  if public.enviar_ficha(mid2, 'louco', 'humano', 'sentinela') = 'aprovada' and (select classe_id from public.fichas_mesa where mesa_id = mid2 and user_id = jog) is null then ok_ := ok_ + 1;
  else falhas := falhas || ' [lotm com classe]'; end if;
  select ficha into f from public.jogadores where mesa_id = mid2 and user_id = jog;
  if not f ? 'classeId' and (f ->> 'nivel')::int = 1 and f -> 'maximos' ? 'san' then ok_ := ok_ + 1; else falhas := falhas || ' [lotm ficha: ' || f || ']'; end if;

  -- ---------- 9) migrar exige a classe na versão nova; rolar de novo zera a classe ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  insert into public.mesa_regras (mesa_id, regras) values (mid, jsonb_set(av, '{classes}', (av -> 'classes') - 0));
  begin perform public.migrar_ficha(mid, jog); falhas := falhas || ' [migrou sem a classe]';
  exception when sqlstate '22023' then if sqlerrm like '%não tem a classe desta ficha%' then ok_ := ok_ + 1; else falhas := falhas || ' [migrar: ' || sqlerrm || ']'; end if; end;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f ->> 'regras_versao')::int = 1 and f ->> 'classeId' = 'sentinela' then ok_ := ok_ + 1; else falhas := falhas || ' [versao da ficha: ' || f || ']'; end if;
  perform public.liberar_ficha(mid, jog);
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.rolar_ficha(mid);
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (select classe_id from public.fichas_mesa where mesa_id = mid and user_id = jog) is null and not f ? 'classeId' and (f ->> 'nivel')::int = 20 then ok_ := ok_ + 1;
  else falhas := falhas || ' [rolar de novo: ' || f || ']'; end if;
  begin perform public.enviar_ficha(mid, '', '', 'sentinela'); falhas := falhas || ' [usou classe que saiu]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  if public.enviar_ficha(mid, '', '', 'duelista') = 'aprovada' then ok_ := ok_ + 1; else falhas := falhas || ' [duelista]'; end if;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f ->> 'regras_versao')::int = 2 and f -> 'maximos' ? 'energia' and not (f -> 'maximos') ? 'furia' then ok_ := ok_ + 1; else falhas := falhas || ' [duelista ficha: ' || f || ']'; end if;

  execute 'reset role';
  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
