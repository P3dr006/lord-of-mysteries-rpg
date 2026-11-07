require('./quieto');
// Testes da ficha útil: vários personagens, PV/Sanidade rápidos e habilidades. Uso: npm run test:ficha
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ATT = Object.fromEntries(['forca', 'agil', 'vigor', 'intel', 'espir', 'pres'].map((k, i) => [k, { dados: [3, 5, 6, 2], descartado: 3, total: 10 + i * 2 }]));
const FICHA = (nome, extra = {}) => ({ nome, step: 5, sequencia: 5, digestao: 4, caminho: 'tirano', raca: 'humano', origem: 'nobre', traco: 1, artefato: 1, attrs: ATT, pv: 10, san: 12, ...extra });
let falhas = 0, total = 0;
const ok = (nome, passou, detalhe = '') => { total++; if (!passou) falhas++; console.log(`${passou ? '  ok  ' : ' FALHA'}  ${nome}${detalhe ? '  → ' + detalhe : ''}`); };

async function nova(browser, viewport = { width: 1100, height: 850 }) {
  const ctx = await browser.newContext({ viewport }); const p = await ctx.newPage(); p.erros = []; p.on('pageerror', e => p.erros.push(e.message));
  await p.goto(URL); await p.waitForTimeout(300); p.ctx = ctx; return p;
}
// grava fichas pelo próprio app (como o jogador as criaria) e volta para a capa
async function semear(p, fichas) {
  await p.evaluate(fs => { fs.forEach(f => { novoSlot(); P = sanear(f); salvar(); }); voltarCapa(); }, fichas);
}
const armazenado = (p, chave) => p.evaluate(k => localStorage.getItem(k), chave);

(async () => {
  const browser = await chromium.launch();

  console.log('\n1) Vários personagens');
  { const p = await nova(browser);
    await p.evaluate(f => { localStorage.setItem('lotm-rpg-personagem', JSON.stringify(f)); }, FICHA('Klein Antigo')); await p.reload(); await p.waitForTimeout(400);
    const lista = await p.evaluate(() => listarPersonagens().map(x => x.p.nome));
    ok('ficha antiga (uma só) é migrada para a lista', lista.length === 1 && lista[0] === 'Klein Antigo' && await armazenado(p, 'lotm-rpg-personagem') === null, JSON.stringify(lista));
    ok('o botão Continuar mostra o nome', (await p.textContent('#continue-txt')).includes('Klein Antigo')); await p.ctx.close(); }
  { const p = await nova(browser); await semear(p, [FICHA('Alice'), FICHA('Bruno', { caminho: 'sol' }), FICHA('Carla', { caminho: 'louco', sequencia: 2 })]); await p.waitForTimeout(300);
    ok('três personagens ficam salvos', await p.evaluate(() => listarPersonagens().length) === 3);
    ok('a capa oferece "Meus personagens (3)"', (await p.textContent('#lib-txt')).includes('3'));
    await p.click('#btn-start'); await p.fill('#f-nome', 'Diego'); await p.waitForTimeout(200);
    ok('"Iniciar a jornada" NÃO apaga os anteriores', await p.evaluate(() => listarPersonagens().length) === 4, 'total ' + await p.evaluate(() => listarPersonagens().length));
    await p.evaluate(() => voltarCapa()); await p.click('#btn-start'); await p.waitForTimeout(200);
    ok('ficha em branco sem nome não entra na lista', await p.evaluate(() => listarPersonagens().length) === 4);
    await p.evaluate(() => voltarCapa()); await p.click('#btn-pers'); await p.waitForTimeout(300);
    ok('a biblioteca mostra todos', await p.$$eval('.lib-item', e => e.length) === 4);
    await p.click('.lib-item:has-text("Bruno") .lib-abrir'); await p.waitForTimeout(600);
    ok('abrir carrega o personagem certo', await p.evaluate(() => P.nome === 'Bruno' && P.caminho === 'sol') && await p.evaluate(() => !document.querySelector('.lib')));
    await p.fill('#f-notas', 'só do Bruno'); await p.evaluate(() => voltarCapa()); await p.click('#btn-pers'); await p.click('.lib-item:has-text("Alice") .lib-abrir'); await p.waitForTimeout(500);
    ok('as notas não vazam para outro personagem', await p.evaluate(() => P.nome === 'Alice' && P.notas === ''));
    ok('sem erros no fluxo', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await nova(browser); await semear(p, [FICHA('Alice'), FICHA('Bruno')]);
    await p.click('#btn-pers'); await p.waitForTimeout(300); await p.click('.lib-item:has-text("Alice") .lib-dup'); await p.waitForTimeout(300);
    ok('duplicar cria "(cópia)"', await p.evaluate(() => listarPersonagens().some(x => x.p.nome === 'Alice (cópia)')));
    const antes = await p.$$eval('.lib-item', e => e.length);
    await p.click('.lib-item:has-text("Bruno") .lib-del'); await p.waitForTimeout(150);
    ok('excluir pede um segundo toque', await p.$$eval('.lib-item', e => e.length) === antes && (await p.textContent('.lib-item:has-text("Bruno") .lib-del')).includes('Excluir?'));
    await p.click('.lib-item:has-text("Bruno") .lib-del'); await p.waitForTimeout(300);
    ok('segundo toque exclui', await p.$$eval('.lib-item', e => e.length) === antes - 1 && await p.evaluate(() => !listarPersonagens().some(x => x.p.nome === 'Bruno')));
    ok('os dados do excluído somem do armazenamento', await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('lotm-rpg-p-')).length) === antes - 1);
    ok('sem erros', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await nova(browser); await semear(p, [FICHA('Alice')]);
    await p.setInputFiles('#file-import', { name: 'f.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(FICHA('Importada'))) }); await p.waitForTimeout(600);
    ok('importar adiciona um personagem novo (não substitui)', await p.evaluate(() => listarPersonagens().length) === 2 && await p.evaluate(() => P.nome) === 'Importada'); await p.ctx.close(); }
  { const p = await nova(browser); await semear(p, [FICHA('Com Retrato')]);
    const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z';
    await p.evaluate(j => { P.retrato = j; salvar(); }, jpg); await semear(p, [FICHA('Sem Retrato')]);
    const ret = await p.evaluate(() => listarPersonagens().map(x => [x.p.nome, !!x.p.retrato]));
    ok('cada personagem guarda o próprio retrato', JSON.stringify(ret.sort()) === JSON.stringify([['Com Retrato', true], ['Sem Retrato', false]].sort()), JSON.stringify(ret)); await p.ctx.close(); }

  console.log('\n2) PV e Sanidade rápidos');
  { const p = await nova(browser); await semear(p, [FICHA('Vida', { pv: 20, san: 20 })]); await p.click('#btn-continue'); await p.waitForTimeout(600);
    const max = await p.evaluate(() => [pvMax(), sanMax()]);
    await p.click('[data-c=pv][data-d="-5"]'); ok('−5 de PV', await p.evaluate(() => P.pv) === Math.min(20, max[0]) - 5 || await p.evaluate(() => P.pv) === 15, 'PV ' + await p.evaluate(() => P.pv));
    await p.click('[data-c=pv][data-d="-10"]'); ok('−10 de PV', await p.evaluate(() => P.pv) === 5, 'PV ' + await p.evaluate(() => P.pv));
    await p.click('[data-c=pv][data-d="-10"]'); ok('PV nunca fica negativo e mostra "caído"', await p.evaluate(() => P.pv) === 0 && (await p.textContent('#gs-pv')).includes('caído'));
    await p.click('[data-c=pv][data-max]'); ok('"máx" restaura tudo', await p.evaluate(() => P.pv) === max[0], 'PV ' + await p.evaluate(() => P.pv) + '/' + max[0]);
    await p.click('[data-c=pv][data-d="10"]'); ok('PV nunca passa do máximo', await p.evaluate(() => P.pv) === max[0]);
    await p.fill('#iv-san', '7'); await p.press('#iv-san', 'Enter'); await p.waitForTimeout(150); ok('digitar o valor direto', await p.evaluate(() => P.san) === 7);
    await p.fill('#iv-san', '9999'); await p.press('#iv-san', 'Enter'); ok('valor digitado acima do máximo é limitado', await p.evaluate(() => P.san) === max[1]);
    await p.fill('#iv-san', 'abc'); await p.press('#iv-san', 'Enter'); ok('texto no campo não quebra', await p.evaluate(() => Number.isFinite(P.san)) && p.erros.length === 0);
    await p.fill('#iv-san', '3'); await p.press('#iv-san', 'Enter'); await p.focus('#iv-san'); await p.press('#iv-san', 'ArrowUp'); ok('seta para cima soma 1', await p.evaluate(() => P.san) === 4);
    await p.fill('#iv-san', '0'); await p.press('#iv-san', 'Enter'); await p.waitForTimeout(150); ok('sanidade 0 ativa o aviso de perda de controle', await p.evaluate(() => document.querySelector('#ficha').classList.contains('san-zero')));
    await p.reload(); await p.click('#btn-continue'); await p.waitForTimeout(500); ok('o valor sobrevive ao recarregar', await p.evaluate(() => P.san) === 0);
    ok('sem erros', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await nova(browser, { width: 360, height: 740 }); await semear(p, [FICHA('Celular')]); await p.click('#btn-continue'); await p.waitForTimeout(600);
    const pequenos = await p.evaluate(() => [...document.querySelectorAll('.adj')].filter(b => b.getBoundingClientRect().height < 40 || b.getBoundingClientRect().width < 40).map(b => b.textContent));
    ok('botões de ajuste têm tamanho de toque (≥40px) no celular', pequenos.length === 0, pequenos.join(','));
    ok('sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1); await p.ctx.close(); }

  console.log('\n3) Habilidades');
  { const p = await nova(browser); await semear(p, [FICHA('Hab', { caminho: 'louco' })]); await p.click('#btn-continue'); await p.waitForTimeout(600);
    ok('a ficha mostra as habilidades do Caminho', await p.$$eval('.hab-lista li.base', e => e.length) === 2 && (await p.textContent('.hab-caminho')).includes('Louco'));
    await p.fill('#hab-nome', 'Passo do Louco'); await p.fill('#hab-desc', 'Atravessa um espelho.'); await p.click('#hab-ok'); await p.waitForTimeout(200);
    ok('adicionar uma habilidade', await p.evaluate(() => P.habilidades.length === 1 && P.habilidades[0].nome === 'Passo do Louco') && await p.$$eval('#hab-lista li', e => e.length) === 3);
    await p.click('#hab-ok'); ok('nome vazio não adiciona', await p.evaluate(() => P.habilidades.length) === 1);
    await p.click('.hab-ed'); await p.fill('#hab-nome', 'Passo Novo'); await p.click('#hab-ok'); await p.waitForTimeout(200);
    ok('editar troca o texto (sem duplicar)', await p.evaluate(() => P.habilidades.length === 1 && P.habilidades[0].nome === 'Passo Novo'));
    await p.reload(); await p.click('#btn-continue'); await p.waitForTimeout(500); ok('habilidades sobrevivem ao recarregar', await p.evaluate(() => P.habilidades.length) === 1);
    await p.fill('#hab-nome', '<img src=x onerror=alert(1)>'); await p.click('#hab-ok'); await p.waitForTimeout(200);
    ok('HTML digitado não vira elemento', await p.evaluate(() => !document.querySelector('#hab-lista img')));
    await p.click('.hab-rm >> nth=0'); ok('remover', await p.evaluate(() => P.habilidades.length) === 1);
    ok('sem erros', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }
  { const p = await nova(browser);
    await p.evaluate(() => { P = sanear({ nome: 'x', habilidades: [{ nome: 'ok', desc: 5 }, { nome: '' }, 'texto', null, { nome: 'n'.repeat(500), desc: 'd'.repeat(5000) }, ...Array.from({ length: 100 }, (_, i) => ({ nome: 'h' + i }))] }); });
    const h = await p.evaluate(() => P.habilidades);
    ok('habilidades inválidas são filtradas e limitadas', h.length <= 40 && h.every(x => x.nome && x.nome.length <= 60 && x.desc.length <= 600), 'itens ' + h.length); await p.ctx.close(); }
  { const p = await nova(browser); await semear(p, [FICHA('Poster', { habilidades: [{ nome: 'Minha técnica secreta' }] })]); await p.click('#btn-continue'); await p.waitForTimeout(500);
    await p.click('#btn-poster'); await p.waitForSelector('#poster-prev img', { timeout: 20000 });
    ok('o pôster é gerado com habilidades', p.erros.length === 0, p.erros[0] || ''); await p.ctx.close(); }

  await browser.close();
  console.log(`\n${total - falhas} de ${total} testes passaram${falhas ? ` — ${falhas} FALHARAM` : ''}`);
  process.exit(falhas ? 1 : 0);
})();
