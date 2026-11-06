// Constelação girante de 22 sigilos + d22
const CX = 300, CY = 300;
let constel = { rot: 0, spinning: false, nodes: [], raf: 0 };

function posNo(i) {
  const a = (i * 360) / CAMINHOS.length;
  const r = [215, 178, 232, 190][i % 4];
  const rad = (a * Math.PI) / 180;
  return { a, x: CX + r * Math.sin(rad), y: CY - r * Math.cos(rad) };
}

function montarConstelacao(host, onPick) {
  host.innerHTML = '';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 600');
  svg.classList.add('constel-svg');
  const pts = CAMINHOS.map((_, i) => posNo(i));

  let linhas = '';
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], z = pts[(i + 5) % pts.length];
    linhas += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
    if (i % 2 === 0) linhas += `<line class="far" x1="${p.x}" y1="${p.y}" x2="${z.x}" y2="${z.y}"/>`;
  });

  svg.innerHTML = `
    <defs><radialGradient id="glow"><stop offset="0" stop-color="#7a5cff" stop-opacity=".35"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/></radialGradient></defs>
    <circle cx="300" cy="300" r="290" fill="url(#glow)"/>
    <circle cx="300" cy="300" r="250" class="ring"/>
    <g id="rot"><g class="lines">${linhas}</g><g id="nodes"></g></g>
    <circle cx="300" cy="300" r="54" class="hub"/>
    <text x="300" y="296" class="hub-t" id="hub-num">d22</text>
    <text x="300" y="318" class="hub-s">destino</text>
    <path d="M300 8l-13 -24h26z" class="pointer" transform="translate(0 38)"/>`;
  host.appendChild(svg);

  const nodesG = svg.querySelector('#nodes');
  constel.nodes = CAMINHOS.map((c, i) => {
    const p = pts[i];
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    g.innerHTML = `<g class="up"><circle r="22" class="halo"/><circle r="20" class="disc"/>
      <image href="img/sigilos/${c.id}.png" x="-17" y="-17" width="34" height="34"/></g>`;
    g.querySelector('image').addEventListener('error', e => {
      const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
      s.setAttribute('x', -13); s.setAttribute('y', -13); s.setAttribute('width', 26); s.setAttribute('height', 26);
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', c.cor);
      s.setAttribute('stroke-width', 1.5); s.setAttribute('stroke-linecap', 'round'); s.innerHTML = c.g;
      e.target.replaceWith(s);
    });
    g.addEventListener('click', () => { if (!constel.spinning) onPick(c.id, i, true); });
    const t = document.createElementNS(NS, 'title'); t.textContent = c.nome; g.appendChild(t);
    nodesG.appendChild(g);
    return { g, up: g.querySelector('.up'), a: p.a };
  });
  aplicarRot(0);
  constel.svg = svg;
}

function aplicarRot(deg) {
  constel.rot = deg;
  const rot = constel.svg ? constel.svg.querySelector('#rot') : document.querySelector('#rot');
  rot.setAttribute('transform', `rotate(${deg} ${CX} ${CY})`);
  constel.nodes.forEach(n => n.up.setAttribute('transform', `rotate(${-deg})`));
}

function marcarNo(idx) {
  constel.nodes.forEach((n, i) => n.g.classList.toggle('sel', i === idx));
}

// Gira até parar com o nó sorteado sob o ponteiro (topo)
function girarD22(onStop) {
  if (constel.spinning) return;
  constel.spinning = true;
  marcarNo(-1);
  const alvo = Math.floor(Math.random() * CAMINHOS.length);
  const a = constel.nodes[alvo].a;
  const r0 = constel.rot;
  const delta = (((-a - r0) % 360) + 360) % 360;
  const total = 360 * 6 + delta;
  const dur = 6200, t0 = performance.now();
  const hub = constel.svg.querySelector('#hub-num');
  const ease = t => 1 - Math.pow(1 - t, 4);
  let ultimo = -1;
  const passo = now => {
    const t = Math.min(1, (now - t0) / dur);
    aplicarRot(r0 + total * ease(t));
    const idxTopo = ((Math.round((-(constel.rot) % 360 + 360) % 360 / (360 / 22))) % 22);
    if (idxTopo !== ultimo) { ultimo = idxTopo; hub.textContent = idxTopo + 1; if (window.onTick) window.onTick(); }
    if (t < 1) constel.raf = requestAnimationFrame(passo);
    else {
      constel.spinning = false;
      hub.textContent = alvo + 1;
      marcarNo(alvo);
      onStop(CAMINHOS[alvo].id, alvo);
    }
  };
  constel.raf = requestAnimationFrame(passo);
}

// Leva um nó escolhido manualmente até o ponteiro
function centralizarNo(idx) {
  const a = constel.nodes[idx].a;
  const r0 = constel.rot;
  const delta = (((-a - r0 + 180) % 360) + 360) % 360 - 180;
  const t0 = performance.now(), dur = 700;
  const passo = now => {
    const t = Math.min(1, (now - t0) / dur);
    aplicarRot(r0 + delta * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  marcarNo(idx);
  constel.svg.querySelector('#hub-num').textContent = idx + 1;
}
