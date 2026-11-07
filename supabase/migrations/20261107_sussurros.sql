-- Sussurros e pistas: o mestre manda texto e/ou imagem para um jogador ou para a mesa toda.
-- A pista é guardada UMA vez (para = null significa "todos"); quem leu fica em sussurros_leituras.
-- Só o mestre envia (função do servidor). O jogador lê só o que é dele ou da mesa dele.

create table public.sussurros (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  para uuid,                                              -- null = todos os jogadores da mesa
  titulo text check (titulo is null or char_length(titulo) <= 80),
  texto text check (texto is null or char_length(texto) <= 1000),
  imagem text check (imagem is null or (char_length(imagem) <= 450000 and imagem ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$')),
  criado_em timestamptz not null default now(),
  check (texto is not null or imagem is not null)
);
create index on public.sussurros (mesa_id, criado_em desc);
create index on public.sussurros (para);

create table public.sussurros_leituras (
  sussurro_id uuid not null references public.sussurros(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null,
  lido_em timestamptz not null default now(),
  primary key (sussurro_id, user_id)
);
create index on public.sussurros_leituras (mesa_id);

alter table public.sussurros enable row level security;
alter table public.sussurros_leituras enable row level security;

-- ajudante: o usuário atual é jogador desta mesa?
create function privado.estou_na_mesa(p_mesa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jogadores j where j.mesa_id = p_mesa and j.user_id = (select auth.uid()));
$$;
revoke all on function privado.estou_na_mesa(uuid) from public, anon;
grant execute on function privado.estou_na_mesa(uuid) to authenticated;

revoke all on public.sussurros, public.sussurros_leituras from anon, authenticated;
grant select, delete on public.sussurros to authenticated;
grant select on public.sussurros_leituras to authenticated;

create policy sussurros_le on public.sussurros for select to authenticated
  using (privado.sou_mestre(mesa_id) or para = (select auth.uid()) or (para is null and privado.estou_na_mesa(mesa_id)));
create policy sussurros_mestre_apaga on public.sussurros for delete to authenticated using (privado.sou_mestre(mesa_id));
create policy leituras_le on public.sussurros_leituras for select to authenticated
  using (privado.sou_mestre(mesa_id) or user_id = (select auth.uid()));

-- Mestre sussurra. p_para null = todos. Devolve o id do sussurro.
create function public.sussurrar(p_mesa uuid, p_para uuid, p_titulo text, p_texto text, p_imagem text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid; t text := nullif(left(trim(coalesce(p_texto, '')), 1000), ''); ti text := nullif(left(trim(coalesce(p_titulo, '')), 80), '');
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre sussurra.' using errcode = '42501'; end if;
  if t is null and p_imagem is null then raise exception 'Escreva algo ou escolha uma imagem.'; end if;
  if p_para is not null and not exists (select 1 from public.jogadores where mesa_id = p_mesa and user_id = p_para) then raise exception 'Jogador não encontrado.'; end if;
  if (select count(*) from public.sussurros where mesa_id = p_mesa) >= 200 then raise exception 'Limite de 200 sussurros nesta mesa. Apague alguns antigos.'; end if;
  insert into public.sussurros (mesa_id, para, titulo, texto, imagem) values (p_mesa, p_para, ti, t, p_imagem) returning id into sid;
  return sid;
end $$;

-- Jogador marca como lido (só o que pode ver).
create function public.ler_sussurro(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sussurros;
begin
  select * into s from public.sussurros where id = p_id;
  if s.id is null or not (s.para = (select auth.uid()) or (s.para is null and privado.estou_na_mesa(s.mesa_id))) then
    raise exception 'Sussurro inválido.' using errcode = '42501';
  end if;
  insert into public.sussurros_leituras (sussurro_id, mesa_id, user_id) values (s.id, s.mesa_id, (select auth.uid())) on conflict do nothing;
end $$;

revoke all on function public.sussurrar(uuid, uuid, text, text, text), public.ler_sussurro(uuid) from public, anon;
grant execute on function public.sussurrar(uuid, uuid, text, text, text), public.ler_sussurro(uuid) to authenticated;

alter publication supabase_realtime add table public.sussurros, public.sussurros_leituras;
