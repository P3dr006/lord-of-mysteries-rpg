-- Endurecimento (risco baixo, defesa em camadas):
--  1) limite de códigos de mesa errados por usuário (contra tentar adivinhar códigos);
--  2) código de mesa sorteado com gerador criptográfico (gen_random_uuid);
--  3) imagens: teto de 300 mil caracteres (~220 KB) em vez de 450 mil;
--  4) bestiário: no máximo 100 criaturas por mestre (antes não havia limite de linhas).

-- 1) tentativas erradas ficam num lugar que o navegador não alcança (schema privado, RLS ligada, sem permissões)
create table if not exists privado.tentativas_codigo (
  user_id uuid not null,
  quando timestamptz not null default now()
);
create index if not exists tentativas_codigo_idx on privado.tentativas_codigo (user_id, quando desc);
alter table privado.tentativas_codigo enable row level security;
revoke all on privado.tentativas_codigo from public, anon, authenticated;

-- Código errado NÃO dá erro: devolve vazio. (Um erro desfaria a transação e apagaria o registro da tentativa.)
-- O site traduz o vazio em "Mesa não encontrada". Depois de 15 erros na última hora, bloqueia até passar uma hora.
create or replace function public.entrar_na_mesa(p_codigo text, p_nome text, p_ficha jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m uuid; u uuid := (select auth.uid());
begin
  if u is null then raise exception 'Entre primeiro.' using errcode = '42501'; end if;
  if (select count(*) from privado.tentativas_codigo where user_id = u and quando > now() - interval '1 hour') >= 15 then
    raise exception 'Muitas tentativas com código errado. Espere um pouco e tente de novo.' using errcode = '54000';
  end if;
  select id into m from public.mesas where codigo = upper(trim(p_codigo));
  if m is null then
    delete from privado.tentativas_codigo where quando < now() - interval '1 day';
    insert into privado.tentativas_codigo (user_id) values (u);
    return null;
  end if;
  if (select count(*) from public.jogadores where mesa_id = m) >= 20
     and not exists (select 1 from public.jogadores where mesa_id = m and user_id = u) then
    raise exception 'A mesa está cheia.';
  end if;
  insert into public.jogadores (mesa_id, user_id, nome, ficha)
  values (m, u, left(trim(p_nome), 40), coalesce(p_ficha, '{}'::jsonb))
  on conflict (mesa_id, user_id) do update set nome = excluded.nome, ficha = excluded.ficha;
  return m;
end $$;

-- 2) 6 caracteres de um alfabeto de 32: cada byte do uuid aleatório vira um caractere (256 é múltiplo de 32: sem viés)
create or replace function privado.novo_codigo()
returns text language plpgsql set search_path = '' as $$
declare alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int; b bytea;
begin
  loop
    b := uuid_send(gen_random_uuid()); c := '';
    for i in 0..5 loop c := c || substr(alfabeto, 1 + (get_byte(b, i) & 31), 1); end loop;
    exit when not exists (select 1 from public.mesas where codigo = c);
  end loop;
  return c;
end $$;

-- 3) imagens: o site já reduz para ~185 KB; o banco recusa acima de 300 mil caracteres
alter table public.sussurros drop constraint sussurros_imagem_check;
alter table public.sussurros add constraint sussurros_imagem_check
  check (imagem is null or (char_length(imagem) <= 300000 and imagem ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$'));
alter table public.bestiario drop constraint bestiario_imagem_check;
alter table public.bestiario add constraint bestiario_imagem_check
  check (imagem is null or (char_length(imagem) <= 300000 and imagem ~ '^data:image/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$'));

-- 4) limite de criaturas por mestre (gatilho, e não política: política que consulta a própria tabela entra em recursão)
create or replace function privado.limita_bestiario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.bestiario where dono = new.dono) >= 100 then
    raise exception 'Limite de 100 criaturas no bestiário. Apague algumas antigas.' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function privado.limita_bestiario() from public, anon, authenticated;
drop trigger if exists bestiario_limite on public.bestiario;
create trigger bestiario_limite before insert on public.bestiario for each row execute function privado.limita_bestiario();
