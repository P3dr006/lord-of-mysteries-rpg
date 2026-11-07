// Grimório do Mestre: login, mesas, painel ao vivo, testes abertos e secretos, resultados.
// A dificuldade e o "passou ou não" só existem aqui; o jogador nunca recebe esses dados.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const LADOS = [4, 6, 8, 10, 12, 20, 22, 100];
  const NOME_ATTR = Object.fromEntries(ATTRS.map(a => [a.key, a.nome]));
  const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const anunciar = t => { const r = $('#anuncio'); if (!r) return; r.textContent = ''; setTimeout(() => { r.textContent = t; }, 30); };

  const S = { user: null, mesa: null, jogadores: [], resultados: [], pendentes: [], pararDeOuvir: [], ultimoSecreto: null };
  const tela = html => { $('#m-tela').innerHTML = html; if (typeof decorarTudo === 'function') decorarTudo(); };
  const erroEm = (sel, e) => { const el = $(sel); if (el) { el.textContent = Rede.mensagem(e); el.hidden = false; } };
  const ocupado = async (botao, fn) => { if (botao.disabled) return; botao.disabled = true; botao.setAttribute('aria-busy', 'true'); try { await fn(); } finally { if (botao.isConnected) { botao.disabled = false; botao.removeAttribute('aria-busy'); } } };

  // ---------- início ----------
  async function iniciar() {
    $('#m-sair').addEventListener('click', sair);
    try { S.user = await Rede.usuario('mestre'); }
    catch (e) { return semRede(e); }
    if (S.user && !S.user.is_anonymous) { mostrarQuem(); return listaMesas(); }
    login();
  }

  function semRede(e) {
    tela(`<section class="m-cartao m-centro"><h2>O grimório não abriu</h2><p class="modal-txt">${esc(Rede.mensagem(e))}</p>
      <div class="cover-btns"><button type="button" class="primary" id="m-tentar">Tentar de novo</button><a class="m-link" href="index.html">Voltar ao criador de personagem</a></div></section>`);
    $('#m-tentar').addEventListener('click', () => { tela('<p class="m-carregando">Abrindo o grimório…</p>'); iniciar(); });
  }

  function mostrarQuem() { const q = $('#m-quem'); q.textContent = S.user.email || ''; q.hidden = !S.user.email; $('#m-sair').hidden = false; }

  async function sair() {
    pararTempoReal(); await Rede.sair('mestre').catch(() => {}); S.user = null; S.mesa = null;
    $('#m-quem').hidden = true; $('#m-sair').hidden = true; login();
  }

  // ---------- login ----------
  function login() {
    tela(`<section class="m-cartao m-login">
      <div class="m-selo" aria-hidden="true"><span>✦</span></div>
      <h2>Grimório do Mestre</h2>
      <p class="modal-txt">Entre com seu e-mail para criar mesas e conduzir a sessão. Os jogadores não precisam de conta: entram com o código da mesa.</p>
      <form id="m-form-login" class="m-form" novalidate>
        <label for="m-email">E-mail</label><input type="email" id="m-email" autocomplete="email" required>
        <label for="m-senha">Senha</label><input type="password" id="m-senha" autocomplete="current-password" minlength="6" required>
        <p class="m-erro" id="m-erro-login" role="alert" hidden></p>
        <div class="cover-btns"><button type="submit" class="primary" id="m-entrar">Entrar</button><button type="button" class="ghost" id="m-criar">Criar conta</button></div>
      </form></section>`);
    const ler = () => ({ email: $('#m-email').value.trim(), senha: $('#m-senha').value });
    const validar = ({ email, senha }) => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Digite um e-mail válido.'; if (senha.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.'; return ''; };
    $('#m-form-login').addEventListener('submit', ev => { ev.preventDefault(); const b = $('#m-entrar'); ocupado(b, async () => {
      const d = ler(), v = validar(d); if (v) return erroEm('#m-erro-login', new Rede.ErroRede(v));
      try { S.user = await Rede.entrarEmail(d.email, d.senha); mostrarQuem(); listaMesas(); } catch (e) { erroEm('#m-erro-login', e); }
    }); });
    $('#m-criar').addEventListener('click', e => ocupado(e.currentTarget, async () => {
      const d = ler(), v = validar(d); if (v) return erroEm('#m-erro-login', new Rede.ErroRede(v));
      try {
        const r = await Rede.criarConta(d.email, d.senha);
        if (r.precisaConfirmar) { const el = $('#m-erro-login'); el.hidden = false; el.classList.add('m-ok'); el.textContent = 'Conta criada. Abra o link que enviamos para o seu e-mail e depois entre aqui.'; }
        else { S.user = r.user; mostrarQuem(); listaMesas(); }
      } catch (er) { erroEm('#m-erro-login', er); }
    }));
  }

  // ---------- mesas ----------
  async function listaMesas() {
    pararTempoReal(); S.mesa = null;
    tela('<p class="m-carregando">Lendo suas mesas…</p>');
    let mesas = [];
    try { mesas = (await (await Rede.tabela('mestre', 'mesas')).select('id,codigo,nome,criada_em').order('criada_em', { ascending: false })).data || []; }
    catch (e) { return semRede(e); }
    tela(`<section class="m-cartao">
      <h2>Suas mesas</h2>
      ${mesas.length ? `<ul class="m-mesas">${mesas.map(m => `<li><button type="button" class="m-mesa" data-id="${esc(m.id)}"><b>${esc(m.nome)}</b><span class="m-cod-mini" aria-label="código ${esc(m.codigo.split('').join(' '))}">${esc(m.codigo)}</span></button></li>`).join('')}</ul>` : '<p class="hint">Nenhuma mesa ainda. Crie a primeira e passe o código para os jogadores.</p>'}
      <form id="m-form-mesa" class="m-form m-linha" novalidate>
        <div class="m-campo"><label for="m-nome-mesa">Nome da nova mesa</label><input type="text" id="m-nome-mesa" maxlength="60" placeholder="Ex.: Tingen, 1349" autocomplete="off"></div>
        <button type="submit" class="primary" id="m-nova" data-ic="mais">Criar mesa</button>
      </form><p class="m-erro" id="m-erro-mesa" role="alert" hidden></p></section>`);
    document.querySelectorAll('.m-mesa').forEach(b => b.addEventListener('click', () => abrirMesa(mesas.find(m => m.id === b.dataset.id))));
    $('#m-form-mesa').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#m-nova'), async () => {
      const nome = $('#m-nome-mesa').value.trim(); if (!nome) return erroEm('#m-erro-mesa', new Rede.ErroRede('Dê um nome para a mesa.'));
      try {
        const codigo = await Rede.rpc('mestre', 'criar_mesa', { p_nome: nome });
        const r = await (await Rede.tabela('mestre', 'mesas')).select('id,codigo,nome,criada_em').eq('codigo', codigo);
        abrirMesa((r.data || [])[0] || { codigo, nome }, true);
      } catch (e) { erroEm('#m-erro-mesa', e); }
    }); });
  }

  // ---------- painel da mesa ----------
  async function abrirMesa(m, nova = false) {
    if (!m || !m.id) return listaMesas();
    S.mesa = m; S.ultimoSecreto = null;
    tela(`<div class="m-painel">
      <section class="m-cartao m-cab">
        <button type="button" class="link-remover m-voltar" id="m-voltar">← Suas mesas</button>
        <h2 class="m-nome">${esc(m.nome)}</h2>
        <div class="m-codigo-wrap"><span class="lbl">Código para os jogadores</span>
          <div class="m-codigo" id="m-codigo"><span class="sr-only">Código da mesa: ${esc(m.codigo.split('').join(' '))}</span>${m.codigo.split('').map((c, i) => `<span style="--i:${i}" aria-hidden="true">${esc(c)}</span>`).join('')}</div>
          <button type="button" class="ghost m-copiar" id="m-copiar" data-ic="copia">Copiar código</button></div>
        ${nova ? '<p class="m-ok m-dica">Mesa criada. Os jogadores abrem a Mesa do Destino, aba Testes, e digitam este código.</p>' : ''}
      </section>
      <section class="m-cartao m-jog" aria-labelledby="t-jog"><h2 id="t-jog">Jogadores <small id="m-ao-vivo" class="m-vivo">ao vivo</small></h2><div id="m-jogadores" class="m-jogadores"></div></section>
      <section class="m-cartao m-teste" aria-labelledby="t-teste"><h2 id="t-teste">Teste</h2>
        <form id="m-form-teste" class="m-form" novalidate>
          <div class="m-grade">
            <div class="m-campo"><label for="t-para">Para</label><select id="t-para"></select></div>
            <div class="m-campo"><label for="t-attr">Atributo</label><select id="t-attr"><option value="">Nenhum (só o dado)</option>${ATTRS.map(a => `<option value="${a.key}">${a.nome}</option>`).join('')}</select></div>
            <div class="m-campo m-largo"><label for="t-rotulo">O que é testado</label><input type="text" id="t-rotulo" maxlength="80" placeholder="Ex.: Perceber o vulto na neblina" autocomplete="off"></div>
            <div class="m-campo"><label for="t-lados">Dado</label><select id="t-lados">${LADOS.map(l => `<option value="${l}" ${l === 20 ? 'selected' : ''}>${l === 100 ? 'd%' : 'd' + l}</option>`).join('')}</select></div>
            <div class="m-campo"><label for="t-dif">Dificuldade <i>(só você vê)</i></label><input type="number" id="t-dif" min="1" max="200" value="12" inputmode="numeric"></div>
          </div>
          <p class="m-erro" id="m-erro-teste" role="alert" hidden></p>
          <div class="m-acoes">
            <button type="submit" class="primary" id="t-aberto" data-ic="dado">Pedir teste aberto</button>
            <button type="button" class="ghost m-secreto" id="t-secreto" data-ic="olho">Rolar em segredo</button>
          </div>
          <p class="hint"><b>Aberto:</b> o jogador recebe o pedido e rola; vocês dois veem o número. <b>Secreto:</b> o servidor rola com o modificador da ficha e só você vê.</p>
        </form>
        <div id="m-secreto-res" class="m-secreto-res" role="status" aria-live="polite"></div>
      </section>
      <section class="m-cartao m-res" aria-labelledby="t-res"><h2 id="t-res">Resultados</h2><div id="m-pendentes"></div><ol id="m-resultados" class="m-resultados"></ol></section>
    </div>`);
    $('#m-voltar').addEventListener('click', listaMesas);
    $('#m-copiar').addEventListener('click', e => { const b = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(m.codigo) : Promise.reject()).then(() => { b.lastChild.textContent = 'Copiado!'; anunciar('Código copiado'); }).catch(() => { b.lastChild.textContent = m.codigo; }); });
    $('#t-attr').addEventListener('change', () => { const r = $('#t-rotulo'), a = $('#t-attr').value; if (!r.value.trim() || r.dataset.auto) { r.value = a ? 'Teste de ' + NOME_ATTR[a] : ''; r.dataset.auto = a ? '1' : ''; } });
    $('#t-rotulo').addEventListener('input', e => { e.target.dataset.auto = ''; });
    $('#m-form-teste').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#t-aberto'), () => testar('aberto')); });
    $('#t-secreto').addEventListener('click', e => ocupado(e.currentTarget, () => testar('secreto')));
    await Promise.all([carregarJogadores(), carregarResultados()]);
    ouvirMesa();
  }

  // ---------- leitura ----------
  async function carregarJogadores() {
    if (!S.mesa) return;
    try { S.jogadores = (await (await Rede.tabela('mestre', 'jogadores')).select('user_id,nome,ficha,atualizado_em').eq('mesa_id', S.mesa.id).order('nome')).data || []; }
    catch (e) { return; }
    desenharJogadores();
  }
  async function carregarResultados() {
    if (!S.mesa) return;
    try {
      const [r, p] = await Promise.all([
        (await Rede.tabela('mestre', 'resultados_mestre')).select('*').eq('mesa_id', S.mesa.id).order('criado_em', { ascending: false }).limit(40),
        (await Rede.tabela('mestre', 'pedidos')).select('id,para,rotulo,atributo,lados,criado_em').eq('mesa_id', S.mesa.id).eq('estado', 'pendente').order('criado_em', { ascending: false }),
      ]);
      S.resultados = r.data || []; S.pendentes = p.data || [];
    } catch (e) { return; }
    desenharResultados();
  }

  const nomeDe = id => (S.jogadores.find(j => j.user_id === id) || {}).nome || 'Jogador';
  const num = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null; };

  function barra(rotulo, v, max, cor) {
    const vv = num(v, 0, 999), mm = num(max, 0, 999);
    if (vv == null) return `<div class="m-barra"><span>${rotulo}</span><i>—</i></div>`;
    const pct = mm ? Math.max(0, Math.min(100, vv / mm * 100)) : 0, baixo = mm && vv / mm <= .3;
    return `<div class="m-barra ${baixo ? 'baixo' : ''} ${vv === 0 ? 'zero' : ''}" style="--bc:${cor}"><span>${rotulo}</span><div class="m-trilho" role="meter" aria-label="${rotulo}" aria-valuemin="0" aria-valuemax="${mm || 0}" aria-valuenow="${vv}" aria-valuetext="${vv} de ${mm || '?'}"><div style="transform:scaleX(${pct / 100})"></div></div><b>${vv}<small>/${mm || '?'}</small></b></div>`;
  }

  function desenharJogadores() {
    const c = $('#m-jogadores'); if (!c) return;
    c.innerHTML = S.jogadores.length ? S.jogadores.map(j => {
      const f = j.ficha && typeof j.ficha === 'object' ? j.ficha : {}, mods = f.mods && typeof f.mods === 'object' ? f.mods : {};
      return `<article class="m-carta-j" data-u="${esc(j.user_id)}">
        <header><b>${esc(j.nome)}</b>${f.caminho ? `<small>${esc(f.caminho)}${num(f.seq, 0, 9) != null ? ` · Seq. ${num(f.seq, 0, 9)}` : ''}</small>` : ''}</header>
        ${barra('PV', f.pv, f.pvMax, '#e05a6a')}${barra('Sanidade', f.san, f.sanMax, '#6fb4ff')}
        <ul class="m-mods" aria-label="Modificadores">${ATTRS.map(a => { const v = num(mods[a.key], -30, 30); return `<li style="--ac:${a.cor}" title="${a.nome}"><span>${a.nome.slice(0, 3)}</span><b>${v == null ? '—' : sinal(v)}</b></li>`; }).join('')}</ul>
      </article>`;
    }).join('') : `<p class="hint">Ninguém entrou ainda. Passe o código <b>${esc(S.mesa.codigo)}</b> para os jogadores.</p>`;
    const sel = $('#t-para'); if (sel) {
      const atual = sel.value;
      sel.innerHTML = (S.jogadores.length > 1 ? '<option value="*">Todos os jogadores</option>' : '') + S.jogadores.map(j => `<option value="${esc(j.user_id)}">${esc(j.nome)}</option>`).join('');
      if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
      sel.disabled = !S.jogadores.length;
    }
  }

  function linhaResultado(r) {
    const nat = r.lados === 20 ? (r.dado === 20 ? 'crit' : r.dado === 1 ? 'fumble' : '') : '';
    return `<li class="m-r ${r.passou ? 'passou' : 'falhou'} ${nat}">
      <span class="m-r-h">${hora(r.criado_em)}</span>
      <div class="m-r-txt"><b>${esc(nomeDe(r.user_id))}</b> · ${esc(r.rotulo)} <em class="m-tipo ${r.tipo}">${r.tipo === 'secreto' ? 'secreto' : 'aberto'}</em>
        <small>${r.lados === 100 ? 'd%' : 'd' + r.lados}: ${r.dado}${r.modificador ? ' ' + sinal(r.modificador) : ''}${r.atributo ? ` (${esc(NOME_ATTR[r.atributo] || r.atributo)})` : ''} · dificuldade ${r.dificuldade}${nat ? ` · ${nat === 'crit' ? '20 natural' : '1 natural'}` : ''}</small></div>
      <b class="m-r-total">${r.total}</b><span class="m-veredito">${r.passou ? 'Passou' : 'Falhou'}</span></li>`;
  }

  function desenharResultados() {
    const l = $('#m-resultados'), p = $('#m-pendentes'); if (!l) return;
    p.innerHTML = S.pendentes.length ? `<ul class="m-pend">${S.pendentes.map(x => `<li><span class="m-ampulheta" aria-hidden="true"></span><b>${esc(nomeDe(x.para))}</b> ainda vai rolar: ${esc(x.rotulo)} <small>${x.lados === 100 ? 'd%' : 'd' + x.lados}</small></li>`).join('')}</ul>` : '';
    l.innerHTML = S.resultados.length ? S.resultados.map(linhaResultado).join('') : '<li class="hint m-vazio">Os resultados aparecem aqui, com a dificuldade e o veredito.</li>';
  }

  // ---------- testes ----------
  async function testar(tipo) {
    const para = $('#t-para').value, atributo = $('#t-attr').value, lados = +$('#t-lados').value, rotulo = $('#t-rotulo').value.trim() || (atributo ? 'Teste de ' + NOME_ATTR[atributo] : 'Teste'), dif = num($('#t-dif').value, 1, 200);
    const erro = $('#m-erro-teste'); erro.hidden = true;
    if (!S.jogadores.length || !para) return erroEm('#m-erro-teste', new Rede.ErroRede('Espere um jogador entrar na mesa.'));
    if (dif == null || String($('#t-dif').value).trim() === '') return erroEm('#m-erro-teste', new Rede.ErroRede('Defina a dificuldade (1 a 200).'));
    const alvos = para === '*' ? S.jogadores.map(j => j.user_id) : [para];
    const args = u => ({ p_mesa: S.mesa.id, p_para: u, p_rotulo: rotulo, p_atributo: atributo, p_lados: lados, p_dificuldade: dif });
    try {
      if (tipo === 'aberto') {
        for (const u of alvos) await Rede.rpc('mestre', 'pedir_teste', args(u));
        anunciar(alvos.length > 1 ? 'Pedido enviado para todos' : 'Pedido enviado para ' + nomeDe(alvos[0]));
      } else {
        const res = [];
        for (const u of alvos) res.push({ u, ...(await Rede.rpc('mestre', 'rolar_secreto', args(u))) });
        const box = $('#m-secreto-res');
        box.innerHTML = res.map(r => `<div class="m-sec ${r.passou ? 'passou' : 'falhou'}"><span class="m-sec-olho" aria-hidden="true">◉</span><b>${esc(nomeDe(r.u))}</b><span>${r.dado}${r.modificador ? ' ' + sinal(r.modificador) : ''} = <strong>${r.total}</strong> contra ${dif}</span><em>${r.passou ? 'Passou' : 'Falhou'}</em></div>`).join('');
        box.classList.remove('vem'); void box.offsetWidth; box.classList.add('vem');
        anunciar(res.map(r => `${nomeDe(r.u)}: ${r.total}, ${r.passou ? 'passou' : 'falhou'}`).join('. '));
      }
      carregarResultados();
    } catch (e) { erroEm('#m-erro-teste', e); }
  }

  // ---------- tempo real ----------
  function pararTempoReal() { S.pararDeOuvir.forEach(f => f()); S.pararDeOuvir = []; }
  const adiar = (fn, ms = 250) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  async function ouvirMesa() {
    pararTempoReal(); const id = S.mesa.id, f = 'mesa_id=eq.' + id;
    const j = adiar(carregarJogadores), r = adiar(carregarResultados);
    try {
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'jog', 'jogadores', f, j));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'res', 'resultados', f, r));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'ped', 'pedidos', f, r));
    } catch (e) { const v = $('#m-ao-vivo'); if (v) { v.textContent = 'sem tempo real'; v.classList.add('off'); } }
  }

  window.Painel = { estado: S };   // usado pelos testes
  document.addEventListener('DOMContentLoaded', iniciar);
})();
