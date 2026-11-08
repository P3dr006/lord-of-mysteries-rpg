// Mesa do Destino: dados flutuantes (d4–d100, d22), vantagem, testes de atributo e de sanidade.
const Mesa = Object.freeze((() => {
  const LADOS = [4, 6, 8, 10, 12, 20, 22, 100];
  const soma = v => v.reduce((a, b) => a + b, 0);
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const PADRAO = { lados: 20, qtd: 1, mod: 0, modo: 'normal' };
  // @ts-expect-error o objeto é preenchido com os padrões logo em seguida
  const cfg = () => { if (!P.mesa || typeof P.mesa !== 'object') P.mesa = {}; for (const k in PADRAO) if (P.mesa[k] === undefined) P.mesa[k] = PADRAO[k]; return P.mesa; };
  let aberta = false, rolando = false, aba = 'livre', ultimo = null;

  // ---------- dados em forma de pedra (SVG) ----------
  const FORMAS = {
    4: '<polygon points="50,8 94,88 6,88"/><path d="M50 8v52M6 88l44-28M94 88L50 60" class="in"/>',
    6: '<rect x="10" y="10" width="80" height="80" rx="15"/><path d="M10 10l14 14M90 10L76 24M10 90l14-14M90 90L76 76" class="in"/>',
    8: '<polygon points="50,4 93,50 50,96 7,50"/><path d="M7 50h86M50 4v92" class="in"/>',
    10: '<polygon points="50,4 94,40 50,96 6,40"/><path d="M6 40l44 12 44-12M50 52v44" class="in"/>',
    12: '<polygon points="50,5 95,38 78,92 22,92 5,38"/><path d="M50 5v24M95 38L72 46M78 92L64 70M22 92l14-22M5 38l23 8M28 46l8 24h28l8-24-22-17z" class="in"/>',
    20: '<polygon points="50,4 92,27 92,73 50,96 8,73 8,27"/><path d="M50 4v26M92 27L68 40M92 73L68 60M50 96V70M8 73l24-13M8 27l24 13M32 40l36 0 0 0M32 40l18 30 18-30z" class="in"/>',
    22: '<circle cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="36" class="in"/>' + Array.from({ length: 22 }, (_, i) => { const a = i / 22 * Math.PI * 2; return `<path d="M${50 + Math.cos(a) * 36} ${50 + Math.sin(a) * 36}L${50 + Math.cos(a) * 45} ${50 + Math.sin(a) * 45}" class="in"/>`; }).join(''),
    100: '<polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30"/><path d="M30 5l12 18h16l12-18M5 30l18 12v16L5 70M95 30L77 42v16l18 12M30 95l12-18h16l12 18" class="in"/>',
  };
  const dadoSVG = (l, txt, tam = 64, extra = '') => {
    const t = String(txt), fs = t.length >= 3 ? 24 : t.length === 2 ? 32 : 38, y = l === 4 ? 70 : 60;
    return `<svg class="dado-svg ${extra}" viewBox="0 0 100 100" width="${tam}" height="${tam}" aria-hidden="true"><g class="forma">${FORMAS[l]}</g><text x="50" y="${y}" text-anchor="middle" font-size="${fs}" class="dv">${t}</text></svg>`;
  };
  const icone = n => `<svg class="bi" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${n}</svg>`;

  // ---------- construção da interface ----------
  function montar() {
    if (document.querySelector('#fab-mesa')) return;
    const defs = document.createElement('div');
    defs.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3080"/><stop offset="1" stop-color="#0f0c26"/></linearGradient></defs></svg>`;
    document.body.appendChild(defs.firstChild);
    const fab = document.createElement('button');
    fab.id = 'fab-mesa'; fab.className = 'fab-mesa'; fab.type = 'button'; fab.setAttribute('aria-label', 'Abrir a Mesa do Destino'); fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = `<span class="fab-d">${dadoSVG(20, '', 38, 'fab-svg')}</span><span class="fab-n" id="fab-n" hidden></span>`;
    document.body.appendChild(fab);
    const m = document.createElement('section');
    m.id = 'mesa'; m.className = 'mesa'; m.hidden = true; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Mesa do Destino');
    m.innerHTML = `
      <div class="mesa-h"><div class="mesa-tt"><small>Mesa do</small><b>Destino</b></div>
        <div class="modo" role="group" aria-label="Modo da rolagem">${[['normal', 'Normal'], ['vantagem', 'Vantagem'], ['desvantagem', 'Desvantagem']].map(([k, n]) => `<button type="button" class="seg" data-modo="${k}">${n}</button>`).join('')}</div>
        <button type="button" class="icon mesa-x" id="mesa-x" aria-label="Fechar a mesa"><svg class="bi" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="feltro" id="feltro"><svg class="f-anel" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="fr" d="M100 100m-86 0a86 86 0 1 1 172 0a86 86 0 1 1-172 0"/></defs><g class="f-g"><text><textPath href="#fr" textLength="530" lengthAdjust="spacing">${RUNAS}</textPath></text></g><circle cx="100" cy="100" r="70" fill="none" stroke="#d9b86a" stroke-opacity=".25"/></svg>
        <div class="dados-mesa" id="dados-mesa"><p class="vazio-mesa">Escolha os dados e role.</p></div>
        <div class="resultado" id="resultado" role="status" aria-live="polite" hidden></div></div>
      <nav class="abas" role="tablist"><button type="button" role="tab" class="aba on" data-aba="livre">Dados</button><button type="button" role="tab" class="aba" data-aba="testes">Testes</button><button type="button" role="tab" class="aba" data-aba="registro">Registro</button></nav>
      <div class="mesa-corpo" id="mesa-corpo"></div>`;
    document.body.appendChild(m);
    fab.addEventListener('click', () => alternar());
    m.querySelector('#mesa-x').addEventListener('click', () => alternar(false));
    m.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => { cfg().modo = b.dataset.modo; salvar(); marcarModo(); }));
    m.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => { aba = b.dataset.aba; m.querySelectorAll('.aba').forEach(x => x.classList.toggle('on', x === b)); corpo(); }));
    document.addEventListener('keydown', e => { if (!aberta) return; if (e.key === 'Escape') alternar(false); });
    marcarModo(); corpo();
  }
  const marcarModo = () => document.querySelectorAll('#mesa .seg').forEach(b => b.classList.toggle('on', b.dataset.modo === cfg().modo));

  function alternar(v) {
    aberta = v === undefined ? !aberta : v; const m = $('#mesa'), fab = $('#fab-mesa');
    m.hidden = !aberta; fab.setAttribute('aria-expanded', String(aberta)); document.body.classList.toggle('mesa-aberta', aberta);
    if (aberta) { Dado3D.preparar(); marcarModo(); corpo(); Som.click(); setTimeout(() => (m.querySelector('.rolar') || m.querySelector('#mesa-x')).focus(), 60); } else fab.focus();
  }

  // ---------- abas ----------
  function corpo() {
    const c = $('#mesa-corpo'), k = cfg();
    if (aba === 'livre') {
      c.innerHTML = `
        <div class="lbl">Dado</div>
        <div class="tipos">${LADOS.map(l => `<button type="button" class="tipo ${k.lados === l ? 'on' : ''}" data-l="${l}" aria-label="${l === 100 ? 'd% (d100)' : 'd' + l}"${l === 22 ? ' title="O dado da constelação"' : ''}>${dadoSVG(l, '', 34)}<span>d${l === 100 ? '%' : l}</span></button>`).join('')}</div>
        <div class="steppers">
          <div class="step"><span>Quantidade</span><div><button type="button" class="mini" data-s="qtd" data-d="-1" aria-label="Menos dados">−</button><b id="v-qtd">${k.qtd}</b><button type="button" class="mini" data-s="qtd" data-d="1" aria-label="Mais dados">+</button></div></div>
          <div class="step"><span>Modificador</span><div><button type="button" class="mini" data-s="mod" data-d="-1" aria-label="Diminuir modificador">−</button><b id="v-mod">${sinal(k.mod)}</b><button type="button" class="mini" data-s="mod" data-d="1" aria-label="Aumentar modificador">+</button></div></div>
        </div>
        <button type="button" class="primary rolar" id="rolar" data-ic="dado">${rotuloLivre()}</button>`;
      c.querySelectorAll('.tipo').forEach(b => b.addEventListener('click', () => { k.lados = +b.dataset.l; salvar(); c.querySelectorAll('.tipo').forEach(x => x.classList.toggle('on', x === b)); $('#rolar').lastChild.textContent = rotuloLivre(); Som.tick(); }));
      c.querySelectorAll('.mini').forEach(b => b.addEventListener('click', () => { const s = b.dataset.s, d2 = +b.dataset.d; if (s === 'qtd') k.qtd = Math.max(1, Math.min(10, k.qtd + d2)); else k.mod = Math.max(-20, Math.min(20, k.mod + d2)); salvar(); $('#v-qtd').textContent = k.qtd; $('#v-mod').textContent = sinal(k.mod); $('#rolar').lastChild.textContent = rotuloLivre(); Som.tick(); }));
      $('#rolar').addEventListener('click', () => rolar({ lados: k.lados, qtd: k.qtd, mod: k.mod, rotulo: rotuloLivre() }));
    } else if (aba === 'testes') {
      const tem = ATTRS.every(a => P.attrs && P.attrs[a.key]);
      // a mesa online (código do mestre e pedidos) fica sempre no topo: é o que o jogador procura primeiro
      c.innerHTML = `<div class="online topo" id="online"></div>
        <div class="lbl">Teste de atributo <i>d20 + modificador${k.mod ? ` ${sinal(k.mod)}` : ''}</i></div>
        ${tem ? '' : '<p class="hint">Role os atributos do personagem para liberar os testes.</p>'}
        <div class="attrs-mesa">${ATTRS.map(a => `<button type="button" class="attr-b" data-a="${a.key}" style="--ac:${a.cor}" ${tem ? '' : 'disabled'}>${iconeAttr(a, 22)}<span>${a.nome}</span><b>${tem ? sinal(mod(total(a.key))) : '—'}</b></button>`).join('')}</div>
        <div class="lbl">Mente</div>
        <div class="san-teste"><div><b>Teste de Sanidade</b><small>d20 + Presença. A dificuldade e o que acontece com sua Sanidade quem decide é o mestre.</small></div><button type="button" class="primary" id="t-san" ${tem ? '' : 'disabled'} data-ic="olho">Rolar</button></div>
        <p class="hint">O mestre define a dificuldade e o resultado.</p>`;
      const ts = $('#t-san'); if (ts) ts.addEventListener('click', testeSanidade);
      if (typeof Jogador === 'object') Jogador.desenhar($('#online'));
      c.scrollTop = 0;
    } else {
      const h = P.historico || [];
      c.innerHTML = `<div class="lbl">Últimas rolagens ${h.length ? `<button type="button" class="link-remover" id="h-limpar">Limpar</button>` : ''}</div>` +
        (h.length ? `<ol class="hist">${h.map(r => `<li class="${r.res || ''}"><span class="h-t">${r.hora}</span><span class="h-r">${esc(r.rotulo)}<small>${esc(r.detalhe)}</small></span><b>${r.total}</b>${r.res ? `<em>${{ crit: '20 natural', fumble: '1 natural' }[r.res]}</em>` : ''}</li>`).join('')}</ol>` : '<p class="hint">Nenhuma rolagem ainda. Os dados que você rolar aparecem aqui.</p>');
      const l = $('#h-limpar'); if (l) l.addEventListener('click', () => { P.historico = []; salvar(); corpo(); });
    }
    if (typeof decorarTudo === 'function') decorarTudo();
  }
  const rotuloLivre = () => { const k = cfg(); return `Rolar ${k.qtd}d${k.lados}${k.mod ? sinal(k.mod) : ''}`; };

  // ---------- rolagem ----------
  const sorteio = (l, n) => Array.from({ length: n }, () => d(l));
  async function rolar(o) {
    if (rolando) return; rolando = true;
    // o.fixo: números já decididos (dado rolado no servidor a pedido do mestre); a animação só chega até eles
    const k = cfg(), modo = o.fixo ? 'normal' : k.modo, A = o.fixo ? o.fixo.slice(0, o.qtd) : sorteio(o.lados, o.qtd), B = modo === 'normal' ? null : sorteio(o.lados, o.qtd);
    let esc2 = 0; if (B) { const sa = soma(A), sb = soma(B); esc2 = modo === 'vantagem' ? (sb > sa ? 1 : 0) : (sb < sa ? 1 : 0); if (sa === sb) esc2 = 0; }
    const grupos = B ? [A, B] : [A], sel = grupos[esc2], sm = soma(sel), total = sm + o.mod;
    const nat = o.lados === 20 && o.qtd === 1 ? sel[0] : null, crit = nat === 20, fumble = nat === 1;
    let res = null; if (crit) res = 'crit'; else if (fumble) res = 'fumble';
    // mesa
    const mesa = $('#dados-mesa'), rz = $('#resultado'); rz.hidden = true; $('#feltro').classList.remove('crit', 'fumble', 'com-res'); mesa.innerHTML = '';
    const tam = (o.qtd > 6 ? 46 : o.qtd > 3 ? 56 : 70) * (B ? .78 : 1), els = [];
    // Dado 3D (js/dado3d.js): gira e pousa exatamente no número já decidido. Sem GSAP/3D (rede, "reduzir movimento"),
    // d10/d22/d100 ou erro, cai na animação 2D de sempre.
    let feito3d = false;
    if (Dado3D.LADOS.includes(o.lados) && await Dado3D.pronto(1500) && Dado3D.suporta(o.lados)) {
      try {
        const dd3 = [];
        grupos.forEach((g, gi) => { const linha = document.createElement('div'); linha.className = 'linha-dados' + (B && gi !== esc2 ? ' descartada' : ''); g.forEach((v, i) => { const x = Dado3D.criar(o.lados, tam); linha.appendChild(x.el); dd3.push([x, v, i, gi]); }); mesa.appendChild(linha); });
        Som.dado();
        await Promise.all(dd3.map(([x, v, i, gi]) => x.rolar(v, { atraso: i * 70 + gi * 120 }).then(() => Som.tick())));
        await new Promise(r => setTimeout(r, 350));
        feito3d = true;
      } catch (e) { mesa.innerHTML = ''; }   // qualquer falha no 3D: refaz com a animação 2D
    }
    if (!feito3d) {
      grupos.forEach((g, gi) => { const linha = document.createElement('div'); linha.className = 'linha-dados' + (B && gi !== esc2 ? ' descartada' : ''); g.forEach((v, i) => { const e = document.createElement('div'); e.className = 'dado rolando'; e.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); e.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); e.style.animationDelay = (i * 60 + gi * 120) + 'ms'; e.innerHTML = dadoSVG(o.lados, '?', tam); linha.appendChild(e); els.push([e, v, gi]); }); mesa.appendChild(linha); });
      Som.dado();
      const iv = setInterval(() => els.forEach(([e]) => { if (e.classList.contains('rolando')) e.querySelector('.dv').textContent = d(o.lados); }), 70);
      await new Promise(r => setTimeout(r, 1000 + o.qtd * 60));
      clearInterval(iv);
      // biome-ignore lint/correctness/noSelfAssign: reler o innerHTML reinicia a animacao do SVG (de proposito)
      els.forEach(([e, v, gi], i) => { setTimeout(() => { e.classList.remove('rolando'); e.classList.add('pousou'); e.querySelector('.dv').textContent = v; const sv = e.querySelector('svg'); sv.innerHTML = sv.innerHTML; Som.tick(); }, i * 70); });
      await new Promise(r => setTimeout(r, els.length * 70 + 250));
    }
    // resultado
    const det = grupos.map((g, gi) => `[${g.join(', ')}]${B ? (gi === esc2 ? ' ✓' : ' ✗') : ''}`).join(' ou ');
    const rotulo = o.rotulo, tipo = res;
    rz.className = 'resultado ' + (tipo || ''); rz.hidden = false;
    const txtRes = { crit: '20 NATURAL', fumble: '1 NATURAL' }[tipo] || '';
    const margem = '';
    rz.innerHTML = `<b class="rz-n">${total}</b><div class="rz-info"><small class="rz-r">${esc(rotulo)}</small><span class="rz-t">${txtRes}${margem}</span><small class="rz-d">${det}${o.mod ? ` ${sinal(o.mod)}` : ''}${o.nota ? ` · ${esc(o.nota)}` : ''}</small></div>`;
    $('#feltro').classList.add('com-res');
    if (crit) { $('#feltro').classList.add('crit'); Som.critico(); } else if (fumble) { $('#feltro').classList.add('fumble'); Som.falha(); const m = $('#mesa'); m.classList.add('treme'); setTimeout(() => m.classList.remove('treme'), 600); } else Som.resultado();
    // registro e badge
    P.historico = [{ hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), rotulo, detalhe: `${det}${o.mod ? ' ' + sinal(o.mod) : ''}`, total, res: tipo }, ...(P.historico || [])].slice(0, 30); salvar();
    anunciar(`${rotulo}: ${total}${txtRes ? ', ' + txtRes : ''}`);
    ultimo = total; const n = $('#fab-n'); n.hidden = false; n.textContent = total; n.className = 'fab-n ' + (tipo || '');
    rolando = false; return { total, res: tipo };
  }

  // Teste de Sanidade: apenas rola d20 + Presença. O mestre decide a dificuldade e a perda.
  function testeSanidade() { const k = cfg(); return rolar({ lados: 20, qtd: 1, mod: mod(total('pres')) + k.mod, rotulo: 'Teste de Sanidade', nota: `Presença ${sinal(mod(total('pres')))}` }); }
  // abre a mesa na aba Testes (pedido do mestre) e redesenha a aba quando está à vista
  function irParaTestes() { aba = 'testes'; document.querySelectorAll('#mesa .aba').forEach(x => x.classList.toggle('on', x.dataset.aba === 'testes')); if (!aberta) alternar(true); else corpo(); }
  const atualizar = () => { if (aberta && aba === 'testes') corpo(); };
  return { montar, alternar, rolar, irParaTestes, atualizar, get rolando() { return rolando; } };
})());
document.addEventListener('DOMContentLoaded', () => Mesa.montar());
