// 22 efeitos de tela (+ 22 versões de terror). Cada efeito é uma função
// determinística do progresso p (0→1): fábrica(w,h,T) -> { dur, draw(c,p) }.
const TAU = Math.PI * 2;
// gerador pseudo-aleatório com semente: mesmos números a cada quadro
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const env = (p, a = 0.15, b = 0.7) => p < a ? p / a : p > b ? Math.max(0, (1 - p) / (1 - b)) : 1;
const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;

const FX = {
  // 1 Louco — chuva de cartas de tarô
  louco: (w, h, T) => { const R = rng(1), cs = Array.from({ length: 30 }, () => ({ x: R() * w, d: R() * 0.5, v: 0.7 + R() * 0.6, r: R() * TAU, s: (R() - .5) * 5, z: 0.7 + R() * 0.7 }));
    return { dur: 3200, draw(c, p) { cs.forEach(k => { const q = (p - k.d) / 0.55; if (q < 0 || q > 1.4) return;
      c.save(); c.translate(k.x + Math.sin(q * 5) * 30, -90 + q * (h + 200) * k.v); c.rotate(k.r + q * k.s); c.scale(k.z, k.z);
      c.globalAlpha = env(p, .1, .8);
      c.fillStyle = T ? '#14040a' : '#241c52'; c.strokeStyle = T ? '#c0182b' : '#e3c277'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-24, -38, 48, 76, 6); c.fill(); c.stroke();
      c.strokeStyle = c.fillStyle = T ? '#d4202f' : '#e3c277';
      if (T) { c.beginPath(); c.ellipse(0, 0, 14, 7, 0, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 3.5, 0, TAU); c.fill(); }
      else { c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 5 : 15, a = i * Math.PI / 4 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); }
      c.restore(); }); } }; },

  // 2 Erro — glitch
  erro: (w, h, T) => ({ dur: 2000, draw(c, p) { const R = rng(Math.floor(p * 28) + 7), e = env(p, .1, .75);
      for (let i = 0; i < 26 * e; i++) { const y = R() * h, hh = 4 + R() * 60, x = R() * w * .3, ww = w * (.2 + R() * .8);
        c.fillStyle = T ? (R() > .5 ? rgba(220, 20, 30, .5) : rgba(0, 0, 0, .8)) : (R() > .5 ? rgba(0, 255, 230, .35) : rgba(255, 0, 140, .35)); c.fillRect(x, y, ww, hh); }
      for (let i = 0; i < 160 * e; i++) { c.fillStyle = rgba(255, T ? 40 : 255, T ? 40 : 255, R() * .5); c.fillRect(R() * w, R() * h, 2 + R() * 14, 2); }
      c.fillStyle = rgba(0, 0, 0, .25 * e); for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
      if (R() > .45) { c.font = `bold ${60 + R() * 60}px monospace`; c.fillStyle = T ? '#e0202a' : '#6ff'; c.fillText(T ? 'ERR0R' : 'ERRO', R() * w * .7, h * (.2 + R() * .6)); } } }),

  // 3 Porta — uma porta se abre
  porta: (w, h, T) => ({ dur: 3200, draw(c, p) { const cx = w / 2, cy = h * .55, dw = Math.min(w * .22, 150), dh = dw * 2, o = Math.min(1, p / .55), e = env(p, .15, .8);
      c.globalAlpha = e; c.fillStyle = T ? '#050003' : '#1a1538'; c.beginPath(); c.moveTo(cx - dw, cy + dh * .5); c.lineTo(cx - dw, cy - dh * .2); c.arc(cx, cy - dh * .2, dw, Math.PI, 0); c.lineTo(cx + dw, cy + dh * .5); c.fill();
      const g = c.createRadialGradient(cx, cy, 5, cx, cy, dh * (.5 + o * 2.5)); g.addColorStop(0, T ? rgba(200, 10, 20, .8 * o) : rgba(255, 245, 200, .95 * o)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = T ? '#0a0206' : '#3a2f6e'; const pw = dw * (1 - o * .92); c.fillRect(cx - dw, cy - dh * .7, pw, dh * 1.2); c.fillRect(cx + dw - pw, cy - dh * .7, pw, dh * 1.2);
      if (T) { c.strokeStyle = '#7a0010'; for (let i = 0; i < 6; i++) { const x = cx - dw + (i + .5) * dw / 3; c.beginPath(); c.moveTo(x, cy + dh * .5); c.quadraticCurveTo(x + Math.sin(p * 9 + i) * 20, cy, x + 8 * Math.sin(i), cy - dh * (.1 + o * .6)); c.lineWidth = 3; c.stroke(); } } } }),

  // 4 Visionário — olho e ondas psíquicas
  visionario: (w, h, T) => ({ dur: 3200, draw(c, p) { const cx = w / 2, cy = h / 2, e = env(p, .2, .75); c.globalAlpha = e;
      for (let i = 0; i < 6; i++) { const q = (p * 1.4 + i / 6) % 1; c.strokeStyle = T ? rgba(200, 20, 40, (1 - q) * .6) : rgba(190, 140, 255, (1 - q) * .6); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, q * Math.max(w, h) * .6, 0, TAU); c.stroke(); }
      const S = Math.min(w, h) * .22, open = Math.min(1, p / .3) * (p > .85 ? (1 - p) / .15 : 1);
      c.fillStyle = T ? '#fff0f0' : '#f4eaff'; c.beginPath(); c.moveTo(cx - S, cy); c.quadraticCurveTo(cx, cy - S * .85 * open, cx + S, cy); c.quadraticCurveTo(cx, cy + S * .85 * open, cx - S, cy); c.fill();
      c.fillStyle = T ? '#8a0010' : '#6a40d8'; c.beginPath(); c.arc(cx, cy, S * .36 * open, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(cx, cy, S * .16 * open, 0, TAU); c.fill();
      if (T) { c.strokeStyle = 'rgba(160,0,10,.8)'; c.lineWidth = 1.5; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; c.beginPath(); c.moveTo(cx + Math.cos(a) * S * .95, cy + Math.sin(a) * S * .5 * open); c.lineTo(cx + Math.cos(a) * S * .45, cy + Math.sin(a) * S * .2 * open); c.stroke(); } } } }),

  // 5 Sol — raios de luz / eclipse
  sol: (w, h, T) => ({ dur: 3000, draw(c, p) { const cx = w / 2, cy = h * .45, e = env(p, .2, .7), L = Math.max(w, h);
      if (!T) { const g = c.createRadialGradient(cx, cy, 0, cx, cy, L * .7); g.addColorStop(0, rgba(255, 240, 170, .9 * e)); g.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
      c.save(); c.translate(cx, cy); c.rotate(p * 1.2); const n = 18;
      for (let i = 0; i < n; i++) { c.rotate(TAU / n); c.fillStyle = T ? rgba(190, 10, 20, .5 * e) : rgba(255, 215, 90, .5 * e); c.beginPath(); c.moveTo(0, 0); c.lineTo(L, -L * (T ? .012 : .045)); c.lineTo(L, L * (T ? .012 : .045)); c.fill(); } c.restore();
      c.fillStyle = T ? '#000' : '#fff3b8'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * .11 * Math.min(1, p / .3), 0, TAU); c.fill();
      if (T) { c.strokeStyle = rgba(255, 40, 30, .9 * e); c.lineWidth = 4; c.stroke(); } } }),

  // 6 Tirano — relâmpagos
  tirano: (w, h, T) => ({ dur: 2600, draw(c, p) { const f = Math.floor(p * 14), R = rng(f + 3), on = (f % 3 !== 2) && p < .9;
      if (on && R() > .35) { c.fillStyle = T ? rgba(90, 0, 10, .35) : rgba(200, 220, 255, .3); c.fillRect(0, 0, w, h);
        for (let b = 0; b < 2; b++) { let x = R() * w, y = 0; c.strokeStyle = T ? '#ff2a38' : '#d8ecff'; c.shadowColor = T ? '#f00' : '#7ab8ff'; c.shadowBlur = 24; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y);
          while (y < h) { y += 30 + R() * 50; x += (R() - .5) * 110; c.lineTo(x, y); if (R() > .8) { c.moveTo(x, y); c.lineTo(x + (R() - .5) * 200, y + 70); c.moveTo(x, y); } } c.stroke(); c.shadowBlur = 0; } } } }),

  // 7 Torre Branca — chuva de runas
  torre: (w, h, T) => { const R = rng(5), cols = Array.from({ length: Math.ceil(w / 26) }, (_, i) => ({ x: i * 26 + 8, v: .5 + R(), o: R() * .5, g: Array.from({ length: 30 }, () => 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ01'[Math.floor(R() * 25)]) }));
    return { dur: 3200, draw(c, p) { c.font = '18px monospace'; cols.forEach(k => { const hd = (p * k.v * 1.6 + k.o) % 1.4 * (h + 400) - 200;
      for (let j = 0; j < 14; j++) { const y = hd - j * 22; if (y < -20 || y > h) continue; c.fillStyle = T ? rgba(230, 30, 40, (1 - j / 14) * env(p)) : rgba(j ? 190 : 255, j ? 220 : 255, 255, (1 - j / 14) * env(p)); c.fillText(k.g[(j + Math.floor(p * 20)) % 30], k.x, y); } }); } }; },

  // 8 Enforcado — fios e laços
  enforcado: (w, h, T) => { const R = rng(8), ls = Array.from({ length: 14 }, () => ({ x: R() * w, l: .3 + R() * .5, d: R() * .3, f: 1 + R() * 2 }));
    return { dur: 3200, draw(c, p) { ls.forEach(k => { const q = Math.min(1, Math.max(0, (p - k.d) / .3)), len = h * k.l * q, sw = Math.sin(p * 5 * k.f) * 18; c.globalAlpha = env(p, .1, .8);
      c.strokeStyle = T ? '#8a1020' : '#c9b8e8'; c.lineWidth = 2; c.beginPath(); c.moveTo(k.x, 0); c.quadraticCurveTo(k.x + sw * .3, len / 2, k.x + sw, len); c.stroke();
      c.beginPath(); c.ellipse(k.x + sw, len + 16, 14, 18, 0, 0, TAU); c.stroke();
      if (T) { c.fillStyle = '#b3101e'; for (let i = 0; i < 3; i++) { const y = len + 30 + ((p * 300 + i * 60) % 160); c.beginPath(); c.ellipse(k.x + sw, y, 3, 6, 0, 0, TAU); c.fill(); } } }); } }; },

  // 9 Escuridão — a noite se fecha
  escuridao: (w, h, T) => { const R = rng(9), st = Array.from({ length: 40 }, () => ({ x: R() * w, y: R() * h, f: 1 + R() * 3, o: R() * TAU }));
    return { dur: 3400, draw(c, p) { const e = env(p, .35, .7), cx = w / 2, cy = h / 2, g = c.createRadialGradient(cx, cy, Math.min(w, h) * (.55 - e * .45), cx, cy, Math.max(w, h) * .75);
      g.addColorStop(0, 'rgba(0,0,5,0)'); g.addColorStop(1, `rgba(2,0,10,${.97 * e})`); c.fillStyle = g; c.fillRect(0, 0, w, h);
      st.forEach(s => { const a = (Math.sin(p * 10 * s.f + s.o) * .5 + .5) * e; if (T) { if (a > .7) { c.fillStyle = rgba(230, 20, 30, a); c.beginPath(); c.ellipse(s.x, s.y, 7, 3, 0, 0, TAU); c.ellipse(s.x + 22, s.y, 7, 3, 0, 0, TAU); c.fill(); } }
        else { c.fillStyle = rgba(170, 150, 255, a); c.beginPath(); c.arc(s.x, s.y, 2.2, 0, TAU); c.fill(); } }); } }; },

  // 10 Morte — almas / caveiras
  morte: (w, h, T) => { const R = rng(10), ws = Array.from({ length: 22 }, () => ({ x: R() * w, d: R() * .4, v: .5 + R() * .6, s: 14 + R() * 26 }));
    return { dur: 3400, draw(c, p) { ws.forEach(k => { const q = (p - k.d) * k.v * 1.5; if (q < 0 || q > 1.2) return; const x = k.x + Math.sin(q * 6 + k.x) * 25, y = h - q * (h + 120), a = env(p, .1, .8) * (1 - q / 1.2);
      if (T) { c.fillStyle = rgba(190, 210, 190, a * .8); c.beginPath(); c.arc(x, y, k.s * .6, 0, TAU); c.fill(); c.fillRect(x - k.s * .35, y + k.s * .4, k.s * .7, k.s * .35); c.fillStyle = '#020'; c.beginPath(); c.arc(x - k.s * .22, y - 2, k.s * .13, 0, TAU); c.arc(x + k.s * .22, y - 2, k.s * .13, 0, TAU); c.fill(); }
      else { const g = c.createRadialGradient(x, y, 0, x, y, k.s * 1.5); g.addColorStop(0, rgba(200, 255, 220, a * .9)); g.addColorStop(1, 'rgba(120,255,200,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, k.s * 1.5, 0, TAU); c.fill(); } }); } }; },

  // 11 Gigante — rachaduras de impacto
  gigante: (w, h, T) => { const R = rng(11), cx = w / 2, cy = h * .6, ls = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU + R() * .4, pts = [[cx, cy]]; let x = cx, y = cy, ang = a; for (let s = 0; s < 14; s++) { ang += (R() - .5) * .7; const l = 40 + R() * 70; x += Math.cos(ang) * l; y += Math.sin(ang) * l; pts.push([x, y]); } return pts; });
    return { dur: 3000, draw(c, p) { const g = Math.min(1, p / .35), e = env(p, .05, .75); const sx = p < .15 ? (Math.random() - .5) * 14 * (1 - p / .15) : 0, sy = p < .15 ? (Math.random() - .5) * 14 : 0; c.save(); c.translate(sx, sy);
      c.strokeStyle = T ? rgba(200, 10, 20, e) : rgba(255, 170, 70, e); c.shadowColor = T ? '#f00' : '#ff9a30'; c.shadowBlur = 14; c.lineWidth = 3; c.lineJoin = 'round';
      ls.forEach(L => { const n = Math.floor(g * (L.length - 1)); c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (let i = 1; i <= n; i++) c.lineTo(L[i][0], L[i][1]); c.stroke(); });
      c.shadowBlur = 0; c.strokeStyle = rgba(255, 255, 255, (1 - p) * .6); c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, p * Math.max(w, h) * .7, 0, TAU); c.stroke(); c.restore(); } }; },

  // 12 Demonessa — pétalas
  demonessa: (w, h, T) => { const R = rng(12), ps = Array.from({ length: 46 }, () => ({ x: R() * w, d: R() * .5, v: .6 + R() * .6, r: R() * TAU, s: 8 + R() * 14, sw: R() * 3 }));
    return { dur: 3400, draw(c, p) { ps.forEach(k => { const q = (p - k.d) * k.v * 1.3; if (q < 0) return; const y = -30 + q * (h + 80); if (y > h + 40) return; c.save(); c.translate(k.x + Math.sin(q * 5 + k.sw) * 50, y); c.rotate(k.r + q * 4); c.globalAlpha = env(p, .08, .8);
      c.fillStyle = T ? (k.sw > 1.5 ? '#6b0a14' : '#18020a') : (k.sw > 1.5 ? '#ff7fb2' : '#d03a82'); c.beginPath(); c.ellipse(0, 0, k.s, k.s * .45, 0, 0, TAU); c.fill();
      if (T) { c.strokeStyle = '#d4202f'; c.lineWidth = 1; c.beginPath(); c.moveTo(-k.s, 0); c.lineTo(k.s, 0); c.stroke(); } c.restore(); }); } }; },

  // 13 Sacerdote Rubro — chamas e brasas
  sacerdote: (w, h, T) => { const R = rng(13), es = Array.from({ length: 90 }, () => ({ x: R() * w, d: R() * .5, v: .5 + R() * 1, s: 2 + R() * 4 }));
    return { dur: 3200, draw(c, p) { const e = env(p, .2, .75), g = c.createLinearGradient(0, h, 0, h * .4); g.addColorStop(0, T ? rgba(70, 0, 40, .85 * e) : rgba(255, 90, 20, .75 * e)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, h * .4, w, h * .6);
      es.forEach(k => { const q = (p - k.d) * k.v * 1.4; if (q < 0 || q > 1) return; const x = k.x + Math.sin(q * 9 + k.x) * 18, y = h - q * h * .95; c.fillStyle = T ? rgba(255, 30, 40, 1 - q) : rgba(255, 190 - q * 120, 40, 1 - q); c.beginPath(); c.arc(x, y, k.s * (1 - q * .5), 0, TAU); c.fill(); }); } }; },

  // 14 Eremita — círculo mágico
  eremita: (w, h, T) => ({ dur: 3400, draw(c, p) { const cx = w / 2, cy = h / 2, r = Math.min(w, h) * .32, g = Math.min(1, p / .45), e = env(p, .1, .75); c.globalAlpha = e; c.strokeStyle = c.fillStyle = T ? '#e0202e' : '#9ad0ff'; c.shadowColor = c.strokeStyle; c.shadowBlur = 14; c.lineWidth = 2.5;
      c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * g); c.stroke(); c.beginPath(); c.arc(cx, cy, r * .86, Math.PI / 2, Math.PI / 2 - TAU * g, true); c.stroke();
      c.save(); c.translate(cx, cy); c.rotate(p * (T ? -1.4 : 1.4)); for (let t = 0; t < 2; t++) { c.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + t * Math.PI; c.lineTo(Math.cos(a - Math.PI / 2) * r * .86 * g, Math.sin(a - Math.PI / 2) * r * .86 * g); } c.closePath(); c.stroke(); }
      for (let i = 0; i < 24; i++) { c.rotate(TAU / 24); c.fillRect(r * .93, -1.5, 8, 3); } c.restore(); c.shadowBlur = 0; } }),

  // 15 Paragono — engrenagens e vapor
  paragono: (w, h, T) => { const gs = [[.25, .6, 80, 1], [.45, .4, 110, -1], [.68, .62, 90, 1], [.82, .35, 60, -1], [.12, .25, 55, -1]];
    return { dur: 3200, draw(c, p) { const e = env(p, .15, .75); gs.forEach(([fx, fy, r, d], i) => { c.save(); c.translate(w * fx, h * fy); c.rotate(p * 3 * d + i); c.globalAlpha = e * .85; c.fillStyle = T ? '#3a1208' : '#b98a3c'; c.strokeStyle = T ? '#8a2410' : '#f3d99a'; c.lineWidth = 3;
      c.beginPath(); for (let t = 0; t < 14; t++) { const a = t / 14 * TAU, b = a + TAU / 28; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + .06) * (r + 14), Math.sin(a + .06) * (r + 14)); c.lineTo(Math.cos(b - .02) * (r + 14), Math.sin(b - .02) * (r + 14)); c.lineTo(Math.cos(b) * r, Math.sin(b) * r); } c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#0a0814'; c.beginPath(); c.arc(0, 0, r * .3, 0, TAU); c.fill(); c.restore(); });
      for (let i = 0; i < 14; i++) { const q = (p * 1.2 + i / 14) % 1; c.fillStyle = T ? rgba(220, 40, 30, (1 - q) * .3) : rgba(230, 230, 240, (1 - q) * .3); c.beginPath(); c.arc(w * (.15 + .7 * (i * .37 % 1)), h - q * h * .8, 20 + q * 50, 0, TAU); c.fill(); } } }; },

  // 16 Roda da Fortuna — roda e moedas
  roda: (w, h, T) => { const R = rng(16), cs = Array.from({ length: 24 }, () => ({ x: R() * w, d: R() * .5, v: .7 + R() * .6 }));
    return { dur: 3400, draw(c, p) { const cx = w / 2, cy = h / 2, r = Math.min(w, h) * .26, e = env(p, .15, .75), rot = (T ? -1 : 1) * (1 - Math.pow(1 - p, 3)) * 14; c.save(); c.translate(cx, cy); c.rotate(rot); c.globalAlpha = e; c.strokeStyle = T ? '#8a1020' : '#f0c15a'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * .75, 0, TAU); c.stroke();
      for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(r, 0); c.stroke(); c.fillStyle = T ? '#d4202f' : '#ffd66b'; if (T) { c.beginPath(); c.arc(r * .87, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#000'; c.fillRect(r * .87 - 4, -2, 3, 3); c.fillRect(r * .87 + 1, -2, 3, 3); } else { c.beginPath(); c.arc(r, 0, 9, 0, TAU); c.fill(); } } c.restore();
      cs.forEach(k => { const q = (p - k.d) * k.v * 1.4; if (q < 0 || q > 1.1) return; c.fillStyle = T ? '#1a0508' : '#ffd24a'; c.strokeStyle = T ? '#c0182b' : '#a8741a'; c.beginPath(); c.ellipse(k.x, q * (h + 40) - 20, 10, 10 * Math.abs(Math.cos(q * 12 + k.x)), 0, 0, TAU); c.fill(); c.stroke(); }); } }; },

  // 17 Mãe — vinhas
  mae: (w, h, T) => { const R = rng(17), vs = Array.from({ length: 7 }, (_, i) => ({ x: (i + .5) * w / 7 + (R() - .5) * 40, a: R() * 3, hh: .45 + R() * .45 }));
    return { dur: 3400, draw(c, p) { const g = Math.min(1, p / .5), e = env(p, .05, .78); vs.forEach(v => { c.globalAlpha = e; c.strokeStyle = T ? '#2a0a10' : '#3fa65a'; c.lineWidth = 4; c.beginPath(); const n = 40 * g; for (let i = 0; i <= n; i++) { const t = i / 40, y = h - t * h * v.hh, x = v.x + Math.sin(t * 9 + v.a) * 26; i ? c.lineTo(x, y) : c.moveTo(x, y);
        if (i % 6 === 0 && i > 0) { c.save(); c.fillStyle = T ? '#7a0c18' : '#7ee08a'; c.translate(x, y); c.rotate(i % 12 ? .8 : -.8); if (T) { c.beginPath(); c.moveTo(0, 0); c.lineTo(14, -4); c.lineTo(0, 4); c.fill(); } else { c.beginPath(); c.ellipse(10, 0, 11, 5, 0, 0, TAU); c.fill(); } c.restore(); c.moveTo(x, y); } } c.stroke(); }); } }; },

  // 18 Lua — lua cheia / lua de sangue
  lua: (w, h, T) => ({ dur: 3600, draw(c, p) { const cx = w / 2, r = Math.min(w, h) * .16, cy = h * .85 - p * h * .55, e = env(p, .2, .75), col = T ? [200, 20, 30] : [225, 235, 255];
      const g = c.createRadialGradient(cx, cy, r * .6, cx, cy, r * 4.5); g.addColorStop(0, rgba(...col, .55 * e)); g.addColorStop(1, rgba(...col, 0)); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = T ? rgba(170, 10, 20, e) : rgba(240, 245, 255, e); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.fillStyle = rgba(0, 0, 0, .13 * e); [[-.3, -.2, .25], [.25, .1, .3], [-.1, .35, .18]].forEach(([a, b, s]) => { c.beginPath(); c.arc(cx + a * r, cy + b * r, s * r, 0, TAU); c.fill(); });
      for (let i = 0; i < 4; i++) { const q = (p * 1.2 + i / 4) % 1; c.strokeStyle = rgba(...col, (1 - q) * .4 * e); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r + q * r * 5, 0, TAU); c.stroke(); }
      if (T) { c.fillStyle = '#000'; for (let i = 0; i < 6; i++) { const q = (p * .9 + i * .17) % 1, x = q * w * 1.2 - 40, y = h * (.15 + .1 * i) + Math.sin(q * 14 + i) * 18, f = Math.sin(q * 40 + i) * 6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 14, y - 10 - f, x - 26, y); c.quadraticCurveTo(x - 14, y + 3, x, y); c.moveTo(x, y); c.quadraticCurveTo(x + 14, y - 10 - f, x + 26, y); c.quadraticCurveTo(x + 14, y + 3, x, y); c.fill(); } } } }),

  // 19 Abismo — vórtice
  abismo: (w, h, T) => ({ dur: 3400, draw(c, p) { const cx = w / 2, cy = h / 2, e = env(p, .25, .7), L = Math.max(w, h) * .75; c.save(); c.translate(cx, cy);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, L); g.addColorStop(0, rgba(0, 0, 0, .95 * e)); g.addColorStop(.5, T ? rgba(70, 0, 20, .55 * e) : rgba(40, 10, 90, .5 * e)); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, L, 0, TAU); c.fill();
      c.lineWidth = T ? 3 : 4; for (let a = 0; a < (T ? 9 : 5); a++) { c.strokeStyle = T ? rgba(220, 20, 40, .7 * e) : rgba(170, 120, 255, .55 * e); c.beginPath(); for (let t = 0; t < 1; t += .01) { const ang = t * 7 - p * 6 + a * TAU / (T ? 9 : 5), rr = t * L * (T ? 1 + Math.sin(t * 40 + p * 9) * .03 : 1); c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } c.stroke(); } c.restore(); } }),

  // 20 Acorrentado — correntes
  acorrentado: (w, h, T) => { const R = rng(20), ch = Array.from({ length: 7 }, () => ({ y: R() * h, l: R() > .5, d: R() * .25, a: (R() - .5) * .5 }));
    return { dur: 2800, draw(c, p) { const sx = p > .28 && p < .4 ? (Math.random() - .5) * 12 : 0; c.save(); c.translate(sx, 0); ch.forEach(k => { const q = Math.min(1, Math.max(0, (p - k.d) / .25)), len = w * .55 * q, e = env(p, .02, .8); c.globalAlpha = e; c.strokeStyle = T ? '#7a2018' : '#b8bfd0'; c.lineWidth = 4;
        for (let i = 0; i * 26 < len; i++) { const x = k.l ? i * 26 : w - i * 26, y = k.y + (x - (k.l ? 0 : w)) * k.a; c.beginPath(); if (i % 2) c.ellipse(x, y, 12, 6, 0, 0, TAU); else c.ellipse(x, y, 5, 11, 0, 0, TAU); c.stroke(); }
        if (T) { c.fillStyle = '#a0101c'; for (let i = 0; i < 3; i++) c.fillRect((k.l ? len : w - len) - 2 + i * 8 * (k.l ? -1 : 1), k.y + 8, 3, 10 + (p * 100 + i * 30) % 60); } }); c.restore(); } }; },

  // 21 Imperador Negro — estilhaços e coroa
  imperador: (w, h, T) => { const R = rng(21), sh = Array.from({ length: 50 }, () => ({ x: R() * w, d: R() * .5, v: .6 + R() * .8, r: R() * TAU, s: 8 + R() * 16 }));
    return { dur: 3200, draw(c, p) { const e = env(p, .1, .78);
      sh.forEach(k => { const q = (p - k.d) * k.v * 1.4; if (q < 0) return; const y = -30 + q * (h + 60); if (y > h + 30) return; c.save(); c.translate(k.x, y); c.rotate(k.r + q * 3); c.globalAlpha = e; c.fillStyle = T ? '#a50d1f' : '#e8c060'; c.beginPath(); c.moveTo(0, -k.s); c.lineTo(k.s * .5, 0); c.lineTo(0, k.s * 1.2); c.lineTo(-k.s * .5, 0); c.fill(); c.restore(); });
      const cx = w / 2, cy = h / 2, s = Math.min(w, h) * .13 * Math.min(1, p / .3); c.globalAlpha = e; c.fillStyle = T ? '#14040a' : '#f0d070'; c.strokeStyle = T ? '#d4202f' : '#7a5a10'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(cx - s, cy + s * .6); c.lineTo(cx - s * 1.1, cy - s * .7); c.lineTo(cx - s * .5, cy - s * .1); c.lineTo(cx, cy - s); c.lineTo(cx + s * .5, cy - s * .1); c.lineTo(cx + s * 1.1, cy - s * .7); c.lineTo(cx + s, cy + s * .6); c.closePath(); c.fill(); c.stroke();
      if (T) { c.strokeStyle = '#d4202f'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - s * .2, cy - s); c.lineTo(cx + s * .15, cy + s * .1); c.lineTo(cx - s * .1, cy + s * .6); c.stroke(); } } }; },

  // 22 Justiceiro — veredito
  justiceiro: (w, h, T) => ({ dur: 3000, draw(c, p) { const cx = w / 2, cy = h / 2, e = env(p, .05, .7);
      for (let i = 0; i < 3; i++) { const q = Math.max(0, p - i * .09) / .6; if (q > 1) continue; c.strokeStyle = T ? rgba(220, 20, 30, (1 - q) * .8) : rgba(255, 255, 255, (1 - q) * .8); c.lineWidth = 6 * (1 - q) + 1; c.beginPath(); c.arc(cx, cy, q * Math.max(w, h) * .6, 0, TAU); c.stroke(); }
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T ? rgba(200, 20, 30, .45 * e) : rgba(255, 255, 255, .5 * e)); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(cx - 60, 0, 120, h);
      const s = Math.min(w, h) * .12 * Math.min(1, p / .25); c.globalAlpha = e; c.strokeStyle = T ? '#ff3040' : '#fff'; c.lineWidth = 4; c.lineCap = 'round';
      if (T) { c.beginPath(); c.moveTo(cx - s, cy - s); c.lineTo(cx + s, cy + s); c.moveTo(cx + s, cy - s); c.lineTo(cx - s, cy + s); c.stroke(); }
      else { c.beginPath(); c.moveTo(cx, cy - s); c.lineTo(cx, cy + s); c.moveTo(cx - s, cy - s * .6); c.lineTo(cx + s, cy - s * .6); c.moveTo(cx - s, cy - s * .6); c.lineTo(cx - s * 1.2, cy + s * .1); c.lineTo(cx - s * .4, cy + s * .1); c.closePath(); c.moveTo(cx + s, cy - s * .6); c.lineTo(cx + s * 1.2, cy + s * .1); c.lineTo(cx + s * .4, cy + s * .1); c.closePath(); c.stroke(); } } }),
};

const Efeitos = (() => {
  let cv = null, raf = 0;
  function tela() {
    if (cv) return cv;
    cv = document.createElement('canvas'); cv.id = 'fx-canvas';
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60';
    document.body.appendChild(cv); return cv;
  }
  function tocar(id, terror = Som.terror) {
    const fab = FX[id]; if (!fab) return Promise.resolve();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    cancelAnimationFrame(raf);
    const c = tela(), w = cv.width = innerWidth, h = cv.height = innerHeight, ctx = c.getContext('2d'), fx = fab(w, h, terror), t0 = performance.now();
    return new Promise(res => {
      const passo = now => {
        const p = Math.min(1, (now - t0) / fx.dur);
        ctx.clearRect(0, 0, w, h); ctx.save(); ctx.globalAlpha = 1; fx.draw(ctx, p); ctx.restore();
        if (p < 1) raf = requestAnimationFrame(passo); else { ctx.clearRect(0, 0, w, h); res(); }
      };
      raf = requestAnimationFrame(passo);
    });
  }
  // desenha um único quadro (para testes/prévias)
  function quadro(id, terror, p, ctx, w, h) { const fx = FX[id](w, h, terror); ctx.save(); fx.draw(ctx, p); ctx.restore(); }
  return { tocar, quadro, ids: Object.keys(FX) };
})();

// Toca som + efeito do Caminho (versão de terror se o modo estiver ativo)
function tocarCaminho(id) { Som.caminho(id); Efeitos.tocar(id); }
