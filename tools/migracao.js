#!/usr/bin/env node
// Verifica ou aplica uma migração direto no banco, sem o SQL passar pelo chat (economiza muito contexto).
//
//   node tools/migracao.js verificar supabase/migrations/X.sql caminho/verificacao.sql
//       roda a migração + a verificação numa transação e SEMPRE desfaz (rollback). Mostra só a linha "RESULTADO".
//   node tools/migracao.js aplicar supabase/migrations/X.sql --sim
//       aplica de verdade (commit) e registra em supabase_migrations, como o painel do Supabase faz.
//
// Segurança:
// - A conexão vem SÓ da variável de ambiente SUPABASE_DB_URL (nunca de arquivo do projeto, nunca impressa).
// - Recusa qualquer banco que não seja o projeto lotm-rpg.
// - TLS verificado: se o Node não confiar no certificado, aponte SUPABASE_DB_CA para o .crt baixado do painel
//   (Database > SSL Configuration). Não existe modo "sem verificar".
// - Mensagens de erro passam por um filtro que apaga a URL e a senha, caso o driver as repita.
'use strict';
const fs = require('fs'), path = require('path');
const REF = 'adkecwrxjmmzqxnmwips';

const sair = (msg, cod = 1) => { console.log(msg); process.exit(cod); };
const [modo, arqMig, arqVer] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!['verificar', 'aplicar'].includes(modo) || !arqMig) sair('Uso: node tools/migracao.js verificar <migracao.sql> <verificacao.sql> | aplicar <migracao.sql> --sim');
if (modo === 'verificar' && !arqVer) sair('Falta o arquivo de verificação (.sql).');
if (modo === 'aplicar' && !process.argv.includes('--sim')) sair('Aplicar muda o banco de verdade: repita com --sim.');

const url = process.env.SUPABASE_DB_URL || '';
if (!url) sair('Defina SUPABASE_DB_URL no seu terminal (não no projeto). Veja docs/MESTRE.md, "Migrações sem o chat".');
if (!url.includes(REF)) sair('SUPABASE_DB_URL não aponta para o projeto lotm-rpg. Nada foi feito.');
let senha = ''; try { senha = decodeURIComponent(new URL(url).password || ''); } catch (e) { sair('SUPABASE_DB_URL inválida.'); }
const limpar = t => { let s = String(t || ''); for (const seg of [url, senha, encodeURIComponent(senha)]) if (seg && seg.length > 3) s = s.split(seg).join('***'); return s; };

const lerSql = a => {
  const p = path.resolve(a);
  if (!/\.sql$/i.test(p)) sair('Só arquivos .sql: ' + path.basename(p));
  if (!fs.existsSync(p)) sair('Arquivo não encontrado: ' + path.basename(p));
  return fs.readFileSync(p, 'utf8');
};
const sqlMig = lerSql(arqMig), sqlVer = arqVer ? lerSql(arqVer) : '';

let ssl = { rejectUnauthorized: true };
if (process.env.SUPABASE_DB_CA) { try { ssl.ca = fs.readFileSync(process.env.SUPABASE_DB_CA, 'utf8'); } catch (e) { sair('Não consegui ler SUPABASE_DB_CA.'); } }

(async () => {
  const { Client } = require('pg');
  const c = new Client({ connectionString: url, ssl, statement_timeout: 120000, application_name: 'lotm-migracao' });
  try { await c.connect(); }
  catch (e) {
    const m = limpar(e.message);
    sair(/self.signed|certificate/i.test(m) ? 'O certificado do banco não foi verificado. Baixe o certificado no painel (Database > SSL Configuration) e defina SUPABASE_DB_CA com o caminho dele.' : 'Falha ao conectar: ' + m);
  }
  try {
    await c.query('begin');
    if (modo === 'verificar') {
      await c.query(sqlMig);
      try { await c.query(sqlVer); console.log('A verificação terminou sem a linha RESULTADO (ela deve terminar com raise exception).'); process.exitCode = 1; }
      catch (e) {
        const m = limpar(e.message);
        if (/^RESULTADO/.test(m)) { console.log(m); if (/FALHA/.test(m)) process.exitCode = 1; }
        else { console.log('Erro na verificação: ' + m + (e.where ? ' | ' + limpar(e.where).split('\n')[0] : '')); process.exitCode = 1; }
      }
      await c.query('rollback'); console.log('(tudo desfeito)');
    } else {
      await c.query(sqlMig);
      const nome = path.basename(arqMig, '.sql').replace(/^\d+_?/, '') || 'migracao';
      const versao = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      await c.query('insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)', [versao, nome, [sqlMig]]);
      await c.query('commit'); console.log(`Aplicada: ${nome} (versão ${versao}).`);
    }
  } catch (e) {
    try { await c.query('rollback'); } catch (e2) { /* conexão caiu: o banco desfaz sozinho */ }
    console.log('Erro (nada foi gravado): ' + limpar(e.message) + (e.position ? ` | posição ${e.position}` : '')); process.exitCode = 1;
  } finally { await c.end().catch(() => {}); }
})();
