#!/usr/bin/env node
// Verificador de segredos: impede que chaves, senhas e arquivos sensíveis sejam commitados.
// Uso: node tools/verificar-segredos.js [--staged | --tudo | --historico]
//   --staged     (padrão) confere o que está na área de preparo do git (usado pelo hook de commit)
//   --tudo       confere todos os arquivos versionados (usado pelo hook de push)
//   --historico  confere todo o histórico de commits (auditoria)
// Uma linha com o marcador "segredo-ok" é ignorada (use só para valores públicos de propósito).
// Nunca imprime o valor encontrado, só o arquivo, a linha e o tipo.
const { execFileSync } = require('child_process');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

// Nomes de arquivo que nunca devem ser versionados.
const NOMES_PROIBIDOS = [
  [/(^|\/)\.env(\..*)?$/i, 'arquivo .env'],
  [/\.(pem|key|p12|pfx|jks|keystore)$/i, 'chave privada ou certificado'],
  [/(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i, 'chave SSH'],
  [/(^|\/)\.?(secrets?|credentials?)(\..*)?$/i, 'arquivo de segredos'],
  [/(^|\/)service[-_]?account.*\.json$/i, 'conta de serviço'],
  [/\.local\.(js|json|env)$/i, 'configuração local'],
  [/(^|\/)\.(npmrc|netrc|pgpass)$/i, 'credenciais de ferramenta'],
  [/(^|\/)supabase\/\.(temp|branches)\//i, 'arquivos internos do Supabase'],
];
const BINARIOS = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|mp3|ogg|wav|zip|gz)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

// Chaves públicas (feitas para ir ao navegador) são permitidas; o resto é bloqueado.
const decodificarJWT = t => { try { return JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; } };
const REGRAS = [
  ['chave JWT que não é pública (service_role ou outra)', /eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g, m => { const c = decodificarJWT(m); return !c || c.role !== 'anon'; }],
  ['chave secreta do Supabase (sb_secret_)', /sb_secret_[\w-]{10,}/g],
  ['token pessoal do Supabase (sbp_)', /\bsbp_[0-9a-f]{30,}/g],
  ['senha dentro de endereço de banco', /postgres(?:ql)?:\/\/[^\s:@/'"]+:[^\s@/'"]{3,}@/gi],
  ['bloco de chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['token do GitHub', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/g],
  ['chave da AWS', /\bAKIA[0-9A-Z]{16}\b/g],
  ['chave de API da Anthropic ou OpenAI', /\bsk-(?:ant-)?[A-Za-z0-9_-]{30,}/g],
  ['token do Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ['senha, segredo ou token atribuído a texto', /\b(?:password|passwd|senha|secret|token|api[_-]?key|service[_-]?role)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/gi],
];

function acharNoTexto(caminho, texto) {
  const achados = [], linhas = texto.split('\n');
  linhas.forEach((ln, i) => {
    if (ln.includes('segredo-ok') || ln.length > 20000) return;
    for (const [nome, re, extra] of REGRAS) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(ln))) { if (!extra || extra(m[0])) { achados.push({ caminho, linha: i + 1, nome }); break; } }
    }
  });
  return achados;
}
function acharNoNome(caminho) {
  for (const [re, nome] of NOMES_PROIBIDOS) if (re.test(caminho)) return { caminho, linha: 0, nome };
  return null;
}
const lerStaged = c => { try { return git('show', ':' + c); } catch { return null; } };
const lerArquivo = x => { try { return require('fs').readFileSync(x, 'utf8'); } catch { return null; } };

function varrer(modo) {
  const achados = [];
  const checar = (c, ler) => {
    const n = acharNoNome(c); if (n) { achados.push(n); return; }
    if (BINARIOS.test(c)) return;
    const t = ler(c); if (t == null || t.length > MAX_BYTES) return;
    achados.push(...acharNoTexto(c, t));
  };
  if (modo === '--historico') {
    const revs = git('rev-list', '--all').split('\n').filter(Boolean);
    const vistos = new Set();
    for (const r of revs) for (const c of git('ls-tree', '-r', '--name-only', r).split('\n').filter(Boolean)) {
      const id = git('rev-parse', `${r}:${c}`).trim(); if (vistos.has(id)) continue; vistos.add(id);
      const n = acharNoNome(c); if (n) { achados.push({ ...n, caminho: `${c} (commit ${r.slice(0, 7)})` }); continue; }
      if (BINARIOS.test(c)) continue;
      let t; try { t = git('cat-file', '-p', id); } catch { continue; } if (t.length > MAX_BYTES) continue;
      achados.push(...acharNoTexto(`${c} (commit ${r.slice(0, 7)})`, t));
    }
  } else if (modo === '--tudo') {
    for (const c of git('ls-files').split('\n').filter(Boolean)) checar(c, lerArquivo);
  } else {
    for (const c of git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean)) checar(c, lerStaged);
  }
  return achados;
}

if (require.main === module) {
  const modo = process.argv[2] || '--staged';
  const achados = varrer(modo);
  if (!achados.length) { console.log(`Verificação de segredos: nada suspeito (${modo.replace('--', '')}).`); process.exit(0); }
  console.error('\n✋ POSSÍVEL SEGREDO — o envio foi bloqueado.\n');
  achados.forEach(a => console.error(`  • ${a.caminho}${a.linha ? ':' + a.linha : ''}  →  ${a.nome}`));
  console.error('\nTire o valor do arquivo (use um arquivo local ignorado pelo git) e tente de novo.');
  console.error('Se for uma chave PÚBLICA de propósito, acrescente o comentário "segredo-ok" na mesma linha.');
  console.error('Se o segredo já foi enviado alguma vez, troque-o (rotacione) no serviço de origem.\n');
  process.exit(1);
}
module.exports = { acharNoTexto, acharNoNome };
