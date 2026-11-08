-- Verificação da migração 20261113 com papéis reais (authenticated). Roda dentro de uma transação que é SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261113_npcs_no_bestiario.sql supabase/verificacoes/20261113_npcs_no_bestiario.sql
do $$
declare
  mestre uuid := gen_random_uuid(); outro uuid := gen_random_uuid(); jog uuid := gen_random_uuid();
  npc uuid; n int; falhas text := ''; ok_ int := 0; cat text;
begin
  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (outro,  'authenticated', 'authenticated', 'o-' || outro || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,    'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';

  -- criatura antiga (sem os campos novos) continua valendo e nasce como "criatura"
  insert into public.bestiario (nome) values ('Lobo velho') returning categoria into cat;
  if cat = 'criatura' then ok_ := ok_ + 1; else falhas := falhas || ' [categoria padrao: ' || coalesce(cat, 'nulo') || ']'; end if;

  -- NPC completo
  insert into public.bestiario (nome, categoria, caminho, sequencia, faccao, relacao, local, personalidade, falas, segredos)
  values ('Dunn Smith', 'npc', 'louco', 7, 'Falcões Noturnos', 'aliado', 'Rua Zouteland, 36', 'Distraído, leal',
          '["Ah, esqueci de novo."]'::jsonb, '[{"texto":"É capitão","revelado":false},{"texto":"Vê sonhos","revelado":false}]'::jsonb)
  returning id into npc;
  ok_ := ok_ + 1;

  -- o dono altera as colunas novas (revelar uma camada)
  update public.bestiario set segredos = '[{"texto":"É capitão","revelado":true},{"texto":"Vê sonhos","revelado":false}]'::jsonb, relacao = 'neutro' where id = npc;
  get diagnostics n = row_count;
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [dono nao atualizou segredos]'; end if;

  -- checks recusam valores fora
  begin insert into public.bestiario (nome, categoria) values ('x', 'deus'); falhas := falhas || ' [categoria invalida aceita]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, caminho) values ('x', 'Louco!'); falhas := falhas || ' [caminho invalido aceito]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, sequencia) values ('x', 10); falhas := falhas || ' [sequencia 10 aceita]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, sequencia) values ('x', -1); falhas := falhas || ' [sequencia -1 aceita]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, relacao) values ('x', 'amante'); falhas := falhas || ' [relacao invalida aceita]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, faccao) values ('x', repeat('a', 61)); falhas := falhas || ' [faccao longa aceita]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, local) values ('x', repeat('a', 121)); falhas := falhas || ' [local longo aceito]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, personalidade) values ('x', repeat('a', 601)); falhas := falhas || ' [personalidade longa aceita]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, falas) values ('x', '{"a":1}'::jsonb); falhas := falhas || ' [falas objeto aceito]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, falas) values ('x', (select jsonb_agg('f'::text) from generate_series(1, 11))); falhas := falhas || ' [11 falas aceitas]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, segredos) values ('x', (select jsonb_agg(jsonb_build_object('texto', 's')) from generate_series(1, 9))); falhas := falhas || ' [9 segredos aceitos]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, segredos) values ('x', jsonb_build_array(jsonb_build_object('texto', repeat('a', 7000)))); falhas := falhas || ' [segredos enormes aceitos]'; exception when check_violation then ok_ := ok_ + 1; end;
  begin insert into public.bestiario (nome, falas) values ('x', null); falhas := falhas || ' [falas nulas aceitas]'; exception when not_null_violation then ok_ := ok_ + 1; end;

  -- dono, id e datas continuam fora do grant de update
  begin update public.bestiario set dono = outro where id = npc; falhas := falhas || ' [dono alterado]'; exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- outro mestre não vê nem altera o NPC
  perform set_config('request.jwt.claims', json_build_object('sub', outro, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.bestiario where id = npc;
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [outro mestre leu o NPC]'; end if;
  update public.bestiario set segredos = '[]'::jsonb where id = npc; get diagnostics n = row_count;
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [outro mestre alterou o NPC]'; end if;

  -- jogador anônimo não lê nem escreve
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.bestiario;
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [jogador leu o bestiario]'; end if;
  begin insert into public.bestiario (nome, categoria) values ('Espião', 'npc'); falhas := falhas || ' [jogador inseriu NPC]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- de volta ao dono: a camada revelada ficou salva
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.bestiario where id = npc and (segredos -> 0 ->> 'revelado')::boolean and relacao = 'neutro';
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [camada revelada nao ficou salva]'; end if;

  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
