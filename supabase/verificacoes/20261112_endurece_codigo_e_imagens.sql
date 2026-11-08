-- Verificação da migração 20261112 com papéis reais (authenticated). Roda dentro de uma transação que é SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261112_endurece_codigo_e_imagens.sql supabase/verificacoes/20261112_endurece_codigo_e_imagens.sql
do $$
declare
  mestre uuid := gen_random_uuid(); jog uuid := gen_random_uuid(); jog2 uuid := gen_random_uuid();
  cod text; r uuid; i int; n int; falhas text := ''; msg text; ok_ int := 0;
  mesa_id uuid;
begin
  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,  'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog2, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

  -- como o mestre (e-mail): cria a mesa e confere o formato do código
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  cod := public.criar_mesa('Mesa de teste');
  if cod ~ '^[A-HJ-NP-Z2-9]{6}$' then ok_ := ok_ + 1; else falhas := falhas || ' [codigo fora do formato: ' || coalesce(cod, 'nulo') || ']'; end if;

  -- o mestre não alcança a tabela privada de tentativas
  begin perform 1 from privado.tentativas_codigo limit 1; falhas := falhas || ' [mestre leu tentativas_codigo]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- imagens: 100 mil caracteres passa; mais de 300 mil é recusado
  insert into public.bestiario (dono, nome, imagem) values (mestre, 'Com imagem ok', 'data:image/webp;base64,' || repeat('A', 100000));
  ok_ := ok_ + 1;
  begin insert into public.bestiario (dono, nome, imagem) values (mestre, 'Imagem enorme', 'data:image/webp;base64,' || repeat('A', 300001));
    falhas := falhas || ' [imagem de 300 mil aceita]';
  exception when check_violation then ok_ := ok_ + 1; end;

  -- limite de 100 criaturas: já há 1; entram mais 99 e a 101ª é recusada
  for i in 1..99 loop insert into public.bestiario (dono, nome) values (mestre, 'Criatura ' || i); end loop;
  begin insert into public.bestiario (dono, nome) values (mestre, 'Criatura 101'); falhas := falhas || ' [101ª criatura aceita]';
  exception when sqlstate '54000' then ok_ := ok_ + 1; end;

  -- como jogador anônimo 1: 15 códigos errados devolvem vazio; o 16º é bloqueado
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  n := 0;
  for i in 1..15 loop
    r := public.entrar_na_mesa('ZZZZZ' || (i % 8 + 2), 'Tentador', '{}'::jsonb);
    if r is null then n := n + 1; end if;
  end loop;
  if n = 15 then ok_ := ok_ + 1; else falhas := falhas || ' [codigo errado nao devolveu vazio: ' || n || '/15]'; end if;
  begin perform public.entrar_na_mesa('ZZZZZ9', 'Tentador', '{}'::jsonb); falhas := falhas || ' [16ª tentativa nao foi bloqueada]';
  exception when sqlstate '54000' then ok_ := ok_ + 1; end;
  -- bloqueado, nem o código certo entra (o bloqueio é por usuário)
  begin perform public.entrar_na_mesa(cod, 'Tentador', '{}'::jsonb); falhas := falhas || ' [bloqueado entrou com o codigo certo]';
  exception when sqlstate '54000' then ok_ := ok_ + 1; end;

  -- como jogador anônimo 2 (outro usuário): não é afetado e entra com o código certo
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', jog2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';
  r := public.entrar_na_mesa('zzzzz2', 'Outro', '{}'::jsonb);
  if r is null then ok_ := ok_ + 1; else falhas := falhas || ' [outro usuario foi afetado]'; end if;
  r := public.entrar_na_mesa(lower(cod), 'Outro', '{}'::jsonb);   -- minúsculas também funcionam
  if r is not null then ok_ := ok_ + 1; else falhas := falhas || ' [codigo certo nao entrou]'; end if;
  begin perform 1 from privado.tentativas_codigo limit 1; falhas := falhas || ' [jogador leu tentativas_codigo]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  execute 'reset role';
  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
