// Dado 3D (CSS 3D + GSAP): d4, d6, d8, d12 e d20 que giram, quicam e pousam EXATAMENTE no número decidido.
// O número nunca nasce aqui: quem chama (Mesa.rolar) já recebeu ou sorteou o valor; o dado só anima até ele.
// É OPCIONAL: o GSAP é baixado sob demanda (versão fixa + hash de integridade). Sem rede, sem 3D ou com "reduzir
// movimento" ligado, suporta() devolve false e a mesa usa a animação 2D de sempre.
const Dado3D = Object.freeze((() => {
  const LADOS = [4, 6, 8, 12, 20];
  const PHI = (1 + Math.sqrt(5)) / 2;

  // ---------- vetores e quaternions (x, y, z, w) ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const comp = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => mul(a, 1 / comp(a));
  const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qEixo = (e, ang) => { const s = Math.sin(ang / 2); return [e[0] * s, e[1] * s, e[2] * s, Math.cos(ang / 2)]; };
  function qDeMatriz(m) {
    const t = m[0][0] + m[1][1] + m[2][2]; let x, y, z, w;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[2][1] - m[1][2]) / s; y = (m[0][2] - m[2][0]) / s; z = (m[1][0] - m[0][1]) / s; }
    else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; w = (m[2][1] - m[1][2]) / s; x = s / 4; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
    else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = s / 4; z = (m[1][2] + m[2][1]) / s; }
    else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = s / 4; }
    return [x, y, z, w];
  }
  // matriz de rotação 3x3 (linhas) a partir do quaternion
  function qParaMatriz(q) {
    const [x, y, z, w] = q;
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
  }
  const matrix3d = r => `matrix3d(${r[0][0]},${r[1][0]},${r[2][0]},0,${r[0][1]},${r[1][1]},${r[2][1]},0,${r[0][2]},${r[1][2]},${r[2][2]},0,0,0,0,1)`;
  const aplica = (r, v) => [dot(r[0], v), dot(r[1], v), dot(r[2], v)];

  // ---------- os cinco sólidos ----------
  // Cada sólido é dado por seus vértices e pelas normais das faces; a face é o conjunto de vértices mais próximos da normal.
  function pm(...t) {   // todas as variações de sinal dos componentes que não são zero
    let r = [[]];
    for (const c of t) r = r.flatMap(p => (c === 0 ? [[...p, 0]] : [[...p, c], [...p, -c]]));
    return r;
  }
  const ICOSA = [...pm(0, 1, PHI), ...pm(1, PHI, 0), ...pm(PHI, 0, 1)];
  // (a orientação importa: é a dual do ICOSA acima; cada vértice do icosaedro é o centro de uma face do dodecaedro)
  const DODECA = [...pm(1, 1, 1), ...pm(0, PHI, 1 / PHI), ...pm(1 / PHI, 0, PHI), ...pm(PHI, 1 / PHI, 0)];
  const FORMA = {
    4: { v: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], n: [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]] },
    6: { v: pm(1, 1, 1), n: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] },
    8: { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], n: pm(1, 1, 1) },
    12: { v: DODECA, n: ICOSA },
    20: { v: ICOSA, n: DODECA },
  };
  const cache = {};
  function solido(lados) {
    if (cache[lados]) return cache[lados];
    const { v, n } = FORMA[lados], raio = Math.max(...v.map(comp));
    const faces = n.map(nn => {
      const nu = unit(nn), mx = Math.max(...v.map(p => dot(p, nu)));
      let vs = v.filter(p => dot(p, nu) > mx - 1e-6);
      const c = mul(vs.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]), 1 / vs.length);
      const t0 = unit(sub(vs[0], c)), b0 = cross(nu, t0);
      vs = vs.map(p => ({ p, a: Math.atan2(dot(sub(p, c), b0), dot(sub(p, c), t0)) })).sort((a, b) => a.a - b.a).map(o => o.p);
      const y = mul(t0, -1), x = cross(y, nu);   // "para baixo" = oposto ao primeiro vértice; (x, y, nu) é uma base de mão direita
      return { n: nu, c, x, y, vs, perto: dot(c, nu) };
    });
    // numeração: faces opostas somam lados+1 (como num dado de verdade); o d4 não tem face oposta
    let prox = 1;
    const valor = new Array(faces.length).fill(0);
    faces.forEach((f, i) => {
      if (valor[i]) return;
      valor[i] = prox;
      if (lados !== 4) { const o = faces.findIndex((g, j) => j !== i && dot(g.n, f.n) < -0.999); valor[o] = lados + 1 - prox; }
      prox++;
    });
    faces.forEach((f, i) => { f.valor = valor[i]; });
    return (cache[lados] = { faces, raio });
  }

  // ---------- GSAP (carregador em js/animar.js) ----------
  const preparar = () => Animar.preparar();
  const pronto = ms => Animar.pronto(ms);
  const suporta = lados => LADOS.includes(lados) && Animar.pode()
    && typeof CSS === 'object' && CSS.supports && CSS.supports('transform-style', 'preserve-3d');

  // ---------- o dado ----------
  const SVG = 'http://www.w3.org/2000/svg';
  const LUZ = unit([-.45, -.75, .6]);
  // leve inclinação: dá para ver as faces vizinhas. No d20 as faces são pequenas (vizinhas a ~42°): a inclinação tem que ficar
  // abaixo da metade disso, senão uma face vizinha ficaria MAIS de frente que a sorteada e o número lido seria outro.
  const TILT = qMul(qEixo([1, 0, 0], -0.26), qEixo([0, 1, 0], 0.3));
  const TILT_D20 = qMul(qEixo([1, 0, 0], -0.1), qEixo([0, 1, 0], 0.12));
  const TAMANHO_TEXTO = { 4: 1.1, 6: 1.15, 8: 1.05, 12: 1.0, 20: 1.1 };

  function criar(lados, tam) {
    const { faces, raio } = solido(lados), k = (tam * 0.52) / raio;
    const el = document.createElement('div'); el.className = 'd3'; el.style.setProperty('--tam', tam + 'px');
    el.style.width = el.style.height = tam + 'px'; el.style.perspective = tam * 6 + 'px';
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', `d${lados}`);
    const sombra = document.createElement('div'); sombra.className = 'd3-sombra'; el.appendChild(sombra);
    const corpo = document.createElement('div'); corpo.className = 'd3-corpo'; el.appendChild(corpo);
    const pecas = faces.map(f => {
      const pts = f.vs.map(p => { const d = sub(p, f.c); return [dot(d, f.x) * k, dot(d, f.y) * k]; });
      const rf = Math.max(...pts.map(q => Math.hypot(q[0], q[1]))), sz = Math.ceil(rf * 2) + 4, m = sz / 2;
      const d = document.createElement('div'); d.className = 'd3-face';
      d.style.width = d.style.height = sz + 'px'; d.style.margin = `${-m}px 0 0 ${-m}px`;
      const t = mul(f.n, f.perto * k);
      d.style.transform = `matrix3d(${f.x[0]},${f.x[1]},${f.x[2]},0,${f.y[0]},${f.y[1]},${f.y[2]},0,${f.n[0]},${f.n[1]},${f.n[2]},0,${t[0]},${t[1]},${t[2]},1)`;
      const tamTxt = Math.round(rf * (TAMANHO_TEXTO[lados] || 1) * (f.vs.length === 3 ? .72 : f.vs.length === 4 ? .8 : .8));
      const marca = lados >= 8 && (f.valor === 6 || f.valor === 9) ? ' sub' : '';
      const pol = pts.map(q => `${(m + q[0]).toFixed(1)},${(m + q[1]).toFixed(1)}`).join(' ');
      d.innerHTML = `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" aria-hidden="true"><polygon class="d3-p" points="${pol}"/><polygon class="d3-s" points="${pol}"/><text class="d3-n${marca}" x="${m}" y="${m}" font-size="${tamTxt}" text-anchor="middle" dominant-baseline="central">${f.valor}</text></svg>`;
      corpo.appendChild(d);
      return { f, s: d.querySelector('.d3-s') };
    });

    const baseDe = valor => {
      const f = faces.find(x => x.valor === valor); if (!f) throw new Error('Esse dado não tem a face ' + valor);
      return qMul(lados === 20 ? TILT_D20 : TILT, qDeMatriz([f.x, f.y, f.n]));   // gira o sólido para a face "valor" ficar de frente para quem olha
    };
    // posição, giro, escala e sombras de cada face (a luz vem do alto à esquerda)
    function pintar(q, x, y, esc) {
      corpo.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${esc.toFixed(3)}) ${matrix3d(qParaMatriz(q))}`;
      const r = qParaMatriz(q);
      for (const p of pecas) { const b = dot(aplica(r, p.f.n), LUZ); p.s.setAttribute('fill-opacity', Math.min(.62, Math.max(0, .42 - .5 * b)).toFixed(2)); }
    }
    const frente = q => { const r = qParaMatriz(q); let m = null; for (const p of pecas) { const z = aplica(r, p.f.n)[2]; if (!m || z > m.z) m = { z, v: p.f.valor }; } return m.v; };
    let atual = baseDe(1);
    pintar(atual, 0, 0, 1);
    // quem lê a tela (leitor de tela, testes) vê o número final no próprio elemento
    const marcar = v => { el.dataset.valor = String(v); el.setAttribute('aria-label', `d${lados}: ${v}`); };

    return {
      el, lados,
      // pousa já, sem animar (usado pelos testes e como estado final)
      mostrar(valor) { atual = baseDe(valor); pintar(atual, 0, 0, 1); sombra.style.opacity = '.55'; marcar(valor); },
      faceDeFrente() { return frente(atual); },
      // gira e quica até o "valor"; devolve uma promessa que se cumpre quando o dado para
      rolar(valor, { atraso = 0, duracao = 1.35 } = {}) {
        const alvo = baseDe(valor), g = window.gsap, alto = tam * 1.35, dx = (Math.random() - .5) * tam * 1.2;
        const eixo = () => unit([Math.random() - .5, Math.random() - .5, Math.random() - .5 + .01]);
        const e1 = eixo(), e2 = eixo(), v1 = (2.2 + Math.random() * 1.2) * Math.PI * 2, v2 = (1 + Math.random() * .8) * Math.PI * 2;
        const st = { p: 0, y: -alto, x: dx, e: .72 };
        el.classList.add('rolando'); sombra.style.opacity = '0';
        return new Promise(ok => {
          const aplicar = () => {
            const s = 1 - st.p;
            atual = qMul(qEixo(e2, s * v2), qMul(qEixo(e1, s * v1), alvo));
            pintar(atual, st.x, st.y, st.e);
            sombra.style.opacity = String(Math.max(0, Math.min(.55, .55 * (1 + st.y / alto))));
            sombra.style.transform = `translate(${(st.x * .6).toFixed(1)}px,0) scale(${(1 - Math.abs(st.y) / alto * .45).toFixed(2)})`;
          };
          // @ts-expect-error resolve sem valor é válido; o verificador exige um argumento
          g.timeline({ delay: atraso / 1000, onUpdate: aplicar, onComplete: () => { atual = alvo; pintar(alvo, 0, 0, 1); sombra.style.opacity = '.55'; sombra.style.transform = ''; el.classList.remove('rolando'); el.classList.add('pousou'); marcar(valor); ok(); } })
            .to(st, { p: 1, duration: duracao, ease: 'power3.out' }, 0)
            .to(st, { y: 0, duration: duracao * .9, ease: 'bounce.out' }, 0)
            .to(st, { x: 0, duration: duracao * .8, ease: 'power2.out' }, 0)
            .to(st, { e: 1, duration: duracao * .5, ease: 'back.out(2)' }, 0);
        });
      },
    };
  }

  return { LADOS, suporta, preparar, pronto, criar, solido };
})());
