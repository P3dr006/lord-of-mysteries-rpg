-- Mesa do Mestre: mesas, jogadores, pedidos de teste (abertos e secretos), dificuldades secretas e resultados.
-- Tudo com RLS. Escritas sensíveis só por funções do servidor (o dado é rolado no banco).

create schema if not exists privado;
grant usage on schema privado to authenticated;

-- ---------- tabelas ----------
create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null check (char_length(nome) between 1 and 60),
  mestre_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  criada_em timestamptz not null default now()
);

create table public.jogadores (
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nome text not null check (char_length(nome) between 1 and 40),
  ficha jsonb not null default '{}'::jsonb check (pg_column_size(ficha) < 8000),
  atualizado_em timestamptz not null default now(),
  primary key (mesa_id, user_id)
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null,
  para uuid not null,
  tipo text not null check (tipo in ('aberto', 'secreto')),
  rotulo text not null check (char_length(rotulo) between 1 and 80),
  atributo text check (atributo in ('forca','agil','vigor','intel','espir','pres')),
  lados int not null default 20 check (lados in (4,6,8,10,12,20,22,100)),
  estado text not null default 'pendente' check (estado in ('pendente', 'feito')),
  criado_em timestamptz not null default now(),
  foreign key (mesa_id, para) references public.jogadores(mesa_id, user_id) on delete cascade
);

create table public.segredos_pedido (
  pedido_id uuid primary key references public.pedidos(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  dificuldade int not null check (dificuldade between 1 and 200)
);

create table public.resultados (
  pedido_id uuid primary key references public.pedidos(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null,
  tipo text not null check (tipo in ('aberto', 'secreto')),
  dado int not null,
  lados int not null,
  modificador int not null,
  total int not null,
  criado_em timestamptz not null default now()
);

create index on public.jogadores (user_id);
create index on public.pedidos (mesa_id, criado_em desc);
create index on public.pedidos (mesa_id, para);
create index on public.segredos_pedido (mesa_id);
create index on public.resultados (mesa_id, criado_em desc);

alter table public.mesas enable row level security;
alter table public.jogadores enable row level security;
alter table public.pedidos enable row level security;
alter table public.segredos_pedido enable row level security;
alter table public.resultados enable row level security;

-- ---------- ajudantes (fora do schema exposto pela API) ----------
create function privado.sou_mestre(p_mesa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mesas m where m.id = p_mesa and m.mestre_id = (select auth.uid()));
$$;

create function privado.sou_anonimo() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

create function privado.novo_codigo() returns text
language plpgsql volatile set search_path = '' as $$
declare alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1); end loop;
    exit when not exists (select 1 from public.mesas where codigo = c);
  end loop;
  return c;
end $$;

revoke all on function privado.sou_mestre(uuid), privado.sou_anonimo(), privado.novo_codigo() from public, anon;
grant execute on function privado.sou_mestre(uuid), privado.sou_anonimo(), privado.novo_codigo() to authenticated;

-- ---------- permissões de tabela (nada é exposto por padrão) ----------
revoke all on public.mesas, public.jogadores, public.pedidos, public.segredos_pedido, public.resultados from anon, authenticated;
grant select, delete on public.mesas to authenticated;
grant select, delete on public.jogadores to authenticated;
grant update (nome, ficha, atualizado_em) on public.jogadores to authenticated;
grant select, delete on public.pedidos to authenticated;
grant select on public.segredos_pedido to authenticated;
grant select on public.resultados to authenticated;

-- ---------- políticas ----------
create policy mesas_mestre_le on public.mesas for select to authenticated using (mestre_id = (select auth.uid()));
create policy mesas_mestre_apaga on public.mesas for delete to authenticated using (mestre_id = (select auth.uid()));

create policy jogadores_le on public.jogadores for select to authenticated
  using (user_id = (select auth.uid()) or privado.sou_mestre(mesa_id));
create policy jogadores_atualiza_o_proprio on public.jogadores for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy jogadores_apaga on public.jogadores for delete to authenticated
  using (user_id = (select auth.uid()) or privado.sou_mestre(mesa_id));

create policy pedidos_le on public.pedidos for select to authenticated
  using (privado.sou_mestre(mesa_id) or (para = (select auth.uid()) and tipo = 'aberto'));
create policy pedidos_mestre_apaga on public.pedidos for delete to authenticated using (privado.sou_mestre(mesa_id));

create policy segredos_so_mestre on public.segredos_pedido for select to authenticated using (privado.sou_mestre(mesa_id));

create policy resultados_le on public.resultados for select to authenticated
  using (privado.sou_mestre(mesa_id) or (user_id = (select auth.uid()) and tipo = 'aberto'));

-- ---------- atualizado_em ----------
create function privado.marca_hora() returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger jogadores_hora before update on public.jogadores for each row execute function privado.marca_hora();

-- ---------- funções chamadas pelo site ----------
-- Mestre (login com e-mail) cria a mesa. Visitante anônimo não pode.
create function public.criar_mesa(p_nome text) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if (select auth.uid()) is null or privado.sou_anonimo() then raise exception 'Entre com e-mail para criar uma mesa.' using errcode = '42501'; end if;
  if (select count(*) from public.mesas where mestre_id = (select auth.uid())) >= 10 then raise exception 'Limite de 10 mesas.'; end if;
  c := privado.novo_codigo();
  insert into public.mesas (codigo, nome, mestre_id) values (c, left(trim(p_nome), 60), (select auth.uid()));
  return c;
end $$;

-- Jogador entra com o código da mesa e o nome.
create function public.entrar_na_mesa(p_codigo text, p_nome text, p_ficha jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m uuid;
begin
  if (select auth.uid()) is null then raise exception 'Entre primeiro.' using errcode = '42501'; end if;
  select id into m from public.mesas where codigo = upper(trim(p_codigo));
  if m is null then raise exception 'Mesa não encontrada.'; end if;
  if (select count(*) from public.jogadores where mesa_id = m) >= 20
     and not exists (select 1 from public.jogadores where mesa_id = m and user_id = (select auth.uid())) then
    raise exception 'A mesa está cheia.';
  end if;
  insert into public.jogadores (mesa_id, user_id, nome, ficha)
  values (m, (select auth.uid()), left(trim(p_nome), 40), coalesce(p_ficha, '{}'::jsonb))
  on conflict (mesa_id, user_id) do update set nome = excluded.nome, ficha = excluded.ficha;
  return m;
end $$;

-- Mestre pede um teste ABERTO: o jogador vê o pedido, rola, e o resultado aparece para os dois.
create function public.pedir_teste(p_mesa uuid, p_para uuid, p_rotulo text, p_atributo text, p_lados int, p_dificuldade int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre pede testes.' using errcode = '42501'; end if;
  insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo, lados) values (p_mesa, p_para, 'aberto', p_rotulo, nullif(p_atributo, ''), coalesce(p_lados, 20)) returning id into pid;
  insert into public.segredos_pedido (pedido_id, mesa_id, dificuldade) values (pid, p_mesa, p_dificuldade);
  return pid;
end $$;

-- Jogador rola o teste que o mestre pediu. O dado sai do servidor.
create function public.responder_pedido(p_pedido uuid, p_modificador int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos; v int; mo int; t int;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if p.id is null or p.para <> (select auth.uid()) or p.tipo <> 'aberto' then raise exception 'Pedido inválido.' using errcode = '42501'; end if;
  if p.estado <> 'pendente' then raise exception 'Este teste já foi rolado.'; end if;
  mo := greatest(-30, least(30, coalesce(p_modificador, 0)));
  v := 1 + floor(random() * p.lados)::int; t := v + mo;
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (p.id, p.mesa_id, p.para, 'aberto', v, p.lados, mo, t);
  update public.pedidos set estado = 'feito' where id = p.id;
  return jsonb_build_object('dado', v, 'lados', p.lados, 'modificador', mo, 'total', t);
end $$;

-- Mestre rola um teste SECRETO: o jogador não recebe pedido nem resultado.
-- O modificador vem da ficha do jogador (ficha.mods.<atributo>).
create function public.rolar_secreto(p_mesa uuid, p_para uuid, p_rotulo text, p_atributo text, p_lados int, p_dificuldade int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid; v int; mo int := 0; t int; l int := coalesce(p_lados, 20); f jsonb;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre rola testes secretos.' using errcode = '42501'; end if;
  select ficha into f from public.jogadores where mesa_id = p_mesa and user_id = p_para;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  if nullif(p_atributo, '') is not null then mo := greatest(-30, least(30, coalesce((f -> 'mods' ->> p_atributo)::int, 0))); end if;
  v := 1 + floor(random() * l)::int; t := v + mo;
  insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo, lados, estado) values (p_mesa, p_para, 'secreto', p_rotulo, nullif(p_atributo, ''), l, 'feito') returning id into pid;
  insert into public.segredos_pedido (pedido_id, mesa_id, dificuldade) values (pid, p_mesa, p_dificuldade);
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (pid, p_mesa, p_para, 'secreto', v, l, mo, t);
  return jsonb_build_object('pedido', pid, 'dado', v, 'modificador', mo, 'total', t, 'passou', t >= p_dificuldade);
end $$;

revoke all on function public.criar_mesa(text), public.entrar_na_mesa(text, text, jsonb), public.pedir_teste(uuid, uuid, text, text, int, int),
  public.responder_pedido(uuid, int), public.rolar_secreto(uuid, uuid, text, text, int, int) from public, anon;
grant execute on function public.criar_mesa(text), public.entrar_na_mesa(text, text, jsonb), public.pedir_teste(uuid, uuid, text, text, int, int),
  public.responder_pedido(uuid, int), public.rolar_secreto(uuid, uuid, text, text, int, int) to authenticated;

-- ---------- visão do mestre: resultado + dificuldade + passou (RLS do chamador vale) ----------
create view public.resultados_mestre with (security_invoker = true) as
  select r.pedido_id, r.mesa_id, r.user_id, r.tipo, r.dado, r.lados, r.modificador, r.total, r.criado_em,
         p.rotulo, p.atributo, s.dificuldade, (r.total >= s.dificuldade) as passou
  from public.resultados r
  join public.pedidos p on p.id = r.pedido_id
  join public.segredos_pedido s on s.pedido_id = r.pedido_id;
revoke all on public.resultados_mestre from anon, authenticated;
grant select on public.resultados_mestre to authenticated;

-- ---------- tempo real (as regras de RLS valem para quem escuta) ----------
alter publication supabase_realtime add table public.jogadores, public.pedidos, public.resultados;

-- Função criada pela opção "automatic RLS" do projeto: não deve ser chamável pela API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
