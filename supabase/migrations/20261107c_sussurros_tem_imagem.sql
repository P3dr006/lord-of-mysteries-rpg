-- A lista do mestre mostra "pista com imagem" sem baixar a imagem de cada sussurro.
alter table public.sussurros add column tem_imagem boolean generated always as (imagem is not null) stored;
