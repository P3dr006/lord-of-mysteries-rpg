#!/usr/bin/env node
// Move as imagens antigas (base64 dentro das linhas) para o Storage (bucket "imagens"). Rodar DEPOIS da migração 20261114.
//
//   node tools/migrar-imagens.js            ensaio: só lê, mostra quantas linhas e quanto pesam, e o caminho de cada uma
//   node tools/migrar-imagens.js --sim      envia cada imagem para o Storage e troca a coluna base64 pelo caminho
//
// Segurança:
// - Banco: SUPABASE_DB_URL (+ SUPABASE_DB_CA), como tools/migracao.js. Recusa outro projeto que não o lotm-rpg.
// - Envio: SUPABASE_SECRET_KEY (sb_secret_…), SÓ em variável do Windows, nunca no projeto, nunca impressa.
//   A chave secreta passa por cima da RLS: por isso só este script a usa, e só com --sim.
// - Idempotente: o caminho sai do id da linha (mesmo id = mesmo arquivo); rodar de novo só pega o que faltou.
// - A linha só muda se a imagem ainda for a mesma que foi enviada (o mestre pode ter trocado no meio).
'use strict';
const fs = require('fs');
const REF = 'adkecwrxjmmzqxnmwips', BUCKET = 'imagens', LIMITE = 307200;
const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// data:image/webp;base64,AAAA → { tipo, ext, bytes } (ou null se não for uma imagem aceita)
function decodificar(dataUrl) {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  return bytes.length ? { tipo: m[1], ext: EXT[m[1]], bytes } : null;
}
// o mesmo formato que a migração exige: bestiario/<dono>/<id>.<ext> e mesas/<mesa>/<id>.<ext>
function caminhoDe(tabela, linha, ext) {
  const pasta = tabela === 'bestiario' ? linha.dono : linha.mesa_id;
  if (!UUID.test(String(pasta)) || !UUID.test(String(linha.id)) || !Object.values(EXT).includes(ext)) return null;
  return `${tabela === 'bestiario' ? 'bestiario' : 'mesas'}/${pasta}/${linha.id}.${ext}`;
}
function planejar(tabela, linha) {
  const d = decodificar(linha.imagem);
  if (!d) return { erro: 'imagem ilegível' };
  if (d.bytes.length > LIMITE) return { erro: `maior que ${LIMITE} bytes` };
  const caminho = caminhoDe(tabela, linha, d.ext);
  return caminho ? { caminho, tipo: d.tipo, bytes: d.bytes } : { erro: 'id/pasta fora do formato' };
}

async function main() {
  const sim = process.argv.includes('--sim');
  const sair = (msg, cod = 1) => { console.log(msg); process.exit(cod); };
  const url = process.env.SUPABASE_DB_URL || '', chave = process.env.SUPABASE_SECRET_KEY || '';
  if (!url) sair('Defina SUPABASE_DB_URL no Windows (veja docs/MESTRE.md, "Migrações sem o chat").');
  if (!url.includes(REF)) sair('SUPABASE_DB_URL não aponta para o projeto lotm-rpg. Nada foi feito.');
  if (sim && !/^sb_secret_[A-Za-z0-9_-]{10,}$/.test(chave)) sair('Para enviar, defina SUPABASE_SECRET_KEY (sb_secret_…, painel > Project Settings > API Keys) no Windows.');
  let senha = ''; try { senha = decodeURIComponent(new URL(url).password || ''); } catch (e) { sair('SUPABASE_DB_URL inválida.'); }
  const limpar = t => { let s = String(t || ''); for (const seg of [url, senha, encodeURIComponent(senha), chave]) if (seg && seg.length > 3) s = s.split(seg).join('***'); return s; };
  const ssl = { rejectUnauthorized: true };
  if (process.env.SUPABASE_DB_CA) { try { ssl.ca = fs.readFileSync(process.env.SUPABASE_DB_CA, 'utf8'); } catch (e) { sair('Não consegui ler SUPABASE_DB_CA.'); } }

  const { Client } = require('pg');
  const c = new Client({ connectionString: url, ssl, statement_timeout: 120000, application_name: 'lotm-migrar-imagens' });
  try { await c.connect(); } catch (e) { sair('Falha ao conectar: ' + limpar(e.message)); }
  try {
    const tem = await c.query("select count(*)::int n from information_schema.columns where table_schema = 'public' and column_name = 'imagem_caminho' and table_name in ('bestiario', 'sussurros')");
    const aplicada = tem.rows[0].n === 2;
    if (!aplicada) { if (sim) sair('A migração 20261114_imagens_no_storage ainda não foi aplicada. Nada foi feito.'); console.log('(migração 20261114 ainda não aplicada: só o ensaio)'); }
    const linhas = [];
    for (const t of ['bestiario', 'sussurros']) {
      const r = await c.query(`select id, ${t === 'bestiario' ? 'dono' : 'mesa_id'}, imagem from public.${t} where imagem is not null${aplicada ? ' and imagem_caminho is null' : ''} order by id`);
      for (const l of r.rows) linhas.push({ tabela: t, linha: l, plano: planejar(t, l) });
    }
    const boas = linhas.filter(x => !x.plano.erro), kb = boas.reduce((s, x) => s + x.plano.bytes.length, 0) / 1024;
    console.log(`${linhas.length} imagem(ns) em base64: ${boas.length} prontas para o Storage (${kb.toFixed(0)} KB).`);
    for (const x of linhas) console.log(`  ${x.tabela} ${x.linha.id.slice(0, 8)}…  ${x.plano.erro ? 'PULADA: ' + x.plano.erro : x.plano.caminho.replace(/\/[^/]+\//, '/…/') + ` (${(x.plano.bytes.length / 1024).toFixed(0)} KB)`}`);
    if (!sim) { console.log('Ensaio: nada foi enviado nem alterado. Repita com --sim para migrar.'); return; }

    let feitas = 0;
    for (const x of boas) {
      const r = await fetch(`https://${REF}.supabase.co/storage/v1/object/${BUCKET}/${x.plano.caminho}`, {
        method: 'POST', body: x.plano.bytes,
        headers: { apikey: chave, Authorization: 'Bearer ' + chave, 'Content-Type': x.plano.tipo, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
      });
      if (!r.ok) { console.log(`  envio falhou (${r.status}) em ${x.tabela} ${x.linha.id.slice(0, 8)}…: ${limpar(await r.text()).slice(0, 160)}`); continue; }
      // troca na linha só se ninguém mudou a imagem enquanto isso
      const u = await c.query(`update public.${x.tabela} set imagem_caminho = $1, imagem = null where id = $2 and imagem = $3 and imagem_caminho is null`, [x.plano.caminho, x.linha.id, x.linha.imagem]);
      if (u.rowCount === 1) feitas++; else console.log(`  ${x.tabela} ${x.linha.id.slice(0, 8)}… mudou durante a migração: arquivo enviado, linha mantida (rode de novo).`);
    }
    console.log(`Migradas: ${feitas}/${boas.length}.`);
    if (feitas !== boas.length) process.exitCode = 1;
  } catch (e) { console.log('Erro: ' + limpar(e.message)); process.exitCode = 1; }
  finally { await c.end().catch(() => {}); }
}

if (require.main === module) main();
module.exports = { decodificar, caminhoDe, planejar, LIMITE };
