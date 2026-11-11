-- Sequência no servidor (ponta da Fase B2 de docs/SISTEMAS-DA-MESA.md).
-- Antes, a Sequência vinha de ficha.seq, mandada pelo navegador, e dava bônus nas rolagens: dava para trapacear.
-- Decisões do Pedro (2026-11-10):
-- - vale em TODAS as mesas: a Sequência que conta nas rolagens é a de jogadores.sequencia (fora da mesa, o site segue livre);
-- - o jogador PEDE a ascensão (a cerimônia do site vira um pedido) e o mestre aprova ou recusa; o mestre também muda direto;
-- - quem já está numa mesa mantém a Sequência que a ficha tem agora (aceita uma única vez, nesta migração).
-- Quem entra numa mesa depois começa na 9; se a ficha do site estiver adiante, o site pede a ascensão ao mestre.

-- =====================================================================================================
-- 1) a Sequência de cada jogador em cada mesa (o jogador não escreve: a coluna fica fora do grant de update)
-- =====================================================================================================
alter table public.jogadores add column sequencia int not null default 9 check (sequencia between 0 and 9);
update public.jogadores set sequencia = case when jsonb_typeof(ficha -> 'seq') = 'number' and ficha ->> 'seq' ~ '^[0-9]$' then (ficha ->> 'seq')::int else 9 end;

-- =====================================================================================================
-- 2) pedidos de ascensão (e as mudanças diretas do mestre, para o jogador receber o selo de cera)
-- =====================================================================================================
create table public.ascensoes (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  de int not null check (de between 0 and 9),
  para int not null check (para between 0 and 9 and para <> de),
  origem text not null check (origem in ('jogador', 'mestre')),
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'recusada')),
  resposta text check (resposta is null or char_length(resposta) <= 300),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.ascensoes (mesa_id, user_id, criado_em);
create trigger ascensoes_hora before update on public.ascensoes for each row execute function privado.marca_hora();
alter table public.ascensoes enable row level security;
revoke all on public.ascensoes from anon, authenticated;
grant select on public.ascensoes to authenticated;   -- ninguém escreve direto: só pelas funções abaixo
create policy ascensoes_le on public.ascensoes for select to authenticated
  using (privado.sou_mestre(mesa_id) or (user_id = (select auth.uid()) and privado.estou_na_mesa(mesa_id)));
alter publication supabase_realtime add table public.ascensoes;

-- o jogador pede para descer até a Sequência p_para (um passo ou mais); um pedido por vez (o novo substitui o anterior)
create function public.pedir_ascensao(p_mesa uuid, p_para int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); s int; i uuid;
begin
  select j.sequencia into s from public.jogadores j where j.mesa_id = p_mesa and j.user_id = u;
  if s is null then raise exception 'Entre na mesa primeiro.' using errcode = '42501'; end if;
  if p_para is null or p_para < 0 or p_para >= s then raise exception 'Só dá para pedir uma Sequência acima da atual (%).', s using errcode = '22023'; end if;
  delete from public.ascensoes where mesa_id = p_mesa and user_id = u and estado = 'pendente';
  insert into public.ascensoes (mesa_id, user_id, de, para, origem) values (p_mesa, u, s, p_para, 'jogador') returning id into i;
  return i;
end $$;

-- o mestre aprova (a Sequência muda na hora) ou recusa (com recado)
create function public.julgar_ascensao(p_id uuid, p_aprovar boolean, p_resposta text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.ascensoes;
begin
  select * into a from public.ascensoes where id = p_id for update;
  if a.id is null or not privado.sou_mestre(a.mesa_id) then raise exception 'Só o mestre decide a ascensão.' using errcode = '42501'; end if;
  if a.estado <> 'pendente' then raise exception 'Este pedido já foi decidido.'; end if;
  if p_aprovar then
    update public.jogadores set sequencia = a.para, ficha = ficha where mesa_id = a.mesa_id and user_id = a.user_id and sequencia = a.de;
    if not found then raise exception 'A Sequência deste jogador mudou desde o pedido.'; end if;
  end if;
  update public.ascensoes set estado = case when p_aprovar then 'aprovada' else 'recusada' end,
    resposta = nullif(left(trim(coalesce(p_resposta, '')), 300), '') where id = p_id;
end $$;

-- o mestre muda direto (promove ou rebaixa); pedidos esperando somem, e o jogador recebe o selo de cera
create function public.definir_sequencia(p_mesa uuid, p_user uuid, p_seq int, p_resposta text) returns void
language plpgsql security definer set search_path = '' as $$
declare s int;
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre muda a Sequência.' using errcode = '42501'; end if;
  if p_seq is null or p_seq not between 0 and 9 then raise exception 'A Sequência vai de 9 a 0.' using errcode = '22023'; end if;
  select sequencia into s from public.jogadores where mesa_id = p_mesa and user_id = p_user for update;
  if s is null then raise exception 'Jogador não encontrado.'; end if;
  if s = p_seq then raise exception 'O jogador já está na Sequência %.', s; end if;
  update public.jogadores set sequencia = p_seq, ficha = ficha where mesa_id = p_mesa and user_id = p_user;
  delete from public.ascensoes where mesa_id = p_mesa and user_id = p_user and estado = 'pendente';
  insert into public.ascensoes (mesa_id, user_id, de, para, origem, estado, resposta)
  values (p_mesa, p_user, s, p_seq, 'mestre', 'aprovada', nullif(left(trim(coalesce(p_resposta, '')), 300), ''));
end $$;

-- =====================================================================================================
-- 3) o gatilho da ficha: ficha.seq passa a ser a do servidor (a do site fica em seq_site, só para mostrar)
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
  new.ficha := new.ficha || jsonb_build_object('seq', new.sequencia);
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

-- o gatilho também roda quando só a Sequência muda (antes era só "update of ficha")
drop trigger jogadores_ficha_do_servidor on public.jogadores;
create trigger jogadores_ficha_do_servidor before insert or update of ficha, sequencia on public.jogadores
  for each row execute function privado.ficha_do_servidor();

-- =====================================================================================================
-- 4) bênçãos e maldições valem para qualquer atributo da regra (antes: só letras, sem "_")
-- =====================================================================================================
alter table public.efeitos drop constraint efeitos_atributo_check;
alter table public.efeitos add constraint efeitos_atributo_check check (atributo is null or atributo ~ '^[a-z_]{1,12}$');

revoke all on function public.pedir_ascensao(uuid, int), public.julgar_ascensao(uuid, boolean, text), public.definir_sequencia(uuid, uuid, int, text) from public, anon;
grant execute on function public.pedir_ascensao(uuid, int), public.julgar_ascensao(uuid, boolean, text), public.definir_sequencia(uuid, uuid, int, text) to authenticated;

-- fichas que já estão nas mesas: regrava com a Sequência do servidor (que é a que elas já tinham)
update public.jogadores set ficha = ficha;
