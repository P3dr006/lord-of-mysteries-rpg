-- Bestiário do mestre (fichas de criatura prontas, reutilizáveis em todas as mesas dele), figuras ligadas a uma ficha
-- (atributos próprios no Duelo) e habilidades da mesa: o mestre concede e edita; o jogador propõe e o mestre
-- aprova, modifica ou rejeita.

-- ---------- Bestiário: do mestre (dono), não da mesa ----------
create table public.bestiario (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  tipo text check (tipo is null or char_length(tipo) <= 60),
  perigo int not null default 1 check (perigo between 1 and 5),
  pv_max int check (pv_max is null or pv_max between 1 and 9999),
  defesa int check (defesa is null or defesa between 0 and 99),
  horror text check (horror is null or char_length(horror) <= 120),
  mods jsonb not null default '{}'::jsonb check (jsonb_typeof(mods) = 'object' and pg_column_size(mods) < 600),
  habilidades jsonb not null default '[]'::jsonb check (jsonb_typeof(habilidades) = 'array' and jsonb_array_length(habilidades) <= 12 and pg_column_size(habilidades) < 9000),
  descricao text check (descricao is null or char_length(descricao) <= 1000),
  notas text check (notas is null or char_length(notas) <= 1500),
  imagem text check (imagem is null or (char_length(imagem) <= 450000 and imagem ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.bestiario (dono, nome);
create trigger bestiario_hora before update on public.bestiario for each row execute function privado.marca_hora();
alter table public.bestiario enable row level security;
revoke all on public.bestiario from anon, authenticated;
grant select, insert, delete on public.bestiario to authenticated;
grant update (nome, tipo, perigo, pv_max, defesa, horror, mods, habilidades, descricao, notas, imagem) on public.bestiario to authenticated;
-- só quem entrou com e-mail (mestre) tem bestiário; o visitante anônimo (jogador) não lê nem escreve
create policy bestiario_do_dono on public.bestiario for all to authenticated
  using (dono = (select auth.uid()) and not privado.sou_anonimo())
  with check (dono = (select auth.uid()) and not privado.sou_anonimo());

-- ---------- Figuras: podem vir de uma ficha do bestiário e trazem os modificadores dela ----------
alter table public.figuras
  add column ficha_id uuid references public.bestiario(id) on delete set null,
  add column mods jsonb not null default '{}'::jsonb check (jsonb_typeof(mods) = 'object' and pg_column_size(mods) < 600),
  add column defesa int check (defesa is null or defesa between 0 and 99);

-- a figura que tem o atributo usa o modificador dele no Duelo; sem atributo (ou sem ficha), usa o bônus
create or replace function privado.lado_do_duelo(p_mesa uuid, p_tipo text, p_id text, p_attr text) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare j public.jogadores; f public.figuras; d int := 1 + floor(random() * 20)::int; m int; a text := nullif(p_attr, '');
begin
  if p_tipo = 'jogador' then
    select * into j from public.jogadores where mesa_id = p_mesa and user_id::text = p_id;
    if j.user_id is null then raise exception 'Jogador não encontrado.'; end if;
    m := privado.mod_da_ficha(j.ficha, a);
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

-- ---------- Habilidades da mesa ----------
-- origem 'mestre': concedida por ele (já aprovada). origem 'jogador': proposta, espera o mestre.
create table public.habilidades (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  descricao text check (descricao is null or char_length(descricao) <= 600),
  custo text check (custo is null or char_length(custo) <= 60),
  efeito text check (efeito is null or char_length(efeito) <= 60),
  origem text not null check (origem in ('mestre', 'jogador')),
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'rejeitada')),
  resposta text check (resposta is null or char_length(resposta) <= 300),
  alterada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.habilidades (mesa_id, user_id, criado_em);
create trigger habilidades_hora before update on public.habilidades for each row execute function privado.marca_hora();
alter table public.habilidades enable row level security;
revoke all on public.habilidades from anon, authenticated;
grant select, insert, delete on public.habilidades to authenticated;
grant update (nome, descricao, custo, efeito, estado, resposta, alterada) on public.habilidades to authenticated;

create policy habilidades_le on public.habilidades for select to authenticated
  using (privado.sou_mestre(mesa_id) or (user_id = (select auth.uid()) and privado.estou_na_mesa(mesa_id)));
-- o mestre concede direto (só para quem está na mesa dele); o jogador não escreve na tabela: só pelas funções abaixo
create policy habilidades_mestre_cria on public.habilidades for insert to authenticated
  with check (privado.sou_mestre(mesa_id) and origem = 'mestre' and estado = 'aprovada'
              and exists (select 1 from public.jogadores j where j.mesa_id = habilidades.mesa_id and j.user_id = habilidades.user_id));
create policy habilidades_mestre_muda on public.habilidades for update to authenticated
  using (privado.sou_mestre(mesa_id)) with check (privado.sou_mestre(mesa_id));
create policy habilidades_mestre_apaga on public.habilidades for delete to authenticated
  using (privado.sou_mestre(mesa_id));

-- o jogador propõe; até 5 propostas esperando ao mesmo tempo
create function public.propor_habilidade(p_mesa uuid, p_nome text, p_descricao text, p_custo text, p_efeito text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare n text := left(trim(coalesce(p_nome, '')), 60); i uuid;
begin
  if not privado.estou_na_mesa(p_mesa) then raise exception 'Entre na mesa para propor uma habilidade.' using errcode = '42501'; end if;
  if n = '' then raise exception 'Dê um nome à habilidade.'; end if;
  if (select count(*) from public.habilidades where mesa_id = p_mesa and user_id = (select auth.uid()) and estado = 'pendente') >= 5 then
    raise exception 'Limite de 5 propostas esperando o mestre.';
  end if;
  insert into public.habilidades (mesa_id, user_id, nome, descricao, custo, efeito, origem, estado)
  values (p_mesa, (select auth.uid()), n, nullif(left(trim(coalesce(p_descricao, '')), 600), ''), nullif(left(trim(coalesce(p_custo, '')), 60), ''),
          nullif(left(trim(coalesce(p_efeito, '')), 60), ''), 'jogador', 'pendente')
  returning id into i;
  return i;
end $$;

-- o jogador retira a própria proposta (pendente) ou dispensa uma rejeitada; o que foi aprovado só o mestre tira
create function public.retirar_habilidade(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.habilidades where id = p_id and user_id = (select auth.uid()) and origem = 'jogador' and estado in ('pendente', 'rejeitada');
  if not found then raise exception 'Esta habilidade não pode ser retirada.' using errcode = '42501'; end if;
end $$;

revoke all on function public.propor_habilidade(uuid, text, text, text, text), public.retirar_habilidade(uuid) from public, anon;
grant execute on function public.propor_habilidade(uuid, text, text, text, text), public.retirar_habilidade(uuid) to authenticated;

alter publication supabase_realtime add table public.habilidades;
