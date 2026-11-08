#!/usr/bin/env node
// Mede o volume de cada som (renderizado offline, sem alto-falante) e calcula o ganho de cada um.
//   node tools/medir-som.js              mostra os volumes atuais (com os ganhos que já estão em js/som.js)
//   node tools/medir-som.js --calibrar   ajusta os ganhos por aproximação (até 4 passadas) e grava em js/som.js
//   node tools/medir-som.js --calibrar --zerar   idem, partindo de ganho 1 para todos os sons
// Volume = RMS (dBFS) da janela de 1,2 s mais alta do som. Meta por categoria abaixo; o ganho também é limitado
// para que o pico nunca passe de 0,92.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const RAIZ = path.resolve(__dirname, '..'), URL = 'file://' + path.join(RAIZ, 'index.html'), ARQ = path.join(RAIZ, 'js', 'som.js');
const CALIBRAR = process.argv.includes('--calibrar');
const IDS = ['louco', 'erro', 'porta', 'visionario', 'sol', 'tirano', 'torre', 'enforcado', 'escuridao', 'morte', 'gigante', 'demonessa', 'sacerdote', 'eremita', 'paragono', 'roda', 'mae', 'lua', 'abismo', 'acorrentado', 'imperador', 'justiceiro'];
// meta de volume (dBFS) por tipo de som
const META = { c: -24, asc: -21, selar: -26, crit: -24, falha: -24, res: -30, conf: -30, dado: -30, carta: -30, dig: -32, click: -38, tick: -42, camada: -30, amb: -40, bat: -30 };
const SONS = []; for (const m of ['n', 't']) {
  IDS.forEach(id => SONS.push({ chave: `${m}:c:${id}`, tipo: 'c', modo: m, chamada: `Som.caminho('${id}')` }));
  [['asc', 'Som.ascender(3, ' + (m === 't') + ')'], ['selar', 'Som.selar()'], ['crit', 'Som.critico()'], ['falha', 'Som.falha()'], ['res', 'Som.resultado()'], ['conf', 'Som.confirmar()'], ['dado', 'Som.dado()'], ['carta', 'Som.carta()'], ['dig', 'Som.digerir(4)'], ['click', 'Som.click()'], ['tick', 'Som.tick()']]
    .forEach(([t, ch]) => SONS.push({ chave: `${m}:${t}`, tipo: t, modo: m, chamada: ch }));
}
SONS.push({ chave: 't:amb', tipo: 'amb', modo: 't', chamada: 'Som.ambienteTerror(true)' }, { chave: 't:bat', tipo: 'bat', modo: 't', chamada: 'Som.batida()' });
SONS.push({ chave: 't:camada', tipo: 'camada', modo: 't', chamada: "Som.setTerror(false), Som.setTerror(true)" });
const dB = x => 20 * Math.log10(Math.max(x, 1e-9));
const lerGanhos = () => { const m = fs.readFileSync(ARQ, 'utf8').match(/\/\*medido\*\/(\{[\s\S]*?\})\/\*fim\*\//); return m ? JSON.parse(m[1]) : {}; };
const gravarGanhos = g => { let src = fs.readFileSync(ARQ, 'utf8'); const a = src.indexOf('/*medido*/'), b = src.indexOf('/*fim*/'); src = src.slice(0, a) + '/*medido*/' + JSON.stringify(g, null, 1).replace(/\n\s*/g, ' ') + src.slice(b); fs.writeFileSync(ARQ, src); };

async function medirUm(browser, s) {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.addInitScript(([terror]) => {
    try { localStorage.setItem('lotm-terror', terror ? '1' : '0'); localStorage.setItem('lotm-mudo', '0'); localStorage.setItem('lotm-vol', '1'); localStorage.setItem('lotm-ui', '1'); } catch (e) {}
    let sem = 123456789; Math.random = () => (sem = (sem * 16807) % 2147483647) / 2147483647;   // medição reproduzível
    window.AudioContext = function () { return (window.__oc = new OfflineAudioContext(2, 44100 * 8, 44100)); };
  }, [s.modo === 't']);
  await p.goto(URL);
  const m = await p.evaluate(async chamada => {
    // biome-ignore lint/security/noGlobalEval: ferramenta local de medição; só roda os trechos escritos neste mesmo script
    if (chamada.includes('setTerror(false)')) { Som.setTerror(false); Som.init(); Som.setTerror(true); } else eval(chamada);
    const buf = await window.__oc.startRendering(), a = buf.getChannelData(0), b = buf.getChannelData(1), W = Math.round(1.2 * 44100), H = Math.round(0.1 * 44100);
    let pico = 0, melhor = 0; const n = a.length;
    for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(a[i]), Math.abs(b[i]));
    for (let ini = 0; ini + W <= n; ini += H) { let e = 0; for (let i = ini; i < ini + W; i++) e += a[i] * a[i] + b[i] * b[i]; melhor = Math.max(melhor, e / (2 * W)); }
    return { pico, rms: Math.sqrt(melhor) };
  }, s.chamada);
  await ctx.close(); return { ...m, tipo: s.tipo, db: dB(m.rms) };
}
// mede todos (4 de cada vez), com os ganhos que estão em js/som.js
async function medirTudo(browser) {
  const res = {}, fila = [...SONS];
  await Promise.all(Array.from({ length: 4 }, async () => { while (fila.length) { const s = fila.shift(); res[s.chave] = await medirUm(browser, s); } }));
  return res;
}

(async () => {
  const browser = await chromium.launch(); let res;
  if (CALIBRAR) {
    // aproximação: mede com os ganhos atuais, corrige o que sobrou e repete (o limitador torna o volume não linear)
    if (process.argv.includes('--zerar')) gravarGanhos({});
    for (let it = 1; it <= 4; it++) {
      res = await medirTudo(browser); const g = lerGanhos(); let maxErro = 0;
      for (const [ch, r] of Object.entries(res)) {
        const erro = META[r.tipo] - r.db; maxErro = Math.max(maxErro, Math.abs(erro)); const atual = typeof g[ch] === 'number' ? g[ch] : 1;
        let novo = atual * Math.pow(10, erro / 20); novo = Math.min(novo, atual * 0.92 / Math.max(r.pico, 1e-6));
        g[ch] = +Math.max(0.05, Math.min(novo, 8)).toFixed(3);
      }
      gravarGanhos(g); console.log(`passada ${it}: maior erro ${maxErro.toFixed(1)} dB`); if (maxErro < 0.6) break;
    }
  }
  res = await medirTudo(browser);
  await browser.close();
  // relatório
  const linhas = Object.entries(res).map(([ch, r]) => ({ ch, ...r })), fora = [];
  for (const m of ['n', 't']) {
    const L = linhas.filter(l => l.ch.startsWith(m + ':c:'));
    const v = L.map(l => l.db), pico = Math.max(...L.map(l => l.pico));
    console.log(`\nTrilhas dos Caminhos (${m === 'n' ? 'normal' : 'Terror'}): volume ${Math.min(...v).toFixed(1)} a ${Math.max(...v).toFixed(1)} dBFS, diferença ${(Math.max(...v) - Math.min(...v)).toFixed(1)} dB, pico máximo ${pico.toFixed(2)}`);
  }
  console.log('\nSom'.padEnd(18) + 'volume'.padStart(9) + 'meta'.padStart(7) + 'pico'.padStart(7));
  for (const l of linhas.filter(l => !l.ch.includes(':c:'))) { console.log(l.ch.padEnd(17) + (l.db.toFixed(1) + ' dB').padStart(10) + String(META[l.tipo]).padStart(6) + l.pico.toFixed(2).padStart(7)); }
  for (const l of linhas) { if (l.pico > 0.95) fora.push(`${l.ch}: pico ${l.pico.toFixed(2)}`); }
  fs.writeFileSync(path.join(__dirname, '.ultima-medicao.json'), JSON.stringify(res));
  if (fora.length) { console.log('\nPICOS ALTOS:', fora.join(', ')); process.exitCode = 1; }
})();
