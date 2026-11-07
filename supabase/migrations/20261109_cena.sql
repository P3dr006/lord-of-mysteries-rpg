-- Cena: Roda do Destino (iniciativa), Duelos (teste contestado), Figuras (NPCs do mestre), Crônica (diário da sessão),
-- teste aberto à prova de trapaça (o modificador vem da ficha guardada no servidor) e leitura segura dos modificadores.

-- ---------- modificador lido com segurança (ficha adulterada não derruba a rolagem do mestre) ----------
create function privado.mod_da_ficha(f jsonb, attr text) returns int
language sql immutable set search_path = '' as $$
  select case when attr is null or attr = '' then 0
              when (f -> 'mods' ->> attr) ~ '^-?[0-9]{1,3}$' then greatest(-30, least(30, (f -> 'mods' ->> attr)::int))
              else 0 end;
$$;
revoke all on function privado.mod_da_ficha(jsonb, text) from public, anon;
grant execute on function privado.mod_da_ficha(jsonb, text) to authenticated;

-- ---------- Figuras da cena: NPCs do mestre (só ele vê) ----------
create table public.figuras (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  bonus int not null default 0 check (bonus between -10 and 20),
  pv int check (pv is null or pv between 0 and 9999),
  pv_max int check (pv_max is null or pv_max between 1 and 9999),
  criado_em timestamptz not null default now()
);
create index on public.figuras (mesa_id);
alter table public.figuras enable row level security;
revoke all on public.figuras from anon, authenticated;
grant select, insert, update, delete on public.figuras to authenticated;
create policy figuras_so_mestre on public.figuras for all to authenticated
  using (privado.sou_mestre(mesa_id)) with check (privado.sou_mestre(mesa_id));

-- ---------- Roda do Destino: o encontro ativo da mesa (o jogador vê a ordem e de quem é a vez) ----------
create table public.encontros (
  mesa_id uuid primary key references public.mesas(id) on delete cascade,
  ativo boolean not null default true,
  rodada int not null default 1,
  vez int not null default 0,
  ordem jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.encontros enable row level security;
revoke all on public.encontros from anon, authenticated;
grant select on public.encontros to authenticated;
create policy encontros_le on public.encontros for select to authenticated
  using (privado.sou_mestre(mesa_id) or privado.estou_na_mesa(mesa_id));

-- O servidor rola d20 + Agilidade (da ficha) para cada jogador e d20 + bônus para cada figura escolhida.
create function public.iniciar_encontro(p_mesa uuid, p_figuras uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o jsonb;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre começa um encontro.' using errcode = '42501'; end if;
  with p as materialized (
    select 'jogador' as tipo, j.user_id::text as id, j.nome, left(j.ficha ->> 'caminhoId', 20) as caminho, left(j.ficha ->> 'cor', 7) as cor,
           1 + floor(random() * 20)::int as dado, privado.mod_da_ficha(j.ficha, 'agil') as bonus
      from public.jogadores j where j.mesa_id = p_mesa
    union all
    select 'figura', f.id::text, f.nome, null, null, 1 + floor(random() * 20)::int, f.bonus
      from public.figuras f where f.mesa_id = p_mesa and f.id = any(coalesce(p_figuras, '{}'::uuid[]))
  )
  select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'id', id, 'nome', nome, 'caminhoId', caminho, 'cor', cor,
           'dado', dado, 'bonus', bonus, 'total', dado + bonus) order by dado + bonus desc, bonus desc, random()), '[]'::jsonb)
    into o from p;
  if jsonb_array_length(o) = 0 then raise exception 'Ninguém para entrar na Roda.'; end if;
  insert into public.encontros (mesa_id, ativo, rodada, vez, ordem, atualizado_em) values (p_mesa, true, 1, 0, o, now())
  on conflict (mesa_id) do update set ativo = true, rodada = 1, vez = 0, ordem = excluded.ordem, atualizado_em = now();
  return o;
end $$;

create function public.proximo_turno(p_mesa uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.encontros; n int;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre passa o turno.' using errcode = '42501'; end if;
  select * into e from public.encontros where mesa_id = p_mesa and ativo for update;
  if e.mesa_id is null then raise exception 'Nenhum encontro em andamento.'; end if;
  n := greatest(1, jsonb_array_length(e.ordem));
  update public.encontros set vez = (e.vez + 1) % n, rodada = e.rodada + case when e.vez + 1 >= n then 1 else 0 end, atualizado_em = now()
   where mesa_id = p_mesa returning * into e;
  return jsonb_build_object('rodada', e.rodada, 'vez', e.vez);
end $$;

create function public.encerrar_encontro(p_mesa uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre encerra o encontro.' using errcode = '42501'; end if;
  update public.encontros set ativo = false, atualizado_em = now() where mesa_id = p_mesa;
end $$;

-- ---------- Duelos: teste contestado, os dois lados rolados no servidor ----------
create table public.disputas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  rotulo text not null check (char_length(rotulo) between 1 and 80),
  a jsonb not null,
  b jsonb not null,
  visivel boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.disputas (mesa_id, criado_em desc);
alter table public.disputas enable row level security;
revoke all on public.disputas from anon, authenticated;
grant select on public.disputas to authenticated;
-- o jogador só vê o duelo em que está, e só se o mestre deixou visível
create policy disputas_le on public.disputas for select to authenticated
  using (privado.sou_mestre(mesa_id) or (visivel and ((select auth.uid())::text in (a ->> 'id', b ->> 'id'))));

create function privado.lado_do_duelo(p_mesa uuid, p_tipo text, p_id text, p_attr text) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare j public.jogadores; f public.figuras; d int := 1 + floor(random() * 20)::int; m int;
begin
  if p_tipo = 'jogador' then
    select * into j from public.jogadores where mesa_id = p_mesa and user_id::text = p_id;
    if j.user_id is null then raise exception 'Jogador não encontrado.'; end if;
    m := privado.mod_da_ficha(j.ficha, nullif(p_attr, ''));
    return jsonb_build_object('tipo', 'jogador', 'id', p_id, 'nome', j.nome, 'caminhoId', left(j.ficha ->> 'caminhoId', 20), 'cor', left(j.ficha ->> 'cor', 7), 'atributo', nullif(p_attr, ''), 'dado', d, 'mod', m, 'total', d + m);
  elsif p_tipo = 'figura' then
    select * into f from public.figuras where mesa_id = p_mesa and id::text = p_id;
    if f.id is null then raise exception 'Figura não encontrada.'; end if;
    return jsonb_build_object('tipo', 'figura', 'id', p_id, 'nome', f.nome, 'atributo', null, 'dado', d, 'mod', f.bonus, 'total', d + f.bonus);
  end if;
  raise exception 'Lado inválido.';
end $$;
revoke all on function privado.lado_do_duelo(uuid, text, text, text) from public, anon, authenticated;

create function public.disputar(p_mesa uuid, p_rotulo text, p_a_tipo text, p_a_id text, p_a_attr text, p_b_tipo text, p_b_id text, p_b_attr text, p_visivel boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a jsonb; b jsonb; r text := coalesce(nullif(left(trim(coalesce(p_rotulo, '')), 80), ''), 'Duelo');
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre começa um duelo.' using errcode = '42501'; end if;
  if p_a_tipo = p_b_tipo and p_a_id = p_b_id then raise exception 'Escolha dois lados diferentes.'; end if;
  a := privado.lado_do_duelo(p_mesa, p_a_tipo, p_a_id, p_a_attr);
  b := privado.lado_do_duelo(p_mesa, p_b_tipo, p_b_id, p_b_attr);
  insert into public.disputas (mesa_id, rotulo, a, b, visivel) values (p_mesa, r, a, b, coalesce(p_visivel, true));
  return jsonb_build_object('rotulo', r, 'a', a, 'b', b);
end $$;

-- ---------- Crônica: momentos que o mestre registra (só ele vê) ----------
create table public.cronica (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  criado_em timestamptz not null default now()
);
create index on public.cronica (mesa_id, criado_em);
alter table public.cronica enable row level security;
revoke all on public.cronica from anon, authenticated;
grant select, insert, delete on public.cronica to authenticated;
create policy cronica_so_mestre on public.cronica for all to authenticated
  using (privado.sou_mestre(mesa_id)) with check (privado.sou_mestre(mesa_id));

-- ---------- teste aberto à prova de trapaça: o modificador vem da ficha guardada, não do navegador ----------
-- (p_modificador continua na assinatura para não quebrar sites antigos, mas é ignorado)
create or replace function public.responder_pedido(p_pedido uuid, p_modificador int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos; v int; mo int; t int; f jsonb;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if p.id is null or p.para <> (select auth.uid()) or p.tipo <> 'aberto' then raise exception 'Pedido inválido.' using errcode = '42501'; end if;
  if p.estado <> 'pendente' then raise exception 'Este teste já foi rolado.'; end if;
  select ficha into f from public.jogadores where mesa_id = p.mesa_id and user_id = p.para;
  mo := privado.mod_da_ficha(f, p.atributo);
  v := 1 + floor(random() * p.lados)::int; t := v + mo;
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (p.id, p.mesa_id, p.para, 'aberto', v, p.lados, mo, t);
  update public.pedidos set estado = 'feito' where id = p.id;
  return jsonb_build_object('dado', v, 'lados', p.lados, 'modificador', mo, 'total', t);
end $$;

-- rolar_secreto com a leitura segura (antes, um modificador ilegível na ficha dava erro)
create or replace function public.rolar_secreto(p_mesa uuid, p_para uuid, p_rotulo text, p_atributo text, p_lados int, p_dificuldade int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid; v int; mo int; t int; l int := coalesce(p_lados, 20); f jsonb;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre rola testes secretos.' using errcode = '42501'; end if;
  select ficha into f from public.jogadores where mesa_id = p_mesa and user_id = p_para;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  mo := privado.mod_da_ficha(f, nullif(p_atributo, ''));
  v := 1 + floor(random() * l)::int; t := v + mo;
  insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo, lados, estado) values (p_mesa, p_para, 'secreto', p_rotulo, nullif(p_atributo, ''), l, 'feito') returning id into pid;
  insert into public.segredos_pedido (pedido_id, mesa_id, dificuldade) values (pid, p_mesa, p_dificuldade);
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (pid, p_mesa, p_para, 'secreto', v, l, mo, t);
  return jsonb_build_object('pedido', pid, 'dado', v, 'modificador', mo, 'total', t, 'passou', t >= p_dificuldade);
end $$;

revoke all on function public.iniciar_encontro(uuid, uuid[]), public.proximo_turno(uuid), public.encerrar_encontro(uuid),
  public.disputar(uuid, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.iniciar_encontro(uuid, uuid[]), public.proximo_turno(uuid), public.encerrar_encontro(uuid),
  public.disputar(uuid, text, text, text, text, text, text, text, boolean) to authenticated;

alter publication supabase_realtime add table public.encontros, public.disputas;
