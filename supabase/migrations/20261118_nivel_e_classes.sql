-- Nível, classes e recursos de classe (Fase C1 de docs/SISTEMAS-DA-MESA.md, modo MMO, predefinição "Aventura").
-- Decisões do Pedro (2026-11-10):
-- - quatro papéis (tanque, cura, dano, suporte); cada classe usa UM recurso de classe (mana, fúria ou energia), além de PV;
-- - nível de 1 a 20 por uma tabela de XP; o MESTRE dá a XP (ao grupo, a alguns ou a um) e o nível sobe sozinho no servidor;
-- - o jogador recebe a cerimônia de nível (public.marcos) e a Crônica registra a XP e o nível novo.
-- O motor muda junto com js/regras.js (os dois iguais): o nome DV (dado de vida da classe) nas fórmulas, recursos[].so
-- (o máximo só existe para a classe que usa aquele recurso), a validação de progressao.xp e de classes.

-- =====================================================================================================
-- 1) o motor: validação e cálculo (mesma ordem de erros e mesmos números do js/regras.js)
-- =====================================================================================================
create or replace function privado.validar_regras(R jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare a jsonb; k int := 0; ids text[] := '{}'; abrevs text[] := '{}'; rids text[] := '{}'; cids text[] := '{}'; campo text; e jsonb; v jsonb; x jsonb;
  ctx_atr jsonb := '{"nomes":["ATR"],"vars":{"ATR":10},"dados":false,"validar":true}'::jsonb; ctx_r jsonb; g jsonb := R -> 'geracao';
  reservados text[] := array['ATR', 'SEQ', 'NIVEL', 'DV', 'MOD', 'MIN', 'MAX', 'FLOOR'];
begin
  if jsonb_typeof(R) is distinct from 'object' or jsonb_typeof(R -> 'atributos') is distinct from 'array'
     or jsonb_array_length(R -> 'atributos') not between 1 and 12 then
    raise exception 'Regras inválidas (atributos): de 1 a 12 atributos' using errcode = '22023';
  end if;
  for a in select * from jsonb_array_elements(R -> 'atributos') loop
    if jsonb_typeof(a -> 'id') is distinct from 'string' or a ->> 'id' !~ '^[a-z_]{1,12}$' or a ->> 'id' = any(ids) then
      raise exception 'Regras inválidas (atributos[%].id): id: de 1 a 12 letras minúsculas, sem repetir', k using errcode = '22023'; end if;
    if jsonb_typeof(a -> 'abrev') is distinct from 'string' or a ->> 'abrev' !~ '^[A-Z]{2,4}$' or a ->> 'abrev' = any(abrevs) or a ->> 'abrev' = any(reservados) then
      raise exception 'Regras inválidas (atributos[%].abrev): abreviação: de 2 a 4 letras maiúsculas, sem repetir nem usar nome reservado', k using errcode = '22023'; end if;
    if jsonb_typeof(a -> 'nome') is distinct from 'string' or char_length(a ->> 'nome') not between 1 and 30 then
      raise exception 'Regras inválidas (atributos[%].nome): nome: de 1 a 30 letras', k using errcode = '22023'; end if;
    ids := ids || (a ->> 'id'); abrevs := abrevs || (a ->> 'abrev'); k := k + 1;
  end loop;
  if not (privado.fx_inteiro(g -> 'min') and privado.fx_inteiro(g -> 'max')) or (g ->> 'min')::int < 1 or (g ->> 'max')::int > 100 or (g ->> 'min')::int > (g ->> 'max')::int then
    raise exception 'Regras inválidas (geracao): min e max inteiros de 1 a 100 (min <= max)' using errcode = '22023'; end if;
  begin
    campo := 'modificador'; perform privado.formula(case when jsonb_typeof(R -> 'modificador') = 'string' then R ->> 'modificador' end, ctx_atr);
    if R -> 'total' is not null and jsonb_typeof(R -> 'total') <> 'null' then
      campo := 'total'; perform privado.formula(case when jsonb_typeof(R -> 'total') = 'string' then R ->> 'total' end, ctx_atr);
    end if;
  exception when sqlstate '22023' then raise exception 'Regras inválidas (%): %', campo, sqlerrm using errcode = '22023';
  end;
  -- bônus (opcionais)
  e := R -> 'bonus' -> 'caminho';
  if e is not null and jsonb_typeof(e) <> 'null' and (not privado.fx_inteiro(e -> 'valor') or (e ->> 'valor')::int not between -10 and 10
     or (jsonb_typeof(e -> 'atributo') = 'object' and exists (select 1 from jsonb_each(e -> 'atributo') w where not (w.value #>> '{}' = any(ids) and jsonb_typeof(w.value) = 'string')))) then
    raise exception 'Regras inválidas (bonus.caminho): valor de -10 a 10 e atributos que existem' using errcode = '22023'; end if;
  e := R -> 'bonus' -> 'raca';
  if jsonb_typeof(e) = 'object' and exists (select 1 from jsonb_each(e) r, jsonb_each(case when jsonb_typeof(r.value) = 'object' then r.value else '{}'::jsonb end) b
     where not (b.key = any(ids) and privado.fx_inteiro(b.value) and (b.value::text)::int between -10 and 10)) then
    raise exception 'Regras inválidas (bonus.raca): bônus de -10 a 10 em atributos que existem' using errcode = '22023'; end if;
  e := R -> 'bonus' -> 'sequencia';
  if e is not null and jsonb_typeof(e) <> 'null' then
    foreach campo in array array['principal', 'todos'] loop
      x := e -> campo;
      if x is not null and jsonb_typeof(x) <> 'null' and (jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 10
         or exists (select 1 from jsonb_array_elements(x) w where not (privado.fx_inteiro(w) and (w::text)::int between 0 and 9))) then
        raise exception 'Regras inválidas (bonus.sequencia): listas de até 10 limites de 0 a 9' using errcode = '22023'; end if;
    end loop;
  end if;
  -- recursos (opcionais): max é fórmula com os atributos, SEQ, NIVEL, DV e mod(); "so" = recurso de uma classe
  if R -> 'recursos' is not null and jsonb_typeof(R -> 'recursos') <> 'null' then
    if jsonb_typeof(R -> 'recursos') <> 'array' or jsonb_array_length(R -> 'recursos') > 12 then
      raise exception 'Regras inválidas (recursos): até 12 recursos' using errcode = '22023'; end if;
    ctx_r := jsonb_build_object('nomes', to_jsonb(abrevs || array['SEQ', 'NIVEL', 'DV']), 'vars', (select jsonb_object_agg(x2, 10) from unnest(abrevs) x2) || '{"SEQ":9,"NIVEL":1,"DV":10}'::jsonb,
                                'modf', R ->> 'modificador', 'dados', false, 'validar', true);
    k := 0;
    for v in select * from jsonb_array_elements(R -> 'recursos') loop
      if jsonb_typeof(v -> 'id') is distinct from 'string' or v ->> 'id' !~ '^[a-z_]{1,12}$' or v ->> 'id' = any(rids) then
        raise exception 'Regras inválidas (recursos[%].id): id: de 1 a 12 letras minúsculas, sem repetir', k using errcode = '22023'; end if;
      rids := rids || (v ->> 'id');
      begin perform privado.formula(case when jsonb_typeof(v -> 'max') = 'string' then v ->> 'max' end, ctx_r);
      exception when sqlstate '22023' then raise exception 'Regras inválidas (recursos[%].max): %', k, sqlerrm using errcode = '22023';
      end;
      if v -> 'so' is not null and jsonb_typeof(v -> 'so') <> 'null' and not (jsonb_typeof(v -> 'so') = 'string' and v ->> 'so' in ('mana', 'furia', 'energia')) then
        raise exception 'Regras inválidas (recursos[%].so): recurso de classe: mana, furia ou energia', k using errcode = '22023'; end if;
      k := k + 1;
    end loop;
  end if;
  -- progressão por nível: a tabela de XP acumulada (20 valores crescentes, começando em 0)
  -- (case em vez de and/or: o Postgres não garante a ordem, e o cast só pode rodar depois de conferir que é inteiro)
  x := R -> 'progressao' -> 'xp';
  if R -> 'progressao' ->> 'tipo' = 'nivel' and not (case when jsonb_typeof(x) = 'array' and jsonb_array_length(x) = 20 then
       (x -> 0)::text = '0' and not exists (select 1 from (select w.v, w.n, lag(w.v) over (order by w.n) as p from jsonb_array_elements(x) with ordinality w(v, n)) s
         where case when privado.fx_inteiro(s.v) then (s.v::text)::bigint > 1000000
                      or (s.n > 1 and not (case when privado.fx_inteiro(s.p) then (s.v::text)::bigint > (s.p::text)::bigint else false end))
                    else true end)
     else false end) then
    raise exception 'Regras inválidas (progressao.xp): tabela de XP: 20 valores inteiros crescentes, começando em 0 (até 1000000)' using errcode = '22023'; end if;
  -- classes (opcionais): papel, recurso de classe, atributo principal e dado de vida
  if R -> 'classes' is not null and jsonb_typeof(R -> 'classes') <> 'null' then
    if jsonb_typeof(R -> 'classes') <> 'array' or jsonb_array_length(R -> 'classes') > 12 then
      raise exception 'Regras inválidas (classes): até 12 classes' using errcode = '22023'; end if;
    k := 0;
    for v in select * from jsonb_array_elements(R -> 'classes') loop
      if jsonb_typeof(v -> 'id') is distinct from 'string' or v ->> 'id' !~ '^[a-z_]{1,12}$' or v ->> 'id' = any(cids) then
        raise exception 'Regras inválidas (classes[%].id): id: de 1 a 12 letras minúsculas, sem repetir', k using errcode = '22023'; end if;
      cids := cids || (v ->> 'id');
      if jsonb_typeof(v -> 'nome') is distinct from 'string' or char_length(v ->> 'nome') not between 1 and 30 then
        raise exception 'Regras inválidas (classes[%].nome): nome: de 1 a 30 letras', k using errcode = '22023'; end if;
      if jsonb_typeof(v -> 'papel') is distinct from 'string' or v ->> 'papel' not in ('tanque', 'cura', 'dano', 'suporte') then
        raise exception 'Regras inválidas (classes[%].papel): papel: tanque, cura, dano ou suporte', k using errcode = '22023'; end if;
      if jsonb_typeof(v -> 'recurso') is distinct from 'string' or v ->> 'recurso' not in ('mana', 'furia', 'energia') then
        raise exception 'Regras inválidas (classes[%].recurso): recurso de classe: mana, furia ou energia', k using errcode = '22023'; end if;
      if jsonb_typeof(v -> 'principal') is distinct from 'string' or not (v ->> 'principal' = any(ids)) then
        raise exception 'Regras inválidas (classes[%].principal): atributo principal: um atributo que existe', k using errcode = '22023'; end if;
      if not coalesce(privado.fx_inteiro(v -> 'dv'), false) or (v ->> 'dv')::int not between 4 and 20 then
        raise exception 'Regras inválidas (classes[%].dv): dado de vida: inteiro de 4 a 20', k using errcode = '22023'; end if;
      if v -> 'desc' is not null and jsonb_typeof(v -> 'desc') <> 'null' and (jsonb_typeof(v -> 'desc') <> 'string' or char_length(v ->> 'desc') > 200) then
        raise exception 'Regras inválidas (classes[%].desc): descrição: até 200 letras', k using errcode = '22023'; end if;
      k := k + 1;
    end loop;
  end if;
end $$;

-- a classe da ficha (ficha.classeId entre as classes das regras) ou null
create function privado.classe_da_ficha(R jsonb, f jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select c from jsonb_array_elements(case when jsonb_typeof(R -> 'classes') = 'array' then R -> 'classes' else '[]'::jsonb end) c
   where jsonb_typeof(f -> 'classeId') = 'string' and f ->> 'classeId' <> '' and c ->> 'id' = f ->> 'classeId' limit 1;
$$;

-- o nível que a XP alcança na tabela; 1 quando as regras não usam nível
create function privado.nivel_por_xp(R jsonb, p_xp int) returns int
language sql immutable set search_path = '' as $$
  select case when R -> 'progressao' ->> 'tipo' is distinct from 'nivel' or jsonb_typeof(R -> 'progressao' -> 'xp') is distinct from 'array' or p_xp is null then 1
    else greatest(1, coalesce((select max(w.n) from jsonb_array_elements(R -> 'progressao' -> 'xp') with ordinality w(x, n)
                               where w.n <= 20 and case when privado.fx_inteiro(w.x) then p_xp >= (w.x::text)::bigint else false end), 0))::int end;
$$;

-- { attrs, mods, maximos }; recurso com "so" só para a classe que o usa; DV = dado de vida da classe (null sem classe)
create or replace function privado.calcular_ficha(R jsonb, f jsonb) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare a jsonb; t int; attrs jsonb := '{}'; mods jsonb := '{}'; maximos jsonb := '{}'; nomes jsonb := '["SEQ","NIVEL","DV"]'; vars jsonb; rc jsonb;
  cl jsonb := privado.classe_da_ficha(R, f);
begin
  vars := jsonb_build_object('SEQ', case when jsonb_typeof(f -> 'seq') = 'number' and f ->> 'seq' ~ '^[0-9]$' then (f ->> 'seq')::int else 9 end,
                             'NIVEL', case when jsonb_typeof(f -> 'nivel') = 'number' and f ->> 'nivel' ~ '^([1-9]|1[0-9]|20)$' then (f ->> 'nivel')::int else 1 end,
                             'DV', case when privado.fx_inteiro(cl -> 'dv') then cl -> 'dv' else 'null'::jsonb end);
  for a in select * from jsonb_array_elements(R -> 'atributos') loop
    nomes := nomes || to_jsonb(a ->> 'abrev');
    t := privado.total_do_atributo(R, f, a ->> 'id');
    if t is null then continue; end if;
    attrs := attrs || jsonb_build_object(a ->> 'id', t);
    mods := mods || jsonb_build_object(a ->> 'id', privado.mod_do_total(R, t));
    vars := vars || jsonb_build_object(a ->> 'abrev', t);
  end loop;
  for rc in select * from jsonb_array_elements(coalesce(R -> 'recursos', '[]')) loop
    if rc -> 'so' is not null and jsonb_typeof(rc -> 'so') <> 'null' and (cl is null or cl ->> 'recurso' is distinct from rc ->> 'so') then continue; end if;
    maximos := maximos || jsonb_build_object(rc ->> 'id', privado.formula(rc ->> 'max',
      jsonb_build_object('nomes', nomes, 'vars', vars, 'modf', R ->> 'modificador', 'dados', false, 'validar', false))::int);
  end loop;
  return jsonb_build_object('attrs', attrs, 'mods', mods, 'maximos', maximos);
end $$;

-- =====================================================================================================
-- 2) nível e XP de cada jogador em cada mesa (fora do grant de update: o jogador não escreve) e a classe da ficha da mesa
-- =====================================================================================================
alter table public.jogadores add column nivel int not null default 1 check (nivel between 1 and 20),
                             add column xp int not null default 0 check (xp between 0 and 10000000);
alter table public.fichas_mesa add column classe_id text check (classe_id is null or classe_id ~ '^[a-z_]{1,12}$');

-- marcos: cada XP dada pelo mestre (o jogador recebe o aviso; subir de nível = cerimônia)
create table public.marcos (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp int not null check (xp between 1 and 100000),
  de int not null check (de between 1 and 20),
  para int not null check (para between 1 and 20 and para >= de),
  motivo text check (motivo is null or char_length(motivo) <= 120),
  criado_em timestamptz not null default now()
);
create index on public.marcos (mesa_id, user_id, criado_em);
alter table public.marcos enable row level security;
revoke all on public.marcos from anon, authenticated;
grant select on public.marcos to authenticated;   -- ninguém escreve direto: só dar_xp
create policy marcos_le on public.marcos for select to authenticated
  using (privado.sou_mestre(mesa_id) or (user_id = (select auth.uid()) and privado.estou_na_mesa(mesa_id)));
alter publication supabase_realtime add table public.marcos;

-- a classe precisa existir na versão das regras da ficha (sem classes nas regras = sem classe)
create function privado.conferir_classe(R jsonb, p_classe text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(R -> 'classes') is distinct from 'array' or jsonb_array_length(R -> 'classes') = 0 then return null; end if;
  if nullif(p_classe, '') is null or not exists (select 1 from jsonb_array_elements(R -> 'classes') c where c ->> 'id' = p_classe) then
    raise exception 'Escolha uma das classes desta mesa.' using errcode = '22023';
  end if;
  return p_classe;
end $$;

-- =====================================================================================================
-- 3) o jogador: enviar e converter ganham a classe (a chamada antiga, sem classe, continua valendo)
-- =====================================================================================================
drop function public.enviar_ficha(uuid, text, text);
create function public.enviar_ficha(p_mesa uuid, p_caminho text, p_raca text, p_classe text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); est text; fm public.fichas_mesa; cl text;
begin
  perform privado.conferir_mesa_da_ficha(p_mesa);
  if nullif(p_caminho, '') !~ '^[a-z]{2,20}$' or nullif(p_raca, '') !~ '^[a-z]{2,20}$' then raise exception 'Caminho ou raça inválidos.' using errcode = '22023'; end if;
  select * into fm from public.fichas_mesa where mesa_id = p_mesa and user_id = u and estado = 'rolada' and origem = 'servidor' for update;
  if fm.mesa_id is null then raise exception 'Role os atributos antes de enviar a ficha.' using errcode = '42501'; end if;
  cl := privado.conferir_classe((privado.regras_na_versao(p_mesa, fm.regras_versao)).regras, p_classe);
  est := case when (select m.aprovar_fichas from public.mesas m where m.id = p_mesa) then 'pendente' else 'aprovada' end;
  update public.fichas_mesa set caminho_id = nullif(p_caminho, ''), raca_id = nullif(p_raca, ''), classe_id = cl, estado = est
   where mesa_id = p_mesa and user_id = u;
  perform privado.recalcular_fichas(p_mesa, u);
  return est;
end $$;

drop function public.converter_ficha(uuid, jsonb, text, text);
create function public.converter_ficha(p_mesa uuid, p_base jsonb, p_caminho text, p_raca text, p_classe text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); rg record; a jsonb; v jsonb; base jsonb := '{}'; mn int; mx int; cl text;
begin
  perform privado.conferir_mesa_da_ficha(p_mesa);
  perform pg_advisory_xact_lock(hashtext('ficha_mesa:' || p_mesa || ':' || u));
  if not privado.ficha_livre(p_mesa, u) then
    raise exception 'Sua ficha desta mesa já existe. Para trocar, peça ao mestre.' using errcode = '42501';
  end if;
  if nullif(p_caminho, '') !~ '^[a-z]{2,20}$' or nullif(p_raca, '') !~ '^[a-z]{2,20}$' then raise exception 'Caminho ou raça inválidos.' using errcode = '22023'; end if;
  select * into rg from privado.regras_da_mesa(p_mesa);
  cl := privado.conferir_classe(rg.regras, p_classe);
  mn := coalesce((rg.regras -> 'geracao' ->> 'min')::int, 3); mx := coalesce((rg.regras -> 'geracao' ->> 'max')::int, 18);
  for a in select * from jsonb_array_elements(rg.regras -> 'atributos') loop
    v := case when jsonb_typeof(p_base) = 'object' then p_base -> (a ->> 'id') end;
    if not coalesce(privado.fx_inteiro(v), false) or (v::text)::int not between mn and mx then
      raise exception 'Os atributos da sua ficha não batem com as regras desta mesa (%). Monte uma ficha nova.', a ->> 'nome' using errcode = '22023';
    end if;
    base := base || jsonb_build_object(a ->> 'id', (v::text)::int);
  end loop;
  insert into public.fichas_mesa (mesa_id, user_id, base, rolagens, caminho_id, raca_id, classe_id, origem, estado, regras_versao)
  values (p_mesa, u, base, '{}', nullif(p_caminho, ''), nullif(p_raca, ''), cl, 'convertida', 'pendente', rg.versao)
  on conflict (mesa_id, user_id) do update set base = excluded.base, rolagens = '{}', caminho_id = excluded.caminho_id, raca_id = excluded.raca_id,
    classe_id = excluded.classe_id, origem = 'convertida', estado = 'pendente', regras_versao = excluded.regras_versao, liberada = false, resposta = null;
  perform privado.recalcular_fichas(p_mesa, u);
  return 'pendente';
end $$;

-- rolar de novo zera a classe também (a ficha começa de novo)
create or replace function public.rolar_ficha(p_mesa uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); rg record; a jsonb; r record; base jsonb := '{}'; rol jsonb := '{}'; met text; mn int; mx int;
begin
  perform privado.conferir_mesa_da_ficha(p_mesa);
  perform pg_advisory_xact_lock(hashtext('ficha_mesa:' || p_mesa || ':' || u));
  if not privado.ficha_livre(p_mesa, u) then
    raise exception 'Seus atributos já foram rolados. Para rolar de novo, peça ao mestre.' using errcode = '42501';
  end if;
  select * into rg from privado.regras_da_mesa(p_mesa);
  met := coalesce(rg.regras -> 'geracao' ->> 'metodo', '4d6-menor');
  mn := coalesce((rg.regras -> 'geracao' ->> 'min')::int, 3); mx := coalesce((rg.regras -> 'geracao' ->> 'max')::int, 18);
  for a in select * from jsonb_array_elements(rg.regras -> 'atributos') loop
    select * into r from privado.rolar_atributo(met, mn, mx);
    base := base || jsonb_build_object(a ->> 'id', r.total);
    rol := rol || jsonb_build_object(a ->> 'id', r.dados);
  end loop;
  insert into public.fichas_mesa (mesa_id, user_id, base, rolagens, origem, estado, regras_versao, rolagens_feitas)
  values (p_mesa, u, base, rol, 'servidor', 'rolada', rg.versao, 1)
  on conflict (mesa_id, user_id) do update set base = excluded.base, rolagens = excluded.rolagens, caminho_id = null, raca_id = null, classe_id = null,
    origem = 'servidor', estado = 'rolada', regras_versao = excluded.regras_versao, liberada = false, resposta = null,
    rolagens_feitas = public.fichas_mesa.rolagens_feitas + 1;
  perform privado.recalcular_fichas(p_mesa, u);
  return jsonb_build_object('base', base, 'rolagens', rol, 'metodo', met, 'regras_versao', rg.versao);
end $$;

-- migrar: a classe da ficha precisa existir na versão nova (senão, libere o jogador para refazer)
create or replace function public.migrar_ficha(p_mesa uuid, p_user uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare fm public.fichas_mesa; rg record; a jsonb; mn int; mx int;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre migra fichas.' using errcode = '42501'; end if;
  select * into fm from public.fichas_mesa where mesa_id = p_mesa and user_id = p_user for update;
  if fm.mesa_id is null then raise exception 'Este jogador ainda não tem ficha nesta mesa.'; end if;
  select * into rg from privado.regras_da_mesa(p_mesa);
  mn := coalesce((rg.regras -> 'geracao' ->> 'min')::int, 3); mx := coalesce((rg.regras -> 'geracao' ->> 'max')::int, 18);
  for a in select * from jsonb_array_elements(rg.regras -> 'atributos') loop
    if not coalesce(privado.fx_inteiro(fm.base -> (a ->> 'id')), false) or (fm.base ->> (a ->> 'id'))::int not between mn and mx then
      raise exception 'A versão % tem atributos que esta ficha não tem (%): libere o jogador para refazer a ficha.', rg.versao, a ->> 'nome' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(rg.regras -> 'classes') = 'array' and jsonb_array_length(rg.regras -> 'classes') > 0
     and not exists (select 1 from jsonb_array_elements(rg.regras -> 'classes') c where c ->> 'id' = fm.classe_id) then
    raise exception 'A versão % não tem a classe desta ficha: libere o jogador para refazer a ficha.', rg.versao using errcode = '22023';
  end if;
  update public.fichas_mesa set regras_versao = rg.versao,
    classe_id = case when jsonb_typeof(rg.regras -> 'classes') = 'array' and jsonb_array_length(rg.regras -> 'classes') > 0 then fm.classe_id end
   where mesa_id = p_mesa and user_id = p_user;
  perform privado.recalcular_fichas(p_mesa, p_user);
  return rg.versao;
end $$;

-- =====================================================================================================
-- 4) o mestre dá experiência: ao grupo (p_users vazio), a alguns ou a um; o nível sobe pela tabela da versão da ficha
-- =====================================================================================================
create function public.dar_xp(p_mesa uuid, p_users uuid[], p_xp int, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j record; R jsonb; fm public.fichas_mesa; novo_xp int; novo int; res jsonb := '[]'; n int := 0;
  mot text := nullif(left(trim(coalesce(p_motivo, '')), 120), ''); na_mesa boolean;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre dá experiência.' using errcode = '42501'; end if;
  if p_xp is null or p_xp not between 1 and 100000 then raise exception 'A experiência vai de 1 a 100000.' using errcode = '22023'; end if;
  if (privado.regras_da_mesa(p_mesa)).regras -> 'progressao' ->> 'tipo' is distinct from 'nivel' then
    raise exception 'As regras desta mesa não usam nível.' using errcode = '22023';
  end if;
  na_mesa := coalesce((select m.ficha_na_mesa from public.mesas m where m.id = p_mesa), false);
  for j in select * from public.jogadores where mesa_id = p_mesa and (coalesce(cardinality(p_users), 0) = 0 or user_id = any(p_users)) order by nome for update loop
    R := null; fm := null;
    if na_mesa then
      select * into fm from public.fichas_mesa f where f.mesa_id = p_mesa and f.user_id = j.user_id;
      if fm.estado = 'aprovada' then R := (privado.regras_na_versao(p_mesa, fm.regras_versao)).regras; end if;
    end if;
    if R is null then R := (privado.regras_da_mesa(p_mesa)).regras; end if;
    novo_xp := least(10000000, j.xp + p_xp);
    novo := greatest(j.nivel, least(20, privado.nivel_por_xp(R, novo_xp)));
    update public.jogadores set xp = novo_xp, nivel = novo where mesa_id = p_mesa and user_id = j.user_id;
    insert into public.marcos (mesa_id, user_id, xp, de, para, motivo) values (p_mesa, j.user_id, p_xp, j.nivel, novo, mot);
    insert into public.cronica (mesa_id, texto) values (p_mesa, left('✦ ' || j.nome || ' ganha ' || p_xp || ' XP' || coalesce(' — ' || mot, ''), 500));
    if novo > j.nivel then insert into public.cronica (mesa_id, texto) values (p_mesa, left('▲ ' || j.nome || ' chega ao nível ' || novo, 500)); end if;
    res := res || jsonb_build_object('user_id', j.user_id, 'nome', j.nome, 'xp', novo_xp, 'de', j.nivel, 'para', novo);
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Nenhum jogador desta mesa foi escolhido.' using errcode = '22023'; end if;
  return res;
end $$;

-- =====================================================================================================
-- 5) o gatilho da ficha: nível, XP e classe vêm do servidor (o que o site mandar em ficha.nivel/xp/classeId não vale)
-- =====================================================================================================
create or replace function privado.ficha_do_servidor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rg record; c jsonb; fm public.fichas_mesa;
begin
  if jsonb_typeof(new.ficha) is distinct from 'object' then return new; end if;
  -- ficha igual à gravada = só recálculo (mantém seq_site); ficha nova = o site mandou (seq_site = a Sequência do site)
  if tg_op = 'INSERT' or new.ficha is distinct from old.ficha then
    new.ficha := new.ficha || jsonb_build_object('seq_site', coalesce(new.ficha -> 'seq', 'null'::jsonb));
  end if;
  new.ficha := (new.ficha - 'classeId') || jsonb_build_object('seq', new.sequencia, 'nivel', new.nivel, 'xp', new.xp);
  begin
    if coalesce((select m.ficha_na_mesa from public.mesas m where m.id = new.mesa_id), false) then
      -- guarda o que o site mandou (para voltar se o mestre desligar) antes de trocar pela ficha da mesa
      if not new.ficha ? 'do_site' then
        new.ficha := new.ficha || jsonb_build_object('do_site', jsonb_build_object('base', coalesce(new.ficha -> 'base', '{}'),
          'caminhoId', coalesce(new.ficha -> 'caminhoId', '""'), 'racaId', coalesce(new.ficha -> 'racaId', '""')));
      end if;
      select * into fm from public.fichas_mesa f where f.mesa_id = new.mesa_id and f.user_id = new.user_id;
      if fm.estado = 'aprovada' then
        select * into rg from privado.regras_na_versao(new.mesa_id, fm.regras_versao);
        new.ficha := new.ficha || jsonb_build_object('base', fm.base, 'caminhoId', coalesce(fm.caminho_id, ''), 'racaId', coalesce(fm.raca_id, ''));
        if fm.classe_id is not null then new.ficha := new.ficha || jsonb_build_object('classeId', fm.classe_id); end if;
      else
        select * into rg from privado.regras_da_mesa(new.mesa_id);
        new.ficha := new.ficha || '{"base":{}}'::jsonb;   -- sem ficha aprovada: joga sem modificador
      end if;
      new.ficha := new.ficha || jsonb_build_object('ficha_estado', coalesce(fm.estado, 'sem'));
    else
      select * into rg from privado.regras_da_mesa(new.mesa_id);
      if jsonb_typeof(new.ficha -> 'do_site') = 'object' then new.ficha := new.ficha || (new.ficha -> 'do_site'); end if;
      new.ficha := new.ficha - 'ficha_estado' - 'do_site';
    end if;
    c := privado.calcular_ficha(rg.regras, new.ficha);
    new.ficha := new.ficha || jsonb_build_object('attrs', c -> 'attrs', 'mods', c -> 'mods', 'maximos', c -> 'maximos', 'regras_versao', rg.versao);
    if c -> 'maximos' ? 'pv' then new.ficha := new.ficha || jsonb_build_object('pvMax', c -> 'maximos' -> 'pv'); end if;
    if c -> 'maximos' ? 'san' then new.ficha := new.ficha || jsonb_build_object('sanMax', c -> 'maximos' -> 'san'); end if;
    if c -> 'maximos' ? 'esp' then new.ficha := new.ficha || jsonb_build_object('espMax', c -> 'maximos' -> 'esp'); end if;
  exception when others then
    new.ficha := new.ficha || '{"attrs":{},"mods":{}}'::jsonb;   -- nunca confiar no que veio, nem quando o cálculo falha
  end;
  return new;
end $$;

drop trigger jogadores_ficha_do_servidor on public.jogadores;
create trigger jogadores_ficha_do_servidor before insert or update of ficha, sequencia, nivel, xp on public.jogadores
  for each row execute function privado.ficha_do_servidor();

revoke all on function privado.classe_da_ficha(jsonb, jsonb), privado.nivel_por_xp(jsonb, int), privado.conferir_classe(jsonb, text) from public, anon, authenticated;
revoke all on function public.enviar_ficha(uuid, text, text, text), public.converter_ficha(uuid, jsonb, text, text, text), public.dar_xp(uuid, uuid[], int, text) from public, anon;
grant execute on function public.enviar_ficha(uuid, text, text, text), public.converter_ficha(uuid, jsonb, text, text, text), public.dar_xp(uuid, uuid[], int, text) to authenticated;

-- fichas que já estão nas mesas: regrava (nível 1, XP 0; nada muda nas mesas LotM)
update public.jogadores set ficha = ficha;
