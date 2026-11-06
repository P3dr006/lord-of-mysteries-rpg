// Emblemas de raças e origens: glifo (viewBox 24) + cor. Desenhos originais.
const EMBLEMAS = {
  // Raças
  humano:   { cor:'#e3c277', g:'<circle cx="12" cy="7" r="3.2"/><path d="M5 21c0-4.5 3-7 7-7s7 2.5 7 7"/><path d="M12 1.5v1.5"/>' },
  mutante:  { cor:'#8bd36b', g:'<path d="M8 3c8 4-8 6 0 9s8 5 0 9M16 3c-8 4 8 6 0 9s-8 5 0 9"/><path d="M9.5 6.5h5M8.5 12h7M9.5 17.5h5"/>' },
  gigante:  { cor:'#d6914f', g:'<path d="M2 21l6-11 3 5 4-9 7 15z"/><path d="M8 10l-1.5 3M15 6l1 3"/>' },
  elfo:     { cor:'#6fd6e8', g:'<path d="M12 2c5 4 6 10 0 14-6-4-5-10 0-14z"/><path d="M12 6v10"/><path d="M2 20c3-2 5 2 10 0s7 2 10 0"/>' },
  sanguineo:{ cor:'#e0405a', g:'<path d="M12 2c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z"/><path d="M9.5 14l1 3.2 1-3.2M12.5 14l1 3.2 1-3.2"/>' },
  lobo:     { cor:'#9aa3d8', g:'<path d="M3 3l5 4h8l5-4-1 9-4 8h-8l-4-8z"/><path d="M8 12h2M14 12h2M12 15.5v2.5"/><circle cx="12" cy="9.5" r=".9"/>' },
  dragao:   { cor:'#f5a83a', g:'<path d="M2 6c4 0 6 3 8 3l2-4 2 4c2 0 4-3 8-3-1 6-4 9-8 10l-2 5-2-5C6 15 3 12 2 6z"/><path d="M12 9v7"/>' },
  fenix:    { cor:'#ff7d3b', g:'<path d="M12 21c-5 0-7-4-5-8 1 2 3 2 3 0-1-4 1-8 2-10 1 3 6 5 6 10 0 3-2 8-6 8z"/><path d="M7 4c1 2 0 3-1 4M17 4c-1 2 0 3 1 4"/>' },
  diabo:    { cor:'#e24a8a', g:'<path d="M5 3c0 5 2 6 4 7M19 3c0 5-2 6-4 7"/><circle cx="12" cy="14" r="6.5"/><path d="M8.5 13l2.5 1M15.5 13L13 14M10 17.5c1.3 1 2.7 1 4 0"/>' },
  sereia:   { cor:'#5eaeff', g:'<circle cx="12" cy="5" r="2.5"/><path d="M12 8c-3 3-3 7 0 10M12 8c3 3 3 7 0 10M12 18l-5 4M12 18l5 4"/>' },
  peixe:    { cor:'#4fd8b4', g:'<path d="M2 12c4-6 11-6 15 0-4 6-11 6-15 0zM17 12l5-4v8z"/><circle cx="7" cy="11" r=".9"/><path d="M10 9c1 2 1 4 0 6"/>' },
  banshee:  { cor:'#d5ddff', g:'<path d="M5 22V10a7 7 0 0114 0v12l-3-3-2 3-2-3-2 3-2-3z"/><ellipse cx="12" cy="12" rx="1.7" ry="2.8"/><path d="M8.5 8.5h.01M15.5 8.5h.01"/>' },
  fohan:    { cor:'#7ea6ff', g:'<path d="M3 15l4-6h5l3-4 2 2-1 3 4 2v4h-3l-2-2h-5l-2 3H5z"/><path d="M2 20c2-1 3 1 5 0M16 21c2-1 3 1 5 0"/>' },
  // Origens
  nobre:      { cor:'#e3c277', g:'<path d="M3 21V9l3 2V6l3 2 3-4 3 4 3-2v5l3-2v12zM10 21v-5h4v5"/>' },
  operario:   { cor:'#c2956b', g:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>' },
  marinheiro: { cor:'#5eaeff', g:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M7 11h10M4 15c1 4 4 6 8 6s7-2 8-6"/>' },
  estudioso:  { cor:'#c8a0ff', g:'<path d="M3 5c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2z"/><path d="M12 7v14"/>' },
  clerigo:    { cor:'#f2e9c0', g:'<path d="M12 2v7M9 4.5h6"/><path d="M5 22V13l7-3 7 3v9zM10 22v-5h4v5"/>' },
  mercenario: { cor:'#d8a0a0', g:'<path d="M4 4l12 12M20 4L8 16M3 19l3-3M21 19l-3-3M14 18l2 2M10 18l-2 2"/>' },
  rua:        { cor:'#9aa3b8', g:'<path d="M12 3c-5 0-8 5-8 10v8h16v-8c0-5-3-10-8-10z"/><path d="M9 13c1 1 5 1 6 0"/>' },
  boticario:  { cor:'#7ed67e', g:'<path d="M9 2h6M10 2v6l-5 11a2 2 0 002 3h10a2 2 0 002-3L14 8V2"/><path d="M7.5 15h9"/>' },
};
RACAS.forEach(r => Object.assign(r, EMBLEMAS[r.id]));
ORIGENS.forEach(o => Object.assign(o, EMBLEMAS[o.id]));

let _medalN = 0;
// Medalhão ornamentado com anel de runas girando
function medalhao(item, tam = 72, plano = false) {
  const id = 'mg' + (++_medalN), c = item.cor;
  let marcas = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180, x = 32 + 30 * Math.sin(a), y = 32 - 30 * Math.cos(a);
    marcas += `<rect x="${x - 1.6}" y="${y - 1.6}" width="3.2" height="3.2" transform="rotate(45 ${x} ${y})" fill="${c}"/>`;
  }
  const fundo = `<defs><radialGradient id="${id}" cx="50%" cy="38%" r="65%"><stop offset="0" stop-color="${c}" stop-opacity=".5"/><stop offset="1" stop-color="#0d0b1f"/></radialGradient></defs>
    <circle cx="32" cy="32" r="30" fill="url(#${id})" stroke="${c}" stroke-width="1.5"/>`;
  const anel = `<circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-opacity=".6" stroke-dasharray="1.2 3.6" stroke-width="1.4"/>`;
  const resto = `<circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-opacity=".25"/>
    ${marcas}
    <g transform="translate(12.8 12.8) scale(1.6)" fill="none" stroke="${c}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 2px ${c})">${item.g}</g>`;
  const svg = (cls, corpo) => `<svg class="${cls}" viewBox="0 0 64 64" width="${tam}" height="${tam}" aria-hidden="true">${corpo}</svg>`;
  // plano: um SVG só, estático (usado para desenhar o pôster)
  if (plano) return svg('medal', fundo + anel + resto);
  // em tela: o anel é uma camada separada que gira na placa de vídeo (um SVG que muda por dentro seria repintado a cada quadro)
  return `<span class="medal-w" style="width:${tam}px;height:${tam}px">${svg('medal', fundo)}${svg('medal medal-ring', anel)}${svg('medal', resto)}</span>`;
}
