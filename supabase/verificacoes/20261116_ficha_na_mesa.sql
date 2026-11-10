-- Verificação da migração 20261116 (ficha montada na mesa) com papéis reais (authenticated). Transação SEMPRE desfeita.
-- Uso: node tools/migracao.js verificar supabase/migrations/20261116_ficha_na_mesa.sql supabase/verificacoes/20261116_ficha_na_mesa.sql
do $$
declare
  mestre uuid := gen_random_uuid(); jog uuid := gen_random_uuid(); jog2 uuid := gen_random_uuid(); jog3 uuid := gen_random_uuid(); fora uuid := gen_random_uuid();
  cod text; mid uuid; r jsonb; f jsonb; n int; t text; fm record; falhas text := ''; ok_ int := 0; lotm jsonb; regras1 jsonb; regras2 jsonb; k text; d jsonb;
  forjada jsonb := '{"v":2,"base":{"forca":12,"agil":15,"vigor":9,"intel":16,"espir":13,"pres":8},"caminhoId":"louco","racaId":"humano","seq":7,"mods":{"forca":30}}';
  convertida jsonb := '{"forca":14,"agil":10,"vigor":10,"intel":10,"espir":10,"pres":10}';
begin
  lotm := privado.regras_lotm();
  regras1 := lotm || jsonb_build_object('modificador', 'ATR - 10', 'atributos', (lotm -> 'atributos') || '[{"id":"sorte","nome":"Sorte","abrev":"SOR"}]'::jsonb);
  regras2 := lotm || '{"modificador":"ATR - 10"}';
  insert into auth.users (id, aud, role, email, is_anonymous, instance_id) values
    (mestre, 'authenticated', 'authenticated', 'm-' || mestre || '@teste.local', false, '00000000-0000-0000-0000-000000000000'),
    (jog,  'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog2, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (jog3, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
    (fora, 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

  -- ---------- 1) mesa como hoje (ficha do site): nada muda ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  execute 'set local role authenticated';
  cod := public.criar_mesa('Mesa da ficha');
  select id into mid from public.mesas where codigo = cod;
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Klein', forjada);
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f -> 'mods' ->> 'forca')::int = 1 and not f ? 'ficha_estado' then ok_ := ok_ + 1; else falhas := falhas || ' [mesa comum: ' || f || ']'; end if;
  begin perform public.rolar_ficha(mid); falhas := falhas || ' [rolou com a mesa desligada]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  r := public.estado_da_mesa(mid);
  if r = '{"terror":false,"ficha_na_mesa":false,"aprovar_fichas":false}'::jsonb then ok_ := ok_ + 1; else falhas := falhas || ' [estado: ' || r || ']'; end if;
  begin perform public.configurar_mesa(mid, true, false); falhas := falhas || ' [jogador configurou a mesa]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin perform privado.rolar_atributo('4d6-menor', 3, 18); falhas := falhas || ' [authenticated chamou rolar_atributo]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ---------- 2) o mestre liga: sem ficha da mesa, joga sem modificador ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.configurar_mesa(mid, true, false);
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if f -> 'mods' = '{}'::jsonb and f ->> 'ficha_estado' = 'sem' then ok_ := ok_ + 1; else falhas := falhas || ' [ligada sem ficha: ' || f || ']'; end if;
  r := public.rolar_secreto(mid, jog, 'Sem ficha', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [mod sem ficha: ' || r || ']'; end if;

  -- ---------- 3) o servidor rola; o jogador não rola de novo nem escreve na tabela ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  r := public.rolar_ficha(mid);
  n := 0;
  for k, d in select * from jsonb_each(r -> 'rolagens') loop
    if jsonb_array_length(d) = 4 and (r -> 'base' ->> k)::int = (select sum(x::int) - min(x::int) from jsonb_array_elements_text(d) x)
       and (r -> 'base' ->> k)::int between 3 and 18 then n := n + 1; end if;
  end loop;
  if n = 6 and (r ->> 'regras_versao')::int = 0 and r ->> 'metodo' = '4d6-menor' then ok_ := ok_ + 1; else falhas := falhas || ' [rolagem: ' || r || ']'; end if;
  select * into fm from public.fichas_mesa where mesa_id = mid and user_id = jog;
  if fm.estado = 'rolada' and fm.base = r -> 'base' and fm.rolagens_feitas = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [linha rolada]'; end if;
  begin perform public.rolar_ficha(mid); falhas := falhas || ' [rolou duas vezes]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin perform public.converter_ficha(mid, convertida, 'louco', 'humano'); falhas := falhas || ' [converteu depois de rolar]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin update public.fichas_mesa set base = '{"forca":18}' where mesa_id = mid and user_id = jog; falhas := falhas || ' [jogador mudou a base direto]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin insert into public.fichas_mesa (mesa_id, user_id, origem, estado) values (mid, jog3, 'servidor', 'aprovada'); falhas := falhas || ' [jogador inseriu ficha]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  begin perform public.julgar_ficha(mid, jog, true, ''); falhas := falhas || ' [jogador se aprovou]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  -- rolada ainda não vale; a base forjada mandada pelo navegador é jogada fora
  update public.jogadores set ficha = forjada where mesa_id = mid and user_id = jog;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if f -> 'base' = '{}'::jsonb and f -> 'mods' = '{}'::jsonb and f ->> 'ficha_estado' = 'rolada' then ok_ := ok_ + 1; else falhas := falhas || ' [rolada: ' || f || ']'; end if;
  begin perform public.enviar_ficha(mid, 'Louco!', 'humano'); falhas := falhas || ' [caminho invalido aceito]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;

  -- ---------- 4) enviar com aprovação desligada: vale na hora, com a base do servidor ----------
  t := public.enviar_ficha(mid, 'louco', 'humano');
  update public.jogadores set ficha = forjada || '{"caminhoId":"tirano"}' where mesa_id = mid and user_id = jog;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if t = 'aprovada' and f -> 'base' = fm.base and f ->> 'caminhoId' = 'louco' and f ->> 'ficha_estado' = 'aprovada' and (f -> 'mods') ? 'forca'
     and (f -> 'mods' ->> 'forca')::int = floor(((fm.base ->> 'forca')::int - 10) / 2.0)::int then ok_ := ok_ + 1;   -- humano e louco nao mexem em forca; seq 7 nao alcanca limite
  else falhas := falhas || ' [aprovada: ' || t || ' ' || f || ']'; end if;
  begin perform public.enviar_ficha(mid, 'louco', 'humano'); falhas := falhas || ' [enviou duas vezes]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ---------- 5) aprovação ligada + ficha convertida ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.configurar_mesa(mid, null, true);
  perform set_config('request.jwt.claims', json_build_object('sub', jog2, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  perform public.entrar_na_mesa(cod, 'Audrey', '{"seq":9}');
  begin perform public.converter_ficha(mid, '{"forca":14}', 'tirano', 'humano'); falhas := falhas || ' [converteu atributos que nao batem]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  begin perform public.converter_ficha(mid, convertida || '{"agil":19}', 'tirano', 'humano'); falhas := falhas || ' [converteu valor fora da regra]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  t := public.converter_ficha(mid, convertida || '{"extra":3}', 'tirano', 'humano');
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog2;
  select * into fm from public.fichas_mesa where mesa_id = mid and user_id = jog2;
  if t = 'pendente' and fm.origem = 'convertida' and fm.base = convertida and f -> 'mods' = '{}'::jsonb and f ->> 'ficha_estado' = 'pendente' then ok_ := ok_ + 1;
  else falhas := falhas || ' [convertida: ' || t || ' ' || f || ']'; end if;
  -- o jogador só lê a própria ficha; quem está fora não lê nenhuma
  select count(*) into n from public.fichas_mesa where mesa_id = mid; if n = 1 then ok_ := ok_ + 1; else falhas := falhas || ' [jogador leu ' || n || ' fichas]'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', fora, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select count(*) into n from public.fichas_mesa; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [intruso leu fichas]'; end if;
  begin perform public.rolar_ficha(mid); falhas := falhas || ' [intruso rolou]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;

  -- ---------- 6) o mestre aprova; rolagem de jog2 com a base convertida ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.fichas_mesa where mesa_id = mid; if n = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [mestre leu ' || n || ' fichas]'; end if;
  perform public.julgar_ficha(mid, jog2, true, 'Bem-vinda, Audrey.');
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog2;
  r := public.rolar_secreto(mid, jog2, 'Forca', 'forca', 20, 10);
  if f ->> 'ficha_estado' = 'aprovada' and (r ->> 'modificador')::int = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [aprovada: ' || f || ' ' || r || ']'; end if;
  begin perform public.julgar_ficha(mid, jog2, false, ''); falhas := falhas || ' [julgou duas vezes]';
  exception when others then ok_ := ok_ + 1; end;

  -- ---------- 7) cada ficha na sua versão; teste com atributo novo; migrar ----------
  insert into public.mesa_regras (mesa_id, regras) values (mid, regras1);
  r := public.rolar_secreto(mid, jog2, 'Forca na v0', 'forca', 20, 10);
  if (r ->> 'modificador')::int = 3 then ok_ := ok_ + 1; else falhas := falhas || ' [versao 0 mantida: ' || r || ']'; end if;
  perform public.pedir_teste(mid, jog2, 'Sorte', 'sorte', 20, 10); ok_ := ok_ + 1;
  begin perform public.pedir_teste(mid, jog2, 'Nada', 'xyz', 20, 10); falhas := falhas || ' [pediu atributo inexistente]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  begin perform public.rolar_secreto(mid, jog2, 'Nada', 'xyz', 20, 10); falhas := falhas || ' [rolou atributo inexistente]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  r := public.rolar_secreto(mid, jog2, 'Sorte', 'sorte', 20, 10);
  if (r ->> 'modificador')::int = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [sorte sem valor: ' || r || ']'; end if;
  begin perform public.migrar_ficha(mid, jog2); falhas := falhas || ' [migrou sem a sorte]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;
  insert into public.mesa_regras (mesa_id, regras) values (mid, regras2);
  n := public.migrar_ficha(mid, jog2);
  r := public.rolar_secreto(mid, jog2, 'Forca na v2', 'forca', 20, 10);
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog2;
  if n = 2 and (r ->> 'modificador')::int = 6 and (f ->> 'regras_versao')::int = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [migrada: ' || n || ' ' || r || ']'; end if;
  begin perform public.pedir_teste(mid, jog2, 'Sorte', 'sorte', 20, 10); falhas := falhas || ' [sorte saiu na v2 e ainda foi pedida]';
  exception when sqlstate '22023' then ok_ := ok_ + 1; end;

  -- ---------- 8) liberar nova rolagem; sair e voltar não rerrola ----------
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  delete from public.jogadores where mesa_id = mid and user_id = jog;
  perform public.entrar_na_mesa(cod, 'Klein', forjada);
  begin perform public.rolar_ficha(mid); falhas := falhas || ' [rerrolou saindo e voltando]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if f ->> 'ficha_estado' = 'aprovada' then ok_ := ok_ + 1; else falhas := falhas || ' [voltou sem ficha: ' || f || ']'; end if;
  begin perform public.liberar_ficha(mid, jog); falhas := falhas || ' [jogador se liberou]';
  exception when insufficient_privilege then ok_ := ok_ + 1; end;
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.liberar_ficha(mid, jog);
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  r := public.rolar_ficha(mid);
  select * into fm from public.fichas_mesa where mesa_id = mid and user_id = jog;
  if fm.rolagens_feitas = 2 and fm.estado = 'rolada' and not fm.liberada and fm.regras_versao = 2 then ok_ := ok_ + 1; else falhas := falhas || ' [liberada: ' || fm.rolagens_feitas || fm.estado || ']'; end if;
  t := public.enviar_ficha(mid, 'louco', '');
  if t = 'pendente' then ok_ := ok_ + 1; else falhas := falhas || ' [aprovacao ligada: ' || t || ']'; end if;
  -- recusada libera nova rolagem
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.julgar_ficha(mid, jog, false, 'Refaça, por favor.');
  perform set_config('request.jwt.claims', json_build_object('sub', jog, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select * into fm from public.fichas_mesa where mesa_id = mid and user_id = jog;
  if fm.estado = 'recusada' and fm.resposta = 'Refaça, por favor.' then ok_ := ok_ + 1; else falhas := falhas || ' [recusa]'; end if;
  perform public.rolar_ficha(mid); ok_ := ok_ + 1;
  r := public.estado_da_mesa(mid);
  if r ->> 'ficha_na_mesa' = 'true' and r ->> 'aprovar_fichas' = 'true' then ok_ := ok_ + 1; else falhas := falhas || ' [estado ligado: ' || r || ']'; end if;

  -- ---------- 9) desligar volta à ficha do site ----------
  perform set_config('request.jwt.claims', json_build_object('sub', mestre, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.configurar_mesa(mid, false, false);
  select ficha into f from public.jogadores where mesa_id = mid and user_id = jog;
  if (f -> 'base' ->> 'forca')::int = 12 and not f ? 'ficha_estado' and (f -> 'mods' ->> 'forca')::int = 2 then ok_ := ok_ + 1;   -- v2: ATR - 10
  else falhas := falhas || ' [desligada: ' || f || ']'; end if;
  delete from public.mesas where id = mid;
  execute 'reset role';
  select count(*) into n from public.fichas_mesa where mesa_id = mid; if n = 0 then ok_ := ok_ + 1; else falhas := falhas || ' [fichas sobraram]'; end if;
  -- o check novo de pedidos.atributo
  begin insert into public.pedidos (mesa_id, para, tipo, rotulo, atributo) values (gen_random_uuid(), jog, 'aberto', 'x', 'Força'); falhas := falhas || ' [check aceitou Força]';
  exception when check_violation then ok_ := ok_ + 1; end;

  if falhas = '' then raise exception 'RESULTADO: OK (% verificacoes passaram)', ok_;
  else raise exception 'RESULTADO: FALHA (% ok) %', ok_, falhas; end if;
end $$;
