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

  const S = { user: null, mesa: null, jogadores: [], resultados: [], pendentes: [], sussurros: [], leituras: [], ordens: [], notas: {}, figuras: [], encontro: null, disputas: [], cronica: [], bestiario: [], habs: [], habModo: {}, keep: {}, habsCarregadas: false, online: new Set(), pararDeOuvir: [], ultimoSecreto: null, fichaAberta: null, fichaGatilho: null };
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
      ${mesas.length ? `<ul class="m-mesas">${mesas.map(m => `<li class="m-mesa-li"><button type="button" class="m-mesa" data-id="${esc(m.id)}"><b>${esc(m.nome)}</b><span class="m-cod-mini"><span class="sr-only">código </span>${esc(m.codigo)}</span></button><button type="button" class="link-remover m-mesa-x" data-apagar-mesa="${esc(m.id)}">Apagar<span class="sr-only"> a mesa ${esc(m.nome)}</span></button></li>`).join('')}</ul>` : '<p class="hint">Nenhuma mesa ainda. Crie a primeira e passe o código para os jogadores.</p>'}
      <form id="m-form-mesa" class="m-form m-linha" novalidate>
        <div class="m-campo"><label for="m-nome-mesa">Nome da nova mesa</label><input type="text" id="m-nome-mesa" maxlength="60" placeholder="Ex.: Tingen, 1349" autocomplete="off"></div>
        <button type="submit" class="primary" id="m-nova" data-ic="mais">Criar mesa</button>
      </form><p class="m-erro" id="m-erro-mesa" role="alert" hidden></p></section>`);
    document.querySelectorAll('.m-mesa').forEach(b => b.addEventListener('click', () => abrirMesa(mesas.find(m => m.id === b.dataset.id))));
    document.querySelectorAll('[data-apagar-mesa]').forEach(b => b.addEventListener('click', async () => {
      const m = mesas.find(x => x.id === b.dataset.apagarMesa); if (!m) return;
      const ok2 = await confirmar({ titulo: 'Apagar a mesa “' + m.nome + '”?', texto: 'Some tudo: jogadores, testes, sussurros, duelos, figuras, notas e a crônica. Não tem volta.', botao: 'Apagar para sempre', exigir: m.codigo, perigo: true });
      if (!ok2) return;
      try { const r = await (await Rede.tabela('mestre', 'mesas')).delete().eq('id', m.id); if (r.error) throw r.error; anunciar('Mesa apagada'); listaMesas(); }
      catch (e) { erroEm('#m-erro-mesa', e); }
    }));
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
    S.mesa = m; S.ultimoSecreto = null; S.habs = []; S.habsCarregadas = false; S.habModo = {}; S.keep = {};
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
      <section class="m-roda" id="m-roda" aria-label="Roda do Destino" hidden></section>
      <section class="m-cartao m-jog" aria-labelledby="t-jog"><h2 id="t-jog">Jogadores <small id="m-ao-vivo" class="m-vivo">ao vivo</small></h2><div id="m-jogadores" class="m-jogadores"></div><div id="m-propostas" class="hp-fila" aria-label="Pedidos de poder dos jogadores" hidden></div></section>
      <div class="m-lado">
        <nav class="m-abas" role="tablist" aria-label="Seções do grimório"><button type="button" role="tab" class="m-aba on" id="aba-acoes" data-aba="acoes" aria-controls="p-acoes" aria-selected="true" tabindex="0">Ações</button><button type="button" role="tab" class="m-aba" id="aba-cena" data-aba="cena" aria-controls="p-cena" aria-selected="false" tabindex="-1">Cena</button><button type="button" role="tab" class="m-aba" id="aba-bestiario" data-aba="bestiario" aria-controls="p-bestiario" aria-selected="false" tabindex="-1">Bestiário</button><button type="button" role="tab" class="m-aba" id="aba-segredos" data-aba="segredos" aria-controls="p-segredos" aria-selected="false" tabindex="-1">Segredos</button><button type="button" role="tab" class="m-aba" id="aba-cronica" data-aba="cronica" aria-controls="p-cronica" aria-selected="false" tabindex="-1">Crônica</button><button type="button" role="tab" class="m-aba" id="aba-dados" data-aba="dados" aria-controls="p-dados" aria-selected="false" tabindex="-1">Dados</button></nav>
        <div class="m-aba-p" role="tabpanel" id="p-acoes" aria-labelledby="aba-acoes" data-p="acoes">
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
${secaoDuelo()}
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
        </div>
        <div class="m-aba-p" role="tabpanel" id="p-cena" aria-labelledby="aba-cena" data-p="cena">
${secaoRoda()}
${secaoFiguras()}
        </div>
        <div class="m-aba-p" role="tabpanel" id="p-bestiario" aria-labelledby="aba-bestiario" data-p="bestiario">
${secaoBestiario()}
        </div>
        <div class="m-aba-p" role="tabpanel" id="p-segredos" aria-labelledby="aba-segredos" data-p="segredos">
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
        </div>
        <div class="m-aba-p" role="tabpanel" id="p-cronica" aria-labelledby="aba-cronica" data-p="cronica">
      <section class="m-cartao m-res" aria-labelledby="t-res"><h2 id="t-res">Resultados</h2><div id="m-pendentes"></div><ol id="m-resultados" class="m-resultados"></ol></section>
${secaoCronica()}
        </div>
        <div class="m-aba-p" role="tabpanel" id="p-dados" aria-labelledby="aba-dados" data-p="dados">
${secaoDados()}
        </div>
      </div>
    </div>`);
    $('#m-voltar').addEventListener('click', listaMesas);
    $('#m-copiar').addEventListener('click', e => { const b = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(m.codigo) : Promise.reject()).then(() => { b.lastChild.textContent = 'Copiado!'; anunciar('Código copiado'); }).catch(() => { b.lastChild.textContent = m.codigo; }); });
    $('#t-attr').addEventListener('change', () => { const r = $('#t-rotulo'), a = $('#t-attr').value; if (!r.value.trim() || r.dataset.auto) { r.value = a ? 'Teste de ' + NOME_ATTR[a] : ''; r.dataset.auto = a ? '1' : ''; } });
    $('#t-rotulo').addEventListener('input', e => { e.target.dataset.auto = ''; });
    $('#m-form-teste').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#t-aberto'), () => testar('aberto')); });
    $('#t-secreto').addEventListener('click', e => ocupado(e.currentTarget, () => testar('secreto')));
    ligarFormSussurro(); ligarControle(); ligarAbas(); ligarDuelo(); ligarFiguras(); ligarCronica(); ligarDadosMestre(); ligarBestiario();
    await Promise.all([carregarJogadores(), carregarResultados(), carregarSussurros(), carregarOrdens(), carregarNotas(), carregarFiguras(), carregarEncontro(), carregarDisputas(), carregarCronica(), carregarBestiario(), carregarHabs()]);
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
        <div class="m-cj-id"><b>${esc(j.nome)}<span class="m-vela ${S.online && S.online.has(j.user_id) ? 'acesa' : ''}" title="${S.online && S.online.has(j.user_id) ? 'Com a mesa aberta agora' : 'Fora da mesa agora'}"><i aria-hidden="true"></i><span class="sr-only">${S.online && S.online.has(j.user_id) ? 'presente' : 'ausente'}</span></span></b>
          <small class="m-cj-cam">${cam ? `${esc(txt(f.seqNome, 60) || cam)} <i>· Caminho ${esc(cam)}${num(f.seq, 0, 9) != null ? ` · Seq. ${num(f.seq, 0, 9)}` : ''}</i>` : 'Ficha em construção'}</small>
          ${linhaOrigem(f) ? `<small class="m-cj-orig">${esc(linhaOrigem(f))}</small>` : ''}</div>
      </header>
      <div class="m-cj-estados">${ePV ? `<span class="m-est pv ${ePV.cls}">${ePV.txt}</span>` : ''}${eSan ? `<span class="m-est san ${eSan.cls}">${eSan.txt}</span>` : ''}</div>
      ${barra('PV', f.pv, f.pvMax, '#e05a6a')}${barra('Sanidade', f.san, f.sanMax, '#6fb4ff')}
      <ul class="m-mods" aria-label="Modificadores">${ATTRS.map(a => { const v = num(mods[a.key], -30, 30), t = num(attrs[a.key], 1, 60), principal = f.attrCaminho === a.key;
        return `<li class="${principal ? 'cam' : ''}" style="--ac:${a.cor}" title="${a.nome}${t != null ? ` ${t}` : ''}${principal ? ' · atributo do Caminho' : ''}"><span>${a.nome.slice(0, 3)}</span><b>${v == null ? '—' : sinal(v)}</b></li>`; }).join('')}</ul>
      <footer class="m-cj-pe"><span class="m-cj-hora" data-t="${esc(j.atualizado_em || '')}">${haQuanto(j.atualizado_em)}</span>
        <span class="m-cj-nota" title="Você tem uma nota secreta sobre este jogador" ${S.notas && S.notas[j.user_id] && S.notas[j.user_id].texto.trim() ? '' : 'hidden'}>✎ nota secreta</span>
        ${pendentesDe(j.user_id).length ? `<span class="m-cj-prop" title="Habilidades esperando a sua decisão">✦ ${pendentesDe(j.user_id).length} ${pendentesDe(j.user_id).length === 1 ? 'proposta' : 'propostas'}</span>` : ''}
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
    desenharSussurros(); preencherLados(); desenharJogadores_vez(); atualizarVelas();
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

  // =====================================================================================================
  // CENA: abas, Roda do Destino, Duelo, Figuras, Crônica, Dados do mestre, presença, apagar/tirar
  // =====================================================================================================
  const opcoesAttr = (vazio = 'Só o dado') => `<option value="">${vazio}</option>` + ATTRS.map(a => `<option value="${a.key}">${a.nome}</option>`).join('');
  const sub = t => `<small class="m-sub">${t}</small>`;
  function secaoDuelo() {
    return `<section class="m-cartao m-duelo" aria-labelledby="t-duelo"><h2 id="t-duelo">Duelo ${sub('teste contestado')}</h2>
      <form id="m-form-duelo" class="m-form" novalidate>
        <div class="m-campo"><label for="d-rotulo">O que está em jogo</label><input type="text" id="d-rotulo" maxlength="80" placeholder="Ex.: Queda de braço na taverna" autocomplete="off"></div>
        <div class="d-lados">
          <div class="d-lado"><label for="d-a">Lado A</label><select id="d-a"></select><label for="d-a-attr" class="sr-only">Atributo do lado A</label><select id="d-a-attr">${opcoesAttr()}</select></div>
          <div class="d-x" aria-hidden="true"><span>×</span></div>
          <div class="d-lado"><label for="d-b">Lado B</label><select id="d-b"></select><label for="d-b-attr" class="sr-only">Atributo do lado B</label><select id="d-b-attr">${opcoesAttr()}</select></div>
        </div>
        <label class="d-ver"><input type="checkbox" id="d-visivel" checked><span>Os jogadores do duelo veem o resultado</span></label>
        <p class="m-erro" id="m-erro-duelo" role="alert" hidden></p>
        <div class="m-acoes"><button type="submit" class="primary" id="d-rolar">Duelar</button></div>
      </form>
      <div id="m-duelo-res" class="m-duelo-res" role="status" aria-live="polite"></div></section>`;
  }
  function secaoRoda() {
    return `<section class="m-cartao m-roda-ctrl" aria-labelledby="t-roda"><h2 id="t-roda">Roda do Destino ${sub('iniciativa')}</h2>
      <div id="m-roda-ctrl"></div><p class="m-erro" id="m-erro-roda" role="alert" hidden></p></section>`;
  }
  function secaoFiguras() {
    return `<section class="m-cartao m-figuras" aria-labelledby="t-fig"><h2 id="t-fig">Figuras da cena ${sub('NPCs · só você vê')}</h2>
      <form id="m-form-fig" class="m-form f-form" novalidate>
        <div class="m-campo f-nome"><label for="f-nome">Nome</label><input type="text" id="f-nome" maxlength="40" placeholder="Ex.: Lobo de Tingen" autocomplete="off"></div>
        <div class="m-campo"><label for="f-bonus">Bônus</label><input type="number" id="f-bonus" min="-10" max="20" value="0" inputmode="numeric"></div>
        <div class="m-campo"><label for="f-pv">PV</label><input type="number" id="f-pv" min="1" max="9999" inputmode="numeric" placeholder="opcional"></div>
        <button type="submit" class="ghost" id="f-add" data-ic="mais">Chamar</button>
      </form>
      <p class="m-erro" id="m-erro-fig" role="alert" hidden></p>
      <ul id="m-figuras" class="m-figs" aria-label="Figuras da cena"></ul></section>`;
  }
  function secaoCronica() {
    return `<section class="m-cartao m-cron" aria-labelledby="t-cron"><h2 id="t-cron">Crônica da sessão</h2>
      <form id="m-form-cron" class="m-form m-linha" novalidate>
        <div class="m-campo"><label for="cr-texto">Registrar um momento</label><input type="text" id="cr-texto" maxlength="500" placeholder="Ex.: O grupo encontra o diário do bispo." autocomplete="off"></div>
        <button type="submit" class="ghost" id="cr-add">Registrar</button>
      </form>
      <p class="m-erro" id="m-erro-cron" role="alert" hidden></p>
      <div class="m-acoes"><button type="button" class="primary" id="cr-ler" data-ic="livro">Ler a crônica</button><button type="button" class="ghost" id="cr-baixar" data-ic="baixar">Baixar (.md)</button></div>
      <ol id="m-cron" class="m-cron-lista" aria-label="Momentos registrados"></ol></section>`;
  }
  function secaoDados() {
    return `<section class="m-cartao m-dados-m" aria-labelledby="t-dados"><h2 id="t-dados">Dados do mestre ${sub('só você vê · nada vai ao servidor')}</h2>
      <div class="dm-tipos" role="group" aria-label="Dado">${LADOS.map(l => `<button type="button" class="dm-tipo ${l === 20 ? 'on' : ''}" data-l="${l}" aria-pressed="${l === 20}">${l === 100 ? 'd%' : 'd' + l}</button>`).join('')}</div>
      <div class="dm-linha">
        <div class="m-campo"><label for="dm-qtd">Quantos</label><input type="number" id="dm-qtd" min="1" max="20" value="1" inputmode="numeric"></div>
        <div class="m-campo"><label for="dm-mod">Modificador</label><input type="number" id="dm-mod" min="-50" max="50" value="0" inputmode="numeric"></div>
        <button type="button" class="primary" id="dm-rolar" data-ic="dado">Rolar</button>
      </div>
      <div id="dm-res" class="dm-res" role="status" aria-live="polite"></div>
      <ol id="dm-hist" class="dm-hist" aria-label="Últimas rolagens do mestre"></ol></section>`;
  }

  // ---------- abas (teclado: setas, Home, End; a escolhida é lembrada) ----------
  function ligarAbas() {
    const abas = [...document.querySelectorAll('.m-aba')];
    const ir = (b, foco) => {
      abas.forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
      document.querySelectorAll('.m-aba-p').forEach(p => { p.hidden = p.dataset.p !== b.dataset.aba; });
      try { localStorage.setItem('lotm-grimorio-aba', b.dataset.aba); } catch (e) { /* só nesta visita */ }
      if (foco) b.focus();
    };
    abas.forEach((b, i) => {
      b.addEventListener('click', () => ir(b));
      b.addEventListener('keydown', e => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); ir(abas[(i + k + abas.length) % abas.length], true); }
        if (e.key === 'Home') { e.preventDefault(); ir(abas[0], true); } if (e.key === 'End') { e.preventDefault(); ir(abas[abas.length - 1], true); }
      });
    });
    let guardada = null; try { guardada = localStorage.getItem('lotm-grimorio-aba'); } catch (e) { /* idem */ }
    ir(abas.find(b => b.dataset.aba === guardada) || abas[0]);
  }
  const irParaAba = id => { const b = document.querySelector(`.m-aba[data-aba="${id}"]`); if (b) b.click(); };

  // ---------- quem pode entrar em duelo / roda: jogadores e figuras ----------
  const opcoesLados = () => `<optgroup label="Jogadores">${S.jogadores.map(j => `<option value="jogador:${esc(j.user_id)}">${esc(j.nome)}</option>`).join('')}</optgroup>`
    + ((S.figuras || []).length ? `<optgroup label="Figuras da cena">${S.figuras.map(f => `<option value="figura:${esc(f.id)}">${esc(f.nome)}</option>`).join('')}</optgroup>` : '');
  // figura sem ficha (só bônus) não tem atributo; a que veio do bestiário tem os modificadores dela
  const semAttr = v => { if (!String(v).startsWith('figura:')) return false; const f = (S.figuras || []).find(x => 'figura:' + x.id === v); return !f || !Object.keys(obj(f.mods)).length; };
  function preencherLados() {
    ['#d-a', '#d-b'].forEach((sel, i) => {
      const el = $(sel); if (!el) return; const atual = el.value;
      el.innerHTML = opcoesLados();
      if ([...el.options].some(o => o.value === atual)) el.value = atual; else if (el.options[i]) el.value = el.options[i].value;
      const attr = $(sel + '-attr'); if (attr) attr.disabled = semAttr(el.value);
    });
  }

  // ---------- medalhão (sigilo do Caminho ou inicial) usado na Roda e no Duelo ----------
  const medalhao = (p, tam) => { const cid = idOk(p.caminhoId); return `<span class="md" style="--cc:${corOk(p.cor)}">${cid ? `<img src="img/sigilos/${cid}.webp" alt="" width="${tam}" height="${tam}">` : `<b aria-hidden="true">${esc((p.nome || '?').trim().charAt(0).toUpperCase())}</b>`}</span>`; };

  // ---------- Duelo ----------
  function duelHTML(d, paraMestre = true) {
    const A = obj(d.a), B = obj(d.b), ta = num(A.total, -99, 999), tb = num(B.total, -99, 999), venc = ta === tb ? null : ta > tb ? 'a' : 'b';
    const lado = (L, k) => `<div class="du-lado ${venc === k ? 'vence' : venc ? 'perde' : 'empata'}">${medalhao(L, 54)}<b class="du-nome">${esc(L.nome)}</b>
      <span class="du-num">${num(L.total, -99, 999)}</span><small>d20 ${num(L.dado, 1, 20)}${num(L.mod, -30, 30) ? ' ' + sinal(num(L.mod, -30, 30)) : ''}${L.atributo ? ' · ' + esc(NOME_ATTR[L.atributo] || '') : ''}</small></div>`;
    return `<div class="du ${paraMestre ? '' : 'jog'}"><p class="du-rot">${esc(d.rotulo || 'Duelo')}</p><div class="du-arena">${lado(A, 'a')}<span class="du-x" aria-hidden="true">×</span>${lado(B, 'b')}</div>
      <p class="du-fim">${venc ? `<b>${esc((venc === 'a' ? A : B).nome)}</b> leva a melhor` : '<b>Empate</b> — o mestre decide'}${paraMestre && d.visivel === false ? ' · <i>só você viu</i>' : ''}</p></div>`;
  }
  function ligarDuelo() {
    ['#d-a', '#d-b'].forEach(sel => $(sel).addEventListener('change', () => { $(sel + '-attr').disabled = semAttr($(sel).value); }));
    $('#m-form-duelo').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#d-rolar'), async () => {
      $('#m-erro-duelo').hidden = true;
      const [ta, ia] = ($('#d-a').value || ':').split(':'), [tb, ib] = ($('#d-b').value || ':').split(':');
      if (!ia || !ib) return erroEm('#m-erro-duelo', new Rede.ErroRede('Escolha os dois lados.'));
      if (ta === tb && ia === ib) return erroEm('#m-erro-duelo', new Rede.ErroRede('Escolha dois lados diferentes.'));
      try {
        const r = await Rede.rpc('mestre', 'disputar', { p_mesa: S.mesa.id, p_rotulo: $('#d-rotulo').value.trim(), p_a_tipo: ta, p_a_id: ia, p_a_attr: $('#d-a-attr').disabled ? '' : $('#d-a-attr').value, p_b_tipo: tb, p_b_id: ib, p_b_attr: $('#d-b-attr').disabled ? '' : $('#d-b-attr').value, p_visivel: $('#d-visivel').checked });
        const box = $('#m-duelo-res'); box.innerHTML = duelHTML({ ...r, visivel: $('#d-visivel').checked }); box.classList.remove('vem'); void box.offsetWidth; box.classList.add('vem');
        const A = r.a, B = r.b; anunciar(`${r.rotulo}: ${A.nome} ${A.total}, ${B.nome} ${B.total}`);
        carregarDisputas();
      } catch (e) { erroEm('#m-erro-duelo', e); }
    }); });
  }
  async function carregarDisputas() {
    if (!S.mesa) return;
    try { const r = await (await Rede.tabela('mestre', 'disputas')).select('id,rotulo,a,b,visivel,criado_em').eq('mesa_id', S.mesa.id).order('criado_em', { ascending: false }).limit(30); if (r.error) throw r.error; S.disputas = r.data || []; } catch (e) { /* fica a lista antiga */ }
  }

  // ---------- Roda do Destino ----------
  async function carregarEncontro() {
    if (!S.mesa) return;
    try { const r = await (await Rede.tabela('mestre', 'encontros')).select('ativo,rodada,vez,ordem,atualizado_em').eq('mesa_id', S.mesa.id); if (r.error) throw r.error; S.encontro = (r.data || [])[0] || null; } catch (e) { return; }
    desenharRoda();
  }
  function desenharRoda() {
    const e = S.encontro && S.encontro.ativo ? S.encontro : null, faixa = $('#m-roda'), ctrl = $('#m-roda-ctrl');
    const ordem = e && Array.isArray(e.ordem) ? e.ordem.map(obj) : [], vez = e ? num(e.vez, 0, 99) : 0, atual = ordem[vez];
    // o redesenho troca os botões: o foco do teclado vai para o próximo passo natural, nunca para o vazio
    const idFoco = document.activeElement && /^rd-/.test(document.activeElement.id) ? document.activeElement.id : '';
    if (faixa) {
      faixa.hidden = !e;
      if (e) faixa.innerHTML = `<div class="rd-cab"><span class="rd-tit">Roda do Destino</span><b class="rd-rod">Rodada ${num(e.rodada, 1, 999)}</b>
          <span class="rd-agora">Vez de <b>${esc(atual ? atual.nome : '—')}</b></span>
          <button type="button" class="primary rd-prox" id="rd-prox">Próximo turno</button></div>
        <ol class="rd-fila" aria-label="Ordem da rodada">${ordem.map((p, i) => `<li class="rd-p ${i === vez ? 'vez' : ''} ${i < vez ? 'foi' : ''} ${p.tipo}" style="--i:${i}" ${i === vez ? 'aria-current="true"' : ''}>
          <span class="rd-chama" aria-hidden="true"></span>${medalhao(p, 40)}<span class="rd-nome">${esc(p.nome)}</span><small>${num(p.total, -99, 99)}</small></li>`).join('')}</ol>`;
      const b = $('#rd-prox'); if (b) b.addEventListener('click', ev => ocupado(ev.currentTarget, passarTurno));
    }
    if (ctrl) {
      const figs = S.figuras || [];
      ctrl.innerHTML = e
        ? `<p class="rd-estado">Rodada <b>${num(e.rodada, 1, 999)}</b> · vez de <b>${esc(atual ? atual.nome : '—')}</b>. A ordem aparece no topo do painel e na tela dos jogadores.</p>
           <div class="m-acoes"><button type="button" class="primary" id="rd-prox2">Próximo turno</button><button type="button" class="ghost" id="rd-girar">Girar de novo</button><button type="button" class="ghost c-dano" id="rd-fim">Encerrar o encontro</button></div>`
        : `<p class="hint">Todos os jogadores da mesa entram. O servidor rola d20 + Agilidade da ficha de cada um${figs.length ? ' e d20 + bônus das figuras escolhidas' : ''}.</p>
           ${figs.length ? `<fieldset class="rd-figs"><legend>Figuras que entram</legend>${figs.map(f => `<label><input type="checkbox" value="${esc(f.id)}" checked><span>${esc(f.nome)} <i>${sinal(f.bonus)}</i></span></label>`).join('')}</fieldset>` : '<p class="hint">Dica: chame figuras (NPCs) abaixo para elas entrarem na roda.</p>'}
           <div class="m-acoes"><button type="button" class="primary" id="rd-girar">Girar a Roda</button></div>`;
      const g = $('#rd-girar'); if (g) g.addEventListener('click', ev => ocupado(ev.currentTarget, girarRoda));
      const p2 = $('#rd-prox2'); if (p2) p2.addEventListener('click', ev => ocupado(ev.currentTarget, passarTurno));
      const f = $('#rd-fim'); if (f) f.addEventListener('click', async () => { if (await confirmar({ titulo: 'Encerrar o encontro?', texto: 'A Roda some da tela de todos. Dá para girar de novo depois.', botao: 'Encerrar' })) ocupado(f, async () => { try { await Rede.rpc('mestre', 'encerrar_encontro', { p_mesa: S.mesa.id }); await carregarEncontro(); anunciar('Encontro encerrado'); } catch (er) { erroEm('#m-erro-roda', er); } }); });
    }
    desenharJogadores_vez();
    if (idFoco) {
      const proximo = { 'rd-girar': e ? 'rd-prox2' : 'rd-girar', 'rd-fim': 'rd-girar', 'rd-prox': 'rd-prox', 'rd-prox2': e ? 'rd-prox2' : 'rd-girar' }[idFoco] || idFoco;
      const alvo = document.getElementById(proximo) || document.getElementById('rd-girar'); if (alvo && (!document.activeElement || document.activeElement === document.body)) alvo.focus({ preventScroll: true });
    }
  }
  async function girarRoda() {
    $('#m-erro-roda').hidden = true;
    const figs = [...document.querySelectorAll('.rd-figs input:checked')].map(i => i.value);
    try { await Rede.rpc('mestre', 'iniciar_encontro', { p_mesa: S.mesa.id, p_figuras: figs }); await carregarEncontro(); const a = obj((S.encontro.ordem || [])[0]); anunciar('A Roda girou. Primeiro: ' + (a.nome || '')); }
    catch (e) { erroEm('#m-erro-roda', e); }
  }
  async function passarTurno() {
    try { await Rede.rpc('mestre', 'proximo_turno', { p_mesa: S.mesa.id }); await carregarEncontro(); const e = S.encontro; const p = obj((e.ordem || [])[e.vez]); anunciar(`Rodada ${e.rodada}. Vez de ${p.nome || ''}`); }
    catch (er) { erroEm('#m-erro-roda', er); }
  }
  // a carta de quem está na vez ganha a chama
  function desenharJogadores_vez() {
    const e = S.encontro && S.encontro.ativo ? S.encontro : null, p = e ? obj((e.ordem || [])[num(e.vez, 0, 99)]) : {};
    document.querySelectorAll('.m-carta-j').forEach(c => c.classList.toggle('na-vez', !!e && p.tipo === 'jogador' && c.dataset.u === p.id));
  }

  // ---------- Figuras da cena ----------
  async function carregarFiguras() {
    if (!S.mesa) return;
    try { const r = await (await Rede.tabela('mestre', 'figuras')).select('id,nome,bonus,pv,pv_max,ficha_id,mods,defesa,criado_em').eq('mesa_id', S.mesa.id).order('criado_em'); if (r.error) throw r.error; S.figuras = r.data || []; } catch (e) { return; }
    desenharFiguras(); preencherLados(); if (!(S.encontro && S.encontro.ativo)) desenharRoda();
  }
  function desenharFiguras() {
    const l = $('#m-figuras'); if (!l) return;
    l.innerHTML = (S.figuras || []).map(f => {
      const temPV = f.pv_max != null, pv = num(f.pv, 0, 9999), mx = num(f.pv_max, 1, 9999), e = temPV ? estado(pv, mx, EST_PV) : null;
      const fb = f.ficha_id && (S.bestiario || []).find(x => x.id === f.ficha_id), im = fb && imgOk(fb.imagem);
      return `<li class="m-fig ${e && e.cls === 'zero' ? 'caida' : ''} ${fb ? 'com-ficha' : ''}" data-f="${esc(f.id)}">${fb ? `<span class="fg-ret">${im ? `<img src="${im}" alt="">` : sombra(fb.nome)}</span>` : ''}<div class="fg-id"><b>${esc(f.nome)}</b><small>${fb ? `${esc(txt(fb.tipo, 40) || 'Criatura')} · ` : ''}inic. ${sinal(f.bonus)}${f.defesa != null ? ` · def ${num(f.defesa, 0, 99)}` : ''}${e ? ` · <span class="m-est pv ${e.cls}">${e.txt}</span>` : ''}</small></div>
        ${temPV ? `<div class="fg-pv">${barra('PV', pv, mx, '#e05a6a')}<div class="fg-bts" role="group" aria-label="PV de ${esc(f.nome)}">${[-5, -1, 1, 5].map(d => `<button type="button" class="c-chip fg-d" data-d="${d}" aria-label="${d < 0 ? 'Tirar' : 'Dar'} ${Math.abs(d)} PV de ${esc(f.nome)}">${d < 0 ? '−' : '+'}${Math.abs(d)}</button>`).join('')}</div></div>` : ''}
        ${fb ? `<button type="button" class="ghost fg-ficha" data-ic="livro">Ficha<span class="sr-only"> de ${esc(f.nome)}</span></button>` : ''}<button type="button" class="link-remover fg-x">Dispensar<span class="sr-only"> ${esc(f.nome)}</span></button></li>`;
    }).join('') || '<li class="hint m-vazio">Nenhuma figura. Lobos, cultistas, um bispo suspeito: chame quem estiver em cena.</li>';
    l.querySelectorAll('.m-fig').forEach(li => {
      const f = S.figuras.find(x => x.id === li.dataset.f); if (!f) return;
      li.querySelectorAll('.fg-d').forEach(b => b.addEventListener('click', async () => {
        const novo = Math.max(0, Math.min(f.pv_max, (f.pv == null ? f.pv_max : f.pv) + +b.dataset.d)); f.pv = novo; desenharFiguras();
        try { const r = await (await Rede.tabela('mestre', 'figuras')).update({ pv: novo }).eq('id', f.id); if (r.error) throw r.error; } catch (e) { erroEm('#m-erro-fig', e); carregarFiguras(); }
        const de = document.querySelector(`.m-fig[data-f="${CSS.escape(f.id)}"] .fg-d[data-d="${b.dataset.d}"]`); if (de) de.focus();
      }));
      const fbt = li.querySelector('.fg-ficha'); if (fbt) fbt.addEventListener('click', () => abrirCriatura(f.ficha_id, fbt, f.nome));
      li.querySelector('.fg-x').addEventListener('click', async () => {
        try { const r = await (await Rede.tabela('mestre', 'figuras')).delete().eq('id', f.id); if (r.error) throw r.error; anunciar(f.nome + ' sai de cena'); carregarFiguras(); } catch (e) { erroEm('#m-erro-fig', e); }
      });
    });
  }
  function ligarFiguras() {
    $('#m-form-fig').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#f-add'), async () => {
      $('#m-erro-fig').hidden = true;
      const nome = $('#f-nome').value.trim(), bonus = num($('#f-bonus').value, -10, 20), pvTxt = $('#f-pv').value.trim(), pv = pvTxt ? num(pvTxt, 1, 9999) : null;
      if (!nome) return erroEm('#m-erro-fig', new Rede.ErroRede('Dê um nome à figura.'));
      try {
        const r = await (await Rede.tabela('mestre', 'figuras')).insert({ mesa_id: S.mesa.id, nome, bonus: bonus == null ? 0 : bonus, pv, pv_max: pv }).select('id'); if (r.error) throw r.error;
        $('#f-nome').value = ''; $('#f-pv').value = ''; $('#f-bonus').value = '0'; anunciar(nome + ' entra em cena'); carregarFiguras(); $('#f-nome').focus();
      } catch (e) { erroEm('#m-erro-fig', e); }
    }); });
  }

  // ---------- Crônica da sessão ----------
  async function carregarCronica() {
    if (!S.mesa) return;
    try { const r = await (await Rede.tabela('mestre', 'cronica')).select('id,texto,criado_em').eq('mesa_id', S.mesa.id).order('criado_em', { ascending: false }).limit(200); if (r.error) throw r.error; S.cronica = r.data || []; } catch (e) { return; }
    const l = $('#m-cron'); if (!l) return;
    l.innerHTML = S.cronica.slice(0, 8).map(c => `<li><span>${esc(hora(c.criado_em))}</span><p>${esc(c.texto)}</p><button type="button" class="link-remover" data-cr="${esc(c.id)}">Apagar<span class="sr-only"> momento</span></button></li>`).join('') || '<li class="hint m-vazio">Os momentos que você registrar entram na crônica junto com testes, duelos, sussurros e golpes.</li>';
    l.querySelectorAll('[data-cr]').forEach(b => b.addEventListener('click', async () => { try { const r = await (await Rede.tabela('mestre', 'cronica')).delete().eq('id', b.dataset.cr); if (r.error) throw r.error; carregarCronica(); } catch (e) { erroEm('#m-erro-cron', e); } }));
  }
  // junta tudo o que aconteceu na mesa numa linha do tempo (busca completa na hora de ler/baixar)
  async function eventosDaSessao() {
    const id = S.mesa.id, q = async (t, cols, n = 500) => { const r = await (await Rede.tabela('mestre', t)).select(cols).eq('mesa_id', id).order('criado_em', { ascending: false }).limit(n); if (r.error) throw r.error; return r.data || []; };
    const [res, sus, ords, dus, cro] = await Promise.all([q('resultados_mestre', '*'), q('sussurros', 'id,para,titulo,texto,tem_imagem,criado_em'), q('ordens', 'id,para,tipo,valor,motivo,criado_em'), q('disputas', 'id,rotulo,a,b,visivel,criado_em'), q('cronica', 'id,texto,criado_em')]);
    const ev = [];
    res.forEach(r => ev.push({ t: r.criado_em, tipo: 'teste', txt: `${nomeDe(r.user_id)} — ${r.rotulo} (${r.tipo}): ${r.lados === 100 ? 'd%' : 'd' + r.lados} ${r.dado}${r.modificador ? ' ' + sinal(r.modificador) : ''} = ${r.total} contra ${r.dificuldade} · ${r.passou ? 'passou' : 'falhou'}${r.lados === 20 && r.dado === 20 ? ' · 20 natural' : r.lados === 20 && r.dado === 1 ? ' · 1 natural' : ''}` }));
    sus.forEach(s => ev.push({ t: s.criado_em, tipo: 'sussurro', txt: `Sussurro para ${s.para ? nomeDe(s.para) : 'todos'}${s.titulo ? ` — “${s.titulo}”` : ''}${s.texto ? `: ${s.texto}` : ''}${s.tem_imagem ? ' [pista com imagem]' : ''}` }));
    ords.filter(o => o.tipo !== 'terror').forEach(o => ev.push({ t: o.criado_em, tipo: 'golpe', txt: `${nomeDe(o.para)} ${o.valor < 0 ? 'perde' : 'recupera'} ${Math.abs(o.valor)} ${o.tipo === 'pv' ? 'PV' : 'de Sanidade'}${o.motivo ? ` — ${o.motivo}` : ''}` }));
    ords.filter(o => o.tipo === 'terror').forEach(o => ev.push({ t: o.criado_em, tipo: 'terror', txt: o.valor === 1 ? 'O Terror toma a mesa' : 'O Terror se dissipa', chave: 'terror' + o.valor + o.criado_em.slice(0, 19) }));
    dus.forEach(d => { const A = obj(d.a), B = obj(d.b); ev.push({ t: d.criado_em, tipo: 'duelo', txt: `Duelo — ${d.rotulo}: ${A.nome} ${A.total} × ${B.total} ${B.nome}${A.total === B.total ? ' · empate' : ` · ${(A.total > B.total ? A : B).nome} leva a melhor`}` }); });
    cro.forEach(c => ev.push({ t: c.criado_em, tipo: 'momento', txt: c.texto }));
    const vistos = new Set();   // um "Terror" para a mesa gera uma ordem por jogador: aparece uma vez só
    return ev.filter(e => !e.chave || (!vistos.has(e.chave) && vistos.add(e.chave))).sort((a, b) => new Date(a.t) - new Date(b.t));
  }
  const ROT_TIPO = { teste: 'Teste', sussurro: 'Sussurro', golpe: 'Golpe', terror: 'Terror', duelo: 'Duelo', momento: 'Momento' };
  function cronicaMarkdown(ev) {
    const dia = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const linhas = [`# Crônica — ${S.mesa.nome}`, '', `*Sessão de ${dia} · ${S.jogadores.map(j => j.nome).join(', ') || 'sem jogadores'}*`, ''];
    ev.forEach(e => linhas.push(`- **${hora(e.t)} · ${ROT_TIPO[e.tipo]}** — ${e.txt.replace(/\n+/g, ' ')}`));
    if (!ev.length) linhas.push('_Nada aconteceu ainda._');
    return linhas.join('\n') + '\n';
  }
  async function lerCronica(gatilho) {
    let ev; try { ev = await eventosDaSessao(); } catch (e) { return erroEm('#m-erro-cron', e); }
    const fundo = document.createElement('div'); fundo.className = 'm-ficha-fundo cr-fundo'; fundo.id = 'm-cronica';
    const dia = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    fundo.innerHTML = `<section class="cr-pagina" role="dialog" aria-modal="true" aria-labelledby="cr-tit" tabindex="-1">
      <button type="button" class="icon cr-x" aria-label="Fechar a crônica">✕</button>
      <div class="cr-cab"><small>Crônica da sessão</small><h2 id="cr-tit">${esc(S.mesa.nome)}</h2><p>${esc(dia)} · ${esc(S.jogadores.map(j => j.nome).join(', ') || 'sem jogadores')}</p></div>
      ${ev.length ? `<ol class="cr-linha">${ev.map(e => `<li class="cr-e ${e.tipo}"><span class="cr-h">${esc(hora(e.t))}</span><span class="cr-t">${ROT_TIPO[e.tipo]}</span><p>${esc(e.txt)}</p></li>`).join('')}</ol>` : '<p class="cr-vazio">Nada aconteceu ainda. A história começa no primeiro dado.</p>'}
      <footer class="cr-pe"><button type="button" class="ghost" id="cr-imprimir">Imprimir</button><button type="button" class="ghost" id="cr-baixar2">Baixar (.md)</button></footer></section>`;
    document.body.appendChild(fundo); document.body.classList.add('m-com-ficha');
    const fechar = () => { fundo.remove(); document.body.classList.remove('m-com-ficha'); if (gatilho && gatilho.isConnected) gatilho.focus(); };
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
    fundo.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); fechar(); } if (e.key === 'Tab') { const f = [...fundo.querySelectorAll('button')]; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } });
    fundo.querySelector('.cr-x').addEventListener('click', fechar);
    fundo.querySelector('#cr-imprimir').addEventListener('click', () => { document.body.classList.add('imprimindo-cronica'); window.print(); setTimeout(() => document.body.classList.remove('imprimindo-cronica'), 500); });
    fundo.querySelector('#cr-baixar2').addEventListener('click', () => baixarCronica(ev));
    fundo.querySelector('.cr-x').focus();
  }
  async function baixarCronica(evPronto) {
    let ev = evPronto; if (!ev) { try { ev = await eventosDaSessao(); } catch (e) { return erroEm('#m-erro-cron', e); } }
    const md = cronicaMarkdown(ev), nome = 'cronica-' + S.mesa.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.md';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' })); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); S.ultimaCronica = md; anunciar('Crônica baixada');
  }
  function ligarCronica() {
    $('#m-form-cron').addEventListener('submit', ev => { ev.preventDefault(); ocupado($('#cr-add'), async () => {
      $('#m-erro-cron').hidden = true; const t = $('#cr-texto').value.trim();
      if (!t) return erroEm('#m-erro-cron', new Rede.ErroRede('Escreva o momento.'));
      try { const r = await (await Rede.tabela('mestre', 'cronica')).insert({ mesa_id: S.mesa.id, texto: t }).select('id'); if (r.error) throw r.error; $('#cr-texto').value = ''; anunciar('Momento registrado'); carregarCronica(); }
      catch (e) { erroEm('#m-erro-cron', e); }
    }); });
    $('#cr-ler').addEventListener('click', e => { const b = e.currentTarget; ocupado(b, () => lerCronica(b)); });
    $('#cr-baixar').addEventListener('click', e => ocupado(e.currentTarget, () => baixarCronica()));
  }

  // ---------- Dados do mestre (locais, crypto) ----------
  const rolarLocal = l => { const u = new Uint32Array(1); let x; do { crypto.getRandomValues(u); x = u[0]; } while (x >= Math.floor(0x100000000 / l) * l); return 1 + (x % l); };
  function ligarDadosMestre() {
    let lados = 20; const hist = [];
    document.querySelectorAll('.dm-tipo').forEach(b => b.addEventListener('click', () => {
      lados = +b.dataset.l; document.querySelectorAll('.dm-tipo').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    }));
    $('#dm-rolar').addEventListener('click', () => {
      const q = num($('#dm-qtd').value, 1, 20) || 1, mo = num($('#dm-mod').value, -50, 50) || 0;
      const vs = Array.from({ length: q }, () => rolarLocal(lados)), tot = vs.reduce((a, b) => a + b, 0) + mo, nat = lados === 20 && q === 1 ? vs[0] : null;
      const rot = `${q}${lados === 100 ? 'd%' : 'd' + lados}${mo ? sinal(mo) : ''}`;
      const box = $('#dm-res');
      box.className = 'dm-res vem' + (nat === 20 ? ' crit' : nat === 1 ? ' fumble' : '');
      box.innerHTML = `<b class="dm-tot">${tot}</b><div><small>${esc(rot)}</small><span>${vs.map(v => `<i>${v}</i>`).join('')}${mo ? `<em>${sinal(mo)}</em>` : ''}</span>${nat === 20 ? '<strong>20 natural</strong>' : nat === 1 ? '<strong>1 natural</strong>' : ''}</div>`;
      void box.offsetWidth;
      hist.unshift(`${hora(new Date())} · ${rot} → ${tot}`); hist.length = Math.min(hist.length, 10);
      $('#dm-hist').innerHTML = hist.map(h => `<li>${esc(h)}</li>`).join('');
      anunciar(`${rot}: ${tot}`);
    });
  }

  // =====================================================================================================
  // BESTIÁRIO (criaturas prontas do mestre, valem em todas as mesas dele) e HABILIDADES DA MESA (conceder e aprovar)
  // =====================================================================================================
  const PERIGO = ['Incômodo', 'Ameaça', 'Perigoso', 'Mortal', 'Calamidade'];
  const IMG_OK = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  const imgOk = v => typeof v === 'string' && IMG_OK.test(v) ? v : '';
  const lista = v => Array.isArray(v) ? v : [];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const modDe = (mods, k) => num(obj(mods)[k], -10, 20) || 0;
  const olhos = n => `<span class="bs-perigo" role="img" aria-label="Perigo ${n} de 5: ${PERIGO[n - 1]}">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}<b aria-hidden="true">${PERIGO[n - 1]}</b></span>`;
  const sombra = nome => `<span class="bs-sombra" aria-hidden="true">${esc(txt(nome, 1).toUpperCase() || '?')}</span>`;
  // "2d6+3", "1d8 de dano", "d20 - 1": o primeiro dado escrito no efeito vira botão de rolar
  const DADO_RX = /(\d{0,2})d(\d{1,3})(?:\s*([+\-−])\s*(\d{1,3}))?/i;
  function rolarEfeito(ef) {
    const m = DADO_RX.exec(ef || ''); if (!m) return null;
    const q = Math.max(1, Math.min(20, +m[1] || 1)), l = Math.max(2, Math.min(100, +m[2])), mo = m[3] ? (m[3] === '+' ? 1 : -1) * +m[4] : 0;
    const vs = Array.from({ length: q }, () => rolarLocal(l));
    return { rot: `${q}d${l}${mo ? sinal(mo) : ''}`, vs, mo, total: Math.max(0, vs.reduce((a, b) => a + b, 0) + mo) };
  }
  // janela modal com foco preso (Esc e clique fora fecham; o foco volta para quem abriu)
  function janela(id, cls, html, gatilho, aoFechar) {
    const velha = document.getElementById(id); if (velha) velha.remove();
    const fundo = document.createElement('div'); fundo.className = 'm-ficha-fundo ' + cls; fundo.id = id; fundo.innerHTML = html;
    document.body.appendChild(fundo); document.body.classList.add('m-com-ficha');
    const fechar = (devolver = true) => { if (!fundo.isConnected) return; fundo.remove(); if (!document.querySelector('.m-ficha-fundo')) document.body.classList.remove('m-com-ficha'); if (aoFechar) aoFechar(); if (devolver && gatilho && gatilho.isConnected) gatilho.focus(); };
    fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
    fundo.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      const foc = [...fundo.querySelectorAll('button,[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent);
      if (!foc.length) return; const a = foc[0], z = foc[foc.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    if (typeof decorarTudo === 'function') decorarTudo();
    return { fundo, fechar };
  }

  function secaoBestiario() {
    return `<section class="m-cartao m-bes" aria-labelledby="t-bes"><h2 id="t-bes">Bestiário ${sub('suas criaturas · valem em todas as mesas')}</h2>
      <div class="bs-barra"><label class="sr-only" for="bs-busca">Procurar no bestiário</label><input type="search" id="bs-busca" placeholder="Procurar criatura ou tipo…" autocomplete="off">
        <button type="button" class="primary" id="bs-nova" data-ic="mais">Nova criatura</button></div>
      <p class="m-erro" id="m-erro-bes" role="alert" hidden></p>
      <ul id="m-bestiario" class="bs-grade" aria-label="Criaturas do bestiário"></ul></section>`;
  }
  function ligarBestiario() {
    $('#bs-nova').addEventListener('click', e => editarCriatura(null, e.currentTarget));
    $('#bs-busca').addEventListener('input', desenharBestiario);
  }
  async function carregarBestiario() {
    try { const r = await (await Rede.tabela('mestre', 'bestiario')).select('*').order('nome'); if (r.error) throw r.error; S.bestiario = r.data || []; } catch (e) { return; }
    desenharBestiario(); desenharFiguras();
  }
  function desenharBestiario() {
    const l = $('#m-bestiario'); if (!l) return;
    const q = norm(($('#bs-busca') || {}).value);
    const vis = (S.bestiario || []).filter(b => !q || norm(b.nome + ' ' + (b.tipo || '')).includes(q));
    l.innerHTML = vis.map(b => { const p = num(b.perigo, 1, 5) || 1, im = imgOk(b.imagem);
      return `<li class="bs-carta p${p}" data-b="${esc(b.id)}">
        <div class="bs-retrato">${im ? `<img src="${im}" alt="">` : sombra(b.nome)}</div>
        <div class="bs-corpo"><small class="bs-tipo">${esc(txt(b.tipo, 60) || 'Criatura')}</small><b class="bs-nome">${esc(b.nome)}</b>${olhos(p)}
          <p class="bs-num">${b.pv_max != null ? `<span><i>PV</i>${num(b.pv_max, 1, 9999)}</span>` : ''}${b.defesa != null ? `<span><i>Def</i>${num(b.defesa, 0, 99)}</span>` : ''}<span><i>Inic</i>${sinal(modDe(b.mods, 'agil'))}</span><span><i>Poderes</i>${lista(b.habilidades).length}</span></p></div>
        <div class="bs-acoes"><button type="button" class="primary bs-chamar" data-ic="mais">Chamar<span class="sr-only"> ${esc(b.nome)} à cena</span></button><button type="button" class="ghost bs-ver" data-ic="livro">Ficha<span class="sr-only"> de ${esc(b.nome)}</span></button><button type="button" class="ghost bs-revelar" data-ic="olho">Revelar<span class="sr-only"> ${esc(b.nome)} aos jogadores</span></button></div></li>`;
    }).join('') || `<li class="hint m-vazio">${q ? 'Nenhuma criatura com esse nome.' : 'O bestiário está vazio. Crie a primeira criatura: um lobo de olhos de vidro, um cultista da Aurora, o espectro do cais.'}</li>`;
    l.querySelectorAll('.bs-carta').forEach(li => {
      const b = S.bestiario.find(x => x.id === li.dataset.b); if (!b) return;
      li.querySelector('.bs-chamar').addEventListener('click', e => ocupado(e.currentTarget, () => chamarCriatura(b, '#m-erro-bes')));
      li.querySelector('.bs-ver').addEventListener('click', e => abrirCriatura(b.id, e.currentTarget));
      li.querySelector('.bs-revelar').addEventListener('click', e => { const bt = e.currentTarget; ocupado(bt, () => revelarCriatura(b, '#m-erro-bes')); });
    });
  }
  // a criatura entra na cena como figura: PV cheio, iniciativa = Agilidade, modificadores para o Duelo ("Lobo", "Lobo 2"…)
  async function chamarCriatura(b, erroSel) {
    const e0 = $(erroSel); if (e0) e0.hidden = true;
    const usados = new Set((S.figuras || []).map(f => f.nome)); let nome = txt(b.nome, 40), n = 1;
    while (usados.has(nome)) nome = `${txt(b.nome, 36).trim()} ${++n}`;
    const pv = b.pv_max != null ? num(b.pv_max, 1, 9999) : null;
    try {
      const r = await (await Rede.tabela('mestre', 'figuras')).insert({ mesa_id: S.mesa.id, nome, bonus: modDe(b.mods, 'agil'), pv, pv_max: pv, ficha_id: b.id, mods: obj(b.mods), defesa: b.defesa == null ? null : num(b.defesa, 0, 99) }).select('id');
      if (r.error) throw r.error;
      anunciar(nome + ' entra em cena'); await carregarFiguras(); return true;
    } catch (e) { erroEm(erroSel, e); return false; }
  }
  // revelar = um sussurro para todos com o retrato, o nome e a descrição (números e notas ficam com o mestre)
  async function revelarCriatura(b, erroSel) {
    const e0 = $(erroSel); if (e0) e0.hidden = true;
    if (!S.jogadores.length) return erroEm(erroSel, new Rede.ErroRede('Ninguém na mesa para ver a criatura.'));
    const ok2 = await confirmar({ titulo: `Revelar ${b.nome} aos jogadores?`, texto: 'Todos recebem o retrato, o nome e a descrição. Números, poderes e suas notas ficam só com você.', botao: 'Revelar' });
    if (!ok2) return;
    try {
      await Rede.rpc('mestre', 'sussurrar', { p_mesa: S.mesa.id, p_para: null, p_titulo: txt(b.nome, 80), p_texto: txt(b.descricao, 1000) || 'Algo surge diante de vocês.', p_imagem: imgOk(b.imagem) || null });
      anunciar(b.nome + ' foi revelada aos jogadores'); carregarSussurros();
    } catch (e) { erroEm(erroSel, e); }
  }

  // ---------- ficha da criatura (leitura, rolar poderes, dano direto nos jogadores) ----------
  function abrirCriatura(id, gatilho, figNome) {
    const b = (S.bestiario || []).find(x => x.id === id); if (!b) return;
    const p = num(b.perigo, 1, 5) || 1, im = imgOk(b.imagem), hs = lista(b.habilidades).map(obj).filter(h => txt(h.nome)), quem = figNome || b.nome;
    const { fundo, fechar } = janela('m-criatura', 'bs-fundo', `<section class="bs-ficha p${p}" role="dialog" aria-modal="true" aria-labelledby="bf-nome" tabindex="-1">
      <button type="button" class="icon bf-x" aria-label="Fechar a ficha da criatura">✕</button>
      <div class="bf-cab">
        <figure class="bf-retrato">${im ? `<img src="${im}" alt="Retrato de ${esc(b.nome)}">` : sombra(b.nome)}</figure>
        <div class="bf-id"><small class="bf-tipo">${esc(txt(b.tipo, 60) || 'Criatura')}${figNome ? ` · <i>em cena como ${esc(figNome)}</i>` : ''}</small><h2 id="bf-nome">${esc(b.nome)}</h2>${olhos(p)}
          <dl class="bf-vit">${b.pv_max != null ? `<div><dt>PV</dt><dd>${num(b.pv_max, 1, 9999)}</dd></div>` : ''}${b.defesa != null ? `<div><dt>Defesa</dt><dd>${num(b.defesa, 0, 99)}</dd></div>` : ''}<div><dt>Iniciativa</dt><dd>${sinal(modDe(b.mods, 'agil'))}</dd></div></dl>
          ${txt(b.horror) ? `<p class="bf-horror"><span>Horror</span> ${esc(txt(b.horror, 120))}</p>` : ''}</div>
      </div>
      <ul class="bf-attrs" aria-label="Modificadores">${ATTRS.map(a => `<li style="--ac:${a.cor}"><span>${a.nome}</span><b>${sinal(modDe(b.mods, a.key))}</b></li>`).join('')}</ul>
      <section class="bf-bloco"><h3>Poderes</h3>${hs.length ? `<ol class="bf-hab">${hs.map((h, i) => `<li data-i="${i}"><div class="bf-h-txt"><b>${esc(txt(h.nome, 60))}</b>${txt(h.efeito) ? `<em>${esc(txt(h.efeito, 60))}</em>` : ''}${txt(h.desc) ? `<p>${esc(txt(h.desc, 400))}</p>` : ''}</div>
        ${DADO_RX.test(txt(h.efeito)) ? `<button type="button" class="ghost bf-rolar" id="bf-rolar-${i}" data-i="${i}" data-ic="dado">Rolar<span class="sr-only"> ${esc(txt(h.nome, 60))}</span></button>` : ''}<div class="bf-res" id="bf-res-${i}" role="status" aria-live="polite"></div></li>`).join('')}</ol>` : '<p class="hint">Sem poderes anotados.</p>'}</section>
      ${txt(b.descricao) ? `<section class="bf-bloco"><h3>O que os jogadores veem</h3><p class="bf-desc">${esc(txt(b.descricao, 1000))}</p></section>` : ''}
      ${txt(b.notas) ? `<section class="bf-bloco bf-segredo"><h3>Notas secretas <i>só você vê</i></h3><p class="bf-desc">${esc(txt(b.notas, 1500))}</p></section>` : ''}
      <p class="m-erro" id="bf-erro" role="alert" hidden></p>
      <footer class="bf-pe"><button type="button" class="primary" id="bf-chamar" data-ic="mais">Chamar à cena</button><button type="button" class="ghost" id="bf-revelar" data-ic="olho">Revelar aos jogadores</button>
        <button type="button" class="ghost" id="bf-editar" data-ic="ajuste">Editar</button><button type="button" class="link-remover" id="bf-apagar">Apagar do bestiário</button></footer></section>`, gatilho);
    fundo.querySelector('.bf-x').addEventListener('click', () => fechar());
    fundo.querySelectorAll('.bf-rolar').forEach(bt => bt.addEventListener('click', () => {
      const i = +bt.dataset.i, h = hs[i], r = rolarEfeito(h.efeito); if (!r) return;
      const box = fundo.querySelector('#bf-res-' + i); box.classList.remove('vem'); void box.offsetWidth; box.classList.add('vem');
      box.innerHTML = `<span class="bf-tot">${r.total}</span><small>${esc(r.rot)} · ${r.vs.join(' + ')}${r.mo ? ' ' + sinal(r.mo) : ''}</small>
        ${S.jogadores.length ? `<span class="bf-aplicar"><label class="sr-only" for="bf-alvo-${i}">Em quem</label><select id="bf-alvo-${i}">${S.jogadores.map(j => `<option value="${esc(j.user_id)}">${esc(j.nome)}</option>`).join('')}</select>
          <button type="button" class="ghost c-dano bf-pv" id="bf-pv-${i}">Ferir</button><button type="button" class="ghost bf-san" id="bf-san-${i}">Abalar a mente</button></span>` : ''}`;
      anunciar(`${h.nome}: ${r.total}`);
      const aplicar = (tipo, botao) => ocupado(botao, async () => {
        const para = fundo.querySelector('#bf-alvo-' + i).value;
        try { await Rede.rpc('mestre', 'ordenar', { p_mesa: S.mesa.id, p_para: para, p_tipo: tipo, p_valor: -Math.max(1, r.total), p_motivo: txt(`${quem}: ${h.nome}`, 80) }); botao.textContent = 'Feito'; anunciar(`${nomeDe(para)} ${tipo === 'pv' ? 'perde ' + r.total + ' PV' : 'perde ' + r.total + ' de Sanidade'}`); carregarOrdens(); }
        catch (e) { erroEm('#bf-erro', e); }
      });
      const bp = box.querySelector('.bf-pv'), bs = box.querySelector('.bf-san');
      if (bp) bp.addEventListener('click', () => aplicar('pv', bp)); if (bs) bs.addEventListener('click', () => aplicar('san', bs));
    }));
    fundo.querySelector('#bf-chamar').addEventListener('click', e => ocupado(e.currentTarget, async () => { if (await chamarCriatura(b, '#bf-erro')) { fechar(false); irParaAba('cena'); const f = $('#m-figuras'); if (f) f.scrollIntoView({ block: 'nearest' }); } }));
    fundo.querySelector('#bf-revelar').addEventListener('click', e => ocupado(e.currentTarget, () => revelarCriatura(b, '#bf-erro')));
    fundo.querySelector('#bf-editar').addEventListener('click', () => { fechar(false); editarCriatura(b, gatilho); });
    fundo.querySelector('#bf-apagar').addEventListener('click', async () => {
      const ok2 = await confirmar({ titulo: `Apagar ${b.nome} do bestiário?`, texto: 'A ficha some de todas as suas mesas. As figuras que já estão em cena continuam, só sem a ficha.', botao: 'Apagar', perigo: true });
      if (!ok2) return;
      try { const r = await (await Rede.tabela('mestre', 'bestiario')).delete().eq('id', b.id); if (r.error) throw r.error; fechar(false); anunciar(b.nome + ' saiu do bestiário'); await carregarBestiario(); carregarFiguras(); const nv = $('#bs-nova'); if (nv) nv.focus(); }
      catch (e) { erroEm('#bf-erro', e); }
    });
    fundo.querySelector('.bf-x').focus();
  }

  // ---------- criar / editar uma criatura ----------
  function editarCriatura(b0, gatilho) {
    const novo = !b0, b = b0 || { nome: '', tipo: '', perigo: 2, pv_max: null, defesa: null, horror: '', mods: {}, habilidades: [], descricao: '', notas: '', imagem: null };
    let imagem = imgOk(b.imagem) || null;
    const habs = lista(b.habilidades).map(obj).map(h => ({ nome: txt(h.nome, 60), efeito: txt(h.efeito, 60), desc: txt(h.desc, 400) }));
    const v = x => esc(x == null ? '' : x);
    const { fundo, fechar } = janela('m-bes-editor', 'bs-fundo', `<section class="bs-editor" role="dialog" aria-modal="true" aria-labelledby="be-tit" tabindex="-1"><form id="be-form" novalidate>
      <button type="button" class="icon bf-x" aria-label="Fechar sem salvar">✕</button>
      <small class="bf-tipo">Bestiário</small><h2 id="be-tit">${novo ? 'Nova criatura' : 'Editar ' + esc(b.nome)}</h2>
      <div class="be-topo">
        <div class="be-retrato"><div class="be-img" id="be-img"></div>
          <div class="s-escolher"><input type="file" id="be-arq" accept="image/*" class="s-arquivo" aria-label="Escolher retrato da criatura"><span class="s-botao" aria-hidden="true">Escolher retrato</span></div>
          <button type="button" class="link-remover" id="be-tirar">Tirar retrato</button></div>
        <div class="m-grade be-grade">
          <div class="m-campo m-largo"><label for="be-nome">Nome</label><input type="text" id="be-nome" maxlength="60" value="${v(b.nome)}" placeholder="Ex.: Lobo de olhos de vidro" autocomplete="off"></div>
          <div class="m-campo m-largo"><label for="be-tipo">Tipo <i>(opcional)</i></label><input type="text" id="be-tipo" maxlength="60" value="${v(b.tipo)}" placeholder="Ex.: Fera corrompida · Beyonder Seq. 8" autocomplete="off"></div>
          <fieldset class="m-campo m-largo be-perigo"><legend>Perigo</legend><div class="be-olhos">${PERIGO.map((t, i) => `<label><input type="radio" name="be-perigo" value="${i + 1}" ${(num(b.perigo, 1, 5) || 2) === i + 1 ? 'checked' : ''}><span><i aria-hidden="true"></i>${t}</span></label>`).join('')}</div></fieldset>
          <div class="m-campo"><label for="be-pv">PV</label><input type="number" id="be-pv" min="1" max="9999" value="${v(b.pv_max)}" placeholder="opcional" inputmode="numeric"></div>
          <div class="m-campo"><label for="be-def">Defesa</label><input type="number" id="be-def" min="0" max="99" value="${v(b.defesa)}" placeholder="opcional" inputmode="numeric"></div>
        </div>
      </div>
      <fieldset class="be-mods"><legend>Modificadores <i>usados no Duelo · Agilidade é a iniciativa</i></legend>
        ${ATTRS.map(a => `<div class="m-campo" style="--ac:${a.cor}"><label for="be-m-${a.key}">${a.nome}</label><input type="number" id="be-m-${a.key}" min="-10" max="20" value="${modDe(b.mods, a.key)}" inputmode="numeric"></div>`).join('')}</fieldset>
      <div class="m-campo"><label for="be-horror">Horror <i>(opcional: o que ver a criatura causa)</i></label><input type="text" id="be-horror" maxlength="120" value="${v(b.horror)}" placeholder="Ex.: Quem a encara perde 1d4 de Sanidade" autocomplete="off"></div>
      <fieldset class="be-habs"><legend>Poderes <i>até 12 · um dado no efeito (2d6+3) vira botão de rolar</i></legend><ol id="be-habs"></ol>
        <button type="button" class="ghost" id="be-hab-mais" data-ic="mais">Adicionar poder</button></fieldset>
      <div class="m-campo"><label for="be-desc">O que os jogadores veem <i>(vai junto quando você revela)</i></label><textarea id="be-desc" maxlength="1000" rows="3" placeholder="Pelagem empapada de névoa, olhos que refletem a luz como vidro de lampião…">${v(b.descricao)}</textarea></div>
      <div class="m-campo"><label for="be-notas">Notas secretas <i>(só você: táticas, fraquezas, segredos)</i></label><textarea id="be-notas" maxlength="1500" rows="3" placeholder="Foge do fogo. Obedece a quem segura o apito de osso.">${v(b.notas)}</textarea></div>
      <p class="m-erro" id="be-erro" role="alert" hidden></p>
      <div class="m-acoes"><button type="submit" class="primary" id="be-salvar">${novo ? 'Guardar no bestiário' : 'Salvar'}</button><button type="button" class="ghost" id="be-cancelar">Cancelar</button></div></form></section>`, gatilho);
    const forma = fundo.querySelector('form');
    const desenharImg = () => { fundo.querySelector('#be-img').innerHTML = imagem ? `<img src="${imagem}" alt="Retrato escolhido">` : `${sombra(fundo.querySelector('#be-nome').value || b.nome)}<small>sem retrato</small>`; fundo.querySelector('#be-tirar').hidden = !imagem; };
    const desenharHabs = foco => {
      const ol = fundo.querySelector('#be-habs');
      ol.innerHTML = habs.map((h, i) => `<li class="be-hab" data-i="${i}"><span class="be-n" aria-hidden="true">${i + 1}</span>
        <div class="m-campo"><label for="be-h-nome-${i}">Nome do poder ${i + 1}</label><input type="text" id="be-h-nome-${i}" data-k="nome" data-i="${i}" maxlength="60" value="${v(h.nome)}" placeholder="Ex.: Mordida de névoa" autocomplete="off"></div>
        <div class="m-campo"><label for="be-h-efeito-${i}">Efeito</label><input type="text" id="be-h-efeito-${i}" data-k="efeito" data-i="${i}" maxlength="60" value="${v(h.efeito)}" placeholder="Ex.: 2d6+2 de dano" autocomplete="off"></div>
        <div class="m-campo be-h-desc"><label for="be-h-desc-${i}">Como funciona</label><input type="text" id="be-h-desc-${i}" data-k="desc" data-i="${i}" maxlength="400" value="${v(h.desc)}" placeholder="Ex.: Ignora armadura de couro" autocomplete="off"></div>
        <button type="button" class="link-remover be-h-x" data-i="${i}">Tirar<span class="sr-only"> o poder ${i + 1}</span></button></li>`).join('') || '<li class="hint m-vazio">Nenhum poder. Mordidas, maldições, gritos que racham a mente…</li>';
      ol.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('input', () => { habs[+inp.dataset.i][inp.dataset.k] = inp.value; }));
      ol.querySelectorAll('.be-h-x').forEach(bt => bt.addEventListener('click', () => { habs.splice(+bt.dataset.i, 1); desenharHabs(); fundo.querySelector('#be-hab-mais').focus(); }));
      fundo.querySelector('#be-hab-mais').disabled = habs.length >= 12;
      if (foco != null) { const f = ol.querySelector('#be-h-nome-' + foco); if (f) f.focus(); }
    };
    desenharImg(); desenharHabs();
    fundo.querySelector('#be-hab-mais').addEventListener('click', () => { if (habs.length < 12) { habs.push({ nome: '', efeito: '', desc: '' }); desenharHabs(habs.length - 1); } });
    fundo.querySelector('#be-arq').addEventListener('change', async e => {
      const arq = e.target.files && e.target.files[0]; if (!arq) return; fundo.querySelector('#be-erro').hidden = true;
      try { imagem = await comprimirImagem(arq); desenharImg(); } catch (er) { erroEm('#be-erro', er); } e.target.value = '';
    });
    fundo.querySelector('#be-tirar').addEventListener('click', () => { imagem = null; desenharImg(); fundo.querySelector('#be-arq').focus(); });
    fundo.querySelector('.bf-x').addEventListener('click', () => fechar());
    fundo.querySelector('#be-cancelar').addEventListener('click', () => fechar());
    forma.addEventListener('submit', ev => { ev.preventDefault(); ocupado(fundo.querySelector('#be-salvar'), async () => {
      fundo.querySelector('#be-erro').hidden = true;
      const val = id => fundo.querySelector(id).value.trim(), nome = val('#be-nome'), pvT = val('#be-pv'), defT = val('#be-def');
      const falha = (m, sel) => { erroEm('#be-erro', new Rede.ErroRede(m)); if (sel) fundo.querySelector(sel).focus(); };
      if (!nome) return falha('Dê um nome à criatura.', '#be-nome');
      const pv = pvT ? num(pvT, 1, 9999) : null, def = defT ? num(defT, 0, 99) : null;
      if (pvT && (pv == null || +pvT < 1)) return falha('PV vai de 1 a 9999.', '#be-pv');
      if (defT && def == null) return falha('Defesa vai de 0 a 99.', '#be-def');
      const mods = Object.fromEntries(ATTRS.map(a => [a.key, num(fundo.querySelector('#be-m-' + a.key).value, -10, 20) || 0]));
      const dados = { nome, tipo: val('#be-tipo') || null, perigo: +((fundo.querySelector('input[name=be-perigo]:checked') || {}).value || 2), pv_max: pv, defesa: def,
        horror: val('#be-horror') || null, mods, habilidades: habs.map(h => ({ nome: h.nome.trim().slice(0, 60), efeito: h.efeito.trim().slice(0, 60), desc: h.desc.trim().slice(0, 400) })).filter(h => h.nome),
        descricao: val('#be-desc') || null, notas: val('#be-notas') || null, imagem };
      try {
        const t = await Rede.tabela('mestre', 'bestiario');
        const r = novo ? await t.insert(dados).select('id') : await t.update(dados).eq('id', b.id);
        if (r.error) throw r.error;
        fechar(false); anunciar(nome + (novo ? ' entrou no bestiário' : ' foi atualizada')); await carregarBestiario();
        const id = novo ? (r.data && r.data[0] && r.data[0].id) : b.id, alvo = id && document.querySelector(`.bs-carta[data-b="${CSS.escape(id)}"] .bs-ver`);
        (alvo || $('#bs-nova') || document.body).focus();
      } catch (e) { erroEm('#be-erro', e); }
    }); });
    fundo.querySelector('#be-nome').focus();
  }

  // ---------- habilidades da mesa: o mestre concede e edita; o jogador propõe e o mestre decide ----------
  const pendentesDe = uid => (S.habs || []).filter(h => h.estado === 'pendente' && (!uid || h.user_id === uid));
  function linhaNivel(uid) {
    const j = S.jogadores.find(x => x.user_id === uid); if (!j) return '';
    const f = fichaDe(j), n = (S.habs || []).filter(h => h.user_id === uid && h.estado === 'aprovada').length;
    return [linhaSeq(f), txt(f.caminho, 40) ? 'Caminho ' + txt(f.caminho, 40) : '', `${n} ${n === 1 ? 'habilidade aprovada' : 'habilidades aprovadas'}`].filter(Boolean).join(' · ');
  }
  async function carregarHabs() {
    if (!S.mesa) return; let novas = [];
    try {
      const r = await (await Rede.tabela('mestre', 'habilidades')).select('*').eq('mesa_id', S.mesa.id).order('criado_em'); if (r.error) throw r.error;
      const antes = new Set((S.habs || []).map(h => h.id)); S.habs = r.data || [];
      if (S.habsCarregadas) novas = S.habs.filter(h => h.estado === 'pendente' && !antes.has(h.id)); S.habsCarregadas = true;
    } catch (e) { return; }
    desenharJogadores(); desenharPropostas();
    if (novas.length) { anunciar(`${nomeDe(novas[0].user_id)} propõe uma habilidade: ${novas[0].nome}`); const c = $('#m-propostas'); if (c) { c.classList.remove('chegou'); void c.offsetWidth; c.classList.add('chegou'); } }
  }
  const corpoHab = h => `${txt(h.descricao) ? `<p class="hp-desc">${esc(txt(h.descricao, 600))}</p>` : ''}${txt(h.efeito) || txt(h.custo) ? `<p class="hp-tags">${txt(h.efeito) ? `<span><i>Efeito</i>${esc(txt(h.efeito, 60))}</span>` : ''}${txt(h.custo) ? `<span><i>Custo</i>${esc(txt(h.custo, 60))}</span>` : ''}</p>` : ''}`;
  // campos de habilidade; o que foi digitado sobrevive às atualizações ao vivo (S.keep)
  function camposHab(k, h = {}) {
    const val = (c, d) => esc(S.keep[k + c] ?? d ?? '');
    return `<div class="m-grade hp-campos">
      <div class="m-campo m-largo"><label for="${k}-nome">Nome</label><input type="text" id="${k}-nome" data-keep="${k}nome" maxlength="60" value="${val('nome', h.nome)}" placeholder="Ex.: Passo sem sombra" autocomplete="off"></div>
      <div class="m-campo"><label for="${k}-efeito">Efeito <i>(ex.: 2d6 de dano)</i></label><input type="text" id="${k}-efeito" data-keep="${k}efeito" maxlength="60" value="${val('efeito', h.efeito)}" autocomplete="off"></div>
      <div class="m-campo"><label for="${k}-custo">Custo <i>(ex.: 3 de Espiritualidade)</i></label><input type="text" id="${k}-custo" data-keep="${k}custo" maxlength="60" value="${val('custo', h.custo)}" autocomplete="off"></div>
      <div class="m-campo m-largo"><label for="${k}-desc">O que faz</label><textarea id="${k}-desc" data-keep="${k}desc" maxlength="600" rows="3">${val('desc', h.descricao)}</textarea></div></div>`;
  }
  const lerCampos = (raiz, k) => { const v = c => ((raiz.querySelector('#' + CSS.escape(k + '-' + c)) || {}).value || '').trim(); return { nome: v('nome').slice(0, 60), efeito: v('efeito').slice(0, 60) || null, custo: v('custo').slice(0, 60) || null, descricao: v('desc').slice(0, 600) || null }; };
  const esquecer = k => Object.keys(S.keep).forEach(x => { if (x.startsWith(k)) delete S.keep[x]; });
  // proposta do jogador: Aprovar · Modificar (e aprovar) · Rejeitar com motivo. pre: 'q' (fila) ou 'f' (ficha), para os ids não repetirem
  function propostaHTML(h, pre) {
    const k = pre + h.id, modo = S.habModo[h.id] || '', val = (c, d) => esc(S.keep[k + c] ?? d ?? '');
    const cab = `<header class="hp-cab"><span class="hp-selo" aria-hidden="true"></span><div><small>${esc(nomeDe(h.user_id))} propõe · ${esc(haQuanto(h.criado_em))}</small><b>${esc(h.nome)}</b><span class="hp-nivel">${esc(linhaNivel(h.user_id))}</span></div></header>`;
    const erro = `<p class="m-erro hp-erro" role="alert" hidden></p>`;
    if (modo === 'mudar') return `<article class="hp-prop mudando" data-h="${esc(h.id)}" data-k="${esc(k)}">${cab}${camposHab(k, h)}
      <div class="m-campo"><label for="${k}-resp">Recado para o jogador <i>(opcional)</i></label><input type="text" id="${k}-resp" data-keep="${k}resp" maxlength="300" value="${val('resp', '')}" placeholder="Ex.: Forte demais para a Sequência 9: reduzi o dano." autocomplete="off"></div>${erro}
      <div class="hp-acoes"><button type="button" class="primary hp-ok-mudar" id="${k}-okm">Aprovar com mudanças</button><button type="button" class="ghost hp-voltar" id="${k}-volta">Voltar</button></div></article>`;
    if (modo === 'rejeitar') return `<article class="hp-prop rejeitando" data-h="${esc(h.id)}" data-k="${esc(k)}">${cab}${corpoHab(h)}
      <div class="m-campo"><label for="${k}-mot">Motivo <i>(o jogador vê; opcional)</i></label><input type="text" id="${k}-mot" data-keep="${k}mot" maxlength="300" value="${val('mot', '')}" placeholder="Ex.: Isso não combina com o Caminho do Vidente." autocomplete="off"></div>${erro}
      <div class="hp-acoes"><button type="button" class="ghost c-dano hp-ok-rej" id="${k}-okr">Rejeitar</button><button type="button" class="ghost hp-voltar" id="${k}-volta">Voltar</button></div></article>`;
    return `<article class="hp-prop" data-h="${esc(h.id)}" data-k="${esc(k)}">${cab}${corpoHab(h)}${erro}
      <div class="hp-acoes"><button type="button" class="primary hp-aprovar" id="${k}-apr">Aprovar</button><button type="button" class="ghost hp-mudar" id="${k}-mud" data-ic="ajuste">Modificar</button><button type="button" class="ghost c-dano hp-rejeitar" id="${k}-rej">Rejeitar</button></div></article>`;
  }
  async function mudarHab(id, valores, botao, el) {
    await ocupado(botao, async () => {
      try { const r = await (await Rede.tabela('mestre', 'habilidades')).update(valores).eq('id', id); if (r.error) throw r.error; }
      catch (e) { const er = el && el.querySelector('.hp-erro'); if (er) { er.textContent = Rede.mensagem(e); er.hidden = false; } throw e; }
    });
  }
  function ligarPropostas(raiz) {
    raiz.querySelectorAll('.hp-prop').forEach(el => {
      const h = (S.habs || []).find(x => x.id === el.dataset.h); if (!h) return;
      const k = el.dataset.k, redesenhar = foco => { redesenharHabs(); const f = foco && document.getElementById(foco); if (f) f.focus(); };
      const pronto = msg => { delete S.habModo[h.id]; esquecer('q' + h.id); esquecer('f' + h.id); anunciar(msg); carregarHabs(); };
      const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.addEventListener('click', () => fn(b)); };
      on('.hp-aprovar', b => mudarHab(h.id, { estado: 'aprovada', resposta: null }, b, el).then(() => pronto(`${h.nome} aprovada para ${nomeDe(h.user_id)}`), () => {}));
      on('.hp-mudar', () => { S.habModo[h.id] = 'mudar'; redesenhar(k + '-nome'); });
      on('.hp-rejeitar', () => { S.habModo[h.id] = 'rejeitar'; redesenhar(k + '-mot'); });
      on('.hp-voltar', () => { delete S.habModo[h.id]; esquecer(k); redesenhar(k + '-apr'); });
      on('.hp-ok-mudar', b => { const c = lerCampos(el, k), resp = ((el.querySelector('#' + CSS.escape(k + '-resp')) || {}).value || '').trim().slice(0, 300);
        if (!c.nome) { const er = el.querySelector('.hp-erro'); er.textContent = 'A habilidade precisa de um nome.'; er.hidden = false; return; }
        mudarHab(h.id, { ...c, estado: 'aprovada', alterada: true, resposta: resp || null }, b, el).then(() => pronto(`${c.nome} aprovada com mudanças`), () => {}); });
      on('.hp-ok-rej', b => { const mot = ((el.querySelector('#' + CSS.escape(k + '-mot')) || {}).value || '').trim().slice(0, 300);
        mudarHab(h.id, { estado: 'rejeitada', resposta: mot || null }, b, el).then(() => pronto(`${h.nome} rejeitada`), () => {}); });
    });
  }
  function desenharPropostas() {
    const c = $('#m-propostas'); if (!c) return;
    const ps = pendentesDe(), idFoco = c.contains(document.activeElement) ? document.activeElement.id : '';
    c.hidden = !ps.length;
    c.innerHTML = ps.length ? `<h3 class="hp-tit"><span>Pedidos de poder</span><b aria-label="${ps.length} esperando">${ps.length}</b></h3><p class="hint hp-dica">Os jogadores propõem; você decide se cabe no nível e na história.</p>${ps.map(h => propostaHTML(h, 'q')).join('')}` : '';
    ligarPropostas(c);
    if (typeof decorarTudo === 'function') decorarTudo();
    if (idFoco) { const el = document.getElementById(idFoco); if (el) el.focus({ preventScroll: true }); }
  }
  function redesenharHabs() { desenharPropostas(); if (S.fichaAberta) desenharFicha(); }
  // bloco de habilidades na ficha do jogador (dentro da janela)
  function habsFichaHTML(j, habC, habJ) {
    const minhas = (S.habs || []).filter(h => h.user_id === j.user_id), apr = minhas.filter(h => h.estado === 'aprovada'), pend = minhas.filter(h => h.estado === 'pendente'), k = 'c' + j.user_id;
    const item = h => {
      if (S.habModo[h.id] === 'editar') { const ke = 'e' + h.id; return `<li class="hab-da-mesa editando" data-h="${esc(h.id)}">${camposHab(ke, h)}<p class="m-erro hp-erro" role="alert" hidden></p><div class="hp-acoes"><button type="button" class="primary mf-h-salvar" id="${ke}-ok">Salvar</button><button type="button" class="ghost mf-h-cancela" id="${ke}-volta">Cancelar</button></div></li>`; }
      const de = h.origem === 'mestre' ? 'concedida por você' : h.alterada ? 'proposta do jogador · aprovada com mudanças' : 'proposta do jogador · aprovada';
      return `<li class="hab-da-mesa ${h.origem}" data-h="${esc(h.id)}"><div><b>${esc(h.nome)}</b><small>${de}</small>${corpoHab(h)}</div>
        <span class="mf-h-ac"><button type="button" class="mini mf-h-ed" id="e${esc(h.id)}-ed" aria-label="Editar ${esc(h.nome)}" title="Editar">✎</button><button type="button" class="mini mf-h-x" id="e${esc(h.id)}-x" aria-label="Tirar ${esc(h.nome)} de ${esc(j.nome)}" title="Tirar">×</button></span></li>`;
    };
    return `<section class="mf-bloco mf-largo mf-habs"><h3>Habilidades <i>${apr.length ? `${apr.length} da mesa` : 'o que você concede vale na mesa'}</i></h3>
      ${habC.length || habJ.length || apr.length ? `<ul class="mf-hab">${habC.map(h => `<li class="cam"><b>${esc(txt(h, 80))}</b><small>do Caminho</small></li>`).join('')}${apr.map(item).join('')}${habJ.map(h => `<li class="anot"><b>${esc(txt(h.nome, 60))}</b><small>anotação do jogador${txt(h.desc) ? ' · ' + esc(txt(h.desc, 200)) : ''}</small></li>`).join('')}</ul>` : '<p class="hint">Nenhuma habilidade ainda.</p>'}
      ${pend.map(h => propostaHTML(h, 'f')).join('')}
      <details class="mf-conceder" id="${k}-det" ${S.keep[k + 'aberto'] ? 'open' : ''}><summary>Conceder uma habilidade a ${esc(j.nome)}</summary>${camposHab(k)}<p class="m-erro" id="mf-erro-hab" role="alert" hidden></p>
        <div class="hp-acoes"><button type="button" class="primary" id="mf-conceder" data-ic="estrela">Conceder</button></div></details></section>`;
  }
  function ligarHabsFicha(caixa, j) {
    const bloco = caixa.querySelector('.mf-habs'); if (!bloco) return; const k = 'c' + j.user_id;
    ligarPropostas(bloco);
    const det = bloco.querySelector('.mf-conceder'); det.addEventListener('toggle', () => { S.keep[k + 'aberto'] = det.open ? '1' : ''; });
    bloco.querySelector('#mf-conceder').addEventListener('click', e => ocupado(e.currentTarget, async () => {
      const er = bloco.querySelector('#mf-erro-hab'); er.hidden = true; const c = lerCampos(bloco, k);
      if (!c.nome) { erroEm('#mf-erro-hab', new Rede.ErroRede('Dê um nome à habilidade.')); bloco.querySelector('#' + CSS.escape(k + '-nome')).focus(); return; }
      try { const r = await (await Rede.tabela('mestre', 'habilidades')).insert({ mesa_id: S.mesa.id, user_id: j.user_id, ...c, origem: 'mestre', estado: 'aprovada' }).select('id'); if (r.error) throw r.error;
        esquecer(k); S.keep[k + 'aberto'] = '1'; anunciar(`${c.nome} concedida a ${j.nome}`); await carregarHabs(); const n = document.getElementById(k + '-nome'); if (n) n.focus(); }
      catch (e2) { erroEm('#mf-erro-hab', e2); }
    }));
    bloco.querySelectorAll('li.hab-da-mesa').forEach(li => {
      const h = (S.habs || []).find(x => x.id === li.dataset.h); if (!h) return; const ke = 'e' + h.id;
      const on = (sel, fn) => { const b = li.querySelector(sel); if (b) b.addEventListener('click', () => fn(b)); };
      on('.mf-h-ed', () => { S.habModo[h.id] = 'editar'; redesenharHabs(); const f = document.getElementById(ke + '-nome'); if (f) f.focus(); });
      on('.mf-h-cancela', () => { delete S.habModo[h.id]; esquecer(ke); redesenharHabs(); const f = document.getElementById(ke + '-ed'); if (f) f.focus(); });
      on('.mf-h-salvar', b => { const c = lerCampos(li, ke); if (!c.nome) { const er = li.querySelector('.hp-erro'); er.textContent = 'A habilidade precisa de um nome.'; er.hidden = false; return; }
        mudarHab(h.id, c, b, li).then(() => { delete S.habModo[h.id]; esquecer(ke); anunciar(c.nome + ' atualizada'); carregarHabs().then(() => { const f = document.getElementById(ke + '-ed'); if (f) f.focus(); }); }, () => {}); });
      on('.mf-h-x', async () => {
        const ok2 = await confirmar({ titulo: `Tirar ${h.nome} de ${j.nome}?`, texto: 'A habilidade some da ficha do jogador na hora.', botao: 'Tirar', perigo: true }); if (!ok2) return;
        try { const r = await (await Rede.tabela('mestre', 'habilidades')).delete().eq('id', h.id); if (r.error) throw r.error; anunciar(h.nome + ' foi tirada'); carregarHabs(); }
        catch (e) { erroEm('#mf-erro-hab', e); }
      });
    });
  }
  // o que o mestre digita nos campos de habilidade sobrevive aos redesenhos ao vivo
  document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.keep; if (k) S.keep[k] = e.target.value; });

  // ---------- confirmação forte (apagar mesa, tirar jogador, encerrar) ----------
  function confirmar({ titulo, texto, botao = 'Confirmar', exigir = '', perigo = false }) {
    return new Promise(ok2 => {
      const antes = document.activeElement, fundo = document.createElement('div'); fundo.className = 'm-ficha-fundo m-conf-fundo';
      fundo.innerHTML = `<section class="m-conf ${perigo ? 'perigo' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-x">
        <h2 id="cf-t">${esc(titulo)}</h2><p id="cf-x">${esc(texto)}</p>
        ${exigir ? `<label for="cf-in">Para confirmar, digite <b>${esc(exigir)}</b></label><input type="text" id="cf-in" autocomplete="off" spellcheck="false">` : ''}
        <div class="m-acoes"><button type="button" class="${perigo ? 'ghost c-dano' : 'primary'}" id="cf-ok" ${exigir ? 'disabled' : ''}>${esc(botao)}</button><button type="button" class="ghost" id="cf-nao">Cancelar</button></div></section>`;
      document.body.appendChild(fundo);
      const fim = v => { fundo.remove(); if (antes && antes.isConnected) antes.focus(); ok2(v); };
      const inp = fundo.querySelector('#cf-in'), okb = fundo.querySelector('#cf-ok');
      if (inp) inp.addEventListener('input', () => { okb.disabled = inp.value.trim().toUpperCase() !== exigir.toUpperCase(); });
      okb.addEventListener('click', () => fim(true)); fundo.querySelector('#cf-nao').addEventListener('click', () => fim(false));
      fundo.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); fim(false); } if (e.key === 'Tab') { const f = [...fundo.querySelectorAll('button:not([disabled]),input')]; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } });
      (inp || fundo.querySelector('#cf-nao')).focus();
    });
  }

  // ---------- presença: a vela de cada carta ----------
  function atualizarVelas() {
    document.querySelectorAll('.m-carta-j').forEach(c => {
      const on = !!(S.online && S.online.has(c.dataset.u)), v = c.querySelector('.m-vela'); if (!v) return;
      v.classList.toggle('acesa', on); v.title = on ? 'Com a mesa aberta agora' : 'Fora da mesa agora';
      const t = v.querySelector('.sr-only'); if (t) t.textContent = on ? 'presente' : 'ausente';
    });
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
        <section class="mf-bloco"><h3>Carta do Destino</h3>
          ${txt(tr.nome) || txt(ar.nome) ? `${txt(tr.nome) ? `<div class="mf-carta"><small>Traço</small><b>${esc(txt(tr.nome, 60))}</b><p>${esc(txt(tr.desc, 240))}</p></div>` : ''}
          ${txt(ar.nome) ? `<div class="mf-carta art"><small>Artefato</small><b>${esc(txt(ar.nome, 60))}</b><p><span class="mf-dadiva">Dádiva</span> ${esc(txt(ar.dadiva, 240))}</p><p><span class="mf-maldicao">Maldição</span> ${esc(txt(ar.maldicao, 240))}</p></div>` : ''}` : vazio('Ainda não tirou as cartas.')}</section>
        <section class="mf-bloco mf-largo"><h3>Quem é</h3>
          ${par('Idade', txt(f.idade, 20)) || par('Gênero', txt(f.genero, 40)) || txt(f.aparencia) || txt(f.historia) ? `<dl class="mf-pares">${par('Idade', txt(f.idade, 20))}${par('Gênero', txt(f.genero, 40))}${par('Aparência', txt(f.aparencia, 400))}${par('História', txt(f.historia, 900))}</dl>` : vazio('O jogador ainda não descreveu o personagem.')}</section>
        ${habsFichaHTML(j, habC, habJ)}
        ${txt(f.notas) ? `<section class="mf-bloco mf-largo"><h3>Notas do jogador</h3><p class="mf-notas">${esc(txt(f.notas, 900))}</p></section>` : ''}
        <section class="mf-bloco mf-largo mf-segredo"><h3><label for="mf-nota">Notas secretas</label> <i>só você vê · o jogador nunca recebe</i></h3>
          <textarea id="mf-nota" data-u="${esc(j.user_id)}" maxlength="4000" rows="4" placeholder="O que você sabe e ele não: segredos, ganchos, dívidas, mentiras…">${esc(((S.notas || {})[j.user_id] || {}).texto || '')}</textarea>
          <small class="mf-nota-st" id="mf-nota-st" aria-live="polite">${(S.notas || {})[j.user_id] ? 'guardada' : ''}</small></section>
        <section class="mf-bloco mf-largo"><h3>Testes nesta mesa</h3>
          ${meus.length ? `<ol class="m-resultados mf-res">${meus.map(linhaResultado).join('')}</ol>` : vazio('Nenhum teste ainda.')}</section>
      </div>
      <div class="mf-acoes"><div class="mf-botoes"><button type="button" class="primary" id="mf-pedir" data-ic="dado">Pedir teste para ${esc(j.nome)}</button>
        <button type="button" class="ghost m-secreto" id="mf-sussurrar" data-ic="olho">Sussurrar</button>
        <button type="button" class="ghost c-dano" id="mf-ctrl">Corpo e mente</button>
        <button type="button" class="link-remover mf-tirar" id="mf-tirar">Tirar da mesa</button></div>
        <span class="mf-hora">Ficha atualizada ${esc(haQuanto(j.atualizado_em))}</span></div>`;
    caixa.scrollTop = rolagem;
    caixa.querySelector('.m-ficha-x').addEventListener('click', () => fecharFicha());
    caixa.querySelector('#mf-pedir').addEventListener('click', () => {
      const uid = j.user_id; fecharFicha(false);
      const sel = $('#t-para'); if (sel) sel.value = uid;
      const r = $('#t-rotulo'); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.focus(); }
    });
    caixa.querySelector('#mf-tirar').addEventListener('click', async () => {
      const ok2 = await confirmar({ titulo: 'Tirar ' + j.nome + ' da mesa?', texto: 'A carta, as ordens e a sua nota secreta sobre este jogador somem. Ele pode voltar com o código.', botao: 'Tirar da mesa', perigo: true });
      if (!ok2) return;
      try { const r = await (await Rede.tabela('mestre', 'jogadores')).delete().eq('mesa_id', S.mesa.id).eq('user_id', j.user_id); if (r.error) throw r.error; fecharFicha(false); anunciar(j.nome + ' saiu da mesa'); carregarJogadores(); }
      catch (e) { const st = caixa.querySelector('#mf-nota-st'); if (st) st.textContent = Rede.mensagem(e); }
    });
    caixa.querySelector('#mf-ctrl').addEventListener('click', () => {
      const uid = j.user_id; fecharFicha(false);
      const sel = $('#c-para'); if (sel) sel.value = uid;
      const q = $('#c-qtd'); if (q) { q.scrollIntoView({ block: 'center', behavior: 'smooth' }); q.focus(); q.select(); }
    });
    const nota = caixa.querySelector('#mf-nota'), notaSt = caixa.querySelector('#mf-nota-st');
    if (notaViva) { nota.value = notaViva.v; notaSt.textContent = notaViva.st || ''; if (focoDentro && idFoco === 'mf-nota') nota.setSelectionRange(notaViva.a, notaViva.b); }
    nota.addEventListener('input', () => salvarNota(j.user_id, nota.value));
    ligarHabsFicha(caixa, j);
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
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'enc', 'encontros', f, adiar(carregarEncontro)));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'due', 'disputas', f, adiar(carregarDisputas)));
      S.pararDeOuvir.push(await Rede.ouvir('mestre', 'hab', 'habilidades', f, adiar(carregarHabs)));
      S.pararDeOuvir.push(await Rede.presenca('mestre', id, 'mestre', null, st => { S.online = new Set(Object.keys(st || {}).filter(k => k !== 'mestre')); atualizarVelas(); }));
    } catch (e) { const v = $('#m-ao-vivo'); if (v) { v.textContent = 'sem tempo real'; v.classList.add('off'); } }
  }

  window.Painel = { estado: S };   // usado pelos testes
  document.addEventListener('DOMContentLoaded', iniciar);
})();
