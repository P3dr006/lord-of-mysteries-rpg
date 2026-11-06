// Sons 100% sintetizados no navegador (Web Audio) — nenhum arquivo de áudio.
const Som = (() => {
  let ctx = null, master = null, pm = 1, noiseBuf = null, amb = null, saida = null;
  let mudo = false, terror = false, vol = 1, uiSons = true;
  try {
    mudo = localStorage.getItem('lotm-mudo') === '1'; terror = localStorage.getItem('lotm-terror') === '1';
    const v = parseFloat(localStorage.getItem('lotm-vol')); if (Number.isFinite(v)) vol = Math.max(0, Math.min(1, v));
    uiSons = localStorage.getItem('lotm-ui') !== '0';
  } catch (e) {}
  // Ganho de cada som, obtido por medição (tools/medir-som.js): todos chegam ao mesmo volume percebido.
  // Chave: <n|t>:<nome> (n = normal, t = Terror). Sem entrada = 1.
  const GANHOS = {};
  Object.assign(GANHOS, /*medido*/{ "n:c:louco": 0.45, "n:c:porta": 0.848, "n:c:visionario": 0.539, "n:c:erro": 1.514, "n:c:torre": 1.756, "n:c:sol": 0.5, "n:c:enforcado": 0.6, "n:c:tirano": 0.399, "n:c:gigante": 0.36, "n:c:escuridao": 0.197, "n:c:morte": 0.238, "n:c:demonessa": 0.555, "n:c:sacerdote": 0.951, "n:c:paragono": 1.249, "n:c:eremita": 0.367, "n:c:mae": 0.617, "n:c:lua": 0.594, "n:c:abismo": 0.937, "n:c:roda": 1.323, "n:c:acorrentado": 3.6, "n:c:imperador": 0.372, "n:c:justiceiro": 0.376, "n:asc": 0.395, "n:selar": 0.272, "n:falha": 0.823, "n:crit": 0.38, "n:res": 1.981, "n:conf": 0.579, "n:carta": 0.694, "n:dado": 2.452, "n:dig": 0.738, "n:click": 2.666, "n:tick": 3.98, "t:c:louco": 0.344, "t:c:porta": 0.443, "t:c:erro": 0.484, "t:c:tirano": 0.341, "t:c:visionario": 0.384, "t:c:sol": 0.369, "t:c:torre": 0.485, "t:c:escuridao": 0.177, "t:c:gigante": 0.308, "t:c:enforcado": 0.418, "t:c:morte": 0.203, "t:c:demonessa": 0.384, "t:c:eremita": 0.3, "t:c:sacerdote": 0.448, "t:c:roda": 0.48, "t:c:paragono": 0.469, "t:c:mae": 0.396, "t:c:acorrentado": 0.476, "t:c:lua": 0.382, "t:c:abismo": 0.491, "t:c:justiceiro": 0.309, "t:c:imperador": 0.318, "t:selar": 0.285, "t:falha": 0.823, "t:asc": 0.421, "t:crit": 0.38, "t:res": 1.981, "t:conf": 0.579, "t:carta": 0.694, "t:dado": 2.452, "t:dig": 0.738, "t:click": 2.666, "t:amb": 0.064, "t:tick": 3.955, "t:bat": 1.287, "t:camada": 0.264 }/*fim*/);
  const ganho = ch => (typeof GANHOS[ch] === 'number' ? GANHOS[ch] : 1);
  // curva perceptual: o controle de 0–100% vira ganho ao quadrado (50% ≈ −12 dB), 100% = nível original
  const alvoMaster = () => (mudo ? 0 : 0.75 * vol * vol);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = alvoMaster();
    // limitador: corta só os picos (inclusive quando vários sons tocam ao mesmo tempo), sem escurecer o som
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 4; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const T0 = (dt = 0) => ctx.currentTime + 0.02 + dt;

  // oscilador com envelope; o = { slide, attack, detune, lp, vib, pan }
  function osc(type, f, t0, dur, vol = 0.2, o = {}) {
    const os = ctx.createOscillator(), g = ctx.createGain();
    const fr = f * pm; os.type = type; os.frequency.setValueAtTime(fr, t0);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide * pm), t0 + dur);
    if (o.detune) os.detune.value = o.detune;
    const a = o.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out = g;
    os.connect(g);
    if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; g.connect(f2); out = f2; }
    if (o.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; out.connect(p); out = p; }
    out.connect(saida || master);
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib; lg.gain.value = fr * 0.025; l.connect(lg); lg.connect(os.frequency);
      l.start(t0); l.stop(t0 + dur + 0.1);
    }
    os.start(t0); os.stop(t0 + dur + 0.05);
  }
  // ruído filtrado; o = { type, f, q, slide, attack }
  function ruido(t0, dur, vol = 0.2, o = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime((o.f || 1000) * pm, t0); f.Q.value = o.q || 1;
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.slide * pm), t0 + dur);
    const g = ctx.createGain(); const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(saida || master);
    s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  const sino = (f, t0, vol = 0.14, dur = 2.2) =>
    [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.93, 0.15]].forEach(([m, a]) => osc('sine', f * m, t0, dur / (m > 2 ? 1.8 : 1), vol * a));
  const acorde = (fs, t0, dur, vol, type = 'triangle', o = {}) => fs.forEach((f, i) => osc(type, f, t0, dur, vol / fs.length * 1.6, { attack: 0.15, detune: (i - 1) * 6, ...o }));
  const bumbo = (t0, vol = 0.5, f = 110) => { osc('sine', f, t0, 0.35, vol, { slide: 38 }); ruido(t0, 0.08, vol * 0.3, { f: 900 }); };

  // ---------- 22 trilhas, uma por Caminho ----------
  const TEMAS = {
    louco:      t => { [523, 659, 784, 1047, 1319].forEach((f, i) => sino(f, t + i * 0.16, 0.12, 2.6)); },
    erro:       t => { for (let i = 0; i < 24; i++) { osc('square', 200 + Math.random() * 2200, t + i * 0.05, 0.05, 0.1, { pan: Math.random() * 2 - 1 }); if (i % 3 == 0) ruido(t + i * 0.05, 0.04, 0.15, { type: 'highpass', f: 4000 }); } },
    porta:      t => { osc('sawtooth', 90, t, 1.1, 0.12, { slide: 160, vib: 7, lp: 700 }); osc('sawtooth', 160, t + 0.7, 0.8, 0.1, { slide: 70, lp: 600 }); bumbo(t + 1.5, 0.5, 70); },
    visionario: t => { acorde([261, 329, 392, 493], t, 3, 0.25, 'sine', { vib: 5 }); [1047, 1319, 1568].forEach((f, i) => osc('sine', f, t + 0.4 + i * 0.3, 1.6, 0.05, { vib: 6 })); },
    sol:        t => { acorde([392, 494, 587, 784], t, 2.6, 0.32, 'triangle'); sino(1568, t + 0.1, 0.1, 2.5); sino(2093, t + 0.35, 0.07, 2); },
    tirano:     t => { ruido(t, 2.4, 0.45, { f: 500, slide: 70, attack: 0.02 }); ruido(t, 0.12, 0.5, { type: 'highpass', f: 2500 }); osc('sine', 48, t, 2.4, 0.4, { slide: 30 }); },
    torre:      t => { [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => osc('square', f, t + i * 0.08, 0.22, 0.07, { lp: 2400 })); },
    enforcado:  t => { acorde([110, 116.5, 165], t, 2.8, 0.3, 'sawtooth', { lp: 500, vib: 3 }); ruido(t, 2.6, 0.06, { type: 'bandpass', f: 1800, q: 6, slide: 900 }); },
    escuridao:  t => { osc('sine', 55, t, 3, 0.4, { attack: 0.8 }); osc('sine', 82.4, t, 3, 0.2, { attack: 1 }); bumbo(t + 0.6, 0.3, 70); bumbo(t + 0.85, 0.22, 65); bumbo(t + 1.6, 0.3, 70); bumbo(t + 1.85, 0.22, 65); },
    morte:      t => { sino(98, t, 0.4, 4); sino(98.5, t + 0.02, 0.25, 4); ruido(t, 3, 0.04, { type: 'bandpass', f: 400, q: 3 }); },
    gigante:    t => { bumbo(t, 0.6, 90); bumbo(t + 0.5, 0.6, 90); bumbo(t + 1, 0.7, 80); osc('sawtooth', 110, t + 0.2, 1.8, 0.12, { lp: 450, attack: 0.3 }); osc('sawtooth', 165, t + 0.2, 1.8, 0.08, { lp: 450, attack: 0.3 }); },
    demonessa:  t => { [440, 523, 622, 698, 880, 1047].forEach((f, i) => { sino(f, t + i * 0.11, 0.09, 2); osc('sine', f * 1.007, t + i * 0.11, 1.4, 0.05); }); },
    sacerdote:  t => { for (let i = 0; i < 28; i++) ruido(t + Math.random() * 1.8, 0.03 + Math.random() * 0.04, 0.2, { type: 'highpass', f: 2500 + Math.random() * 3000 }); osc('sawtooth', 147, t, 1.9, 0.14, { lp: 700, attack: 0.25, slide: 165 }); },
    eremita:    t => { [220, 330, 440, 660].forEach((f, i) => { osc('sine', f, t, 3.5, 0.13, { attack: 0.05 }); osc('sine', f + 1.5 + i, t, 3.5, 0.1, { attack: 0.05 }); }); },
    paragono:   t => { for (let i = 0; i < 12; i++) { osc('square', i % 2 ? 900 : 700, t + i * 0.09, 0.03, 0.1); } ruido(t + 0.4, 1.2, 0.1, { type: 'highpass', f: 5000, attack: 0.3 }); osc('triangle', 220, t, 1, 0.08, { slide: 440 }); },
    roda:       t => { for (let i = 0; i < 9; i++) { const x = t + i * i * 0.022 + i * 0.07; osc('square', 1800, x, 0.02, 0.1); } for (let i = 0; i < 5; i++) sino(2400 + Math.random() * 1500, t + 1 + i * 0.12, 0.06, 0.9); },
    mae:        t => { [392, 440, 523, 440, 392, 330].forEach((f, i) => osc('sine', f, t + i * 0.32, 0.9, 0.16, { attack: 0.08, vib: 5 })); ruido(t, 2.2, 0.03, { type: 'bandpass', f: 600, q: 2 }); },
    lua:        t => { [1046, 1318, 1568, 2093].forEach((f, i) => sino(f, t + i * 0.35, 0.07, 3.5)); osc('sine', 330, t + 0.2, 2.2, 0.1, { slide: 495, vib: 6, attack: 0.9 }); },
    abismo:     t => { osc('sawtooth', 300, t, 2.4, 0.14, { slide: 40, lp: 800 }); ruido(t, 2.4, 0.15, { f: 900, slide: 60 }); osc('square', 60, t, 2.4, 0.1, { vib: 18, lp: 300 }); },
    acorrentado:t => { for (let i = 0; i < 18; i++) { ruido(t + i * 0.07 + Math.random() * .03, 0.09, 0.22, { type: 'bandpass', f: 2800 + Math.random() * 2500, q: 8 }); } osc('square', 120, t + 0.8, 0.25, 0.16, { slide: 60, lp: 600 }); ruido(t + 0.8, 0.12, 0.3, { type: 'highpass', f: 1500 }); },
    imperador:  t => { acorde([196, 247, 294], t, 1.1, 0.4, 'sawtooth', { lp: 1200 }); acorde([262, 330, 392, 523], t + 0.45, 2, 0.45, 'sawtooth', { lp: 1500 }); bumbo(t + 0.45, 0.4, 70); },
    justiceiro: t => { ruido(t, 0.1, 0.6, { f: 1800 }); osc('sine', 90, t, 0.4, 0.6, { slide: 40 }); sino(880, t + 0.2, 0.25, 3); sino(1320, t + 0.25, 0.12, 3); },
  };

  // camada de terror: dissonância (trítono), sussurros e batimentos
  function camadaTerror(t) {
    osc('sawtooth', 58, t, 3, 0.16, { lp: 380, attack: 0.5, vib: 4 });
    osc('sawtooth', 82, t, 3, 0.12, { lp: 380, attack: 0.5 });
    osc('sine', 1760, t + 0.4, 2.4, 0.03, { slide: 1660, vib: 9 });
    for (let k = 0; k < 4; k++) ruido(t + 0.3 + k * 0.55, 0.45, 0.06, { type: 'bandpass', f: 2600, q: 9, slide: 1700, attack: 0.2 });
    bumbo(t + 0.2, 0.28, 58); bumbo(t + 0.46, 0.2, 52); bumbo(t + 1.3, 0.28, 58); bumbo(t + 1.56, 0.2, 52);
  }

  const modo = () => (terror ? 't' : 'n');
  // roda um som num barramento próprio, com o ganho medido para ele; tudo o que ele agenda passa por ali
  const comBus = (chave, fn) => (...a) => {
    if (mudo || !init()) return;
    const b = ctx.createGain(); b.gain.value = ganho(chave(...a)); b.connect(master); saida = b;
    try { fn(...a); } finally { saida = null; pm = 1; }
  };
  const caminho = comBus(id => `${modo()}:c:${id}`, id => {
    pm = terror ? 0.72 : 1;
    const t = T0(), f = TEMAS[id];
    if (f) f(t);
    if (terror) camadaTerror(t);
  });
  const ok = () => !mudo && init();
  const _click = () => { if (!ok()) return; pm = terror ? 0.8 : 1; osc('sine', 700, T0(), 0.07, 0.1, { slide: 420 }); pm = 1; };
  const _tick = () => { if (!ok()) return; osc('square', terror ? 520 : 900 + Math.random() * 200, T0(), 0.025, 0.05); };
  const _dado = () => { if (!ok()) return; const t = T0(); for (let i = 0; i < 14; i++) ruido(t + i * (0.04 + i * 0.012), 0.03, 0.18, { type: 'bandpass', f: 1500 + Math.random() * 2500, q: 3 }); osc('triangle', 220, t + 0.95, 0.12, 0.12, { slide: 140 }); };
  const _carta = () => { if (!ok()) return; const t = T0(); ruido(t, 0.18, 0.16, { type: 'highpass', f: 3000, attack: 0.04 }); sino(terror ? 440 : 880, t + 0.2, 0.1, 1.6); };
  const _digerir = n => { if (!ok()) return; pm = terror ? 0.8 : 1; sino(NOTAS[Math.min(9, Math.max(0, n))], T0(), 0.1, 1.4); pm = 1; };
  const NOTAS = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319];
  const _ascender = (k, sombrio) => { if (!ok()) return; pm = sombrio ? 0.74 : 1; const t = T0(), base = [262, 294, 330, 392, 440, 523, 660][Math.min(k, 6)];
    osc('sawtooth', 70, t, 2.2, 0.14, { slide: base * 1.5, lp: 1400, attack: 0.9 });
    ruido(t, 2, 0.12, { type: 'bandpass', f: 400, slide: 5000, q: 2, attack: 0.9 });
    for (let i = 0; i <= Math.min(k, 5); i++) bumbo(t + 1.7 + i * 0.12, 0.28 + i * 0.05, 80 - i * 6);
    acorde([base, base * 1.25, base * 1.5, base * 2], t + 1.9, 3.4 + k * 0.3, 0.4, sombrio ? 'sawtooth' : 'triangle', sombrio ? { lp: 900 } : {});
    [2, 3, 4, 5, 6].slice(0, 2 + k).forEach((m, i) => sino(base * m, t + 2 + i * 0.2, 0.09, 3));
    if (sombrio) { osc('sawtooth', base * 0.5 * 1.414, t + 1.9, 3, 0.1, { lp: 500 }); for (let i = 0; i < 3; i++) ruido(t + 2 + i * .6, .5, .06, { type: 'bandpass', f: 2400, q: 9, slide: 1500 }); }
    pm = 1; };
  const _selar = () => { if (!ok()) return; pm = terror ? 0.78 : 1; const t = T0();
    osc('sine', 110, t, 1.2, 0.18, { slide: 330, attack: 0.5 });
    ruido(t, 0.9, 0.08, { type: 'bandpass', f: 600, slide: 4200, q: 3, attack: 0.5 });
    [392, 494, 587, 784].forEach((f, i) => sino(f, t + 0.55 + i * 0.09, 0.1, 2.4));
    bumbo(t + 0.5, 0.35, 90); acorde([196, 294, 392], t + 0.55, 2.2, 0.28, terror ? 'sawtooth' : 'triangle', terror ? { lp: 800 } : {}); pm = 1; };
  const _resultado = () => { if (!ok()) return; pm = terror ? 0.8 : 1; const t = T0(); osc('triangle', 784, t, 0.18, 0.12); osc('triangle', 1047, t + 0.09, 0.3, 0.1); pm = 1; };
  const _critico = () => { if (!ok()) return; pm = terror ? 0.8 : 1; const t = T0(); [523, 659, 784, 1047, 1319].forEach((f, i) => sino(f, t + i * 0.08, 0.12, 2.2)); acorde([262, 330, 392], t, 1.6, 0.3); bumbo(t, 0.3, 100); pm = 1; };
  const _falha = () => { if (!ok()) return; pm = 1; const t = T0(); osc('sawtooth', 160, t, 0.9, 0.18, { slide: 45, lp: 700 }); osc('sawtooth', 169, t, 0.9, 0.12, { slide: 48, lp: 700 }); ruido(t, 0.5, 0.2, { f: 700, slide: 80 }); bumbo(t + 0.05, 0.5, 60); ruido(t + 0.3, 0.6, 0.05, { type: 'bandpass', f: 2200, q: 9, slide: 1300 }); };
  const _confirmar = () => { if (!ok()) return; const t = T0(); [523, 784].forEach((f, i) => sino(f, t + i * 0.12, 0.1, 1.5)); };

  const click = (...a) => { if (uiSons) comBus(() => modo() + ':click', _click)(...a); };
  const tick = (...a) => { if (uiSons) comBus(() => modo() + ':tick', _tick)(...a); };
  const dado = comBus(() => modo() + ':dado', _dado), carta = comBus(() => modo() + ':carta', _carta), digerir = comBus(() => modo() + ':dig', _digerir);
  const ascender = comBus((k, sombrio) => (sombrio ? 't' : 'n') + ':asc', _ascender), selar = comBus(() => modo() + ':selar', _selar);
  const resultado = comBus(() => modo() + ':res', _resultado), critico = comBus(() => modo() + ':crit', _critico), falha = comBus(() => modo() + ':falha', _falha), confirmar = comBus(() => modo() + ':conf', _confirmar);
  const camadaTerrorSolta = comBus(() => 't:camada', () => { pm = 0.7; camadaTerror(T0()); });

  const batida = comBus(() => 't:bat', () => { const t = T0(); pm = 1; osc('sine', 60, t, 0.28, 0.16, { slide: 35 }); osc('sine', 55, t + 0.22, 0.28, 0.11, { slide: 33 }); });

  // ambiente do modo Terror: zumbido grave + batimento cardíaco
  let batTimer = null;
  function ambienteTerror(ligar) {
    if (batTimer) { clearInterval(batTimer); batTimer = null; }
    if (amb) { try { amb.g.gain.setTargetAtTime(0, ctx.currentTime, .4); setTimeout(() => { amb.a.stop(); amb.b.stop(); amb = null; }, 1500); } catch (e) {} }
    if (!ligar || mudo || !init()) return;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain();
    a.type = b.type = 'sine'; a.frequency.value = 43; b.frequency.value = 45.5; g.gain.value = 0;
    g.gain.setTargetAtTime(0.09 * ganho('t:amb'), ctx.currentTime, 1.2);
    a.connect(g); b.connect(g); g.connect(master); a.start(); b.start(); amb = { a, b, g };
    iniciarBatida();
  }
  function iniciarBatida() {
    if (batTimer) clearInterval(batTimer);
    batTimer = setInterval(() => { if (mudo || !ctx || document.hidden) return; batida(); }, 1700);
  }
  // com a aba em segundo plano o áudio é suspenso (nada soa nem gasta processador) e volta ao reabrir
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { if (batTimer) { clearInterval(batTimer); batTimer = null; } ctx.suspend && ctx.suspend(); }
    else { ctx.resume && ctx.resume(); if (terror && !mudo && amb) iniciarBatida(); }
  });

  function setMudo(v) {
    mudo = v; try { localStorage.setItem('lotm-mudo', v ? '1' : '0'); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(alvoMaster(), ctx.currentTime, 0.05);
    if (v) ambienteTerror(false); else if (terror) ambienteTerror(true);
  }
  function setTerror(v) {
    terror = v; try { localStorage.setItem('lotm-terror', v ? '1' : '0'); } catch (e) {}
    ambienteTerror(v);
    if (v && !mudo && init()) camadaTerrorSolta();
  }
  function setVolume(v) {
    vol = Math.max(0, Math.min(1, Number(v) || 0)); try { localStorage.setItem('lotm-vol', String(vol)); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(alvoMaster(), ctx.currentTime, 0.03);
  }
  function setUi(v) { uiSons = !!v; try { localStorage.setItem('lotm-ui', uiSons ? '1' : '0'); } catch (e) {} }
  return {
    init, caminho, click, tick, dado, carta, confirmar, digerir, ascender, selar, resultado, critico, falha, setMudo, setTerror, ambienteTerror, setVolume, setUi, batida, ganhos: GANHOS, nivelMaster: () => alvoMaster(),
    get mudo() { return mudo; }, get terror() { return terror; }, get volume() { return vol; }, get uiSons() { return uiSons; },
    ids: Object.keys(TEMAS),
  };
})();
