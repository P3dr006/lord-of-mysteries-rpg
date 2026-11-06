// Peças visuais compartilhadas pelos passos
const iconeAttr = (a, t = 22) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="${a.cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${a.g}</svg>`;
const NOMES = ['Alistair','Beatrice','Cedric','Dorothea','Edmund','Florence','Gideon','Henrietta','Isidore','Josephine','Lucian','Margery','Nathaniel','Octavia','Percival','Rosalind','Silas','Theodora','Ulric','Winifred','Evander','Cordelia','Maximilian','Ophelia'];
const SOBRENOMES = ['Ashcombe','Blackwell','Carrow','Dunmore','Everhart','Fairweather','Greystone','Hollowell','Ivesley','Kingsley','Lockhart','Marlowe','Northcott','Pembroke','Quill','Ravenscroft','Sterling','Thornbury','Underhill','Wexford','Vandermere','Holloway'];
const nomeAleatorio = () => NOMES[d(NOMES.length) - 1] + ' ' + SOBRENOMES[d(SOBRENOMES.length) - 1];
const numeroRegistro = nome => { let h = 7; for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 9973; return String(h).padStart(4, '0'); };

// número que sobe até o valor final
// o jogador pediu menos movimento no sistema (também vale para animações feitas em JavaScript)
const reduzido = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function contar(elm, ate, dur = 700) {
  if (reduzido()) { elm.textContent = ate; return; }
  const t0 = performance.now();
  const passo = n => { const p = Math.min(1, (n - t0) / dur); elm.textContent = Math.round(3 + (ate - 3) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(passo); };
  requestAnimationFrame(passo);
}
// carta que se inclina seguindo o mouse
function inclinavel(card) {
  card.addEventListener('mousemove', e => { const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    card.style.setProperty('--ry', (x * 16) + 'deg'); card.style.setProperty('--rx', (-y * 12) + 'deg'); card.style.setProperty('--mx', (x + .5) * 100 + '%'); card.style.setProperty('--my', (y + .5) * 100 + '%'); });
  card.addEventListener('mouseleave', () => { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); });
}
const PASSO_ICONE = {
  identidade: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  atributos: ICONES.dado, caminho: ICONES.estrela,
  raca: '<path d="M12 2l8 3v7c0 5-4 8-8 10-4-2-8-5-8-10V5z"/>',
  destino: ICONES.carta, ficha: ICONES.livro,
};
const PRESAGIOS = [[0, 'Um destino difícil — mas é na adversidade que Beyonders se forjam.'], [60, 'Um começo comum: nada de extraordinário, nada de condenado.'], [72, 'Um destino promissor. Os mistérios o notaram.'], [84, 'Um presságio raro — algo antigo se interessa por você.']];

// Janela modal acessível: leva o foco para dentro, mantém o Tab dentro dela, fecha com Esc e devolve o foco a quem a abriu.
// `fechar` é chamada no Esc (ou null para uma janela que não deve fechar assim). Retorna a função que devolve o foco.
function prenderFoco(m, fechar) {
  const anterior = document.activeElement;
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  const tit = m.querySelector('.asc-nome, .crop-t, h2, h3');                 // o título da janela é o nome dela para leitores de tela
  if (tit) { if (!tit.id) tit.id = 'dlg-' + Math.random().toString(36).slice(2, 7); m.setAttribute('aria-labelledby', tit.id); }
  const focaveis = () => [...m.querySelectorAll('button:not([disabled]),input:not([hidden]):not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')].filter(e => e.offsetParent !== null || e === document.activeElement);
  m.addEventListener('keydown', e => {
    if (e.key === 'Escape' && fechar) { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    if (e.key !== 'Tab') return;
    const l = focaveis(); if (!l.length) { e.preventDefault(); return; }
    const a = l[0], z = l[l.length - 1];
    if (!m.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
  if (!m.contains(document.activeElement)) { const l = focaveis(); (l[0] || m).focus && (l[0] || (m.tabIndex = -1, m)).focus(); }
  return () => { if (anterior && anterior.isConnected && anterior.focus) anterior.focus(); };
}

// Temporizadores ligados à tela atual: ao trocar de passo todos são cancelados (nada roda "no vazio" em tela que já saiu).
const _tempo = { ids: [], raf: [] };
const agendar = (fn, ms) => { const id = setTimeout(fn, ms); _tempo.ids.push(id); return id; };
const repetir = (fn, ms) => { const id = setInterval(fn, ms); _tempo.ids.push(id); return id; };
function cancelarTemporizadores() { _tempo.ids.forEach(id => { clearTimeout(id); clearInterval(id); }); _tempo.ids = []; }
let _tela = 0;                         // muda a cada troca de tela; callbacks assíncronos comparam para saber se ainda valem

// Anuncia um texto para leitores de tela sem mostrá-lo (região viva global)
function anunciar(txt) {
  let r = document.querySelector('#anuncio'); if (!r) return;
  r.textContent = ''; setTimeout(() => { r.textContent = txt; }, 30);
}
