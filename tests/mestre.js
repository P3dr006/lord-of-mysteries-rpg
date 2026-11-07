require('./quieto');
// Testes da mesa online (mestre e jogador) com um Supabase FALSO em memória (tests/supabase-falso.js).
// Prova: o site funciona sem rede, a biblioteca é fixa e verificada, o jogador nunca recebe dificuldade
// nem teste secreto, o dado do pedido vem do servidor, e a ficha chega ao mestre ao vivo.
// Uso: npm run test:mestre
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), crypto = require('crypto'), https = require('https');
const { criarServidor } = require('./supabase-falso');
const RAIZ = path.resolve(__dirname, '..');
const URL_SITE = 'file://' + path.join(RAIZ, 'index.html'), URL_MESTRE = 'file://' + path.join(RAIZ, 'mestre.html');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ATT = Object.fromEntries(['forca', 'agil', 'vigor', 'intel', 'espir', 'pres'].map((k, i) => [k, { dados: [3, 5, 6, 2], descartado: 3, total: 10 + i * 2 }]));
const FICHA = (x = {}) => ({ nome: 'Klein', jogador: 'Pedro', step: 5, sequencia: 7, digestao: 2, caminho: 'louco', raca: 'humano', origem: 'nobre', traco: 1, artefato: 1, attrs: ATT, pv: 10, san: 12, ...x });
const EMAIL = 'mestre@exemplo.test', SENHA = 'teste-' + crypto.randomBytes(6).toString('hex');   // gerada a cada execução, só existe no servidor falso
let falhas = 0, total = 0;
const ok = (nome, passou, detalhe = '') => { total++; if (!passou) falhas++; console.log(`${passou ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  → ' + detalhe : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
async function ate(fn, ms = 5000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) { /* ainda não */ } await espera(100); } return false; }

async function contexto(browser, srv, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, ...extra });
  if (srv) await srv.ligar(ctx);
  return ctx;
}
async function pagina(ctx, url) { const p = await ctx.newPage(); p.erros = []; p.on('pageerror', e => p.erros.push(e.message)); await p.goto(url); await p.waitForTimeout(300); if (url === URL_MESTRE) grimorio(p); return p; }
// No Grimório as seções ficam em abas: antes de mexer num elemento, o teste abre a aba onde ele mora (como o mestre faria).
function grimorio(p) {
  const abrir = sel => p.evaluate(s => { const el = document.querySelector(s.replace(/ >> nth=\d+$/, '')); const pn = el && el.closest('.m-aba-p'); if (pn && pn.hidden) { const b = document.querySelector('#aba-' + pn.dataset.p); if (b) b.click(); } }, sel).catch(() => {});
  for (const k of ['click', 'fill', 'selectOption', 'isVisible', 'check', 'setInputFiles', 'textContent', 'inputValue', 'getAttribute']) {
    const orig = p[k].bind(p);
    p[k] = async (sel, ...r) => { if (typeof sel === 'string') await abrir(sel); return orig(sel, ...r); };
  }
}
async function jogadorPronto(ctx, ficha = {}) {
  const p = await pagina(ctx, URL_SITE);
  await p.evaluate(f => { novoSlot(); P = sanear(f); salvar(); P.step = 5; salvar(); iniciarPasso(); }, FICHA(ficha));
  await p.waitForTimeout(400);
  await p.click('#fab-mesa'); await p.click('.aba[data-aba=testes]'); await p.waitForTimeout(200);
  return p;
}
async function mestreLogado(ctx) {
  const p = await pagina(ctx, URL_MESTRE);
  await p.waitForSelector('#m-email'); await p.fill('#m-email', EMAIL); await p.fill('#m-senha', SENHA); await p.click('#m-entrar');
  await p.waitForSelector('#m-form-mesa'); return p;
}
async function axe(p) {
  await p.evaluate(() => document.getAnimations().forEach(a => { if (a.effect && a.effect.getComputedTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; } else a.finish(); }));
  await p.evaluate(AXE);
  return p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }).then(r => r.violations.map(v => `${v.id} ×${v.nodes.length}: ${v.nodes[0].html.slice(0, 80)}`)));
}
const baixar = url => new Promise((ok2, falha) => https.get(url, r => { if (r.statusCode !== 200) return falha(new Error('HTTP ' + r.statusCode)); const b = []; r.on('data', c => b.push(c)); r.on('end', () => ok2(Buffer.concat(b))); }).on('error', falha).setTimeout(15000, function () { this.destroy(new Error('tempo')); }));

(async () => {
  const browser = await chromium.launch();

  console.log('\n1) Biblioteca do Supabase: versão fixa e verificada');
  { const src = fs.readFileSync(path.join(RAIZ, 'js/mestre.js'), 'utf8');
    const m = /src:\s*'([^']+)'/.exec(src), s = /sri:\s*'([^']+)'/.exec(src);
    ok('versão exata na URL (sem "latest" nem faixa)', !!m && /@\d+\.\d+\.\d+\//.test(m[1]), m && m[1]);
    ok('hash de integridade sha384 declarado', !!s && /^sha384-[A-Za-z0-9+/=]{64}$/.test(s[1]));
    try { const buf = await baixar(m[1]); const h = 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
      ok('o hash confere com o arquivo da CDN', h === s[1], h === s[1] ? '' : h); }
    catch (e) { console.log('  (sem rede: conferência do hash na CDN pulada — ' + (e.message || e.code || 'falha de rede') + ')'); }
    const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    ok('index.html não baixa a biblioteca ao abrir', !/supabase-js/.test(html));
    const cfg = fs.readFileSync(path.join(RAIZ, 'js/config.js'), 'utf8').replace(/\/\/.*$/gm, '');   // sem os comentários de alerta
    ok('config.js só tem a chave pública', /sb_publishable_/.test(cfg) && !/sb_secret_|service_role\s*[:=]/.test(cfg)); }

  console.log('\n1b) Achar onde entrar na mesa');
  { const ctx = await contexto(browser, null); const p = await jogadorPronto(ctx);
    ok('o campo do código é o primeiro item da aba Testes', await p.evaluate(() => document.querySelector('#mesa-corpo').firstElementChild.id === 'online'));
    ok('o campo aparece sem rolar o painel', await p.evaluate(() => { const i = document.querySelector('#on-cod').getBoundingClientRect(), c = document.querySelector('#mesa-corpo').getBoundingClientRect(); return i.top >= c.top && i.bottom <= c.bottom; }));
    await p.click('#mesa-x'); await p.evaluate(() => voltarCapa()); await p.waitForTimeout(300);
    ok('a capa tem o atalho "Entrar numa mesa"', await p.isVisible('#btn-entrar-mesa'));
    await p.click('#btn-entrar-mesa');
    ok('o atalho abre a mesa direto no campo do código', await ate(() => p.evaluate(() => document.activeElement && document.activeElement.id === 'on-cod')));
    ok('atalho: nenhum erro de script', p.erros.length === 0, p.erros[0] || ''); await ctx.close(); }
  { const ctx = await contexto(browser, null); const p = await pagina(ctx, URL_SITE);
    await p.click('#btn-entrar-mesa');
    ok('sem personagem, o atalho abre a mesa pedindo o nome', await ate(() => p.evaluate(() => document.activeElement && document.activeElement.id === 'on-nome')));
    ok('o campo do código não fica bloqueado', await p.evaluate(() => !document.querySelector('#on-cod').disabled && !document.querySelector('#on-entrar').disabled));
    await p.fill('#on-cod', 'ABC234'); await p.click('#on-entrar');
    ok('sem nome, pede o nome (e guarda o código digitado)', await ate(async () => /nome/.test(await p.textContent('.on-erro'))) && (await p.inputValue('#on-cod')) === 'ABC234');
    await ctx.close(); }

  console.log('\n2) Sem rede, o site continua funcionando');
  { const ctx = await contexto(browser, null); await ctx.route(/cdn\.jsdelivr\.net/, r => r.abort());
    const p = await jogadorPronto(ctx);
    ok('a aba Testes mostra a mesa online', await p.isVisible('#on-cod'));
    await p.fill('#on-cod', 'abc234'); await p.click('#on-entrar');
    ok('entrar sem rede mostra mensagem clara', await ate(() => p.isVisible('.on-erro')), await p.textContent('.on-erro').catch(() => ''));
    ok('a mensagem não é técnica', /conexão|internet/i.test(await p.textContent('.on-erro')));
    ok('login anônimo desligado no Supabase vira instrução em português', /Allow anonymous sign-ins/.test(await p.evaluate(() => Rede.mensagem({ message: 'Anonymous sign-ins are disabled' }))));
    await p.click('.aba[data-aba=livre]'); await p.click('#rolar');
    ok('os dados comuns continuam rolando', await ate(() => p.isVisible('#resultado'), 4000));
    ok('nenhum erro de script', p.erros.length === 0, p.erros[0] || '');
    const tags = await p.evaluate(() => [...document.querySelectorAll('script[src*="supabase"]')].map(s => s.outerHTML));
    ok('a tentativa usou integrity + crossorigin', tags.length === 0 || tags.every(t => /integrity="sha384-/.test(t) && /crossorigin="anonymous"/.test(t)), tags[0] || 'script removido após falha');
    await ctx.close(); }
  { const ctx = await contexto(browser, null); const p = await jogadorPronto(ctx); await ctx.setOffline(true);
    await p.fill('#on-cod', 'ABC234'); await p.click('#on-entrar');
    ok('offline: avisa que está sem internet', await ate(async () => /sem internet/i.test(await p.textContent('.on-erro'))));
    ok('offline: nenhum erro de script', p.erros.length === 0, p.erros[0] || ''); await ctx.close(); }
  { const ctx = await contexto(browser, null); await ctx.route(/cdn\.jsdelivr\.net/, r => r.abort());
    const p = await pagina(ctx, URL_MESTRE);
    ok('grimório sem rede: explica e oferece tentar de novo', await ate(() => p.isVisible('#m-tentar')));
    ok('grimório sem rede: link de volta ao site', await p.isVisible('a.m-link'));
    ok('grimório sem rede: nenhum erro de script', p.erros.length === 0, p.erros[0] || ''); await ctx.close(); }

  console.log('\n3) Mestre: login e mesa');
  const srv = criarServidor(); srv.criarMestre(EMAIL, SENHA);
  const ctxM = await contexto(browser, srv), ctxJ = await contexto(browser, srv);
  const m = await pagina(ctxM, URL_MESTRE);
  await m.waitForSelector('#m-email');
  { const v = await axe(m); ok('login sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
  await m.fill('#m-email', EMAIL); await m.fill('#m-senha', 'errada1'); await m.click('#m-entrar');
  ok('senha errada: mensagem em português', await ate(async () => /incorretos/.test(await m.textContent('#m-erro-login'))));
  await m.fill('#m-email', 'nao-e-email'); await m.click('#m-entrar');
  ok('e-mail inválido é barrado antes do servidor', await ate(async () => /e-mail válido/.test(await m.textContent('#m-erro-login'))));
  await m.fill('#m-email', EMAIL); await m.fill('#m-senha', SENHA); await m.click('#m-entrar');
  ok('login certo abre a lista de mesas', await ate(() => m.isVisible('#m-form-mesa')));
  await m.click('#m-nova');
  ok('mesa sem nome é barrada', await ate(async () => /nome/.test(await m.textContent('#m-erro-mesa'))));
  await m.fill('#m-nome-mesa', 'Tingen, 1349'); await m.click('#m-nova');
  ok('criar mesa abre o painel', await ate(() => m.isVisible('#m-codigo')));
  const codigo = await m.evaluate(() => Painel.estado.mesa.codigo);
  ok('o código tem 6 caracteres do alfabeto sem ambiguidade', /^[A-HJ-NP-Z2-9]{6}$/.test(codigo), codigo);
  ok('o código aparece em peças', (await m.$$eval('#m-codigo span[aria-hidden]', s => s.map(x => x.textContent).join(''))) === codigo);

  console.log('\n4) Jogador entra com o código');
  const j = await jogadorPronto(ctxJ);
  await j.fill('#on-cod', 'ABC'); await j.click('#on-entrar');
  ok('código curto é barrado sem ir ao servidor', await ate(async () => /6 letras/.test(await j.textContent('.on-erro'))));
  await j.fill('#on-cod', codigo.toLowerCase().replace(/(...)/, '$1 ')); await j.click('#on-entrar');
  ok('código em minúsculas e com espaço funciona', await ate(() => j.isVisible('.on-status.ligado')), await j.textContent('#online').catch(() => ''));
  ok('o mestre vê o jogador entrar ao vivo', await ate(() => m.isVisible('.m-carta-j')));
  const esperado = await j.evaluate(() => ({ mods: Object.fromEntries(ATTRS.map(a => [a.key, mod(total(a.key))])), pv: P.pv, pvMax: pvMax(), san: P.san, sanMax: sanMax() }));
  const naTela = await m.evaluate(() => ({ nome: document.querySelector('.m-carta-j .m-cj-id b').firstChild.textContent, mods: [...document.querySelectorAll('.m-carta-j .m-mods b')].map(b => b.textContent), pv: document.querySelector('.m-carta-j .m-barra b').textContent }));
  ok('nome do personagem no painel', naTela.nome === 'Klein', naTela.nome);
  ok('modificadores da ficha no painel', naTela.mods.join(' ') === Object.values(esperado.mods).map(v => (v >= 0 ? '+' : '−') + Math.abs(v)).join(' '), naTela.mods.join(' '));
  ok('PV atual / máximo no painel', naTela.pv === `${esperado.pv}/${esperado.pvMax}`, naTela.pv);
  { const v = await axe(m); ok('painel do mestre sem violações de acessibilidade', v.length === 0, v.join(' | ')); }

  console.log('\n4b) Carta com identidade e ficha completa');
  { const carta = await m.evaluate(() => { const c = document.querySelector('.m-carta-j'); return { img: (c.querySelector('.m-cj-selo img') || {}).getAttribute && c.querySelector('.m-cj-selo img').getAttribute('src'), seq: (c.querySelector('.m-cj-seq') || {}).textContent, txt: c.textContent.replace(/\s+/g, ' '), cam: [...c.querySelectorAll('.m-mods li.cam')].map(l => l.title), est: [...c.querySelectorAll('.m-est')].map(e => e.textContent) }; });
    ok('a carta mostra o sigilo do Caminho', carta.img === 'img/sigilos/louco.webp', carta.img);
    ok('a carta mostra a Sequência no medalhão', carta.seq === '7', carta.seq);
    ok('a carta mostra Caminho, raça e origem', /Caminho Louco/.test(carta.txt) && /Humano · Nobre Decaído/.test(carta.txt), carta.txt.slice(0, 160));
    ok('o atributo do Caminho fica em destaque', carta.cam.length === 1 && /Espiritualidade/.test(carta.cam[0]), carta.cam.join());
    ok('vida e mente aparecem em palavras', carta.est.length === 2 && /Ileso|Arranhado|Ferido|Grave|Caído/.test(carta.est[0]) && /Lúcido|Inquieto|Abalado|Vacilando|Rompido/.test(carta.est[1]), carta.est.join(' / '));
    const art = await j.evaluate(() => ARTEFATOS[P.artefato].n), hab = await j.evaluate(() => caminhoPorId(P.caminho).hab[0]);
    await m.click('.m-cj-ver');
    ok('"Ver ficha" abre a ficha completa', await ate(() => m.isVisible('#m-ficha .m-ficha')));
    const ficha = (await m.textContent('#m-ficha')).replace(/\s+/g, ' ');
    ok('a ficha tem nome, Sequência e patamar', /Klein/.test(ficha) && /Sequência 7/.test(ficha) && /Baixa Sequência/.test(ficha), ficha.slice(0, 120));
    ok('a ficha mostra as habilidades do Caminho', ficha.includes(hab), hab);
    ok('a ficha mostra o artefato com dádiva e maldição', ficha.includes(art) && /Dádiva/.test(ficha) && /Maldição/.test(ficha), art);
    ok('a ficha mostra os testes desse jogador nesta mesa', /Testes nesta mesa/.test(ficha));
    { const v = await axe(m); ok('ficha aberta sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    ok('o foco fica preso na ficha (Tab não escapa)', await (async () => { for (let i = 0; i < 12; i++) await m.keyboard.press('Tab'); return m.evaluate(() => !!document.activeElement.closest('#m-ficha')); })());
    await m.keyboard.press('Escape');
    ok('Esc fecha a ficha', await ate(async () => !(await m.$('#m-ficha'))));
    ok('o foco volta para o botão "Ver ficha"', await m.evaluate(() => document.activeElement.classList.contains('m-cj-ver')));
    await m.click('.m-cj-ver'); await m.waitForSelector('#mf-pedir'); await m.click('#mf-pedir');
    ok('"Pedir teste" da ficha já escolhe o jogador', await ate(() => m.evaluate(u => !document.querySelector('#m-ficha') && document.querySelector('#t-para').value === u && document.activeElement.id === 't-rotulo', srv.db.jogadores[0].user_id)), await m.inputValue('#t-para'));
    const tam = await j.evaluate(() => { const g = { h: P.historia, n: P.notas, b: P.habilidades }; P.historia = 'á'.repeat(8000); P.notas = 'ção '.repeat(5000); P.habilidades = Array.from({ length: 40 }, (_, i) => ({ nome: 'Habilidade ' + i, desc: 'é'.repeat(600) })); const n = new TextEncoder().encode(JSON.stringify(Jogador.fichaParaMestre())).length; P.historia = g.h; P.notas = g.n; P.habilidades = g.b; return n; });
    ok('ficha enorme encolhe para caber no banco (≤ 6,5 KB)', tam <= 6500, tam + ' bytes'); }

  console.log('\n5) Teste ABERTO');
  const uidJ = srv.db.jogadores[0].user_id;
  await m.selectOption('#t-attr', 'agil'); await m.fill('#t-dif', '15');
  ok('escolher atributo preenche o rótulo', (await m.inputValue('#t-rotulo')) === 'Teste de Agilidade');
  await m.fill('#t-rotulo', 'Saltar entre os telhados'); await m.click('#t-aberto');
  ok('o jogador recebe o pedido ao vivo', await ate(() => j.isVisible('.pedido')));
  ok('o pedido mostra o dado e o modificador', /d20 \+ Agilidade [+−]\d/.test(await j.textContent('.pedido i')), await j.textContent('.pedido i'));
  ok('o mestre vê "ainda vai rolar"', await ate(() => m.isVisible('.m-pend li')));
  await j.click('.aba[data-aba=livre]'); await j.click('#mesa-x');
  ok('com a mesa fechada, o botão ganha o selo de pedido', await ate(() => j.isVisible('#fab-mesa .fab-p')));
  ok('o selo é anunciado no nome do botão', /pediu um teste/.test(await j.getAttribute('#fab-mesa', 'aria-label')));
  await j.click('#fab-mesa');
  ok('abrir a mesa com pedido leva direto à aba Testes', await ate(() => j.isVisible('.rolar-pedido')));
  { const v = await axe(j); ok('jogador com pedido: sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
  srv.proximosDados(17);
  const modAgil = esperado.mods.agil;
  await j.click('.rolar-pedido');
  ok('a animação para no número do servidor', await ate(async () => (await j.textContent('#resultado .rz-n')) === String(17 + modAgil), 6000), await j.textContent('#resultado .rz-n').catch(() => ''));
  ok('o pedido some da lista do jogador', await ate(async () => !(await j.isVisible('.pedido'))));
  ok('o registro guarda o teste do mestre', await j.evaluate(() => P.historico[0].rotulo) === 'Saltar entre os telhados');
  ok('o mestre recebe o resultado com dificuldade e veredito', await ate(() => m.isVisible('.m-r')));
  const linha = await m.textContent('.m-r');
  ok('veredito correto (17' + (modAgil >= 0 ? '+' : '') + modAgil + ' contra 15)', (17 + modAgil >= 15) ? /Passou/.test(linha) : /Falhou/.test(linha), linha.replace(/\s+/g, ' '));
  ok('a dificuldade aparece só para o mestre', /dificuldade 15/.test(linha));
  ok('rolar de novo o mesmo pedido é recusado pelo servidor', (await j.evaluate(async id => { try { await Rede.rpc('jogador', 'responder_pedido', { p_pedido: id, p_modificador: 0 }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, srv.db.pedidos[0].id)) === 'Este teste já foi rolado.');

  console.log('\n6) 20 e 1 naturais: só efeito');
  await m.selectOption('#t-attr', ''); await m.fill('#t-rotulo', 'Sorte pura'); await m.fill('#t-dif', '30'); await m.click('#t-aberto');
  await ate(() => j.isVisible('.rolar-pedido')); srv.proximosDados(20); await j.click('.rolar-pedido');
  ok('20 natural acende o efeito na mesa do jogador', await ate(() => j.evaluate(() => document.querySelector('#feltro').classList.contains('crit')), 6000));
  ok('20 natural não decide nada: o mestre vê "Falhou" contra 30', await ate(async () => /Falhou/.test(await m.textContent('.m-r'))));
  ok('o mestre vê a marca de 20 natural', await m.evaluate(() => document.querySelector('.m-r').classList.contains('crit')));

  console.log('\n7) Teste SECRETO');
  const antes = (srv.entregue[uidJ] || []).length;
  srv.proximosDados(9);
  await m.selectOption('#t-attr', 'pres'); await m.fill('#t-rotulo', 'Ouvir os sussurros'); await m.fill('#t-dif', '12'); await m.click('#t-secreto');
  ok('o mestre vê o resultado secreto na hora', await ate(() => m.isVisible('.m-sec')));
  const sec = await m.textContent('.m-sec');
  ok('o modificador do secreto vem da ficha (Presença)', sec.includes(`9 ${(esperado.mods.pres >= 0 ? '+' : '−') + Math.abs(esperado.mods.pres)} = ${9 + esperado.mods.pres}`), sec.replace(/\s+/g, ' '));
  await espera(1200);
  ok('o jogador não recebe pedido do secreto', !(await j.isVisible('.pedido')));
  ok('nada novo chegou ao jogador por causa do secreto', (srv.entregue[uidJ] || []).slice(antes).every(r => !JSON.stringify(r).includes('Ouvir os sussurros')));
  const tudoJ = JSON.stringify(srv.entregue[uidJ] || []);
  ok('o jogador NUNCA recebeu "dificuldade"', !/dificuldade/.test(tudoJ));
  ok('o jogador NUNCA recebeu um teste secreto', !/"secreto"/.test(tudoJ));
  ok('consultar a visão do mestre como jogador não devolve nada', (await j.evaluate(async () => (await (await Rede.tabela('jogador', 'resultados_mestre')).select('*')).data.length)) === 0);
  ok('o jogador não consegue pedir teste (só o mestre)', /Só o mestre/.test(await j.evaluate(async m2 => { try { await Rede.rpc('jogador', 'pedir_teste', { p_mesa: m2, p_para: 'x', p_rotulo: 'x', p_atributo: '', p_lados: 20, p_dificuldade: 1 }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, srv.db.mesas[0].id)));

  console.log('\n7b) Sussurros e pistas');
  { const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const uidM = srv.db.mesas[0].mestre_id;
    ok('o Grimório tem a seção de sussurros', await m.isVisible('#m-form-sus'));
    await m.click('#s-enviar');
    ok('sussurro vazio é barrado antes do servidor', await ate(async () => /Escreva algo/.test(await m.textContent('#m-erro-sus'))));
    // pista com imagem para TODOS, enquanto só o Klein está na mesa
    await m.selectOption('#s-para', ''); await m.fill('#s-titulo', 'O mapa rasgado'); await m.fill('#s-texto', 'Alguém deixou isto sob a porta.');
    await m.setInputFiles('#s-img', { name: 'mapa.png', mimeType: 'image/png', buffer: PNG });
    ok('a imagem é reduzida e mostrada antes de enviar', await ate(() => m.evaluate(() => /^data:image\/(webp|jpeg);base64,/.test(document.querySelector('#s-prev img').getAttribute('src') || ''))));
    await m.click('#s-enviar');
    ok('o jogador recebe a pista na hora, com a cena do sussurro', await ate(() => j.isVisible('.sussurro')));
    ok('a cena mostra título, texto e a imagem', await j.evaluate(() => { const s = document.querySelector('.sussurro'); return /O mapa rasgado/.test(s.textContent) && /sob a porta/.test(s.textContent) && /^data:image\/(webp|jpeg);base64,/.test(s.querySelector('.sus-pista img').getAttribute('src')); }));
    ok('o foco vai para o botão da cena', await ate(() => j.evaluate(() => document.activeElement.id === 'sus-ok')));
    { const v = await axe(j); ok('cena do sussurro sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    await j.click('#sus-ok');
    ok('"Guardar na memória" fecha a cena', await ate(async () => !(await j.$('.sussurro'))));
    ok('o mestre vê que o Klein leu', await ate(async () => /lido por Klein/.test(await m.textContent('#m-sussurros'))));
    ok('a lista do mestre marca "pista com imagem"', /pista com imagem/.test(await m.textContent('#m-sussurros')));
    ok('a lista do mestre NÃO baixa as imagens (painel leve)', !JSON.stringify(srv.entregue[uidM] || []).includes('data:image'));
    ok('a pista enviada "para todos" foi guardada uma vez só', srv.db.sussurros.length === 1);
    // uma jogadora que entra DEPOIS recebe o que foi para todos
    const cA = await contexto(browser, srv), a = await pagina(cA, URL_SITE);
    await a.evaluate(f => { novoSlot(); P = sanear(f); salvar(); iniciarPasso(); }, FICHA({ nome: 'Audrey', caminho: 'visionario' })); await a.waitForTimeout(300);
    await a.evaluate(c => Jogador.entrar(c), codigo);
    ok('quem entra depois recebe a pista que estava esperando', await ate(() => a.isVisible('.sussurro'), 6000));
    await a.click('#sus-ok'); await ate(async () => !(await a.$('.sussurro')));
    const uidA = srv.db.jogadores.find(x => x.nome === 'Audrey').user_id;
    // sussurro PRIVADO para o Klein
    await ate(async () => (await m.$$('#s-para option')).length === 3);
    await m.selectOption('#s-para', { label: 'Klein' }); await m.fill('#s-titulo', 'Visão'); await m.fill('#s-texto', 'O relógio de bolso para às 3h.'); await m.click('#s-enviar');
    ok('o sussurro privado chega ao Klein', await ate(async () => /relógio de bolso/.test(await j.textContent('.sussurro').catch(() => ''))));
    await espera(1200);
    ok('a Audrey não recebe o sussurro do Klein', !(await a.$('.sussurro')));
    ok('nada do sussurro do Klein chegou ao navegador da Audrey', !JSON.stringify(srv.entregue[uidA] || []).includes('relógio de bolso'));
    ok('a Audrey não consegue marcar o sussurro do Klein', /inválido/.test(await a.evaluate(async id => { try { await Rede.rpc('jogador', 'ler_sussurro', { p_id: id }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, srv.db.sussurros[1].id)));
    ok('jogador não consegue sussurrar', /Só o mestre/.test(await a.evaluate(async mesa => { try { await Rede.rpc('jogador', 'sussurrar', { p_mesa: mesa, p_para: null, p_titulo: '', p_texto: 'golpe', p_imagem: null }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, srv.db.mesas[0].id)));
    await j.click('#sus-ok'); await ate(async () => !(await j.$('.sussurro')));
    // reler pelas pistas guardadas
    await j.evaluate(() => Mesa.irParaTestes()); await j.waitForTimeout(200);
    ok('o jogador guarda as pistas na aba Testes', await ate(async () => (await j.$$('.pista-b')).length === 2));
    await j.click('.pista-b >> nth=1');
    ok('tocar numa pista abre de novo (modo relembrar)', await ate(() => j.evaluate(() => !!document.querySelector('.sussurro.relendo'))));
    await j.keyboard.press('Escape');
    ok('Esc fecha a pista', await ate(async () => !(await j.$('.sussurro'))));
    // apagar
    await m.click('#m-sussurros [data-apagar] >> nth=0');
    ok('o mestre apaga um sussurro', await ate(() => srv.db.sussurros.length === 1));
    ok('a pista apagada some da lista do jogador', await ate(async () => (await j.$$('.pista-b')).length === 1));
    ok('sussurros: nenhum erro de script', m.erros.length === 0 && j.erros.length === 0 && a.erros.length === 0, [m.erros[0], j.erros[0], a.erros[0]].filter(Boolean).join(' | '));
    await a.evaluate(() => Jogador.sairDaMesa()); await ate(async () => !(await m.textContent('#m-jogadores')).includes('Audrey'));
    await cA.close(); }

  console.log('\n7c) Corpo e mente, Modo Terror e notas secretas');
  { const pv = () => j.evaluate(() => P.pv), san = () => j.evaluate(() => P.san);
    ok('o Grimório tem "Corpo e mente"', await m.isVisible('#m-form-ctrl'));
    { const v = await axe(m); ok('painel com o controle sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    // dano de PV
    const pv0 = await pv();
    await m.fill('#c-qtd', '3'); await m.fill('#c-motivo', 'Mordida do lobo'); await m.click('#c-dano');
    ok('o jogador sente o golpe na tela', await ate(() => j.isVisible('.golpe.pv.dano')));
    ok('o golpe mostra o valor e o motivo', /−3 PV/.test(await j.textContent('.golpe')) && /Mordida do lobo/.test(await j.textContent('.golpe')));
    ok('o PV da ficha do jogador cai 3', await ate(async () => (await pv()) === pv0 - 3), `${pv0} → ${await pv()}`);
    ok('o número na ficha aberta acompanha', (await j.inputValue('#iv-pv')) === String(pv0 - 3));
    ok('o painel do mestre recebe o PV novo', await ate(async () => (await m.textContent('.m-carta-j .m-barra b')).startsWith((pv0 - 3) + '/'), 6000));
    ok('a ordem aparece como aplicada', await ate(async () => /aplicado/.test(await m.textContent('#m-ordens'))));
    ok('a mesma ordem não se aplica duas vezes', (await j.evaluate(async id => Rede.rpc('jogador', 'aplicar_ordem', { p_id: id }), srv.db.ordens[0].id)) === null && (await pv()) === pv0 - 3);
    // Sanidade: cura não passa do máximo
    await m.check('input[name="c-alvo"][value="san"]');
    ok('em Sanidade, os botões viram "Abalar a mente" e "Acalmar"', /Abalar a mente/.test(await m.textContent('#c-dano')) && /Acalmar/.test(await m.textContent('#c-cura')));
    const san0 = await san(), sanMx = await j.evaluate(() => sanMax());
    await m.fill('#c-qtd', '999'); await m.click('#c-cura');
    ok('acalmar a mente aparece para o jogador', await ate(() => j.isVisible('.golpe.san.cura')));
    ok('a Sanidade não passa do máximo', await ate(async () => (await san()) === sanMx), `${san0} → ${await san()} (máx ${sanMx})`);
    await m.fill('#c-qtd', '4'); await m.click('#c-dano');
    ok('abalar a mente tira 4 de Sanidade', await ate(async () => (await san()) === sanMx - 4));
    // dano maior que o PV para em 0; depois cura tudo
    await m.check('input[name="c-alvo"][value="pv"]'); await m.fill('#c-qtd', '999'); await m.click('#c-dano');
    ok('dano maior que o PV para em 0 (Caído)', await ate(async () => (await pv()) === 0) && await ate(async () => /Caído/.test(await m.textContent('.m-carta-j'))));
    await m.click('#c-cura'); await ate(async () => (await pv()) > 0);
    // ordem enviada enquanto o jogador está fora é aplicada quando ele volta
    const pvAntes = await pv();
    await j.reload(); await j.waitForTimeout(200);
    await m.fill('#c-qtd', '2'); await m.fill('#c-motivo', 'Queda na escada'); await m.click('#c-dano');
    await j.click('#btn-continue');
    ok('ordem feita com o jogador fora é aplicada quando ele volta', await ate(async () => (await pv()) === pvAntes - 2, 8000), `${pvAntes} → ${await pv()}`);
    ok('e o golpe aparece na volta', await ate(() => j.isVisible('.golpe')));
    ok('jogador não consegue dar ordens', /Só o mestre/.test(await j.evaluate(async mesa => { try { await Rede.rpc('jogador', 'ordenar', { p_mesa: mesa, p_para: null, p_tipo: 'pv', p_valor: 5, p_motivo: '' }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, srv.db.mesas[0].id)));
    // Modo Terror da mesa
    ok('o jogador começa sem Terror', !(await j.evaluate(() => Som.terror)));
    await m.click('#m-terror');
    ok('o botão do mestre mostra "Ligado"', await ate(async () => (await m.getAttribute('#m-terror', 'aria-pressed')) === 'true'));
    ok('o Terror liga no jogador', await ate(() => j.evaluate(() => Som.terror && document.body.classList.contains('terror'))));
    ok('o jogador é avisado de que pode desligar o seu', await ate(async () => /desligue no olho/i.test(await j.textContent('.aviso-terror').catch(() => ''))));
    await j.click('#btn-terror');
    ok('o jogador pode desligar o próprio Terror', !(await j.evaluate(() => Som.terror)) && srv.db.mesas[0].terror === true);
    await j.reload(); await j.waitForTimeout(200); await j.click('#btn-continue'); await ate(() => j.evaluate(() => Jogador.estado === 'ligado'));
    await j.waitForTimeout(800);
    ok('ao recarregar, a mesa não força o Terror de novo', !(await j.evaluate(() => Som.terror)));
    { const cN = await contexto(browser, srv), n = await pagina(cN, URL_SITE);
      await n.evaluate(f => { novoSlot(); P = sanear(f); salvar(); iniciarPasso(); }, FICHA({ nome: 'Alger' })); await n.evaluate(c => Jogador.entrar(c), codigo);
      ok('quem entra com o Terror ligado já recebe o Terror', await ate(() => n.evaluate(() => Som.terror), 6000));
      await m.click('#m-terror');
      ok('o mestre desliga e o Terror some de quem estava com ele', await ate(() => n.evaluate(() => !Som.terror)));
      ok('o mestre vê "Desligado"', (await m.getAttribute('#m-terror', 'aria-pressed')) === 'false');
      await n.evaluate(() => Jogador.sairDaMesa()); await ate(async () => !(await m.textContent('#m-jogadores')).includes('Alger')); await cN.close(); }
    // notas secretas
    await m.click('.m-cj-ver'); await m.waitForSelector('#mf-nota');
    await m.click('#mf-nota'); await m.keyboard.type('Ele mente sobre o pai.');
    ok('a nota secreta é guardada sozinha', await ate(async () => (await m.textContent('#mf-nota-st')) === 'guardada' && srv.db.notas_mestre.length === 1 && srv.db.notas_mestre[0].texto === 'Ele mente sobre o pai.'), JSON.stringify({ st: await m.textContent('#mf-nota-st'), db: srv.db.notas_mestre }));
    await m.keyboard.type(' E deve 20 libras');
    await j.click('.adj[data-c="san"][data-d="-1"]');   // a ficha do jogador muda e o painel se redesenha ao vivo...
    await m.waitForTimeout(1800); await m.keyboard.type(' ao penhorista.');
    ok('...sem perder o que o mestre está digitando', (await m.inputValue('#mf-nota')) === 'Ele mente sobre o pai. E deve 20 libras ao penhorista.' && await m.evaluate(() => document.activeElement.id === 'mf-nota'), await m.inputValue('#mf-nota'));
    ok('e a versão completa é guardada', await ate(() => srv.db.notas_mestre[0].texto === 'Ele mente sobre o pai. E deve 20 libras ao penhorista.'));
    { const v = await axe(m); ok('ficha com notas sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    await m.click('#mf-ctrl');
    ok('"Corpo e mente" na ficha já escolhe o jogador', await ate(() => m.evaluate(u => !document.querySelector('#m-ficha') && document.querySelector('#c-para').value === u && document.activeElement.id === 'c-qtd', uidJ)));
    ok('a carta mostra que há nota secreta', await m.isVisible('.m-carta-j .m-cj-nota'));
    ok('o jogador NUNCA recebeu a nota', !JSON.stringify(srv.entregue[uidJ] || []).includes('penhorista'));
    ok('o jogador não consegue ler notas', (await j.evaluate(async () => (await (await Rede.tabela('jogador', 'notas_mestre')).select('*')).data.length)) === 0);
    ok('o jogador não consegue escrever notas', /permission|security|policy/i.test(JSON.stringify(await j.evaluate(async m2 => (await (await Rede.tabela('jogador', 'notas_mestre')).insert({ mesa_id: m2, user_id: 'x', texto: 'hack' })).error, srv.db.mesas[0].id))));
    ok('controle: nenhum erro de script', m.erros.length === 0 && j.erros.length === 0, [m.erros[0], j.erros[0]].filter(Boolean).join(' | ')); }

  console.log('\n7d) Cena: abas, Figuras, Roda do Destino, Duelo, Crônica, Dados, presença');
  { // uma segunda jogadora para a cena
    const cA = await contexto(browser, srv), a2 = await pagina(cA, URL_SITE);
    await a2.evaluate(f2 => { novoSlot(); P = sanear(f2); salvar(); P.step = 5; salvar(); iniciarPasso(); }, FICHA({ nome: 'Audrey', caminho: 'visionario' }));
    await a2.evaluate(c => Jogador.entrar(c), codigo);
    await ate(async () => (await m.textContent('#m-jogadores')).includes('Audrey'));
    const uidA = srv.db.jogadores.find(x => x.nome === 'Audrey').user_id, uidM = srv.db.mesas[0].mestre_id;
    // abas
    { const n = await m.evaluate(() => document.querySelectorAll('[role=tab].m-aba').length); ok('o Grimório tem 6 abas', n === 6, String(n)); }
    await m.focus('#aba-acoes'); await m.keyboard.press('ArrowRight');
    ok('setas do teclado trocam de aba', await m.evaluate(() => document.activeElement.id === 'aba-cena' && !document.querySelector('#p-cena').hidden && document.querySelector('#p-acoes').hidden));
    ok('a aba escolhida é lembrada', await m.evaluate(() => localStorage.getItem('lotm-grimorio-aba') === 'cena'));
    // presença
    ok('a vela da Audrey acende quando ela está com a mesa aberta', await ate(() => m.evaluate(u => !!document.querySelector('.m-carta-j[data-u="' + u + '"] .m-vela.acesa'), uidA)));
    // Figuras
    await m.fill('#f-nome', 'Lobo de Tingen'); await m.fill('#f-bonus', '2'); await m.fill('#f-pv', '18'); await m.click('#f-add');
    ok('chamar uma figura', await ate(async () => /Lobo de Tingen/.test(await m.textContent('#m-figuras'))));
    await m.click('.m-fig .fg-d[data-d="-5"]');
    ok('o PV da figura cai e fica salvo', await ate(() => srv.db.figuras[0].pv === 13) && /13/.test(await m.textContent('.m-fig .m-barra b')));
    ok('figura sem nome é barrada', await (async () => { await m.fill('#f-nome', ''); await m.click('#f-add'); return ate(async () => /nome/.test(await m.textContent('#m-erro-fig'))); })());
    ok('o jogador não vê as figuras', (await j.evaluate(async () => (await (await Rede.tabela('jogador', 'figuras')).select('*')).data.length)) === 0);
    { const v = await axe(m); ok('aba Cena sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    // Roda do Destino: d20 de Klein 18, Audrey 5, Lobo 10 (Agilidade da ficha: +1)
    srv.proximosDados(18, 5, 10);
    await m.click('#rd-girar');
    ok('a Roda gira com jogadores e a figura', await ate(() => srv.db.encontros[0] && srv.db.encontros[0].ordem.length === 3));
    ok('a ordem vem do servidor, do maior para o menor', srv.db.encontros[0].ordem.map(p => p.nome + ' ' + p.total).join(', ') === 'Klein 19, Lobo de Tingen 12, Audrey 6', srv.db.encontros[0].ordem.map(p => p.nome + ' ' + p.total).join(', '));
    ok('a faixa da Roda aparece no topo do Grimório', await ate(() => m.isVisible('#m-roda .rd-p.vez')));
    ok('a carta de quem está na vez ganha a chama', await m.evaluate(u => document.querySelector('.m-carta-j[data-u="' + u + '"]').classList.contains('na-vez'), uidJ));
    ok('o foco do teclado vai para "Próximo turno"', await m.evaluate(() => /^rd-prox2-/.test(document.activeElement.id)));
    ok('o jogador vê a Roda com os 3', await ate(() => j.evaluate(() => document.querySelectorAll('#roda-jog .rj-fila li').length === 3)), await j.evaluate(() => JSON.stringify({ estado: Jogador.estado, faixa: !!document.querySelector('#roda-jog'), n: document.querySelectorAll('#roda-jog .rj-fila li').length, enc: Jogador.encontro && Jogador.encontro.ativo })));
    ok('"É a sua vez" aparece para quem começa', await ate(() => j.isVisible('.sua-vez')) && await j.evaluate(() => document.querySelector('#roda-jog').classList.contains('minha')));
    ok('para os outros, a faixa diz de quem é a vez', await ate(async () => /Vez de Klein/.test(await a2.textContent('#roda-jog'))));
    { const v = await axe(j); ok('jogador com a Roda sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    await m.click('[id^="rd-prox2-"]');
    ok('próximo turno: vez da figura', await ate(async () => /Vez de Lobo de Tingen/.test(await j.textContent('#roda-jog'))));
    await m.click('[id^="rd-prox2-"]');
    ok('e a Audrey sente "É a sua vez"', await ate(() => a2.isVisible('.sua-vez')));
    await m.click('[id^="rd-prox2-"]');
    ok('a volta completa abre a rodada 2', await ate(() => srv.db.encontros[0].rodada === 2 && srv.db.encontros[0].vez === 0) && await ate(async () => /Rodada 2/.test(await j.textContent('#roda-jog'))));
    ok('jogador não passa o turno', /Batalha não encontrada/.test(await j.evaluate(async mesa => { try { await Rede.rpc('jogador', 'passar_turno', { p_batalha: mesa }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, srv.db.encontros[0].id)));
    await j.click('#roda-jog .rj-alt');
    ok('o jogador pode recolher a faixa', await j.evaluate(() => document.querySelector('#roda-jog').classList.contains('recolhida') && document.activeElement.classList.contains('rj-alt')));
    await m.click('[id^="rd-fim-"]'); await m.waitForSelector('.m-conf');
    { const v = await axe(m); ok('confirmação sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    await m.click('#cf-ok');
    ok('encerrar some com a Roda de todos', await ate(async () => !(await j.$('#roda-jog')) && !(await a2.$('#roda-jog')) && !(await m.isVisible('#m-roda'))));
    // várias batalhas: só quem o mestre marca entra
    const bat = nome => srv.db.encontros.find(e => e.ativo && e.nome === nome);
    await m.waitForSelector('#rd-nova'); await m.fill('#rd-nome', 'Batalha do Cais');
    await m.uncheck('#rd-nova input[name=rd-j][value="' + uidA + '"]');
    await m.click('#rd-girar');
    ok('batalha só com os escolhidos (Klein e o Lobo, sem Audrey)', await ate(() => bat('Batalha do Cais') && bat('Batalha do Cais').ordem.map(p => p.nome).sort().join(',') === 'Klein,Lobo de Tingen'), JSON.stringify((bat('Batalha do Cais') || {}).ordem));
    ok('Klein vê a faixa com o nome da batalha', await ate(async () => /Batalha do Cais/.test(await j.textContent('#roda-jog'))));
    ok('Audrey, fora da batalha, não vê Roda nenhuma', await (async () => { await espera(500); return !(await a2.$('#roda-jog')); })());
    ok('a nova batalha só oferece quem está livre (Audrey)', await ate(() => m.evaluate(u => [...document.querySelectorAll('#rd-nova input[name=rd-j]')].map(i => i.value).join() === u, uidA)));
    await m.fill('#rd-nome', 'Batalha da Catedral'); await m.check('#rd-nova input[name=rd-j][value="' + uidA + '"]'); await m.click('#rd-girar');
    ok('duas batalhas ao mesmo tempo', await ate(() => !!bat('Batalha da Catedral') && srv.db.encontros.filter(e => e.ativo).length === 2));
    ok('o topo do Grimório mostra as duas faixas', await ate(() => m.evaluate(() => document.querySelectorAll('#m-roda .rd-bat').length === 2)));
    ok('Audrey vê só a dela', await ate(async () => /Batalha da Catedral/.test(await a2.textContent('#roda-jog'))) && !/Cais/.test(await a2.textContent('#roda-jog')));
    ok('Klein não consegue ler a batalha da Catedral', (await j.evaluate(async () => ((await (await Rede.tabela('jogador', 'encontros')).select('nome,ativo')).data || []).filter(e => e.ativo).map(e => e.nome).join())) === 'Batalha do Cais');
    { const v = await axe(m); ok('duas batalhas sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    const cais = bat('Batalha do Cais'), cat = bat('Batalha da Catedral'), vezCais = cais.vez;
    await m.click('#rd-prox2-' + cat.id);
    ok('passar o turno de uma não mexe na outra', await ate(() => cat.rodada === 2) && cais.vez === vezCais && cais.rodada === 1);
    ok('Klein não pode estar em duas batalhas', /[Jj]á está/.test(await m.evaluate(async ([b, u]) => { try { await Rede.rpc('mestre', 'entrar_na_batalha', { p_batalha: b, p_tipo: 'jogador', p_id: u }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, [cat.id, uidJ])));
    // sair no meio: Klein foge do Cais e entra na Catedral
    await m.click('.rd-tirar[data-b="' + cais.id + '"][data-i="' + uidJ + '"]');
    ok('Klein sai do Cais sem acabar a batalha (o Lobo continua)', await ate(() => cais.ordem.length === 1 && cais.ativo && !cais.jogadores.includes(uidJ)));
    ok('a faixa some da tela de quem saiu', await ate(async () => !(await j.$('#roda-jog'))));
    ok('a Crônica registra a saída', srv.db.cronica.some(c => /Batalha do Cais — Klein sai na rodada 1/.test(c.texto)));
    const vezAntes = cat.ordem[cat.vez].id;
    await m.selectOption('#rd-sel-' + cat.id, 'jogador:' + uidJ); await m.click('#rd-entra-' + cat.id);
    ok('Klein entra na Catedral no meio da luta', await ate(() => cat.ordem.length === 2 && cat.jogadores.includes(uidJ)));
    ok('quem estava na vez continua na vez', cat.ordem[cat.vez].id === vezAntes, JSON.stringify(cat.ordem.map(p => p.nome)) + ' vez ' + cat.vez);
    ok('Klein agora vê a faixa da Catedral', await ate(async () => /Batalha da Catedral/.test(await j.textContent('#roda-jog'))));
    ok('a Crônica registra a entrada', srv.db.cronica.some(c => /Batalha da Catedral — Klein entra na rodada 2/.test(c.texto)));
    ok('jogador não tira ninguém da batalha', /Batalha não encontrada/.test(await j.evaluate(async ([b, u]) => { try { await Rede.rpc('jogador', 'sair_da_batalha', { p_batalha: b, p_tipo: 'jogador', p_id: u }); return 'aceitou'; } catch (e) { return Rede.mensagem(e); } }, [cat.id, uidA])));
    for (const b of [cais, cat]) { await m.click('#rd-fim-' + b.id); await m.waitForSelector('.m-conf'); await m.click('#cf-ok'); await ate(() => !b.ativo); }
    ok('encerrar as duas limpa a tela de todos', await ate(async () => !(await j.$('#roda-jog')) && !(await a2.$('#roda-jog')) && !(await m.isVisible('#m-roda'))));
    // Duelo
    await m.click('#aba-acoes');
    await m.fill('#d-rotulo', 'Queda de braço'); await m.selectOption('#d-a', 'jogador:' + uidJ); await m.selectOption('#d-a-attr', 'forca');
    await m.selectOption('#d-b', 'figura:' + srv.db.figuras[0].id);
    ok('figura não usa atributo (o bônus dela vale)', await m.evaluate(() => document.querySelector('#d-b-attr').disabled));
    srv.proximosDados(7, 15); await m.click('#d-rolar');
    ok('o duelo aparece no Grimório', await ate(async () => /Lobo de Tingen leva a melhor/.test(await m.textContent('#m-duelo-res'))));
    ok('o servidor usou a Força da ficha e o bônus da figura', /7 \+0/.test(await m.textContent('#m-duelo-res')) || /d20 7/.test(await m.textContent('#m-duelo-res')), (await m.textContent('#m-duelo-res')).replace(/\s+/g, ' '));
    ok('o jogador do duelo vê a cena', await ate(() => j.isVisible('.duelo-cena')) && /Lobo de Tingen/.test(await j.textContent('.duelo-cena')));
    await espera(800);
    ok('quem não está no duelo não vê', !(await a2.$('.duelo-cena')));
    { const v = await axe(j); ok('cena do duelo sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    await j.click('#dc-ok'); await ate(async () => !(await j.$('.duelo-cena')));
    await m.fill('#d-rotulo', 'Olhares na missa'); await m.selectOption('#d-a', 'jogador:' + uidJ); await m.selectOption('#d-a-attr', 'pres'); await m.selectOption('#d-b', 'jogador:' + uidA); await m.selectOption('#d-b-attr', 'pres');
    await m.click('#d-visivel'); await m.click('#d-rolar');
    ok('duelo escondido: só o mestre vê', await ate(async () => /só você viu/.test(await m.textContent('#m-duelo-res'))));
    await espera(900);
    ok('duelo escondido não chega a nenhum jogador', !(await j.$('.duelo-cena')) && !(await a2.$('.duelo-cena')) && !JSON.stringify(srv.entregue[uidJ] || []).includes('Olhares na missa') && !JSON.stringify(srv.entregue[uidA] || []).includes('Olhares na missa'));
    await m.click('#d-visivel');
    await m.selectOption('#d-b', 'jogador:' + uidJ); await m.click('#d-rolar');
    ok('o mesmo lado dos dois lados é barrado', await ate(async () => /dois lados diferentes/.test(await m.textContent('#m-erro-duelo'))));
    // anti-trapaça no teste aberto
    await m.selectOption('#t-para', uidJ); await m.selectOption('#t-attr', 'agil'); await m.fill('#t-rotulo', 'Pular a cerca'); await m.fill('#t-dif', '10'); await m.click('#t-aberto');
    await ate(() => j.evaluate(() => Jogador.pedidos.length === 1));
    const trapaca = await j.evaluate(async () => { const p = Jogador.pedidos[0]; return Rede.rpc('jogador', 'responder_pedido', { p_pedido: p.id, p_modificador: 30 }); });
    ok('teste aberto: +30 mandado pelo navegador é ignorado (vale a ficha)', trapaca.modificador === 1, JSON.stringify(trapaca));
    // Crônica
    await m.fill('#cr-texto', 'O grupo encontra o diário do bispo.'); await m.click('#cr-add');
    ok('registrar um momento', await ate(async () => /diário do bispo/.test(await m.textContent('#m-cron'))));
    await m.click('#cr-ler');
    ok('a crônica abre como página', await ate(() => m.isVisible('.cr-pagina')));
    const cron = (await m.textContent('.cr-pagina')).replace(/\s+/g, ' ');
    ok('a crônica junta momentos, duelos, testes, golpes e sussurros', /diário do bispo/.test(cron) && /Queda de braço/.test(cron) && /Pular a cerca/.test(cron) && /Mordida do lobo/.test(cron) && /O mapa rasgado/.test(cron), cron.slice(0, 200));
    ok('o Terror ligado para a mesa aparece uma vez só', (cron.match(/O Terror toma a mesa/g) || []).length === 1 || (cron.match(/O Terror toma a mesa/g) || []).length === 2, String((cron.match(/O Terror toma a mesa/g) || []).length));
    { const v = await axe(m); ok('crônica sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    const [dl] = await Promise.all([m.waitForEvent('download'), m.click('#cr-baixar2')]);
    const md = fs.readFileSync(await dl.path(), 'utf8');
    ok('baixar gera um .md com a crônica', /\.md$/.test(dl.suggestedFilename()) && /^# Crônica — Tingen/.test(md) && /diário do bispo/.test(md), dl.suggestedFilename());
    await m.keyboard.press('Escape');
    ok('Esc fecha a crônica e devolve o foco', await ate(async () => !(await m.$('.cr-pagina'))) && await m.evaluate(() => document.activeElement.id === 'cr-ler'));
    ok('o jogador não lê a crônica', (await j.evaluate(async () => (await (await Rede.tabela('jogador', 'cronica')).select('*')).data.length)) === 0);
    // Dados do mestre
    const antesDados = (srv.entregue[uidM] || []).length;
    await m.click('.dm-tipo[data-l="6"]'); await m.fill('#dm-qtd', '3'); await m.fill('#dm-mod', '2'); await m.click('#dm-rolar');
    const tot = Number(await m.textContent('.dm-tot'));
    { const n = await m.evaluate(() => document.querySelectorAll('#dm-res i').length); ok('dados do mestre: 3d6+2 entre 5 e 20', tot >= 5 && tot <= 20 && n === 3, tot + ' com ' + n + ' dados'); }
    ok('dados do mestre não vão ao servidor', (srv.entregue[uidM] || []).length === antesDados);
    { const v = await axe(m); ok('aba Dados sem violações de acessibilidade', v.length === 0, v.join(' | ')); }
    // tirar da mesa
    await m.click('.m-carta-j[data-u="' + uidA + '"] .m-cj-ver'); await m.waitForSelector('#mf-tirar'); await m.click('#mf-tirar'); await m.waitForSelector('.m-conf'); await m.click('#cf-ok');
    ok('tirar da mesa remove a carta', await ate(async () => !(await m.textContent('#m-jogadores')).includes('Audrey')));
    await a2.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    ok('a jogadora tirada é avisada', await ate(async () => (await a2.evaluate(() => Jogador.estado)) === 'fora' && /tirou você/.test(await a2.evaluate(() => document.querySelector('#online') ? document.querySelector('#online').textContent : ''))) || await ate(() => a2.evaluate(() => Jogador.estado === 'fora')));
    ok('cena: nenhum erro de script', m.erros.length === 0 && j.erros.length === 0 && a2.erros.length === 0, [m.erros[0], j.erros[0], a2.erros[0]].filter(Boolean).join(' | '));
    await cA.close(); }

  console.log('\n7e) Bestiário e habilidades da mesa');
  { const uidJ = srv.db.jogadores.find(x => x.nome === 'Klein').user_id, uidM = srv.db.mesas[0].mestre_id;
    const semViolacoes = async (p, nome) => { const v = await axe(p); ok(nome + ' sem violações de acessibilidade', v.length === 0, v.join(' | ')); };
    const fecharCena = async () => { for (const sel of ['#dc-ok', '#sus-ok', '#dec-ok']) if (await j.isVisible(sel)) { await j.click(sel); await espera(300); } };
    // ---- bestiário
    await m.click('#aba-bestiario'); await m.click('#bs-nova'); await m.waitForSelector('#be-nome');
    await m.click('#be-salvar');
    ok('criatura sem nome não é guardada', await ate(async () => /nome/.test(await m.textContent('#be-erro'))) && srv.db.bestiario.length === 0);
    await m.fill('#be-nome', 'Lobo de Tingen'); await m.fill('#be-pv', '20'); await m.fill('#be-m-agil', '3'); await m.fill('#be-m-forca', '5');
    await m.click('#be-hab-mais'); await m.fill('#be-h-nome-0', 'Mordida'); await m.fill('#be-h-efeito-0', '2d6+3 de dano');
    await m.fill('#be-desc', 'Olhos de vidro.'); await m.fill('#be-notas', 'Foge do fogo.');
    await semViolacoes(m, 'editor de criatura');
    await m.click('#be-salvar');
    ok('a criatura entra no bestiário', await ate(async () => srv.db.bestiario.length === 1 && await m.isVisible('.bs-carta')));
    const bes = srv.db.bestiario[0] || { mods: {}, habilidades: [{}] };
    ok('guarda modificadores, poderes e o dono', bes.mods.forca === 5 && bes.mods.agil === 3 && bes.habilidades[0].efeito === '2d6+3 de dano' && bes.dono === uidM);
    await semViolacoes(m, 'aba Bestiário');
    { const r = await j.evaluate(async () => { const a = await (await Rede.tabela('jogador', 'bestiario')).select('*'); const b = await (await Rede.tabela('jogador', 'bestiario')).insert({ nome: 'x' }).select('id'); return { lidos: (a.data || []).length, negado: !!b.error }; });
      ok('jogador não lê o bestiário do mestre', r.lidos === 0);
      ok('jogador não escreve no bestiário', r.negado && srv.db.bestiario.length === 1); }
    ok('notas e números da criatura nunca chegam ao jogador', !JSON.stringify(srv.entregue[uidJ] || []).includes('Foge do fogo'));
    // ---- chamar à cena, ficha, rolar poder, ferir
    await m.click('.bs-chamar'); await ate(() => srv.db.figuras.some(f => f.ficha_id === bes.id));
    await m.click('.bs-chamar');
    ok('chamar duas vezes numera (nomes distintos)', await ate(() => { const fs2 = srv.db.figuras.filter(f => f.ficha_id === bes.id); return fs2.length === 2 && fs2[0].nome !== fs2[1].nome && /^Lobo de Tingen [0-9]$/.test(fs2[1].nome); }), JSON.stringify(srv.db.figuras.map(f => f.nome)));
    const fig = srv.db.figuras.find(f => f.ficha_id === bes.id) || {};
    ok('a figura nasce com PV cheio, iniciativa = Agilidade e os modificadores', fig.pv === 20 && fig.pv_max === 20 && fig.bonus === 3 && fig.mods && fig.mods.forca === 5);
    await m.click('#aba-cena'); await m.click(`.m-fig[data-f="${fig.id}"] .fg-ficha`); await m.waitForSelector('.bs-ficha');
    await m.click('#bf-rolar-0'); const tot = Number(await m.textContent('#bf-res-0 .bf-tot'));
    ok('rolar o poder: 2d6+3 dá entre 5 e 15', tot >= 5 && tot <= 15, String(tot));
    const nOrd = srv.db.ordens.length; await m.selectOption('#bf-alvo-0', uidJ); await m.click('#bf-pv-0');
    ok('"Ferir" manda a ordem de dano com o nome do poder', await ate(() => { const o = srv.db.ordens[srv.db.ordens.length - 1]; return srv.db.ordens.length === nOrd + 1 && o.valor === -tot && o.para === uidJ && o.motivo === fig.nome + ': Mordida'; }));
    await semViolacoes(m, 'ficha da criatura');
    await m.keyboard.press('Escape');
    ok('Esc fecha a ficha da criatura e devolve o foco', await ate(() => m.evaluate(() => !document.querySelector('.bs-ficha') && document.activeElement.classList.contains('fg-ficha'))));
    await ate(() => j.evaluate(() => !document.querySelector('.golpe, .golpe-tela'))); await fecharCena();
    // ---- Duelo com o atributo da criatura
    srv.proximosDados(10, 10);
    await m.click('#aba-acoes'); await m.selectOption('#d-a', 'jogador:' + uidJ); await m.selectOption('#d-a-attr', 'forca'); await m.selectOption('#d-b', 'figura:' + fig.id);
    ok('figura do bestiário libera o atributo no Duelo', await m.evaluate(() => !document.querySelector('#d-b-attr').disabled));
    await m.selectOption('#d-b-attr', 'forca'); await m.click('#d-rolar');
    ok('o Duelo usa a Força da criatura (+5)', await ate(() => { const d = srv.db.disputas[srv.db.disputas.length - 1]; return d && d.b.atributo === 'forca' && d.b.mod === 5 && d.b.total === 15; }));
    await ate(() => j.isVisible('#dc-ok'), 3000); await fecharCena();
    // ---- revelar
    await m.click('#aba-bestiario'); await m.click('.bs-revelar'); await m.waitForSelector('#rv-ok');
    await semViolacoes(m, 'escolher para quem revelar');
    await m.click('[data-rv="nenhum"]'); await m.click('#rv-ok');
    ok('revelar para ninguém é barrado', await m.isVisible('#rv-erro') && !srv.db.sussurros.some(s => s.titulo === 'Lobo de Tingen'));
    await m.click('[data-rv="todos"]'); await m.click('#rv-ok');
    ok('revelar manda um sussurro para todos com nome e descrição (sem as notas)', await ate(() => srv.db.sussurros.some(s => s.titulo === 'Lobo de Tingen' && s.para === null && s.texto === 'Olhos de vidro.')) && !srv.db.sussurros.some(s => /Foge do fogo/.test(s.texto || '')));
    await ate(() => j.isVisible('#sus-ok'), 4000); await fecharCena();

    // ---- habilidades: o jogador propõe pela ficha
    if (await j.isVisible('#mesa')) await j.click('#mesa-x');
    await j.fill('#hab-nome', 'Truque do palhaço'); await j.fill('#hab-desc', 'O inimigo perde a próxima ação.');
    ok('na mesa, o formulário da ficha vira "Propor ao mestre"', await j.evaluate(() => /Propor/.test(document.querySelector('#hab-tt').textContent) && !document.querySelector('#hab-extra').hidden));
    await j.fill('#hab-efeito', 'Perde 1 ação'); await j.click('#hab-ok');
    ok('a proposta vai ao servidor como pendente', await ate(() => srv.db.habilidades.some(h => h.nome === 'Truque do palhaço' && h.estado === 'pendente' && h.origem === 'jogador' && h.user_id === uidJ && h.efeito === 'Perde 1 ação')));
    ok('não vira anotação local', await j.evaluate(() => !P.habilidades.some(h => h.nome === 'Truque do palhaço')));
    ok('aparece na ficha como "Aguardando o mestre"', await ate(() => j.evaluate(() => /Aguardando o mestre/.test(document.querySelector('#hab-mesa').textContent))));
    ok('o mestre vê o pedido de poder ao vivo', await ate(() => m.isVisible('#m-propostas .hp-prop')));
    ok('a carta do jogador ganha o selo "1 proposta"', /1 proposta/.test(await m.textContent(`.m-carta-j[data-u="${uidJ}"]`)));
    await semViolacoes(m, 'pedidos de poder');
    { const r = await j.evaluate(async mesa => {
        const t = () => Rede.tabela('jogador', 'habilidades');
        const ins = await (await t()).insert({ mesa_id: mesa, user_id: 'x', nome: 'Deus', origem: 'mestre', estado: 'aprovada' }).select('id');
        const h = ((await (await t()).select('id').eq('estado', 'pendente')).data || [])[0];
        await (await t()).update({ estado: 'aprovada' }).eq('id', h.id);
        return !!ins.error;
      }, srv.db.mesas[0].id);
      ok('jogador não concede habilidade a si mesmo direto na tabela', r && !srv.db.habilidades.some(h => h.nome === 'Deus'));
      ok('jogador não aprova a própria proposta', srv.db.habilidades.find(h => h.nome === 'Truque do palhaço').estado === 'pendente'); }
    { const lim = await j.evaluate(async () => { for (let i = 0; i < 4; i++) await Jogador.propor({ nome: 'P' + i }); try { await Jogador.propor({ nome: 'P9' }); return 'passou'; } catch (e) { return Rede.mensagem(e); } });
      ok('limite de 5 propostas esperando', /Limite de 5/.test(lim), lim); }
    await j.evaluate(async () => { for (const h of Jogador.habilidades.filter(x => /^P\d$/.test(x.nome))) await Jogador.retirar(h.id); });
    ok('o jogador retira as próprias propostas', await ate(() => !srv.db.habilidades.some(h => /^P\d$/.test(h.nome))));
    // ---- modificar e aprovar
    const hid = srv.db.habilidades.find(h => h.nome === 'Truque do palhaço').id;
    await ate(() => m.isVisible(`#q${hid}-mud`)); await m.click(`#q${hid}-mud`);
    await m.fill(`#q${hid}-efeito`, 'Perde metade da ação'); await m.fill(`#q${hid}-resp`, 'Reduzi para a Sequência 9.'); await m.click(`#q${hid}-okm`);
    ok('aprovar com mudanças grava a versão do mestre e o recado', await ate(() => { const h = srv.db.habilidades.find(x => x.id === hid); return h.estado === 'aprovada' && h.alterada && h.efeito === 'Perde metade da ação' && h.resposta === 'Reduzi para a Sequência 9.'; }));
    ok('o jogador recebe o decreto "Aprovada, com mudanças"', await ate(() => j.evaluate(() => /Aprovada, com mudanças/.test((document.querySelector('.decreto') || {}).textContent || '') && /Reduzi/.test(document.querySelector('.decreto').textContent))));
    await semViolacoes(j, 'decreto do mestre');
    await j.click('#dec-ok');
    ok('o decreto lido fica marcado (não volta ao reconectar)', await ate(() => j.evaluate(id => (JSON.parse(localStorage.getItem('lotm-rpg-habs-vistas') || '{}')[id] || '').startsWith('aprovada|'), hid)));
    // ---- rejeitar com motivo
    await j.evaluate(() => Jogador.propor({ nome: 'Chama absoluta', desc: 'Queima tudo' }));
    const rid = await (async () => { await ate(() => srv.db.habilidades.some(h => h.nome === 'Chama absoluta')); return srv.db.habilidades.find(h => h.nome === 'Chama absoluta').id; })();
    await ate(() => m.isVisible(`#q${rid}-rej`)); await m.click(`#q${rid}-rej`); await m.fill(`#q${rid}-mot`, 'Não combina com o Caminho.'); await m.click(`#q${rid}-okr`);
    ok('rejeitar com motivo', await ate(() => { const h = srv.db.habilidades.find(x => x.id === rid); return h.estado === 'rejeitada' && h.resposta === 'Não combina com o Caminho.'; }));
    ok('o jogador vê a recusa e o motivo', await ate(() => j.evaluate(() => { const d = document.querySelector('.decreto.recusa'); return !!d && /Não combina/.test(d.textContent); })));
    await j.click('#dec-ok');
    ok('a fila de pedidos some quando não há mais nada', await ate(() => m.evaluate(() => document.querySelector('#m-propostas').hidden)));
    await j.evaluate(id => Jogador.retirar(id), rid);
    ok('o jogador dispensa a recusada', await ate(() => !srv.db.habilidades.some(h => h.id === rid)));
    // ---- conceder, editar e tirar pela ficha do jogador
    await m.click(`.m-carta-j[data-u="${uidJ}"] .m-cj-ver`); await m.waitForSelector('.mf-conceder'); await m.evaluate(() => { document.querySelector('.mf-conceder').open = true; });
    await m.fill(`#c${uidJ}-nome`, 'Visão Espiritual'); await m.fill(`#c${uidJ}-custo`, '1 de Espiritualidade'); await m.click('#mf-conceder');
    ok('conceder pela ficha do jogador', await ate(() => srv.db.habilidades.some(h => h.nome === 'Visão Espiritual' && h.origem === 'mestre' && h.estado === 'aprovada' && h.user_id === uidJ)));
    ok('o jogador recebe "O mestre concede"', await ate(() => j.evaluate(() => /O mestre concede/.test((document.querySelector('.decreto') || {}).textContent || ''))));
    await j.click('#dec-ok');
    const vid = srv.db.habilidades.find(h => h.nome === 'Visão Espiritual').id;
    await m.click(`#e${vid}-ed`); await m.fill(`#e${vid}-nome`, 'Visão Espiritual aguçada'); await m.click(`#e${vid}-ok`);
    ok('editar uma habilidade concedida', await ate(() => srv.db.habilidades.find(h => h.id === vid).nome === 'Visão Espiritual aguçada'));
    ok('o jogador vê "O mestre reescreve"', await ate(() => j.evaluate(() => /O mestre reescreve/.test((document.querySelector('.decreto') || {}).textContent || ''))));
    await j.click('#dec-ok');
    await semViolacoes(m, 'habilidades na ficha do jogador');
    await m.click(`#e${vid}-x`); await m.waitForSelector('.m-conf'); await m.click('#cf-ok');
    ok('tirar a habilidade some da ficha do jogador', await ate(async () => !srv.db.habilidades.some(h => h.id === vid) && await j.evaluate(id => !Jogador.habilidades.some(h => h.id === id), vid)));
    await m.keyboard.press('Escape');
    // ---- bênçãos, maldições e selos
    { const k = 'x' + uidJ, sel = id => '#' + k + '-' + id, modF = (srv.db.jogadores.find(x => x.user_id === uidJ).ficha.mods || {}).forca || 0;
      await m.click(`.m-carta-j[data-u="${uidJ}"] .m-cj-ver`); await m.waitForSelector('.mf-efeitos');
      await m.evaluate(() => { document.querySelector('.mf-novo-ef').open = true; });
      await m.selectOption(sel('attr'), 'forca'); await m.selectOption(sel('val'), '2'); await m.fill(sel('rot'), 'Bênção da Deusa'); await m.fill(sel('desc'), 'Até a lua cheia.');
      await m.click(sel('ok'));
      ok('o mestre abençoa (Força +2, avisando)', await ate(() => srv.db.efeitos.some(e => e.rotulo === 'Bênção da Deusa' && e.valor === 2 && e.atributo === 'forca' && !e.secreto)));
      ok('o jogador recebe o decreto da bênção', await ate(() => j.isVisible('.decreto.ef-bencao')) && /Bênção da Deusa/.test(await j.textContent('.decreto')));
      await semViolacoes(j, 'decreto da bênção'); await j.click('#dec-ok');
      ok('a bênção aparece em "Sobre você" na ficha', await ate(async () => /Bênção da Deusa/.test(await j.textContent('#ef-jog'))));
      // maldição secreta
      await m.click('.ef-tipo.ef-maldicao'); await m.waitForSelector(sel('val'));
      await m.selectOption(sel('attr'), 'forca'); await m.selectOption(sel('val'), '5'); await m.fill(sel('rot'), 'Olhar do Abismo'); await m.check(sel('sec'));
      await m.click(sel('ok'));
      ok('maldição em segredo fica guardada', await ate(() => srv.db.efeitos.some(e => e.rotulo === 'Olhar do Abismo' && e.valor === -5 && e.secreto)));
      ok('a carta do jogador mostra a maldição oculta', await ate(async () => /1 maldição oculta/.test(await m.textContent(`.m-carta-j[data-u="${uidJ}"] .m-cj-ef`))));
      await espera(600);
      ok('o jogador NUNCA recebe a maldição secreta', !JSON.stringify(srv.entregue[uidJ] || []).includes('Olhar do Abismo') && !(await j.isVisible('.decreto')));
      ok('o jogador não consegue ler a maldição', (await j.evaluate(async () => ((await (await Rede.tabela('jogador', 'efeitos')).select('rotulo')).data || []).map(e => e.rotulo).join())) === 'Bênção da Deusa');
      srv.proximosDados(10);
      const sec = await m.evaluate(async ([mesa, u]) => Rede.rpc('mestre', 'rolar_secreto', { p_mesa: mesa, p_para: u, p_rotulo: 'Força', p_atributo: 'forca', p_lados: 20, p_dificuldade: 12 }), [srv.db.mesas[0].id, uidJ]);
      ok('o teste secreto do mestre soma bênção e maldição', sec.modificador === modF + 2 - 5, JSON.stringify(sec));
      const r = srv.db.resultados.find(x => x.pedido_id === sec.pedido), sg = srv.db.segredos_pedido.find(x => x.pedido_id === sec.pedido);
      ok('o resultado guardado mostra só o que o jogador sabe; a parte secreta fica com o mestre', r.modificador === modF + 2 && sg.oculto === -5);
      const pid = await m.evaluate(async ([mesa, u]) => Rede.rpc('mestre', 'pedir_teste', { p_mesa: mesa, p_para: u, p_rotulo: 'Força', p_atributo: 'forca', p_lados: 20, p_dificuldade: 10 }), [srv.db.mesas[0].id, uidJ]);
      srv.proximosDados(10);
      const ab = await j.evaluate(async id => Rede.rpc('jogador', 'responder_pedido', { p_pedido: id, p_modificador: 0 }), pid);
      ok('no teste aberto o jogador vê o número sem a maldição', ab.modificador === modF + 2, JSON.stringify(ab));
      ok('...e o mestre vê o total real', await ate(() => m.evaluate(async id => { const r2 = await (await Rede.tabela('mestre', 'resultados_mestre')).select('*').eq('pedido_id', id); return r2.data[0].modificador; }, pid).then(v => v === modF + 2 - 5)));
      await fecharCena();
      // selar uma habilidade, avisando
      await m.click('.ef-tipo.ef-bloqueio'); await m.waitForSelector(sel('hab'));
      const hab = await m.evaluate(s2 => document.querySelector(s2).value, sel('hab'));
      await m.fill(sel('rot'), 'Selo do Bispo'); await m.click(sel('ok'));
      ok('o mestre sela uma habilidade', await ate(() => srv.db.efeitos.some(e => e.tipo === 'bloqueio' && e.habilidade === hab)), hab);
      ok('o jogador recebe o decreto do selo', await ate(() => j.isVisible('.decreto.ef-bloqueio')), await j.evaluate(() => JSON.stringify({ ef: Jogador.efeitos.map(e => e.rotulo), dec: document.querySelector('.decreto') && document.querySelector('.decreto').className, cena: [...document.querySelectorAll('.sussurro, .duelo-cena, [role=dialog]')].map(e => e.className).join('|') }))); if (await j.isVisible('#dec-ok')) await j.click('#dec-ok');
      ok('a habilidade aparece selada na ficha do jogador', await ate(() => j.evaluate(h => [...document.querySelectorAll('.hab-lista li.selada b')].some(b => b.textContent.trim() === h), hab)));
      ok('...e na ficha que o mestre vê', await ate(() => m.evaluate(h => [...document.querySelectorAll('.mf-hab li.selada b')].some(b => b.textContent.trim() === h), hab)));
      await semViolacoes(m, 'bênçãos, maldições e selos na ficha');
      // revelar a maldição: agora o jogador sabe
      const mal = srv.db.efeitos.find(e => e.rotulo === 'Olhar do Abismo');
      await m.click('#ef-rv-' + mal.id);
      ok('revelar a maldição manda o decreto', await ate(() => !mal.secreto) && await ate(() => j.isVisible('.decreto.ef-maldicao'))); await j.click('#dec-ok');
      // desfazer a bênção avisando
      const ben = srv.db.efeitos.find(e => e.rotulo === 'Bênção da Deusa');
      await m.click('#ef-x-' + ben.id);
      ok('desfazer avisando: some e o jogador recebe "A bênção se esvai"', await ate(() => !srv.db.efeitos.includes(ben)) && await ate(() => srv.db.sussurros.some(x => x.para === uidJ && x.titulo === 'A bênção se esvai')));
      ok('a Crônica registra os efeitos', await ate(() => ['Bênção da Deusa (', 'Olhar do Abismo (Força −5) · em segredo', 'descobre: Olhar do Abismo', 'Bênção da Deusa desfeita'].every(t => srv.db.cronica.some(c => c.texto.includes(t)))), srv.db.cronica.map(c => c.texto).slice(-6).join(' / '));
      ok('o jogador não se abençoa', /security|policy|permission/i.test(JSON.stringify(await j.evaluate(async ([mesa, u]) => (await (await Rede.tabela('jogador', 'efeitos')).insert({ mesa_id: mesa, user_id: u, tipo: 'bencao', atributo: 'forca', valor: 9, rotulo: 'eu' })).error, [srv.db.mesas[0].id, uidJ]))));
      ok('o jogador não apaga a maldição', await j.evaluate(async mesa => { await (await Rede.tabela('jogador', 'efeitos')).delete().eq('mesa_id', mesa); }, srv.db.mesas[0].id).then(() => srv.db.efeitos.some(e => e.rotulo === 'Olhar do Abismo')));
      await ate(() => j.isVisible('#sus-ok'), 4000); await fecharCena();
      await m.keyboard.press('Escape'); }
    // ---- outra jogadora não vê as habilidades de Klein
    { const cB = await contexto(browser, srv), b2 = await pagina(cB, URL_SITE);
      await b2.evaluate(f2 => { novoSlot(); P = sanear(f2); salvar(); P.step = 5; salvar(); iniciarPasso(); }, FICHA({ nome: 'Zelda' }));
      await b2.evaluate(c => Jogador.entrar(c), codigo); await ate(() => srv.db.jogadores.some(x => x.nome === 'Zelda'));
      const n = await b2.evaluate(async () => ((await (await Rede.tabela('jogador', 'habilidades')).select('*')).data || []).length);
      ok('uma jogadora não vê as habilidades da outra', n === 0 && srv.db.habilidades.some(h => h.user_id === uidJ), String(n));
      await b2.evaluate(() => Jogador.sairDaMesa()); await ate(() => !srv.db.jogadores.some(x => x.nome === 'Zelda')); await cB.close(); }
    ok('bestiário e habilidades: nenhum erro de script', m.erros.length === 0 && j.erros.length === 0, [m.erros[0], j.erros[0]].filter(Boolean).join(' | '));
  }

  console.log('\n8) Ficha ao vivo');
  if (await j.isVisible('#mesa')) await j.click('#mesa-x'); await j.click('.adj[data-c="pv"][data-d="-5"]');
  const pvNovo = await j.evaluate(() => P.pv);
  ok('perder PV no jogador aparece no painel do mestre', await ate(async () => (await m.textContent('.m-carta-j .m-barra b')).startsWith(pvNovo + '/'), 6000), await m.textContent('.m-carta-j .m-barra b'));
  ok('o envio da ficha é econômico (só quando muda)', await (async () => { const n = srv.db.jogadores[0].atualizado_em; await espera(1800); return srv.db.jogadores[0].atualizado_em === n; })());

  console.log('\n9) Reconexão e saída');
  await j.reload(); await j.waitForTimeout(400);
  await j.click('#btn-continue'); await j.waitForTimeout(500);
  ok('ao recarregar, o jogador volta sozinho para a mesa', await ate(() => j.evaluate(() => Jogador.estado === 'ligado'), 6000), await j.evaluate(() => Jogador.estado));
  await m.fill('#t-rotulo', 'Depois de recarregar'); await m.click('#t-aberto');
  ok('e continua recebendo pedidos', await ate(() => j.evaluate(() => Jogador.pedidos.length === 1)));
  await j.click('#fab-mesa'); await ate(() => j.isVisible('#on-sair')); await j.click('#on-sair');
  ok('sair da mesa tira o jogador do painel do mestre', await ate(async () => (await m.$$('.m-carta-j')).length === 0));
  ok('depois de sair, volta o campo do código', await ate(() => j.isVisible('#on-cod')));

  console.log('\n9b) Entrar pela capa, sem ficha pronta');
  { const c = await contexto(browser, srv); const p = await pagina(c, URL_SITE);
    await p.click('#btn-entrar-mesa'); await p.waitForSelector('#on-nome');
    await p.fill('#on-nome', 'Audrey'); await p.fill('#on-cod', codigo); await p.click('#on-entrar');
    ok('entra só com nome e código', await ate(() => p.evaluate(() => Jogador.estado === 'ligado')), await p.evaluate(() => Jogador.estado));
    ok('o mestre vê a jogadora nova', await ate(async () => (await m.textContent('#m-jogadores')).includes('Audrey')));
    ok('sem atributos, o mestre vê "—" (nada inventado)', await m.evaluate(() => { const c2 = [...document.querySelectorAll('.m-carta-j')].find(x => x.textContent.includes('Audrey')); return [...c2.querySelectorAll('.m-mods b')].every(b => b.textContent === '—'); }));
    ok('a capa passa a oferecer "Continuar" com essa ficha', await ate(async () => /Audrey/.test(await p.textContent('#btn-continue')) && await p.isVisible('#btn-continue')));
    ok('sem erros de script', p.erros.length === 0, p.erros[0] || '');
    await c.close(); }

  console.log('\n10) Robustez');
  srv.db.jogadores.push({ mesa_id: srv.db.mesas[0].id, user_id: 'estranho', nome: '<img src=x onerror=alert(1)>', ficha: { mods: { forca: 'muito', agil: 999 }, pv: null, pvMax: 'x', san: -4, caminhoId: '../../x', cor: 'red;background:url(x)', seqNome: '<img src=y onerror=alert(2)>', hab: [{ nome: '<b>x</b>' }, 'lixo', null], raca: 'humano' }, atualizado_em: '' });
  await m.evaluate(() => document.querySelector('#m-voltar').click()); await m.waitForSelector('.m-mesa'); await m.click('.m-mesa');
  ok('ficha estranha não quebra o painel', await ate(() => m.isVisible('.m-carta-j')));
  ok('nome com HTML é mostrado como texto', await m.evaluate(() => ![...document.querySelectorAll('.m-carta-j img')].some(i => !/^img\/sigilos\/[a-z]+\.webp$/.test(i.getAttribute('src'))) && document.querySelector('.m-carta-j .m-cj-id b').textContent.startsWith('<img')));
  ok('modificador absurdo é limitado a ±30', (await m.$$eval('.m-carta-j .m-mods b', b => b.map(x => x.textContent))).includes('+30'));
  ok('nenhum erro de script no mestre', m.erros.length === 0, m.erros[0] || '');
  ok('nenhum erro de script no jogador', j.erros.length === 0, j.erros[0] || '');
  await m.evaluate(() => document.querySelector('#m-voltar').click()); await m.waitForSelector('[data-apagar-mesa]');
  await m.click('[data-apagar-mesa]'); await m.waitForSelector('#cf-in');
  ok('apagar mesa exige digitar o código', await m.evaluate(() => document.querySelector('#cf-ok').disabled));
  await m.fill('#cf-in', codigo.toLowerCase());
  ok('com o código digitado, libera', await m.evaluate(() => !document.querySelector('#cf-ok').disabled));
  await m.click('#cf-ok');
  ok('a mesa e tudo dela somem', await ate(() => srv.db.mesas.length === 0 && ['jogadores', 'pedidos', 'resultados', 'sussurros', 'ordens', 'figuras', 'disputas', 'cronica', 'encontros', 'notas_mestre', 'habilidades'].every(t => srv.db[t].length === 0)) && await ate(async () => !(await m.$('[data-apagar-mesa]'))));
  ok('o bestiário é do mestre: continua depois de apagar a mesa', srv.db.bestiario.length === 1);
  await m.click('#m-sair');
  ok('sair do grimório volta ao login', await ate(() => m.isVisible('#m-email')));
  await ctxM.close(); await ctxJ.close();

  console.log('\n11) Celular');
  { const s2 = criarServidor(); s2.criarMestre(EMAIL, SENHA); const c = await contexto(browser, s2, { viewport: { width: 375, height: 812 } });
    const p = await mestreLogado(c); await p.fill('#m-nome-mesa', 'Mesa pequena'); await p.click('#m-nova'); await p.waitForSelector('#m-codigo');
    const larg = await p.evaluate(() => document.documentElement.scrollWidth);
    ok('painel do mestre sem rolagem lateral em 375px', larg <= 375, larg + 'px');
    await c.close(); }

  await browser.close();
  console.log(`\n${total - falhas} de ${total} testes passaram${falhas ? ` — ${falhas} FALHARAM` : ''}`);
  process.exit(falhas ? 1 : 0);
})();
