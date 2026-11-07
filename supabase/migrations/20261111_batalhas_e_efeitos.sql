-- Batalhas: várias ao mesmo tempo, cada uma com nome, participantes escolhidos, entrada e saída no meio.
-- Efeitos: bênçãos e maldições (modificador de atributo) e selos de habilidade (bloqueio / perda), avisados ou secretos.

-- =====================================================================================================
-- BATALHAS (a tabela encontros passa a ter várias linhas por mesa)
-- =====================================================================================================
drop function if exists public.iniciar_encontro(uuid, uuid[]);
drop function if exists public.proximo_turno(uuid);
drop function if exists public.encerrar_encontro(uuid);

delete from public.encontros where not ativo;
alter table public.encontros drop constraint encontros_pkey;
alter table public.encontros
  add column id uuid not null default gen_random_uuid(),
  add column nome text not null default 'Encontro' check (char_length(nome) between 1 and 40),
  add column jogadores uuid[] not null default '{}',   -- quem está na batalha agora
  add column sairam uuid[] not null default '{}',      -- quem saiu: ainda lê a linha para a faixa sumir da tela dele
  add column criado_em timestamptz not null default now();
alter table public.encontros add primary key (id);
create index on public.encontros (mesa_id);
update public.encontros set jogadores = coalesce((select array_agg((x ->> 'id')::uuid) from jsonb_array_elements(ordem) x
  where x ->> 'tipo' = 'jogador' and x ->> 'id' ~ '^[0-9a-f-]{36}$'), '{}');

-- o jogador só lê as batalhas em que está (ou de que acabou de sair)
drop policy encontros_le on public.encontros;
create policy encontros_le on public.encontros for select to authenticated
  using (privado.sou_mestre(mesa_id) or (privado.estou_na_mesa(mesa_id) and (select auth.uid()) = any(jogadores || sairam)));

-- ---------- efeitos sobre o jogador ----------
create table public.efeitos (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null,
  tipo text not null check (tipo in ('bencao', 'maldicao', 'bloqueio', 'perda')),
  atributo text check (atributo is null or atributo ~ '^[a-z]{2,12}$'),
  valor int check (valor is null or valor between -20 and 20),
  habilidade text check (habilidade is null or char_length(habilidade) between 1 and 80),
  rotulo text not null check (char_length(rotulo) between 1 and 60),
  descricao text check (descricao is null or char_length(descricao) <= 300),
  secreto boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((tipo in ('bencao', 'maldicao') and atributo is not null and valor is not null and valor <> 0 and habilidade is null)
      or (tipo in ('bloqueio', 'perda') and habilidade is not null and atributo is null and valor is null)),
  check (tipo <> 'bencao' or valor > 0),
  check (tipo <> 'maldicao' or valor < 0)
);
create index on public.efeitos (mesa_id, user_id);
create trigger efeitos_hora before update on public.efeitos for each row execute function privado.marca_hora();
alter table public.efeitos enable row level security;
revoke all on public.efeitos from anon, authenticated;
grant select, insert, delete on public.efeitos to authenticated;
grant update (rotulo, descricao, secreto, valor) on public.efeitos to authenticated;
-- o jogador vê só os próprios efeitos avisados; os secretos ficam com o mestre
create policy efeitos_le on public.efeitos for select to authenticated
  using (privado.sou_mestre(mesa_id) or (user_id = (select auth.uid()) and not secreto and privado.estou_na_mesa(mesa_id)));
create policy efeitos_mestre_cria on public.efeitos for insert to authenticated
  with check (privado.sou_mestre(mesa_id) and exists (select 1 from public.jogadores j where j.mesa_id = efeitos.mesa_id and j.user_id = efeitos.user_id));
-- limite de 30 por jogador num gatilho (contar a própria tabela dentro da política dá recursão)
create function privado.limite_efeitos() returns trigger language plpgsql security definer set search_path = '' as $
begin
  if (select count(*) from public.efeitos where mesa_id = new.mesa_id and user_id = new.user_id) >= 30 then raise exception 'No máximo 30 efeitos por jogador.'; end if;
  return new;
end $;
revoke all on function privado.limite_efeitos() from public, anon, authenticated;
create trigger efeitos_limite before insert on public.efeitos for each row execute function privado.limite_efeitos();
create policy efeitos_mestre_muda on public.efeitos for update to authenticated
  using (privado.sou_mestre(mesa_id)) with check (privado.sou_mestre(mesa_id));
create policy efeitos_mestre_apaga on public.efeitos for delete to authenticated using (privado.sou_mestre(mesa_id));

-- modificador do jogador = ficha + bênçãos e maldições (inclusive as secretas)
create function privado.mod_do_jogador(p_mesa uuid, p_user uuid, f jsonb, attr text) returns int
language sql stable set search_path = '' as $$
  select case when attr is null or attr = '' then 0 else
    greatest(-30, least(30, privado.mod_da_ficha(f, attr) + coalesce((select sum(e.valor)::int from public.efeitos e
      where e.mesa_id = p_mesa and e.user_id = p_user and e.tipo in ('bencao', 'maldicao') and e.atributo = attr), 0))) end;
$$;
-- o que o jogador enxerga: ficha + só os efeitos avisados
create function privado.mod_visivel(p_mesa uuid, p_user uuid, f jsonb, attr text) returns int
language sql stable set search_path = '' as $$
  select case when attr is null or attr = '' then 0 else
    greatest(-30, least(30, privado.mod_da_ficha(f, attr) + coalesce((select sum(e.valor)::int from public.efeitos e
      where e.mesa_id = p_mesa and e.user_id = p_user and e.tipo in ('bencao', 'maldicao') and e.atributo = attr and not e.secreto), 0))) end;
$$;
revoke all on function privado.mod_do_jogador(uuid, uuid, jsonb, text), privado.mod_visivel(uuid, uuid, jsonb, text) from public, anon, authenticated;

-- ---------- uma linha da Roda: d20 + Agilidade (jogador, com efeitos) ou d20 + bônus (figura) ----------
create function privado.entrada_da_roda(p_mesa uuid, p_tipo text, p_id text) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare j public.jogadores; f public.figuras; d int := 1 + floor(random() * 20)::int; m int;
begin
  if p_tipo = 'jogador' then
    select * into j from public.jogadores where mesa_id = p_mesa and user_id::text = p_id;
    if j.user_id is null then raise exception 'Jogador não encontrado.'; end if;
    m := privado.mod_do_jogador(p_mesa, j.user_id, j.ficha, 'agil');
    return jsonb_build_object('tipo', 'jogador', 'id', p_id, 'nome', j.nome, 'caminhoId', left(j.ficha ->> 'caminhoId', 20), 'cor', left(j.ficha ->> 'cor', 7), 'dado', d, 'bonus', m, 'total', d + m);
  elsif p_tipo = 'figura' then
    select * into f from public.figuras where mesa_id = p_mesa and id::text = p_id;
    if f.id is null then raise exception 'Figura não encontrada.'; end if;
    return jsonb_build_object('tipo', 'figura', 'id', p_id, 'nome', f.nome, 'caminhoId', null, 'cor', null, 'dado', d, 'bonus', f.bonus, 'total', d + f.bonus);
  end if;
  raise exception 'Participante inválido.';
end $$;
revoke all on function privado.entrada_da_roda(uuid, text, text) from public, anon, authenticated;

-- ninguém em duas batalhas ao mesmo tempo
create function privado.ja_em_batalha(p_mesa uuid, p_tipo text, p_id text, p_fora uuid) returns text
language sql stable set search_path = '' as $$
  select e.nome from public.encontros e, jsonb_array_elements(e.ordem) x
   where e.mesa_id = p_mesa and e.ativo and e.id is distinct from p_fora and x ->> 'tipo' = p_tipo and x ->> 'id' = p_id limit 1;
$$;
revoke all on function privado.ja_em_batalha(uuid, text, text, uuid) from public, anon, authenticated;

create function public.iniciar_batalha(p_mesa uuid, p_nome text, p_jogadores uuid[], p_figuras uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare o jsonb := '[]'::jsonb; x text; outra text; bid uuid; n text := coalesce(nullif(left(trim(coalesce(p_nome, '')), 40), ''), 'Encontro'); js uuid[];
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre começa uma batalha.' using errcode = '42501'; end if;
  delete from public.encontros where mesa_id = p_mesa and not ativo;
  if (select count(*) from public.encontros where mesa_id = p_mesa and ativo) >= 4 then raise exception 'No máximo 4 batalhas ao mesmo tempo.'; end if;
  select array_agg(distinct u) into js from unnest(coalesce(p_jogadores, '{}')) u where exists (select 1 from public.jogadores j where j.mesa_id = p_mesa and j.user_id = u);
  foreach x in array coalesce(js::text[], '{}') loop
    outra := privado.ja_em_batalha(p_mesa, 'jogador', x, null);
    if outra is not null then raise exception '% já está na batalha "%".', (select nome from public.jogadores where mesa_id = p_mesa and user_id::text = x), outra; end if;
    o := o || privado.entrada_da_roda(p_mesa, 'jogador', x);
  end loop;
  foreach x in array coalesce((select array_agg(distinct f::text) from unnest(coalesce(p_figuras, '{}')) f), '{}') loop
    outra := privado.ja_em_batalha(p_mesa, 'figura', x, null);
    if outra is not null then raise exception 'Essa figura já está na batalha "%".', outra; end if;
    o := o || privado.entrada_da_roda(p_mesa, 'figura', x);
  end loop;
  if jsonb_array_length(o) = 0 then raise exception 'Ninguém para entrar na Roda.'; end if;
  select jsonb_agg(v order by (v ->> 'total')::int desc, (v ->> 'bonus')::int desc, random()) into o from jsonb_array_elements(o) v;
  insert into public.encontros (mesa_id, nome, ativo, rodada, vez, ordem, jogadores) values (p_mesa, n, true, 1, 0, o, coalesce(js, '{}')) returning id into bid;
  insert into public.cronica (mesa_id, texto) values (p_mesa, left('⚔ ' || n || ' começa: ' || (select string_agg(v ->> 'nome', ', ') from jsonb_array_elements(o) v), 500));
  return bid;
end $$;

-- girar de novo: rola a iniciativa de quem está na batalha agora
create function public.regirar_batalha(p_batalha uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.encontros; o jsonb := '[]'::jsonb; v jsonb;
begin
  select * into e from public.encontros where id = p_batalha and ativo for update;
  if e.id is null or not privado.sou_mestre(e.mesa_id) then raise exception 'Batalha não encontrada.' using errcode = '42501'; end if;
  for v in select * from jsonb_array_elements(e.ordem) loop o := o || privado.entrada_da_roda(e.mesa_id, v ->> 'tipo', v ->> 'id'); end loop;
  select coalesce(jsonb_agg(x order by (x ->> 'total')::int desc, (x ->> 'bonus')::int desc, random()), '[]'::jsonb) into o from jsonb_array_elements(o) x;
  update public.encontros set ordem = o, rodada = 1, vez = 0, atualizado_em = now() where id = e.id;
end $$;

create function public.passar_turno(p_batalha uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.encontros; n int;
begin
  select * into e from public.encontros where id = p_batalha and ativo for update;
  if e.id is null or not privado.sou_mestre(e.mesa_id) then raise exception 'Batalha não encontrada.' using errcode = '42501'; end if;
  n := greatest(1, jsonb_array_length(e.ordem));
  update public.encontros set vez = (e.vez + 1) % n, rodada = e.rodada + case when e.vez + 1 >= n then 1 else 0 end, atualizado_em = now()
   where id = e.id returning * into e;
  return jsonb_build_object('rodada', e.rodada, 'vez', e.vez);
end $$;

create function public.encerrar_batalha(p_batalha uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.encontros;
begin
  select * into e from public.encontros where id = p_batalha and ativo for update;
  if e.id is null or not privado.sou_mestre(e.mesa_id) then raise exception 'Batalha não encontrada.' using errcode = '42501'; end if;
  update public.encontros set ativo = false, atualizado_em = now() where id = e.id;
  insert into public.cronica (mesa_id, texto) values (e.mesa_id, left('⚔ ' || e.nome || ' termina na rodada ' || e.rodada, 500));
end $$;

-- entra no meio: rola a iniciativa e é encaixado na ordem sem roubar a vez de quem está jogando
create function public.entrar_na_batalha(p_batalha uuid, p_tipo text, p_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.encontros; v jsonb; pos int := 0; i int := 0; x jsonb; outra text;
begin
  select * into e from public.encontros where id = p_batalha and ativo for update;
  if e.id is null or not privado.sou_mestre(e.mesa_id) then raise exception 'Batalha não encontrada.' using errcode = '42501'; end if;
  if jsonb_array_length(e.ordem) >= 30 then raise exception 'A Roda já está cheia (30).'; end if;
  outra := privado.ja_em_batalha(e.mesa_id, p_tipo, p_id, null);
  if outra is not null then raise exception 'Já está na batalha "%".', outra; end if;
  v := privado.entrada_da_roda(e.mesa_id, p_tipo, p_id);
  pos := jsonb_array_length(e.ordem);
  for x in select * from jsonb_array_elements(e.ordem) loop
    if (v ->> 'total')::int > (x ->> 'total')::int then pos := i; exit; end if;
    i := i + 1;
  end loop;
  update public.encontros set
    ordem = (select coalesce(jsonb_agg(y order by k), '[]'::jsonb) from (
              select y, (k - 1) * 2 as k from jsonb_array_elements(e.ordem) with ordinality t(y, k)
              union all select v, pos * 2 - 1) s),
    vez = case when pos <= e.vez then e.vez + 1 else e.vez end,
    jogadores = case when p_tipo = 'jogador' then array_append(array_remove(e.jogadores, p_id::uuid), p_id::uuid) else e.jogadores end,
    sairam = case when p_tipo = 'jogador' then array_remove(e.sairam, p_id::uuid) else e.sairam end,
    atualizado_em = now()
  where id = e.id;
  insert into public.cronica (mesa_id, texto) values (e.mesa_id, left(e.nome || ' — ' || (v ->> 'nome') || ' entra na rodada ' || e.rodada, 500));
end $$;

-- sai no meio: some da ordem; se era a vez dele, a vez passa para o próximo (ninguém é pulado)
create function public.sair_da_batalha(p_batalha uuid, p_tipo text, p_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.encontros; idx int; o jsonb; n int; nv int; nr int; quem text;
begin
  select * into e from public.encontros where id = p_batalha and ativo for update;
  if e.id is null or not privado.sou_mestre(e.mesa_id) then raise exception 'Batalha não encontrada.' using errcode = '42501'; end if;
  select k - 1, y ->> 'nome' into idx, quem from jsonb_array_elements(e.ordem) with ordinality t(y, k) where y ->> 'tipo' = p_tipo and y ->> 'id' = p_id limit 1;
  if idx is null then raise exception 'Não está nesta batalha.'; end if;
  o := e.ordem - idx; n := jsonb_array_length(o); nv := e.vez; nr := e.rodada;
  if idx < e.vez then nv := e.vez - 1; end if;
  if n > 0 and nv >= n then nv := 0; nr := nr + 1; end if;
  update public.encontros set ordem = o, vez = case when n = 0 then 0 else nv end, rodada = nr, ativo = n > 0,
    jogadores = case when p_tipo = 'jogador' then array_remove(e.jogadores, p_id::uuid) else e.jogadores end,
    sairam = case when p_tipo = 'jogador' then array_append(array_remove(e.sairam, p_id::uuid), p_id::uuid) else e.sairam end,
    atualizado_em = now()
  where id = e.id;
  insert into public.cronica (mesa_id, texto) values (e.mesa_id, left(e.nome || ' — ' || quem || ' sai na rodada ' || e.rodada
    || case when n = 0 then ' (a batalha termina)' else '' end, 500));
end $$;

revoke all on function public.iniciar_batalha(uuid, text, uuid[], uuid[]), public.regirar_batalha(uuid), public.passar_turno(uuid),
  public.encerrar_batalha(uuid), public.entrar_na_batalha(uuid, text, text), public.sair_da_batalha(uuid, text, text) from public, anon;
grant execute on function public.iniciar_batalha(uuid, text, uuid[], uuid[]), public.regirar_batalha(uuid), public.passar_turno(uuid),
  public.encerrar_batalha(uuid), public.entrar_na_batalha(uuid, text, text), public.sair_da_batalha(uuid, text, text) to authenticated;

-- =====================================================================================================
-- os testes e o Duelo passam a somar as bênçãos e maldições
-- =====================================================================================================
create or replace function privado.lado_do_duelo(p_mesa uuid, p_tipo text, p_id text, p_attr text) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare j public.jogadores; f public.figuras; d int := 1 + floor(random() * 20)::int; m int; a text := nullif(p_attr, '');
begin
  if p_tipo = 'jogador' then
    select * into j from public.jogadores where mesa_id = p_mesa and user_id::text = p_id;
    if j.user_id is null then raise exception 'Jogador não encontrado.'; end if;
    m := privado.mod_do_jogador(p_mesa, j.user_id, j.ficha, a);
    return jsonb_build_object('tipo', 'jogador', 'id', p_id, 'nome', j.nome, 'caminhoId', left(j.ficha ->> 'caminhoId', 20), 'cor', left(j.ficha ->> 'cor', 7), 'atributo', a, 'dado', d, 'mod', m, 'total', d + m);
  elsif p_tipo = 'figura' then
    select * into f from public.figuras where mesa_id = p_mesa and id::text = p_id;
    if f.id is null then raise exception 'Figura não encontrada.'; end if;
    if a is not null and f.mods ? a then m := privado.mod_da_ficha(jsonb_build_object('mods', f.mods), a); else m := f.bonus; a := null; end if;
    return jsonb_build_object('tipo', 'figura', 'id', p_id, 'nome', f.nome, 'atributo', a, 'dado', d, 'mod', m, 'total', d + m);
  end if;
  raise exception 'Lado inválido.';
end $$;
revoke all on function privado.lado_do_duelo(uuid, text, text, text) from public, anon, authenticated;

-- a parte secreta do modificador fica numa coluna que só o mestre lê; resultados guarda o que o jogador pode ver
alter table public.segredos_pedido add column oculto int not null default 0;
create or replace view public.resultados_mestre with (security_invoker = true) as
  select r.pedido_id, r.mesa_id, r.user_id, r.tipo, r.dado, r.lados, r.modificador + s.oculto as modificador, r.total + s.oculto as total, r.criado_em,
         p.rotulo, p.atributo, s.dificuldade, (r.total + s.oculto >= s.dificuldade) as passou, s.oculto
  from public.resultados r
  join public.pedidos p on p.id = r.pedido_id
  join public.segredos_pedido s on s.pedido_id = r.pedido_id;

-- teste aberto: o mestre recebe o total real; o jogador vê o número da ficha (a maldição secreta não se denuncia)
create or replace function public.responder_pedido(p_pedido uuid, p_modificador int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos; v int; mo int; mv int; t int; f jsonb;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if p.id is null or p.para <> (select auth.uid()) or p.tipo <> 'aberto' then raise exception 'Pedido inválido.' using errcode = '42501'; end if;
  if p.estado <> 'pendente' then raise exception 'Este teste já foi rolado.'; end if;
  select ficha into f from public.jogadores where mesa_id = p.mesa_id and user_id = p.para;
  mo := privado.mod_do_jogador(p.mesa_id, p.para, f, p.atributo);
  mv := privado.mod_visivel(p.mesa_id, p.para, f, p.atributo);
  v := 1 + floor(random() * p.lados)::int; t := v + mo;
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (p.id, p.mesa_id, p.para, 'aberto', v, p.lados, mv, v + mv);
  update public.segredos_pedido set oculto = mo - mv where pedido_id = p.id;
  update public.pedidos set estado = 'feito' where id = p.id;
  return jsonb_build_object('dado', v, 'lados', p.lados, 'modificador', mv, 'total', v + mv);
end $$;

create or replace function public.rolar_secreto(p_mesa uuid, p_para uuid, p_rotulo text, p_atributo text, p_lados int, p_dificuldade int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid; v int; mo int; mv int; t int; l int := coalesce(p_lados, 20); f jsonb;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre rola testes secretos.' using errcode = '42501'; end if;
  select ficha into f from public.jogadores where mesa_id = p_mesa and user_id = p_para;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  mo := privado.mod_do_jogador(p_mesa, p_para, f, nullif(p_atributo, ''));
  mv := privado.mod_visivel(p_mesa, p_para, f, nullif(p_atributo, ''));
  v := 1 + floor(random() * l)::int; t := v + mo;
  insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo, lados, estado) values (p_mesa, p_para, 'secreto', p_rotulo, nullif(p_atributo, ''), l, 'feito') returning id into pid;
  insert into public.segredos_pedido (pedido_id, mesa_id, dificuldade, oculto) values (pid, p_mesa, p_dificuldade, mo - mv);
  insert into public.resultados (pedido_id, mesa_id, user_id, tipo, dado, lados, modificador, total) values (pid, p_mesa, p_para, 'secreto', v, l, mv, v + mv);
  return jsonb_build_object('pedido', pid, 'dado', v, 'modificador', mo, 'total', t, 'passou', t >= p_dificuldade);
end $$;

alter publication supabase_realtime add table public.efeitos;
