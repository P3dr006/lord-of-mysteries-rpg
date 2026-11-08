-- Fichas de NPC no bestiário: a mesma ficha reutilizável (chamar à cena, revelar, Duelo), agora com categoria
-- criatura/npc e os campos de uma pessoa: Caminho e Sequência, facção, relação com o grupo, onde encontrar,
-- personalidade, falas prontas e segredos em camadas (o mestre revela uma camada por vez).
-- Tudo continua só do dono (mesma política bestiario_do_dono); jogador anônimo não lê nem escreve.

alter table public.bestiario
  add column categoria text not null default 'criatura' check (categoria in ('criatura', 'npc')),
  -- id do Caminho (js/caminhos.js), não o nome: renomear um Caminho não quebra as fichas salvas
  add column caminho text check (caminho is null or caminho ~ '^[a-z]{2,20}$'),
  -- Sequência 9 (início) a 0 (topo); nulo = pessoa comum ou não se sabe
  add column sequencia int check (sequencia is null or sequencia between 0 and 9),
  add column faccao text check (faccao is null or char_length(faccao) <= 60),
  add column relacao text check (relacao is null or relacao in ('aliado', 'amigavel', 'neutro', 'desconfiado', 'hostil')),
  add column local text check (local is null or char_length(local) <= 120),
  add column personalidade text check (personalidade is null or char_length(personalidade) <= 600),
  -- frases prontas: lista de textos curtos
  add column falas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(falas) = 'array' and jsonb_array_length(falas) <= 10 and pg_column_size(falas) < 4000),
  -- camadas de segredo: [{ "texto": "...", "revelado": false }], na ordem em que o grupo deve descobrir
  add column segredos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(segredos) = 'array' and jsonb_array_length(segredos) <= 8 and pg_column_size(segredos) < 6000);

-- o dono só altera colunas listadas (as antigas continuam; dono, id e datas ficam de fora)
grant update (categoria, caminho, sequencia, faccao, relacao, local, personalidade, falas, segredos) on public.bestiario to authenticated;

create index if not exists bestiario_dono_categoria on public.bestiario (dono, categoria, nome);
