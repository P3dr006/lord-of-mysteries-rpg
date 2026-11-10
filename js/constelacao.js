// Astrolábio dos 22 Caminhos + d22: os sigilos num anel regular, numerais no aro, estrela {22/7} ligando os Caminhos,
// aro graduado fixo e a "janela" dourada sob o ponteiro. O nome do Caminho que passa pela janela aparece no centro.
const CX = 300, CY = 300, R_NO = 210;
let constel = { rot: 0, spinning: false, nodes: [], raf: 0 };
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII'];

function posNo(i, r = R_NO) {
  const a = (i * 360) / CAMINHOS.length, rad = (a * Math.PI) / 180;
  return { a, x: +(CX + r * Math.sin(rad)).toFixed(2), y: +(CY - r * Math.cos(rad)).toFixed(2) };
}

function montarConstelacao(host, onPick) {
  host.innerHTML = '';
  const NS = 'http://www.w3.org/2000/svg', n = CAMINHOS.length;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 600');
  svg.classList.add('constel-svg'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Astrolábio dos 22 Caminhos. Use as setas para percorrer e Enter para escolher.');
  const pts = CAMINHOS.map((_, i) => posNo(i));
  // estrela de 22 pontas: cada Caminho ligado ao sétimo seguinte (um traço só, sem cruzamentos aleatórios)
  let estrela = '', k = 0;
  for (let s = 0; s <= n; s++) { const p = pts[k]; estrela += (s ? 'L' : 'M') + p.x + ' ' + p.y; k = (k + 7) % n; }
  // aro graduado (fixo): 88 marcas, uma maior a cada Caminho
  let marcas = '';
  for (let t = 0; t < 88; t++) { const a = (t * 360) / 88, r1 = t % 4 === 0 ? 270 : 276, p1 = posNo(0, r1), p2 = posNo(0, 284); marcas += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" transform="rotate(${a} ${CX} ${CY})"/>`; }
  const numerais = pts.map((p, i) => { const q = posNo(i, 252); return `<text x="${q.x}" y="${q.y}">${ROMANOS[i] || i + 1}</text>`; }).join('');
  svg.innerHTML = `
    <defs>
      <radialGradient id="cs-brilho"><stop offset="0" stop-color="#7a5cff" stop-opacity=".32"/><stop offset=".62" stop-color="#3a2a80" stop-opacity=".12"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/></radialGradient>
      <linearGradient id="cs-ouro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dd9c"/><stop offset=".5" stop-color="#b08a3a"/><stop offset="1" stop-color="#f3dd9c"/></linearGradient>
      <radialGradient id="cs-hub" cx=".4" cy=".35"><stop offset="0" stop-color="#2a2058"/><stop offset="1" stop-color="#0b0918"/></radialGradient>
    </defs>
    <circle cx="300" cy="300" r="296" fill="url(#cs-brilho)"/>
    <g class="cs-fixo"><circle cx="300" cy="300" r="286" class="cs-aro"/><circle cx="300" cy="300" r="268" class="cs-aro fino"/><g class="cs-marcas">${marcas}</g></g>
    <path class="cs-janela" d="M${posNo(-0.5, 236).x} ${posNo(-0.5, 236).y} A236 236 0 0 1 ${posNo(0.5, 236).x} ${posNo(0.5, 236).y} L${posNo(0.5, 184).x} ${posNo(0.5, 184).y} A184 184 0 0 0 ${posNo(-0.5, 184).x} ${posNo(-0.5, 184).y}Z"/>
    <g id="rot">
      <circle cx="300" cy="300" r="236" class="cs-aro tracejado"/><circle cx="300" cy="300" r="184" class="cs-aro tracejado"/>
      <path class="cs-estrela" d="${estrela}"/>
      <circle cx="300" cy="300" r="112" class="cs-aro fino"/>
      <g class="cs-numerais">${numerais}</g>
      <g id="nodes"></g>
    </g>
    <circle cx="300" cy="300" r="70" class="hub"/><circle cx="300" cy="300" r="62" class="hub-anel"/>
    <text x="300" y="300" class="hub-t" id="hub-num">d22</text>
    <text x="300" y="322" class="hub-s" id="hub-nome">destino</text>
    <path class="pointer" d="M300 40 l-11 -22 l11 6 l11 -6 z M300 6 l5 7 l-5 7 l-5 -7 z"/>`;
  host.appendChild(svg);

  const nodesG = svg.querySelector('#nodes');
  constel.nodes = CAMINHOS.map((c, i) => {
    const p = pts[i];
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node'); g.setAttribute('role', 'button'); g.setAttribute('tabindex', i === 0 ? '0' : '-1');
    g.setAttribute('aria-pressed', 'false'); g.setAttribute('aria-label', `${c.nome}, Sequência 9: ${c.seq9}`);
    g.setAttribute('transform', `translate(${p.x} ${p.y})`); g.style.setProperty('--pc', c.cor);
    g.innerHTML = `<g class="up"><circle r="30" class="hit"/><g class="esc"><circle r="27" class="halo"/><circle r="22" class="disc"/>
      <image href="img/sigilos/${c.id}.webp" x="-17" y="-17" width="34" height="34"/></g></g>`;
    g.querySelector('image').addEventListener('error', e => {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('x', -13); s.setAttribute('y', -13); s.setAttribute('width', 26); s.setAttribute('height', 26);
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', c.cor);
      s.setAttribute('stroke-width', 1.5); s.setAttribute('stroke-linecap', 'round'); s.innerHTML = c.g;
      e.target.replaceWith(s);
    });
    g.addEventListener('click', () => { if (!constel.spinning) onPick(c.id, i, true); });
    g.addEventListener('keydown', e => {                                    // teclado: Enter/Espaço escolhem; setas percorrem
      const ir = j => { e.preventDefault(); const alvo = constel.nodes[(j + n) % n]; constel.nodes.forEach(x => x.g.setAttribute('tabindex', '-1')); alvo.g.setAttribute('tabindex', '0'); alvo.g.focus(); };
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!constel.spinning) onPick(c.id, i, true); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ir(i + 1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ir(i - 1);
      else if (e.key === 'Home') ir(0); else if (e.key === 'End') ir(n - 1);
    });
    const t = document.createElementNS(NS, 'title'); t.textContent = c.nome; g.appendChild(t);
    nodesG.appendChild(g);
    return { g, up: g.querySelector('.up'), a: p.a };
  });
  constel.numerais = [...svg.querySelectorAll('.cs-numerais text')];
  constel.svg = svg;
  aplicarRot(0);
}

// o Caminho que está sob o ponteiro (número e nome no centro do astrolábio)
function noHub(i) {
  if (!constel.svg) return;
  constel.svg.querySelector('#hub-num').textContent = ROMANOS[i] || i + 1;
  const nome = constel.svg.querySelector('#hub-nome'); nome.textContent = CAMINHOS[i] ? CAMINHOS[i].nome : '';
  if (nome.textContent.length > 13) { nome.setAttribute('textLength', '118'); nome.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } else { nome.removeAttribute('textLength'); nome.removeAttribute('lengthAdjust'); }
}

function aplicarRot(deg) {
  constel.rot = deg;
  const rot = constel.svg ? constel.svg.querySelector('#rot') : document.querySelector('#rot');
  rot.setAttribute('transform', `rotate(${deg} ${CX} ${CY})`);
  constel.nodes.forEach(n => n.up.setAttribute('transform', `rotate(${-deg})`));
  (constel.numerais || []).forEach(t => t.setAttribute('transform', `rotate(${-deg} ${t.getAttribute('x')} ${t.getAttribute('y')})`));
}

function marcarNo(idx) {
  constel.nodes.forEach((n, i) => { n.g.classList.toggle('sel', i === idx); n.g.setAttribute('aria-pressed', String(i === idx)); });
  if (idx >= 0) constel.nodes.forEach((n, i) => n.g.setAttribute('tabindex', i === idx ? '0' : '-1'));
  if (constel.svg) constel.svg.classList.toggle('escolhido', idx >= 0);
}

// Gira até parar com o nó sorteado sob o ponteiro (topo)
function girarD22(onStop) {
  if (constel.spinning) return;
  constel.spinning = true;
  marcarNo(-1);
  const alvo = Math.floor(Math.random() * CAMINHOS.length);
  const a = constel.nodes[alvo].a;
  const r0 = constel.rot;
  if (reduzido()) {                                  // sem giro: o dado já mostra o resultado
    aplicarRot(-a); constel.spinning = false; noHub(alvo); marcarNo(alvo); onStop(CAMINHOS[alvo].id, alvo); return;
  }
  constel.svg.classList.add('girando');
  const delta = (((-a - r0) % 360) + 360) % 360;
  const total = 360 * 6 + delta;
  const dur = 6200, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 4);
  let ultimo = -1;
  const passo = now => {
    const t = Math.min(1, (now - t0) / dur);
    aplicarRot(r0 + total * ease(t));
    const idxTopo = ((Math.round((-(constel.rot) % 360 + 360) % 360 / (360 / 22))) % 22);
    if (idxTopo !== ultimo) { ultimo = idxTopo; noHub(idxTopo); if (window.onTick) window.onTick(); }
    if (t < 1) constel.raf = requestAnimationFrame(passo);
    else {
      constel.spinning = false; constel.svg.classList.remove('girando');
      noHub(alvo);
      marcarNo(alvo);
      onStop(CAMINHOS[alvo].id, alvo);
    }
  };
  constel.raf = requestAnimationFrame(passo);
}

// Interrompe o giro do d22 (ao sair da tela): nenhum resultado é aplicado
function pararD22() { cancelAnimationFrame(constel.raf); constel.spinning = false; if (constel.svg) constel.svg.classList.remove('girando'); }

// Leva um nó escolhido manualmente até o ponteiro
function centralizarNo(idx) {
  const a = constel.nodes[idx].a;
  if (reduzido()) { aplicarRot(-a); marcarNo(idx); noHub(idx); return; }
  const r0 = constel.rot;
  const delta = (((-a - r0 + 180) % 360) + 360) % 360 - 180;
  const t0 = performance.now(), dur = 700;
  const passo = now => {
    if (!constel.svg || !constel.svg.isConnected) return;
    const t = Math.min(1, (now - t0) / dur);
    aplicarRot(r0 + delta * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  marcarNo(idx);
  noHub(idx);
}
