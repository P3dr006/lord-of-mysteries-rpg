-- Verificação da migração 20261117 (Sequência no servidor) com papéis reais (authenticated). Transação SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261117_sequencia_no_servidor.sql supabase/verificacoes/20261117_sequencia_no_servidor.sql
do $$
declare
  mestre uuid := gen_random_uuid(); jog uuid := gen_random_uuid(); jog2 uuid := gen_random_uuid();
  cod text; mid uuid; r jsonb; f jsonb; n int; s int; aid uuid; falhas text := ''; ok_ int := 0; e text;
  -- Louco: Espiritualidade é o atributo do Caminho (+2); base 12.
  fx jsonb := '{"v":2,"base":{"forca":10,"agil":10,"vigor":10,"intel":10,"espir":12,"pres":10},"caminhoId":"louco","racaId":"","seq":3}';
begin
  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,  'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog2, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  cod := public.criar_mesa('Mesa da Sequência');
  select id into mid from public.mesas where codigo = cod;

  -- ---------- 1) quem entra começa na 9, mesmo mandando Seq. 3 ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Klein', fx);
  select sequencia, ficha into s, f from public.jogadores where mesa_id = mid and user_id = jog;
  if s = 9 and (f ->> 'seq')::int = 9 and (f ->> 'seq_site')::int = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [entrada: ' || s || ' ' || f || ']'; end if;
  update public.jogadores set ficha = ficha || '{"seq":0}' where mesa_id = mid and user_id = jog;
  select sequencia, ficha into s, f from public.jogadores where mesa_id = mid and user_id = jog;
  if s = 9 and (f ->> 'seq')::int = 9 and (f ->> 'seq_site')::int = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [seq 0 forjada: ' || f || ']'; end if;
  begin update public.jogadores set sequencia = 0 where mesa_id = mid and user_id = jog; falhas := falhas || ' [jogador mudou a coluna]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ---------- 2) o teste usa a Sequência do servidor ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  r := public.rolar_secreto(mid, jog, 'Espírito na 9', 'espir', 20, 10);
  if (r ->> 'modificador')::int = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [mod na 9: ' || r || ']'; end if;

  -- ---------- 3) o jogador pede; um pedido por vez; não pede para trás ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin perform public.pedir_ascensao(mid, 9); falhas := falhas || ' [pediu a mesma Sequencia]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  perform public.pedir_ascensao(mid, 3);
  aid := public.pedir_ascensao(mid, 5);
  select count(*) into n from public.ascensoes where mesa_id = mid and user_id = jog and estado = 'pendente';
  if n = 1 and (select para from public.ascensoes where id = aid) = 5 and (select de from public.ascensoes where id = aid) = 9 then ok_ := ok_ + 1; else falhas := falhas || ' [pendentes: ' || n || ']'; end if;
  begin perform public.julgar_ascensao(aid, true, ''); falhas := falhas || ' [jogador se aprovou]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into public.ascensoes (mesa_id, user_id, de, para, origem, estado) values (mid, jog, 9, 0, 'mestre', 'aprovada'); falhas := falhas || ' [jogador inseriu ascensao]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  -- outro jogador da mesa não lê o pedido
  perform set_config('request.jwt.claims', json_build_object('sub', jog2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Audrey', '{"seq":9}');
  select count(*) into n from public.ascensoes; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [outro jogador leu ' || n || ']'; end if;
  begin perform public.definir_sequencia(mid, jog2, 0, ''); falhas := falhas || ' [jogador se promoveu]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ---------- 4) o mestre aprova: a Sequência muda e vale na rolagem ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.ascensoes where mesa_id = mid; if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [mestre leu ' || n || ']'; end if;
  perform public.julgar_ascensao(aid, true, 'A poção assentou.');
  select sequencia, ficha into s, f from public.jogadores where mesa_id = mid and user_id = jog;
  r := public.rolar_secreto(mid, jog, 'Espírito na 5', 'espir', 20, 10);
  -- Seq. 5: "principal" [6,3,1] alcança o 6 (+1), "todos" [4,2,0] ainda não: 12 + 2 + 1 = 15 → mod +2... confere com o motor
  if s = 5 and (f ->> 'seq')::int = 5 and (f ->> 'seq_site')::int = 0 and (r ->> 'modificador')::int = floor((12 + 2 + 1 - 10) / 2.0)::int then ok_ := ok_ + 1;
  else falhas := falhas || ' [aprovada: ' || s || ' ' || r || ']'; end if;
  begin perform public.julgar_ascensao(aid, false, ''); falhas := falhas || ' [julgou duas vezes]';
  exception when others then ok_ := ok_ + 1; end;

  -- ---------- 5) recusa com recado; a Sequência fica ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  aid := public.pedir_ascensao(mid, 4);
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.julgar_ascensao(aid, false, 'Ainda não digeriu.');
  select sequencia into s from public.jogadores where mesa_id = mid and user_id = jog;
  if s = 5 and (select estado || '|' || resposta from public.ascensoes where id = aid) = 'recusada|Ainda não digeriu.' then ok_ := ok_ + 1; else falhas := falhas || ' [recusa]'; end if;

  -- ---------- 6) o mestre muda direto: pedidos somem e fica o registro para o selo ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.pedir_ascensao(mid, 2);
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.definir_sequencia(mid, jog, 7, 'A maldição cobra o preço.');
  select sequencia, ficha into s, f from public.jogadores where mesa_id = mid and user_id = jog;
  select count(*) into n from public.ascensoes where mesa_id = mid and user_id = jog and estado = 'pendente';
  if s = 7 and (f ->> 'seq')::int = 7 and n = 0 and exists (select 1 from public.ascensoes where mesa_id = mid and user_id = jog and origem = 'mestre' and de = 5 and para = 7 and estado = 'aprovada') then ok_ := ok_ + 1;
  else falhas := falhas || ' [definir: ' || s || ' pendentes ' || n || ']'; end if;
  begin perform public.definir_sequencia(mid, jog, 7, ''); falhas := falhas || ' [definiu a mesma]';
  exception when others then ok_ := ok_ + 1; end;
  begin perform public.definir_sequencia(mid, jog, 10, ''); falhas := falhas || ' [aceitou 10]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;

  -- ---------- 7) pedido velho: a Sequência mudou por outro caminho ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  aid := public.pedir_ascensao(mid, 6);
  execute 'reset role';
  update public.jogadores set sequencia = 8 where mesa_id = mid and user_id = jog;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  begin perform public.julgar_ascensao(aid, true, ''); falhas := falhas || ' [aprovou pedido velho]';
  exception when others then e := sqlerrm; if e like '%mudou desde o pedido%' then ok_ := ok_ + 1; else falhas := falhas || ' [velho: ' || e || ']'; end if; end;
  select (ficha ->> 'seq')::int into s from public.jogadores where mesa_id = mid and user_id = jog;
  if s = 8 then ok_ := ok_ + 1; else falhas := falhas || ' [gatilho na coluna: ' || s || ']'; end if;

  -- ---------- 8) efeitos com atributo da regra (com "_"); sair e voltar recomeça na 9 ----------
  insert into public.efeitos (mesa_id, user_id, tipo, atributo, valor, rotulo) values (mid, jog, 'bencao', 'sorte_x', 2, 'Sorte grande'); ok_ := ok_ + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  delete from public.jogadores where mesa_id = mid and user_id = jog;
  perform public.entrar_na_mesa(cod, 'Klein', fx);
  select sequencia into s from public.jogadores where mesa_id = mid and user_id = jog;
  if s = 9 then ok_ := ok_ + 1; else falhas := falhas || ' [voltou em ' || s || ']'; end if;

  execute 'reset role';
  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
