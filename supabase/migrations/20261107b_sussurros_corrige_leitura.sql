-- Correção achada na verificação com papéis reais: em ler_sussurro, "para = auth.uid()" com para = null
-- dava NULL (não false) e a negação deixava passar quem estava FORA da mesa nos sussurros "para todos".
create or replace function public.ler_sussurro(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sussurros; pode boolean;
begin
  select * into s from public.sussurros where id = p_id;
  pode := s.id is not null and (coalesce(s.para = (select auth.uid()), false) or (s.para is null and privado.estou_na_mesa(s.mesa_id)));
  if not pode then raise exception 'Sussurro inválido.' using errcode = '42501'; end if;
  insert into public.sussurros_leituras (sussurro_id, mesa_id, user_id) values (s.id, s.mesa_id, (select auth.uid())) on conflict do nothing;
end $$;
revoke all on function public.ler_sussurro(uuid) from public, anon;
grant execute on function public.ler_sussurro(uuid) to authenticated;
