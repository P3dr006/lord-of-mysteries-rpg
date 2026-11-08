// Pôster do Beyonder: A4 desenhado em canvas (fundo por Caminho, moldura por raça) + PDF próprio.
const Poster = Object.freeze((() => {
  const W = 1000, H = 1414, ESC = 1.654;                 // unidades de desenho; 1654×2339 px (A4 a 200 dpi)
  const TAU = Math.PI * 2, FONTE = 'Georgia, "Times New Roman", serif';
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  // Caminho -> estilo de fundo
  const ESTILO = { louco: 'misterios', erro: 'misterios', porta: 'misterios', eremita: 'misterios', roda: 'misterios', visionario: 'celestial', sol: 'celestial', lua: 'celestial',
    tirano: 'tempestades', torre: 'lei', imperador: 'lei', justiceiro: 'lei', enforcado: 'sombras', escuridao: 'sombras', morte: 'sombras', abismo: 'sombras',
    gigante: 'guerra', demonessa: 'guerra', sacerdote: 'guerra', mae: 'vida', paragono: 'aco', acorrentado: 'aco' };
  // Raça -> moldura
  const MOLDURA = { humano: 'humano', mutante: 'organica', gigante: 'pedra', elfo: 'folhas', sanguineo: 'gotica', lobo: 'garras', dragao: 'escamas', fenix: 'chamas',
    diabo: 'espinhos', sereia: 'ondas', peixe: 'bolhas', banshee: 'espectro', fohan: 'correntes' };

  // ---------- utilidades ----------
  function carregar(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  const svgImg = svg => carregar('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')));
  function texto(c, t, x, y, o = {}) {
    c.save(); c.font = `${o.peso || 'normal'} ${o.tam || 24}px ${FONTE}`; c.fillStyle = o.cor || '#fff'; c.textAlign = o.al || 'left'; c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = (o.esp || 0) + 'px';
    if (o.sombra) { c.shadowColor = o.sombra; c.shadowBlur = o.blur || 14; }
    if (o.max) { while (c.measureText(t).width > o.max && (o.tam || 24) > 12) { o.tam = (o.tam || 24) - 2; c.font = `${o.peso || 'normal'} ${o.tam}px ${FONTE}`; } }
    c.fillText(t, x, y); c.restore();
  }
  function linhas(c, t, larg, tam) { c.save(); c.font = `normal ${tam}px ${FONTE}`;
    // palavra maior que a largura (sem espaços) é quebrada em pedaços que cabem
    const pal = []; String(t).split(/\s+/).forEach(w => { while (c.measureText(w).width > larg && w.length > 1) { let n = w.length - 1; while (n > 1 && c.measureText(w.slice(0, n)).width > larg) n--; pal.push(w.slice(0, n)); w = w.slice(n); } pal.push(w); });
    const out = []; let l = ''; pal.forEach(p => { const x = l ? l + ' ' + p : p; if (c.measureText(x).width > larg && l) { out.push(l); l = p; } else l = x; }); if (l) out.push(l); c.restore(); return out; }
  // corta o texto com reticências para caber em uma linha
  function umaLinha(c, t, larg, tam) { c.save(); c.font = `normal ${tam}px ${FONTE}`; let x = String(t); if (c.measureText(x).width > larg) { while (x.length > 1 && c.measureText(x + '…').width > larg) x = x.slice(0, -1); x = x.trimEnd() + '…'; } c.restore(); return x; }
  function paragrafo(c, t, x, y, larg, tam, ent, cor, maxL) { let ls = linhas(c, t, larg, tam); if (maxL && ls.length > maxL) { ls = ls.slice(0, maxL); ls[maxL - 1] = ls[maxL - 1].replace(/\s*\S*$/, '') + '…'; } ls.forEach((l, i) => texto(c, l, x, y + i * ent, { tam, cor })); return ls.length; }
  function brilho(c, x, y, r, cor, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(cor, a)); g.addColorStop(1, rgba(cor, 0)); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }

  // ---------- 8 fundos ----------
  const FUNDOS = {
    celestial(c, cor, T) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d1240'); g.addColorStop(.5, '#14104a'); g.addColorStop(1, '#070622'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      brilho(c, W / 2, 240, 620, cor, .35);
      c.save(); c.translate(W / 2, 240); for (let i = 0; i < 28; i++) { c.rotate(TAU / 28); c.fillStyle = rgba(cor, .07); c.beginPath(); c.moveTo(0, 0); c.lineTo(1600, -22); c.lineTo(1600, 22); c.fill(); } c.restore();
      const R = rnd(11); for (let i = 0; i < 160; i++) { const x = R() * W, y = R() * H, s = R() * 2.2; c.fillStyle = `rgba(255,255,255,${.25 + R() * .6})`; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); }
      c.strokeStyle = rgba(cor, .18); c.lineWidth = 1.5; for (let i = 1; i < 6; i++) { c.beginPath(); c.arc(W / 2, 240, 120 * i + 60, Math.PI * .1, Math.PI * .9); c.stroke(); } },
    sombras(c, cor, T) { const g = c.createRadialGradient(W / 2, 400, 80, W / 2, 700, 1000); g.addColorStop(0, '#16121f'); g.addColorStop(1, '#020104'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const R = rnd(7); for (let i = 0; i < 26; i++) brilho(c, R() * W, R() * H, 120 + R() * 220, i % 3 ? '#2a2540' : cor, .12 + R() * .1);
      c.strokeStyle = rgba('#ffffff', .05); c.lineWidth = 2; for (let i = 0; i < 18; i++) { c.beginPath(); const y0 = R() * H; c.moveTo(-20, y0); for (let x = 0; x <= W + 20; x += 40) c.lineTo(x, y0 + Math.sin(x * .011 + i) * 40 + Math.sin(x * .03 + i * 2) * 14); c.stroke(); }
      vinheta(c, .8); },
    guerra(c, cor, T) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0608'); g.addColorStop(.6, '#2a0b0b'); g.addColorStop(1, '#5a1a08'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      brilho(c, W / 2, H, 760, '#ff6a20', .35); c.strokeStyle = rgba('#000', .35); c.lineWidth = 26; c.lineCap = 'round'; [[-80, 260, 700, -80], [300, 1500, 1100, 380], [-100, 900, 560, 1500]].forEach(([a, b, d, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
      c.strokeStyle = rgba(cor, .14); c.lineWidth = 3; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(-50 + i * 110, H); c.lineTo(300 + i * 80, 0); c.stroke(); }
      const R = rnd(13); for (let i = 0; i < 140; i++) { const x = R() * W, y = H - Math.pow(R(), 1.7) * H; brilho(c, x, y, 3 + R() * 6, R() > .5 ? '#ffb030' : '#ff5020', .8); } },
    tempestades(c, cor, T) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05142a'); g.addColorStop(1, '#021019'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const R = rnd(17); for (let i = 0; i < 12; i++) brilho(c, R() * W, R() * 420, 160 + R() * 220, '#3a5a8a', .22);
      c.strokeStyle = 'rgba(160,200,255,.14)'; c.lineWidth = 1.4; for (let i = 0; i < 260; i++) { const x = R() * (W + 200), y = R() * H; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 22, y + 70); c.stroke(); }
      c.save(); c.strokeStyle = rgba('#bfe0ff', .9); c.shadowColor = '#7ab8ff'; c.shadowBlur = 24; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); let x = 800, y = -10; c.moveTo(x, y); while (y < 520) { y += 36 + R() * 40; x += (R() - .5) * 110; c.lineTo(x, y); } c.stroke(); c.restore();
      c.fillStyle = rgba('#0b2540', .85); for (let l = 0; l < 3; l++) { c.beginPath(); c.moveTo(0, H); for (let xx = 0; xx <= W; xx += 12) c.lineTo(xx, H - 70 - l * 28 - Math.sin(xx * .014 + l * 2) * (22 + l * 8)); c.lineTo(W, H); c.fill(); } },
    vida(c, cor, T) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07220f'); g.addColorStop(1, '#03120a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      brilho(c, W / 2, 200, 700, '#7aff9a', .13);
      const R = rnd(19); c.lineCap = 'round'; for (let v = 0; v < 9; v++) { let x = (v + .5) * W / 9 + (R() - .5) * 60, y = H + 20; c.strokeStyle = rgba('#2f9a50', .35); c.lineWidth = 5; c.beginPath(); c.moveTo(x, y); for (let t = 0; t < 40; t++) { y -= 36; x += Math.sin(t * .5 + v) * 14; c.lineTo(x, y); } c.stroke();
        let x2 = (v + .5) * W / 9, y2 = H + 20; for (let t = 0; t < 40; t++) { y2 -= 36; x2 += Math.sin(t * .5 + v) * 14; if (t % 3 === 0) { c.save(); c.translate(x2, y2); c.rotate(t % 6 ? .8 : -.8); c.fillStyle = rgba('#4cc46a', .22); c.beginPath(); c.ellipse(16, 0, 20, 8, 0, 0, TAU); c.fill(); c.restore(); } } }
      for (let i = 0; i < 70; i++) brilho(c, R() * W, R() * H, 4 + R() * 5, '#fff3a0', .6); },
    lei(c, cor, T) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1028'); g.addColorStop(1, '#161226'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      brilho(c, W / 2, 360, 600, '#f0d070', .1);
      for (let i = 0; i < 6; i++) { const x = 60 + i * 176; c.fillStyle = rgba('#d9b86a', .055); c.fillRect(x, 0, 56, H); c.fillStyle = rgba('#d9b86a', .1); c.fillRect(x - 8, 60, 72, 26); c.fillRect(x - 8, H - 86, 72, 26); }
      c.strokeStyle = rgba('#d9b86a', .12); c.lineWidth = 2; for (let y = 120; y < H; y += 120) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.save(); c.translate(W / 2, 520); c.strokeStyle = rgba('#d9b86a', .16); c.lineWidth = 5; c.beginPath(); c.moveTo(0, 260); c.lineTo(0, -260); c.moveTo(-170, 260); c.lineTo(170, 260); c.moveTo(-300, -180); c.lineTo(300, -180); c.stroke(); [-1, 1].forEach(s => { c.beginPath(); c.moveTo(s * 300, -180); c.lineTo(s * 360, -20); c.moveTo(s * 300, -180); c.lineTo(s * 240, -20); c.arc(s * 300, -20, 60, 0, Math.PI); c.stroke(); }); c.restore(); },
    misterios(c, cor, T) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#150b38'); g.addColorStop(1, '#0a0620'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      brilho(c, 300, 300, 600, '#6a3aff', .16); brilho(c, 760, 1000, 600, cor, .13);
      const R = rnd(23), pts = Array.from({ length: 22 }, () => [60 + R() * (W - 120), 60 + R() * (H - 120)]);
      c.strokeStyle = rgba('#b9a7ff', .13); c.lineWidth = 1.5; pts.forEach((p, i) => { const q = pts[(i * 5 + 3) % 22]; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }); pts.forEach(p => brilho(c, p[0], p[1], 14, '#d9c8ff', .8));
      c.fillStyle = rgba('#d9b86a', .09); c.font = `34px ${FONTE}`; const rn = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'; for (let i = 0; i < 46; i++) c.fillText(rn[i % rn.length], R() * W, R() * H);
      c.strokeStyle = rgba('#d9b86a', .1); c.lineWidth = 2; c.beginPath(); c.arc(W / 2, 520, 420, 0, TAU); c.stroke(); c.beginPath(); c.arc(W / 2, 520, 380, 0, TAU); c.setLineDash([4, 14]); c.stroke(); c.setLineDash([]); },
    aco(c, cor, T) { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#15181f'); g.addColorStop(1, '#0a0c12'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = rgba('#8aa0c0', .07); c.lineWidth = 1; for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      [[160, 300, 130, 18], [850, 520, 170, 22], [200, 1050, 150, 20], [820, 1180, 110, 16], [500, 120, 90, 14]].forEach(([x, y, r, n], i) => { c.save(); c.translate(x, y); c.rotate(i); c.fillStyle = rgba('#7a8aa8', .1); c.strokeStyle = rgba('#aab8d0', .18); c.lineWidth = 3; c.beginPath(); for (let t = 0; t < n; t++) { const a = t / n * TAU, s = TAU / n; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + s * .15) * (r + 18), Math.sin(a + s * .15) * (r + 18)); c.lineTo(Math.cos(a + s * .4) * (r + 18), Math.sin(a + s * .4) * (r + 18)); c.lineTo(Math.cos(a + s * .55) * r, Math.sin(a + s * .55) * r); } c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, r * .3, 0, TAU); c.stroke(); c.restore(); });
      c.fillStyle = rgba('#aab8d0', .22); [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); }); },
  };
  function vinheta(c, a) { const g = c.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 900); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }

  // ---------- 13 molduras ----------
  const X0 = 34, Y0 = 34, X1 = W - 34, Y1 = H - 34;
  function perimetro(passo, fn) { // percorre o retângulo; fn(x,y,nx,ny,i) com (nx,ny) apontando para dentro
    let i = 0; for (let x = X0 + passo / 2; x < X1; x += passo) { fn(x, Y0, 0, 1, i++); fn(x, Y1, 0, -1, i++); }
    for (let y = Y0 + passo / 2; y < Y1; y += passo) { fn(X0, y, 1, 0, i++); fn(X1, y, -1, 0, i++); } }
  function retFrame(c, cor, m = 0, lw = 3) { c.strokeStyle = cor; c.lineWidth = lw; c.strokeRect(X0 + m, Y0 + m, X1 - X0 - 2 * m, Y1 - Y0 - 2 * m); }
  function cantos(c, fn) { [[X0, Y0, 1, 1], [X1, Y0, -1, 1], [X0, Y1, 1, -1], [X1, Y1, -1, -1]].forEach(([x, y, sx, sy]) => { c.save(); c.translate(x, y); c.scale(sx, sy); fn(c); c.restore(); }); }
  const MOLD = {
    humano(c, ouro, cor) { retFrame(c, ouro, 0, 3.5); retFrame(c, rgba(ouro, .55), 12, 1.5); cantos(c, k => { k.fillStyle = ouro; k.beginPath(); k.moveTo(0, 0); k.lineTo(46, 0); k.lineTo(0, 46); k.fill(); k.strokeStyle = ouro; k.lineWidth = 2; k.beginPath(); k.arc(58, 58, 14, 0, TAU); k.stroke(); k.beginPath(); k.moveTo(58, 44); k.lineTo(65, 58); k.lineTo(58, 72); k.lineTo(51, 58); k.closePath(); k.fill(); }); },
    organica(c, ouro, cor) { const R = rnd(5); c.strokeStyle = ouro; c.lineWidth = 3.5; c.beginPath(); let first = true; perimetro(14, () => {}); c.save(); c.lineJoin = 'round'; c.beginPath();
      const pts = []; for (let x = X0; x <= X1; x += 12) pts.push([x, Y0 + Math.sin(x * .05) * 5 + (R() - .5) * 6]); for (let y = Y0; y <= Y1; y += 12) pts.push([X1 + Math.sin(y * .05) * 5 + (R() - .5) * 6, y]); for (let x = X1; x >= X0; x -= 12) pts.push([x, Y1 + Math.sin(x * .05) * 5 + (R() - .5) * 6]); for (let y = Y1; y >= Y0; y -= 12) pts.push([X0 + Math.sin(y * .05) * 5 + (R() - .5) * 6, y]);
      pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke(); c.restore();
      perimetro(46, (x, y, nx, ny, i) => { if (R() > .55) { c.fillStyle = rgba(cor, .75); c.beginPath(); c.ellipse(x + nx * 9, y + ny * 9, 7 + R() * 9, 6 + R() * 7, R() * 3, 0, TAU); c.fill(); c.strokeStyle = ouro; c.lineWidth = 1.5; c.stroke(); } }); retFrame(c, rgba(ouro, .4), 22, 1.2); },
    pedra(c, ouro, cor) { c.fillStyle = rgba('#7a6a58', .55); perimetro(40, (x, y, nx, ny, i) => { c.save(); c.translate(x, y); c.fillRect(-19, -19, 38, 38); c.strokeStyle = rgba('#d8c8a8', .5); c.lineWidth = 2; c.strokeRect(-19, -19, 38, 38); if (i % 5 === 0) { c.fillStyle = ouro; c.font = `22px ${FONTE}`; c.textAlign = 'center'; c.fillText('ᚦᚨᚱᚲᚷᚹ'[i % 6], 0, 8); c.fillStyle = rgba('#7a6a58', .55); } c.restore(); });
      retFrame(c, ouro, 20, 3); retFrame(c, rgba(ouro, .5), 28, 1.2); cantos(c, k => { k.fillStyle = '#5a4a3a'; k.fillRect(-4, -4, 72, 72); k.strokeStyle = ouro; k.lineWidth = 4; k.strokeRect(-4, -4, 72, 72); k.fillStyle = ouro; k.font = `40px ${FONTE}`; k.fillText('ᚦ', 20, 46); }); },
    folhas(c, ouro, cor) { retFrame(c, rgba(ouro, .8), 14, 2); c.strokeStyle = ouro; c.fillStyle = rgba('#7ae0b0', .4); const folha = (x, y, a, s) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * .5, -s * .45, s, 0); c.quadraticCurveTo(s * .5, s * .45, 0, 0); c.fill(); c.lineWidth = 1.5; c.stroke(); c.restore(); };
      perimetro(54, (x, y, nx, ny, i) => { const a = Math.atan2(ny, nx); folha(x, y, a + (i % 2 ? .6 : -.6), 26); }); cantos(c, k => { k.strokeStyle = ouro; k.lineWidth = 3; k.beginPath(); k.moveTo(0, 90); k.quadraticCurveTo(0, 0, 90, 0); k.stroke(); k.beginPath(); k.moveTo(14, 110); k.quadraticCurveTo(14, 14, 110, 14); k.stroke(); for (let t = 0; t < 4; t++) folha.call(null, 16 + t * 20, 16 + (3 - t) * 8, Math.PI / 4, 24); }); },
    gotica(c, ouro, cor) { retFrame(c, ouro, 0, 3); retFrame(c, rgba(ouro, .5), 10, 1.4); c.fillStyle = ouro; perimetro(30, (x, y, nx, ny, i) => { c.save(); c.translate(x, y); c.rotate(Math.atan2(ny, nx) - Math.PI / 2); c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.lineTo(0, 17); c.fill(); c.restore(); });
      cantos(c, k => { k.strokeStyle = ouro; k.lineWidth = 3; k.fillStyle = rgba(cor, .8); k.beginPath(); k.moveTo(0, 0); k.lineTo(110, 0); k.quadraticCurveTo(50, 20, 40, 70); k.lineTo(0, 110); k.closePath(); k.fill(); k.stroke(); k.fillStyle = '#e0405a'; k.beginPath(); k.moveTo(40, 40); k.quadraticCurveTo(30, 58, 40, 62); k.quadraticCurveTo(50, 58, 40, 40); k.fill(); }); },
    garras(c, ouro, cor) { retFrame(c, rgba(ouro, .7), 12, 2); c.fillStyle = ouro; perimetro(26, (x, y, nx, ny, i) => { c.save(); c.translate(x, y); c.rotate(Math.atan2(ny, nx) - Math.PI / 2); c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, 22 + (i % 3) * 6); c.lineTo(9, 0); c.fill(); c.restore(); });
      cantos(c, k => { k.strokeStyle = ouro; k.lineWidth = 6; k.lineCap = 'round'; [[20, 0, 90, 90], [48, 0, 118, 90], [76, 0, 146, 90]].forEach(([a, b, d, e]) => { k.beginPath(); k.moveTo(a, b + 10); k.lineTo(d, e); k.stroke(); }); k.strokeStyle = rgba('#000', .5); k.lineWidth = 2; [[20, 10, 90, 90], [48, 10, 118, 90]].forEach(([a, b, d, e]) => { k.beginPath(); k.moveTo(a + 4, b); k.lineTo(d + 4, e); k.stroke(); }); }); },
    escamas(c, ouro, cor) { c.fillStyle = rgba(cor, .5); c.strokeStyle = ouro; c.lineWidth = 2; for (let r = 0; r < 2; r++) perimetro(34, (x, y, nx, ny, i) => { const a = Math.atan2(ny, nx); c.save(); c.translate(x + nx * (10 + r * 14), y + ny * (10 + r * 14) + (i % 2 ? 0 : 0)); c.rotate(a - Math.PI / 2); c.beginPath(); c.arc(0, 0, 17, 0, Math.PI); c.fill(); c.stroke(); c.restore(); });
      retFrame(c, ouro, 0, 3.5); cantos(c, k => { k.fillStyle = ouro; k.beginPath(); k.moveTo(0, 0); k.lineTo(100, 0); k.lineTo(70, 22); k.lineTo(90, 40); k.lineTo(44, 44); k.lineTo(40, 90); k.lineTo(22, 70); k.lineTo(0, 100); k.closePath(); k.fill(); }); },
    // @ts-expect-error lista com texto e número juntos: o verificador não separa os tipos
    chamas(c, ouro, cor) { retFrame(c, rgba(ouro, .7), 14, 1.6); const R = rnd(31); for (const [col, sc] of [['#ff5a1a', 1], ['#ffa030', .7], ['#ffe27a', .4]]) { c.fillStyle = rgba(col, .85); perimetro(34, (x, y, nx, ny, i) => { const h = (30 + (i * 17 % 20)) * sc; c.save(); c.translate(x, y); c.rotate(Math.atan2(ny, nx) - Math.PI / 2); c.beginPath(); c.moveTo(-14 * sc, 0); c.quadraticCurveTo(-8 * sc, h * .5, (R() - .5) * 6, h); c.quadraticCurveTo(8 * sc, h * .5, 14 * sc, 0); c.closePath(); c.fill(); c.restore(); }); }
      retFrame(c, ouro, 0, 3); },
    espinhos(c, ouro, cor) { retFrame(c, ouro, 0, 3); retFrame(c, rgba(ouro, .45), 12, 1.4); c.fillStyle = rgba('#1a0508', .9); c.strokeStyle = ouro; c.lineWidth = 2; perimetro(40, (x, y, nx, ny, i) => { const a = Math.atan2(ny, nx) - Math.PI / 2, h = i % 2 ? 44 : 28; c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(-14, 0); c.lineTo(0, h); c.lineTo(14, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); });
      cantos(c, k => { k.fillStyle = ouro; k.beginPath(); k.moveTo(10, 10); k.quadraticCurveTo(10, -50, 70, -70); k.quadraticCurveTo(40, -30, 50, 10); k.fill(); k.beginPath(); k.moveTo(10, 10); k.quadraticCurveTo(-50, 10, -70, 70); k.quadraticCurveTo(-30, 40, 10, 50); k.fill(); }); },
    ondas(c, ouro, cor) { for (let l = 0; l < 3; l++) { c.strokeStyle = rgba(l ? ouro : '#7ad0ff', .5 + l * .2); c.lineWidth = 3 - l * .6; const m = 10 + l * 12, amp = 7 - l, per = 40 - l * 4; c.beginPath(); for (let x = X0; x <= X1; x += 4) c.lineTo(x, Y0 + m + Math.sin(x / per * TAU) * amp); c.stroke(); c.beginPath(); for (let x = X0; x <= X1; x += 4) c.lineTo(x, Y1 - m - Math.sin(x / per * TAU) * amp); c.stroke(); c.beginPath(); for (let y = Y0; y <= Y1; y += 4) c.lineTo(X0 + m + Math.sin(y / per * TAU) * amp, y); c.stroke(); c.beginPath(); for (let y = Y0; y <= Y1; y += 4) c.lineTo(X1 - m - Math.sin(y / per * TAU) * amp, y); c.stroke(); }
      cantos(c, k => { k.fillStyle = rgba('#7ad0ff', .7); k.strokeStyle = ouro; k.lineWidth = 2; k.beginPath(); k.moveTo(0, 0); k.quadraticCurveTo(70, 0, 80, 60); k.quadraticCurveTo(40, 30, 0, 80); k.closePath(); k.fill(); k.stroke(); }); },
    bolhas(c, ouro, cor) { retFrame(c, rgba(ouro, .7), 10, 2); const R = rnd(41); c.fillStyle = rgba('#4fd8b4', .3); c.strokeStyle = rgba('#4fd8b4', .8); c.lineWidth = 1.6; perimetro(22, (x, y, nx, ny, i) => { const r = 3 + R() * 10, d = 8 + R() * 30; c.beginPath(); c.arc(x + nx * d, y + ny * d, r, 0, TAU); c.fill(); c.stroke(); });
      c.strokeStyle = rgba(ouro, .8); c.lineWidth = 1.6; perimetro(30, (x, y, nx, ny, i) => { c.beginPath(); c.arc(x, y, 14, 0, Math.PI); c.save(); c.translate(x, y); c.rotate(Math.atan2(ny, nx) - Math.PI / 2); c.beginPath(); c.arc(0, 8, 13, 0, Math.PI); c.stroke(); c.restore(); }); retFrame(c, ouro, 0, 3); },
    espectro(c, ouro, cor) { const R = rnd(53); c.lineCap = 'round'; for (let l = 0; l < 3; l++) { c.strokeStyle = rgba('#d5ddff', .22 + l * .12); c.lineWidth = 6 - l * 2; perimetro(44, (x, y, nx, ny, i) => { c.beginPath(); c.moveTo(x, y); let px = x, py = y; for (let t = 1; t < 7; t++) { px += nx * 8 + (-ny) * Math.sin(t + i + l) * 9; py += ny * 8 + nx * Math.sin(t + i + l) * 9; c.lineTo(px, py); } c.stroke(); }); }
      retFrame(c, rgba('#d5ddff', .75), 0, 2); retFrame(c, rgba(ouro, .4), 8, 1); },
    correntes(c, ouro, cor) { const elo = (x, y, a, alt) => { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = '#aab8d8'; c.lineWidth = 4; c.beginPath(); alt ? c.ellipse(0, 0, 10, 5, 0, 0, TAU) : c.ellipse(0, 0, 5, 9, 0, 0, TAU); c.stroke(); c.strokeStyle = '#3a4258'; c.lineWidth = 1.5; c.stroke(); c.restore(); };
      let i = 0; for (let x = X0 + 6; x < X1; x += 20) { elo(x, Y0 + 8, 0, i % 2); elo(x, Y1 - 8, 0, i++ % 2); } i = 0; for (let y = Y0 + 6; y < Y1; y += 20) { elo(X0 + 8, y, 0, i % 2); elo(X1 - 8, y, 0, i++ % 2); }
      retFrame(c, rgba(ouro, .7), 24, 1.6); cantos(c, k => { k.strokeStyle = '#aab8d8'; k.lineWidth = 6; k.beginPath(); k.arc(40, 40, 24, 0, TAU); k.stroke(); k.fillStyle = '#7a8298'; k.beginPath(); k.arc(40, 40, 9, 0, TAU); k.fill(); }); },
  };

  // ---------- peças da ficha ----------
  function secao(c, t, x, y, larg, cor) { texto(c, t, x, y, { tam: 17, cor, esp: 5, peso: 'normal' }); c.strokeStyle = rgba(cor, .5); c.lineWidth = 1.4; c.beginPath(); const w = (function () { c.save(); c.font = `17px ${FONTE}`; if ('letterSpacing' in c) c.letterSpacing = '5px'; const m = c.measureText(t).width; c.restore(); return m; })(); c.moveTo(x + w + 12, y - 6); c.lineTo(x + larg, y - 6); c.stroke(); }
  function radar(c, cx, cy, R, cor, ouro) {
    const ang = i => (-90 + i * 60) * Math.PI / 180, pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
    [.25, .5, .75, 1].forEach(f => { c.strokeStyle = rgba('#ffffff', .15); c.lineWidth = 1.2; c.beginPath(); ATTRS.forEach((_, i) => { const [x, y] = pt(i, R * f); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.stroke(); });
    ATTRS.forEach((_, i) => { const [x, y] = pt(i, R); c.strokeStyle = rgba('#ffffff', .12); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke(); });
    const ps = ATTRS.map((a, i) => pt(i, R * Math.min(1, total(a.key) / 24)));
    c.fillStyle = rgba(cor, .3); c.strokeStyle = cor; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath(); ps.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); c.stroke(); ps.forEach(([x, y]) => { c.fillStyle = cor; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); });
    ATTRS.forEach((a, i) => { const [x, y] = pt(i, R + 36); texto(c, a.nome.slice(0, 3).toUpperCase(), x, y - 4, { tam: 15, cor: a.cor, al: 'center', esp: 2 }); texto(c, String(total(a.key)), x, y + 20, { tam: 26, cor: '#fff3d4', al: 'center' }); });
  }
  function barra(c, x, y, larg, v, mx, cor, nome) {
    texto(c, nome, x, y - 8, { tam: 17, cor: '#c8c2e0', esp: 2 }); texto(c, `${v} / ${mx}`, x + larg, y - 8, { tam: 20, cor: '#fff3d4', al: 'right' });
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.roundRect(x, y, larg, 16, 8); c.fill(); const w = mx ? Math.max(0, Math.min(1, v / mx)) * larg : 0;
    if (w > 0) { const g = c.createLinearGradient(x, 0, x + larg, 0); g.addColorStop(0, mix(cor, '#000000', .5)); g.addColorStop(1, cor); c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, 16, 8); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2; for (let i = 1; i < 10; i++) { c.beginPath(); c.moveTo(x + larg * i / 10, y); c.lineTo(x + larg * i / 10, y + 16); c.stroke(); } c.strokeStyle = rgba(cor, .6); c.lineWidth = 1.4; c.beginPath(); c.roundRect(x, y, larg, 16, 8); c.stroke(); }
  function painel(c, x, y, w, h, cor) { c.fillStyle = 'rgba(8,6,24,.62)'; c.beginPath(); c.roundRect(x, y, w, h, 14); c.fill(); c.strokeStyle = rgba(cor, .6); c.lineWidth = 2; c.stroke(); }
  function divisor(c, y, cor) { const g = c.createLinearGradient(110, 0, 890, 0); g.addColorStop(0, rgba(cor, 0)); g.addColorStop(.5, rgba(cor, .9)); g.addColorStop(1, rgba(cor, 0)); c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(110, y); c.lineTo(890, y); c.stroke(); c.fillStyle = cor; c.beginPath(); c.moveTo(500, y - 8); c.lineTo(508, y); c.lineTo(500, y + 8); c.lineTo(492, y); c.fill(); }

  // ---------- montagem ----------
  async function desenhar(opt = {}) {
    const terror = !!opt.terror, cam = caminhoPorId(P.caminho), raca = racaPorId(P.raca), orig = origemPorId(P.origem), pat = patamarDe(P.sequencia), k = idxPatamar(P.sequencia);
    if (typeof SIGILOS_DATA === 'undefined') await new Promise(r => { const s = document.createElement('script'); s.src = 'js/sigilos-data.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
    const cor = terror ? '#e0283a' : cam.cor, ouro = terror ? '#c9a070' : '#d9b86a', brilhoT = terror ? '#ffd0c0' : '#fff3d4';
    const [sig, ret, mr, mo] = await Promise.all([carregar(typeof SIGILOS_DATA !== 'undefined' ? SIGILOS_DATA[cam.id] : `img/sigilos/${cam.id}.webp`), P.retrato ? carregar(P.retrato) : null, svgImg(medalhao(raca, 120, true)), svgImg(medalhao(orig, 120, true))]);
    const cv = document.createElement('canvas'); cv.width = Math.round(W * ESC); cv.height = Math.round(H * ESC); const c = cv.getContext('2d'); c.scale(ESC, ESC);
    // fundo
    const estilo = ESTILO[cam.id] || 'misterios'; FUNDOS[estilo](c, cor, terror);
    if (terror) { vinheta(c, .85); const g = c.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 850); g.addColorStop(0, 'rgba(120,0,10,0)'); g.addColorStop(1, 'rgba(150,0,16,.45)'); c.fillStyle = g; c.fillRect(0, 0, W, H); } else vinheta(c, .35);
    // marca d'água do sigilo
    if (sig) { c.save(); c.globalAlpha = .08; c.drawImage(sig, 150, 380, 700, 700); c.restore(); }
    MOLD[MOLDURA[P.raca] || 'humano'](c, ouro, cor);
    // topo
    texto(c, `CAMINHO ${cam.nome.toUpperCase()}`, W / 2, 100, { tam: 22, cor, al: 'center', esp: 9, sombra: cor, blur: 12 });
    c.strokeStyle = rgba(cor, .6); c.lineWidth = 1.5; c.beginPath(); c.moveTo(250, 92); c.lineTo(420, 92); c.moveTo(580, 92); c.lineTo(750, 92); c.stroke();
    // retrato + aura
    const px = W / 2, py = 286, pr = 112; brilho(c, px, py, 230, cor, .4);
    const aneis = Math.min(3, [0, 1, 2, 3, 3, 4, 5][k] ?? 0);
    for (let i = 0; i < aneis; i++) { c.strokeStyle = rgba(pat.cor, .75 - i * .1); c.lineWidth = i ? 2 : 3.5; c.beginPath(); c.arc(px, py, pr + 14 + i * 12, 0, TAU); c.stroke(); }
    if (k >= 3) { c.save(); c.translate(px, py); for (let i = 0; i < 48; i++) { c.rotate(TAU / 48); c.fillStyle = rgba(pat.cor, k >= 4 ? .9 : .7); c.fillRect(pr + 18 + aneis * 12, -1.6, k >= 4 ? 18 : 12, 3.2); } c.restore(); }
    c.save(); c.beginPath(); c.arc(px, py, pr, 0, TAU); c.clip(); const g0 = c.createRadialGradient(px - 30, py - 40, 10, px, py, pr); g0.addColorStop(0, '#3a2f7a'); g0.addColorStop(1, '#0d0b22'); c.fillStyle = g0; c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    if (ret) { if (opt.filtro !== false) { const f = { gravura: 'grayscale(1) sepia(.55) contrast(1.25) brightness(.95)', espectral: 'grayscale(1) sepia(1) hue-rotate(170deg) saturate(2.2) contrast(1.1)', sangue: 'grayscale(1) sepia(1) hue-rotate(-35deg) saturate(5) contrast(1.15) brightness(.9)', caminho: 'grayscale(1) contrast(1.15)' }[P.retratoEstilo]; if (f) c.filter = f; } c.drawImage(ret, px - pr, py - pr, pr * 2, pr * 2); c.filter = 'none'; if (P.retratoEstilo === 'caminho') { c.globalCompositeOperation = 'color'; c.fillStyle = cam.cor; c.fillRect(px - pr, py - pr, pr * 2, pr * 2); c.globalCompositeOperation = 'source-over'; } }
    else if (sig) { c.drawImage(sig, px - 88, py - 88, 176, 176); } c.restore();
    c.strokeStyle = cor; c.lineWidth = 6; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.stroke(); c.strokeStyle = '#0b0920'; c.lineWidth = 3; c.beginPath(); c.arc(px, py, pr + 5, 0, TAU); c.stroke();
    if (ret && sig) { const bx = px + pr * .74, by = py + pr * .74; c.fillStyle = '#0d0b22'; c.beginPath(); c.arc(bx, by, 36, 0, TAU); c.fill(); c.strokeStyle = cor; c.lineWidth = 4; c.stroke(); c.drawImage(sig, bx - 27, by - 27, 54, 54); }
    // nome
    texto(c, P.nome || 'Sem nome', W / 2, 524, { tam: 72, cor: brilhoT, al: 'center', max: 780, sombra: rgba(cor, .8), blur: 24 });
    texto(c, `SEQUÊNCIA ${P.sequencia}  ·  ${nomeSeq(P.sequencia).toUpperCase()}`, W / 2, 562, { tam: 22, cor: pat.cor, al: 'center', esp: 5 });
    // medalhões raça/origem
    c.drawImage(mr, 150, 588, 64, 64); texto(c, raca.nome, 226, 616, { tam: 24, cor: brilhoT, max: 250 }); texto(c, raca.grupo.toUpperCase(), 226, 642, { tam: 14, cor: '#a8a2c8', esp: 3 });
    c.drawImage(mo, 538, 588, 64, 64); texto(c, orig.nome, 614, 616, { tam: 24, cor: brilhoT, max: 250 }); texto(c, `ORIGEM · £ ${orig.libras}`, 614, 642, { tam: 14, cor: '#a8a2c8', esp: 3 });
    divisor(c, 682, ouro);
    // atributos + vitais
    secao(c, 'ATRIBUTOS', 80, 722, 400, cor); radar(c, 280, 890, 100, cor, ouro);
    secao(c, 'VITAIS', 530, 722, 390, cor); const pv = P.pv ?? pvMax(), sn = P.san ?? sanMax();
    barra(c, 530, 760, 390, pv, pvMax(), '#e05a6a', 'PONTOS DE VIDA'); barra(c, 530, 812, 390, sn, sanMax(), '#6fb4ff', 'SANIDADE'); barra(c, 530, 864, 390, espMax(), espMax(), '#b08cff', 'ESPIRITUALIDADE');
    secao(c, 'ESCADA DE PODER', 530, 926, 390, cor);
    for (let s = 9, i = 0; s >= 0; s--, i++) { const x = 530 + i * 39, pt = patamarDe(s), at = s === P.sequencia, pas = s > P.sequencia; c.fillStyle = at ? rgba(pt.cor, .85) : pas ? rgba(pt.cor, .35) : 'rgba(0,0,0,.45)'; c.beginPath(); c.roundRect(x, 946, 35, 48, 7); c.fill(); c.strokeStyle = at ? '#fff' : rgba(pt.cor, .7); c.lineWidth = at ? 3 : 1.4; c.stroke(); texto(c, String(s), x + 17.5, 978, { tam: 24, cor: at ? '#0b0920' : '#e8e4f5', al: 'center' }); }
    texto(c, pat.nome.toUpperCase(), 530, 1016, { tam: 17, cor: pat.cor, esp: 4 });
    texto(c, 'DIGESTÃO', 530, 1044, { tam: 13, cor: '#a8a2c8', esp: 3 }); for (let i = 0; i < DIG_MAX; i++) { const x = 650 + i * 28; c.beginPath(); c.arc(x, 1038, 10, 0, TAU); if (i < (P.digestao || 0)) { const g = c.createRadialGradient(x - 3, 1035, 1, x, 1038, 10); g.addColorStop(0, '#fff'); g.addColorStop(.5, cor); g.addColorStop(1, mix(cor, '#000000', .5)); c.fillStyle = g; c.fill(); } else { c.fillStyle = 'rgba(0,0,0,.45)'; c.fill(); } c.strokeStyle = rgba(cor, .8); c.lineWidth = 1.6; c.stroke(); }
    divisor(c, 1068, ouro);
    // destino
    secao(c, 'DESTINO', 80, 1096, 840, cor);
    const tr = TRACOS[P.traco], ar = ARTEFATOS[P.artefato], T0 = 1108;
    painel(c, 80, T0, 410, 148, cor); texto(c, `TRAÇO · d12 → ${P.traco + 1}`, 100, T0 + 28, { tam: 13, cor: '#a8a2c8', esp: 3 }); texto(c, tr.t, 100, T0 + 62, { tam: 28, cor: brilhoT, max: 370 }); paragrafo(c, tr.d, 100, T0 + 92, 370, 17, 23, '#d8d2ee', 2);
    painel(c, 510, T0, 410, 148, cor); texto(c, `ARTEFATO SELADO · d10 → ${P.artefato + 1}`, 530, T0 + 28, { tam: 13, cor: '#a8a2c8', esp: 3 }); texto(c, ar.n, 530, T0 + 62, { tam: 28, cor: brilhoT, max: 370 });
    let l1 = paragrafo(c, ar.dadiva, 530, T0 + 90, 370, 16, 20, '#a8f0a8', 2); paragrafo(c, ar.maldicao, 530, T0 + 90 + l1 * 20 + 8, 370, 16, 20, '#ff9a9a', 2);
    // habilidades, equipamento e história
    const habs = [...cam.hab, ...(P.habilidades || []).map(h => h.nome)].join('  ·  ');
    texto(c, 'HABILIDADES', 122, 1286, { tam: 13, cor, esp: 3 }); texto(c, umaLinha(c, habs, 616, 17), 262, 1286, { tam: 17, cor: '#e8e4f5' });
    texto(c, 'EQUIPAMENTO', 122, 1310, { tam: 13, cor, esp: 3 }); texto(c, umaLinha(c, orig.itens.join('  ·  '), 616, 17), 262, 1310, { tam: 17, cor: '#e8e4f5' });
    const hist = (P.historia || P.aparencia || '').trim(); if (hist) { texto(c, P.historia ? 'HISTÓRIA' : 'APARÊNCIA', 122, 1334, { tam: 13, cor, esp: 3 }); paragrafo(c, hist, 262, 1334, 616, 16, 22, '#c8c2e0', 1); }
    // rodapé
    // numa pequena placa escura: legível mesmo sobre molduras profundas (escamas, espinhos, pedra)
    const rod = `REGISTRO Nº ${numeroRegistro(P.nome || 'x')}  ·  ${raca.traco.split(':')[0].toUpperCase()}`;
    c.save(); c.font = `normal 12px ${FONTE}`; if ('letterSpacing' in c) c.letterSpacing = '4px'; const lw = c.measureText(rod).width + 40; c.restore();
    c.fillStyle = 'rgba(8,6,24,.92)'; c.beginPath(); c.roundRect(W / 2 - lw / 2, 1341, lw, 22, 11); c.fill(); c.strokeStyle = rgba(ouro, .7); c.lineWidth = 1.4; c.stroke();
    texto(c, rod, W / 2 + 2, 1357, { tam: 12, cor: rgba(ouro, .95), al: 'center', esp: 4 });
    return cv;
  }

  // ---------- PDF mínimo (uma página A4 com uma imagem JPEG) ----------
  function montarPDF(jpegBytes, pxW, pxH) {
    const enc = new TextEncoder(), partes = [], offs = []; let pos = 0;
    const add = d => { const b = typeof d === 'string' ? enc.encode(d) : d; partes.push(b); pos += b.length; };
    const obj = (n, corpo, stream) => { offs[n] = pos; add(`${n} 0 obj\n${corpo}\n`); if (stream) { add('stream\n'); add(stream); add('\nendstream\n'); } add('endobj\n'); };
    const PW = 595.28, PH = 841.89, conteudo = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
    obj(4, `<< /Length ${conteudo.length} >>`, enc.encode(conteudo));
    obj(5, `<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>`, jpegBytes);
    obj(6, `<< /Title (Poster do Beyonder) /Producer (Lord of the Mysteries RPG) >>`);
    const xref = pos; add(`xref\n0 7\n0000000000 65535 f \n`); for (let i = 1; i <= 6; i++) add(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(pos); let o = 0; partes.forEach(b => { out.set(b, o); o += b.length; }); return out;
  }
  const b64ParaBytes = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  async function gerarArquivos(cv) {
    const jpg = cv.toDataURL('image/jpeg', 0.92), png = cv.toDataURL('image/png');
    return { jpg, png, pdf: montarPDF(b64ParaBytes(jpg.split(',')[1]), cv.width, cv.height) };
  }
  function baixar(nome, dados, tipo) { try { const u = typeof dados === 'string' ? dados : URL.createObjectURL(new Blob([dados], { type: tipo })); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); if (typeof dados !== 'string') setTimeout(() => URL.revokeObjectURL(u), 4000); return true; } catch (e) { return false; } }
  return { desenhar, gerarArquivos, baixar, montarPDF, ESTILO, MOLDURA, FUNDOS, MOLD };
})());
