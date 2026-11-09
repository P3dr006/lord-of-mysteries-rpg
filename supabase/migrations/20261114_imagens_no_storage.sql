-- Fase 5: imagens saem das linhas (base64) e vão para o Supabase Storage (bucket privado "imagens").
-- A linha guarda só o CAMINHO do arquivo; o navegador pede uma URL assinada (vale 1 h) e usa cache.
--
-- Pastas do bucket:
--   bestiario/<dono>/<uuid>.<ext>  retrato de criatura/NPC: só o dono (mestre com e-mail) envia, lê e apaga.
--   mesas/<mesa>/<uuid>.<ext>      imagem de pista: só o mestre da mesa envia e apaga; o jogador LÊ só se existir
--                                  um sussurro visível a ele apontando para o arquivo (para ele ou "para todos").
-- Revelar criatura copia o retrato para a pasta da mesa (como hoje: o sussurro guarda uma cópia, não um vínculo).
--
-- Transição: as colunas base64 (imagem) continuam valendo para as linhas antigas e para abas abertas com o site
-- antigo; tools/migrar-imagens.js move as existentes. Uma linha nunca tem as duas ao mesmo tempo.
-- O SQL não apaga arquivos do Storage (gatilho storage.protect_objects_delete): quem apaga é o site, pela API.

-- ---------- bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', false, 307200, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------- colunas de caminho ----------
alter table public.bestiario add column imagem_caminho text
  check (imagem_caminho is null or (imagem_caminho ~ '^bestiario/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
                                    and split_part(imagem_caminho, '/', 2) = dono::text));
alter table public.bestiario add constraint bestiario_uma_imagem check (imagem is null or imagem_caminho is null);
grant update (imagem_caminho) on public.bestiario to authenticated;

alter table public.sussurros add column imagem_caminho text
  check (imagem_caminho is null or (imagem_caminho ~ '^mesas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
                                    and split_part(imagem_caminho, '/', 2) = mesa_id::text));
alter table public.sussurros add constraint sussurros_uma_imagem check (imagem is null or imagem_caminho is null);
alter table public.sussurros drop constraint sussurros_check;
alter table public.sussurros add constraint sussurros_check check (texto is not null or imagem is not null or imagem_caminho is not null);
alter table public.sussurros alter column tem_imagem set expression as (imagem is not null or imagem_caminho is not null);
create index on public.sussurros (imagem_caminho) where imagem_caminho is not null;   -- a política de leitura procura por ele

-- ---------- quem pode o quê (security definer: as checagens leem tabelas que o jogador não vê inteiras) ----------
-- Envia/apaga: dono do bestiário (não anônimo) na pasta dele; mestre da mesa na pasta da mesa.
create function privado.imagem_posso_gerir(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_nome ~ '^bestiario/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
      then split_part(p_nome, '/', 2) = (select auth.uid())::text and not privado.sou_anonimo()
    when p_nome ~ '^mesas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
      then privado.sou_mestre(split_part(p_nome, '/', 2)::uuid)
    else false
  end;
$$;

-- Lê: quem gere, ou o jogador a quem um sussurro com esse arquivo foi mandado (coalesce: para = null não pode virar "sim").
create function privado.imagem_posso_ver(p_nome text) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.imagem_posso_gerir(p_nome) or exists (
    select 1 from public.sussurros s
    where s.imagem_caminho = p_nome
      and (coalesce(s.para = (select auth.uid()), false) or (s.para is null and privado.estou_na_mesa(s.mesa_id)))
  );
$$;
revoke all on function privado.imagem_posso_gerir(text), privado.imagem_posso_ver(text) from public, anon;
grant execute on function privado.imagem_posso_gerir(text), privado.imagem_posso_ver(text) to authenticated;

-- Sem política de UPDATE: nada de sobrescrever/mover (cada imagem nova ganha um nome novo).
-- A URL assinada exige SELECT; copiar exige SELECT na origem e INSERT no destino.
create policy imagens_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and privado.imagem_posso_gerir(name));
create policy imagens_le on storage.objects for select to authenticated
  using (bucket_id = 'imagens' and privado.imagem_posso_ver(name));
create policy imagens_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and privado.imagem_posso_gerir(name));

-- ---------- sussurrar com caminho ----------
-- Versão nova (6 argumentos). A antiga (5) continua para abas abertas com o site antigo e chama a nova.
create function public.sussurrar(p_mesa uuid, p_para uuid, p_titulo text, p_texto text, p_imagem text, p_imagem_caminho text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare sid uuid; t text := nullif(left(trim(coalesce(p_texto, '')), 1000), ''); ti text := nullif(left(trim(coalesce(p_titulo, '')), 80), '');
begin
  if not privado.sou_mestre(p_mesa) then raise exception 'Só o mestre sussurra.' using errcode = '42501'; end if;
  if t is null and p_imagem is null and p_imagem_caminho is null then raise exception 'Escreva algo ou escolha uma imagem.'; end if;
  if p_imagem is not null and p_imagem_caminho is not null then raise exception 'Mande a imagem de um jeito só.'; end if;
  if p_imagem_caminho is not null and not exists (select 1 from storage.objects o where o.bucket_id = 'imagens' and o.name = p_imagem_caminho)
    then raise exception 'A imagem não chegou ao servidor. Tente enviar de novo.'; end if;
  if p_para is not null and not exists (select 1 from public.jogadores where mesa_id = p_mesa and user_id = p_para) then raise exception 'Jogador não encontrado.'; end if;
  if (select count(*) from public.sussurros where mesa_id = p_mesa) >= 200 then raise exception 'Limite de 200 sussurros nesta mesa. Apague alguns antigos.'; end if;
  insert into public.sussurros (mesa_id, para, titulo, texto, imagem, imagem_caminho) values (p_mesa, p_para, ti, t, p_imagem, p_imagem_caminho) returning id into sid;
  return sid;
end $$;

create or replace function public.sussurrar(p_mesa uuid, p_para uuid, p_titulo text, p_texto text, p_imagem text) returns uuid
language sql security definer set search_path = '' as $$
  select public.sussurrar(p_mesa, p_para, p_titulo, p_texto, p_imagem, null::text);
$$;

revoke all on function public.sussurrar(uuid, uuid, text, text, text, text), public.sussurrar(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.sussurrar(uuid, uuid, text, text, text, text), public.sussurrar(uuid, uuid, text, text, text) to authenticated;
