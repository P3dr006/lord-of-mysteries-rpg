// Retrato da Alma: selo de upload, editor de recorte circular e exibição com estilos.
const ESTILOS_RET = [
  { id: 'natural',   nome: 'Natural' },
  { id: 'gravura',   nome: 'Gravura' },
  { id: 'espectral', nome: 'Espectral' },
  { id: 'sangue',    nome: 'Sangue' },
  { id: 'caminho',   nome: 'Caminho' },
];
const RUNAS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
const estiloAtual = () => ESTILOS_RET.some(e => e.id === P.retratoEstilo) ? P.retratoEstilo : 'natural';
const inicial = () => (P.nome || '?').trim().charAt(0).toUpperCase() || '?';

// círculo do retrato (ou monograma quando não há imagem)
function retratoCirculo(tam, extra = '') {
  const cor = P.caminho ? caminhoPorId(P.caminho).cor : '';
  const estilo = `style="width:${tam}px;height:${tam}px;${cor ? `--pc:${cor};` : ''}"`;
  return P.retrato
    ? `<div class="ret rt-${estiloAtual()} ${extra}" ${estilo}><img src="${P.retrato}" alt="Retrato de ${esc(P.nome)}" draggable="false"></div>`
    : `<div class="ret ret-vazio ${extra}" ${estilo}><span>${esc(inicial())}</span></div>`;
}

// ---------- Selo de upload ----------
function seloHTML() {
  const cheio = !!P.retrato;
  return `<div class="selo ${cheio ? 'cheio' : ''}" id="selo">
    <svg class="selo-anel s-r1" viewBox="0 0 220 220" aria-hidden="true"><defs><path id="rc" d="M110 110m-97 0a97 97 0 1 1 194 0a97 97 0 1 1-194 0"/></defs>
      <text class="s-rt"><textPath href="#rc" textLength="600" lengthAdjust="spacing">${RUNAS}</textPath></text></svg>
    <svg class="selo-anel" viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="84" fill="none" class="s-c1"/></svg>
    <svg class="selo-anel s-r2" viewBox="0 0 220 220" aria-hidden="true"><circle cx="110" cy="110" r="78" fill="none" class="s-c2"/></svg>
    <svg class="selo-anel s-r3" viewBox="0 0 220 220" aria-hidden="true" fill="currentColor"><path d="M110 4l3 5-3 5-3-5z"/><path d="M110 206l3 5-3 5-3-5z"/><path d="M4 110l5-3 5 3-5 3z"/><path d="M206 110l5-3 5 3-5 3z"/></svg>
    <button type="button" class="selo-zona" id="selo-btn" aria-label="${cheio ? 'Trocar retrato' : 'Arraste uma imagem ou toque para escolher o retrato da alma'}">
      ${cheio ? retratoCirculo(140, 'selo-img') : `<span class="selo-vazio"><b aria-hidden="true" data-ini="${esc(inicial())}"></b><i>Arraste uma imagem<br>ou toque para escolher</i></span>`}
    </button>
    <div class="selo-onda" aria-hidden="true"></div>
    <input type="file" id="selo-file" accept="image/*" hidden>
  </div>
  <div class="selo-acoes">
    <div class="selo-estilos" role="group" aria-label="Estilo do retrato">${ESTILOS_RET.map(e => `<button type="button" class="chip-e ${estiloAtual() === e.id ? 'on' : ''}" data-e="${e.id}" ${P.retrato ? '' : 'disabled'}>${e.nome}</button>`).join('')}</div>
    ${cheio ? '<button type="button" class="link-remover" id="selo-rm">Remover retrato</button>' : '<p class="hint selo-dica">Sua alma ganha um rosto. Fica salvo só neste navegador.</p>'}
  </div>`;
}

function ligarSelo(onChange) {
  const selo = $('#selo'), file = $('#selo-file');
  if (!selo) return;
  const escolher = () => file.click();
  $('#selo-btn').addEventListener('click', escolher);
  file.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) abrirRecorte(f, onChange); });
  ['dragenter', 'dragover'].forEach(ev => selo.addEventListener(ev, e => { e.preventDefault(); selo.classList.add('arrasto'); }));
  ['dragleave', 'drop'].forEach(ev => selo.addEventListener(ev, e => { e.preventDefault(); selo.classList.remove('arrasto'); }));
  selo.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])].find(x => x.type.startsWith('image/')); if (f) abrirRecorte(f, onChange); else avisar('Isso não é uma imagem', 'Solte um arquivo de imagem (JPG, PNG, WebP…).'); });
  document.querySelectorAll('.chip-e').forEach(b => b.addEventListener('click', () => { P.retratoEstilo = b.dataset.e; salvar(); onChange(); }));
  const rm = $('#selo-rm'); if (rm) rm.addEventListener('click', () => { P.retrato = null; salvar(); onChange(); });
}
// colar imagem (Ctrl+V) enquanto estiver na Identidade
document.addEventListener('paste', e => {
  if (!document.querySelector('#selo') || document.querySelector('.crop-modal')) return;
  const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); abrirRecorte(f, window.__onRetrato || (() => {})); }
});

// ---------- Editor de recorte ----------
async function carregarImagem(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('tipo');
  if (file.size > 30 * 1024 * 1024) throw new Error('grande');
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {} }
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
}
const dimensoes = im => [im.naturalWidth || im.width, im.naturalHeight || im.height];

async function abrirRecorte(file, onChange) {
  let img;
  try { img = await carregarImagem(file); }
  catch (e) { return avisar(e.message === 'grande' ? 'Imagem grande demais' : 'Não consegui abrir a imagem', e.message === 'grande' ? 'Escolha uma imagem de até 30 MB.' : 'Tente outro arquivo (JPG, PNG ou WebP).'); }
  const [iw, ih] = dimensoes(img), size = Math.max(220, Math.min(340, Math.floor(innerWidth * 0.8))), dpr = Math.min(2, window.devicePixelRatio || 1);
  const D = size * 0.86;                                   // diâmetro do círculo
  let rot = 0, zoom = 1, ox = 0, oy = 0, estilo = estiloAtual();
  const cor = P.caminho ? caminhoPorId(P.caminho).cor : '#9b7bff';

  const m = document.createElement('div'); m.className = 'crop-modal';
  m.innerHTML = `<div class="crop-box" style="--pc:${cor}">
    <p class="asc-eyebrow" style="opacity:1">RETRATO DA ALMA</p><h3 class="crop-t">Posicione o rosto no selo</h3>
    <div class="crop-stage rt-${estilo}" id="cs" style="width:${size}px;height:${size}px">
      <canvas id="cc" width="${size * dpr}" height="${size * dpr}" style="width:${size}px;height:${size}px"></canvas><div class="tint"></div>
      <svg class="crop-mask" viewBox="0 0 100 100" aria-hidden="true"><path d="M0 0H100V100H0Z M50 50m-43 0a43 43 0 1 0 86 0a43 43 0 1 0-86 0" fill-rule="evenodd" fill="rgba(5,3,15,.82)"/>
        <circle cx="50" cy="50" r="43" fill="none" stroke="#d9b86a" stroke-width=".7"/><circle class="girando" cx="50" cy="50" r="45.5" fill="none" stroke="#d9b86a" stroke-opacity=".6" stroke-width=".4" stroke-dasharray=".6 1.6"/></svg>
    </div>
    <div class="crop-ctrl"><button type="button" class="icon" id="cr-rot" title="Girar 90°" aria-label="Girar 90 graus"><svg class="bi" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5"/></svg></button>
      <label class="crop-zoom"><span>Zoom</span><input type="range" id="cr-zoom" min="1" max="4" step="0.01" value="1"></label></div>
    <div class="selo-estilos" id="cr-estilos">${ESTILOS_RET.map(e => `<button type="button" class="chip-e ${e.id === estilo ? 'on' : ''}" data-e="${e.id}">${e.nome}</button>`).join('')}</div>
    <p class="hint crop-dica">Arraste para posicionar. Role o mouse, use o controle ou faça pinça para aproximar.</p>
    <div class="cover-btns"><button type="button" class="primary" id="cr-ok" data-ic="estrela">Selar retrato</button><button type="button" class="ghost" id="cr-no">Cancelar</button></div></div>`;
  document.body.appendChild(m);
  const sair = () => { m.remove(); devolver(); }, devolver = prenderFoco(m, sair);
  const cv = m.querySelector('#cc'), ctx = cv.getContext('2d');

  const dims = () => (rot % 2 ? [ih, iw] : [iw, ih]);
  const base = () => { const [rw, rh] = dims(); return Math.max(D / rw, D / rh); };
  const limitar = () => { const [rw, rh] = dims(), s = base() * zoom, ex = Math.max(0, (rw * s - D) / 2), ey = Math.max(0, (rh * s - D) / 2); ox = Math.max(-ex, Math.min(ex, ox)); oy = Math.max(-ey, Math.min(ey, oy)); };
  const desenhar = () => { limitar(); const S = size * dpr; ctx.clearRect(0, 0, S, S); ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.translate(S / 2 + ox * dpr, S / 2 + oy * dpr); ctx.rotate(rot * Math.PI / 2); const sc = base() * zoom * dpr; ctx.scale(sc, sc); ctx.drawImage(img, -iw / 2, -ih / 2); ctx.restore(); };
  desenhar();

  // arrastar e pinça
  const st = m.querySelector('#cs'), ptr = new Map(); let ult = 0;
  st.addEventListener('pointerdown', e => { st.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; ult = Math.hypot(a[0] - b[0], a[1] - b[1]); } st.classList.add('pegando'); });
  st.addEventListener('pointermove', e => { if (!ptr.has(e.pointerId)) return; const [px, py] = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 1) { ox += e.clientX - px; oy += e.clientY - py; }
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d2 = Math.hypot(a[0] - b[0], a[1] - b[1]); if (ult) zoom = Math.max(1, Math.min(4, zoom * d2 / ult)); ult = d2; m.querySelector('#cr-zoom').value = zoom; }
    desenhar(); });
  ['pointerup', 'pointercancel'].forEach(ev => st.addEventListener(ev, e => { ptr.delete(e.pointerId); ult = 0; if (!ptr.size) st.classList.remove('pegando'); }));
  st.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(1, Math.min(4, zoom * (1 - e.deltaY * 0.0015))); m.querySelector('#cr-zoom').value = zoom; desenhar(); }, { passive: false });
  m.querySelector('#cr-zoom').addEventListener('input', e => { zoom = +e.target.value; desenhar(); });
  m.querySelector('#cr-rot').addEventListener('click', () => { rot = (rot + 1) % 4; ox = oy = 0; desenhar(); });
  m.querySelectorAll('#cr-estilos .chip-e').forEach(b => b.addEventListener('click', () => { estilo = b.dataset.e; st.className = `crop-stage rt-${estilo}`; m.querySelectorAll('#cr-estilos .chip-e').forEach(x => x.classList.toggle('on', x === b)); }));
  m.querySelector('#cr-no').addEventListener('click', sair);
  m.querySelector('#cr-ok').addEventListener('click', () => {
    const out = document.createElement('canvas'); out.width = out.height = 512; const c2 = out.getContext('2d'), k = 512 / D;
    c2.fillStyle = '#05030f'; c2.fillRect(0, 0, 512, 512); c2.save(); c2.translate(256 + ox * k, 256 + oy * k); c2.rotate(rot * Math.PI / 2); const sc = base() * zoom * k; c2.scale(sc, sc); c2.drawImage(img, -iw / 2, -ih / 2); c2.restore();
    P.retrato = out.toDataURL('image/jpeg', 0.88); P.retratoEstilo = estilo;
    if (!salvar()) avisar('Não coube na memória do navegador', 'O retrato aparece nesta sessão, mas pode não ser guardado. Exporte a ficha em JSON para não perdê-lo.');
    sair(); Som.selar(); onChange(true);
  });
  setTimeout(() => m.querySelector('#cr-ok').focus(), 50);
}
