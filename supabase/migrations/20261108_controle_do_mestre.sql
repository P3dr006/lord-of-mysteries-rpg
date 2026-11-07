-- Controle do mestre: dano/cura de PV e Sanidade, Modo Terror da mesa, notas secretas por jogador.
-- PV e Sanidade vivem no navegador do jogador; o mestre manda ORDENS que o jogador aplica uma única vez
-- (se estiver fora, aplica quando voltar). Notas secretas: só o mestre lê e escreve.

-- ---------- ordens (uma linha por jogador, para saber quem já aplicou) ----------
create table public.ordens (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null,
  para uuid not null,
  tipo text not null check (tipo in ('pv', 'san', 'terror')),
  valor int not null check (valor between -999 and 999),
  motivo text check (motivo is null or char_length(motivo) <= 80),
  criado_em timestamptz not null default now(),
  aplicada_em timestamptz,
  foreign key (mesa_id, para) references public.jogadores(mesa_id, user_id) on delete cascade
);
create index on public.ordens (mesa_id, criado_em desc);
create index on public.ordens (para) where aplicada_em is null;
alter table public.ordens enable row level security;
revoke all on public.ordens from anon, authenticated;
grant select on public.ordens to authenticated;
create policy ordens_le on public.ordens for select to authenticated
  using (privado.sou_mestre(mesa_id) or para = (select auth.uid()));

-- ---------- Modo Terror da mesa (estado, para quem entra depois) ----------
alter table public.mesas add column terror boolean not null default false;

-- ---------- notas secretas do mestre sobre cada jogador ----------
create table public.notas_mestre (
  mesa_id uuid not null,
  user_id uuid not null,
  texto text not null default '' check (char_length(texto) <= 4000),
  atualizado_em timestamptz not null default now(),
  primary key (mesa_id, user_id),
  foreign key (mesa_id, user_id) references public.jogadores(mesa_id, user_id) on delete cascade
);
alter table public.notas_mestre enable row level security;
revoke all on public.notas_mestre from anon, authenticated;
grant select, insert, update, delete on public.notas_mestre to authenticated;
create policy notas_so_mestre on public.notas_mestre for all to authenticated
  using (privado.sou_mestre(mesa_id)) with check (privado.sou_mestre(mesa_id));
create trigger notas_hora before update on public.notas_mestre for each row execute function privado.marca_hora();

-- ---------- funções ----------
-- Mestre manda uma ordem. p_para null = todos. Terror: valor 1 liga, 0 desliga (e fica guardado na mesa).
create function public.ordenar(p_mesa uuid, p_para uuid, p_tipo text, p_valor int, p_motivo text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0; u uuid; m text := nullif(left(trim(coalesce(p_motivo, '')), 80), '');
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre dá ordens.' using errcode = '42501'; end if;
  if p_tipo not in ('pv', 'san', 'terror') then raise exception 'Ordem desconhecida.'; end if;
  if p_tipo = 'terror' then
    if p_valor not in (0, 1) then raise exception 'Terror é ligar (1) ou desligar (0).'; end if;
    update public.mesas set terror = (p_valor = 1) where id = p_mesa;
  elsif coalesce(p_valor, 0) = 0 or abs(p_valor) > 999 then raise exception 'Quantidade inválida (1 a 999).';
  end if;
  for u in select user_id from public.jogadores where mesa_id = p_mesa and (p_para is null or user_id = p_para) loop
    insert into public.ordens (mesa_id, para, tipo, valor, motivo) values (p_mesa, u, p_tipo, p_valor, m);
    n := n + 1;
  end loop;
  if n = 0 and p_tipo <> 'terror' then raise exception 'Jogador não encontrado.'; end if;
  return n;
end $$;

-- Jogador aplica a ordem: devolve o que fazer, ou null se já foi aplicada (nunca aplica duas vezes).
create function public.aplicar_ordem(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.ordens;
begin
  update public.ordens set aplicada_em = now()
   where id = p_id and para = (select auth.uid()) and aplicada_em is null
   returning * into o;
  if o.id is null then return null; end if;
  return jsonb_build_object('tipo', o.tipo, 'valor', o.valor, 'motivo', o.motivo);
end $$;

-- Estado da mesa para quem está nela (hoje: o Terror).
create function public.estado_da_mesa(p_mesa uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (privado.estou_na_mesa(p_mesa) or privado.sou_mestre(p_mesa)) then raise exception 'Mesa inválida.' using errcode = '42501'; end if;
  return (select jsonb_build_object('terror', m.terror) from public.mesas m where m.id = p_mesa);
end $$;

revoke all on function public.ordenar(uuid, uuid, text, int, text), public.aplicar_ordem(uuid), public.estado_da_mesa(uuid) from public, anon;
grant execute on function public.ordenar(uuid, uuid, text, int, text), public.aplicar_ordem(uuid), public.estado_da_mesa(uuid) to authenticated;

alter publication supabase_realtime add table public.ordens;
