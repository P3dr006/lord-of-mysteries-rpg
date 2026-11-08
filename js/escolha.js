// Seletor próprio do Grimório: troca a lista nativa do <select> (desenhada pelo sistema, impossível de estilizar)
// por um botão e uma lista ornamentados. O <select> original continua no DOM, escondido e sincronizado: o resto do
// código lê/escreve .value e escuta 'change' como sempre, e os testes podem usar selectOption nele.
// Acessível: botão com aria-haspopup="listbox"; lista role="listbox" com aria-activedescendant; setas, Home/End,
// letras (busca pela inicial), Enter/Espaço escolhem, Esc e Tab fecham. Um seletor desabilitado desabilita o botão.
'use strict';
const Escolha = Object.freeze((() => {
  let seq = 0, aberto = null;
  const valorNativo = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const indiceNativo = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const glifo = o => {
    const id = o && o.dataset ? o.dataset.glifo : '';
    if (!id || typeof caminhoPorId !== 'function' || typeof svgGlifo !== 'function') return '';
    const c = caminhoPorId(id); return c ? `<span class="esc-g" aria-hidden="true">${svgGlifo(c, 16)}</span>` : '';
  };

  function rotulo(sel, bt) {
    const o = sel.options[sel.selectedIndex];
    bt.querySelector('.esc-v').innerHTML = o ? glifo(o) + `<span class="esc-t">${esc(o.textContent)}</span>` : '<span class="esc-t">—</span>';
    bt.disabled = sel.disabled; bt.classList.toggle('vazio', !o || o.value === '');
  }

  function fechar(devolver = true) {
    if (!aberto) return; const { lista, bt, limpar } = aberto; aberto = null;
    limpar(); lista.remove(); bt.setAttribute('aria-expanded', 'false'); bt.classList.remove('aberto');
    if (devolver && bt.isConnected) bt.focus();
  }

  function abrir(sel, bt) {
    if (sel.disabled) return; fechar(false);
    const id = 'esc-l' + (++seq), itens = [];
    let html = '';
    const item = o => { const i = itens.length; itens.push(o); return `<li role="option" id="${id}-${i}" data-i="${i}" class="esc-o${o.disabled ? ' off' : ''}" aria-selected="${o.selected}"${o.disabled ? ' aria-disabled="true"' : ''}>${glifo(o)}<span>${esc(o.textContent)}</span></li>`; };
    for (const filho of sel.children) {
      if (filho.tagName === 'OPTGROUP' && !filho.children.length) continue;   // grupo vazio não aparece
      if (filho.tagName === 'OPTGROUP') html += `<li role="presentation" class="esc-grupo"><span>${esc(/** @type {HTMLOptGroupElement} */ (filho).label)}</span></li>` + [...filho.children].map(o => item(/** @type {HTMLOptionElement} */ (o))).join('');
      else if (filho.tagName === 'OPTION') html += item(/** @type {HTMLOptionElement} */ (filho));
    }
    const lista = document.createElement('ul');
    lista.className = 'esc-lista'; lista.id = id; lista.setAttribute('role', 'listbox'); lista.tabIndex = -1;
    lista.setAttribute('aria-labelledby', bt.getAttribute('aria-labelledby') || bt.id); lista.innerHTML = html;
    // dentro de uma janela modal, a lista mora no fundo dela (fica acima e não quebra o foco preso)
    (bt.closest('.m-ficha-fundo') || document.body).appendChild(lista);
    let ativo = Math.max(0, itens.findIndex(o => o.selected));
    const marcar = i => {
      if (!itens.length) return; ativo = Math.max(0, Math.min(itens.length - 1, i));
      lista.querySelectorAll('.esc-o.ativo').forEach(x => x.classList.remove('ativo'));
      const li = lista.querySelector(`#${id}-${ativo}`); if (!li) return;
      li.classList.add('ativo'); lista.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' });
    };
    const posicionar = () => {
      const r = bt.getBoundingClientRect(), vh = window.innerHeight, alt = Math.min(lista.scrollHeight, 340);
      const cima = r.bottom + alt + 8 > vh && r.top > vh - r.bottom;
      lista.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8)) + 'px';
      lista.style.minWidth = r.width + 'px'; lista.style.maxWidth = Math.max(r.width, Math.min(420, window.innerWidth - 16)) + 'px';
      lista.style.top = (cima ? Math.max(8, r.top - alt - 6) : r.bottom + 6) + 'px';
      lista.classList.toggle('cima', cima);
    };
    const escolher = i => {
      const o = itens[i]; if (!o || o.disabled) return;
      const mudou = !o.selected; o.selected = true; rotulo(sel, bt); fechar();
      if (mudou) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    const passo = (i, d) => { let k = i; do k += d; while (itens[k] && itens[k].disabled); return itens[k] ? k : i; };
    let busca = '', buscaT = 0;
    lista.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowDown') { e.preventDefault(); marcar(passo(ativo, 1)); }
      else if (k === 'ArrowUp') { e.preventDefault(); marcar(passo(ativo, -1)); }
      else if (k === 'Home') { e.preventDefault(); marcar(passo(-1, 1)); }
      else if (k === 'End') { e.preventDefault(); marcar(passo(itens.length, -1)); }
      else if (k === 'PageDown') { e.preventDefault(); marcar(ativo + 8); }
      else if (k === 'PageUp') { e.preventDefault(); marcar(ativo - 8); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); escolher(ativo); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
      else if (k === 'Tab') { e.preventDefault(); fechar(); }
      else if (k.length === 1 && /\S/.test(k)) {
        clearTimeout(buscaT); busca += k.toLowerCase(); buscaT = setTimeout(() => { busca = ''; }, 700);
        const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const q = norm(busca), ordem = [...itens.keys()].slice(ativo + (busca.length === 1 ? 1 : 0)).concat([...itens.keys()].slice(0, ativo + 1));
        const achou = ordem.find(i => !itens[i].disabled && norm(itens[i].textContent).trim().startsWith(q)); if (achou != null) marcar(achou);
      }
    });
    lista.addEventListener('mousedown', e => e.preventDefault());   // não rouba o foco da lista
    lista.addEventListener('click', e => { const li = /** @type {HTMLElement} */ (e.target).closest('.esc-o'); if (li) escolher(+li.dataset.i); });
    lista.addEventListener('mousemove', e => { const li = /** @type {HTMLElement} */ (e.target).closest('.esc-o'); if (li && +li.dataset.i !== ativo && !li.classList.contains('off')) marcar(+li.dataset.i); });
    const fora = e => { if (!lista.contains(e.target) && e.target !== bt && !bt.contains(e.target)) fechar(false); };
    const rolou = e => { if (!lista.contains(e.target)) posicionar(); };
    document.addEventListener('mousedown', fora, true); window.addEventListener('resize', posicionar); window.addEventListener('scroll', rolou, true);
    aberto = { lista, bt, limpar: () => { document.removeEventListener('mousedown', fora, true); window.removeEventListener('resize', posicionar); window.removeEventListener('scroll', rolou, true); } };
    bt.setAttribute('aria-expanded', 'true'); bt.setAttribute('aria-controls', id); bt.classList.add('aberto');
    posicionar(); lista.focus({ preventScroll: true }); marcar(ativo);
  }

  function enfeitar(sel) {
    if (sel.dataset.esc || sel.multiple || Number(sel.size) > 1) return;
    sel.dataset.esc = '1';
    const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'esc-btn';
    bt.id = (sel.id || 'esc' + (++seq)) + '-esc';
    bt.setAttribute('aria-haspopup', 'listbox'); bt.setAttribute('aria-expanded', 'false');
    bt.innerHTML = '<span class="esc-v"></span><span class="esc-seta" aria-hidden="true"><i></i></span>';
    // o nome acessível vem do <label> do select (ou do aria-label dele) + o valor atual
    const lab = sel.labels && sel.labels[0];
    if (lab) { if (!lab.id) lab.id = bt.id + '-r'; bt.setAttribute('aria-labelledby', lab.id + ' ' + bt.id); lab.addEventListener('click', e => { e.preventDefault(); if (!bt.disabled) bt.focus(); }); }
    else if (sel.getAttribute('aria-label')) bt.setAttribute('aria-label', sel.getAttribute('aria-label') + ': ' + (sel.options[sel.selectedIndex] || { textContent: '' }).textContent);
    sel.classList.add('esc-nativo'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    sel.after(bt); rotulo(sel, bt);
    // atribuições diretas (sel.value = x) não disparam evento: o rótulo acompanha mesmo assim
    Object.defineProperty(sel, 'value', { configurable: true, get() { return valorNativo.get.call(this); }, set(v) { valorNativo.set.call(this, v); rotulo(sel, bt); } });
    Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return indiceNativo.get.call(this); }, set(v) { indiceNativo.set.call(this, v); rotulo(sel, bt); } });
    sel.addEventListener('change', () => rotulo(sel, bt));
    sel.addEventListener('focus', () => { if (!bt.disabled) bt.focus(); });
    new MutationObserver(() => rotulo(sel, bt)).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
    bt.addEventListener('click', () => (aberto && aberto.bt === bt ? fechar() : abrir(sel, bt)));
    bt.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !e.altKey) { e.preventDefault(); abrir(sel, bt); } });
  }

  function varrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.tagName === 'SELECT') enfeitar(/** @type {HTMLSelectElement} */ (raiz));
    raiz.querySelectorAll('select').forEach(s => enfeitar(/** @type {HTMLSelectElement} */ (s)));
  }
  function iniciar() {
    varrer(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        m.addedNodes.forEach(n => varrer(/** @type {Element} */ (n)));
        // botão que ficou sem o select (o select foi trocado sozinho): some também
        m.removedNodes.forEach(n => { if (/** @type {Element} */ (n).tagName === 'SELECT') { const b = document.getElementById(/** @type {Element} */ (n).id + '-esc'); if (b && !b.previousElementSibling?.matches('select')) b.remove(); } });
      }
      if (aberto && !aberto.bt.isConnected) fechar(false);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  return { varrer, fechar };
})());
