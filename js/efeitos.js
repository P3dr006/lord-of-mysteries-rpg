// 22 efeitos de tela (+ 22 versões de terror), com coreografia em camadas.
// Cada efeito é função determinística do progresso p (0→1):
//   fábrica(w,h,T) -> { dur, draw(c,p), page?(p) }
// page(p) deforma a própria página (tremor, filtro, zoom); no clímax o sigilo
// oficial do Caminho surge com o nome.
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const env = (p, a = 0.15, b = 0.7) => p < a ? p / a : p > b ? Math.max(0, (1 - p) / (1 - b)) : 1;
const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${clamp(a)})`;
const RED = '215,20,35';

function glow(c, x, y, r, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${clamp(a)})`); g.addColorStop(1, `rgba(${col},0)`);
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
}
function vinheta(c, w, h, a, col = '0,0,8') {
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .75);
  g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${clamp(a)})`); c.fillStyle = g; c.fillRect(0, 0, w, h);
}
// engrenagem com dentes
function engrenagem(c, r, n, fill, stroke) {
  c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 2.5; c.beginPath();
  for (let i = 0; i < n; i++) { const a = i / n * TAU, s = TAU / n;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + s * .12) * (r + r * .16), Math.sin(a + s * .12) * (r + r * .16));
    c.lineTo(Math.cos(a + s * .38) * (r + r * .16), Math.sin(a + s * .38) * (r + r * .16)); c.lineTo(Math.cos(a + s * .5) * r, Math.sin(a + s * .5) * r); }
  c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#0a0814'; c.beginPath(); c.arc(0, 0, r * .28, 0, TAU); c.fill(); c.stroke();
  c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.beginPath(); c.moveTo(r * .3, 0); c.lineTo(r * .8, 0); c.stroke(); }
}
function cartaFace(c, T) {
  c.fillStyle = T ? '#14040a' : '#241c52'; c.strokeStyle = T ? '#c0182b' : '#e3c277'; c.lineWidth = 2;
  c.beginPath(); c.roundRect(-24, -38, 48, 76, 6); c.fill(); c.stroke(); c.fillStyle = c.strokeStyle;
  if (T) { c.beginPath(); c.ellipse(0, 0, 14, 7, 0, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 3.5, 0, TAU); c.fill(); }
  else { c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 16, a = i * Math.PI / 4 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); }
}
function cartaCosta(c, T) {
  c.fillStyle = T ? '#0a0206' : '#18123a'; c.strokeStyle = T ? '#7a0c18' : '#9a85e8'; c.lineWidth = 2;
  c.beginPath(); c.roundRect(-24, -38, 48, 76, 6); c.fill(); c.stroke(); c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-20, i * 10); c.lineTo(20, i * 10 + 22); c.moveTo(-20, i * 10 + 22); c.lineTo(20, i * 10); c.stroke(); }
}
// vinha com folhas: usado por Mãe
function mao(c, x, y, s, a, T) { // mão esquelética subindo (terror)
  c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = T ? '#cdd6c8' : '#fff'; c.lineWidth = 3 * s; c.lineCap = 'round';
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 7 * s, 0); c.lineTo(i * 9 * s, -34 * s - Math.abs(i) * -3 * s); c.stroke(); }
  c.beginPath(); c.moveTo(-16 * s, 6 * s); c.lineTo(16 * s, 6 * s); c.lineTo(10 * s, 40 * s); c.lineTo(-10 * s, 40 * s); c.closePath(); c.stroke(); c.restore();
}

const FX = {
  // 1 Louco — tempestade de cartas em espiral
  louco: (w, h, T) => { const R = rng(1), cs = Array.from({ length: 40 }, () => ({ a: R() * TAU, d: R() * .36, sp: 2 + R() * 2.5, z: .75 + R() * .7, r: R() * TAU, dir: R() > .5 ? 1 : -1 }));
    return { dur: 4000, page: p => T ? { filter: `brightness(${1 - env(p, .1, .7) * .35})` } : {},
      draw(c, p) { const cx = w / 2, cy = h / 2, R0 = Math.hypot(w, h) * .55;
        if (!T) glow(c, cx, cy, Math.min(w, h) * .6, '255,215,120', env(p, .2, .8) * .25);
        cs.forEach(k => { const q = (p - k.d) / .5; if (q < 0 || q > 1) return;
          for (let t = 4; t >= 0; t--) { const qq = q - t * .014; if (qq < 0) continue; const rad = Math.pow(1 - qq, 1.7) * R0, ang = k.a + qq * k.sp * k.dir;
            c.save(); c.translate(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * .62); c.rotate(k.r + qq * 6);
            const sx = Math.cos(qq * 10 + k.a); c.scale(sx * k.z, k.z); c.globalAlpha = (t ? .13 : 1) * clamp(q * 5) * (1 - clamp((qq - .82) * 5));
            sx > 0 ? cartaFace(c, T) : cartaCosta(c, T); c.restore(); } });
        for (let i = 0; i < 70; i++) { const a = i * 2.4, rr = clamp((p - .5) * 1.1) * w * (.12 + ((i * 37) % 10) / 14), al = 1 - clamp((p - .5) / .5); if (al <= 0 || p < .5) continue;
          glow(c, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .7, 7, T ? RED : '255,220,120', al); } } }; },

  // 2 Erro — a própria página glitcha
  erro: (w, h, T) => ({ dur: 2600,
    page: p => { const e = env(p, .08, .8), R = rng(Math.floor(p * 32) + 3), j = R() > .45; return { tx: j ? (R() - .5) * 36 * e : 0, skew: j ? (R() - .5) * 9 * e : 0,
      filter: `drop-shadow(${(R() * 9 - 4.5) * e}px 0 ${T ? '#f00' : '#0ff'}) drop-shadow(${(R() * -9 + 4.5) * e}px 0 ${T ? '#500' : '#f0f'})${j && T && R() > .7 ? ' invert(1)' : ''}${j ? ` hue-rotate(${Math.floor(R() * 90)}deg)` : ''}` }; },
    draw(c, p) { const R = rng(Math.floor(p * 28) + 7), e = env(p, .1, .78);
      for (let i = 0; i < 24 * e; i++) { const y = R() * h, hh = 3 + R() * 60, ww = w * (.2 + R() * .8);
        c.fillStyle = T ? (R() > .5 ? rgba(220, 20, 30, .5) : rgba(0, 0, 0, .85)) : (R() > .5 ? rgba(0, 255, 230, .33) : rgba(255, 0, 140, .33)); c.fillRect(R() * w * .3, y, ww, hh); }
      c.font = '14px monospace'; for (let i = 0; i < 40 * e; i++) { c.fillStyle = T ? rgba(255, 60, 60, R() * .8) : rgba(110, 255, 230, R() * .8); c.fillText(R() > .5 ? '1' : '0', R() * w, R() * h); }
      for (let i = 0; i < 120 * e; i++) { c.fillStyle = rgba(255, T ? 40 : 255, T ? 40 : 255, R() * .5); c.fillRect(R() * w, R() * h, 2 + R() * 16, 2); }
      c.fillStyle = rgba(0, 0, 0, .22 * e); for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
      if (R() > .4) { c.font = `bold ${70 + R() * 80}px monospace`; c.fillStyle = T ? '#e0202a' : '#6ff'; c.fillText(T ? 'ERR0R' : 'ERRO', R() * w * .6, h * (.25 + R() * .55)); c.fillStyle = T ? '#000' : '#f0f'; c.fillText(T ? 'ERR0R' : 'ERRO', R() * w * .6 + 6, h * (.25 + R() * .55) + 4); } } }),

  // 3 Porta — batidas, porta abre, luz inunda o chão
  porta: (w, h, T) => { const R = rng(3), mt = Array.from({ length: 40 }, () => ({ x: R() - .5, y: R(), v: .2 + R() * .5 }));
    return { dur: 4200, page: p => { const k = [.06, .13, .2].some(t => Math.abs(p - t) < .02); return k ? { tx: (Math.random() - .5) * (T ? 14 : 8), ty: 0 } : {}; },
      draw(c, p) { const cx = w / 2, dw = Math.min(w * .2, 160), dh = dw * 2.15, cy = h * .52, top = cy - dh / 2, bot = cy + dh / 2, o = ease((p - .3) / .5), e = env(p, .08, .85), col = T ? RED : '255,235,170';
        c.fillStyle = rgba(0, 0, 8, .55 * e); c.fillRect(0, 0, w, h);
        if (p > .3) { const g = c.createLinearGradient(0, bot, 0, h); g.addColorStop(0, rgba(...col.split(',').map(Number), .85 * o * e)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(cx - dw * .8, bot); c.lineTo(cx + dw * .8, bot); c.lineTo(cx + dw * (.8 + 3.5 * o), h); c.lineTo(cx - dw * (.8 + 3.5 * o), h); c.fill(); }
        c.save(); c.globalAlpha = e; c.fillStyle = T ? '#000' : '#fff6d6'; c.beginPath(); c.moveTo(cx - dw, bot); c.lineTo(cx - dw, top + dw); c.arc(cx, top + dw, dw, Math.PI, 0); c.lineTo(cx + dw, bot); c.fill();
        if (T) { glow(c, cx, cy, dw * 1.2, RED, .5 * o); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy - dh * .08, 26 * o, 11 * o, 0, 0, TAU); c.fill(); c.fillStyle = '#b00010'; c.beginPath(); c.arc(cx, cy - dh * .08, 8 * o, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.ellipse(cx, cy - dh * .08, 2 * o, 7 * o, 0, 0, TAU); c.fill(); }
        else glow(c, cx, cy, dh * (.5 + o), '255,240,190', .9 * o);
        const pw = dw * (1 - o * .9), sh = o * 24; c.fillStyle = T ? '#0d0307' : '#3a2f6e'; c.strokeStyle = T ? '#5a0a14' : '#8d7bd8'; c.lineWidth = 2;
        [[-1, cx - dw], [1, cx + dw]].forEach(([s, hx]) => { c.beginPath(); c.moveTo(hx, top + dw * .2); c.lineTo(hx - s * pw, top + dw * .2 + sh); c.lineTo(hx - s * pw, bot - sh); c.lineTo(hx, bot); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.arc(hx - s * pw * .8, cy, 4, 0, TAU); c.fillStyle = T ? '#7a1a20' : '#e3c277'; c.fill(); c.fillStyle = T ? '#0d0307' : '#3a2f6e'; });
        c.strokeStyle = T ? '#2a0a10' : '#6a5ab0'; c.lineWidth = 8; c.beginPath(); c.moveTo(cx - dw - 4, bot); c.lineTo(cx - dw - 4, top + dw); c.arc(cx, top + dw, dw + 4, Math.PI, 0); c.lineTo(cx + dw + 4, bot); c.stroke();
        if (T && o > .1) { c.strokeStyle = '#d8d8d0'; c.lineWidth = 4; c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = cx - dw + pw + 4 - i * 6, y0 = cy + 30 + i * 12; c.beginPath(); c.moveTo(x, y0); c.lineTo(x - 18 * o, y0 - 26 * o); c.stroke(); } }
        c.restore(); mt.forEach(m => { const q = (p * m.v + m.y) % 1, x = cx + m.x * dw * (1 + 3 * q) * 2, y = bot + q * (h - bot); if (o > .1) glow(c, x, y, 3 + q * 4, col, .5 * o * e); }); } }; },

  // 4 Visionário — olho que se abre, símbolos mentais, ondas psíquicas
  visionario: (w, h, T) => { const R = rng(4), ex = Array.from({ length: 14 }, () => ({ x: R() * w, y: R() * h, d: .15 + R() * .5, s: 18 + R() * 30 }));
    return { dur: 3800, draw(c, p) { const cx = w / 2, cy = h / 2, e = env(p, .15, .8); c.globalAlpha = 1;
      for (let i = 0; i < 7; i++) { const q = (p * 1.3 + i / 7) % 1; c.strokeStyle = T ? rgba(220, 20, 40, (1 - q) * .55 * e) : rgba(190, 140, 255, (1 - q) * .55 * e); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, q * Math.max(w, h) * .65, 0, TAU); c.stroke(); }
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + p * 1.5, q = (p * 1.1 + i * .13) % 1, rr = Math.min(w, h) * (.2 + q * .35); c.strokeStyle = T ? rgba(255, 90, 90, (1 - q) * .55 * e) : rgba(230, 200, 255, (1 - q) * .55 * e); c.lineWidth = 1.5; c.beginPath(); for (let t = 0; t < 8; t++) { const aa = t * .6, r2 = t * 2.2; c.lineTo(cx + Math.cos(a) * rr + Math.cos(aa) * r2, cy + Math.sin(a) * rr + Math.sin(aa) * r2); } c.stroke(); }
      const S = Math.min(w, h) * .24, open = ease(p / .3) * (p > .82 ? clamp((1 - p) / .18) : 1) * (1 - (Math.sin(p * 40) > .96 ? .8 : 0));
      glow(c, cx, cy, S * 1.6, T ? RED : '170,120,255', .5 * e);
      c.fillStyle = T ? '#fbe6e6' : '#f4eaff'; c.beginPath(); c.moveTo(cx - S, cy); c.quadraticCurveTo(cx, cy - S * .9 * open, cx + S, cy); c.quadraticCurveTo(cx, cy + S * .9 * open, cx - S, cy); c.fill();
      c.save(); c.beginPath(); c.moveTo(cx - S, cy); c.quadraticCurveTo(cx, cy - S * .9 * open, cx + S, cy); c.quadraticCurveTo(cx, cy + S * .9 * open, cx - S, cy); c.clip();
      const ix = cx + Math.sin(p * 6) * S * .12; c.fillStyle = T ? '#7a0010' : '#6a40d8'; c.beginPath(); c.arc(ix, cy, S * .4, 0, TAU); c.fill(); c.strokeStyle = T ? '#ff6060' : '#c0a8ff'; c.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; c.beginPath(); c.moveTo(ix + Math.cos(a) * S * .14, cy + Math.sin(a) * S * .14); c.lineTo(ix + Math.cos(a) * S * .4, cy + Math.sin(a) * S * .4); c.stroke(); }
      c.fillStyle = '#000'; c.beginPath(); c.arc(ix, cy, S * (.12 + .05 * Math.sin(p * 9)), 0, TAU); c.fill(); c.restore();
      if (T) { c.strokeStyle = 'rgba(170,0,12,.8)'; c.lineWidth = 1.4; for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; c.beginPath(); c.moveTo(cx + Math.cos(a) * S * .98, cy + Math.sin(a) * S * .5 * open); c.quadraticCurveTo(cx + Math.cos(a) * S * .7, cy + Math.sin(a) * S * .4 * open, cx + Math.cos(a) * S * .44, cy + Math.sin(a) * S * .2 * open); c.stroke(); }
        ex.forEach(k => { const q = clamp((p - k.d) / .12) * (1 - clamp((p - .85) / .12)); if (q <= 0) return; c.save(); c.translate(k.x, k.y); c.fillStyle = '#fff2f2'; c.beginPath(); c.ellipse(0, 0, k.s, k.s * .5 * q, 0, 0, TAU); c.fill(); c.fillStyle = '#a00010'; c.beginPath(); c.arc(Math.sin(p * 7 + k.x) * k.s * .2, 0, k.s * .26 * q, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(Math.sin(p * 7 + k.x) * k.s * .2, 0, k.s * .1 * q, 0, TAU); c.fill(); c.restore(); }); } } }; },

  // 5 Sol — amanhecer: pilares de luz, raios, reflexos de lente
  sol: (w, h, T) => { const R = rng(5), mo = Array.from({ length: 90 }, () => ({ x: R(), y: R(), v: .1 + R() * .4, s: 1 + R() * 3 }));
    return { dur: 3600, page: p => ({ filter: T ? `brightness(${1 - env(p, .15, .7) * .45}) contrast(1.2)` : `brightness(${1 + env(p, .15, .7) * .3}) saturate(1.15)` }),
      draw(c, p) { const cx = w / 2, cy = h * .46, e = env(p, .2, .72), L = Math.max(w, h), g = ease(p / .35);
        if (!T) { if (p < .14) { c.fillStyle = rgba(255, 250, 220, 1 - p / .14); c.fillRect(0, 0, w, h); }
          glow(c, cx, cy, L * .75, '255,210,100', .6 * e);
          for (let i = 0; i < 6; i++) { const x = (i + .5) * w / 6 + Math.sin(p * 3 + i) * 30, gr = c.createLinearGradient(x, 0, x, h); gr.addColorStop(0, rgba(255, 230, 150, .35 * e * g)); gr.addColorStop(1, 'rgba(255,230,150,0)'); c.fillStyle = gr; c.fillRect(x - 30, 0, 60, h); } }
        c.save(); c.translate(cx, cy); c.rotate(p * (T ? -.8 : 1.1)); const n = 28;
        for (let i = 0; i < n; i++) { c.rotate(TAU / n); const len = L * (.55 + .45 * Math.abs(Math.sin(i * 1.7 + p * 5))) * g, wd = L * (T ? .008 : .03) * (1 + (i % 3));
          c.fillStyle = T ? rgba(215, 20, 35, .5 * e) : rgba(255, 215, 90, .42 * e); c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -wd); c.lineTo(len, wd); c.fill(); } c.restore();
        const r = Math.min(w, h) * .12 * g; c.fillStyle = T ? '#000' : '#fff7c8'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
        if (T) { c.strokeStyle = rgba(255, 90, 60, e); c.lineWidth = 5; c.shadowColor = '#f33'; c.shadowBlur = 25; c.stroke(); c.shadowBlur = 0;
          for (let i = 0; i < 7; i++) { const a = i * .9 + p * .5, pr = r * (1.1 + .5 * Math.sin(p * 8 + i)); c.strokeStyle = rgba(230, 40, 30, .6 * e); c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, pr, a, a + .5); c.stroke(); } }
        else for (let i = 1; i <= 5; i++) { const t = i / 5, x = lerp(cx, w - cx, t * 1.3 - .15), y = lerp(cy, h - cy, t * 1.3 - .15); glow(c, x, y, 18 + i * 12, i % 2 ? '255,170,80' : '120,200,255', .16 * e * g); }
        mo.forEach(m => { const y = T ? ((m.y + p * m.v * 1.5) % 1) * h : (m.y - p * m.v + 1) % 1 * h; if (T) { c.fillStyle = rgba(150, 150, 150, .5 * e); c.fillRect(m.x * w, y, m.s, m.s); } else glow(c, m.x * w, y, 4 + m.s, '255,225,140', .5 * e); }); } }; },

  // 6 Tirano — tempestade: nuvens, chuva, relâmpagos com brilho residual, ondas
  tirano: (w, h, T) => { const R = rng(6), ch = Array.from({ length: 160 }, () => ({ x: R(), y: R(), v: .9 + R() * .8 })), FL = [.08, .2, .34, .5, .66, .8];
    const bolt = (seed, x0) => { const r = rng(seed), pts = [[x0, 0]]; let x = x0, y = 0, br = []; while (y < h * .88) { y += 24 + r() * 44; x += (r() - .5) * 120; pts.push([x, y]); if (r() > .72) br.push([[x, y], [x + (r() - .5) * 260, y + 120 + r() * 100], [x + (r() - .5) * 320, y + 200 + r() * 120]]); } return { pts, br }; };
    const bolts = FL.map((_, i) => bolt(i * 11 + 4, w * (.15 + R() * .7)));
    return { dur: 3800, page: p => { const f = FL.findIndex(t => p >= t && p < t + .06); const a = f >= 0 ? 1 - (p - FL[f]) / .06 : 0; return a > 0 ? { tx: (Math.random() - .5) * 16 * a, ty: (Math.random() - .5) * 10 * a, filter: `brightness(${1 + a * (T ? .6 : 1.1)})` } : {}; },
      draw(c, p) { const e = env(p, .06, .88), col = T ? '255,40,50' : '170,210,255';
        const gr = c.createLinearGradient(0, 0, 0, h * .55); gr.addColorStop(0, T ? rgba(30, 0, 6, .85 * e) : rgba(8, 10, 30, .8 * e)); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h * .55);
        c.strokeStyle = T ? rgba(255, 120, 120, .35 * e) : rgba(180, 205, 255, .4 * e); c.lineWidth = 1.2; ch.forEach(d => { const x = (d.x * w + p * 700 * d.v) % (w + 100) - 50, y = (d.y * h + p * 1800 * d.v) % h; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 9, y + 22); c.stroke(); });
        c.fillStyle = T ? rgba(70, 0, 12, .8 * e) : rgba(14, 40, 90, .75 * e); for (let l = 0; l < 3; l++) { c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 14) c.lineTo(x, h - (30 + l * 22) * (1 + clamp(p * 2)) - Math.sin(x * .012 + p * 9 + l * 2) * (14 + l * 6)); c.lineTo(w, h); c.fill(); }
        FL.forEach((t, i) => { const a = 1 - (p - t) / .22; if (p < t || a <= 0) return; const b = bolts[i], fl = p < t + .05 ? 1 : a * .7;
          if (p < t + .05) { c.fillStyle = T ? rgba(120, 0, 10, .4 * fl) : rgba(200, 225, 255, .35 * fl); c.fillRect(0, 0, w, h); }
          c.save(); c.lineJoin = 'round'; c.shadowColor = `rgb(${col})`; c.shadowBlur = 28 * fl; c.strokeStyle = rgba(...col.split(',').map(Number), .9 * fl); c.lineWidth = 7 * fl; c.beginPath(); b.pts.forEach((q, j) => j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
          c.strokeStyle = rgba(255, 255, 255, fl); c.lineWidth = 2.5 * fl; c.stroke(); c.lineWidth = 2 * fl; c.strokeStyle = rgba(...col.split(',').map(Number), .8 * fl);
          b.br.forEach(br => { c.beginPath(); br.forEach((q, j) => j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }); c.restore();
          const lp = b.pts[b.pts.length - 1]; glow(c, lp[0], lp[1], 130 * fl, col, .7 * fl); }); } }; },

  // 7 Torre Branca — torre que se ergue, runas em órbita, páginas voando
  torre: (w, h, T) => { const R = rng(7), cols = Array.from({ length: Math.ceil(w / 28) }, (_, i) => ({ x: i * 28 + 8, v: .5 + R(), o: R() * .5, g: Array.from({ length: 30 }, () => 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ01'[Math.floor(R() * 25)]) })), pg = Array.from({ length: 16 }, () => ({ x: R() * w, d: R() * .4, v: .4 + R() * .6, r: R() * TAU }));
    return { dur: 4000, draw(c, p) { const cx = w / 2, bot = h * .92, TH = h * .72 * ease(p / .35), e = env(p, .12, .82);
      c.font = '17px monospace'; cols.forEach(k => { const hd = (p * k.v * 1.6 + k.o) % 1.4 * (h + 400) - 200; for (let j = 0; j < 12; j++) { const y = hd - j * 22; if (y < -20 || y > h) continue; c.fillStyle = T ? rgba(230, 30, 40, (1 - j / 12) * .45 * e) : rgba(j ? 190 : 255, j ? 220 : 255, 255, (1 - j / 12) * .45 * e); c.fillText(k.g[(j + Math.floor(p * 20)) % 30], k.x, y); } });
      c.save(); c.translate(cx, bot); if (T) c.rotate(Math.sin(p * 3) * .02 * p); c.globalAlpha = e; glow(c, 0, -TH * .5, TH * .6, T ? RED : '200,220,255', .22);
      const tiers = 6; for (let i = 0; i < tiers; i++) { const t0 = i / tiers, t1 = (i + 1) / tiers, wd = 70 * (1 - t0 * .6), y0 = -TH * t0, y1 = -TH * t1; c.fillStyle = T ? '#21090f' : '#e8ecff'; c.strokeStyle = T ? '#8a1020' : '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-wd, y0); c.lineTo(-wd * .85, y1); c.lineTo(wd * .85, y1); c.lineTo(wd, y0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = T ? '#d4202f' : '#7a8cff'; for (let k = -1; k <= 1; k += 2) c.fillRect(k * wd * .35 - 4, (y0 + y1) / 2 - 7, 8, 14); }
      c.fillStyle = T ? '#d4202f' : '#fff'; c.beginPath(); c.moveTo(0, -TH - 36); c.lineTo(-12, -TH); c.lineTo(12, -TH); c.fill();
      if (T) { c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, -TH * .2); c.lineTo(-10, -TH * .35); c.lineTo(-24, -TH * .5); c.lineTo(8, -TH * .62); c.stroke(); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + p * 4, y = -TH * (.1 + .8 * ((i * .37 + p * .6) % 1)); c.fillStyle = T ? '#ff5a5a' : '#bcd0ff'; c.font = '20px monospace'; c.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹ'[i % 8], Math.cos(a) * 110 - 8, y); } c.restore();
      pg.forEach(k => { const q = (p - k.d) * k.v * 1.4; if (q < 0 || q > 1) return; c.save(); c.translate(k.x + Math.sin(q * 7) * 60, h - q * h * 1.1); c.rotate(k.r + q * 5); c.globalAlpha = e * .8; c.fillStyle = T ? '#5a1a20' : '#f4f1e4'; c.fillRect(-12, -16, 24, 32); c.fillStyle = T ? '#d4202f' : '#7a7a90'; for (let i = 0; i < 4; i++) c.fillRect(-8, -11 + i * 7, 16, 2); c.restore(); }); } }; },

  // 8 Enforcado — marionete suspensa por fios que se fecham
  enforcado: (w, h, T) => { const R = rng(8), fios = Array.from({ length: 22 }, () => ({ x: R() * w, d: R() * .3, f: 1 + R() * 2 })), tal = Array.from({ length: 12 }, () => ({ x: R() * w, d: R() * .4, v: .5 + R() * .6 }));
    return { dur: 4000, draw(c, p) { const cx = w / 2, e = env(p, .1, .84), sw = Math.sin(p * 6) * 26 * ease(p / .3), len = h * .46 * ease(p / .28), fy = len + 10;
      c.globalAlpha = e; c.lineWidth = 1.6; fios.forEach(k => { const q = ease((p - k.d) / .3); const x1 = lerp(k.x, cx + sw, .75); c.strokeStyle = T ? rgba(170, 20, 35, .75) : rgba(200, 185, 235, .6); c.beginPath(); c.moveTo(k.x, 0); c.quadraticCurveTo(lerp(k.x, x1, .5) + Math.sin(p * 5 * k.f) * 14, fy * q * .5, lerp(k.x, x1, q), fy * q); c.stroke(); });
      c.strokeStyle = T ? '#a01020' : '#d8c8f0'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx + sw * .6, len * .5); c.lineTo(cx + sw, len); c.stroke();
      c.save(); c.translate(cx + sw, len); c.rotate(Math.sin(p * 6 + .4) * .1); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = T ? '#d8c8c8' : '#f0e8ff'; glow(c, 0, 70, 130, T ? RED : '170,120,255', .35 * e);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 12); c.stroke(); c.beginPath(); c.moveTo(-10, 10); c.lineTo(10, 10); c.stroke(); c.beginPath(); c.moveTo(0, 14); c.lineTo(0, 70); c.stroke();
      c.beginPath(); c.moveTo(0, 20); c.lineTo(-26, 52); c.lineTo(-8, 30); c.moveTo(0, 20); c.lineTo(26, 52); c.lineTo(8, 30); c.stroke(); c.beginPath(); c.moveTo(0, 70); c.lineTo(-18, 100); c.stroke(); c.beginPath(); c.arc(0, 108, 12, 0, TAU); c.stroke();
      if (T) { c.fillStyle = '#a00'; c.fillRect(-10, 112, 3, 6); } c.restore();
      tal.forEach(k => { const q = (p - k.d) * k.v * 1.3; if (q < 0 || q > 1) return; c.save(); c.translate(k.x, q * h); c.rotate(Math.sin(q * 9) * .4); c.fillStyle = T ? '#a01020' : '#c9b8e8'; c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 0); c.lineTo(0, 12); c.lineTo(-8, 0); c.fill(); c.restore(); });
      if (T) { c.fillStyle = '#b3101e'; for (let i = 0; i < 24; i++) { const q = (p * 1.5 + i * .13) % 1; c.beginPath(); c.ellipse((i * 83) % w, q * h, 2.5, 6, 0, 0, TAU); c.fill(); } } } }; },

  // 9 Escuridão — a luz morre; no terror, olhos se aproximam
  escuridao: (w, h, T) => { const R = rng(9), ff = Array.from({ length: 36 }, () => ({ x: R(), y: R(), f: 1 + R() * 3, o: R() * TAU })), ol = Array.from({ length: 14 }, () => ({ x: R() * w, y: R() * h, d: .25 + R() * .45, s: 14 + R() * 20 }));
    return { dur: 4200, page: p => T ? { filter: `brightness(${1 - env(p, .2, .7) * .55}) saturate(.5)` } : { filter: `brightness(${1 - env(p, .25, .7) * .4})` },
      draw(c, p) { const e = env(p, .3, .72), cx = w / 2 + Math.sin(p * 3) * w * .1, cy = h / 2 + Math.cos(p * 2.4) * h * .08, rad = Math.max(0, Math.min(w, h) * (.5 - p * .45)) * (p > .62 ? Math.max(0, 1 - (p - .62) * 6) : 1) * (Math.sin(p * 60) > .9 && p > .5 ? .4 : 1);
        c.save(); c.fillStyle = rgba(0, 0, 6, .97 * e); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-out'; const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(10, rad)); g.addColorStop(0, `rgba(0,0,0,${e})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
        ff.forEach(s => { const a = (Math.sin(p * 10 * s.f + s.o) * .5 + .5) * e; if (!T) glow(c, s.x * w + Math.sin(p * 4 + s.o) * 20, s.y * h, 6, '170,150,255', a * .9); });
        if (T) { ol.forEach(k => { const q = clamp((p - k.d) / .15) * (1 - clamp((p - .86) / .1)); if (q <= 0) return; const sc = 1 + ((p - k.d) * 2.2), blink = Math.sin(p * 30 + k.x) > .93 ? .1 : 1; c.save(); c.translate(k.x, k.y); c.scale(sc, sc * blink); c.globalAlpha = q; glow(c, 0, 0, k.s * 3, RED, .35); c.fillStyle = '#f01830'; c.beginPath(); c.ellipse(-k.s * .8, 0, k.s * .55, k.s * .26, -.2, 0, TAU); c.ellipse(k.s * .8, 0, k.s * .55, k.s * .26, .2, 0, TAU); c.fill(); c.restore(); });
          c.fillStyle = rgba(0, 0, 0, .9 * e); [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y], i) => { c.beginPath(); c.moveTo(x, y); for (let t = 0; t < 7; t++) c.lineTo(x + (i % 2 ? -1 : 1) * (60 + t * 22) * Math.min(w, h) / 800 * ease(p / .5) * (1 + Math.sin(p * 9 + t) * .2), y + (i < 2 ? 1 : -1) * (t * 36) * Math.min(w, h) / 800 * ease(p / .5)); c.fill(); }); } } }; },

  // 10 Morte — almas com rastro, névoa; no terror, caveiras e mãos
  morte: (w, h, T) => { const R = rng(10), al = Array.from({ length: 24 }, () => ({ x: R() * w, d: R() * .4, v: .5 + R() * .6, s: 10 + R() * 18, ph: R() * TAU })), nb = Array.from({ length: 14 }, () => ({ x: R() * w, y: h * (.6 + R() * .4), s: 120 + R() * 160, v: R() * .6 })), ms = Array.from({ length: 8 }, (_, i) => ({ x: (i + .5) * w / 8 + (R() - .5) * 50, d: R() * .35 }));
    return { dur: 4200, draw(c, p) { const e = env(p, .12, .82), col = T ? '120,150,120' : '150,255,210'; nb.forEach(n => glow(c, (n.x + p * 120 * (n.v + .3)) % (w + 200) - 100, n.y, n.s, col, .07 * e));
      al.forEach(k => { const q = (p - k.d) * k.v * 1.5; if (q < 0 || q > 1.15) return; const pos = u => [k.x + Math.sin(u * 6 + k.ph) * 30, h - u * (h + 140)]; const a = e * (1 - q / 1.15);
        if (T) { const [x, y] = pos(q), s = k.s; c.save(); c.globalAlpha = a; c.fillStyle = '#cdd6c8'; c.beginPath(); c.arc(x, y, s * .6, 0, TAU); c.fill(); const jaw = Math.abs(Math.sin(q * 18)) * s * .25; c.fillRect(x - s * .35, y + s * .4 + jaw, s * .7, s * .3); c.fillStyle = '#050805'; c.beginPath(); c.arc(x - s * .22, y - 2, s * .15, 0, TAU); c.arc(x + s * .22, y - 2, s * .15, 0, TAU); c.moveTo(x, y + s * .12); c.lineTo(x - 3, y + s * .3); c.lineTo(x + 3, y + s * .3); c.fill(); c.restore(); }
        else { for (let t = 0; t < 14; t++) { const [x, y] = pos(q - t * .012); glow(c, x, y, k.s * (1 - t * .05), col, a * (1 - t / 14) * .22); } const [x, y] = pos(q); c.fillStyle = rgba(230, 255, 240, a); c.beginPath(); c.arc(x, y, k.s * .25, 0, TAU); c.fill(); } });
      if (T) ms.forEach(m => { const q = ease((p - m.d) / .3) * (1 - clamp((p - .8) / .15)); if (q > 0) mao(c, m.x, h + 20 - q * 110, 1.1, Math.sin(p * 4 + m.x) * .12, T); }); } }; },

  // 11 Gigante — impacto: tremor, fissuras de lava, destroços, poeira
  gigante: (w, h, T) => { const R = rng(11), cx = w / 2, cy = h * .62, ls = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * TAU + R() * .4, pts = [[cx, cy]]; let x = cx, y = cy, ang = a; for (let s = 0; s < 16; s++) { ang += (R() - .5) * .8; const l = 36 + R() * 70; x += Math.cos(ang) * l; y += Math.sin(ang) * l * .8; pts.push([x, y]); } return pts; }), rk = Array.from({ length: 70 }, () => ({ a: R() * TAU, v: 180 + R() * 520, s: 3 + R() * 10, g: 600 + R() * 500, w: R() * 5 })), dk = Array.from({ length: 12 }, () => ({ a: R() * TAU, s: 60 + R() * 120 }));
    return { dur: 3800, page: p => { const a = p < .45 ? Math.pow(1 - p / .45, 2) : 0; const k = p > .1 ? a : 0; return { tx: (Math.random() - .5) * 38 * k, ty: (Math.random() - .5) * 38 * k }; },
      draw(c, p) { const t0 = .1, t = Math.max(0, p - t0), g = ease(t / .4), e = env(p, .02, .85), col = T ? '230,20,30' : '255,150,40';
        if (p < t0 + .06) { c.fillStyle = rgba(255, 255, 255, (1 - (p - t0) / .06) * .6 * (p > t0 ? 1 : 0)); c.fillRect(0, 0, w, h); }
        dk.forEach(d => glow(c, cx + Math.cos(d.a) * t * 900, cy + Math.sin(d.a) * t * 500, d.s * (1 + t * 3), T ? '70,20,25' : '160,140,120', .3 * (1 - clamp(t / .7)) * (p > t0 ? 1 : 0)));
        c.lineJoin = 'round'; ls.forEach(L => { const n = g * (L.length - 1), f = Math.floor(n); for (const [lw, a, cl] of [[9, .25, col], [4, .9, col], [1.5, 1, '255,240,200']]) { c.strokeStyle = rgba(...cl.split(',').map(Number), a * e); c.lineWidth = lw; c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= f; i++) c.lineTo(L[i][0], L[i][1]); if (f < L.length - 1) c.lineTo(lerp(L[f][0], L[f + 1][0], n - f), lerp(L[f][1], L[f + 1][1], n - f)); c.stroke(); } });
        if (p > t0) rk.forEach(r => { const x = cx + Math.cos(r.a) * r.v * t * .9, y = cy - Math.abs(Math.sin(r.a)) * r.v * t * 1.3 + r.g * t * t * .5; if (y > h + 20) return; c.save(); c.translate(x, y); c.rotate(r.w * t * 4); c.globalAlpha = e; c.fillStyle = T ? (r.s > 7 ? '#d8d4c4' : '#2a1014') : '#6a5a4a'; c.fillRect(-r.s / 2, -r.s / 3, r.s, r.s * .66); c.restore(); });
        for (let i = 0; i < 3; i++) { const q = clamp((p - t0 - i * .06) / .5); if (q > 0 && q < 1) { c.strokeStyle = rgba(255, 255, 255, (1 - q) * .7); c.lineWidth = 8 * (1 - q) + 1; c.beginPath(); c.ellipse(cx, cy, q * w * .8, q * w * .8 * .35, 0, 0, TAU); c.stroke(); } } } }; },

  // 12 Demonessa — lírios-aranha florescem; no terror, teias e aranhas
  demonessa: (w, h, T) => { const R = rng(12), fl = Array.from({ length: 9 }, () => ({ x: R() * w, y: h * (.35 + R() * .6), d: R() * .45, s: 40 + R() * 50, r: R() * TAU })), ps = Array.from({ length: 40 }, () => ({ x: R() * w, d: R() * .5, v: .6 + R() * .6, r: R() * TAU, s: 7 + R() * 12, sw: R() * 3 })),
    cantos = [[0, 0], [w, 0], [0, h], [w, h]], ar = Array.from({ length: 8 }, () => ({ x: R() * w, d: R() * .4, l: .25 + R() * .4 }));
    return { dur: 4000, draw(c, p) { const e = env(p, .1, .85);
      glow(c, w / 2, h * .6, Math.max(w, h) * .6, T ? '60,0,10' : '255,80,140', .16 * e);
      if (!T) fl.forEach(f => { const q = ease((p - f.d) / .35); if (q <= 0) return; c.save(); c.translate(f.x, f.y); c.rotate(f.r); c.globalAlpha = e; c.strokeStyle = '#ff3a78'; c.fillStyle = '#ffb0cc'; c.lineWidth = 2; c.lineCap = 'round';
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, L = f.s * q; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a - .5) * L * .6, Math.sin(a - .5) * L * .6, Math.cos(a) * L, Math.sin(a) * L); c.stroke(); c.beginPath(); c.arc(Math.cos(a) * L, Math.sin(a) * L, 3, 0, TAU); c.fill(); } glow(c, 0, 0, f.s, '255,70,130', .25 * q); c.restore(); });
      ps.forEach(k => { const q = (p - k.d) * k.v * 1.3; if (q < 0) return; const y = -30 + q * (h + 80); if (y > h + 40) return; c.save(); c.translate(k.x + Math.sin(q * 5 + k.sw) * 60, y); c.rotate(k.r + q * 4); c.globalAlpha = e; c.fillStyle = T ? (k.sw > 1.5 ? '#6b0a14' : '#18020a') : (k.sw > 1.5 ? '#ff7fb2' : '#d03a82'); c.beginPath(); c.ellipse(0, 0, k.s, k.s * .45, 0, 0, TAU); c.fill(); c.restore(); });
      if (T) { c.strokeStyle = rgba(225, 225, 225, .55 * e); c.lineWidth = 1; cantos.forEach(([x, y], ci) => { const g = ease(p / .5), sx = x ? -1 : 1, sy = y ? -1 : 1, R0 = Math.min(w, h) * .5 * g; for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * Math.cos(a) * R0, y + sy * Math.sin(a) * R0); c.stroke(); } for (let r = 1; r <= 6; r++) { c.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2, rr = R0 * r / 6 * (1 - .06 * Math.sin(i * 2.1 + r)); c.lineTo(x + sx * Math.cos(a) * rr, y + sy * Math.sin(a) * rr); } c.stroke(); } });
        ar.forEach(a => { const q = ease((p - a.d) / .3), y = h * a.l * q + Math.sin(p * 6 + a.x) * 8; c.strokeStyle = 'rgba(200,200,200,.5)'; c.beginPath(); c.moveTo(a.x, 0); c.lineTo(a.x, y); c.stroke(); c.fillStyle = '#050205'; c.beginPath(); c.ellipse(a.x, y + 8, 8, 10, 0, 0, TAU); c.fill(); c.strokeStyle = '#050205'; c.lineWidth = 2; for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(a.x, y + 8); c.lineTo(a.x + i * (14 + j * 3), y + j * 5 - 4); c.lineTo(a.x + i * (20 + j * 3), y + j * 8 + 6); c.stroke(); } c.fillStyle = '#f00'; c.fillRect(a.x - 3, y + 3, 2, 2); c.fillRect(a.x + 1, y + 3, 2, 2); }); } } }; },

  // 13 Sacerdote Rubro — muralha de chamas
  sacerdote: (w, h, T) => { const R = rng(13), es = Array.from({ length: 110 }, () => ({ x: R() * w, d: R() * .5, v: .5 + R() * 1.1, s: 2 + R() * 4 }));
    return { dur: 3800, page: p => ({ filter: T ? `contrast(1.15) brightness(${1 - env(p, .2, .8) * .25})` : `brightness(${1 + env(p, .2, .8) * .15}) sepia(${env(p, .2, .8) * .35})` }),
      draw(c, p) { const e = env(p, .14, .8), g = ease(p / .35); c.save(); c.globalCompositeOperation = 'lighter';
        const camadas = T ? [['40,0,55', 1.0], ['120,0,28', .75], ['200,16,34', .5], ['255,110,90', .2]] : [['180,30,0', 1.0], ['255,90,10', .75], ['255,170,30', .5], ['255,240,170', .25]];
        camadas.forEach(([col, sc], li) => { c.fillStyle = rgba(...col.split(',').map(Number), .55 * e); c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 10) { const n = Math.sin(x * .017 + p * 14 + li) + Math.sin(x * .043 - p * 21) * .6 + Math.sin(x * .09 + p * 33) * .3; c.lineTo(x, h - h * .42 * sc * g * (.65 + .35 * n * .5 + .2) ); } c.lineTo(w, h); c.fill(); }); c.restore();
        es.forEach(k => { const q = (p - k.d) * k.v * 1.5; if (q < 0 || q > 1) return; const x = k.x + Math.sin(q * 10 + k.x) * 24, y = h - q * h * 1.0; glow(c, x, y, k.s * 3 * (1 - q * .5), T ? '255,60,70' : '255,190,60', (1 - q) * .9); }); } }; },

  // 14 Eremita — círculo de invocação em camadas
  eremita: (w, h, T) => { const R = rng(14), sp = Array.from({ length: 22 }, () => ({ a: R() * TAU, v: .6 + R() * .9, r: .55 + R() * .45 }));
    return { dur: 4200, draw(c, p) { const cx = w / 2, cy = h * .52, r = Math.min(w, h) * .34, g = ease(p / .4), e = env(p, .1, .82), col = T ? '230,30,45' : '130,200,255', cs = `rgb(${col})`;
      glow(c, cx, cy, r * 1.5, col, .16 * e); c.save(); c.globalAlpha = e; c.strokeStyle = c.fillStyle = cs; c.shadowColor = cs; c.shadowBlur = 14; c.lineWidth = 2.5;
      [[1, 0, 1], [.86, 1, -1], [.62, 0, 1]].forEach(([k, ofs, dir]) => { c.beginPath(); c.arc(cx, cy, r * k, -Math.PI / 2, -Math.PI / 2 + dir * TAU * g); c.stroke(); });
      c.save(); c.translate(cx, cy); c.rotate(p * (T ? -1.3 : 1.3)); for (let t = 0; t < 2; t++) { c.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + (T ? t : t) * Math.PI + (T && t === 0 ? Math.PI : 0); c.lineTo(Math.cos(a - Math.PI / 2) * r * .86 * g, Math.sin(a - Math.PI / 2) * r * .86 * g); } c.closePath(); c.stroke(); }
      for (let i = 0; i < 36; i++) { c.rotate(TAU / 36); c.fillRect(r * .94, -1.5, i % 3 ? 6 : 12, 3); } c.restore();
      c.save(); c.translate(cx, cy); c.rotate(-p * .8); c.font = `${Math.max(14, r * .1)}px serif`; const rn = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; for (let i = 0; i < 12; i++) { if (i / 12 > g) break; c.rotate(TAU / 12); c.fillText(rn[i], -6, -r * .74); } c.restore();
      sp.forEach(s => { const a = s.a + p * s.v * 4; glow(c, cx + Math.cos(a) * r * s.r, cy + Math.sin(a) * r * s.r, 8, col, .9 * e); });
      if (p > .4) { const b = ease((p - .4) / .3); const gr = c.createLinearGradient(0, cy, 0, 0); gr.addColorStop(0, `rgba(${col},${.5 * b * e})`); gr.addColorStop(1, `rgba(${col},0)`); c.fillStyle = gr; c.fillRect(cx - r * .18, 0, r * .36, cy); }
      if (T) { c.shadowBlur = 0; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy, r * .22, r * .1 * g, 0, 0, TAU); c.fill(); c.fillStyle = '#a00010'; c.beginPath(); c.arc(cx, cy, r * .07, 0, TAU); c.fill(); }
      c.restore(); } }; },

  // 15 Paragono — blueprint, engrenagens engrenadas, vapor, faíscas
  paragono: (w, h, T) => { const R = rng(15), vp = Array.from({ length: 16 }, () => ({ x: R(), v: .4 + R() * .8, d: R() }));
    return { dur: 4000, page: p => ({ filter: T ? `sepia(${env(p, .1, .8) * .6}) hue-rotate(-20deg)` : `hue-rotate(${env(p, .1, .8) * 10}deg)` }),
      draw(c, p) { const e = env(p, .12, .84), S = Math.min(w, h) / 700, cx = w / 2, cy = h * .52;
        c.strokeStyle = T ? rgba(255, 90, 60, .12 * e) : rgba(120, 180, 255, .16 * e); c.lineWidth = 1; for (let x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
        const gs = [{ r: 100 * S, n: 18 }, { r: 66 * S, n: 12 }, { r: 88 * S, n: 16 }], x1 = cx - (100 + 66 + 88 + 66) * S * .62, gx = [x1]; gx.push(gx[0] + (gs[0].r + gs[1].r + 4 * S)); gx.push(gx[1] + (gs[1].r + gs[2].r + 4 * S));
        const th = p * (T ? 2.2 : 4) * (T && p > .6 ? clamp(1 - (p - .6) * 3) : 1);
        gs.forEach((G, i) => { c.save(); c.translate(gx[i], cy + (i === 1 ? 0 : 20 * S)); c.globalAlpha = e; const ang = i === 1 ? -th * gs[0].n / G.n + Math.PI / G.n : i === 2 ? th * gs[0].n / G.n : th; c.rotate(ang); engrenagem(c, G.r, G.n, T ? '#3a1208' : '#b98a3c', T ? '#9a2a14' : '#f3d99a'); c.restore(); });
        c.save(); c.globalAlpha = e; c.fillStyle = T ? '#4a1a12' : '#8a6a30'; const pk = Math.abs(Math.sin(p * 12)) * 40 * S; c.fillRect(w * .78, cy - 150 * S, 26 * S, 160 * S); c.fillStyle = T ? '#aa3a22' : '#d4b070'; c.fillRect(w * .78 - 8 * S, cy - 150 * S + pk, 42 * S, 22 * S); c.restore();
        vp.forEach(v => { const q = ((p * v.v * 1.3 + v.d) % 1); const x = lerp(gx[0], w * .85, v.x), y = cy - 60 * S - q * h * .5; c.fillStyle = T ? rgba(220, 60, 40, (1 - q) * .3 * e) : rgba(235, 240, 250, (1 - q) * .3 * e); c.beginPath(); c.arc(x, y, 14 + q * 60, 0, TAU); c.fill(); });
        if (T && p > .5) for (let i = 0; i < 20; i++) glow(c, gx[1] + (Math.random() - .5) * 90, cy + (Math.random() - .5) * 90, 5, '255,200,100', .9 * e);
        if (!T) for (let i = 0; i < 6; i++) { const q = (p * 3 + i / 6) % 1; glow(c, gx[1] + Math.cos(i * 2) * 40 * q, cy - 20 - q * 50, 4, '255,230,150', (1 - q) * .8 * e); } } }; },

  // 16 Roda da Fortuna — roleta de destino com chuva de moedas
  roda: (w, h, T) => { const R = rng(16), cs = Array.from({ length: 50 }, () => ({ a: -Math.PI / 2 + (R() - .5) * 1.4, v: 350 + R() * 500, d: R() * .35, w: R() * 8 }));
    return { dur: 4200, draw(c, p) { const cx = w / 2, cy = h * .52, r = Math.min(w, h) * .27, e = env(p, .1, .85), spin = (T ? -1 : 1) * (1 - Math.pow(1 - clamp(p / .8), 3)) * 22, n = 12;
      glow(c, cx, cy, r * 2, T ? RED : '255,200,80', .18 * e); c.save(); c.translate(cx, cy); c.globalAlpha = e;
      c.save(); c.rotate(spin); for (let i = 0; i < n; i++) { c.fillStyle = T ? (i % 2 ? '#14040a' : '#4a0a14') : (i % 2 ? '#3a2a7a' : '#e0b040'); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i / n * TAU, (i + 1) / n * TAU); c.fill();
        c.save(); c.rotate((i + .5) / n * TAU); c.translate(r * .78, 0); c.rotate(Math.PI / 2); c.fillStyle = T ? '#ddd' : '#fff6d0'; if (T) { c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.fillStyle = '#000'; c.fillRect(-4, -2, 3, 3); c.fillRect(1, -2, 3, 3); } else { c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); } c.restore(); }
      c.strokeStyle = T ? '#8a1020' : '#f0c15a'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.fillStyle = T ? '#1a0508' : '#2a1f60'; c.beginPath(); c.arc(0, 0, r * .16, 0, TAU); c.fill(); c.stroke(); c.restore();
      const tk = Math.sin(spin * n / 2 * Math.PI) * .3 * (1 - clamp(p / .8)); c.fillStyle = T ? '#e8e8e0' : '#fff'; c.save(); c.translate(0, -r - 6); c.rotate(tk); c.beginPath(); c.moveTo(0, 26); c.lineTo(-11, -6); c.lineTo(11, -6); c.fill(); c.restore(); c.restore();
      cs.forEach(k => { const t = Math.max(0, p - .25 - k.d * .3); if (t <= 0 || t > .7) return; const x = cx + Math.cos(k.a) * k.v * t * 1.1 * (1 + Math.sin(k.w)), y = cy - r + Math.sin(k.a) * k.v * t * 1.5 + 900 * t * t, sc = Math.abs(Math.cos(t * 30 + k.w)); c.save(); c.translate(x, y); c.fillStyle = T ? '#0e0206' : '#ffd24a'; c.strokeStyle = T ? '#d4202f' : '#a8741a'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 11, 11 * sc + 1, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); if (sc > .9) glow(c, x, y, 16, T ? RED : '255,240,160', .7); }); } }; },

  // 17 Mãe — vinhas com folhas e flores, pólen
  mae: (w, h, T) => { const R = rng(17), vs = Array.from({ length: 9 }, (_, i) => ({ x: (i + .5) * w / 9 + (R() - .5) * 30, a: R() * 3, hh: .4 + R() * .5 })), po = Array.from({ length: 70 }, () => ({ x: R(), y: R(), v: .1 + R() * .3, o: R() * TAU }));
    return { dur: 4200, draw(c, p) { const g = ease(p / .55), e = env(p, .05, .84);
      if (!T) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const x = w * (.2 + i * .22); const gr = c.createLinearGradient(x, 0, x - 120, h); gr.addColorStop(0, `rgba(200,255,180,${.16 * e})`); gr.addColorStop(1, 'rgba(200,255,180,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(x - 20, 0); c.lineTo(x + 40, 0); c.lineTo(x - 80, h); c.lineTo(x - 200, h); c.fill(); } c.restore(); }
      vs.forEach((v, vi) => { c.globalAlpha = e; c.lineCap = 'round'; const n = Math.floor(60 * g); let lx = 0, ly = 0;
        c.strokeStyle = T ? '#240a10' : '#2f9a50'; c.lineWidth = T ? 5 : 4; c.beginPath(); for (let i = 0; i <= n; i++) { const t = i / 60, y = h - t * h * v.hh, x = v.x + Math.sin(t * 10 + v.a) * (T ? 34 : 26); i ? c.lineTo(x, y) : c.moveTo(x, y); lx = x; ly = y; } c.stroke();
        for (let i = 6; i <= n; i += 6) { const t = i / 60, y = h - t * h * v.hh, x = v.x + Math.sin(t * 10 + v.a) * (T ? 34 : 26), s = i % 12 ? 1 : -1; c.save(); c.translate(x, y); c.rotate(s * .9); c.fillStyle = T ? '#7a0c18' : (i % 18 ? '#6fdc86' : '#4cc46a'); if (T) { c.beginPath(); c.moveTo(0, 0); c.lineTo(18, -5); c.lineTo(0, 5); c.fill(); } else { c.beginPath(); c.ellipse(11, 0, 13, 5.5, 0, 0, TAU); c.fill(); } c.restore(); }
        if (n > 50 && !T) { const b = ease((g - .8) / .2); c.save(); c.translate(lx, ly); for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); c.fillStyle = vi % 2 ? '#ffb7d5' : '#fff3a0'; c.beginPath(); c.ellipse(0, -10 * b, 6 * b, 11 * b, 0, 0, TAU); c.fill(); } c.fillStyle = '#ff9a3c'; c.beginPath(); c.arc(0, 0, 5 * b, 0, TAU); c.fill(); c.restore(); } });
      po.forEach(q => { const y = (q.y - p * q.v + 1) % 1 * h, x = q.x * w + Math.sin(p * 4 + q.o) * 30; glow(c, x, y, 5, T ? '120,20,30' : '255,245,160', .5 * e); }); } }; },

  // 18 Lua — lua com nuvens, reflexo, lobo uivando
  lua: (w, h, T) => { const R = rng(18), st = Array.from({ length: 60 }, () => ({ x: R() * w, y: R() * h * .7, f: 1 + R() * 3, o: R() * TAU })), nv = Array.from({ length: 6 }, () => ({ y: R() * h * .6, s: 120 + R() * 160, v: .2 + R() * .5, x: R() * w }));
    return { dur: 4400, draw(c, p) { const cx = w / 2, r = Math.min(w, h) * .17, cy = lerp(h * .86, h * .34, ease(p / .6)), e = env(p, .15, .85), col = T ? RED : '225,235,255';
      st.forEach(s => { c.fillStyle = rgba(255, 255, 255, (Math.sin(p * 12 * s.f + s.o) * .4 + .5) * .6 * e); c.fillRect(s.x, s.y, 2, 2); });
      glow(c, cx, cy, r * 5, col, .5 * e); c.fillStyle = T ? rgba(170, 10, 20, e) : rgba(240, 245, 255, e); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      c.fillStyle = rgba(0, 0, 0, .14 * e); [[-.3, -.2, .25], [.25, .1, .3], [-.1, .35, .18], [.3, -.35, .14]].forEach(([a, b, s]) => { c.beginPath(); c.arc(cx + a * r, cy + b * r, s * r, 0, TAU); c.fill(); });
      for (let i = 0; i < 4; i++) { const q = (p * 1.1 + i / 4) % 1; c.strokeStyle = rgba(...col.split(',').map(Number), (1 - q) * .35 * e); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r + q * r * 5, 0, TAU); c.stroke(); }
      nv.forEach(n => { const x = (n.x + p * 200 * n.v) % (w + 400) - 200; c.fillStyle = rgba(T ? 30 : 60, T ? 5 : 70, T ? 10 : 110, .55 * e); for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x + i * n.s * .3, n.y + Math.sin(i) * 12, n.s * .35, n.s * .13, 0, 0, TAU); c.fill(); } });
      c.fillStyle = '#04030a'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * .84); c.quadraticCurveTo(w * .25, h * .76, w * .45, h * .86); c.quadraticCurveTo(w * .7, h * .93, w, h * .8); c.lineTo(w, h); c.fill();
      const lx = w * .16, ly = h * .79, hw = ease((p - .3) / .3); c.save(); c.translate(lx, ly); c.scale(hw, hw); c.fillStyle = '#04030a'; c.beginPath(); c.moveTo(-40, 20); c.lineTo(-34, -6); c.lineTo(-14, -26); c.lineTo(-22, -50); c.lineTo(-8, -44); c.lineTo(8, -40); c.lineTo(24, -52); c.lineTo(20, -34); c.lineTo(8, -22); c.lineTo(10, 6); c.lineTo(50, 20); c.fill(); c.restore();
      if (T) { c.fillStyle = '#000'; for (let i = 0; i < 7; i++) { const q = (p * .9 + i * .15) % 1, x = q * w * 1.2 - 40, y = h * (.12 + .08 * i) + Math.sin(q * 14 + i) * 18, f = Math.sin(q * 40 + i) * 6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 14, y - 10 - f, x - 26, y); c.quadraticCurveTo(x - 14, y + 3, x, y); c.moveTo(x, y); c.quadraticCurveTo(x + 14, y - 10 - f, x + 26, y); c.quadraticCurveTo(x + 14, y + 3, x, y); c.fill(); } } } }; },

  // 19 Abismo — a página afunda num vórtice; tentáculos no terror
  abismo: (w, h, T) => { const R = rng(19), de = Array.from({ length: 80 }, () => ({ a: R() * TAU, r: .3 + R() * .7, v: .4 + R(), s: 1.5 + R() * 3 })), tn = Array.from({ length: 11 }, () => ({ a: R() * TAU, l: .4 + R() * .6, f: 1 + R() * 3, d: R() * .3 }));
    return { dur: 4200, page: p => { const e = env(p, .25, .75); return { scale: 1 - e * .1, filter: `blur(${e * 2.5}px) brightness(${1 - e * .45})`, rot: e * (T ? -2 : 2) }; },
      draw(c, p) { const cx = w / 2, cy = h / 2, e = env(p, .22, .76), L = Math.max(w, h) * .8; c.save(); c.translate(cx, cy);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, L); g.addColorStop(0, rgba(0, 0, 0, .97 * e)); g.addColorStop(.45, T ? rgba(80, 0, 22, .5 * e) : rgba(40, 10, 100, .5 * e)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, L, 0, TAU); c.fill();
        const arms = T ? 7 : 5; c.lineWidth = 3; for (let a = 0; a < arms; a++) { c.strokeStyle = T ? rgba(230, 30, 50, .65 * e) : rgba(170, 120, 255, .55 * e); c.beginPath(); for (let t = 0; t < 1; t += .01) { const ang = t * 7 - p * 7 + a * TAU / arms, rr = t * L; c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } c.stroke(); }
        de.forEach(d => { const q = (p * d.v * 1.2 + d.r) % 1, rr = (1 - q) * L * d.r * 1.2, ang = d.a + q * 8; c.fillStyle = T ? rgba(255, 140, 140, e * q) : rgba(220, 210, 255, e * q); c.fillRect(Math.cos(ang) * rr, Math.sin(ang) * rr * .85, d.s, d.s); });
        c.save(); c.scale(1, .32); c.strokeStyle = T ? rgba(255, 120, 60, .9 * e) : rgba(200, 160, 255, .9 * e); c.lineWidth = 10; c.shadowColor = T ? '#f44' : '#a8f'; c.shadowBlur = 24; c.beginPath(); c.arc(0, 0, Math.min(w, h) * .15, 0, TAU); c.stroke(); c.restore();
        c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, Math.min(w, h) * .09 * ease(p / .3), 0, TAU); c.fill();
        if (T) tn.forEach(t => { const q = ease((p - t.d) / .4); c.strokeStyle = rgba(190, 10, 30, .85 * e); c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); for (let s = 0; s <= 24; s++) { const u = s / 24 * q, rr = u * L * t.l, aa = t.a + Math.sin(u * 8 * t.f + p * 6) * .3; c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } c.stroke(); }); c.restore(); } }; },

  // 20 Acorrentado — correntes disparam, se enrolam e travam o grilhão
  acorrentado: (w, h, T) => { const R = rng(20), N = 8, ch = Array.from({ length: N }, (_, i) => { const a = i / N * TAU + .3; return { a, d: R() * .12, sy: R() * 60 }; });
    return { dur: 3800, page: p => { const k = p > .42 && p < .56 ? 1 - (p - .42) / .14 : 0; return k > 0 ? { tx: (Math.random() - .5) * 28 * k, ty: (Math.random() - .5) * 28 * k } : {}; },
      draw(c, p) { const cx = w / 2, cy = h / 2, e = env(p, .04, .85), Rr = Math.min(w, h) * .2, far = Math.hypot(w, h) * .62, hit = p > .42;
        ch.forEach(k => { const q = ease((p - k.d) / .35); if (q <= 0) return; const len = lerp(far, Rr * 1.0, q), ex = cx + Math.cos(k.a) * far, ey = cy + Math.sin(k.a) * far, tx = cx + Math.cos(k.a) * Rr, ty = cy + Math.sin(k.a) * Rr;
          const x0 = lerp(ex, tx, q), y0 = lerp(ey, ty, q); c.save(); c.globalAlpha = e; const ang = k.a + Math.PI, segs = Math.floor(Math.hypot(ex - x0, ey - y0) / 24);
          for (let i = 0; i <= segs; i++) { const x = x0 + Math.cos(k.a) * i * 24 + Math.sin(i * .7 + p * 10) * 3 * (1 - q), y = y0 + Math.sin(k.a) * i * 24 + Math.cos(i * .6) * 3 * (1 - q); c.save(); c.translate(x, y); c.rotate(k.a + (i % 2 ? Math.PI / 2 : 0)); c.strokeStyle = T ? (i % 5 ? '#7a2018' : '#b01a28') : '#c3cadc'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 13, 6.5, 0, 0, TAU); c.stroke(); c.strokeStyle = T ? '#3a0a0a' : '#6a7188'; c.lineWidth = 2; c.stroke(); c.restore(); }
          c.restore(); });
        if (hit) { const q = ease((p - .42) / .2); c.save(); c.translate(cx, cy); c.globalAlpha = e; c.strokeStyle = T ? '#8a1822' : '#d0d6e8'; c.lineWidth = 12; c.beginPath(); c.arc(0, 0, Rr * q, 0, TAU); c.stroke(); c.strokeStyle = T ? '#2a0508' : '#6a7188'; c.lineWidth = 4; c.stroke();
          if (T) { c.fillStyle = '#d8d8d0'; for (let i = 0; i < 12; i++) { c.save(); c.rotate(i / 12 * TAU); c.beginPath(); c.moveTo(Rr * q, -7); c.lineTo(Rr * q + 18, 0); c.lineTo(Rr * q, 7); c.fill(); c.restore(); } }
          c.fillStyle = T ? '#5a0a14' : '#9aa2b8'; c.fillRect(-18, -24 - Rr * q, 36, 30); c.restore();
          for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = (p - .42) * 900 * (.3 + (i * 31 % 10) / 10); glow(c, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 5, T ? '255,80,60' : '255,230,160', clamp(1 - (p - .42) * 3)); } }
        if (T) { c.fillStyle = '#a0101c'; for (let i = 0; i < 18; i++) { const q = (p * 1.4 + i * .17) % 1; c.beginPath(); c.ellipse((i * 97) % w, q * h, 2.5, 7, 0, 0, TAU); c.fill(); } } } }; },

  // 21 Imperador Negro — estilhaços se unem numa coroa; estandartes
  imperador: (w, h, T) => { const R = rng(21), N = 44, sh = Array.from({ length: N }, () => ({ a: R() * TAU, d: R() * .2, s: 7 + R() * 14, r: R() * TAU, ox: (R() - .5) * 150, oy: (R() - .5) * 90 })), co = Array.from({ length: 30 }, () => ({ x: R() * w, d: .4 + R() * .3, v: .6 + R() * .6 }));
    return { dur: 4200, draw(c, p) { const cx = w / 2, cy = h * .48, e = env(p, .08, .86), S = Math.min(w, h) * .17, asm = ease((p - .05) / .4), far = Math.hypot(w, h) * .6, gold = T ? '#a50d1f' : '#e8c060';
      [[-1, 0], [1, 0]].forEach(([s]) => { const bx = cx + s * Math.min(w * .36, 380), len = h * .5 * ease(p / .35); c.globalAlpha = e; c.fillStyle = T ? '#2a0509' : '#1a1030'; c.strokeStyle = gold; c.lineWidth = 3; c.beginPath(); c.moveTo(bx - 34, 0); c.lineTo(bx + 34, 0); c.lineTo(bx + 34, len); c.lineTo(bx, len - 28); c.lineTo(bx - 34, len); c.closePath(); c.fill(); c.stroke(); c.fillStyle = gold; c.beginPath(); c.arc(bx, len * .4, 10, 0, TAU); c.fill(); });
      sh.forEach((k, i) => { const tx = cx + k.ox * asm * 0 + Math.cos(i / N * TAU * 3) * S * .8 * (.4 + (i % 7) / 9), ty = cy + Math.sin(i / N * TAU * 2) * S * .5; const x = T ? lerp(tx, cx + Math.cos(k.a) * far * ease((p - .5) / .5), clamp((p - .5) * 3)) : lerp(cx + Math.cos(k.a) * far, tx, asm), y = T ? lerp(ty, cy + Math.sin(k.a) * far * ease((p - .5) / .5), clamp((p - .5) * 3)) : lerp(cy + Math.sin(k.a) * far, ty, asm); c.save(); c.translate(x, y); c.rotate(k.r * (1 - asm)); c.globalAlpha = e; c.fillStyle = gold; c.beginPath(); c.moveTo(0, -k.s); c.lineTo(k.s * .5, 0); c.lineTo(0, k.s * 1.2); c.lineTo(-k.s * .5, 0); c.fill(); c.restore(); });
      const ok = p > .36; if (ok) { const q = ease((p - .36) / .2); c.save(); c.translate(cx, cy); c.globalAlpha = e * q; glow(c, 0, 0, S * 3, T ? RED : '255,210,100', .45); c.fillStyle = T ? '#14040a' : '#f0d070'; c.strokeStyle = T ? '#d4202f' : '#7a5a10'; c.lineWidth = 4; c.beginPath(); c.moveTo(-S, S * .6); c.lineTo(-S * 1.15, -S * .7); c.lineTo(-S * .5, -S * .1); c.lineTo(0, -S); c.lineTo(S * .5, -S * .1); c.lineTo(S * 1.15, -S * .7); c.lineTo(S, S * .6); c.closePath(); c.fill(); c.stroke();
        [[-1.15, -.7], [0, -1], [1.15, -.7]].forEach(([a, b]) => { c.fillStyle = T ? '#ff2a3c' : '#e83a5a'; c.beginPath(); c.arc(a * S, b * S, 7, 0, TAU); c.fill(); });
        if (T) { c.strokeStyle = '#d4202f'; c.lineWidth = 5; c.beginPath(); c.moveTo(-S * .15, -S); c.lineTo(S * .2, -S * .1); c.lineTo(-S * .1, S * .6); c.stroke(); } else { const sw = (p * 2 % 1) * S * 3 - S * 1.5; c.save(); c.beginPath(); c.moveTo(-S, S * .6); c.lineTo(-S * 1.15, -S * .7); c.lineTo(0, -S); c.lineTo(S * 1.15, -S * .7); c.lineTo(S, S * .6); c.closePath(); c.clip(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(sw - 10, -S * 1.2, 20, S * 2); c.restore(); } c.restore(); }
      co.forEach(k => { const q = (p - k.d) * k.v * 1.6; if (q < 0 || q > 1) return; const x = k.x, y = q * h, sc = Math.abs(Math.cos(q * 25 + k.x)); c.fillStyle = T ? '#150508' : '#ffd24a'; c.strokeStyle = T ? '#d4202f' : '#a8741a'; c.beginPath(); c.ellipse(x, y, 9, 9 * sc + 1, 0, 0, TAU); c.fill(); c.stroke(); }); } }; },

  // 22 Justiceiro — balança oscilando, martelo, pilar de luz, veredito
  justiceiro: (w, h, T) => ({ dur: 4000, page: p => { const k = p > .5 && p < .6 ? 1 - (p - .5) / .1 : 0; return k > 0 ? { tx: (Math.random() - .5) * 22 * k, ty: (Math.random() - .5) * 22 * k, filter: `brightness(${1 + k * .8})` } : {}; },
    draw(c, p) { const cx = w / 2, cy = h * .5, e = env(p, .06, .86), S = Math.min(w, h) * .26, col = T ? '230,30,40' : '255,255,255', cs = `rgb(${col})`;
      const pg = c.createLinearGradient(0, 0, 0, h); pg.addColorStop(0, `rgba(${col},${.5 * e * ease(p / .2)})`); pg.addColorStop(1, `rgba(${col},0)`); c.fillStyle = pg; c.fillRect(cx - S * .35, 0, S * .7, h);
      const tilt = (T ? .42 : 0) * ease((p - .4) / .3) + Math.sin(p * 14) * .32 * Math.pow(1 - clamp(p / .55), 2); c.save(); c.globalAlpha = e; c.translate(cx, cy); c.strokeStyle = c.fillStyle = cs; c.lineWidth = 5; c.shadowColor = cs; c.shadowBlur = 16; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, S * .75); c.lineTo(0, -S * .55); c.moveTo(-S * .3, S * .75); c.lineTo(S * .3, S * .75); c.stroke(); c.beginPath(); c.arc(0, -S * .6, 8, 0, TAU); c.fill();
      c.save(); c.translate(0, -S * .5); c.rotate(tilt); c.beginPath(); c.moveTo(-S * .8, 0); c.lineTo(S * .8, 0); c.stroke();
      [-1, 1].forEach(s => { const px = s * S * .8, py = S * .55 + (T ? s * 8 : 0); c.save(); c.translate(px, 0); c.rotate(-tilt); c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(-S * .3, py); c.moveTo(0, 0); c.lineTo(S * .3, py); c.stroke(); c.lineWidth = 5; c.beginPath(); c.arc(0, py, S * .3, 0, Math.PI); c.stroke(); if (T && s === 1) { c.fillStyle = '#d4202f'; c.beginPath(); c.arc(0, py - 8, 9, 0, TAU); c.fill(); } c.restore(); }); c.restore(); c.restore();
      for (let i = 0; i < 3; i++) { const q = clamp((p - .5 - i * .06) / .5); if (q > 0 && q < 1) { c.strokeStyle = `rgba(${col},${(1 - q) * .8})`; c.lineWidth = 7 * (1 - q) + 1; c.beginPath(); c.arc(cx, cy + S * .75, q * Math.max(w, h) * .6, 0, TAU); c.stroke(); } }
      if (p > .6) { const t = ease((p - .6) / .15); c.save(); c.globalAlpha = t * e; c.fillStyle = cs; c.font = `${Math.min(w, h) * .06}px Georgia, serif`; c.textAlign = 'center'; c.shadowColor = cs; c.shadowBlur = 20; c.fillText(T ? 'C U L P A D O' : 'V E R E D I T O', cx, cy + S * 1.15); c.restore(); } } }),
};

const Efeitos = (() => {
  let cv = null, raf = 0; const IMG = {};
  const img = id => IMG[id] || (IMG[id] = Object.assign(new Image(), { src: `img/sigilos/${id}.webp` }));
  const cor = id => { const c = typeof caminhoPorId === 'function' ? caminhoPorId(id) : null; return c ? c.cor : '#fff'; };
  function tela() { if (cv) return cv; cv = document.createElement('canvas'); cv.id = 'fx-canvas'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60'; document.body.appendChild(cv); return cv; }

  // O sigilo do Caminho surge no clímax, com o nome
  function selo(c, id, w, h, p, T) {
    const a = clamp((p - .34) / .12) * (1 - clamp((p - .84) / .14)); if (a <= 0) return;
    const im = img(id), S = Math.min(w, h) * .3 * (.7 + .3 * ease((p - .34) / .2)), cx = w / 2, cy = h * .5, k = T ? '215,20,35' : '255,230,170';
    c.save(); c.globalAlpha = a; glow(c, cx, cy, S * 1.1, k, .55);
    c.strokeStyle = `rgba(${k},.7)`; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, S * .62, 0, TAU); c.stroke(); c.setLineDash([3, 9]); c.beginPath(); c.arc(cx, cy, S * .7, p * 4, p * 4 + TAU); c.stroke(); c.setLineDash([]);
    if (im.complete && im.naturalWidth) { if (T) c.filter = 'sepia(1) saturate(4) hue-rotate(-40deg) brightness(.9)'; c.drawImage(im, cx - S * .5, cy - S * .5, S, S); c.filter = 'none'; }
    const caminho = typeof caminhoPorId === 'function' && caminhoPorId(id); if (caminho) { c.font = `${Math.max(16, S * .12)}px Georgia, serif`; c.textAlign = 'center'; c.fillStyle = T ? '#ff8a8a' : cor(id); c.shadowColor = c.fillStyle; c.shadowBlur = 16; c.fillText(caminho.nome.toUpperCase().split('').join(' '), cx, cy + S * .85); }
    c.restore();
  }
  function aplicarPagina(o) {
    const app = document.querySelector('main') || document.body; if (!o) { app.style.transform = app.style.filter = ''; return; }
    app.style.transform = `translate(${o.tx || 0}px,${o.ty || 0}px) skewX(${o.skew || 0}deg) rotate(${o.rot || 0}deg) scale(${o.scale || 1})`; app.style.filter = o.filter || '';
  }
  function tocar(id, terror = Som.terror) {
    const fab = FX[id]; if (!fab) return Promise.resolve();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    cancelAnimationFrame(raf); aplicarPagina(null); img(id);
    const c = tela(), w = cv.width = innerWidth, h = cv.height = innerHeight, ctx = c.getContext('2d'), fx = fab(w, h, terror), t0 = performance.now();
    return new Promise(res => {
      const passo = now => {
        const p = Math.max(0, Math.min(1, (now - t0) / fx.dur));   // o carimbo do quadro pode vir um pouco antes de t0: sem isso p fica negativo e o canvas recusa raios negativos
        ctx.clearRect(0, 0, w, h); ctx.save(); ctx.globalAlpha = 1; fx.draw(ctx, p); ctx.restore(); ctx.save(); selo(ctx, id, w, h, p, terror); ctx.restore();
        if (fx.page) aplicarPagina(fx.page(p));
        if (p < 1) raf = requestAnimationFrame(passo); else { ctx.clearRect(0, 0, w, h); aplicarPagina(null); res(); }
      };
      raf = requestAnimationFrame(passo);
    });
  }
  function quadro(id, terror, p, ctx, w, h) { const fx = FX[id](w, h, terror); ctx.save(); fx.draw(ctx, p); ctx.restore(); }
  return { tocar, quadro, ids: Object.keys(FX) };
})();

function tocarCaminho(id) { Som.caminho(id); Efeitos.tocar(id); }
