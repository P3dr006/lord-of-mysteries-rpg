// Ícones de botão (SVG, traço) — aplicados a qualquer <button data-ic="nome">
const ICONES = {
  dado:    '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 2v20M3 7l9 5 9-5"/>',
  baixar:  '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  subir:   '<path d="M12 21V9M7 13l5-5 5 5M4 3h16"/>',
  relance: '<path d="M4 12a8 8 0 108-8M4 4v5h5"/>',
  novo:    '<path d="M12 4v16M4 12h16"/>',
  esq:     '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  dir:     '<path d="M5 12h14M13 6l6 6-6 6"/>',
  estrela: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
  livro:   '<path d="M3 5c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2z"/><path d="M12 7v14"/>',
  som:     '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
  mudo:    '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  olho:    '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M4 4l2 2M20 4l-2 2"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.5c2.2.7 3.5 2.6 3.5 5.5"/>',
  lixo:    '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  copia:   '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  mais:    '<path d="M12 5v14M5 12h14"/>',
  carta:   '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 8l2.5 4-2.5 4-2.5-4z"/>',
};
function decorarBotao(b) {
  if (b.dataset.icOk || !b.dataset.ic || !ICONES[b.dataset.ic]) return;
  b.dataset.icOk = '1';
  const svg = `<svg class="bi" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[b.dataset.ic]}</svg>`;
  b.insertAdjacentHTML(b.hasAttribute('data-ic-end') ? 'beforeend' : 'afterbegin', svg);
}
const decorarTudo = () => document.querySelectorAll('button[data-ic]').forEach(decorarBotao);
new MutationObserver(decorarTudo).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', decorarTudo);
