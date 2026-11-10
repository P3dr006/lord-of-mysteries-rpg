// Assistente de ficha dentro da mesa (Fase B2 de docs/SISTEMAS-DA-MESA.md, modo 2).
// O mestre liga "ficha montada na mesa": o jogador monta a ficha guiado pelas regras em vigor. Os atributos são rolados
// pelo SERVIDOR (rolar_ficha); aqui só mostramos o que ele rolou. A prévia usa Regras.calcular (o servidor refaz a conta).
// Caminhos: "Rolar uma nova" (servidor) ou "Trazer minha ficha" (convertida: os atributos do site, sempre aprovada pelo mestre).
const FichaMesa = Object.freeze((() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const METODO = { '4d6-menor': '4d6, descartando o menor', '3d6': '3d6 somados' };
  const PASSOS = [['atributos', 'Atributos'], ['origem', 'Origem'], ['selar', 'Selar']];
  let m = null, ctx = null, st = null, soltar = () => {}, antes = null;

  const faixa = R => { const g = R.geracao || {}; return { mn: Number.isInteger(g.min) ? g.min : 3, mx: Number.isInteger(g.max) ? g.max : 18 }; };
  // a ficha do site serve quando TODOS os atributos das regras existem nela, dentro do mínimo e do máximo
  function podeConverter(R, base) { const { mn, mx } = faixa(R), b = base || {}; return R.atributos.every(a => Number.isInteger(b[a.id]) && b[a.id] >= mn && b[a.id] <= mx); }
  const caminhoOk = id => typeof CAMINHOS !== 'undefined' && CAMINHOS.some(c => c.id === id) ? id : '';
  const racaOk = id => typeof RACAS !== 'undefined' && RACAS.some(r => r.id === id) ? id : '';
  const nomeAt = (R, id) => (R.atributos.find(a => a.id === id) || {}).nome || id;

  function abrir(c) {
    if (m) return;
    ctx = c; antes = document.activeElement;
    const fm = c.fm, continua = !!(fm && fm.estado === 'rolada' && !fm.liberada);
    st = { passo: continua ? 'origem' : 'inicio', modo: continua ? 'rolar' : '', base: continua ? fm.base : null, rolagens: continua ? fm.rolagens : null, revelar: false,
      caminho: caminhoOk(c.local.caminho), raca: racaOk(c.local.raca), ocupado: false, erro: '' };
    m = document.createElement('div'); m.className = 'fm-assist'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'fm-t');
    document.body.appendChild(m); document.body.classList.add('com-assistente');
    desenhar();
    soltar = typeof prenderFoco === 'function' ? prenderFoco(m, fechar) : () => {};
    focar();
  }
  function fechar() {
    if (!m || st.ocupado) return;
    soltar(); const el = m; m = null; document.body.classList.remove('com-assistente');
    el.classList.add('saindo'); setTimeout(() => el.remove(), 220);
    // o foco volta para quem abriu (o botão pode ter sido redesenhado: procura pelo id)
    const volta = antes && (antes.isConnected ? antes : antes.id && document.getElementById(antes.id)); if (volta) volta.focus();
    if (ctx.aoFechar) ctx.aoFechar();
  }
  const focar = () => setTimeout(() => { if (!m) return; const f = m.querySelector('[data-foco]') || m.querySelector('h2'); if (f) f.focus(); }, 60);

  // ---------- desenho ----------
  function passos() {
    const at = st.passo === 'inicio' || st.passo === 'rolar' ? 0 : st.passo === 'origem' ? 1 : 2;
    return `<ol class="fm-passos" aria-label="Passos da ficha">${PASSOS.map(([k, n], i) => `<li class="${i < at ? 'feito' : i === at ? 'agora' : ''}"${i === at ? ' aria-current="step"' : ''}><i aria-hidden="true">${i < at ? '✓' : i + 1}</i>${n}</li>`).join('')}</ol>`;
  }
  function desenhar() {
    if (!m) return;
    const R = ctx.regras, corpo = { inicio: telaInicio, rolar: telaRolar, origem: telaOrigem, selar: telaSelar }[st.passo](R);
    m.innerHTML = `<div class="fm-livro">
      <div class="fm-cab"><small class="fm-olho">Ficha da mesa <b>${esc(ctx.codigo)}</b></small><h2 id="fm-t" tabindex="-1">${esc(ctx.nome || 'Sua ficha')}</h2>${passos()}
        <button type="button" class="fm-b fm-x" id="fm-fechar" aria-label="Fechar o assistente" ${st.ocupado ? 'disabled' : ''}>×</button></div>
      <div class="fm-corpo">${corpo}</div>
      ${st.erro ? `<p class="fm-erro" role="alert">${esc(st.erro)}</p>` : ''}
    </div>`;
    m.querySelector('#fm-fechar').addEventListener('click', fechar);
    m.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)));
    const r = m.querySelector('#fm-rolar'); if (r) r.addEventListener('click', rolar);
    const s = m.querySelector('#fm-selar'); if (s) s.addEventListener('click', selar);
    m.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => { st.caminho = b.dataset.cam; redesenharMantendo(b, '[data-cam="' + b.dataset.cam + '"]'); }));
    m.querySelectorAll('[data-raca]').forEach(b => b.addEventListener('click', () => { st.raca = b.dataset.raca; redesenharMantendo(b, '[data-raca="' + b.dataset.raca + '"]'); }));
  }
  function redesenharMantendo(b, sel) { const g = m.querySelector('.fm-corpo'), y = g ? g.scrollTop : 0; desenhar(); const g2 = m.querySelector('.fm-corpo'); if (g2) g2.scrollTop = y; const n = m.querySelector(sel); if (n) n.focus(); }
  function ir(p) {
    if (p === 'converter') { st.modo = 'converter'; st.base = ctx.local.base; st.rolagens = null; p = 'origem'; }
    if (p === 'nova') { st.modo = 'rolar'; p = 'rolar'; }
    st.passo = p; st.erro = ''; desenhar(); focar();
  }

  function telaInicio(R) {
    const conv = podeConverter(R, ctx.local.base), { mn, mx } = faixa(R);
    const linha = R.atributos.map(a => { const v = (ctx.local.base || {})[a.id]; return `<span class="fm-mi${Number.isInteger(v) && v >= mn && v <= mx ? '' : ' falta'}"><span>${esc(a.abrev)}</span><b>${Number.isInteger(v) ? v : '—'}</b></span>`; }).join('');
    return `<p class="fm-intro">O mestre desta mesa monta as fichas aqui, com as regras dele. ${ctx.aprovar ? 'Ele aprova cada ficha antes de ela valer.' : ''}</p>
      <div class="fm-escolha">
        <button type="button" class="fm-b fm-op" data-ir="nova" data-foco>
          <span class="fm-op-ic" aria-hidden="true">⚄</span><b>Rolar uma ficha nova</b>
          <span>Os dados são rolados pelo servidor, uma vez só: ${esc(METODO[(R.geracao || {}).metodo] || 'dados da regra')}.</span></button>
        <button type="button" class="fm-b fm-op" data-ir="converter" ${conv ? '' : 'disabled aria-describedby="fm-nao-conv"'}>
          <span class="fm-op-ic" aria-hidden="true">❦</span><b>Trazer a ficha de ${esc(ctx.local.nome || 'agora')}</b>
          <span class="fm-mini">${linha}</span>
          <span id="fm-nao-conv">${conv ? 'Os atributos batem com as regras. O mestre sempre confere uma ficha trazida do site.' : `Os atributos desta ficha não batem com as regras da mesa (${R.atributos.length} atributos, de ${mn} a ${mx}).`}</span></button>
      </div>`;
  }

  function dadosHtml(d, total, metodo) {
    const arr = Array.isArray(d) ? d : [], menor = metodo === '3d6' || arr.length < 4 ? -1 : arr.indexOf(Math.min(...arr));
    return `<span class="fm-dados" aria-hidden="true">${arr.map((v, i) => `<i class="${i === menor ? 'fora' : ''}">${v}</i>`).join('')}</span><b class="fm-total">${total}</b>`;
  }
  function telaRolar(R) {
    const met = (R.geracao || {}).metodo, { mn, mx } = faixa(R);
    if (!st.base) return `<p class="fm-intro">Cada atributo é rolado com <b>${esc(METODO[met] || met || '4d6')}</b> e fica entre ${mn} e ${mx}. O servidor rola: ninguém rola de novo até tirar 18. Para refazer, só com o mestre.</p>
      <ul class="fm-ats vazio">${R.atributos.map(a => `<li><span>${esc(a.nome)}</span><b aria-hidden="true">?</b></li>`).join('')}</ul>
      <div class="fm-acoes"><button type="button" class="ghost" data-ir="inicio">Voltar</button><button type="button" class="primary" id="fm-rolar" data-ic="dado" data-foco ${st.ocupado ? 'disabled' : ''}>${st.ocupado ? 'Rolando…' : 'Rolar os atributos'}</button></div>`;
    return `<p class="fm-intro">O servidor rolou. ${met === '3d6' ? '' : 'O dado apagado é o menor, descartado.'}</p>
      <ul class="fm-ats ${st.revelar ? 'revela' : ''}" aria-label="Atributos rolados">${R.atributos.map((a, i) => `<li style="--i:${i}"><span>${esc(a.nome)}</span>${dadosHtml((st.rolagens || {})[a.id], st.base[a.id], met)}<span class="sr-only">${esc(a.nome)}: ${st.base[a.id]}</span></li>`).join('')}</ul>
      <div class="fm-acoes"><button type="button" class="primary" data-ir="origem" data-foco>Escolher a origem</button></div>`;
  }

  function telaOrigem(R) {
    const bo = R.bonus || {}, cam = bo.caminho || {}, rb = bo.raca || {};
    const chip = (id, v) => `<em class="${v < 0 ? 'neg' : ''}" title="${esc(nomeAt(R, id))}">${esc((R.atributos.find(a => a.id === id) || {}).abrev || id)} ${sinal(v)}</em>`;
    const cams = (typeof CAMINHOS !== 'undefined' ? CAMINHOS : []).map(c => { const at = (cam.atributo || {})[c.id], on = st.caminho === c.id;
      return `<button type="button" class="fm-b fm-c${on ? ' on' : ''}" data-cam="${esc(c.id)}" aria-pressed="${on}" style="--cc:${esc(c.cor)}"><img src="img/sigilos/${esc(c.id)}.webp" alt="" width="34" height="34" loading="lazy"><b>${esc(c.nome)}</b>${at && Number.isInteger(cam.valor) && cam.valor ? chip(at, cam.valor) : ''}</button>`; }).join('');
    const racas = (typeof RACAS !== 'undefined' ? RACAS : []).map(r => { const on = st.raca === r.id, b = rb[r.id] || {};
      return `<button type="button" class="fm-b fm-r${on ? ' on' : ''}" data-raca="${esc(r.id)}" aria-pressed="${on}"><span aria-hidden="true">${esc(r.icone)}</span><b>${esc(r.nome)}</b><span class="fm-chips">${Object.entries(b).map(([k, v]) => chip(k, v)).join('')}</span></button>`; }).join('');
    const nenhum = (k, on) => `<button type="button" class="fm-b fm-${k === 'cam' ? 'c' : 'r'} fm-nenhum${on ? ' on' : ''}" data-${k === 'cam' ? 'cam' : 'raca'}="" aria-pressed="${on}"><b>Ainda não</b></button>`;
    return `<h3 class="fm-sub" id="fm-tc">Caminho</h3><div class="fm-grade" role="group" aria-labelledby="fm-tc">${cams}${nenhum('cam', !st.caminho)}</div>
      <h3 class="fm-sub" id="fm-tr">Raça</h3><div class="fm-grade fm-racas" role="group" aria-labelledby="fm-tr">${racas}${nenhum('raca', !st.raca)}</div>
      <div class="fm-acoes">${st.modo === 'converter' ? '<button type="button" class="ghost" data-ir="inicio">Voltar</button>' : ''}<button type="button" class="primary" data-ir="selar" data-foco>Ver a ficha pronta</button></div>`;
  }

  function telaSelar(R) {
    let c; try { c = Regras.calcular(R, { base: st.base, caminhoId: st.caminho, racaId: st.raca, seq: Number.isInteger(ctx.local.seq) ? ctx.local.seq : 9 }); } catch (e) { c = { attrs: {}, mods: {}, maximos: {} }; }
    const pend = ctx.aprovar || st.modo === 'converter';
    const cam = caminhoOk(st.caminho) && CAMINHOS.find(x => x.id === st.caminho), rc = racaOk(st.raca) && RACAS.find(x => x.id === st.raca);
    return `<p class="fm-intro">${cam ? `<b>${esc(cam.nome)}</b>` : 'Sem Caminho'} · ${rc ? `${esc(rc.icone)} <b>${esc(rc.nome)}</b>` : 'sem raça'}${st.modo === 'converter' ? ' · <i>ficha trazida do site</i>' : ''}</p>
      <table class="fm-tab"><caption class="sr-only">Prévia da ficha</caption><thead><tr><th scope="col">Atributo</th><th scope="col">Dado</th><th scope="col">Total</th><th scope="col">Mod.</th></tr></thead>
      <tbody>${R.atributos.map(a => { const b = st.base[a.id], t = c.attrs[a.id], md = c.mods[a.id];
        return `<tr><th scope="row">${esc(a.nome)}</th><td>${b ?? '—'}</td><td>${t ?? '—'}${t != null && b != null && t !== b ? ` <small class="${t < b ? 'neg' : ''}">(${sinal(t - b)})</small>` : ''}</td><td class="fm-mod">${md == null ? '—' : sinal(md)}</td></tr>`; }).join('')}</tbody></table>
      ${(R.recursos || []).length ? `<ul class="fm-rec" aria-label="Recursos">${R.recursos.map(r => `<li style="--rc:${/^#[0-9a-f]{6}$/i.test(r.cor || '') ? r.cor : '#d9b86a'}"><span>${esc(r.nome)}</span><b>${c.maximos[r.id] ?? '—'}</b></li>`).join('')}</ul>` : ''}
      <p class="fm-nota">${pend ? (st.modo === 'converter' ? 'Ficha trazida do site: o mestre confere antes de valer.' : 'O mestre aprova antes de a ficha valer.') + ' Até lá, seus testes vão sem modificador.' : 'Ao selar, a ficha vale na hora. O servidor refaz a conta com as regras da mesa.'}</p>
      <div class="fm-acoes"><button type="button" class="ghost" data-ir="origem">Voltar</button><button type="button" class="primary" id="fm-selar" data-foco ${st.ocupado ? 'disabled' : ''}>${st.ocupado ? 'Enviando…' : pend ? 'Enviar ao mestre' : 'Selar a ficha'}</button></div>`;
  }

  // ---------- ações (o servidor decide) ----------
  async function rolar() {
    if (st.ocupado) return;
    st.ocupado = true; st.erro = ''; desenhar();
    try {
      const r = await ctx.rolar();
      st.base = r.base; st.rolagens = r.rolagens; st.metodo = r.metodo; st.revelar = true;
      if (typeof Som === 'object') { try { Som.dado(); } catch (e) { /* sem som */ } }
      if (ctx.anunciar) ctx.anunciar('Atributos rolados: ' + ctx.regras.atributos.map(a => a.nome + ' ' + r.base[a.id]).join(', '));
      if (ctx.aoRolar) ctx.aoRolar(r);
    } catch (e) { st.erro = ctx.mensagem(e); }
    st.ocupado = false; desenhar(); focar();
  }
  async function selar() {
    if (st.ocupado) return;
    st.ocupado = true; st.erro = ''; desenhar();
    try {
      const estado = st.modo === 'converter' ? await ctx.converter(st.base, st.caminho, st.raca) : await ctx.enviar(st.caminho, st.raca);
      st.ocupado = false;
      const fim = { estado, modo: st.modo, base: st.base, rolagens: st.rolagens, metodo: st.metodo || (ctx.regras.geracao || {}).metodo, caminho: st.caminho, raca: st.raca };
      fechar();
      if (ctx.aoTerminar) ctx.aoTerminar(fim);
      return;
    } catch (e) { st.erro = ctx.mensagem(e); }
    st.ocupado = false; desenhar(); focar();
  }

  return { abrir, fechar, podeConverter, get aberto() { return !!m; } };
})());
