// Lado do jogador na mesa online: entrar com o código, receber pedidos do mestre, enviar a ficha.
// Fica na aba "Testes" da Mesa do Destino. Sem rede, nada disso aparece quebrado: só uma mensagem.
const Jogador = (() => {
  const K = 'lotm-rpg-online';
  const CODIGO = /^[A-HJ-NP-Z2-9]{6}$/;          // o mesmo alfabeto do servidor (sem I, O, 0, 1)
  let con = lerConexao();                         // { mesa, codigo, nome, slot } ou null
  let estado = con ? 'desligado' : 'fora';        // fora | entrando | ligando | ligado | desligado
  let pedidos = [], erro = '', uid = null, parar = [], ultimaFicha = '', rolandoPedido = false;

  function lerConexao() { try { const c = JSON.parse(localStorage.getItem(K)); return c && c.mesa && c.codigo ? c : null; } catch (e) { return null; } }
  function gravarConexao(c) { try { c ? localStorage.setItem(K, JSON.stringify(c)) : localStorage.removeItem(K); } catch (e) { /* sem armazenamento: só nesta aba */ } }
  const temAtributos = () => ATTRS.every(a => P.attrs && P.attrs[a.key]);
  const minhaFicha = () => con && con.slot && con.slot === idAtual();
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const redesenhar = () => { if (typeof Mesa === 'object') Mesa.atualizar(); marcarFab(); };

  // O que o mestre vê: modificadores, PV e Sanidade (nada além disso sai do navegador).
  function ficha() {
    const mods = {}; ATTRS.forEach(a => { const t = total(a.key); mods[a.key] = t == null ? 0 : mod(t); });
    const c = P.caminho && caminhoPorId(P.caminho);
    return { mods, pv: P.pv == null ? pvMax() : P.pv, pvMax: pvMax(), san: P.san == null ? sanMax() : P.san, sanMax: sanMax(), seq: P.sequencia, caminho: c ? c.nome : '' };
  }

  // ---------- entrar / sair ----------
  async function entrar(codigoBruto) {
    const codigo = String(codigoBruto || '').toUpperCase().replace(/[\s-]/g, '');
    erro = '';
    if (!P.nome || !P.nome.trim()) erro = 'Dê um nome ao personagem antes de entrar.';
    else if (!temAtributos()) erro = 'Role os atributos do personagem antes de entrar.';
    else if (!CODIGO.test(codigo)) erro = 'O código tem 6 letras e números, como o mestre passou.';
    if (erro) return redesenhar();
    salvar();                                      // garante que a ficha tem lugar na biblioteca
    estado = 'entrando'; redesenhar();
    try {
      await Rede.entrarAnonimo();
      const mesa = await Rede.rpc('jogador', 'entrar_na_mesa', { p_codigo: codigo, p_nome: P.nome.trim().slice(0, 40), p_ficha: ficha() });
      con = { mesa, codigo, nome: P.nome.trim().slice(0, 40), slot: idAtual() }; gravarConexao(con);
      ultimaFicha = JSON.stringify(ficha());
      await ligar();
      anunciar('Você entrou na mesa ' + codigo.split('').join(' '));
    } catch (e) { estado = con ? 'desligado' : 'fora'; erro = Rede.mensagem(e); redesenhar(); }
  }

  async function sairDaMesa() {
    const c = con; desligar(); con = null; gravarConexao(null); pedidos = []; estado = 'fora'; erro = ''; redesenhar();
    if (c && uid) { try { await (await Rede.tabela('jogador', 'jogadores')).delete().eq('mesa_id', c.mesa).eq('user_id', uid); } catch (e) { /* sem rede: o mestre remove depois */ } }
  }

  // ---------- conexão ao vivo ----------
  function desligar() { parar.forEach(f => f()); parar = []; }
  async function ligar() {
    if (!con) return;
    desligar(); estado = 'ligando'; erro = ''; redesenhar();
    try {
      const u = await Rede.usuario('jogador');
      if (!u) { con = null; gravarConexao(null); estado = 'fora'; erro = 'Sua entrada na mesa expirou. Digite o código de novo.'; return redesenhar(); }
      uid = u.id;
      await carregarPedidos();
      parar.push(await Rede.ouvir('jogador', 'pedidos', 'pedidos', 'para=eq.' + uid, aoMudarPedidos));
      estado = 'ligado'; redesenhar();
      enviarFicha();
    } catch (e) { estado = 'desligado'; erro = Rede.mensagem(e); redesenhar(); }
  }

  async function carregarPedidos() {
    const r = await (await Rede.tabela('jogador', 'pedidos')).select('id,rotulo,atributo,lados,criado_em').eq('mesa_id', con.mesa).eq('para', uid).eq('estado', 'pendente').order('criado_em');
    if (r.error) throw r.error;
    pedidos = r.data || [];
  }

  async function aoMudarPedidos(ev) {
    const antes = new Set(pedidos.map(p => p.id));
    try { await carregarPedidos(); } catch (e) { return; }
    const novos = pedidos.filter(p => !antes.has(p.id));
    if (novos.length) {
      if (typeof Som === 'object') Som.carta();
      anunciar('O mestre pede: ' + novos.map(p => p.rotulo).join(', '));
    }
    redesenhar();
  }

  // ---------- ficha ao vivo (debounce: só envia quando algo mudou) ----------
  let timerFicha = null;
  function fichaMudou() { if (estado !== 'ligado' || !minhaFicha()) return; clearTimeout(timerFicha); timerFicha = setTimeout(enviarFicha, 1200); }
  async function enviarFicha() {
    if (estado !== 'ligado' || !minhaFicha() || !temAtributos()) return;
    const f = ficha(), json = JSON.stringify(f); if (json === ultimaFicha) return;
    try {
      const r = await (await Rede.tabela('jogador', 'jogadores')).update({ ficha: f, nome: P.nome.trim().slice(0, 40) || con.nome }).eq('mesa_id', con.mesa).eq('user_id', uid).select('user_id');
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) { desligar(); con = null; gravarConexao(null); estado = 'fora'; erro = 'O mestre encerrou a mesa ou removeu você.'; return redesenhar(); }
      ultimaFicha = json;
    } catch (e) { /* tenta de novo na próxima mudança */ }
  }

  // ---------- rolar o que o mestre pediu ----------
  async function rolarPedido(id) {
    const p = pedidos.find(x => x.id === id); if (!p || rolandoPedido || (typeof Mesa === 'object' && Mesa.rolando)) return;
    rolandoPedido = true; erro = '';
    const modificador = p.atributo && total(p.atributo) != null ? mod(total(p.atributo)) : 0;
    try {
      const r = await Rede.rpc('jogador', 'responder_pedido', { p_pedido: p.id, p_modificador: modificador });   // o dado sai do servidor
      pedidos = pedidos.filter(x => x.id !== p.id); redesenhar();
      const nomeAttr = p.atributo ? (ATTRS.find(a => a.key === p.atributo) || {}).nome : '';
      await Mesa.rolar({ lados: r.lados, qtd: 1, mod: r.modificador, rotulo: p.rotulo, fixo: [r.dado], nota: 'pedido do mestre' + (nomeAttr ? ` · ${nomeAttr} ${sinal(r.modificador)}` : '') });
    } catch (e) { erro = Rede.mensagem(e); try { await carregarPedidos(); } catch (e2) { /* fica a lista antiga */ } redesenhar(); }
    finally { rolandoPedido = false; }
  }

  // ---------- interface (dentro da aba Testes) ----------
  const esc2 = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function desenhar(el) {
    if (!el || !Rede.configurada()) return;
    const msgErro = erro ? `<p class="on-erro" role="alert">${esc2(erro)}</p>` : '';
    if (!con || estado === 'fora' || estado === 'entrando') {
      const pronto = P.nome && P.nome.trim() && temAtributos();
      el.innerHTML = `<div class="lbl">Mesa online <i>com o mestre</i></div>
        <form class="on-entrar" id="on-form" novalidate>
          <label for="on-cod">Código da mesa</label>
          <div class="on-linha"><input type="text" id="on-cod" maxlength="7" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" ${pronto ? '' : 'disabled'}>
          <button type="submit" class="primary" id="on-entrar" ${pronto && estado !== 'entrando' ? '' : 'disabled'}>${estado === 'entrando' ? 'Entrando…' : 'Entrar'}</button></div>
          <small class="on-dica">${pronto ? `Você entra sem conta, como <b>${esc2(P.nome.trim())}</b>. O mestre vê só seus modificadores, PV e Sanidade.` : 'Termine o nome e os atributos do personagem para entrar numa mesa.'}</small>
          ${msgErro}</form>`;
      const f = el.querySelector('#on-form');
      f.addEventListener('submit', ev => { ev.preventDefault(); entrar(el.querySelector('#on-cod').value); });
      return;
    }
    const outra = !minhaFicha();
    const cab = `<div class="lbl">Mesa ${esc2(con.codigo)} <i>como ${esc2(con.nome)}</i></div>`;
    if (estado !== 'ligado') {
      el.innerHTML = `${cab}<div class="on-status ${estado}"><span class="on-luz" aria-hidden="true"></span><span>${estado === 'ligando' ? 'Conectando à mesa…' : 'Fora de alcance da mesa.'}</span>
        ${estado === 'desligado' ? '<button type="button" class="ghost" id="on-religar">Tentar de novo</button>' : ''}</div>${msgErro}
        <button type="button" class="link-remover" id="on-sair">Sair da mesa</button>`;
    } else {
      el.innerHTML = `${cab}<div class="on-status ligado"><span class="on-luz" aria-hidden="true"></span><span>Conectado. O mestre vê sua ficha ao vivo.</span></div>
        ${outra ? `<p class="hint">Você está com outra ficha aberta. Abra <b>${esc2(con.nome)}</b> para o mestre ver PV e Sanidade atualizados.</p>` : ''}
        ${pedidos.length ? `<ul class="pedidos">${pedidos.map(p => {
          const a = p.atributo && ATTRS.find(x => x.key === p.atributo), m = a && total(a.key) != null ? mod(total(a.key)) : 0;
          return `<li class="pedido" style="--ac:${a ? a.cor : '#d9b86a'}"><div><small>O mestre pede</small><b>${esc2(p.rotulo)}</b><i>${p.lados === 100 ? 'd%' : 'd' + p.lados}${a ? ` + ${a.nome} ${sinal(m)}` : ''}</i></div>
            <button type="button" class="primary rolar-pedido" data-id="${esc2(p.id)}" data-ic="dado" ${outra ? 'disabled' : ''}>Rolar</button></li>`;
        }).join('')}</ul>` : '<p class="hint on-espera">Aguardando o mestre. Os testes que ele pedir aparecem aqui.</p>'}
        ${msgErro}<button type="button" class="link-remover" id="on-sair">Sair da mesa</button>`;
    }
    const b = el.querySelector('#on-religar'); if (b) b.addEventListener('click', ligar);
    el.querySelector('#on-sair').addEventListener('click', sairDaMesa);
    el.querySelectorAll('.rolar-pedido').forEach(x => x.addEventListener('click', () => rolarPedido(x.dataset.id)));
  }

  // Selo de pedido no botão da mesa (quando ela está fechada)
  function marcarFab() {
    const fab = document.querySelector('#fab-mesa'); if (!fab) return;
    let s = fab.querySelector('.fab-p');
    if (!s) { s = document.createElement('span'); s.className = 'fab-p'; s.setAttribute('aria-hidden', 'true'); fab.appendChild(s); }
    const n = estado === 'ligado' ? pedidos.length : 0;
    s.hidden = !n; s.textContent = n ? '!' : '';
    fab.setAttribute('aria-label', n ? `Abrir a Mesa do Destino: ${n === 1 ? 'o mestre pediu um teste' : `o mestre pediu ${n} testes`}` : 'Abrir a Mesa do Destino');
  }

  document.addEventListener('DOMContentLoaded', () => {
    // a ficha vai ao mestre sempre que é salva (sem mexer em state.js)
    if (typeof salvar === 'function') { const original = salvar; salvar = function () { const r = original.apply(this, arguments); fichaMudou(); return r; }; }
    // volta para a mesa sozinho se o jogador já estava numa (só com rede)
    if (con && navigator.onLine !== false && Rede.configurada()) setTimeout(ligar, 600);
    window.addEventListener('online', () => { if (con && estado === 'desligado') ligar(); });
    // atalho da capa: abre a ficha salva e leva direto ao campo do código
    const atalho = document.querySelector('#btn-entrar-mesa');
    if (atalho) atalho.addEventListener('click', () => {
      if (idAtivoSalvo()) document.querySelector('#btn-continue').click();
      else { avisar('Primeiro, seu personagem', 'Para entrar numa mesa você precisa de um personagem: o mestre vê o nome, os modificadores, PV e Sanidade. Clique em “Iniciar a jornada” e, com a ficha pronta, use este atalho de novo.'); return; }
      setTimeout(() => { Mesa.irParaTestes(); setTimeout(() => { const i = document.querySelector('#on-cod'); if (i && !i.disabled) i.focus(); }, 150); }, 250);
    });
    // com pedido esperando, abrir a mesa já leva para a aba Testes
    const fab = document.querySelector('#fab-mesa');
    if (fab) fab.addEventListener('click', () => { const m = document.querySelector('#mesa'); if (pedidos.length && estado === 'ligado' && m && !m.hidden) Mesa.irParaTestes(); });
  });

  return { desenhar, entrar, sairDaMesa, ligar, rolarPedido, get estado() { return estado; }, get pedidos() { return pedidos.slice(); } };
})();
