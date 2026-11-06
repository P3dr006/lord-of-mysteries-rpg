const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Lista de passos — as próximas etapas do projeto adicionam passos aqui.
const STEPS = [
  { id: 'identidade', nome: 'Identidade', render: renderIdentidade, valido: () => P.nome.trim().length > 0 },
  { id: 'atributos',  nome: 'Atributos',  render: renderAtributos, valido: () => ATTRS.every(a => P.attrs[a.key]) },
  { id: 'caminho',    nome: 'Caminho',    render: renderCaminho,   valido: () => !!P.caminho },
  { id: 'raca',       nome: 'Raça & Origem', render: renderRaca,   valido: () => !!(P.raca && P.origem) },
  { id: 'destino',    nome: 'Destino',    render: renderDestino,   valido: () => P.traco != null && P.artefato != null },
  { id: 'ficha',      nome: 'Ficha',      render: renderFicha,     valido: () => true },
];

function mostrar(id) {
  $('#cover').hidden = id !== 'cover';
  $('#wizard').hidden = id !== 'wizard';
}

function iniciarPasso() {
  mostrar('wizard');
  renderStepper();
  const s = STEPS[P.step];
  const body = $('#step-body');
  body.innerHTML = '';
  s.render(body);
  body.classList.toggle('ficha-on', s.id === 'ficha');
  body.classList.remove('entra'); void body.offsetWidth; body.classList.add('entra');
  $('#btn-prev').disabled = P.step === 0;
  $('#btn-next').hidden = P.step === STEPS.length - 1;
  $('#btn-next').disabled = !s.valido();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function atualizarNext() { $('#btn-next').disabled = !STEPS[P.step].valido(); }

function renderStepper() {
  const ol = $('#stepper');
  ol.style.setProperty('--n', STEPS.length); ol.style.setProperty('--prog', P.step / (STEPS.length - 1));
  ol.innerHTML = STEPS.map((s, i) => `<li class="${i === P.step ? 'on' : i < P.step ? 'done' : ''}" data-i="${i}">
    <span class="no"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${i < P.step ? '<path d="M5 12l5 5 9-10"/>' : PASSO_ICONE[s.id]}</svg></span>
    <span class="lbl">${s.nome}</span></li>`).join('');
  ol.querySelectorAll('li.done').forEach(li => li.addEventListener('click', () => { P.step = +li.dataset.i; salvar(); iniciarPasso(); }));
}

/* ---------- Passo 1: Identidade ---------- */
function renderIdentidade(body) {
  body.innerHTML = `
    <h3>Quem é o seu Beyonder?</h3>
    <div class="id-wrap">
      <div class="id-form">
        <div class="id-top">
          <div class="selo-col" id="selo-col"></div>
          <div class="id-top-campos">
            <div class="field"><label>Nome do personagem *</label>
              <div class="inp-row"><input type="text" id="f-nome" value="${esc(P.nome)}" placeholder="Ex.: Alistair Ashcombe" autocomplete="off">
              <button id="btn-nome" class="icon" title="Sortear um nome" aria-label="Sortear um nome" data-ic="dado"></button></div></div>
            <div class="grid2">
              <div class="field"><label>Jogador</label><input type="text" id="f-jogador" value="${esc(P.jogador)}"></div>
              <div class="field"><label>Idade</label><input type="text" id="f-idade" value="${esc(P.idade)}"></div>
            </div>
            <div class="field"><label>Gênero</label><input type="text" id="f-genero" value="${esc(P.genero)}"></div>
          </div>
        </div>
        <div class="field"><label>Aparência</label><textarea id="f-aparencia" placeholder="Olhar, cicatrizes, o que as pessoas notam primeiro…">${esc(P.aparencia)}</textarea></div>
        <div class="field"><label>História</label><textarea id="f-historia" placeholder="De onde veio, o que perdeu e o que o levou a beber a poção…">${esc(P.historia)}</textarea></div>
      </div>
      <aside class="id-card" aria-label="Pré-visualização do registro">
        <div class="id-sel">Registro do Beyonder</div>
        <div class="id-emb-wrap" id="pv-emb"></div>
        <div class="id-nome" id="pv-nome"></div><div class="id-linha"></div>
        <dl><dt>Jogador</dt><dd id="pv-jog"></dd><dt>Idade</dt><dd id="pv-idade"></dd><dt>Gênero</dt><dd id="pv-gen"></dd></dl>
        <div class="id-reg">Nº <span id="pv-num"></span></div><div class="id-carimbo" id="pv-carimbo"></div>
      </aside>
    </div>`;
  const EMB = `<svg class="id-emb" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="none" stroke="#d9b86a" stroke-width="1.2"/>
          <g class="spin"><circle cx="60" cy="60" r="47" fill="none" stroke="#d9b86a" stroke-opacity=".6" stroke-dasharray="2 5"/></g>
          <path d="M60 18l7 28 28 7-28 7-7 28-7-28-28-7 28-7z" fill="#d9b86a" fill-opacity=".18" stroke="#d9b86a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="60" cy="60" r="5" fill="#d9b86a"/></svg>`;
  const prev = () => {
    $('#pv-nome').textContent = P.nome.trim() || '— sem nome —'; $('#pv-nome').classList.toggle('vazio', !P.nome.trim());
    $('#pv-jog').textContent = P.jogador || '—'; $('#pv-idade').textContent = P.idade || '—'; $('#pv-gen').textContent = P.genero || '—';
    $('#pv-num').textContent = numeroRegistro(P.nome.trim() || 'x');
    $('#pv-emb').innerHTML = P.retrato ? retratoCirculo(96, 'id-ret') : EMB;
    const c = $('#pv-carimbo'), ok = P.nome.trim().length > 0, antes = c.dataset.ok;
    c.dataset.ok = ok ? '1' : '0'; c.textContent = ok ? 'REGISTRADO' : 'PENDENTE'; c.classList.toggle('ok', ok);
    if (ok && antes === '0') { c.classList.remove('bate'); void c.offsetWidth; c.classList.add('bate'); }
  };
  const montarSelo = selar => {
    $('#selo-col').innerHTML = seloHTML(); ligarSelo(onRetrato); prev();
    if (selar) { const e = $('#selo'); e.classList.add('selando'); setTimeout(() => e.classList.remove('selando'), 1600); }
  };
  const onRetrato = selar => montarSelo(selar === true);
  window.__onRetrato = onRetrato;
  const bind = (id, key) => $(id).addEventListener('input', e => { P[key] = e.target.value; salvar(); atualizarNext(); prev(); const m = $('.ret-vazio span'); if (m && key === 'nome') m.textContent = inicial(); const mb = $('.selo-vazio b'); if (mb && key === 'nome') mb.textContent = inicial(); });
  bind('#f-nome', 'nome'); bind('#f-jogador', 'jogador'); bind('#f-idade', 'idade');
  bind('#f-genero', 'genero'); bind('#f-aparencia', 'aparencia'); bind('#f-historia', 'historia');
  $('#btn-nome').addEventListener('click', () => { P.nome = nomeAleatorio(); $('#f-nome').value = P.nome; salvar(); atualizarNext(); prev(); Som.carta(); const mb = $('.selo-vazio b'); if (mb) mb.textContent = inicial(); });
  $('#pv-carimbo').dataset.ok = P.nome.trim() ? '1' : '0';
  montarSelo(false);
}

/* ---------- Passo 2: Atributos ---------- */
let rolando = false;

function renderAtributos(body) {
  body.innerHTML = `
    <h3>Atributos — os dados do destino</h3>
    <p class="hint">Cada atributo é 4d6 descartando o dado mais baixo (que fica apagado). Você pode usar uma única
    <b>Relance do Destino</b> para refazer um atributo.</p>
    <div class="toolbar">
      <button id="btn-roll-all" class="primary" data-ic="dado">Rolar todos</button>
      <span class="hint" id="reroll-info"></span>
    </div>
    <div class="attr-list" id="attr-list"></div>
    <div class="presagio" id="presagio" hidden></div>`;
  const list = $('#attr-list');
  setTimeout(() => presagio(), 0);
  ATTRS.forEach(a => {
    const row = el('div', 'attr-row');
    row.id = 'row-' + a.key; row.style.setProperty('--ac', a.cor);
    row.innerHTML = `
      <div class="ar-ic">${iconeAttr(a, 26)}</div>
      <div class="attr-name"><b>${a.nome}</b><span>${a.desc}</span></div>
      <div class="dice-tray"></div>
      <div class="attr-total"></div>`;
    list.appendChild(row);
    desenharAtributo(a.key, false);
  });
  $('#btn-roll-all').addEventListener('click', rolarTodos);
  atualizarRelance();
}

function atualizarRelance() {
  const info = $('#reroll-info');
  if (!info) return;
  info.textContent = P.relanceUsado ? 'Relance do Destino já usada.' : 'Relance do Destino disponível (clique em um atributo já rolado).';
  const todos = ATTRS.every(a => P.attrs[a.key]);
  $('#btn-roll-all').disabled = todos || rolando;
}

function desenharAtributo(key, animar) {
  const row = $('#row-' + key);
  const tray = row.querySelector('.dice-tray');
  const tot = row.querySelector('.attr-total');
  const r = P.attrs[key];
  tray.innerHTML = '';
  if (!r) { tot.innerHTML = '—'; tray.appendChild(botaoRolar(key)); return Promise.resolve(); }
  const dados = r.dados.map((v, i) => {
    const dd = criarDado();
    if (i === r.descartado) dd.classList.add('drop');
    tray.appendChild(dd);
    return mostrarFace(dd, v, animar);
  });
  const totalHTML = n => `<span class="tn">${n}</span><small>mod ${mod(r.total) >= 0 ? '+' : ''}${mod(r.total)}</small><div class="ar-bar"><i style="width:${animar ? 0 : Math.min(100, r.total / 20 * 100)}%"></i></div>`;
  tot.innerHTML = totalHTML(animar ? '…' : r.total);
  const fim = Promise.all(dados).then(() => {
    if (animar) { tot.innerHTML = totalHTML(3); contar(tot.querySelector('.tn'), r.total); requestAnimationFrame(() => requestAnimationFrame(() => { tot.querySelector('.ar-bar i').style.width = Math.min(100, r.total / 20 * 100) + '%'; })); row.classList.add('rolou'); setTimeout(() => row.classList.remove('rolou'), 1200); }
    presagio();
    if (!P.relanceUsado) {
      const b = el('button', 'ghost', 'Relance'); b.dataset.ic = 'relance';
      b.title = 'Usa a Relance do Destino (uma vez)';
      b.addEventListener('click', () => relancer(key));
      tray.appendChild(b);
    }
  });
  return fim;
}

function presagio() {
  const box = $('#presagio'); if (!box) return;
  if (!ATTRS.every(a => P.attrs[a.key])) { box.hidden = true; return; }
  const soma = ATTRS.reduce((n, a) => n + P.attrs[a.key].total, 0), txt = [...PRESAGIOS].reverse().find(x => soma >= x[0])[1];
  box.hidden = false; box.innerHTML = `<span class="pz-n">${soma}</span><div><small>Soma dos atributos · média ${(soma / 6).toFixed(1)}</small><b>${txt}</b></div>`;
}

function botaoRolar(key) {
  const b = el('button', '', 'Rolar 4d6'); b.dataset.ic = 'dado';
  b.addEventListener('click', () => rolarAtributo(key));
  return b;
}

async function rolarAtributo(key) {
  if (rolando) return;
  rolando = true; Som.dado();
  P.attrs[key] = rolar4d6();
  salvar();
  await desenharAtributo(key, true);
  rolando = false;
  atualizarRelance(); atualizarNext();
}

async function rolarTodos() {
  if (rolando) return;
  rolando = true; Som.dado();
  const pend = ATTRS.filter(a => !P.attrs[a.key]);
  pend.forEach(a => { P.attrs[a.key] = rolar4d6(); });
  salvar();
  await Promise.all(pend.map(a => desenharAtributo(a.key, true)));
  rolando = false;
  atualizarRelance(); atualizarNext();
}

async function relancer(key) {
  if (rolando || P.relanceUsado) return;
  rolando = true; Som.dado();
  P.relanceUsado = true;
  P.attrs[key] = rolar4d6();
  salvar();
  document.querySelectorAll('.dice-tray button.ghost').forEach(b => b.remove());
  await desenharAtributo(key, true);
  rolando = false;
  atualizarRelance(); atualizarNext();
}

/* ---------- Passo 3: Caminho ---------- */
function infoCaminho(id) {
  const c = caminhoPorId(id), at = ATTRS.find(a => a.key === c.attr);
  return `<div class="cardcam" style="--pc:${c.cor}"><div class="cc-head">${sigilo(c, 84)}<div><h4>${c.nome}</h4><span class="badge">Sequência 9 · ${c.seq9}</span></div></div>
    <p>${c.desc}</p><h5>Habilidades iniciais</h5><ul class="cc-hab">${c.hab.map(h => `<li>${h}</li>`).join('')}</ul>
    <div class="cc-bonus">${iconeAttr(at, 18)} <span>+2 em <b>${at.nome}</b></span></div></div>`;
}

function renderCaminho(body) {
  body.innerHTML = `
    <h3>Seu Caminho — a constelação decide</h3>
    <p class="hint">Gire o d22 para o destino escolher, ou clique em um sigilo para escolher você mesmo.</p>
    <div class="caminho-wrap">
      <div id="constel"></div>
      <div>
        <div class="toolbar"><button id="btn-d22" class="primary" data-ic="dado">Girar o d22</button></div>
        <div class="caminho-info" id="caminho-info"><p class="vazio">Nenhum Caminho escolhido.</p></div>
      </div>
    </div>`;
  const mostrarInfo = id => { $('#caminho-info').innerHTML = infoCaminho(id); };
  const escolher = (id, idx, manual) => {
    P.caminho = id; salvar(); mostrarInfo(id); atualizarNext(); tocarCaminho(id);
    if (manual) centralizarNo(idx);
  };
  montarConstelacao($('#constel'), escolher);
  if (P.caminho) {
    const i = CAMINHOS.findIndex(c => c.id === P.caminho);
    mostrarInfo(P.caminho); marcarNo(i);
    constel.svg.querySelector('#hub-num').textContent = i + 1;
    aplicarRot(-constel.nodes[i].a);
  }
  $('#btn-d22').addEventListener('click', () => {
    $('#btn-d22').disabled = true;
    girarD22((id, idx) => { escolher(id, idx, false); $('#btn-d22').disabled = false; });
  });
}

/* ---------- Passo 4: Raça e Origem ---------- */
const fmtBonus = b => Object.entries(b).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${ATTRS.find(a => a.key === k).nome}`).join(', ');

function renderRaca(body) {
  body.innerHTML = `
    <h3>Raça & Origem</h3>
    <div class="toolbar"><button id="btn-sortear" class="primary" data-ic="dado">Sortear raça e origem</button>
      <span class="hint">ou escolha clicando nas cartas</span></div>
    <div id="g-raca-wrap"></div>
    <h4 class="sub">Origem social</h4><div class="cards" id="g-origem"></div>`;
  const marcar = () => {
    document.querySelectorAll('#g-raca-wrap .opt').forEach(e => e.classList.toggle('sel', e.dataset.id === P.raca));
    document.querySelectorAll('#g-origem .opt').forEach(e => e.classList.toggle('sel', e.dataset.id === P.origem));
    atualizarNext();
  };
  [...new Set(RACAS.map(r => r.grupo))].forEach(g => {
    $('#g-raca-wrap').insertAdjacentHTML('beforeend', `<h4 class="sub">Raça · ${g}</h4><div class="cards" data-g="${g}"></div>`);
    const box = $('#g-raca-wrap').lastElementChild;
    RACAS.filter(r => r.grupo === g).forEach(r => {
      const e = el('button', 'opt', `<span class="ic">${medalhao(r, 76)}</span><span class="txt"><b>${r.nome}</b><small>${r.desc}</small>
        <span class="bn">${fmtBonus(r.bonus)}</span><em>${r.traco}</em></span>`);
      e.dataset.id = r.id; e.style.setProperty('--c', r.cor);
      e.addEventListener('click', () => { P.raca = r.id; salvar(); marcar(); });
      box.appendChild(e);
    });
  });
  ORIGENS.forEach(o => {
    const e = el('button', 'opt', `<span class="ic">${medalhao(o, 76)}</span><span class="txt"><b>${o.nome}</b>
      <small>${o.itens.join(' · ')}</small><span class="bn">£ ${o.libras}</span><em>${o.perk}</em></span>`);
    e.dataset.id = o.id; e.style.setProperty('--c', o.cor);
    e.addEventListener('click', () => { P.origem = o.id; salvar(); marcar(); });
    $('#g-origem').appendChild(e);
  });
  $('#btn-sortear').addEventListener('click', () => {
    P.raca = RACAS[d(RACAS.length) - 1].id;
    P.origem = ORIGENS[d(ORIGENS.length) - 1].id;
    salvar(); marcar();
    document.querySelectorAll('.opt.sel').forEach(e => { e.classList.add('flash'); e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  });
  marcar();
}

/* ---------- Passo 5: Cartas de Destino ---------- */
const ORNAM = `<svg class="dc-ornam" viewBox="0 0 200 300" aria-hidden="true"><rect x="8" y="8" width="184" height="284" rx="10" fill="none" stroke="#d9b86a" stroke-width="1.4"/><rect x="16" y="16" width="168" height="268" rx="6" fill="none" stroke="#d9b86a" stroke-opacity=".45"/>
  <g transform="translate(100 150)"><circle r="62" fill="none" stroke="#d9b86a" stroke-opacity=".5"/><g class="spin"><circle r="52" fill="none" stroke="#d9b86a" stroke-opacity=".6" stroke-dasharray="2 6"/></g>
  <path d="M0-44l9 35 35 9-35 9-9 35-9-35-35-9 35-9z" fill="#d9b86a" fill-opacity=".14" stroke="#d9b86a" stroke-width="1.5" stroke-linejoin="round"/><circle r="6" fill="#d9b86a"/></g>
  <g fill="#d9b86a"><path d="M100 28l5 6-5 6-5-6z"/><path d="M100 260l5 6-5 6-5-6z"/><path d="M28 150l6-5 6 5-6 5z"/><path d="M160 150l6-5 6 5-6 5z"/></g></svg>`;
function carta(tipo, titulo) {
  return `<div class="dcard" id="dc-${tipo}"><div class="dc-tilt"><div class="dc-inner">
    <div class="dc-face dc-back">${ORNAM}<div class="dc-t">${titulo}</div><div class="dc-n" id="dn-${tipo}">?</div></div>
    <div class="dc-face dc-front" id="df-${tipo}"></div></div></div></div>`;
}

function renderDestino(body) {
  body.innerHTML = `
    <h3>Cartas de Destino</h3>
    <p class="hint">Cada carta é tirada uma única vez. O traço é um dom (ou fardo); o artefato selado traz dádiva e maldição.</p>
    <div class="dcards">
      <div>${carta('traco', 'd12 · Traço')}<button id="btn-traco" class="primary" data-ic="carta">Tirar traço</button></div>
      <div>${carta('art', 'd10 · Artefato')}<button id="btn-art" class="primary" data-ic="carta">Tirar artefato</button></div>
    </div>`;
  document.querySelectorAll('.dcard').forEach(inclinavel);
  const mostrar = (tipo, idx, animar) => {
    const c = $('#dc-' + tipo), f = $('#df-' + tipo), emb = CAMINHOS[(tipo === 'traco' ? 0 : 12) + idx];
    const topo = `<div class="df-top"><span>${tipo === 'traco' ? 'Traço · d12' : 'Artefato selado · d10'}</span><b>${idx + 1}</b></div><div class="df-art">${medalhao(emb, 96)}</div>`;
    if (tipo === 'traco') { const t = TRACOS[idx]; f.innerHTML = `${topo}<h4>${t.t}</h4><div class="df-sep">◆</div><p class="df-txt">${t.d}</p><div class="df-shine"></div>`; }
    else { const a = ARTEFATOS[idx]; f.innerHTML = `${topo}<h4>${a.n}</h4><div class="df-sep">◆</div><p class="df-dad"><b>Dádiva</b>${a.dadiva}</p><p class="df-mal"><b>Maldição</b>${a.maldicao}</p><div class="df-shine"></div>`; }
    f.style.setProperty('--cc', emb.cor);
    { const card = f.closest('.dcard'), need = f.scrollHeight; if (need > card.clientHeight) card.style.height = (need + 6) + 'px'; }
    if (!animar) c.querySelector('.dc-inner').style.transition = 'none'; else Som.carta();
    c.classList.add('flip');
    $('#btn-' + (tipo === 'traco' ? 'traco' : 'art')).disabled = true;
  };
  const tirar = (tipo, lista, chave) => {
    const btn = $('#btn-' + (tipo === 'traco' ? 'traco' : 'art'));
    btn.disabled = true;
    const n = $('#dn-' + tipo);
    let i = 0;
    const iv = setInterval(() => { n.textContent = d(lista.length); if (++i > 18) { clearInterval(iv); fim(); } }, 70);
    const fim = () => {
      P[chave] = d(lista.length) - 1; salvar();
      n.textContent = P[chave] + 1;
      setTimeout(() => { mostrar(tipo, P[chave], true); atualizarNext(); }, 350);
    };
  };
  $('#btn-traco').addEventListener('click', () => tirar('traco', TRACOS, 'traco'));
  $('#btn-art').addEventListener('click', () => tirar('art', ARTEFATOS, 'artefato'));
  if (P.traco != null) mostrar('traco', P.traco, false);
  if (P.artefato != null) mostrar('art', P.artefato, false);
}

/* ---------- Ficha ---------- */
function ensureVitais() {
  if (P.pv == null) P.pv = pvMax();
  if (P.san == null) P.san = sanMax();
  P.pv = Math.min(P.pv, pvMax()); P.san = Math.min(P.san, sanMax());
}

// gráfico radar dos 6 atributos
function radarSVG(cor) {
  const R = 92, C = 130, MAX = 24, ang = i => (-90 + i * 60) * Math.PI / 180;
  const pt = (i, r) => [C + Math.cos(ang(i)) * r, C + Math.sin(ang(i)) * r];
  let grade = '';
  [.25, .5, .75, 1].forEach(f => { grade += `<polygon points="${ATTRS.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="#3b3566" stroke-width="1"/>`; });
  ATTRS.forEach((_, i) => { grade += `<line x1="${C}" y1="${C}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" stroke="#3b3566"/>`; });
  const pts = ATTRS.map((a, i) => pt(i, R * Math.min(1, total(a.key) / MAX)));
  const rotulos = ATTRS.map((a, i) => { const [x, y] = pt(i, R + 20); return `<text x="${x}" y="${y - 2}" class="rl">${a.nome.slice(0, 3).toUpperCase()}</text><text x="${x}" y="${y + 11}" class="rv">${total(a.key)}</text>`; }).join('');
  return `<svg class="radar" viewBox="0 0 260 260" role="img" aria-label="Atributos">${grade}
    <polygon class="rpoly" points="${pts.map(p => p.join(',')).join(' ')}" fill="${cor}" fill-opacity=".28" stroke="${cor}" stroke-width="2.2" stroke-linejoin="round"/>
    ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="${cor}"/>`).join('')}${rotulos}</svg>`;
}

function medidor(k, nome, v, max, cor) {
  return `<div class="gauge" data-k="${k}" style="--gc:${cor}"><div class="g-top"><span>${nome}</span><b><i id="cv-${k}">${v}</i> / ${max}</b></div>
    <div class="g-bar"><div class="g-fill" id="gf-${k}" style="width:${max ? v / max * 100 : 0}%"></div></div>
    <div class="counter"><button data-c="${k}" data-d="-1">−</button><button data-c="${k}" data-d="1">+</button></div></div>`;
}

function renderFicha(body) {
  ensureVitais();
  const c = caminhoPorId(P.caminho), r = racaPorId(P.raca), o = origemPorId(P.origem), pat = patamarDe(P.sequencia), k = idxPatamar(P.sequencia);
  const partes = a => { const b = P.attrs[a.key].total, ex = [[bonusCaminho(a.key), 'Caminho'], [bonusRaca(a.key), 'Raça'], [bonusSeq(a.key), 'Sequência']].filter(x => x[0]); return ex.length ? `<small>${b} ${ex.map(x => `${x[0] > 0 ? '+' : ''}${x[0]} ${x[1]}`).join(' ')}</small>` : ''; };
  const pronto = P.digestao >= DIG_MAX;
  body.innerHTML = `
  <div class="ficha" id="ficha" style="--pc:${c.cor};--pt:${pat.cor};--k:${k}" data-tier="${pat.id}">
    <header class="hero">
      <div class="hero-bg" aria-hidden="true"><div class="hero-wm"><img src="img/sigilos/${c.id}.png" alt=""></div></div>
      <div class="hero-sig ${P.retrato ? 'com-ret' : ''}"><div class="aura"></div><div class="aura a2"></div><div class="aura-anel"></div>${P.retrato ? `${retratoCirculo(138, 'hero-ret')}<div class="hero-insignia" title="Caminho ${c.nome}">${sigilo(c, 46)}</div>` : sigilo(c, 150)}</div>
      <div class="hero-info">
        <p class="hero-eyebrow">Caminho ${c.nome} · <span>${pat.nome}</span></p>
        <h2>${esc(P.nome)}</h2>
        <div class="hero-seq">Sequência ${P.sequencia} — <b>${esc(nomeSeq(P.sequencia))}</b></div>
        <div class="hero-chips"><span class="chip">${medalhao(r, 34)}${r.nome}</span><span class="chip">${medalhao(o, 34)}${o.nome}</span></div>
        <div class="hint">${[P.jogador && 'Jogador: ' + esc(P.jogador), P.idade && esc(P.idade) + ' anos', esc(P.genero)].filter(Boolean).join(' · ')}</div>
      </div>
    </header>

    <div class="ficha-grid">
      <section class="blk"><h3>Atributos</h3>
        <div class="attr-wrap">${radarSVG(c.cor)}
          <ul class="attr-lista">${ATTRS.map(a => `<li style="--ac:${a.cor}"><span class="ai">${iconeAttr(a, 18)}</span><span>${a.nome}</span><b>${total(a.key)}</b><em>mod ${mod(total(a.key)) >= 0 ? '+' : ''}${mod(total(a.key))}</em>${partes(a)}</li>`).join('')}</ul></div></section>
      <section class="blk"><h3>Vitais</h3>
        ${medidor('pv', 'Pontos de Vida', P.pv, pvMax(), '#e05a6a')}
        ${medidor('san', 'Sanidade', P.san, sanMax(), '#6fb4ff')}
        <div class="gauge fixo" style="--gc:#b08cff"><div class="g-top"><span>Espiritualidade</span><b>${espMax()}</b></div><div class="g-bar"><div class="g-fill" style="width:100%"></div></div></div>
        <p class="san-msg" id="san-msg"></p></section>
    </div>

    <section class="blk poder">
      <h3>Escada de Poder</h3>
      <div class="ladder">${ladderHTML()}</div>
      <p class="pat-desc"><b style="color:${pat.cor}">${pat.nome}.</b> ${pat.desc}</p>
      <div class="dig-wrap">
        <div class="dig-frasco ${pronto ? 'pronto' : ''}">${frascoSVG(P.digestao, c.cor)}</div>
        <div class="dig-info">
          <h4>Digestão da poção</h4>
          <p class="hint">Ao beber a poção, o Beyonder precisa <b>atuar</b> segundo o Caminho para digeri-la. Marque o progresso conforme a história avança.</p>
          <div class="dig-pips" id="dig-pips">${Array.from({ length: DIG_MAX }, (_, i) => `<button class="pip-d ${i < P.digestao ? 'on' : ''}" data-i="${i + 1}" aria-label="Digestão ${i + 1}"></button>`).join('')}</div>
          <div class="dig-nums"><span id="dig-n">${P.digestao}</span> / ${DIG_MAX} ${pronto ? '· <b class="ok">Poção digerida</b>' : ''}</div>
          <label class="nome-seq">Nome da Sequência atual <input type="text" id="f-nomeseq" value="${esc(P.nomesSeq[P.sequencia] || '')}" placeholder="${esc(nomeSeq(P.sequencia, true))}"></label>
          <div class="toolbar">${P.sequencia > 0
            ? `<button id="btn-asc" class="primary" data-ic="estrela">${pronto ? `Ascender para a Sequência ${P.sequencia - 1}` : `Forçar ascensão (arriscado)`}</button>`
            : `<span class="badge">Você alcançou a divindade</span>`}</div>
        </div>
      </div>
    </section>

    <div class="ficha-grid">
      <section class="blk"><h3>Raça &amp; Origem</h3>
        <div class="emblems">${medalhao(r, 56)}<div><b>${r.nome}</b><div class="hint">${fmtBonus(r.bonus)}</div></div></div><p class="note">${r.traco}</p>
        <div class="emblems">${medalhao(o, 56)}<div><b>${o.nome}</b><div class="hint">£ ${o.libras}</div></div></div><p class="note">${o.perk}</p>
        <h4 class="sub">Equipamento</h4><p class="note">${o.itens.map(esc).join(' · ')}</p></section>
      <section class="blk"><h3>Destino</h3>
        <div class="tarot"><div class="tarot-n">${medalhao(CAMINHOS[P.traco], 44)}</div><small>Traço · d12</small><b>${TRACOS[P.traco].t}</b><p>${TRACOS[P.traco].d}</p></div>
        <div class="tarot art"><div class="tarot-n">${medalhao(CAMINHOS[12 + P.artefato], 44)}</div><small>Artefato selado · d10</small><b>${ARTEFATOS[P.artefato].n}</b>
          <p><span class="ok">Dádiva:</span> ${ARTEFATOS[P.artefato].dadiva}</p><p><span class="bad">Maldição:</span> ${ARTEFATOS[P.artefato].maldicao}</p></div></section>
    </div>
    ${P.aparencia || P.historia ? `<section class="blk"><h3>Quem é</h3>${P.aparencia ? `<h4 class="sub">Aparência</h4><p class="note">${esc(P.aparencia)}</p>` : ''}${P.historia ? `<h4 class="sub">História</h4><p class="note">${esc(P.historia)}</p>` : ''}</section>` : ''}
    <section class="blk"><h3>Notas de sessão</h3><textarea id="f-notas" placeholder="Anotações da campanha...">${esc(P.notas)}</textarea>
      <div class="sheet-actions"><button id="btn-export" class="primary" data-ic="baixar">Exportar JSON</button></div></section>
  </div>`;

  // vitais
  const instab = () => { const f = $('#ficha'), r = P.san / sanMax(); f.classList.toggle('san-baixa', r <= .3 && P.san > 0); f.classList.toggle('san-zero', P.san === 0);
    $('#san-msg').textContent = P.san === 0 ? 'Perda de controle — a mente se rompeu.' : r <= .3 ? 'Sua mente vacila. Sussurros se misturam aos pensamentos…' : ''; };
  body.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
    const kk = b.dataset.c, max = kk === 'pv' ? pvMax() : sanMax();
    P[kk] = Math.max(0, Math.min(max, P[kk] + +b.dataset.d)); salvar();
    $('#cv-' + kk).textContent = P[kk]; $('#gf-' + kk).style.width = (P[kk] / max * 100) + '%'; instab();
  }));
  instab();
  // digestão
  body.querySelectorAll('.pip-d').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i, novo = P.digestao === i ? i - 1 : i; P.digestao = novo; salvar(); if (novo > 0) Som.digerir(novo - 1);
    renderFicha(body);
  }));
  $('#f-nomeseq').addEventListener('input', e => { if (e.target.value.trim()) P.nomesSeq[P.sequencia] = e.target.value.trim(); else delete P.nomesSeq[P.sequencia]; salvar(); });
  if ($('#btn-asc')) $('#btn-asc').addEventListener('click', () => pronto ? ascender(false, 0) : ascensaoArriscada());
  $('#f-notas').addEventListener('input', e => { P.notas = e.target.value; salvar(); });
  $('#btn-export').addEventListener('click', exportarJSON);
}

/* ---------- Janelas do próprio site (sem alert/confirm, que o navegador embutido bloqueia) ---------- */
function janela(titulo, corpo, botoes) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'asc risco on';
    m.innerHTML = `<div class="asc-core"><h2 class="asc-nome">${titulo}</h2><div class="modal-corpo">${corpo}</div><div class="cover-btns"></div></div>`;
    const caixa = m.querySelector('.cover-btns');
    botoes.forEach(b => { const e = el('button', b.cls || 'ghost', b.label); if (b.ic) e.dataset.ic = b.ic; e.addEventListener('click', () => { const r = b.fn ? b.fn(m, e) : undefined; if (r !== false) { m.remove(); res(b.valor); } }); caixa.appendChild(e); });
    document.body.appendChild(m);
  });
}
const perguntar = (titulo, texto) => janela(titulo, `<p class="modal-txt">${texto}</p>`, [{ label: 'Confirmar', cls: 'primary', valor: true }, { label: 'Cancelar', valor: false }]);
const avisar = (titulo, texto) => janela(titulo, `<p class="modal-txt">${texto}</p>`, [{ label: 'Entendi', cls: 'primary', valor: true }]);
// Exportar: mostra o JSON para copiar (downloads feitos pela página podem ser bloqueados) e tenta baixar também
function exportarJSON() {
  const json = JSON.stringify(P, null, 2);
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = (P.nome || 'personagem').replace(/\W+/g, '_') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) {}
  janela('Sua ficha em JSON', `<p class="modal-txt">Copie e guarde este texto. Para recuperar a ficha depois, salve-o num arquivo .json e use “Importar JSON”.</p><textarea id="json-out" class="json-out" readonly></textarea>`,
    [{ label: 'Copiar', cls: 'primary', ic: 'baixar', fn: (m, b) => { const t = m.querySelector('#json-out'); t.select(); (navigator.clipboard ? navigator.clipboard.writeText(json) : Promise.reject()).then(() => { b.lastChild.textContent = 'Copiado!'; }).catch(() => { document.execCommand && document.execCommand('copy'); }); return false; } },
     { label: 'Fechar', valor: true }]).then(() => {});
  setTimeout(() => { const t = $('#json-out'); if (t) t.value = json; }, 0);
}

/* ---------- Navegação e inicialização ---------- */
$('#btn-next').addEventListener('click', () => { if (P.step < STEPS.length - 1) { P.step++; salvar(); iniciarPasso(); } });
$('#btn-prev').addEventListener('click', () => { if (P.step > 0) { P.step--; salvar(); iniciarPasso(); } });
$('#btn-start').addEventListener('click', () => { P = novoPersonagem(); salvar(); iniciarPasso(); });
$('#btn-continue').addEventListener('click', () => { P = carregar(); iniciarPasso(); });
$('#btn-new').addEventListener('click', () => {
  perguntar('Novo personagem', 'Criar um novo personagem? O personagem salvo neste navegador será substituído.').then(ok => { if (ok) { P = novoPersonagem(); salvar(); iniciarPasso(); } });
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) importarJSON(f, ok => ok ? iniciarPasso() : avisar('Arquivo inválido', 'Não consegui ler esse arquivo. Use um JSON exportado por esta ficha.'));
  e.target.value = '';
});

function voltarCapa() { montarCapa(); mostrar('cover'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
$('#logo').addEventListener('click', voltarCapa);
$('#logo').style.cursor = 'pointer';

/* ---------- Som e modo Terror ---------- */
const svgBtn = n => `<svg class="bi" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONES[n]}</svg>`;
function atualizarToggles() {
  $('#btn-som').innerHTML = svgBtn(Som.mudo ? 'mudo' : 'som');
  $('#btn-som').setAttribute('aria-pressed', String(!Som.mudo));
  $('#btn-som').title = Som.mudo ? 'Ativar som' : 'Silenciar tudo';
  $('#btn-terror').innerHTML = svgBtn('olho');
  $('#btn-terror').setAttribute('aria-pressed', String(Som.terror));
  $('#btn-terror').title = Som.terror ? 'Desativar Modo Terror' : 'Ativar Modo Terror';
  $('#btn-terror').classList.toggle('on', Som.terror);
  document.body.classList.toggle('terror', Som.terror);
}
$('#btn-som').addEventListener('click', () => { Som.setMudo(!Som.mudo); atualizarToggles(); if (!Som.mudo) Som.confirmar(); });
$('#btn-terror').addEventListener('click', () => {
  Som.setTerror(!Som.terror); atualizarToggles();
  if (Som.terror) { document.body.classList.add('t-flash'); setTimeout(() => document.body.classList.remove('t-flash'), 900); }
});
window.onTick = () => Som.tick();
// primeiro toque libera o áudio do navegador; todo botão faz um clique sonoro
document.addEventListener('pointerdown', () => { Som.init(); if (Som.terror) Som.ambienteTerror(true); }, { once: true });
document.addEventListener('click', e => { if (e.target.closest('button') && !e.target.closest('#btn-som')) Som.click(); });

atualizarToggles();
(function init() { voltarCapa(); })();
