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

  const S = { user: null, mesa: null, jogadores: [], resultados: [], pendentes: [], sussurros: [], leituras: [], ordens: [], notas: {}, pararDeOuvir: [], ultimoSecreto: null, fichaAberta: null, fichaGatilho: null };
  const tela = html => { $('#m-tela').innerHTML = html; if (typeof decorarTudo === 'function') decorarTudo(); };
  const erroEm = (sel, e) => { const el = $(sel); if (el) { el.textContent = Rede.mensagem(e); el.hidden = false; } };
  // desativa o botão enquanto espera o servidor; o foco do teclado volta para ele depois (desativar tira o foco)
  const ocupado = async (botao, fn) => {
    if (botao.disabled) return; const tinhaFoco = document.activeElement === botao;
    botao.disabled = true; botao.setAttribute('aria-busy', 'true');
    try { await fn(); } finally {
      if (botao.isConnected) { botao.disabled = false; botao.removeAttribute('aria-busy'); if (tinhaFoco && (document.activeElement === document.body || !document.activeElement)) botao.focus({ preventScroll: true }); }
    }
  };

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
    try { mesas = (await (await Rede.tabela('mestre', 'mesas')).select('id,codigo,nome,criada_em,terror').order('criada_em', { ascending: false })).data || []; }
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
        const r = await (await Rede.tabela('mestre', 'mesas')).select('id,codigo,nome,criada_em,terror').eq('codigo', codigo);
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
        <button type="button" class="m-terror ${m.terror ? 'on' : ''}" id="m-terror" aria-pressed="${m.terror ? 'true' : 'false'}">
          <span class="m-terror-olho" aria-hidden="true"></span><span class="m-terror-txt"><small>Modo Terror da mesa</small><b>${m.terror ? 'Ligado' : 'Desligado'}</b></span></button>
        <div class="m-codigo-wrap"><span class="lbl">Código para os jogadores</span>
          <div class="m-codigo" id="m-codigo"><span class="sr-only">Código da mesa: ${esc(m.codigo.split('').join(' '))}</span>${m.codigo.split('').map((c, i) => `<span style="--i:${i}" aria-hidden="true">${esc(c)}</span>`).join('')}</div>
          <button type="button" class="ghost m-copiar" id="m-copiar" data-ic="copia">Copiar código</button></div>
        ${nova ? '<p class="m-ok m-dica">Mesa criada. Os jogadores abrem a Mesa do Destino, aba Testes, e digitam este código.</p>' : ''}
      </section>
      <section class="m-cartao m-jog" aria-labelledby="t-jog"><h2 id="t-jog">Jogadores <small id="m-ao-vivo" class="m-vivo">ao vivo</small></h2><div id="m-jogadores" class="m-jogadores"></div></section>
      <section class="m-cartao m-ctrl" aria-labelledby="t-ctrl"><h2 id="t-ctrl">Corpo e mente</h2>
        <form id="m-form-ctrl" class="m-form" novalidate>
          <div class="m-grade">
            <div class="m-campo"><label for="c-para">Para</label><select id="c-para"></select></div>
            <fieldset class="m-campo c-alvo"><legend>Em</legend><div class="c-alvo-op">
              <label><input type="radio" name="c-alvo" value="pv" checked><span>PV</span></label>
              <label><input type="radio" name="c-alvo" value="san"><span>Sanidade</span></label></div></fieldset>
            <div class="m-campo"><label for="c-qtd">Quanto</label><div class="c-qtd-linha"><input type="number" id="c-qtd" min="1" max="999" value="1" inputmode="numeric">
              <div class="c-chips" role="group" aria-label="Valores rápidos">${[1, 3, 5, 10].map(v => `<button type="button" class="c-chip" data-v="${v}">${v}</button>`).join('')}</div></div></div>
            <div class="m-campo"><label for="c-motivo">Motivo <i>(o jogador vê)</i></label><input type="text" id="c-motivo" maxlength="80" placeholder="Ex.: Mordida do lobo" autocomplete="off"></div>
          </div>
          <p class="m-erro" id="m-erro-ctrl" role="alert" hidden></p>
          <div class="m-acoes">
            <button type="submit" class="ghost c-dano" id="c-dano">Causar dano</button>
            <button type="button" class="ghost c-cura" id="c-cura">Curar</button>
          </div>
        </form>
        <ol id="m-ordens" class="m-ordens" aria-label="Últimas ordens"></ol>
      </section>
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
      <section class="m-cartao m-sus" aria-labelledby="t-sus"><h2 id="t-sus">Sussurros e pistas</h2>
        <form id="m-form-sus" class="m-form" novalidate>
          <div class="m-grade">
            <div class="m-campo"><label for="s-para">Para</label><select id="s-para"></select></div>
            <div class="m-campo"><label for="s-titulo">Título <i>(opcional)</i></label><input type="text" id="s-titulo" maxlength="80" placeholder="Ex.: Carta sem remetente" autocomplete="off"></div>
            <div class="m-campo m-largo"><label for="s-texto">Mensagem</label><textarea id="s-texto" maxlength="1000" rows="3" placeholder="O que só quem recebe vai ouvir…"></textarea></div>
            <div class="m-campo m-largo"><label for="s-img">Imagem da pista <i>(opcional: carta, mapa, retrato)</i></label><div class="s-escolher"><input type="file" id="s-img" accept="image/*" class="s-arquivo"><span class="s-botao" aria-hidden="true">Escolher imagem</span><span class="s-nome" id="s-nome" aria-hidden="true">nenhuma imagem</span></div>
              <div id="s-prev" class="s-prev" hidden><img alt="Prévia da pista"><div><small></small><button type="button" class="link-remover" id="s-tirar">Tirar imagem</button></div></div></div>
          </div>
          <p class="m-erro" id="m-erro-sus" role="alert" hidden></p>
          <div class="m-acoes"><button type="submit" class="ghost m-secreto" id="s-enviar" data-ic="olho">Sussurrar</button></div>
        </form>
        <ol id="m-sussurros" class="m-sussurros" aria-label="Sussurros enviados"></ol>
      </section>
      <section class="m-cartao m-res" aria-labelledby="t-res"><h2 id="t-res">Resultados</h2><div id="m-pendentes"></div><ol id="m-resultados" class="m-resultados"></ol></section>
    </div>`);
    $('#m-voltar').addEventListener('click', listaMesas);
    $('#m-copiar').addEventListener('click', e => { const b = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(m.codigo) : Promise.reject()).then(() => { b.lastChild.textContent = 'Copiado!'; anunciar('Código copiado'); }).catch(() => { b.lastChild.textContent = m.codigo; }); });
    $('#t-attr').addEventListener('change', () => { const r = $('#t-rotulo'), a = $('#t-attr').value; if (!r.value.trim() || r.dataset.auto) { r.value = a ? 'Teste de ' + NOME_ATTR[a] : ''; r.dataset.auto = a ? '1' : ''; } });
    $('#t-rotulo').addEventListener('input', e => { e.target.dataset.auto = ''; });
    $('#m-form-teste').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#t-aberto'), () => testar('aberto')); });
    $('#t-secreto').addEventListener('click', e => ocupado(e.currentTarget, () => testar('secreto')));
    ligarFormSussurro(); ligarControle();
    await Promise.all([carregarJogadores(), carregarResultados(), carregarSussurros(), carregarOrdens(), carregarNotas()]);
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

  // ---------- leitura segura da ficha que o jogador mandou (pode vir de versão antiga ou adulterada) ----------
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const txt = (v, n = 200) => (typeof v === 'string' ? v : '').slice(0, n);
  const corOk = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#8a84b0';
  const idOk = v => /^[a-z]{2,20}$/.test(v || '') ? v : '';
  const fichaDe = j => obj(j && j.ficha);
  // estado em palavras: o mestre lê "Grave" mais rápido que "3/20"
  function estado(v, m, nomes) {
    const vv = num(v, 0, 999), mm = num(m, 1, 999); if (vv == null || mm == null) return null;
    const r = vv / mm; const i = vv <= 0 ? 0 : r <= .3 ? 1 : r < .7 ? 2 : r < 1 ? 3 : 4;
    return { txt: nomes[i], cls: ['zero', 'grave', 'medio', 'leve', 'ok'][i] };
  }
  const EST_PV = ['Caído', 'Grave', 'Ferido', 'Arranhado', 'Ileso'], EST_SAN = ['Rompido', 'Vacilando', 'Abalado', 'Inquieto', 'Lúcido'];
  function haQuanto(t) { const s = (Date.now() - new Date(t).getTime()) / 1000; if (!Number.isFinite(s)) return ''; if (s < 60) return 'agora'; if (s < 3600) return `há ${Math.floor(s / 60)} min`; if (s < 86400) return `há ${Math.floor(s / 3600)} h`; return `há ${Math.floor(s / 86400)} d`; }
  const selo = (f, nome, tam) => { const id = idOk(f.caminhoId); return id ? `<img src="img/sigilos/${id}.webp" alt="" width="${tam}" height="${tam}" loading="lazy">` : `<span class="m-sem-selo" aria-hidden="true">${esc((nome || '?').trim().charAt(0).toUpperCase())}</span>`; };
  const linhaSeq = f => { const s = num(f.seq, 0, 9); return [txt(f.seqNome, 60), s != null ? `Sequência ${s}` : '', txt(f.patamar, 40)].filter(Boolean).join(' · '); };
  const linhaOrigem = f => [txt(obj(f.raca).nome, 40), txt(obj(f.origem).nome, 40)].filter(Boolean).join(' · ');

  function cartaJogador(j) {
    const f = fichaDe(j), mods = obj(f.mods), attrs = obj(f.attrs), cor = corOk(f.cor), cam = txt(f.caminho, 40);
    const ePV = estado(f.pv, f.pvMax, EST_PV), eSan = estado(f.san, f.sanMax, EST_SAN);
    return `<article class="m-carta-j ${ePV && ePV.cls === 'zero' ? 'caido' : ''} ${eSan && (eSan.cls === 'zero' || eSan.cls === 'grave') ? 'mente' : ''}" data-u="${esc(j.user_id)}" style="--cc:${cor}">
      <div class="m-cj-marca" aria-hidden="true">${idOk(f.caminhoId) ? `<img src="img/sigilos/${idOk(f.caminhoId)}.webp" alt="">` : ''}</div>
      <header class="m-cj-cab">
        <div class="m-cj-selo">${selo(f, j.nome, 46)}${num(f.seq, 0, 9) != null ? `<b class="m-cj-seq" aria-hidden="true">${num(f.seq, 0, 9)}</b>` : ''}</div>
        <div class="m-cj-id"><b>${esc(j.nome)}</b>
          <small class="m-cj-cam">${cam ? `${esc(txt(f.seqNome, 60) || cam)} <i>· Caminho ${esc(cam)}${num(f.seq, 0, 9) != null ? ` · Seq. ${num(f.seq, 0, 9)}` : ''}</i>` : 'Ficha em construção'}</small>
          ${linhaOrigem(f) ? `<small class="m-cj-orig">${esc(linhaOrigem(f))}</small>` : ''}</div>
      </header>
      <div class="m-cj-estados">${ePV ? `<span class="m-est pv ${ePV.cls}">${ePV.txt}</span>` : ''}${eSan ? `<span class="m-est san ${eSan.cls}">${eSan.txt}</span>` : ''}</div>
      ${barra('PV', f.pv, f.pvMax, '#e05a6a')}${barra('Sanidade', f.san, f.sanMax, '#6fb4ff')}
      <ul class="m-mods" aria-label="Modificadores">${ATTRS.map(a => { const v = num(mods[a.key], -30, 30), t = num(attrs[a.key], 1, 60), principal = f.attrCaminho === a.key;
        return `<li class="${principal ? 'cam' : ''}" style="--ac:${a.cor}" title="${a.nome}${t != null ? ` ${t}` : ''}${principal ? ' · atributo do Caminho' : ''}"><span>${a.nome.slice(0, 3)}</span><b>${v == null ? '—' : sinal(v)}</b></li>`; }).join('')}</ul>
      <footer class="m-cj-pe"><span class="m-cj-hora" data-t="${esc(j.atualizado_em || '')}">${haQuanto(j.atualizado_em)}</span>
        <span class="m-cj-nota" title="Você tem uma nota secreta sobre este jogador" ${S.notas && S.notas[j.user_id] && S.notas[j.user_id].texto.trim() ? '' : 'hidden'}>✎ nota secreta</span>
        <button type="button" class="ghost m-cj-ver" data-u="${esc(j.user_id)}">Ver ficha <span class="sr-only">de ${esc(j.nome)}</span></button></footer>
    </article>`;
  }

  function desenharJogadores() {
    const c = $('#m-jogadores'); if (!c) return;
    c.innerHTML = S.jogadores.length ? S.jogadores.map(cartaJogador).join('') : `<p class="hint">Ninguém entrou ainda. Passe o código <b>${esc(S.mesa.codigo)}</b> para os jogadores.</p>`;
    c.querySelectorAll('.m-cj-ver').forEach(b => b.addEventListener('click', () => abrirFicha(b.dataset.u, b)));
    if (S.fichaAberta) desenharFicha();
    const sel = $('#t-para'); if (sel) {
      const atual = sel.value;
      sel.innerHTML = (S.jogadores.length > 1 ? '<option value="*">Todos os jogadores</option>' : '') + S.jogadores.map(j => `<option value="${esc(j.user_id)}">${esc(j.nome)}</option>`).join('');
      if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
      sel.disabled = !S.jogadores.length;
    }
    const cp = $('#c-para'); if (cp) {
      const atual = cp.value;
      cp.innerHTML = (S.jogadores.length > 1 ? '<option value="">Todos os jogadores</option>' : '') + S.jogadores.map(j => `<option value="${esc(j.user_id)}">${esc(j.nome)}</option>`).join('');
      if ([...cp.options].some(o => o.value === atual)) cp.value = atual;
      cp.disabled = !S.jogadores.length;
    }
    const ss = $('#s-para'); if (ss) {        // sussurro: "Todos" é guardado uma vez só (para = vazio)
      const atual = ss.value;
      ss.innerHTML = '<option value="">Todos os jogadores</option>' + S.jogadores.map(j => `<option value="${esc(j.user_id)}">${esc(j.nome)}</option>`).join('');
      if ([...ss.options].some(o => o.value === atual)) ss.value = atual;
      ss.disabled = !S.jogadores.length;
    }
    desenharSussurros();
  }

  // ---------- sussurros e pistas ----------
  // A imagem é reduzida no navegador do mestre (até 1280 px, WebP) para caber no banco (~330 KB) sem perder a leitura.
  async function comprimirImagem(arquivo) {
    if (!arquivo || !/^image\//.test(arquivo.type)) throw new Rede.ErroRede('Escolha um arquivo de imagem.');
    if (arquivo.size > 25e6) throw new Rede.ErroRede('Imagem grande demais (máx. 25 MB).');
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok2, falha) => { const i = new Image(); i.onload = () => ok2(i); i.onerror = () => falha(new Rede.ErroRede('Não consegui abrir essa imagem.')); i.src = url; });
      for (const [lado, q] of [[1280, .82], [1280, .7], [1024, .7], [900, .6], [720, .55], [560, .5]]) {
        const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        let d = cv.toDataURL('image/webp', q); if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/jpeg', q);
        if (d.length <= 440000) return d;
      }
      throw new Rede.ErroRede('Não consegui reduzir essa imagem o bastante. Tente outra.');
    } finally { URL.revokeObjectURL(url); }
  }

  async function carregarSussurros() {
    if (!S.mesa) return;
    try {
      const [s, l] = await Promise.all([
        (await Rede.tabela('mestre', 'sussurros')).select('id,para,titulo,texto,tem_imagem,criado_em').eq('mesa_id', S.mesa.id).order('criado_em', { ascending: false }).limit(30),
        (await Rede.tabela('mestre', 'sussurros_leituras')).select('sussurro_id,user_id,lido_em').eq('mesa_id', S.mesa.id),
      ]);
      if (s.error || l.error) throw s.error || l.error;
      S.sussurros = s.data || []; S.leituras = l.data || [];
    } catch (e) { return; }
    desenharSussurros();
  }

  function desenharSussurros() {
    const l = $('#m-sussurros'); if (!l) return;
    const lista = S.sussurros || [], leit = S.leituras || [];
    l.innerHTML = lista.length ? lista.map(s => {
      const quem = leit.filter(x => x.sussurro_id === s.id);
      let status;
      if (s.para) { const x = quem.find(q => q.user_id === s.para); status = x ? `<span class="s-lido">lido ${esc(haQuanto(x.lido_em))}</span>` : '<span class="s-nao">ainda não lido</span>'; }
      else { const lidos = S.jogadores.filter(j => quem.some(q => q.user_id === j.user_id)), faltam = S.jogadores.filter(j => !quem.some(q => q.user_id === j.user_id));
        status = `<span class="s-lido">${lidos.length ? 'lido por ' + esc(lidos.map(j => j.nome).join(', ')) : ''}</span>${faltam.length ? `<span class="s-nao">${lidos.length ? ' · ' : ''}falta ${esc(faltam.map(j => j.nome).join(', '))}</span>` : ''}`; }
      return `<li class="m-s ${s.tem_imagem ? 'com-img' : ''}">
        <div class="m-s-cab"><b>${esc(s.titulo || (s.tem_imagem ? 'Pista' : 'Sussurro'))}</b><small>para ${esc(s.para ? nomeDe(s.para) : 'todos')} · ${esc(hora(s.criado_em))}</small></div>
        ${s.texto ? `<p>${esc(s.texto)}</p>` : ''}${s.tem_imagem ? '<span class="m-s-img">pista com imagem</span>' : ''}
        <div class="m-s-pe">${status}<button type="button" class="link-remover" data-apagar="${esc(s.id)}">Apagar<span class="sr-only"> ${esc(s.titulo || 'sussurro')}</span></button></div></li>`;
    }).join('') : '<li class="hint m-vazio">Nada sussurrado ainda. Uma carta, um mapa, uma visão: só quem recebe vê.</li>';
    l.querySelectorAll('[data-apagar]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { const r = await (await Rede.tabela('mestre', 'sussurros')).delete().eq('id', b.dataset.apagar); if (r.error) throw r.error; carregarSussurros(); }
      catch (e) { b.disabled = false; erroEm('#m-erro-sus', e); }
    }));
  }

  function ligarFormSussurro() {
    let imagem = null;
    const arq = $('#s-img'), prev = $('#s-prev');
    const tirar = () => { imagem = null; arq.value = ''; prev.hidden = true; prev.querySelector('img').removeAttribute('src'); $('#s-nome').textContent = 'nenhuma imagem'; };
    arq.addEventListener('change', async () => {
      const f = arq.files && arq.files[0]; $('#m-erro-sus').hidden = true; if (!f) return tirar();
      $('#s-nome').textContent = f.name;
      prev.hidden = false; prev.classList.add('carregando');
      try { imagem = await comprimirImagem(f); prev.querySelector('img').src = imagem; prev.querySelector('small').textContent = `${Math.round(imagem.length * .75 / 1024)} KB depois de reduzida`; }
      catch (e) { tirar(); erroEm('#m-erro-sus', e); }
      finally { prev.classList.remove('carregando'); }
    });
    $('#s-tirar').addEventListener('click', tirar);
    $('#m-form-sus').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#s-enviar'), async () => {
      $('#m-erro-sus').hidden = true;
      const para = $('#s-para').value || null, titulo = $('#s-titulo').value.trim(), texto = $('#s-texto').value.trim();
      if (!S.jogadores.length) return erroEm('#m-erro-sus', new Rede.ErroRede('Espere um jogador entrar na mesa.'));
      if (!texto && !imagem) return erroEm('#m-erro-sus', new Rede.ErroRede('Escreva algo ou escolha uma imagem.'));
      try {
        await Rede.rpc('mestre', 'sussurrar', { p_mesa: S.mesa.id, p_para: para, p_titulo: titulo, p_texto: texto, p_imagem: imagem });
        $('#s-titulo').value = ''; $('#s-texto').value = ''; tirar();
        anunciar('Sussurro enviado para ' + (para ? nomeDe(para) : 'todos'));
        carregarSussurros();
      } catch (e) { erroEm('#m-erro-sus', e); }
    }); });
  }

  // ---------- corpo e mente: dano, cura e Modo Terror (ordens que o navegador do jogador aplica uma vez) ----------
  const alvo = () => (document.querySelector('input[name="c-alvo"]:checked') || {}).value || 'pv';
  function rotularControle() {
    const san = alvo() === 'san', d = $('#c-dano'), c = $('#c-cura'); if (!d) return;
    d.lastChild.textContent = san ? 'Abalar a mente' : 'Causar dano'; c.lastChild.textContent = san ? 'Acalmar' : 'Curar';
    d.classList.toggle('san', san); c.classList.toggle('san', san);
  }
  function ligarControle() {
    document.querySelectorAll('input[name="c-alvo"]').forEach(r => r.addEventListener('change', rotularControle));
    document.querySelectorAll('.c-chip').forEach(b => b.addEventListener('click', () => { $('#c-qtd').value = b.dataset.v; }));
    const mandar = sinalDano => async () => {
      $('#m-erro-ctrl').hidden = true;
      const q = num($('#c-qtd').value, 1, 999), para = $('#c-para').value || null, k = alvo();
      if (!S.jogadores.length) return erroEm('#m-erro-ctrl', new Rede.ErroRede('Espere um jogador entrar na mesa.'));
      if (q == null || String($('#c-qtd').value).trim() === '') return erroEm('#m-erro-ctrl', new Rede.ErroRede('Diga quanto (1 a 999).'));
      try {
        await Rede.rpc('mestre', 'ordenar', { p_mesa: S.mesa.id, p_para: para, p_tipo: k, p_valor: sinalDano * q, p_motivo: $('#c-motivo').value.trim() });
        anunciar(`${sinalDano < 0 ? '−' : '+'}${q} ${k === 'pv' ? 'PV' : 'Sanidade'} para ${para ? nomeDe(para) : 'todos'}`);
        $('#c-motivo').value = ''; carregarOrdens();
      } catch (e) { erroEm('#m-erro-ctrl', e); }
    };
    $('#m-form-ctrl').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#c-dano'), mandar(-1)); });
    $('#c-cura').addEventListener('click', e => ocupado(e.currentTarget, mandar(1)));
    $('#m-terror').addEventListener('click', e => ocupado(e.currentTarget, async () => {
      const ligar = !S.mesa.terror;
      try {
        await Rede.rpc('mestre', 'ordenar', { p_mesa: S.mesa.id, p_para: null, p_tipo: 'terror', p_valor: ligar ? 1 : 0, p_motivo: '' });
        S.mesa.terror = ligar; const b = $('#m-terror');
        b.classList.toggle('on', ligar); b.setAttribute('aria-pressed', String(ligar)); b.querySelector('b').textContent = ligar ? 'Ligado' : 'Desligado';
        anunciar(ligar ? 'Modo Terror ligado para a mesa' : 'Modo Terror desligado para a mesa'); carregarOrdens();
      } catch (er) { erroEm('#m-erro-ctrl', er); }
    }));
    rotularControle();
  }
  async function carregarOrdens() {
    if (!S.mesa) return;
    try { const r = await (await Rede.tabela('mestre', 'ordens')).select('id,para,tipo,valor,motivo,criado_em,aplicada_em').eq('mesa_id', S.mesa.id).order('criado_em', { ascending: false }).limit(12); if (r.error) throw r.error; S.ordens = r.data || []; }
    catch (e) { return; }
    desenharOrdens();
  }
  function desenharOrdens() {
    const l = $('#m-ordens'); if (!l) return;
    const os = (S.ordens || []).filter(o => o.tipo !== 'terror').slice(0, 8);
    l.innerHTML = os.map(o => `<li class="m-o ${o.tipo} ${o.valor < 0 ? 'neg' : 'pos'}"><b>${o.valor < 0 ? '−' : '+'}${Math.abs(o.valor)} ${o.tipo === 'pv' ? 'PV' : 'San'}</b>
      <span>${esc(nomeDe(o.para))}${o.motivo ? ` · ${esc(o.motivo)}` : ''}</span><em class="${o.aplicada_em ? 'ok' : 'espera'}">${o.aplicada_em ? 'aplicado' : 'aguardando o jogador'}</em></li>`).join('');
  }

  // ---------- notas secretas (só o mestre lê e escreve) ----------
  async function carregarNotas() {
    if (!S.mesa) return;
    try { const r = await (await Rede.tabela('mestre', 'notas_mestre')).select('user_id,texto,atualizado_em').eq('mesa_id', S.mesa.id); if (r.error) throw r.error; S.notas = Object.fromEntries((r.data || []).map(n => [n.user_id, n])); }
    catch (e) { return; }
    desenharJogadores();
  }
  let timerNota = null;
  function salvarNota(uid, texto) {
    clearTimeout(timerNota);
    // o aviso é procurado na hora: a ficha pode ter sido redesenhada ao vivo enquanto a nota salvava
    const aviso = { set textContent(t) { const s = document.querySelector('#mf-nota-st'), n = document.querySelector('#mf-nota'); if (s && n && n.dataset.u === uid) s.textContent = t; } };
    const status = aviso;
    status.textContent = 'escrevendo…';
    timerNota = setTimeout(async () => {
      try {
        const t = await Rede.tabela('mestre', 'notas_mestre');
        const r = S.notas && S.notas[uid]
          ? await t.update({ texto }).eq('mesa_id', S.mesa.id).eq('user_id', uid)
          : await t.insert({ mesa_id: S.mesa.id, user_id: uid, texto });
        if (r.error) throw r.error;
        S.notas = S.notas || {}; S.notas[uid] = { user_id: uid, texto, atualizado_em: new Date().toISOString() };
        status.textContent = 'guardada'; marcarNotaNaCarta(uid);
      } catch (e) { status.textContent = 'não salvou: ' + Rede.mensagem(e); }
    }, 700);
  }
  function marcarNotaNaCarta(uid) {
    const c = document.querySelector(`.m-carta-j[data-u="${CSS.escape(uid)}"] .m-cj-nota`); if (!c) return;
    c.hidden = !(S.notas && S.notas[uid] && S.notas[uid].texto.trim());
  }

  // ---------- ficha completa do jogador (janela) ----------
  function abrirFicha(uid, gatilho) {
    fecharFicha(false);
    S.fichaAberta = uid; S.fichaGatilho = gatilho || null;
    const fundo = document.createElement('div'); fundo.className = 'm-ficha-fundo'; fundo.id = 'm-ficha';
    fundo.innerHTML = '<section class="m-ficha" role="dialog" aria-modal="true" aria-labelledby="mf-nome" tabindex="-1"></section>';
    document.body.appendChild(fundo); document.body.classList.add('m-com-ficha');
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fecharFicha(); });
    fundo.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); fecharFicha(); return; }
      if (e.key !== 'Tab') return;
      const foc = [...fundo.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent);
      if (!foc.length) return; const a = foc[0], z = foc[foc.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    desenharFicha();
    fundo.querySelector('.m-ficha-x').focus();
  }
  function fecharFicha(devolverFoco = true) {
    const f = $('#m-ficha'); if (!f) return;
    f.remove(); document.body.classList.remove('m-com-ficha');
    const g = S.fichaGatilho; S.fichaAberta = null; S.fichaGatilho = null;
    if (devolverFoco) { const alvo = g && g.isConnected ? g : document.querySelector(`.m-cj-ver[data-u="${CSS.escape((g && g.dataset.u) || '')}"]`); if (alvo) alvo.focus(); }
  }
  function desenharFicha() {
    const caixa = document.querySelector('#m-ficha .m-ficha'); if (!caixa) return;
    // a nota que o mestre está digitando sobrevive ao redesenho ao vivo (texto e posição do cursor)
    const notaEl = caixa.querySelector('#mf-nota'), notaViva = notaEl && notaEl.dataset.u === S.fichaAberta ? { v: notaEl.value, a: notaEl.selectionStart, b: notaEl.selectionEnd, st: (caixa.querySelector('#mf-nota-st') || {}).textContent } : null;
    const j = S.jogadores.find(x => x.user_id === S.fichaAberta);
    if (!j) { caixa.innerHTML = `<button type="button" class="icon m-ficha-x" aria-label="Fechar a ficha">✕</button><h2 id="mf-nome">Jogador saiu da mesa</h2><p class="hint">Esta ficha não está mais disponível.</p>`; caixa.querySelector('.m-ficha-x').addEventListener('click', () => fecharFicha()); return; }
    const f = fichaDe(j), mods = obj(f.mods), attrs = obj(f.attrs), cor = corOk(f.cor), rolagem = caixa.scrollTop;
    const focoDentro = caixa.contains(document.activeElement), idFoco = focoDentro ? document.activeElement.id : '';
    const dig = num(f.digestao, 0, 99), digMax = num(f.digMax, 1, 99), tr = obj(f.traco), ar = obj(f.artefato);
    const habC = Array.isArray(f.habCaminho) ? f.habCaminho.filter(h => typeof h === 'string').slice(0, 8) : [];
    const habJ = Array.isArray(f.hab) ? f.hab.map(obj).filter(h => txt(h.nome)).slice(0, 20) : [];
    const meus = S.resultados.filter(r => r.user_id === j.user_id).slice(0, 8);
    const par = (rot, v) => v ? `<div class="mf-par"><dt>${rot}</dt><dd>${esc(v)}</dd></div>` : '';
    const vazio = t => `<p class="hint">${t}</p>`;
    caixa.style.setProperty('--cc', cor);
    caixa.innerHTML = `
      <button type="button" class="icon m-ficha-x" aria-label="Fechar a ficha">✕</button>
      <div class="mf-cab">
        <div class="mf-selo">${selo(f, j.nome, 92)}</div>
        <div class="mf-id">
          <small class="mf-eyebrow">${f.caminho ? `Caminho ${esc(txt(f.caminho, 40))}` : 'Ficha em construção'}</small>
          <h2 id="mf-nome">${esc(j.nome)}</h2>
          <p class="mf-seq">${esc(linhaSeq(f)) || '—'}</p>
          <p class="mf-orig">${esc(linhaOrigem(f))}${txt(f.jogador, 60) ? `<span> · jogado por ${esc(txt(f.jogador, 60))}</span>` : ''}</p>
          ${dig != null && digMax ? `<div class="mf-dig" title="Digestão da poção"><span>Digestão da poção</span><div class="m-trilho" role="meter" aria-label="Digestão da poção" aria-valuemin="0" aria-valuemax="${digMax}" aria-valuenow="${Math.min(dig, digMax)}"><div style="transform:scaleX(${Math.min(1, dig / digMax)})"></div></div><b>${dig}/${digMax}</b></div>` : ''}
        </div>
      </div>
      <div class="mf-grade">
        <section class="mf-bloco"><h3>Vitais</h3>
          ${barra('PV', f.pv, f.pvMax, '#e05a6a')}${barra('Sanidade', f.san, f.sanMax, '#6fb4ff')}
          ${num(f.espMax, 0, 999) != null ? `<p class="mf-esp">Espiritualidade máxima <b>${num(f.espMax, 0, 999)}</b></p>` : ''}</section>
        <section class="mf-bloco"><h3>Atributos</h3>
          <ul class="mf-attrs">${ATTRS.map(a => { const t = num(attrs[a.key], 1, 60), v = num(mods[a.key], -30, 30), p = f.attrCaminho === a.key;
            return `<li class="${p ? 'cam' : ''}" style="--ac:${a.cor}"><span>${a.nome}${p ? ' <i title="atributo do Caminho">✦</i>' : ''}</span><b>${t == null ? '—' : t}</b><em>${v == null ? '' : sinal(v)}</em></li>`; }).join('')}</ul></section>
        <section class="mf-bloco"><h3>Habilidades</h3>
          ${habC.length || habJ.length ? `<ul class="mf-hab">${habC.map(h => `<li class="cam"><b>${esc(txt(h, 80))}</b><small>do Caminho</small></li>`).join('')}${habJ.map(h => `<li><b>${esc(txt(h.nome, 60))}</b>${txt(h.desc) ? `<small>${esc(txt(h.desc, 200))}</small>` : ''}</li>`).join('')}</ul>` : vazio('Nenhuma habilidade ainda.')}</section>
        <section class="mf-bloco"><h3>Carta do Destino</h3>
          ${txt(tr.nome) || txt(ar.nome) ? `${txt(tr.nome) ? `<div class="mf-carta"><small>Traço</small><b>${esc(txt(tr.nome, 60))}</b><p>${esc(txt(tr.desc, 240))}</p></div>` : ''}
          ${txt(ar.nome) ? `<div class="mf-carta art"><small>Artefato</small><b>${esc(txt(ar.nome, 60))}</b><p><span class="mf-dadiva">Dádiva</span> ${esc(txt(ar.dadiva, 240))}</p><p><span class="mf-maldicao">Maldição</span> ${esc(txt(ar.maldicao, 240))}</p></div>` : ''}` : vazio('Ainda não tirou as cartas.')}</section>
        <section class="mf-bloco mf-largo"><h3>Quem é</h3>
          ${par('Idade', txt(f.idade, 20)) || par('Gênero', txt(f.genero, 40)) || txt(f.aparencia) || txt(f.historia) ? `<dl class="mf-pares">${par('Idade', txt(f.idade, 20))}${par('Gênero', txt(f.genero, 40))}${par('Aparência', txt(f.aparencia, 400))}${par('História', txt(f.historia, 900))}</dl>` : vazio('O jogador ainda não descreveu o personagem.')}</section>
        ${txt(f.notas) ? `<section class="mf-bloco mf-largo"><h3>Notas do jogador</h3><p class="mf-notas">${esc(txt(f.notas, 900))}</p></section>` : ''}
        <section class="mf-bloco mf-largo mf-segredo"><h3><label for="mf-nota">Notas secretas</label> <i>só você vê · o jogador nunca recebe</i></h3>
          <textarea id="mf-nota" data-u="${esc(j.user_id)}" maxlength="4000" rows="4" placeholder="O que você sabe e ele não: segredos, ganchos, dívidas, mentiras…">${esc(((S.notas || {})[j.user_id] || {}).texto || '')}</textarea>
          <small class="mf-nota-st" id="mf-nota-st" aria-live="polite">${(S.notas || {})[j.user_id] ? 'guardada' : ''}</small></section>
        <section class="mf-bloco mf-largo"><h3>Testes nesta mesa</h3>
          ${meus.length ? `<ol class="m-resultados mf-res">${meus.map(linhaResultado).join('')}</ol>` : vazio('Nenhum teste ainda.')}</section>
      </div>
      <div class="mf-acoes"><div class="mf-botoes"><button type="button" class="primary" id="mf-pedir" data-ic="dado">Pedir teste para ${esc(j.nome)}</button>
        <button type="button" class="ghost m-secreto" id="mf-sussurrar" data-ic="olho">Sussurrar</button>
        <button type="button" class="ghost c-dano" id="mf-ctrl">Corpo e mente</button></div>
        <span class="mf-hora">Ficha atualizada ${esc(haQuanto(j.atualizado_em))}</span></div>`;
    caixa.scrollTop = rolagem;
    caixa.querySelector('.m-ficha-x').addEventListener('click', () => fecharFicha());
    caixa.querySelector('#mf-pedir').addEventListener('click', () => {
      const uid = j.user_id; fecharFicha(false);
      const sel = $('#t-para'); if (sel) sel.value = uid;
      const r = $('#t-rotulo'); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.focus(); }
    });
    caixa.querySelector('#mf-ctrl').addEventListener('click', () => {
      const uid = j.user_id; fecharFicha(false);
      const sel = $('#c-para'); if (sel) sel.value = uid;
      const q = $('#c-qtd'); if (q) { q.scrollIntoView({ block: 'center', behavior: 'smooth' }); q.focus(); q.select(); }
    });
    const nota = caixa.querySelector('#mf-nota'), notaSt = caixa.querySelector('#mf-nota-st');
    if (notaViva) { nota.value = notaViva.v; notaSt.textContent = notaViva.st || ''; if (focoDentro && idFoco === 'mf-nota') nota.setSelectionRange(notaViva.a, notaViva.b); }
    nota.addEventListener('input', () => salvarNota(j.user_id, nota.value));
    caixa.querySelector('#mf-sussurrar').addEventListener('click', () => {
      const uid = j.user_id; fecharFicha(false);
      const sel = $('#s-para'); if (sel) sel.value = uid;
      const t = $('#s-texto'); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.focus(); }
    });
    if (typeof decorarTudo === 'function') decorarTudo();
    // atualização ao vivo não pode jogar o foco para fora da janela
    if (focoDentro) (idFoco && caixa.querySelector('#' + CSS.escape(idFoco)) || caixa.querySelector('.m-ficha-x')).focus({ preventScroll: true });
  }
  // "há 3 min" continua certo sem recarregar
  setInterval(() => document.querySelectorAll('.m-cj-hora[data-t]').forEach(s => { s.textContent = haQuanto(s.dataset.t); }), 30000);

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
    if (S.fichaAberta) desenharFicha();   // a lista de testes da ficha aberta também se atualiza
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
  function pararTempoReal() { S.pararDeOuvir.forEach(f => f()); S.pararDeOuvir = []; if (typeof fecharFicha === 'function') fecharFicha(false); }
  const adiar = (fn, ms = 250) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  async function ouvirMesa() {
    pararTempoReal(); const id = S.mesa.id, f = 'mesa_id=eq.' + id;
    const j = adiar(carregarJogadores), r = adiar(carregarResultados);
    try {
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'jog', 'jogadores', f, j));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'res', 'resultados', f, r));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'ped', 'pedidos', f, r));
      const su = adiar(carregarSussurros);
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'sus', 'sussurros', f, su));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'lei', 'sussurros_leituras', f, su));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'ord', 'ordens', f, adiar(carregarOrdens)));
    } catch (e) { const v = $('#m-ao-vivo'); if (v) { v.textContent = 'sem tempo real'; v.classList.add('off'); } }
  }

  window.Painel = { estado: S };   // usado pelos testes
  document.addEventListener('DOMContentLoaded', iniciar);
})();
