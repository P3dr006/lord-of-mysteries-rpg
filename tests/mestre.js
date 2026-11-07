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
async function pagina(ctx, url) { const p = await ctx.newPage(); p.erros = []; p.on('pageerror', e => p.erros.push(e.message)); await p.goto(url); await p.waitForTimeout(300); return p; }
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
  const naTela = await m.evaluate(() => ({ nome: document.querySelector('.m-carta-j .m-cj-id b').textContent, mods: [...document.querySelectorAll('.m-carta-j .m-mods b')].map(b => b.textContent), pv: document.querySelector('.m-carta-j .m-barra b').textContent }));
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

  console.log('\n8) Ficha ao vivo');
  await j.click('#mesa-x'); await j.click('.adj[data-c="pv"][data-d="-5"]');
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
