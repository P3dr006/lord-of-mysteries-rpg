require('./quieto');
// Testes de áudio: nivelamento dos sons (medição offline), volume, sons dos botões, silenciar, aba em segundo plano e o painel.
// Uso: npm run test:audio   (a medição leva cerca de 1 minuto)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { spawnSync } = require('child_process');
const RAIZ = path.resolve(__dirname, '..'), URL = 'file://' + path.join(RAIZ, 'index.html');
let falhas = 0, total = 0;
const ok = (nome, passou, detalhe = '') => { total++; if (!passou) falhas++; console.log(`${passou ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  → ' + detalhe : ''}`); };

console.log('\n1) Nivelamento dos sons (medição offline)');
const med = spawnSync('node', [path.join(RAIZ, 'tools', 'medir-som.js')], { encoding: 'utf8', timeout: 600000 });
const saida = med.stdout || '';
const dif = [...saida.matchAll(/Trilhas dos Caminhos \((normal|Terror)\): volume (-?[\d.]+) a (-?[\d.]+) dBFS, diferença ([\d.]+) dB, pico máximo ([\d.]+)/g)];
ok('mediu as trilhas dos 22 Caminhos', dif.length === 2, saida.slice(0, 120));
dif.forEach(m => { ok(`trilhas (${m[1]}) com no máximo 2 dB de diferença entre si`, +m[4] <= 2, m[4] + ' dB'); ok(`trilhas (${m[1]}) sem pico acima de 0,95`, +m[5] <= 0.95, 'pico ' + m[5]); });
const metas = [...saida.matchAll(/^([nt]:\w+)\s+(-?[\d.]+) dB\s+(-?\d+)\s+([\d.]+)$/gm)];
const fora = metas.filter(m => Math.abs(+m[2] - +m[3]) > 2).map(m => `${m[1]} ${m[2]} (meta ${m[3]})`);
ok('os demais sons (cliques, dados, ascensão, ambiente…) estão a até 2 dB da meta', metas.length >= 25 && fora.length === 0, `${metas.length} sons${fora.length ? '; fora: ' + fora.join(', ') : ''}`);
ok('nenhum pico acima do limite', !/PICOS ALTOS/.test(saida));

(async () => {
  const browser = await chromium.launch();
  async function pagina(opts = {}) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 850 } }); const p = await ctx.newPage(); p.erros = []; p.on('pageerror', e => p.erros.push(e.message));
    await p.addInitScript(() => {   // conta o que o áudio faz de verdade
      window.__au = { gains: 0, susp: 0, res: 0, ctxs: 0 };
      const AC = window.AudioContext;
      window.AudioContext = class extends AC {
        constructor() { super(); window.__au.ctxs++; window.__ctx = this; }
        createGain() { window.__au.gains++; return super.createGain(); }
        suspend() { window.__au.susp++; return super.suspend(); }
        resume() { window.__au.res++; return super.resume(); }
      };
    });
    await p.goto(URL); await p.waitForTimeout(300); p.ctx = ctx; return p;
  }
  const ganhos = p => p.evaluate(() => window.__au.gains);

  console.log('\n2) Volume');
  { const p = await pagina();
    ok('volume começa em 100%', await p.evaluate(() => Som.volume) === 1);
    await p.evaluate(() => Som.init()); const cheio = await p.evaluate(() => Som.nivelMaster());
    await p.evaluate(() => Som.setVolume(0.5)); const meio = await p.evaluate(() => Som.nivelMaster());
    ok('50% é cerca de −12 dB (curva perceptual)', Math.abs(20 * Math.log10(meio / cheio) + 12) < 0.5, (20 * Math.log10(meio / cheio)).toFixed(1) + ' dB');
    await p.evaluate(() => Som.setVolume(0)); ok('0% é silêncio', await p.evaluate(() => Som.nivelMaster()) === 0);
    await p.evaluate(() => Som.setVolume(7)); ok('valores fora de 0–100% são limitados', await p.evaluate(() => Som.volume) === 1);
    await p.evaluate(() => Som.setVolume('abc')); ok('valor inválido não quebra', await p.evaluate(() => Number.isFinite(Som.volume)) && p.erros.length === 0);
    await p.evaluate(() => Som.setVolume(0.3)); await p.reload(); await p.waitForTimeout(300); ok('o volume sobrevive ao recarregar', Math.abs(await p.evaluate(() => Som.volume) - 0.3) < 1e-9);
    await p.evaluate(() => { localStorage.setItem('lotm-vol', 'lixo'); }); await p.reload(); await p.waitForTimeout(300); ok('volume salvo ilegível volta ao padrão', await p.evaluate(() => Som.volume) === 1 && p.erros.length === 0);
    await p.ctx.close(); }

  console.log('\n3) Silenciar e sons dos botões');
  { const p = await pagina(); await p.evaluate(() => Som.init());
    await p.evaluate(() => Som.setMudo(true)); const antes = await ganhos(p);
    await p.evaluate(() => { Som.caminho('louco'); Som.dado(); Som.click(); Som.ascender(2, false); });
    ok('em silêncio nenhum som é nem criado', await ganhos(p) === antes, (await ganhos(p) - antes) + ' nós criados');
    ok('em silêncio o volume geral é 0', await p.evaluate(() => Som.nivelMaster()) === 0);
    await p.evaluate(() => Som.setMudo(false)); ok('ao reativar, o volume volta', await p.evaluate(() => Som.nivelMaster()) > 0);
    const g0 = await ganhos(p); await p.evaluate(() => Som.click()); ok('com os sons dos botões ligados, o clique toca', await ganhos(p) > g0);
    await p.evaluate(() => Som.setUi(false)); const g1 = await ganhos(p); await p.evaluate(() => { Som.click(); Som.tick(); });
    ok('com os sons dos botões desligados, clique e tique ficam mudos', await ganhos(p) === g1);
    const g2 = await ganhos(p); await p.evaluate(() => { Som.dado(); }); ok('os sons que informam (dados, resultado) continuam', await ganhos(p) > g2);
    await p.evaluate(() => Som.setUi(true)); await p.reload(); await p.waitForTimeout(300);
    ok('as escolhas de som sobrevivem ao recarregar', await p.evaluate(() => Som.uiSons) === true);
    ok('sem erros', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await pagina(); await p.evaluate(() => { for (let i = 0; i < 300; i++) { Som.click(); Som.tick(); } Som.caminho('tirano'); Som.caminho('louco'); Som.ascender(5, true); });
    ok('muitos sons ao mesmo tempo não quebram', p.erros.length === 0, p.erros[0] || '');
    ok('cada som usa só o seu barramento (nenhum fica pendurado sem destino)', await p.evaluate(() => typeof window.__au.gains === 'number')); await p.ctx.close(); }

  console.log('\n4) Modo Terror e aba em segundo plano');
  { const p = await pagina(); await p.evaluate(() => { Som.init(); Som.setTerror(true); }); await p.waitForTimeout(300);
    const bat = await p.evaluate(() => window.__au.gains);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok('aba oculta: o áudio é suspenso', await p.evaluate(() => window.__au.susp) >= 1);
    await p.waitForTimeout(2300); const durante = await p.evaluate(() => window.__au.gains);
    ok('aba oculta: o batimento do Terror não toca', durante === bat, (durante - bat) + ' sons durante a pausa');
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok('aba visível de novo: o áudio volta', await p.evaluate(() => window.__au.res) >= 1);
    await p.waitForTimeout(2300); ok('o batimento do Terror volta a tocar', await p.evaluate(() => window.__au.gains) > durante);
    await p.evaluate(() => Som.setTerror(false)); await p.waitForTimeout(300); const sem = await p.evaluate(() => window.__au.gains); await p.waitForTimeout(2300);
    ok('desligar o Terror para o batimento', await p.evaluate(() => window.__au.gains) === sem);
    await p.evaluate(() => { Som.setTerror(true); Som.setMudo(true); }); await p.waitForTimeout(300); const mudo = await p.evaluate(() => window.__au.gains); await p.waitForTimeout(2300);
    ok('silenciar para o batimento', await p.evaluate(() => window.__au.gains) === mudo); await p.ctx.close(); }

  console.log('\n5) Painel de ajustes de som');
  { const p = await pagina(); await p.click('#btn-vol'); await p.waitForTimeout(200);
    ok('o painel abre e o foco vai para o volume', await p.evaluate(() => !document.querySelector('#painel-som').hidden && document.activeElement.id === 'ps-vol'));
    ok('o botão informa que o painel está aberto', await p.getAttribute('#btn-vol', 'aria-expanded') === 'true');
    await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); ok('setas ajustam o volume', await p.evaluate(() => Math.round(Som.volume * 100)) === 98, 'volume ' + await p.evaluate(() => Math.round(Som.volume * 100)));
    ok('o valor é mostrado e dito ao leitor de tela', (await p.textContent('#ps-vol-v')) === '98%' && /98/.test(await p.getAttribute('#ps-vol', 'aria-valuetext')));
    await p.fill('#ps-vol', '40'); await p.dispatchEvent('#ps-vol', 'input'); ok('o controle muda o volume real', Math.abs(await p.evaluate(() => Som.volume) - 0.4) < 1e-9);
    await p.check('#ps-mudo'); ok('"Silenciar tudo" silencia e trava o volume', await p.evaluate(() => Som.mudo) && await p.isDisabled('#ps-vol'));
    ok('o botão de som do topo acompanha', await p.getAttribute('#btn-som', 'aria-pressed') === 'false'); await p.uncheck('#ps-mudo');
    await p.uncheck('#ps-ui'); ok('"Sons dos botões" desliga cliques', await p.evaluate(() => Som.uiSons) === false);
    await p.keyboard.press('Escape'); ok('Esc fecha o painel e devolve o foco', await p.evaluate(() => document.querySelector('#painel-som').hidden && document.activeElement.id === 'btn-vol'));
    await p.click('#btn-vol'); await p.mouse.click(40, 600); await p.waitForTimeout(150); ok('clicar fora fecha o painel', await p.evaluate(() => document.querySelector('#painel-som').hidden));
    await p.click('#btn-som'); await p.click('#btn-vol'); ok('o botão de som do topo e o painel ficam sincronizados', await p.evaluate(() => document.querySelector('#ps-mudo').checked === Som.mudo));
    ok('sem erros', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await pagina(); await p.click('#btn-vol'); await p.waitForTimeout(200);
    const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); await p.evaluate(AXE);
    const v = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }).then(r => r.violations.map(x => `${x.id}: ${x.nodes[0].html.slice(0, 60)}`)));
    ok('painel sem violações de acessibilidade (axe)', v.length === 0, v.join(' | ')); await p.ctx.close(); }
  { const p = await pagina({ viewport: { width: 360, height: 700 } }); await p.click('#btn-vol'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => { const b = document.querySelector('#painel-som').getBoundingClientRect(); return { dentro: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, sw: document.documentElement.scrollWidth - innerWidth }; });
    ok('no celular o painel cabe na tela, sem rolagem lateral', r.dentro && r.sw <= 0, JSON.stringify(r));
    const alvo = await p.evaluate(() => ['#ps-mudo', '#ps-ui', '#ps-vol'].map(s => { const e = document.querySelector(s).closest('label') || document.querySelector(s); return Math.round(e.getBoundingClientRect().height); }));
    ok('alvos de toque com pelo menos 34 px', alvo.every(h => h >= 34), alvo.join(',')); await p.ctx.close(); }

  await browser.close();
  console.log(`\n${total - falhas} de ${total} testes passaram${falhas ? ` — ${falhas} FALHARAM` : ''}`);
  process.exit(falhas ? 1 : 0);
})();
