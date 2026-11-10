-- Ficha montada dentro da mesa (Fase B2 de docs/SISTEMAS-DA-MESA.md, modo 2).
-- Decisões do Pedro (2026-11-09):
-- - o mestre LIGA "ficha montada na mesa" (mesas.ficha_na_mesa); desligada, tudo segue como hoje (ficha do site);
-- - os atributos são rolados pelo SERVIDOR (rolar_ficha) e guardados em public.fichas_mesa: o navegador não escolhe os dados;
-- - rolar de novo só quando o mestre libera (liberar_ficha) ou recusa a ficha;
-- - aprovação opcional (mesas.aprovar_fichas); ficha CONVERTIDA (dados rolados no site) sempre espera o mestre;
-- - ficha pendente joga sem modificador (base vazia) até o mestre aprovar;
-- - cada ficha fica na versão das regras em que foi feita (fichas_mesa.regras_versao) até o mestre migrar (migrar_ficha).
-- Também: pedidos.atributo aceita qualquer id de atributo ('^[a-z_]{1,12}$'), conferido contra as regras em vigor.

-- =====================================================================================================
-- 1) configurações da mesa
-- =====================================================================================================
alter table public.mesas add column ficha_na_mesa boolean not null default false,
                         add column aprovar_fichas boolean not null default false;

-- =====================================================================================================
-- 2) a ficha guardada pelo servidor (uma por jogador por mesa; sobrevive a sair e voltar: ninguém rerrola saindo da mesa)
-- =====================================================================================================
create table public.fichas_mesa (
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  base jsonb not null default '{}'::jsonb check (jsonb_typeof(base) = 'object' and pg_column_size(base) < 2000),
  rolagens jsonb not null default '{}'::jsonb check (jsonb_typeof(rolagens) = 'object' and pg_column_size(rolagens) < 4000),
  caminho_id text check (caminho_id is null or caminho_id ~ '^[a-z]{2,20}$'),
  raca_id text check (raca_id is null or raca_id ~ '^[a-z]{2,20}$'),
  origem text not null check (origem in ('servidor', 'convertida')),
  estado text not null check (estado in ('rolada', 'pendente', 'aprovada', 'recusada')),
  regras_versao int not null default 0,
  liberada boolean not null default false,
  resposta text check (resposta is null or char_length(resposta) <= 300),
  rolagens_feitas int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (mesa_id, user_id)
);
create trigger fichas_mesa_hora before update on public.fichas_mesa for each row execute function privado.marca_hora();
alter table public.fichas_mesa enable row level security;
revoke all on public.fichas_mesa from anon, authenticated;
grant select on public.fichas_mesa to authenticated;   -- ninguém escreve direto: só pelas funções abaixo
create policy fichas_mesa_le on public.fichas_mesa for select to authenticated
  using (privado.sou_mestre(mesa_id) or (user_id = (select auth.uid()) and privado.estou_na_mesa(mesa_id)));
alter publication supabase_realtime add table public.fichas_mesa;
alter publication supabase_realtime add table public.mesa_regras;   -- o Grimório (outra aba) e o jogador veem a versão nova na hora

-- as regras de uma versão (0 = predefinição lotm; versão sumida = a em vigor)
create function privado.regras_na_versao(p_mesa uuid, p_versao int, out regras jsonb, out versao int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_versao = 0 then regras := privado.regras_lotm(); versao := 0; return; end if;
  select r.regras, r.versao into regras, versao from public.mesa_regras r where r.mesa_id = p_mesa and r.versao = p_versao;
  if regras is null then select x.regras, x.versao into regras, versao from privado.regras_da_mesa(p_mesa) x; end if;
end $$;

-- um atributo rolado no servidor: 4d6 sem o menor (padrão) ou 3d6; fica entre o mínimo e o máximo da regra
create function privado.rolar_atributo(p_metodo text, p_min int, p_max int, out total int, out dados jsonb)
language plpgsql volatile set search_path = '' as $$
declare d int[] := '{}'; k int; n int := case when p_metodo = '3d6' then 3 else 4 end;
begin
  for k in 1..n loop d := d || (1 + floor(random() * 6)::int); end loop;
  total := (select sum(x) from unnest(d) x)::int - case when n = 4 then (select min(x) from unnest(d) x) else 0 end;
  total := greatest(p_min, least(p_max, total));
  dados := to_jsonb(d);
end $$;

-- recalcula a ficha guardada em jogadores (o gatilho ficha_do_servidor faz a conta)
create function privado.recalcular_fichas(p_mesa uuid, p_user uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.jogadores set ficha = ficha where mesa_id = p_mesa and (p_user is null or user_id = p_user);
$$;

-- pode rolar (ou converter) quando ainda não tem ficha, quando o mestre liberou ou quando a ficha foi recusada
create function privado.ficha_livre(p_mesa uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.fichas_mesa f where f.mesa_id = p_mesa and f.user_id = p_user and not f.liberada and f.estado <> 'recusada');
$$;

create function privado.conferir_mesa_da_ficha(p_mesa uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.estou_na_mesa(p_mesa) then raise exception 'Entre na mesa primeiro.' using errcode = '42501'; end if;
  if not coalesce((select m.ficha_na_mesa from public.mesas m where m.id = p_mesa), false) then
    raise exception 'Nesta mesa a ficha é feita no site.' using errcode = '22023';
  end if;
end $$;

-- =====================================================================================================
-- 3) o jogador: rolar no servidor, enviar, ou converter a ficha antiga
-- =====================================================================================================
create function public.rolar_ficha(p_mesa uuid) returns jsonb
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
  on conflict (mesa_id, user_id) do update set base = excluded.base, rolagens = excluded.rolagens, caminho_id = null, raca_id = null,
    origem = 'servidor', estado = 'rolada', regras_versao = excluded.regras_versao, liberada = false, resposta = null,
    rolagens_feitas = public.fichas_mesa.rolagens_feitas + 1;
  perform privado.recalcular_fichas(p_mesa, u);
  return jsonb_build_object('base', base, 'rolagens', rol, 'metodo', met, 'regras_versao', rg.versao);
end $$;

-- depois de rolar: escolhe Caminho e raça e manda (aprovação ligada = pendente; desligada = vale na hora)
create function public.enviar_ficha(p_mesa uuid, p_caminho text, p_raca text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); est text;
begin
  perform privado.conferir_mesa_da_ficha(p_mesa);
  if nullif(p_caminho, '') !~ '^[a-z]{2,20}$' or nullif(p_raca, '') !~ '^[a-z]{2,20}$' then raise exception 'Caminho ou raça inválidos.' using errcode = '22023'; end if;
  est := case when (select m.aprovar_fichas from public.mesas m where m.id = p_mesa) then 'pendente' else 'aprovada' end;
  update public.fichas_mesa set caminho_id = nullif(p_caminho, ''), raca_id = nullif(p_raca, ''), estado = est
   where mesa_id = p_mesa and user_id = u and estado = 'rolada' and origem = 'servidor';
  if not found then raise exception 'Role os atributos antes de enviar a ficha.' using errcode = '42501'; end if;
  perform privado.recalcular_fichas(p_mesa, u);
  return est;
end $$;

-- a ficha antiga (atributos rolados no site): só quando os atributos batem com as regras; SEMPRE espera o mestre
create function public.converter_ficha(p_mesa uuid, p_base jsonb, p_caminho text, p_raca text) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); rg record; a jsonb; v jsonb; base jsonb := '{}'; mn int; mx int;
begin
  perform privado.conferir_mesa_da_ficha(p_mesa);
  perform pg_advisory_xact_lock(hashtext('ficha_mesa:' || p_mesa || ':' || u));
  if not privado.ficha_livre(p_mesa, u) then
    raise exception 'Sua ficha desta mesa já existe. Para trocar, peça ao mestre.' using errcode = '42501';
  end if;
  if nullif(p_caminho, '') !~ '^[a-z]{2,20}$' or nullif(p_raca, '') !~ '^[a-z]{2,20}$' then raise exception 'Caminho ou raça inválidos.' using errcode = '22023'; end if;
  select * into rg from privado.regras_da_mesa(p_mesa);
  mn := coalesce((rg.regras -> 'geracao' ->> 'min')::int, 3); mx := coalesce((rg.regras -> 'geracao' ->> 'max')::int, 18);
  for a in select * from jsonb_array_elements(rg.regras -> 'atributos') loop
    v := case when jsonb_typeof(p_base) = 'object' then p_base -> (a ->> 'id') end;
    if not coalesce(privado.fx_inteiro(v), false) or (v::text)::int not between mn and mx then
      raise exception 'Os atributos da sua ficha não batem com as regras desta mesa (%). Monte uma ficha nova.', a ->> 'nome' using errcode = '22023';
    end if;
    base := base || jsonb_build_object(a ->> 'id', (v::text)::int);
  end loop;
  insert into public.fichas_mesa (mesa_id, user_id, base, rolagens, caminho_id, raca_id, origem, estado, regras_versao)
  values (p_mesa, u, base, '{}', nullif(p_caminho, ''), nullif(p_raca, ''), 'convertida', 'pendente', rg.versao)
  on conflict (mesa_id, user_id) do update set base = excluded.base, rolagens = '{}', caminho_id = excluded.caminho_id, raca_id = excluded.raca_id,
    origem = 'convertida', estado = 'pendente', regras_versao = excluded.regras_versao, liberada = false, resposta = null;
  perform privado.recalcular_fichas(p_mesa, u);
  return 'pendente';
end $$;

-- =====================================================================================================
-- 4) o mestre: configurar, aprovar/recusar, liberar nova rolagem, migrar de versão
-- =====================================================================================================
create function public.configurar_mesa(p_mesa uuid, p_ficha_na_mesa boolean, p_aprovar_fichas boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre configura a mesa.' using errcode = '42501'; end if;
  update public.mesas set ficha_na_mesa = coalesce(p_ficha_na_mesa, ficha_na_mesa), aprovar_fichas = coalesce(p_aprovar_fichas, aprovar_fichas) where id = p_mesa;
  perform privado.recalcular_fichas(p_mesa, null);
end $$;

create function public.julgar_ficha(p_mesa uuid, p_user uuid, p_aprovar boolean, p_resposta text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre aprova fichas.' using errcode = '42501'; end if;
  update public.fichas_mesa set estado = case when p_aprovar then 'aprovada' else 'recusada' end,
    resposta = nullif(left(trim(coalesce(p_resposta, '')), 300), '')
   where mesa_id = p_mesa and user_id = p_user and estado = 'pendente';
  if not found then raise exception 'Esta ficha não está esperando aprovação.'; end if;
  perform privado.recalcular_fichas(p_mesa, p_user);
end $$;

create function public.liberar_ficha(p_mesa uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre libera uma nova ficha.' using errcode = '42501'; end if;
  update public.fichas_mesa set liberada = true where mesa_id = p_mesa and user_id = p_user;
  if not found then raise exception 'Este jogador ainda não tem ficha nesta mesa.'; end if;
end $$;

-- passa a ficha para a versão em vigor (só se os atributos dela continuam valendo; senão, libere o jogador para refazer)
create function public.migrar_ficha(p_mesa uuid, p_user uuid) returns int
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
  update public.fichas_mesa set regras_versao = rg.versao where mesa_id = p_mesa and user_id = p_user;
  perform privado.recalcular_fichas(p_mesa, p_user);
  return rg.versao;
end $$;

-- o estado da mesa para quem está nela: Terror + as configurações da ficha
create or replace function public.estado_da_mesa(p_mesa uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (privado.estou_na_mesa(p_mesa) or privado.sou_mestre(p_mesa)) then raise exception 'Mesa inválida.' using errcode = '42501'; end if;
  return (select jsonb_build_object('terror', m.terror, 'ficha_na_mesa', m.ficha_na_mesa, 'aprovar_fichas', m.aprovar_fichas) from public.mesas m where m.id = p_mesa);
end $$;

-- =====================================================================================================
-- 5) o cálculo: na mesa com ficha montada, a base, o Caminho e a raça vêm de fichas_mesa (aprovada), na versão dela
-- =====================================================================================================
create or replace function privado.ficha_do_servidor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rg record; c jsonb; fm public.fichas_mesa;
begin
  if jsonb_typeof(new.ficha) is distinct from 'object' then return new; end if;
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

-- a rolagem: na mesa com ficha montada, usa a versão gravada na ficha pelo servidor (cada ficha na sua versão)
create or replace function privado.mod_calculado(p_mesa uuid, f jsonb, attr text) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare R jsonb;
begin
  if attr is null or attr = '' or jsonb_typeof(f) is distinct from 'object' then return 0; end if;
  if coalesce((select m.ficha_na_mesa from public.mesas m where m.id = p_mesa), false) and jsonb_typeof(f -> 'regras_versao') = 'number' then
    R := (privado.regras_na_versao(p_mesa, (f ->> 'regras_versao')::int)).regras;
  else
    R := (privado.regras_da_mesa(p_mesa)).regras;
  end if;
  return coalesce(privado.mod_do_total(R, privado.total_do_atributo(R, f, attr)), 0);
exception when others then return 0;
end $$;

-- =====================================================================================================
-- 6) testes pedidos: qualquer atributo das regras em vigor (antes: só os 6 do LotM)
-- =====================================================================================================
alter table public.pedidos drop constraint pedidos_atributo_check;
alter table public.pedidos add constraint pedidos_atributo_check check (atributo is null or atributo ~ '^[a-z_]{1,12}$');

create function privado.atributo_da_mesa(p_mesa uuid, p_attr text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_attr is null or p_attr = '' then return null; end if;
  if not exists (select 1 from jsonb_array_elements((privado.regras_da_mesa(p_mesa)).regras -> 'atributos') a where a ->> 'id' = p_attr) then
    raise exception 'Este atributo não existe nas regras da mesa.' using errcode = '22023';
  end if;
  return p_attr;
end $$;

create or replace function public.pedir_teste(p_mesa uuid, p_para uuid, p_rotulo text, p_atributo text, p_lados int, p_dificuldade int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; at text;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre pede testes.' using errcode = '42501'; end if;
  at := privado.atributo_da_mesa(p_mesa, p_atributo);
  insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo, lados) values (p_mesa, p_para, 'aberto', p_rotulo, at, coalesce(p_lados, 20)) returning id into pid;
  insert into public.segredos_pedido (pedido_id, mesa_id, dificuldade) values (pid, p_mesa, p_dificuldade);
  return pid;
end $$;

create or replace function public.rolar_secreto(p_mesa uuid, p_para uuid, p_rotulo text, p_atributo text, p_lados int, p_dificuldade int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid; v int; mo int; mv int; t int; l int := coalesce(p_lados, 20); f jsonb; at text;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre rola testes secretos.' using errcode = '42501'; end if;
  at := privado.atributo_da_mesa(p_mesa, p_atributo);
  select ficha into f from public.jogadores where mesa_id = p_mesa and user_id = p_para;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  mo := privado.mod_do_jogador(p_mesa, p_para, f, at);
  mv := privado.mod_visivel(p_mesa, p_para, f, at);
  v := 1 + floor(random() * l)::int; t := v + mo;
  insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo, lados, estado) values (p_mesa, p_para, 'secreto', p_rotulo, at, l, 'feito') returning id into pid;
  insert into public.segredos_pedido (pedido_id, mesa_id, dificuldade, oculto) values (pid, p_mesa, p_dificuldade, mo - mv);
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (pid, p_mesa, p_para, 'secreto', v, l, mv, v + mv);
  return jsonb_build_object('pedido', pid, 'dado', v, 'modificador', mo, 'total', t, 'passou', t >= p_dificuldade);
end $$;

-- =====================================================================================================
-- permissões
-- =====================================================================================================
revoke all on function privado.regras_na_versao(uuid, int), privado.rolar_atributo(text, int, int), privado.recalcular_fichas(uuid, uuid),
  privado.ficha_livre(uuid, uuid), privado.conferir_mesa_da_ficha(uuid), privado.atributo_da_mesa(uuid, text) from public, anon, authenticated;
revoke all on function public.rolar_ficha(uuid), public.enviar_ficha(uuid, text, text), public.converter_ficha(uuid, jsonb, text, text),
  public.configurar_mesa(uuid, boolean, boolean), public.julgar_ficha(uuid, uuid, boolean, text), public.liberar_ficha(uuid, uuid),
  public.migrar_ficha(uuid, uuid) from public, anon;
grant execute on function public.rolar_ficha(uuid), public.enviar_ficha(uuid, text, text), public.converter_ficha(uuid, jsonb, text, text),
  public.configurar_mesa(uuid, boolean, boolean), public.julgar_ficha(uuid, uuid, boolean, text), public.liberar_ficha(uuid, uuid),
  public.migrar_ficha(uuid, uuid) to authenticated;
