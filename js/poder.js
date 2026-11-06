// Escala de poder: patamares, progressão de Sequência, digestão de poção e ascensão.
const PATAMARES = [
  { id:'baixa',     nome:'Baixa Sequência', seqs:[9,8,7], cor:'#9aa3c0', desc:'Beyonder iniciante: poderes sutis, ainda vulnerável a armas, doenças e à própria loucura.' },
  { id:'media',     nome:'Média Sequência', seqs:[6,5],   cor:'#6fb4ff', desc:'Poderes notáveis. Já se destaca entre os Beyonders e domina a essência do Caminho.' },
  { id:'semideus',  nome:'Semideus',        seqs:[4],     cor:'#e6c36e', desc:'Transcende o humano. Corpo e mente mudam; poucos mortais conseguem enfrentá-lo.' },
  { id:'santo',     nome:'Santo',           seqs:[3],     cor:'#f5a24b', desc:'Poder de escala de cidade. Igrejas e Ordens o tratam como um ser sagrado — ou um desastre.' },
  { id:'anjo',      nome:'Anjo',            seqs:[2],     cor:'#ff8ad0', desc:'Seu domínio vira conceito. O corpo é mutável e a vontade molda o ambiente.' },
  { id:'reianjo',   nome:'Rei Anjo',        seqs:[1],     cor:'#ff5d5d', desc:'Um dos maiores seres do mundo; a um passo da divindade e perigosamente perto da perda de si.' },
  { id:'divindade', nome:'Divindade',       seqs:[0],     cor:'#ffffff', desc:'Sequência 0. Um verdadeiro deus: o Caminho inteiro responde ao seu nome.' },
];
const patamarDe = seq => PATAMARES.find(p => p.seqs.includes(seq));
const idxPatamar = seq => PATAMARES.indexOf(patamarDe(seq));

// nome da Sequência: o que o jogador escreveu; senão o nome oficial da 9; senão o patamar (ou "Sequência N")
function nomeSeq(seq, rotulo = false) {
  if (P.nomesSeq && P.nomesSeq[seq]) return P.nomesSeq[seq];
  if (seq === 9 && P.caminho) return caminhoPorId(P.caminho).seq9;
  return rotulo ? `Sequência ${seq}` : patamarDe(seq).nome;
}

// bônus acumulados por ascensão: o atributo do Caminho cresce primeiro
function bonusSeq(k) {
  const c = P.caminho && caminhoPorId(P.caminho), s = P.sequencia, main = c && c.attr === k;
  let b = 0;
  if (s <= 6 && main) b++;
  if (s <= 4) b++;
  if (s <= 3 && main) b++;
  if (s <= 2) b++;
  if (s <= 1 && main) b++;
  if (s === 0) b++;
  return b;
}

const DIG_MAX = 10;
const NOTAS_DIG = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319];

function frascoSVG(nivel, cor) {
  const y = 150 - (nivel / DIG_MAX) * 96;
  const forma = 'M44 8h32v8h-5v38l33 72a16 16 0 01-14 22H30a16 16 0 01-14-22l33-72V16h-5z';
  return `<svg class="frasco" viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
    <defs><clipPath id="fc"><path d="${forma}"/></clipPath>
      <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".95"/><stop offset="1" stop-color="${cor}" stop-opacity=".45"/></linearGradient></defs>
    <path d="${forma}" fill="#0d0b1f" stroke="${cor}" stroke-width="2.5"/>
    <g clip-path="url(#fc)"><g class="liq" style="transform:translateY(${y}px)">
      <path class="onda" d="M-60 0q15-9 30 0t30 0 30 0 30 0 30 0 30 0 30 0v90h-210z" fill="url(#fl)"/></g>
      <circle class="bolha b1" cx="48" cy="140" r="3" fill="#fff" opacity=".5"/><circle class="bolha b2" cx="70" cy="146" r="2" fill="#fff" opacity=".4"/><circle class="bolha b3" cx="58" cy="150" r="2.5" fill="#fff" opacity=".4"/></g>
    <path d="M44 8h32" stroke="${cor}" stroke-width="3" stroke-linecap="round"/>
    <path d="M26 112l-5 10" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function ladderHTML() {
  let h = '';
  for (let s = 9; s >= 0; s--) {
    const pt = patamarDe(s), cl = s === P.sequencia ? 'atual' : s > P.sequencia ? 'passado' : 'futuro';
    h += `<div class="deg ${cl}" style="--tc:${pt.cor}" title="${pt.nome}"><span class="n">${s}</span><span class="t">${s > P.sequencia ? '✓' : pt.nome.replace(' Sequência', '')}</span></div>`;
  }
  return h;
}

// ---------- Ascensão ----------
function atributosSnapshot() { const o = {}; ATTRS.forEach(a => o[a.key] = total(a.key)); return o; }

function ascender(forcado, perda) {
  if (P.sequencia <= 0) return;
  if (document.querySelector('[data-asc]')) return;        // já existe uma ascensão em andamento: cliques e Enter repetidos não valem
  const antes = atributosSnapshot(), pvA = pvMax(), espA = espMax(), velho = P.sequencia, patVelho = patamarDe(velho);
  P.sequencia--; P.digestao = 0;
  const novo = P.sequencia, pat = patamarDe(novo), mudou = pat.id !== patVelho.id, depois = atributosSnapshot();
  P.pv = pvMax();
  if (forcado) P.san = Math.max(0, P.san - perda); else P.san = Math.min(sanMax(), P.san + 3);
  salvar();
  const ganhos = [`+${pvMax() - pvA} PV`, `+${espMax() - espA} Espiritualidade`];
  ATTRS.forEach(a => { if (depois[a.key] > antes[a.key]) ganhos.push(`+${depois[a.key] - antes[a.key]} ${a.nome}`); });
  mostrarAscensao({ velho, novo, pat, mudou, forcado, perda, ganhos, fim: P.san === 0 && forcado });
}

function mostrarAscensao(o) {
  const c = caminhoPorId(P.caminho), k = idxPatamar(o.novo), terror = Som.terror || o.forcado;
  const el0 = document.createElement('div');
  el0.className = 'asc' + (terror ? ' terror' : '') + (o.mudou ? ' patamar' : ''); el0.dataset.asc = '1';
  el0.style.cssText = `--pc:${terror ? '#e0283a' : c.cor};--pt:${terror ? '#ff4a5a' : o.pat.cor};--k:${k + 1}`;
  el0.innerHTML = `<div class="asc-rays"></div><div class="asc-ring r1"></div><div class="asc-ring r2"></div><div class="asc-ring r3"></div>
    <div class="asc-core">
      <img class="asc-sig" src="img/sigilos/${c.id}.webp" alt="">
      <div class="asc-num"><span class="old">${o.velho}</span><span class="new">${o.novo}</span></div>
      <p class="asc-eyebrow">${o.forcado ? 'ASCENSÃO FORÇADA' : 'ASCENSÃO'}</p>
      <h2 class="asc-nome">${esc(nomeSeq(o.novo, true))}</h2>
      ${o.mudou ? `<div class="asc-pat"><small>NOVO PATAMAR</small><b>${o.pat.nome}</b></div>` : `<div class="asc-pat sem"><b>${o.pat.nome}</b></div>`}
      <p class="asc-ganhos">${o.ganhos.map(g => `<span>${g}</span>`).join('')}</p>
      ${o.forcado ? `<p class="asc-aviso">A poção não estava digerida. A mente cobra o preço: <b>−${o.perda} Sanidade</b>${o.fim ? ' — <b>PERDA DE CONTROLE</b>' : ''}.</p>` : ''}
      <button class="primary" id="asc-ok">Continuar</button></div>`;
  document.body.appendChild(el0);
  const btnOk = el0.querySelector('#asc-ok'); btnOk.disabled = true;     // o botão só vale quando aparece na animação (evita Enter repetido pular a cerimônia)
  const devolver = prenderFoco(el0, null);
  el0.tabIndex = -1; el0.focus();
  setTimeout(() => { btnOk.disabled = false; btnOk.focus(); }, 4300);
  requestAnimationFrame(() => el0.classList.add('on'));
  Som.ascender(k, terror); Efeitos.tocar(c.id, terror);
  const fechar = () => { el0.classList.remove('on'); setTimeout(() => { el0.remove(); devolver(); renderFicha($('#step-body')); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 500); };
  el0.querySelector('#asc-ok').addEventListener('click', fechar);
}

// Modal de risco ao tentar subir sem digerir a poção
function ascensaoArriscada() {
  if (document.querySelector('.asc')) return;
  const m = document.createElement('div'); m.className = 'asc risco on';
  m.innerHTML = `<div class="asc-core"><p class="asc-eyebrow">ATENÇÃO</p><h2 class="asc-nome">A poção ainda não foi digerida</h2>
    <p class="asc-aviso">Ascender agora é possível, mas a mente paga: role <b>2d6</b> e perca essa quantidade de Sanidade. Se ela chegar a zero, é <b>perda de controle</b>.</p>
    <div class="risco-dados"></div>
    <div class="cover-btns"><button id="rk-sim" class="primary" data-ic="dado">Arriscar e rolar</button><button id="rk-nao" class="ghost">Voltar e digerir</button></div></div>`;
  document.body.appendChild(m);
  const sair = () => { m.remove(); devolver(); }, devolver = prenderFoco(m, () => { if (!m.dataset.travado) sair(); });   // depois de rolar, não dá mais para desistir
  m.querySelector('#rk-nao').addEventListener('click', sair);
  m.querySelector('#rk-sim').addEventListener('click', async () => {
    const btn = m.querySelector('#rk-sim'); btn.disabled = true; m.dataset.travado = '1'; m.querySelector('#rk-nao').disabled = true; Som.dado();
    const v = [d(6), d(6)], tray = m.querySelector('.risco-dados'); tray.innerHTML = '';
    await Promise.all(v.map(x => { const dd = criarDado(); tray.appendChild(dd); return mostrarFace(dd, x, true); }));
    tray.insertAdjacentHTML('beforeend', `<b class="rk-total">= ${v[0] + v[1]}</b>`);
    setTimeout(() => { m.remove(); ascender(true, v[0] + v[1]); }, 1100);
  });
}
