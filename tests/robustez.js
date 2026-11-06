// Testes de robustez (Playwright). Uso:  npm install  &&  npm test
// Cada teste reproduz um defeito já encontrado na auditoria; se algum voltar, o teste falha.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

const ATT = Object.fromEntries(['forca', 'agil', 'vigor', 'intel', 'espir', 'pres'].map((k, i) => [k, { dados: [3, 5, 6, 2], descartado: 3, total: 10 + i * 2 }]));
const OK = { nome: 'Klein', step: 5, sequencia: 5, digestao: 4, caminho: 'tirano', raca: 'humano', origem: 'nobre', traco: 1, artefato: 1, attrs: ATT, pv: 10, san: 10 };

let falhas = 0, total = 0;
const resultado = (nome, passou, detalhe = '') => { total++; if (!passou) falhas++; console.log(`${passou ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  → ' + detalhe : ''}`); };

async function pagina(browser, save, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 850 } });
  const p = await ctx.newPage(); p.erros = []; p.on('pageerror', e => p.erros.push(e.message));
  await p.goto(URL);
  if (save !== undefined) { await p.evaluate(v => localStorage.setItem('lotm-rpg-personagem', typeof v === 'string' ? v : JSON.stringify(v)), save); await p.reload(); }
  await p.waitForTimeout(400); p.ctx = ctx; return p;
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n1) Saves inválidos não podem travar o site');
  const RUINS = {
    'Caminho inexistente': { ...OK, caminho: 'xyz' }, 'traço fora da lista': { ...OK, traco: 99 }, 'atributos faltando': { ...OK, attrs: { forca: ATT.forca } },
    'passo fora do intervalo': { ...OK, step: 42 }, 'Sequência 15': { ...OK, sequencia: 15 }, 'Sequência negativa': { ...OK, sequencia: -3 },
    'PV/Sanidade texto': { ...OK, pv: 'abc', san: null }, 'raça nula na ficha': { ...OK, raca: null }, 'JSON é uma lista': [1, 2, 3], 'JSON é um texto': '"oi"', 'JSON quebrado': '{nome:',
    'dados de atributo inválidos': { ...OK, attrs: { ...ATT, forca: { dados: ['a', 9, -1, 2], descartado: 7, total: 'x' } } },
  };
  for (const [nome, save] of Object.entries(RUINS)) {
    const p = await pagina(browser, save);
    let continuou = true, iniciou = true;
    try { const c = await p.$('#btn-continue'); if (c && await c.isVisible()) { await c.click(); await p.waitForTimeout(400); } } catch (e) { continuou = false; }
    await p.evaluate(() => voltarCapa()).catch(() => { iniciou = false; }); await p.waitForTimeout(200);
    try { await p.click('#btn-start', { timeout: 1500 }); } catch (e) { iniciou = false; }
    const vazio = await p.evaluate(() => document.querySelector('#step-body').innerText.trim().length < 10);
    resultado(nome, p.erros.length === 0 && continuou && iniciou && !vazio, p.erros[0] || (!iniciou ? 'não consegue iniciar' : vazio ? 'tela vazia' : ''));
    await p.ctx.close();
  }
  { const p = await pagina(browser, { ...OK, nome: '   ' }); await p.click('#btn-continue').catch(() => {}); await p.waitForTimeout(400);
    resultado('ficha sem nome volta para a Identidade', await p.evaluate(() => P.step) === 0 && p.erros.length === 0, 'passo ' + await p.evaluate(() => P.step)); await p.ctx.close(); }
  for (const [nome, conteudo] of [['importar lista', '[]'], ['importar texto', '"x"'], ['importar null', 'null'], ['importar Caminho inválido', JSON.stringify({ ...OK, caminho: 'xyz' })], ['importar HTML', '<html>']]) {
    const p = await pagina(browser); await p.setInputFiles('#file-import', { name: 'f.json', mimeType: 'application/json', buffer: Buffer.from(conteudo) }); await p.waitForTimeout(500);
    const vivo = await p.evaluate(() => { try { voltarCapa(); return !document.querySelector('#cover').hidden; } catch (e) { return false; } });
    resultado(nome, p.erros.length === 0 && vivo, p.erros[0] || ''); await p.ctx.close();
  }

  console.log('\n2) Ascender não pode acontecer mais de uma vez por pedido');
  { const p = await pagina(browser, { ...OK, sequencia: 6, digestao: 10 }); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = document.querySelector('#btn-asc'); b.click(); b.click(); b.click(); }); await p.waitForTimeout(600);
    resultado('3 cliques seguidos', await p.evaluate(() => P.sequencia) === 5, 'sequência ' + await p.evaluate(() => P.sequencia) + ' (esperado 5)'); await p.ctx.close(); }
  { const p = await pagina(browser, { ...OK, sequencia: 6, digestao: 10 }); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.focus('#btn-asc'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    resultado('Enter repetido no botão', await p.evaluate(() => P.sequencia) === 5, 'sequência ' + await p.evaluate(() => P.sequencia) + ' (esperado 5)'); await p.ctx.close(); }
  { const p = await pagina(browser, { ...OK, sequencia: 6, digestao: 2 }); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.click('#btn-asc'); await p.waitForTimeout(300); await p.evaluate(() => { const b = document.querySelector('#rk-sim'); b.click(); b.click(); }); await p.waitForTimeout(3500);
    resultado('ascensão arriscada com cliques duplos', await p.evaluate(() => P.sequencia) === 5 && p.erros.length === 0, 'sequência ' + await p.evaluate(() => P.sequencia)); await p.ctx.close(); }

  console.log('\n3) Cliques durante animações não podem causar erro nem efeito na tela errada');
  { const p = await pagina(browser, { nome: 'T', step: 2, caminho: 'louco', attrs: ATT }); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.click('#btn-d22'); await p.waitForTimeout(400);
    const travado = await p.evaluate(() => document.querySelector('#btn-next').disabled);
    await p.evaluate(() => document.querySelector('#btn-next').click()); await p.waitForTimeout(7500);
    resultado('Avançar durante o giro do d22', travado && p.erros.length === 0, p.erros[0] || (travado ? '' : 'o botão Avançar ficou livre')); await p.ctx.close(); }
  { const p = await pagina(browser, { nome: 'T', step: 2, caminho: 'louco', attrs: ATT }); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.click('#btn-d22'); await p.waitForTimeout(400); await p.click('#btn-prev'); await p.waitForTimeout(7500);
    resultado('Voltar durante o giro do d22', p.erros.length === 0 && await p.evaluate(() => P.caminho) === 'louco' && !(await p.$('#fx-canvas')) ? true : p.erros.length === 0 && await p.evaluate(() => P.caminho) === 'louco', p.erros[0] || 'Caminho ' + await p.evaluate(() => P.caminho)); await p.ctx.close(); }
  { const p = await pagina(browser, { nome: 'T', step: 4, caminho: 'louco', raca: 'humano', origem: 'nobre', attrs: ATT }); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.click('#btn-traco'); await p.waitForTimeout(300); await p.click('#btn-prev'); await p.waitForTimeout(2500);
    resultado('sair das cartas de destino no meio do sorteio', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }

  console.log('\n4) Texto longo não pode estourar a largura');
  for (const [w, nome] of [[1100, 'computador'], [390, 'celular']]) {
    const p = await pagina(browser, undefined, { viewport: { width: w, height: 850 } });
    const longos = { nome: 'Aleksandr Maximilian Ferdinand von Hohenzollern-Sigmaringen III de Castela e Leão', jogador: 'x'.repeat(120), historia: 'palavra'.repeat(400), aparencia: 'a'.repeat(300), notas: 'https://exemplo.com/' + 'a'.repeat(200) };
    const ruins = [];
    for (const [campo, val] of Object.entries(longos)) {
      await p.evaluate(([c, v, A]) => { P = novoPersonagem(); Object.assign(P, { nome: 'Klein', step: 5, sequencia: 5, caminho: 'justiceiro', raca: 'humano', origem: 'nobre', traco: 1, artefato: 1, attrs: A }); P[c] = v; salvar(); iniciarPasso(); }, [campo, val, ATT]); await p.waitForTimeout(300);
      const extra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (extra > 1) ruins.push(`${campo}+${extra}px`);
    }
    await p.evaluate(() => { P.step = 0; salvar(); iniciarPasso(); }); await p.waitForTimeout(300);
    const idExtra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (idExtra > 1) ruins.push(`identidade+${idExtra}px`);
    await p.evaluate(() => voltarCapa()); await p.waitForTimeout(300);
    const capaExtra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (capaExtra > 1) ruins.push(`capa+${capaExtra}px`);
    resultado('sem rolagem lateral — ' + nome, ruins.length === 0, ruins.join(', ')); await p.ctx.close();
  }

  console.log('\n5) Janelas: Esc fecha e o foco fica dentro');
  { const p = await pagina(browser, OK); await p.click('#btn-continue'); await p.waitForTimeout(500);
    for (const [sel, nome] of [['#btn-new', 'Novo personagem'], ['#btn-export', 'Exportar JSON'], ['#btn-poster', 'Pôster']]) {
      await p.click(sel); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      resultado('Esc fecha "' + nome + '"', await p.evaluate(() => !document.querySelector('.asc.risco, .crop-modal, .poster-modal'))); await p.evaluate(() => document.querySelectorAll('.asc.risco,.crop-modal').forEach(e => e.remove()));
    }
    await p.click('#btn-new'); await p.waitForTimeout(300); let escapou = false;
    for (let i = 0; i < 8; i++) { await p.keyboard.press('Tab'); if (!await p.evaluate(() => !!document.activeElement.closest('.asc.risco'))) { escapou = true; break; } }
    resultado('Tab não sai da janela', !escapou); await p.ctx.close(); }

  await browser.close();
  console.log(`\n${total - falhas} de ${total} testes passaram${falhas ? ` — ${falhas} FALHARAM` : ''}`);
  process.exit(falhas ? 1 : 0);
})();
