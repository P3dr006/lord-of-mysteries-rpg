require('./quieto');
// Testa o verificador de segredos e o hook de commit. Uso: npm run test:segredos
// Os "segredos" abaixo são falsos e montados em partes, para o próprio teste não ser bloqueado.
const { acharNoTexto, acharNoNome } = require('../tools/verificar-segredos.js');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
let falhas = 0, total = 0;
const ok = (n, c, d = '') => { total++; if (!c) falhas++; console.log(`${c ? '  ok  ' : ' FALHA'}  ${n}${d ? '  → ' + d : ''}`); };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = role => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ref: 'abc', role })}.${'x'.repeat(30)}`;
const tem = t => acharNoTexto('a.js', t).length > 0;

console.log('\n1) Conteúdo');
ok('chave pública (anon) é permitida', !tem(`const k = "${jwt('anon')}";`));
ok('chave publishable é permitida', !tem('const k = "sb_publishable_' + 'a'.repeat(30) + '";'));
ok('chave service_role é bloqueada', tem(`const k = "${jwt('service_role')}";`));
ok('JWT ilegível é bloqueado por precaução', tem('x = "eyJ' + 'a'.repeat(20) + '.eyJ' + 'b'.repeat(20) + '.' + 'c'.repeat(20) + '"'));
ok('chave sb_secret_ é bloqueada', tem('k="sb_' + 'secret_' + 'A'.repeat(30) + '"'));
ok('token pessoal sbp_ é bloqueado', tem('t="sb' + 'p_' + 'a1'.repeat(20) + '"'));
ok('senha no endereço do banco é bloqueada', tem('postgresql://postgres:' + 'minhasenha123' + '@db.exemplo.supabase.co:5432/postgres'));
ok('endereço do banco sem senha é permitido', !tem('https://exemplo.supabase.co'));
ok('chave privada é bloqueada', tem('-----BEGIN ' + 'RSA PRIVATE KEY-----'));
ok('token do GitHub é bloqueado', tem('gh' + 'p_' + 'A'.repeat(36)));
ok('chave da AWS é bloqueada', tem('AK' + 'IA' + 'A'.repeat(16)));
ok('senha atribuída a texto é bloqueada', tem('const password = "' + 'abcdefgh1234567' + '"'));
ok('texto comum não é bloqueado', !tem('const senha = digitar(); // peça a senha ao usuário'));
ok('marcador segredo-ok libera a linha', !tem('const token = "' + 'abcdefgh1234567' + '"; // segredo-ok'));
ok('o achado nunca mostra o valor', !JSON.stringify(acharNoTexto('a.js', 'const password = "' + 'abcdefgh1234567' + '"')).includes('abcdefgh'));

console.log('\n2) Nomes de arquivo');
for (const n of ['.env', '.env.local', '.env.example.bak', 'config/.env.production', 'chave.pem', 'id_rsa', 'js/config.local.js', 'service-account-x.json', 'secrets.json', '.npmrc'])
  ok(`bloqueia ${n}`, !!acharNoNome(n));
for (const n of ['js/config.js', 'index.html', 'js/state.js', 'img/sigilos/louco.webp', 'README.md', '.env.example'])
  ok(`permite ${n}`, !acharNoNome(n));

console.log('\n3) Hook de commit (repositório temporário)');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'segredos-'));
const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
fs.mkdirSync(path.join(dir, 'tools')); fs.mkdirSync(path.join(dir, '.githooks'));
fs.copyFileSync(path.join(__dirname, '../tools/verificar-segredos.js'), path.join(dir, 'tools/verificar-segredos.js'));
fs.copyFileSync(path.join(__dirname, '../.githooks/pre-commit'), path.join(dir, '.githooks/pre-commit')); fs.chmodSync(path.join(dir, '.githooks/pre-commit'), 0o755);
g('config', 'core.hooksPath', '.githooks');
fs.writeFileSync(path.join(dir, 'ok.js'), 'const a = 1;\n'); g('add', 'ok.js');
ok('commit limpo passa', g('commit', '-q', '-m', 'ok').status === 0);
fs.writeFileSync(path.join(dir, '.env'), 'X=1\n'); g('add', '-f', '.env');
let r = g('commit', '-q', '-m', 'env'); ok('commit com .env é bloqueado', r.status !== 0 && /bloqueado/.test(r.stderr), (r.stderr.match(/•.*/) || [''])[0]);
g('reset', '-q'); fs.unlinkSync(path.join(dir, '.env'));
fs.writeFileSync(path.join(dir, 'c.js'), `const k = "${jwt('service_role')}";\n`); g('add', 'c.js');
r = g('commit', '-q', '-m', 'chave'); ok('commit com service_role é bloqueado', r.status !== 0);
ok('a mensagem de bloqueio não vaza o valor', !r.stderr.includes('x'.repeat(30)) && !r.stdout.includes('x'.repeat(30)));
fs.writeFileSync(path.join(dir, 'c.js'), `const k = "${jwt('anon')}";\n`); g('add', 'c.js');
ok('commit só com chave anon passa', g('commit', '-q', '-m', 'anon').status === 0);
fs.rmSync(dir, { recursive: true, force: true });

console.log(`\n${total - falhas} de ${total} testes passaram`); process.exit(falhas ? 1 : 0);
