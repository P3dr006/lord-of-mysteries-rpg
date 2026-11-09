-- Verificação da migração 20261114 (imagens no Storage) com papéis reais (authenticated). Transação SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261114_imagens_no_storage.sql supabase/verificacoes/20261114_imagens_no_storage.sql
-- Os "uploads" aqui são linhas em storage.objects inseridas com o papel do usuário: é a mesma checagem de RLS
-- que a API do Storage faz antes de gravar o arquivo (e a URL assinada exige o SELECT testado aqui).

create function pg_temp.virar(u uuid, anonimo boolean) returns void language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anonimo)::text, true);
  execute 'set local role authenticated';
end $f$;

do $$
declare
  mestre uuid := gen_random_uuid(); outro uuid := gen_random_uuid(); jog uuid := gen_random_uuid(); jog2 uuid := gen_random_uuid(); fora uuid := gen_random_uuid();
  mesa uuid; mesa2 uuid; cod text; cod2 text; besId uuid; s1 uuid; s2 uuid; n int; falhas text := ''; ok_ int := 0; b boolean;
  pRetrato text; pPista text; pPriv text; pOutraMesa text; pFantasma text;
begin
  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (outro,  'authenticated', 'authenticated', 'o-' || outro || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,    'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog2,   'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (fora,   'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

  -- bucket privado, com limite de tamanho e só imagens
  select count(*) into n from storage.buckets where id = 'imagens' and not public and file_size_limit = 307200 and allowed_mime_types @> array['image/webp'];
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [bucket nao ficou privado/limitado]'; end if;

  -- mesas: a do mestre (com Klein e Audrey) e outra do "outro" mestre
  perform pg_temp.virar(mestre, false); cod := public.criar_mesa('Mesa do Storage');
  perform pg_temp.virar(outro, false);  cod2 := public.criar_mesa('Mesa alheia');
  perform pg_temp.virar(jog, true);  mesa := public.entrar_na_mesa(cod, 'Klein', '{}'::jsonb);
  perform pg_temp.virar(jog2, true); perform public.entrar_na_mesa(cod, 'Audrey', '{}'::jsonb);
  perform pg_temp.virar(outro, false); select id into mesa2 from public.mesas where codigo = cod2;
  pRetrato := 'bestiario/' || mestre || '/' || gen_random_uuid() || '.webp';
  pPista := 'mesas/' || mesa || '/' || gen_random_uuid() || '.webp';
  pPriv := 'mesas/' || mesa || '/' || gen_random_uuid() || '.jpg';
  pOutraMesa := 'mesas/' || mesa2 || '/' || gen_random_uuid() || '.webp';
  pFantasma := 'mesas/' || mesa || '/' || gen_random_uuid() || '.webp';

  -- ===== envio (INSERT em storage.objects) =====
  perform pg_temp.virar(mestre, false);
  insert into storage.objects (bucket_id, name, owner_id) values ('imagens', pRetrato, mestre::text), ('imagens', pPista, mestre::text), ('imagens', pPriv, mestre::text);
  ok_ := ok_ + 1;   -- mestre envia retrato (pasta dele) e pistas (pasta da mesa dele)
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'bestiario/' || outro || '/' || gen_random_uuid() || '.webp'); falhas := falhas || ' [mestre enviou na pasta de outro]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'mesas/' || mesa2 || '/' || gen_random_uuid() || '.webp'); falhas := falhas || ' [mestre enviou na mesa alheia]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'mesas/' || mesa || '/../x.webp'); falhas := falhas || ' [nome com ../ aceito]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'mesas/' || mesa || '/' || gen_random_uuid() || '.svg'); falhas := falhas || ' [svg aceito]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'solto.webp'); falhas := falhas || ' [arquivo fora das pastas aceito]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  perform pg_temp.virar(outro, false);
  insert into storage.objects (bucket_id, name, owner_id) values ('imagens', pOutraMesa, outro::text);

  perform pg_temp.virar(jog, true);
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'bestiario/' || jog || '/' || gen_random_uuid() || '.webp'); falhas := falhas || ' [anonimo enviou retrato]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into storage.objects (bucket_id, name) values ('imagens', 'mesas/' || mesa || '/' || gen_random_uuid() || '.webp'); falhas := falhas || ' [jogador enviou pista]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ===== leitura antes de qualquer sussurro =====
  select count(*) into n from storage.objects where bucket_id = 'imagens';
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [jogador viu ' || n || ' arquivos antes do sussurro]'; end if;
  perform pg_temp.virar(outro, false);
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name in (pRetrato, pPista, pPriv);
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [outro mestre viu arquivos do mestre]'; end if;
  perform pg_temp.virar(mestre, false);
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name in (pRetrato, pPista, pPriv, pOutraMesa);
  if n = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [mestre viu ' || n || '/3 dos seus]'; end if;

  -- ===== sussurrar com caminho =====
  s1 := public.sussurrar(mesa, null, 'Mapa', null, null, pPista);                 -- para todos, só imagem
  s2 := public.sussurrar(mesa, jog, 'Carta', 'Só para o Klein', null, pPriv);     -- privado
  select count(*) into n from public.sussurros where id = s1 and tem_imagem and imagem is null and imagem_caminho = pPista;
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [sussurro so com caminho nao gravou ou tem_imagem falso]'; end if;
  begin perform public.sussurrar(mesa, null, 'x', null, null, pFantasma); falhas := falhas || ' [caminho sem arquivo aceito]';
  exception when raise_exception then ok_ := ok_ + 1; end;
  begin perform public.sussurrar(mesa, null, 'x', null, null, pOutraMesa); falhas := falhas || ' [caminho de outra mesa aceito]';
  exception when check_violation then ok_ := ok_ + 1; end;
  begin perform public.sussurrar(mesa, null, 'x', null, 'data:image/webp;base64,AAAA', pPista); falhas := falhas || ' [base64 e caminho juntos aceitos]';
  exception when raise_exception then ok_ := ok_ + 1; end;
  -- a função antiga (5 argumentos, site antigo em aba aberta) continua mandando base64
  perform public.sussurrar(mesa, null, 'Antiga', null, 'data:image/webp;base64,AAAA');
  select count(*) into n from public.sussurros where mesa_id = mesa and titulo = 'Antiga' and tem_imagem and imagem_caminho is null;
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [sussurrar de 5 argumentos quebrou]'; end if;
  begin insert into public.sussurros (mesa_id, titulo, imagem, imagem_caminho) values (mesa, 'x', 'data:image/webp;base64,AAAA', pPista); falhas := falhas || ' [linha com as duas imagens]';
  exception when check_violation or insufficient_privilege then ok_ := ok_ + 1; end;

  -- ===== quem vê o quê depois dos sussurros =====
  perform pg_temp.virar(jog, true);
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name in (pPista, pPriv);
  if n = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [Klein viu ' || n || '/2 (para todos + privado)]'; end if;
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name = pRetrato;
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [Klein viu o retrato do bestiario]'; end if;
  begin perform public.sussurrar(mesa, null, 'golpe', null, null, pPista); falhas := falhas || ' [jogador sussurrou]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  b := privado.imagem_posso_gerir(pPista);
  if not b then ok_ := ok_ + 1; else falhas := falhas || ' [jogador pode apagar a pista]'; end if;

  perform pg_temp.virar(jog2, true);
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name in (pPista, pPriv);
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [Audrey viu ' || n || '/1 (so a para todos)]'; end if;

  perform pg_temp.virar(fora, true);
  select count(*) into n from storage.objects where bucket_id = 'imagens';
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [quem esta fora da mesa viu ' || n || ' arquivos]'; end if;

  perform pg_temp.virar(outro, false);
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name in (pPista, pPriv);
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [outro mestre viu as pistas]'; end if;
  b := privado.imagem_posso_gerir(pRetrato);
  if not b then ok_ := ok_ + 1; else falhas := falhas || ' [outro mestre pode apagar o retrato]'; end if;

  -- sussurro apagado: a pista deixa de ser legível pelo jogador
  perform pg_temp.virar(mestre, false);
  b := privado.imagem_posso_gerir(pPista) and privado.imagem_posso_gerir(pRetrato);
  if b then ok_ := ok_ + 1; else falhas := falhas || ' [mestre nao pode apagar os proprios arquivos]'; end if;
  delete from public.sussurros where id = s2;
  perform pg_temp.virar(jog, true);
  select count(*) into n from storage.objects where bucket_id = 'imagens' and name = pPriv;
  if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [pista de sussurro apagado continua legivel]'; end if;

  -- ===== bestiário com caminho =====
  perform pg_temp.virar(mestre, false);
  insert into public.bestiario (nome, imagem_caminho) values ('Lobo do Storage', pRetrato) returning id into besId;
  ok_ := ok_ + 1;
  update public.bestiario set imagem_caminho = null where id = besId; get diagnostics n = row_count;
  if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [dono nao atualizou imagem_caminho]'; end if;
  begin update public.bestiario set imagem_caminho = 'bestiario/' || outro || '/' || gen_random_uuid() || '.webp' where id = besId; falhas := falhas || ' [caminho na pasta de outro aceito]';
  exception when check_violation then ok_ := ok_ + 1; end;
  begin update public.bestiario set imagem_caminho = pPista where id = besId; falhas := falhas || ' [caminho de pista no bestiario aceito]';
  exception when check_violation then ok_ := ok_ + 1; end;
  begin update public.bestiario set imagem = 'data:image/webp;base64,AAAA', imagem_caminho = pRetrato where id = besId; falhas := falhas || ' [criatura com as duas imagens]';
  exception when check_violation then ok_ := ok_ + 1; end;

  execute 'reset role';
  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
