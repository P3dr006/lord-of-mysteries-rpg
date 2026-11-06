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
  $('#btn-prev').disabled = P.step === 0;
  $('#btn-next').hidden = P.step === STEPS.length - 1;
  $('#btn-next').disabled = !s.valido();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function atualizarNext() { $('#btn-next').disabled = !STEPS[P.step].valido(); }

function renderStepper() {
  const ol = $('#stepper');
  ol.innerHTML = '';
  STEPS.forEach((s, i) => {
    const li = el('li', i === P.step ? 'on' : i < P.step ? 'done' : '', `${i + 1}. ${s.nome}`);
    ol.appendChild(li);
  });
}

/* ---------- Passo 1: Identidade ---------- */
function renderIdentidade(body) {
  body.innerHTML = `
    <h3>Quem é o seu Beyonder?</h3>
    <div class="grid2">
      <div class="field"><label>Nome do personagem *</label><input type="text" id="f-nome" value="${esc(P.nome)}" placeholder="Ex.: Klein Moretti"></div>
      <div class="field"><label>Jogador</label><input type="text" id="f-jogador" value="${esc(P.jogador)}"></div>
      <div class="field"><label>Idade</label><input type="text" id="f-idade" value="${esc(P.idade)}"></div>
      <div class="field"><label>Gênero</label><input type="text" id="f-genero" value="${esc(P.genero)}"></div>
    </div>
    <div class="field"><label>Aparência</label><textarea id="f-aparencia">${esc(P.aparencia)}</textarea></div>
    <div class="field"><label>História</label><textarea id="f-historia">${esc(P.historia)}</textarea></div>`;
  const bind = (id, key) => $(id).addEventListener('input', e => { P[key] = e.target.value; salvar(); atualizarNext(); });
  bind('#f-nome', 'nome'); bind('#f-jogador', 'jogador'); bind('#f-idade', 'idade');
  bind('#f-genero', 'genero'); bind('#f-aparencia', 'aparencia'); bind('#f-historia', 'historia');
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
    <div class="attr-list" id="attr-list"></div>`;
  const list = $('#attr-list');
  ATTRS.forEach(a => {
    const row = el('div', 'attr-row');
    row.id = 'row-' + a.key;
    row.innerHTML = `
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
  tot.innerHTML = animar ? '…' : `${r.total}<small>mod ${mod(r.total) >= 0 ? '+' : ''}${mod(r.total)}</small>`;
  const fim = Promise.all(dados).then(() => {
    tot.innerHTML = `${r.total}<small>mod ${mod(r.total) >= 0 ? '+' : ''}${mod(r.total)}</small>`;
    if (!P.relanceUsado) {
      const b = el('button', 'ghost', 'Relance'); b.dataset.ic = 'relance';
      b.title = 'Usa a Relance do Destino (uma vez)';
      b.addEventListener('click', () => relancer(key));
      tray.appendChild(b);
    }
  });
  return fim;
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
  return `<div class="sig">${sigilo(c, 56)}<div><h4>${c.nome}</h4><span class="badge">Sequência 9 · ${c.seq9}</span></div></div>
    <p>${c.desc}</p><ul>${c.hab.map(h => `<li>${h}</li>`).join('')}</ul>
    <p class="bonus">Bônus do Caminho: +2 em ${at.nome}</p>`;
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
      const e = el('button', 'opt', `<span class="ic">${medalhao(r, 76)}</span><b>${r.nome}</b><small>${r.desc}</small>
        <span class="bn">${fmtBonus(r.bonus)}</span><em>${r.traco}</em>`);
      e.dataset.id = r.id; e.style.setProperty('--c', r.cor);
      e.addEventListener('click', () => { P.raca = r.id; salvar(); marcar(); });
      box.appendChild(e);
    });
  });
  ORIGENS.forEach(o => {
    const e = el('button', 'opt', `<span class="ic">${medalhao(o, 76)}</span><b>${o.nome}</b>
      <small>${o.itens.join(' · ')}</small><span class="bn">£ ${o.libras}</span><em>${o.perk}</em>`);
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
function carta(tipo, titulo) {
  return `<div class="dcard" id="dc-${tipo}"><div class="dc-inner">
    <div class="dc-face dc-back"><div class="dc-sym">✦</div><div class="dc-t">${titulo}</div><div class="dc-n" id="dn-${tipo}">?</div></div>
    <div class="dc-face dc-front" id="df-${tipo}"></div></div></div>`;
}

function renderDestino(body) {
  body.innerHTML = `
    <h3>Cartas de Destino</h3>
    <p class="hint">Cada carta é tirada uma única vez. O traço é um dom (ou fardo); o artefato selado traz dádiva e maldição.</p>
    <div class="dcards">
      <div>${carta('traco', 'd12 · Traço')}<button id="btn-traco" class="primary" data-ic="carta">Tirar traço</button></div>
      <div>${carta('art', 'd10 · Artefato')}<button id="btn-art" class="primary" data-ic="carta">Tirar artefato</button></div>
    </div>`;
  const mostrar = (tipo, idx, animar) => {
    const c = $('#dc-' + tipo), f = $('#df-' + tipo);
    if (tipo === 'traco') { const t = TRACOS[idx]; f.innerHTML = `<div class="dc-n">${idx + 1}</div><h4>${t.t}</h4><p>${t.d}</p>`; }
    else { const a = ARTEFATOS[idx]; f.innerHTML = `<div class="dc-n">${idx + 1}</div><h4>${a.n}</h4><p><b class="ok">Dádiva:</b> ${a.dadiva}</p><p><b class="bad">Maldição:</b> ${a.maldicao}</p>`; }
    if (!animar) c.style.transition = 'none'; else Som.carta();
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
}

function renderFicha(body) {
  ensureVitais();
  const attrs = ATTRS.map(a => {
    const t = total(a.key);
    return `<div class="stat"><div class="m">${a.nome}</div><div class="v">${t}</div><div class="m">mod ${mod(t) >= 0 ? '+' : ''}${mod(t)}</div></div>`;
  }).join('');
  body.innerHTML = `
    <div class="sheet-head">
      <div>
        <h2>${esc(P.nome)}</h2>
        ${P.caminho ? `<span class="badge">${sigilo(caminhoPorId(P.caminho), 14)} ${caminhoPorId(P.caminho).nome}</span> ` : ''}<span class="badge">Sequência ${P.sequencia} · ${SEQ_NAMES[P.sequencia]}${P.caminho ? ' · ' + caminhoPorId(P.caminho).seq9 : ''}</span>
        <div class="hint">${[P.jogador && 'Jogador: ' + esc(P.jogador), P.idade && esc(P.idade) + ' anos', esc(P.genero)].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
    ${(() => { const r = racaPorId(P.raca), o = origemPorId(P.origem); return `
      <div class="emblems">${medalhao(r, 56)}<div><b>${r.nome}</b><div class="hint">${fmtBonus(r.bonus)}</div></div>${medalhao(o, 56)}<div><b>${o.nome}</b><div class="hint">£ ${o.libras}</div></div></div>
      <p class="note">${r.traco}<br>${o.perk}</p>`; })()}
    <h3>Atributos</h3>
    <div class="stat-grid">${attrs}</div>
    <h3>Vitais</h3>
    <div class="stat-grid">
      ${contador('pv', 'Pontos de Vida', P.pv, pvMax())}
      ${contador('san', 'Sanidade', P.san, sanMax())}
      <div class="stat"><div class="m">Espiritualidade</div><div class="v">${espMax()}</div><div class="m">máx.</div></div>
    </div>
    <h3>Equipamento</h3>
    <p class="note">${origemPorId(P.origem).itens.map(esc).join(' · ')} — £ ${origemPorId(P.origem).libras}</p>
    <h3>Destino</h3>
    <div class="grid2">
      <div class="stat" style="text-align:left"><div class="m">Traço (d12 → ${P.traco + 1})</div><b>${TRACOS[P.traco].t}</b><p class="note">${TRACOS[P.traco].d}</p></div>
      <div class="stat" style="text-align:left"><div class="m">Artefato selado (d10 → ${P.artefato + 1})</div><b>${ARTEFATOS[P.artefato].n}</b>
        <p class="note"><b class="ok">Dádiva:</b> ${ARTEFATOS[P.artefato].dadiva}<br><b class="bad">Maldição:</b> ${ARTEFATOS[P.artefato].maldicao}</p></div>
    </div>
    ${P.aparencia ? `<h3>Aparência</h3><p class="note">${esc(P.aparencia)}</p>` : ''}
    ${P.historia ? `<h3>História</h3><p class="note">${esc(P.historia)}</p>` : ''}
    <h3>Notas de sessão</h3>
    <textarea id="f-notas" placeholder="Anotações da campanha...">${esc(P.notas)}</textarea>
    <div class="sheet-actions">
      <button id="btn-export" class="primary" data-ic="baixar">Exportar JSON</button>
    </div>`;
  body.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.c, delta = +b.dataset.d, max = k === 'pv' ? pvMax() : sanMax();
    P[k] = Math.max(0, Math.min(max, P[k] + delta));
    salvar();
    $('#cv-' + k).textContent = P[k];
  }));
  $('#f-notas').addEventListener('input', e => { P.notas = e.target.value; salvar(); });
  $('#btn-export').addEventListener('click', exportarJSON);
}

function contador(k, nome, v, max) {
  return `<div class="stat"><div class="m">${nome}</div>
    <div class="v"><span id="cv-${k}">${v}</span><span class="m"> / ${max}</span></div>
    <div class="counter"><button data-c="${k}" data-d="-1">−</button><button data-c="${k}" data-d="1">+</button></div></div>`;
}

/* ---------- Navegação e inicialização ---------- */
$('#btn-next').addEventListener('click', () => { if (P.step < STEPS.length - 1) { P.step++; salvar(); iniciarPasso(); } });
$('#btn-prev').addEventListener('click', () => { if (P.step > 0) { P.step--; salvar(); iniciarPasso(); } });
$('#btn-start').addEventListener('click', () => { P = novoPersonagem(); salvar(); iniciarPasso(); });
$('#btn-continue').addEventListener('click', () => { P = carregar(); iniciarPasso(); });
$('#btn-new').addEventListener('click', () => {
  if (confirm('Criar um novo personagem? O atual salvo será substituído.')) { P = novoPersonagem(); salvar(); iniciarPasso(); }
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) importarJSON(f, ok => ok ? iniciarPasso() : alert('Arquivo JSON inválido.'));
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
