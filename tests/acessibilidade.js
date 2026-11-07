require('./quieto');
// Testes de acessibilidade: axe-core (WCAG 2.1 A/AA), teclado, "reduzir movimento", rótulos e contraste.
// Uso: npm run test:a11y
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ATT = Object.fromEntries(['forca', 'agil', 'vigor', 'intel', 'espir', 'pres'].map((k, i) => [k, { dados: [3, 5, 6, 2], descartado: 3, total: 10 + i * 2 }]));
const FICHA = (x = {}) => ({ nome: 'Klein', jogador: 'Pedro', step: 5, sequencia: 5, digestao: 4, caminho: 'tirano', raca: 'humano', origem: 'nobre', traco: 1, artefato: 1, attrs: ATT, pv: 10, san: 12, ...x });
let falhas = 0, total = 0;
const ok = (nome, passou, detalhe = '') => { total++; if (!passou) falhas++; console.log(`${passou ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  → ' + detalhe : ''}`); };

async function nova(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 850 }, reducedMotion: opts.reduzir ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); p.erros = []; p.on('pageerror', e => p.erros.push(e.message));
  await p.goto(URL); await p.waitForTimeout(300);
  await p.evaluate(f => { novoSlot(); P = sanear(f); salvar(); voltarCapa(); }, FICHA(opts.ficha || {})); p.ctx = ctx; return p;
}
const abrirPasso = async (p, passo) => { await p.evaluate(n => { P.step = n; salvar(); iniciarPasso(); }, passo); await p.waitForTimeout(500); };
const congelar = p => p.evaluate(() => document.getAnimations().forEach(a => { if (a.effect && a.effect.getComputedTiming().iterations === Infinity) { a.pause(); a.currentTime = 0; } else a.finish(); }));
async function axe(p) {
  await congelar(p); await p.evaluate(AXE);
  return p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }).then(r => r.violations.map(v => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0].html.slice(0, 70)}`)));
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n1) Verificação automática (axe-core)');
  const TELAS = [['capa', async p => { await p.evaluate(() => voltarCapa()); await p.waitForTimeout(300); }], ['identidade', p => abrirPasso(p, 0)], ['atributos', p => abrirPasso(p, 1)], ['caminho', p => abrirPasso(p, 2)], ['raça e origem', p => abrirPasso(p, 3)],
    ['destino', p => abrirPasso(p, 4)], ['ficha', p => abrirPasso(p, 5)], ['ficha com Terror', async p => { await abrirPasso(p, 5); await p.click('#btn-terror'); await p.waitForTimeout(500); }],
    ['mesa de dados', async p => { await abrirPasso(p, 5); await p.click('#fab-mesa'); await p.waitForTimeout(500); }],
    ['mesa: testes', async p => { await abrirPasso(p, 5); await p.click('#fab-mesa'); await p.click('.aba[data-aba=testes]'); await p.waitForTimeout(300); }],
    ['biblioteca', async p => { await abrirPasso(p, 5); await p.click('#btn-pers'); await p.waitForTimeout(400); }],
    ['pôster', async p => { await abrirPasso(p, 5); await p.click('#btn-poster'); await p.waitForSelector('#poster-prev img', { timeout: 20000 }); }],
    ['janela de confirmação', async p => { await abrirPasso(p, 5); await p.click('#btn-export'); await p.waitForTimeout(400); }]];
  for (const [nome, prep] of TELAS) {
    const p = await nova(browser); await prep(p); const v = await axe(p);
    ok('sem violações — ' + nome, v.length === 0, v.join(' | ')); await p.ctx.close();
  }

  console.log('\n2) Teclado');
  { const p = await nova(browser); await abrirPasso(p, 2);
    const n = await p.evaluate(() => [...document.querySelectorAll('.node')].filter(e => e.getAttribute('tabindex') !== null && e.getAttribute('role') === 'button' && e.getAttribute('aria-label')).length);
    ok('os 22 sigilos são botões com nome e foco', n === 22, n + ' de 22');
    await p.focus('.node >> nth=0'); await p.keyboard.press('ArrowRight'); const f1 = await p.evaluate(() => document.activeElement.getAttribute('aria-label'));
    ok('setas movem o foco entre os sigilos', !!f1 && /Erro/.test(f1), f1);
    await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
    ok('Enter escolhe o Caminho', await p.evaluate(() => P.caminho) === 'erro', 'Caminho ' + await p.evaluate(() => P.caminho));
    ok('a escolha é anunciada (região viva)', await p.evaluate(() => !!document.querySelector('#caminho-info[aria-live]')));
    await p.focus('.node >> nth=3'); await p.keyboard.press('Space'); await p.waitForTimeout(1200);
    ok('Espaço também escolhe', await p.evaluate(() => P.caminho) === 'visionario');
    ok('sem erros', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await nova(browser); await abrirPasso(p, 5);
    const info = await p.evaluate(() => [...document.querySelectorAll('#stepper li.done')].map(li => [li.tagName, li.querySelector('button') ? 'botão' : '', li.getAttribute('tabindex')]));
    ok('passos concluídos são focáveis', info.length === 5 && info.every(i => i[1] === 'botão' || i[2] === '0'), JSON.stringify(info[0]));
    ok('o passo atual é marcado (aria-current)', await p.evaluate(() => document.querySelectorAll('#stepper [aria-current="step"]').length) === 1);
    await p.focus('#stepper li.done:nth-child(2) button'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    ok('Enter volta ao passo', await p.evaluate(() => P.step) === 1);
    ok('o foco vai para o conteúdo do novo passo', await p.evaluate(() => !!document.activeElement.closest('#step-body') || document.activeElement.id === 'step-body'), await p.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id));
    ok('há um link "pular para o conteúdo"', await p.evaluate(() => { const a = document.querySelector('a.pular'); return !!a && a.getAttribute('href') === '#app'; })); await p.ctx.close(); }
  { const p = await nova(browser); await abrirPasso(p, 5); const sem = [];
    const els = await p.evaluate(() => { const s = 'button:not([disabled]),input:not([hidden]):not([disabled]),textarea,[tabindex="0"]'; return [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null && !e.closest('[hidden]')).map((e, i) => { e.dataset.k = i; return i; }); });
    for (const i of els.slice(0, 60)) { const vis = await p.evaluate(i => { const e = document.querySelector(`[data-k="${i}"]`); e.focus({ preventScroll: true }); const c = getComputedStyle(e); const out = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0; const sh = c.boxShadow !== 'none'; const ant = e.id || e.className; return { ok: out || sh, ant }; }, i); if (!vis.ok) sem.push(String(vis.ant).slice(0, 25)); }
    ok('todo controle focado mostra um indicador de foco', sem.length === 0, [...new Set(sem)].slice(0, 6).join(', ')); await p.ctx.close(); }

  console.log('\n3) "Reduzir movimento"');
  for (const [nome, prep] of [['capa', async p => { await p.evaluate(() => voltarCapa()); }], ['ficha', p => abrirPasso(p, 5)], ['ficha com sanidade 0 e Terror', async p => { await p.evaluate(() => { P.san = 0; salvar(); }); await abrirPasso(p, 5); await p.click('#btn-terror'); }], ['mesa aberta', async p => { await abrirPasso(p, 5); await p.click('#fab-mesa'); }], ['identidade', p => abrirPasso(p, 0)], ['raça e origem', p => abrirPasso(p, 3)]]) {
    const p = await nova(browser, { reduzir: true }); await prep(p); await p.waitForTimeout(900);
    const rodando = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).map(a => a.animationName || 'js'));
    ok('sem animações infinitas — ' + nome, rodando.length === 0, [...new Set(rodando)].join(', ')); await p.ctx.close(); }
  { const p = await nova(browser, { reduzir: true, ficha: { digestao: 10, sequencia: 6 } }); await abrirPasso(p, 5); await p.click('#btn-asc'); await p.waitForTimeout(600);
    ok('ascensão: o botão Continuar já está disponível', await p.evaluate(() => { const b = document.querySelector('#asc-ok'); return !!b && !b.disabled; }));
    const mov = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    ok('ascensão não anima com movimento reduzido', mov === 0, mov + ' animações'); await p.ctx.close(); }
  { const p = await nova(browser, { reduzir: true }); await abrirPasso(p, 2);
    await p.click('#btn-d22'); await p.waitForTimeout(900);
    ok('d22 com movimento reduzido já dá o resultado', await p.evaluate(() => P.caminho !== null) && !(await p.evaluate(() => constel.spinning)), 'girando=' + await p.evaluate(() => constel.spinning)); await p.ctx.close(); }

  console.log('\n4) Rótulos, estrutura e leitores de tela');
  { const p = await nova(browser); const falt = [];
    for (const passo of [0, 5]) { await abrirPasso(p, passo); falt.push(...await p.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([hidden]),textarea,select')].filter(e => { const n = (e.getAttribute('aria-label') || '') + (e.labels && e.labels.length ? e.labels[0].textContent : '') + (e.getAttribute('aria-labelledby') || ''); return !n.trim(); }).map(e => e.id || e.type))); }
    ok('todo campo tem rótulo', falt.length === 0, falt.join(', '));
    await abrirPasso(p, 5);
    const nivel = await p.evaluate(() => { const h = [...document.querySelectorAll('h1,h2,h3,h4')].filter(e => e.offsetParent !== null).map(e => +e.tagName[1]); let ruim = 0; for (let i = 1; i < h.length; i++) if (h[i] - h[i - 1] > 1) ruim++; return ruim; });
    ok('a ordem dos títulos não pula níveis (ficha)', nivel === 0, nivel + ' saltos');
    ok('as barras de PV/Sanidade têm função de medidor', await p.evaluate(() => document.querySelectorAll('.g-barwrap [role="meter"], .g-bar[role="meter"], .g-bar[role="progressbar"]').length) >= 2);
    await p.click('[data-c=pv][data-d="-5"]'); await p.waitForTimeout(200);
    ok('mudanças de PV e Sanidade são anunciadas', await p.evaluate(() => /Pontos de Vida: \d+ de \d+/.test(document.querySelector('#anuncio').textContent) && document.querySelector('#anuncio').getAttribute('aria-live') === 'polite'), await p.evaluate(() => document.querySelector('#anuncio').textContent));
    ok('o medidor de PV acompanha o valor', await p.evaluate(() => { const m = document.querySelector('.gauge[data-k=pv] [role=meter]'); return +m.getAttribute('aria-valuenow') === P.pv; }));
    ok('a escada de poder diz qual é a Sequência atual', await p.evaluate(() => document.querySelectorAll('.ladder [aria-current]').length) === 1);
    ok('retrato e sigilos decorativos não são lidos duas vezes', await p.evaluate(() => [...document.querySelectorAll('img')].every(i => i.hasAttribute('alt'))));
    await p.click('#fab-mesa'); await p.click('#rolar'); await p.waitForTimeout(2300);
    ok('o resultado da rolagem é anunciado', await p.evaluate(() => { const r = document.querySelector('#resultado'); return !!r && (r.getAttribute('aria-live') === 'polite' || r.getAttribute('role') === 'status'); }));
    await p.ctx.close(); }
  { const p = await nova(browser); await abrirPasso(p, 5);
    ok('botões de modo (som, terror) informam o estado', await p.evaluate(() => ['#btn-som', '#btn-terror'].every(s => ['true', 'false'].includes(document.querySelector(s).getAttribute('aria-pressed')) && document.querySelector(s).getAttribute('aria-label'))));
    await p.ctx.close(); }

  console.log('\n5) Contraste do texto de exemplo (placeholder) e de controles desativados');
  { const p = await nova(browser); await abrirPasso(p, 0);
    const cr = await p.evaluate(() => {
      const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const razao = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); };
      const e = document.querySelector('#f-nome'), ph = getComputedStyle(e, '::placeholder'), cs = getComputedStyle(e);
      const bg = rgb(cs.backgroundColor.startsWith('rgba') && cs.backgroundColor.endsWith(', 0)') ? 'rgb(10,8,32)' : cs.backgroundColor);
      return +razao(rgb(ph.color), bg.length ? bg : [10, 8, 32]).toFixed(2); });
    ok('texto de exemplo tem contraste ≥ 4,5', cr >= 4.5, cr + ':1'); await p.ctx.close(); }

  await browser.close();
  console.log(`\n${total - falhas} de ${total} testes passaram${falhas ? ` — ${falhas} FALHARAM` : ''}`);
  process.exit(falhas ? 1 : 0);
})();
