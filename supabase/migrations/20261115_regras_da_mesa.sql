-- Regras da mesa (Fase A de docs/SISTEMAS-DA-MESA.md): motor de regras em JSON + intérprete de fórmulas SEM eval.
-- Fecha a brecha do "mods": antes, privado.mod_da_ficha confiava em ficha.mods (mandado pelo navegador, só limitado a ±30).
-- Agora o servidor calcula total, modificador e máximos a partir de ficha.base (os dados rolados, 3 a 18), do Caminho,
-- da Raça e da Sequência, com as regras da mesa. Mesa sem regras = predefinição "lotm" (idêntica ao site de hoje).
-- O mesmo intérprete existe em js/regras.js (mesma gramática, mesmas mensagens, mesmas posições de erro).
-- privado.mod_da_ficha continua existindo só para as figuras do mestre (figuras.mods é escrito pelo mestre, não pelo jogador).

-- =====================================================================================================
-- intérprete de fórmulas: números inteiros, + - * /, parênteses, NdM, nomes (atributos, SEQ, NIVEL, ATR),
-- mod/min/max/floor. Erro = exceção 22023 "Fórmula inválida na posição N: motivo" (posição conta de 1).
-- =====================================================================================================
create function privado.formula_erro(p int, motivo text) returns void
language plpgsql immutable set search_path = '' as $$
begin raise exception 'Fórmula inválida na posição %: %', p, motivo using errcode = '22023'; end $$;

create function privado.formula_tokens(s text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare t jsonb := '[]'::jsonb; i int := 1; n int; c text; j int; k int; num text; lados text;
begin
  if s is null or s !~ '[^ \t]' then perform privado.formula_erro(1, 'a fórmula está vazia'); end if;
  n := char_length(s);
  if n > 200 then perform privado.formula_erro(201, 'fórmula longa demais (máximo 200 caracteres)'); end if;
  while i <= n loop
    c := substr(s, i, 1);
    if c = ' ' or c = E'\t' then i := i + 1; continue; end if;
    if c ~ '^[0-9]$' or (c in ('d', 'D') and substr(s, i + 1, 1) ~ '^[0-9]$') then
      j := i; while j <= n and substr(s, j, 1) ~ '^[0-9]$' loop j := j + 1; end loop;
      num := substr(s, i, j - i);
      if substr(s, j, 1) in ('d', 'D') then
        k := j + 1; while k <= n and substr(s, k, 1) ~ '^[0-9]$' loop k := k + 1; end loop;
        lados := substr(s, j + 1, k - j - 1);
        if lados = '' then perform privado.formula_erro(j + 1, 'faltou o número de lados do dado'); end if;
        if char_length(num) > 3 or (num <> '' and (num::int < 1 or num::int > 100)) then perform privado.formula_erro(i, 'dado com quantidade fora de 1 a 100'); end if;
        if char_length(lados) > 4 or lados::int < 2 or lados::int > 1000 then perform privado.formula_erro(j + 1, 'dado com lados fora de 2 a 1000'); end if;
        if substr(s, k, 1) ~ '^[A-Za-z_]$' then perform privado.formula_erro(k, 'faltou um operador'); end if;
        t := t || jsonb_build_array(jsonb_build_object('t', 'd', 'n', case when num = '' then 1 else num::int end, 'm', lados::int, 'p', i));
        i := k; continue;
      end if;
      if char_length(num) > 6 then perform privado.formula_erro(i, 'número grande demais (máximo 6 algarismos)'); end if;
      if substr(s, j, 1) ~ '^[A-Za-z_]$' then perform privado.formula_erro(j, 'faltou um operador'); end if;
      t := t || jsonb_build_array(jsonb_build_object('t', 'n', 'v', num::int, 'p', i));
      i := j; continue;
    end if;
    if c ~ '^[A-Za-z_]$' then
      j := i; while j <= n and substr(s, j, 1) ~ '^[A-Za-z_]$' loop j := j + 1; end loop;
      if j - i > 20 then perform privado.formula_erro(i, 'nome longo demais'); end if;
      t := t || jsonb_build_array(jsonb_build_object('t', 'id', 'v', upper(substr(s, i, j - i)), 'p', i));
      i := j; continue;
    end if;
    if strpos('+-*/(),', c) > 0 then t := t || jsonb_build_array(jsonb_build_object('t', 'op', 'v', c, 'p', i)); i := i + 1; continue; end if;
    perform privado.formula_erro(i, format('símbolo não permitido: "%s"', c));
  end loop;
  return t || jsonb_build_array(jsonb_build_object('t', 'fim', 'p', n + 1));
end $$;

-- ctx: { nomes: [...], vars: {NOME: número}, modf: fórmula do modificador ou null (mod() proibido), dados: bool, validar: bool }
-- Cada nível lê a partir do token i e devolve o valor (null = falta valor ou divisão por zero) e o próximo token j.
create function privado.fx_eh(tk jsonb, i int, op text) returns boolean
language sql immutable set search_path = '' as $$ select tk -> i ->> 't' = 'op' and tk -> i ->> 'v' = op $$;

create function privado.fx_expr(tk jsonb, i int, ctx jsonb, prof int, out v numeric, out j int)
language plpgsql volatile set search_path = '' as $$
declare r record; op text;
begin
  select * into r from privado.fx_termo(tk, i, ctx, prof); v := r.v; j := r.j;
  while privado.fx_eh(tk, j, '+') or privado.fx_eh(tk, j, '-') loop
    op := tk -> j ->> 'v';
    select * into r from privado.fx_termo(tk, j + 1, ctx, prof);
    v := case when op = '+' then v + r.v else v - r.v end; j := r.j;
  end loop;
end $$;

create function privado.fx_termo(tk jsonb, i int, ctx jsonb, prof int, out v numeric, out j int)
language plpgsql volatile set search_path = '' as $$
declare r record; op text;
begin
  select * into r from privado.fx_unario(tk, i, ctx, prof); v := r.v; j := r.j;
  while privado.fx_eh(tk, j, '*') or privado.fx_eh(tk, j, '/') loop
    op := tk -> j ->> 'v';
    select * into r from privado.fx_unario(tk, j + 1, ctx, prof);
    if op = '*' then v := v * r.v;
    elsif r.v = 0 then v := case when (ctx ->> 'validar')::boolean then 0 end;
    else v := v / r.v; end if;
    j := r.j;
  end loop;
end $$;

create function privado.fx_unario(tk jsonb, i int, ctx jsonb, prof int, out v numeric, out j int)
language plpgsql volatile set search_path = '' as $$
declare r record;
begin
  if privado.fx_eh(tk, i, '-') then
    if prof >= 20 then perform privado.formula_erro((tk -> i ->> 'p')::int, 'aninhamento fundo demais (máximo 20)'); end if;
    select * into r from privado.fx_unario(tk, i + 1, ctx, prof + 1); v := -r.v; j := r.j; return;
  end if;
  select * into r from privado.fx_primario(tk, i, ctx, prof); v := r.v; j := r.j;
end $$;

create function privado.fx_primario(tk jsonb, i int, ctx jsonb, prof int, out v numeric, out j int)
language plpgsql volatile set search_path = '' as $$
declare k jsonb := tk -> i; p int := (tk -> i ->> 'p')::int; nome text; r record; args numeric[] := '{}'; mn int; mx int; q int;
begin
  if k ->> 't' = 'n' then v := (k ->> 'v')::numeric; j := i + 1; return; end if;
  if k ->> 't' = 'd' then
    if not coalesce((ctx ->> 'dados')::boolean, false) then perform privado.formula_erro(p, 'dados não são permitidos aqui'); end if;
    if (ctx ->> 'validar')::boolean then v := (k ->> 'n')::numeric;
    else v := 0; for q in 1 .. (k ->> 'n')::int loop v := v + 1 + floor(random() * (k ->> 'm')::int); end loop; end if;
    j := i + 1; return;
  end if;
  if privado.fx_eh(tk, i, '(') then
    if prof >= 20 then perform privado.formula_erro(p, 'aninhamento fundo demais (máximo 20)'); end if;
    select * into r from privado.fx_expr(tk, i + 1, ctx, prof + 1);
    if not privado.fx_eh(tk, r.j, ')') then perform privado.formula_erro((tk -> r.j ->> 'p')::int, 'faltou fechar o parêntese'); end if;
    v := r.v; j := r.j + 1; return;
  end if;
  if k ->> 't' = 'id' then
    nome := k ->> 'v';
    if privado.fx_eh(tk, i + 1, '(') then
      if nome not in ('MOD', 'FLOOR', 'MIN', 'MAX') then perform privado.formula_erro(p, 'função desconhecida: ' || lower(nome)); end if;
      if nome = 'MOD' and ctx ->> 'modf' is null then perform privado.formula_erro(p, 'mod() não é permitido aqui'); end if;
      if prof >= 20 then perform privado.formula_erro(p, 'aninhamento fundo demais (máximo 20)'); end if;
      select * into r from privado.fx_expr(tk, i + 2, ctx, prof + 1); args := args || r.v; j := r.j;
      while privado.fx_eh(tk, j, ',') loop select * into r from privado.fx_expr(tk, j + 1, ctx, prof + 1); args := args || r.v; j := r.j; end loop;
      if not privado.fx_eh(tk, j, ')') then perform privado.formula_erro((tk -> j ->> 'p')::int, 'esperava , ou )'); end if;
      j := j + 1;
      if nome in ('MOD', 'FLOOR') then mn := 1; mx := 1; else mn := 2; mx := 10; end if;
      if cardinality(args) < mn or cardinality(args) > mx then
        perform privado.formula_erro(p, lower(nome) || case when mn = mx then '() recebe 1 valor' else '() recebe de 2 a 10 valores' end);
      end if;
      if array_position(args, null) is not null then v := null; return; end if;
      if nome = 'FLOOR' then v := floor(round(args[1], 6));
      elsif nome = 'MIN' then v := (select min(x) from unnest(args) x);
      elsif nome = 'MAX' then v := (select max(x) from unnest(args) x);
      else v := privado.formula(ctx ->> 'modf', jsonb_build_object('nomes', jsonb_build_array('ATR'), 'vars', jsonb_build_object('ATR', args[1]), 'dados', false, 'validar', ctx -> 'validar'));
      end if;
      return;
    end if;
    if not coalesce(ctx -> 'nomes' ? nome, false) then perform privado.formula_erro(p, 'nome desconhecido: ' || nome); end if;
    v := case when jsonb_typeof(ctx -> 'vars' -> nome) = 'number' then (ctx -> 'vars' ->> nome)::numeric end; j := i + 1; return;
  end if;
  if k ->> 't' = 'fim' then perform privado.formula_erro(p, 'a fórmula terminou antes da hora'); end if;
  perform privado.formula_erro(p, 'esperava um número, um nome ou (');
end $$;

-- valor final: arredonda para baixo (depois de 6 casas, como o JS) e fica entre -9999 e 9999; null se faltou valor
create function privado.formula(p_texto text, ctx jsonb) returns numeric
language plpgsql volatile set search_path = '' as $$
declare tk jsonb := privado.formula_tokens(p_texto); r record;
begin
  if jsonb_array_length(tk) = 1 then perform privado.formula_erro(1, 'a fórmula está vazia'); end if;
  select * into r from privado.fx_expr(tk, 0, ctx, 0);
  if tk -> r.j ->> 't' <> 'fim' then perform privado.formula_erro((tk -> r.j ->> 'p')::int, 'esperava + - * / ou o fim'); end if;
  if r.v is null then return null; end if;
  return greatest(-9999, least(9999, floor(round(r.v, 6))));
end $$;

-- =====================================================================================================
-- predefinição "lotm" (gerada de js/regras.js; tests/mestre.js confere que é o MESMO JSON)
-- =====================================================================================================
create function privado.regras_lotm() returns jsonb
language sql immutable set search_path = '' as $$ select '{"versao":1,"base":"lotm","atributos":[{"id":"forca","nome":"Força","abrev":"FOR"},{"id":"agil","nome":"Agilidade","abrev":"AGI"},{"id":"vigor","nome":"Vigor","abrev":"VIG"},{"id":"intel","nome":"Intelecto","abrev":"INT"},{"id":"espir","nome":"Espiritualidade","abrev":"ESP"},{"id":"pres","nome":"Presença","abrev":"PRE"}],"geracao":{"metodo":"4d6-menor","min":3,"max":18},"total":"max(1, ATR)","modificador":"floor((ATR - 10) / 2)","bonus":{"caminho":{"valor":2,"atributo":{"louco":"espir","erro":"agil","porta":"intel","visionario":"pres","sol":"pres","tirano":"forca","torre":"intel","enforcado":"espir","escuridao":"agil","morte":"vigor","gigante":"forca","demonessa":"agil","sacerdote":"vigor","eremita":"intel","paragono":"intel","roda":"espir","mae":"vigor","lua":"espir","abismo":"forca","acorrentado":"vigor","imperador":"pres","justiceiro":"pres"}},"raca":{"humano":{"intel":1,"pres":1,"vigor":1},"mutante":{"vigor":2,"forca":1,"pres":-1},"gigante":{"forca":3,"vigor":1,"agil":-2},"elfo":{"agil":2,"espir":1,"forca":-1},"sanguineo":{"vigor":2,"pres":1,"espir":-1},"lobo":{"agil":2,"intel":1,"pres":-1},"dragao":{"forca":2,"intel":2,"espir":1,"pres":-2},"fenix":{"espir":2,"agil":1,"vigor":-1},"diabo":{"pres":2,"forca":1,"espir":-1},"sereia":{"espir":2,"pres":1,"forca":-1},"peixe":{"agil":1,"vigor":1,"pres":-1},"banshee":{"espir":2,"pres":1,"vigor":-2},"fohan":{"agil":2,"vigor":1,"intel":-1}},"sequencia":{"principal":[6,3,1],"todos":[4,2,0]}},"recursos":[{"id":"pv","nome":"Pontos de Vida","max":"10 + mod(VIG) * 2 + (9 - SEQ) * 3","cor":"#e05a6a"},{"id":"san","nome":"Sanidade","max":"10 + mod(PRE) * 2 + 5","cor":"#6fb4ff"},{"id":"esp","nome":"Espiritualidade","max":"10 + mod(ESP) * 2 + (9 - SEQ) * 2","cor":"#b08cff"}],"progressao":{"tipo":"sequencia","de":9,"ate":0},"classes":[],"habilidades":"livres"}'::jsonb $$;

-- =====================================================================================================
-- validação das regras (mesma ordem de js/regras.js validar(): o primeiro erro de lá é o erro daqui)
-- =====================================================================================================
create function privado.fx_inteiro(x jsonb) returns boolean
language sql immutable set search_path = '' as $$ select jsonb_typeof(x) = 'number' and x::text ~ '^-?[0-9]{1,9}$' $$;

create function privado.validar_regras(R jsonb) returns void
language plpgsql volatile set search_path = '' as $$
declare a jsonb; k int := 0; ids text[] := '{}'; abrevs text[] := '{}'; rids text[] := '{}'; campo text; e jsonb; v jsonb; x jsonb;
  ctx_atr jsonb := '{"nomes":["ATR"],"vars":{"ATR":10},"dados":false,"validar":true}'::jsonb; ctx_r jsonb; g jsonb := R -> 'geracao';
  reservados text[] := array['ATR', 'SEQ', 'NIVEL', 'MOD', 'MIN', 'MAX', 'FLOOR'];
begin
  if jsonb_typeof(R) is distinct from 'object' or jsonb_typeof(R -> 'atributos') is distinct from 'array'
     or jsonb_array_length(R -> 'atributos') not between 1 and 12 then
    raise exception 'Regras inválidas (atributos): de 1 a 12 atributos' using errcode = '22023';
  end if;
  for a in select * from jsonb_array_elements(R -> 'atributos') loop
    if jsonb_typeof(a -> 'id') is distinct from 'string' or a ->> 'id' !~ '^[a-z_]{1,12}$' or a ->> 'id' = any(ids) then
      raise exception 'Regras inválidas (atributos[%].id): id: de 1 a 12 letras minúsculas, sem repetir', k using errcode = '22023'; end if;
    if jsonb_typeof(a -> 'abrev') is distinct from 'string' or a ->> 'abrev' !~ '^[A-Z]{2,4}$' or a ->> 'abrev' = any(abrevs) or a ->> 'abrev' = any(reservados) then
      raise exception 'Regras inválidas (atributos[%].abrev): abreviação: de 2 a 4 letras maiúsculas, sem repetir nem usar nome reservado', k using errcode = '22023'; end if;
    if jsonb_typeof(a -> 'nome') is distinct from 'string' or char_length(a ->> 'nome') not between 1 and 30 then
      raise exception 'Regras inválidas (atributos[%].nome): nome: de 1 a 30 letras', k using errcode = '22023'; end if;
    ids := ids || (a ->> 'id'); abrevs := abrevs || (a ->> 'abrev'); k := k + 1;
  end loop;
  if not (privado.fx_inteiro(g -> 'min') and privado.fx_inteiro(g -> 'max')) or (g ->> 'min')::int < 1 or (g ->> 'max')::int > 100 or (g ->> 'min')::int > (g ->> 'max')::int then
    raise exception 'Regras inválidas (geracao): min e max inteiros de 1 a 100 (min <= max)' using errcode = '22023'; end if;
  begin
    campo := 'modificador'; perform privado.formula(case when jsonb_typeof(R -> 'modificador') = 'string' then R ->> 'modificador' end, ctx_atr);
    if R -> 'total' is not null and jsonb_typeof(R -> 'total') <> 'null' then
      campo := 'total'; perform privado.formula(case when jsonb_typeof(R -> 'total') = 'string' then R ->> 'total' end, ctx_atr);
    end if;
  exception when sqlstate '22023' then raise exception 'Regras inválidas (%): %', campo, sqlerrm using errcode = '22023';
  end;
  -- bônus (opcionais)
  e := R -> 'bonus' -> 'caminho';
  if e is not null and jsonb_typeof(e) <> 'null' and (not privado.fx_inteiro(e -> 'valor') or (e ->> 'valor')::int not between -10 and 10
     or (jsonb_typeof(e -> 'atributo') = 'object' and exists (select 1 from jsonb_each(e -> 'atributo') w where not (w.value #>> '{}' = any(ids) and jsonb_typeof(w.value) = 'string')))) then
    raise exception 'Regras inválidas (bonus.caminho): valor de -10 a 10 e atributos que existem' using errcode = '22023'; end if;
  e := R -> 'bonus' -> 'raca';
  if jsonb_typeof(e) = 'object' and exists (select 1 from jsonb_each(e) r, jsonb_each(case when jsonb_typeof(r.value) = 'object' then r.value else '{}'::jsonb end) b
     where not (b.key = any(ids) and privado.fx_inteiro(b.value) and (b.value::text)::int between -10 and 10)) then
    raise exception 'Regras inválidas (bonus.raca): bônus de -10 a 10 em atributos que existem' using errcode = '22023'; end if;
  e := R -> 'bonus' -> 'sequencia';
  if e is not null and jsonb_typeof(e) <> 'null' then
    foreach campo in array array['principal', 'todos'] loop
      x := e -> campo;
      if x is not null and jsonb_typeof(x) <> 'null' and (jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 10
         or exists (select 1 from jsonb_array_elements(x) w where not (privado.fx_inteiro(w) and (w::text)::int between 0 and 9))) then
        raise exception 'Regras inválidas (bonus.sequencia): listas de até 10 limites de 0 a 9' using errcode = '22023'; end if;
    end loop;
  end if;
  -- recursos (opcionais): max é fórmula com os atributos, SEQ, NIVEL e mod()
  if R -> 'recursos' is not null and jsonb_typeof(R -> 'recursos') <> 'null' then
    if jsonb_typeof(R -> 'recursos') <> 'array' or jsonb_array_length(R -> 'recursos') > 12 then
      raise exception 'Regras inválidas (recursos): até 12 recursos' using errcode = '22023'; end if;
    ctx_r := jsonb_build_object('nomes', to_jsonb(abrevs || array['SEQ', 'NIVEL']), 'vars', (select jsonb_object_agg(x2, 10) from unnest(abrevs) x2) || '{"SEQ":9,"NIVEL":1}'::jsonb,
                                'modf', R ->> 'modificador', 'dados', false, 'validar', true);
    k := 0;
    for v in select * from jsonb_array_elements(R -> 'recursos') loop
      if jsonb_typeof(v -> 'id') is distinct from 'string' or v ->> 'id' !~ '^[a-z_]{1,12}$' or v ->> 'id' = any(rids) then
        raise exception 'Regras inválidas (recursos[%].id): id: de 1 a 12 letras minúsculas, sem repetir', k using errcode = '22023'; end if;
      rids := rids || (v ->> 'id');
      begin perform privado.formula(case when jsonb_typeof(v -> 'max') = 'string' then v ->> 'max' end, ctx_r);
      exception when sqlstate '22023' then raise exception 'Regras inválidas (recursos[%].max): %', k, sqlerrm using errcode = '22023';
      end;
      k := k + 1;
    end loop;
  end if;
end $$;

-- =====================================================================================================
-- tabela das regras: uma linha por versão (mudar = versão nova; nada é sobrescrito)
-- =====================================================================================================
create table public.mesa_regras (
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  versao int not null check (versao between 1 and 1000),
  regras jsonb not null check (jsonb_typeof(regras) = 'object' and pg_column_size(regras) < 32000),
  criado_em timestamptz not null default now(),
  primary key (mesa_id, versao)
);
alter table public.mesa_regras enable row level security;
revoke all on public.mesa_regras from anon, authenticated;
grant select on public.mesa_regras to authenticated;
grant insert (mesa_id, regras) on public.mesa_regras to authenticated;
create policy mesa_regras_le on public.mesa_regras for select to authenticated
  using (privado.sou_mestre(mesa_id) or privado.estou_na_mesa(mesa_id));
create policy mesa_regras_mestre_cria on public.mesa_regras for insert to authenticated
  with check (privado.sou_mestre(mesa_id));

-- a versão é dada pelo servidor (a próxima), no máximo 100 por mesa, e as regras são validadas antes de entrar
create function privado.nova_versao_regras() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('mesa_regras:' || new.mesa_id));
  select coalesce(max(versao), 0) + 1 into new.versao from public.mesa_regras where mesa_id = new.mesa_id;
  if new.versao > 100 then raise exception 'No máximo 100 versões de regras por mesa.'; end if;
  perform privado.validar_regras(new.regras);
  new.criado_em := now();
  return new;
end $$;
revoke all on function privado.nova_versao_regras() from public, anon, authenticated;
create trigger mesa_regras_versao before insert on public.mesa_regras for each row execute function privado.nova_versao_regras();

-- as regras em vigor na mesa (a versão mais nova) ou a predefinição lotm
create function privado.regras_da_mesa(p_mesa uuid, out regras jsonb, out versao int)
language plpgsql stable security definer set search_path = '' as $$
begin
  select r.regras, r.versao into regras, versao from public.mesa_regras r where r.mesa_id = p_mesa order by r.versao desc limit 1;
  if regras is null then regras := privado.regras_lotm(); versao := 0; end if;
end $$;

-- =====================================================================================================
-- a ficha calculada pelo servidor (o mesmo que js/regras.js calcular())
-- =====================================================================================================
create function privado.total_do_atributo(R jsonb, f jsonb, attr text) returns int
language plpgsql volatile set search_path = '' as $$
declare b jsonb := f -> 'base' -> attr; mn int := coalesce((R -> 'geracao' ->> 'min')::int, 3); mx int := coalesce((R -> 'geracao' ->> 'max')::int, 18);
  s int := case when jsonb_typeof(f -> 'seq') = 'number' and f ->> 'seq' ~ '^[0-9]$' then (f ->> 'seq')::int else 9 end;
  cam jsonb := R -> 'bonus' -> 'caminho'; sq jsonb := R -> 'bonus' -> 'sequencia'; rb jsonb; principal boolean; bonus int := 0;
begin
  if jsonb_typeof(f -> 'base') is distinct from 'object' or not privado.fx_inteiro(b) or (b::text)::int not between mn and mx then return null; end if;
  principal := jsonb_typeof(f -> 'caminhoId') = 'string' and jsonb_typeof(cam -> 'atributo') = 'object' and cam -> 'atributo' ->> (f ->> 'caminhoId') = attr;
  if principal and privado.fx_inteiro(cam -> 'valor') then bonus := bonus + (cam ->> 'valor')::int; end if;
  if jsonb_typeof(f -> 'racaId') = 'string' and jsonb_typeof(R -> 'bonus' -> 'raca') = 'object' then
    rb := R -> 'bonus' -> 'raca' -> (f ->> 'racaId');
    if jsonb_typeof(rb) = 'object' and privado.fx_inteiro(rb -> attr) then bonus := bonus + (rb ->> attr)::int; end if;
  end if;
  if jsonb_typeof(sq -> 'todos') = 'array' then
    bonus := bonus + (select count(*) from jsonb_array_elements(sq -> 'todos') w where privado.fx_inteiro(w) and s <= (w::text)::int)::int;
  end if;
  if principal and jsonb_typeof(sq -> 'principal') = 'array' then
    bonus := bonus + (select count(*) from jsonb_array_elements(sq -> 'principal') w where privado.fx_inteiro(w) and s <= (w::text)::int)::int;
  end if;
  if coalesce(R ->> 'total', '') = '' then return (b::text)::int + bonus; end if;
  return privado.formula(R ->> 'total', jsonb_build_object('nomes', jsonb_build_array('ATR'), 'vars', jsonb_build_object('ATR', (b::text)::int + bonus), 'dados', false, 'validar', false))::int;
end $$;

create function privado.mod_do_total(R jsonb, t int) returns int
language sql volatile set search_path = '' as $$
  select case when t is null then null else greatest(-30, least(30, privado.formula(R ->> 'modificador',
    jsonb_build_object('nomes', jsonb_build_array('ATR'), 'vars', jsonb_build_object('ATR', t), 'dados', false, 'validar', false))::int)) end;
$$;

-- { attrs: {id: total}, mods: {id: mod}, maximos: {recurso: max|null} }; atributo não rolado não aparece
create function privado.calcular_ficha(R jsonb, f jsonb) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare a jsonb; t int; attrs jsonb := '{}'; mods jsonb := '{}'; maximos jsonb := '{}'; nomes jsonb := '["SEQ","NIVEL"]'; vars jsonb; rc jsonb;
begin
  vars := jsonb_build_object('SEQ', case when jsonb_typeof(f -> 'seq') = 'number' and f ->> 'seq' ~ '^[0-9]$' then (f ->> 'seq')::int else 9 end,
                             'NIVEL', case when jsonb_typeof(f -> 'nivel') = 'number' and f ->> 'nivel' ~ '^([1-9]|1[0-9]|20)$' then (f ->> 'nivel')::int else 1 end);
  for a in select * from jsonb_array_elements(R -> 'atributos') loop
    nomes := nomes || to_jsonb(a ->> 'abrev');
    t := privado.total_do_atributo(R, f, a ->> 'id');
    if t is null then continue; end if;
    attrs := attrs || jsonb_build_object(a ->> 'id', t);
    mods := mods || jsonb_build_object(a ->> 'id', privado.mod_do_total(R, t));
    vars := vars || jsonb_build_object(a ->> 'abrev', t);
  end loop;
  for rc in select * from jsonb_array_elements(coalesce(R -> 'recursos', '[]')) loop
    maximos := maximos || jsonb_build_object(rc ->> 'id', privado.formula(rc ->> 'max',
      jsonb_build_object('nomes', nomes, 'vars', vars, 'modf', R ->> 'modificador', 'dados', false, 'validar', false))::int);
  end loop;
  return jsonb_build_object('attrs', attrs, 'mods', mods, 'maximos', maximos);
end $$;

-- o modificador que vale na rolagem: só da base + regras (0 se não rolado ou se algo der errado, como antes)
create function privado.mod_calculado(p_mesa uuid, f jsonb, attr text) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare R jsonb;
begin
  if attr is null or attr = '' or jsonb_typeof(f) is distinct from 'object' then return 0; end if;
  R := (privado.regras_da_mesa(p_mesa)).regras;
  return coalesce(privado.mod_do_total(R, privado.total_do_atributo(R, f, attr)), 0);
exception when others then return 0;
end $$;

-- modificador do jogador = calculado + bênçãos e maldições (inclusive as secretas); mesma assinatura de antes,
-- então responder_pedido, rolar_secreto, a Roda (entrada_da_roda) e o Duelo (lado_do_duelo) passam a usar o cálculo sem mudar
create or replace function privado.mod_do_jogador(p_mesa uuid, p_user uuid, f jsonb, attr text) returns int
language sql stable set search_path = '' as $$
  select case when attr is null or attr = '' then 0 else
    greatest(-30, least(30, privado.mod_calculado(p_mesa, f, attr) + coalesce((select sum(e.valor)::int from public.efeitos e
      where e.mesa_id = p_mesa and e.user_id = p_user and e.tipo in ('bencao', 'maldicao') and e.atributo = attr), 0))) end;
$$;
-- o que o jogador enxerga: calculado + só os efeitos avisados
create or replace function privado.mod_visivel(p_mesa uuid, p_user uuid, f jsonb, attr text) returns int
language sql stable set search_path = '' as $$
  select case when attr is null or attr = '' then 0 else
    greatest(-30, least(30, privado.mod_calculado(p_mesa, f, attr) + coalesce((select sum(e.valor)::int from public.efeitos e
      where e.mesa_id = p_mesa and e.user_id = p_user and e.tipo in ('bencao', 'maldicao') and e.atributo = attr and not e.secreto), 0))) end;
$$;

-- ao gravar a ficha, mods/attrs/máximos são REESCRITOS pelo servidor: o mestre vê o número verdadeiro, não o mandado
create function privado.ficha_do_servidor() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rg record; c jsonb;
begin
  if jsonb_typeof(new.ficha) is distinct from 'object' then return new; end if;
  begin
    select * into rg from privado.regras_da_mesa(new.mesa_id);
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
revoke all on function privado.ficha_do_servidor() from public, anon, authenticated;
create trigger jogadores_ficha_do_servidor before insert or update of ficha on public.jogadores
  for each row execute function privado.ficha_do_servidor();

revoke all on function privado.formula_erro(int, text), privado.formula_tokens(text), privado.fx_eh(jsonb, int, text),
  privado.fx_expr(jsonb, int, jsonb, int), privado.fx_termo(jsonb, int, jsonb, int), privado.fx_unario(jsonb, int, jsonb, int),
  privado.fx_primario(jsonb, int, jsonb, int), privado.formula(text, jsonb), privado.regras_lotm(), privado.fx_inteiro(jsonb),
  privado.validar_regras(jsonb), privado.regras_da_mesa(uuid), privado.total_do_atributo(jsonb, jsonb, text),
  privado.mod_do_total(jsonb, int), privado.calcular_ficha(jsonb, jsonb), privado.mod_calculado(uuid, jsonb, text) from public, anon, authenticated;

-- fichas que já estão nas mesas: recalcula agora (as antigas, sem "base", ficam sem modificadores até o jogador reenviar)
update public.jogadores set ficha = ficha;
