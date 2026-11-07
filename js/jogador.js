// Lado do jogador na mesa online: entrar com o código, receber pedidos do mestre, enviar a ficha.
// Fica na aba "Testes" da Mesa do Destino. Sem rede, nada disso aparece quebrado: só uma mensagem.
const Jogador = (() => {
  const K = 'lotm-rpg-online';
  const CODIGO = /^[A-HJ-NP-Z2-9]{6}$/;          // o mesmo alfabeto do servidor (sem I, O, 0, 1)
  let con = lerConexao();                         // { mesa, codigo, nome, slot } ou null
  let estado = con ? 'desligado' : 'fora';        // fora | entrando | ligando | ligado | desligado
  let sussurros = [], lidos = new Set(), fila = [], aberto = null;   // sussurros do mestre
  let codigoDigitado = '', nomeDigitado = '';      // o que foi digitado sobrevive aos redesenhos
  let pedidos = [], erro = '', uid = null, parar = [], ultimaFicha = '', rolandoPedido = false;

  function lerConexao() { try { const c = JSON.parse(localStorage.getItem(K)); return c && c.mesa && c.codigo ? c : null; } catch (e) { return null; } }
  function gravarConexao(c) { try { c ? localStorage.setItem(K, JSON.stringify(c)) : localStorage.removeItem(K); } catch (e) { /* sem armazenamento: só nesta aba */ } }
  const temAtributos = () => ATTRS.every(a => P.attrs && P.attrs[a.key]);
  const minhaFicha = () => con && con.slot && con.slot === idAtual();
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const redesenhar = () => { if (typeof Mesa === 'object') Mesa.atualizar(); marcarFab(); };

  // O que o mestre vê: modificadores, PV e Sanidade (nada além disso sai do navegador).
  function ficha() {
    // atributo ainda não rolado não vai (o mestre vê "—"; no teste secreto o servidor usa 0)
    const mods = {}, attrs = {}; ATTRS.forEach(a => { const t = total(a.key); if (t != null) { mods[a.key] = mod(t); attrs[a.key] = t; } });
    const c = P.caminho && caminhoPorId(P.caminho), temVigor = total('vigor') != null, temPres = total('pres') != null, temEsp = total('espir') != null;
    const r = P.raca && racaPorId(P.raca), o = P.origem && origemPorId(P.origem);
    const tr = P.traco != null ? TRACOS[P.traco] : null, ar = P.artefato != null ? ARTEFATOS[P.artefato] : null;
    const corta = (s, n) => String(s || '').trim().slice(0, n);
    // a ficha vai "resolvida" (nomes e textos), para o mestre não depender dos dados do jogo nem da versão do site
    const f = {
      v: 2, mods, attrs,
      pv: temVigor ? (P.pv == null ? pvMax() : P.pv) : null, pvMax: temVigor ? pvMax() : null,
      san: temPres ? (P.san == null ? sanMax() : P.san) : null, sanMax: temPres ? sanMax() : null,
      espMax: temEsp ? espMax() : null,
      seq: P.sequencia, seqNome: c ? corta(nomeSeq(P.sequencia), 60) : '', patamar: patamarDe(P.sequencia).nome,
      digestao: P.digestao, digMax: typeof DIG_MAX === 'number' ? DIG_MAX : 10,
      caminho: c ? c.nome : '', caminhoId: c ? c.id : '', cor: c ? c.cor : '', attrCaminho: c ? c.attr : '',
      raca: r ? { nome: r.nome, icone: r.icone } : null, origem: o ? { nome: o.nome, icone: o.icone } : null,
      jogador: corta(P.jogador, 60), idade: corta(P.idade, 20), genero: corta(P.genero, 40), aparencia: corta(P.aparencia, 400),
      traco: tr ? { nome: tr.t, desc: corta(tr.d, 240) } : null,
      artefato: ar ? { nome: ar.n, dadiva: corta(ar.dadiva, 240), maldicao: corta(ar.maldicao, 240) } : null,
      habCaminho: c ? c.hab.slice(0, 6) : [],
      hab: (P.habilidades || []).slice(0, 20).map(h => ({ nome: corta(h.nome, 60), desc: corta(h.desc, 200) })),
      historia: corta(P.historia, 900), notas: corta(P.notas, 900),
    };
    // o banco aceita até ~8 KB por ficha: se passar, os textos longos encolhem primeiro
    const bytes = () => new TextEncoder().encode(JSON.stringify(f)).length;   // bytes, não letras (acento ocupa 2)
    for (const k of ['notas', 'historia', 'aparencia']) { if (bytes() <= 6500) break; f[k] = f[k].slice(0, 200); }
    while (bytes() > 6500 && f.hab.length) f.hab.pop();
    return f;
  }

  // ---------- entrar / sair ----------
  // Só o nome é obrigatório: dá para sentar à mesa antes de terminar a ficha.
  async function entrar(codigoBruto, nomeBruto) {
    const codigo = String(codigoBruto || '').toUpperCase().replace(/[\s-]/g, '');
    const nomeNovo = String(nomeBruto || '').trim().slice(0, 40);
    erro = '';
    if ((!P.nome || !P.nome.trim()) && nomeNovo) P.nome = nomeNovo;
    if (!P.nome || !P.nome.trim()) erro = 'Escreva o nome do seu personagem.';
    else if (!CODIGO.test(codigo)) erro = 'O código tem 6 letras e números, como o mestre passou.';
    if (erro) { codigoDigitado = codigoBruto || ''; return redesenhar(); }
    salvar();                                      // garante que a ficha tem lugar na biblioteca
    estado = 'entrando'; redesenhar();
    try {
      await Rede.entrarAnonimo();
      const mesa = await Rede.rpc('jogador', 'entrar_na_mesa', { p_codigo: codigo, p_nome: P.nome.trim().slice(0, 40), p_ficha: ficha() });
      con = { mesa, codigo, nome: P.nome.trim().slice(0, 40), slot: idAtual() }; gravarConexao(con);
      ultimaFicha = JSON.stringify(ficha());
      await ligar();
      anunciar('Você entrou na mesa ' + codigo.split('').join(' '));
      // entrou pela capa com um nome novo: a capa passa a oferecer "Continuar" para terminar essa ficha
      const capa = document.querySelector('#cover'); if (capa && !capa.hidden && typeof montarCapa === 'function') { try { montarCapa(); } catch (e) { /* a capa antiga continua */ } }
    } catch (e) { estado = con ? 'desligado' : 'fora'; erro = Rede.mensagem(e); redesenhar(); }
  }

  async function sairDaMesa() {
    const c = con; desligar(); con = null; gravarConexao(null); pedidos = []; sussurros = []; lidos = new Set(); fila = []; estado = 'fora'; erro = ''; redesenhar();
    if (c && uid) { try { await (await Rede.tabela('jogador', 'jogadores')).delete().eq('mesa_id', c.mesa).eq('user_id', uid); } catch (e) { /* sem rede: o mestre remove depois */ } }
  }

  // ---------- conexão ao vivo ----------
  function desligar() { parar.forEach(f => f()); parar = []; clearInterval(vigia); vigia = null; mostrarRoda(null); }
  async function ligar() {
    if (!con) return;
    desligar(); estado = 'ligando'; erro = ''; redesenhar();
    try {
      const u = await Rede.usuario('jogador');
      if (!u) { con = null; gravarConexao(null); estado = 'fora'; erro = 'Sua entrada na mesa expirou. Digite o código de novo.'; return redesenhar(); }
      uid = u.id;
      await carregarPedidos();
      parar.push(await Rede.ouvir('jogador', 'pedidos', 'pedidos', 'para=eq.' + uid, aoMudarPedidos));
      try {   // sussurros: se falharem, os testes continuam funcionando
        await carregarSussurros();
        parar.push(await Rede.ouvir('jogador', 'sussurros', 'sussurros', 'mesa_id=eq.' + con.mesa, aoMudarSussurros));
      } catch (e) { /* sem sussurros nesta conexão */ }
      try {   // ordens do mestre (dano, cura, Terror): idem
        parar.push(await Rede.ouvir('jogador', 'ordens', 'ordens', 'para=eq.' + uid, () => aplicarOrdens()));
      } catch (e) { /* sem ordens nesta conexão */ }
      estado = 'ligado'; redesenhar();
      enviarFicha();
      enfileirarNaoLidos();   // o que chegou enquanto estava fora aparece agora
      sincronizarTerror(); aplicarOrdens();
      try {   // Roda do Destino e duelos (se falharem, o resto continua)
        await carregarEncontro(true); parar.push(await Rede.ouvir('jogador', 'encontros', 'encontros', 'mesa_id=eq.' + con.mesa, () => carregarEncontro().catch(() => {})));
        await carregarDuelos(true); parar.push(await Rede.ouvir('jogador', 'disputas', 'disputas', 'mesa_id=eq.' + con.mesa, () => carregarDuelos(false).catch(() => {})));
      } catch (e) { /* sem cena nesta conexão */ }
      try { parar.push(await Rede.presenca('jogador', con.mesa, uid, { nome: con.nome }, () => {})); } catch (e) { /* sem vela */ }
      clearInterval(vigia); vigia = setInterval(conferirSeAindaEstou, 45000);
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

  // ---------- ordens do mestre: dano, cura, Sanidade e Modo Terror ----------
  // Cada ordem é aplicada UMA vez (o servidor marca e devolve null na segunda). Se o jogador estava fora, aplica ao voltar.
  let aplicando = false, deNovo = false;
  async function aplicarOrdens() {
    if (!con || !uid) return;
    if (aplicando) { deNovo = true; return; }
    aplicando = true;
    try {
      do {
        deNovo = false;
        const r = await (await Rede.tabela('jogador', 'ordens')).select('id,tipo,valor,motivo,criado_em').eq('mesa_id', con.mesa).eq('para', uid).is('aplicada_em', null).order('criado_em');
        if (r.error) throw r.error;
        for (const o of r.data || []) {
          const feita = await Rede.rpc('jogador', 'aplicar_ordem', { p_id: o.id });
          if (feita) executarOrdem(feita);
        }
      } while (deNovo);
    } catch (e) { /* tenta de novo no próximo aviso */ }
    finally { aplicando = false; }
  }
  function executarOrdem(o) {
    if (o.tipo === 'terror') return terrorDaMesa(o.valor === 1, true);
    const k = o.tipo === 'san' ? 'san' : 'pv', max = k === 'pv' ? pvMax() : sanMax(), d = Math.trunc(Number(o.valor) || 0);
    if (!d) return;
    if (max > 0 && minhaFicha()) {
      const atual = P[k] == null ? max : P[k], novo = Math.max(0, Math.min(max, atual + d));
      if (document.querySelector('#iv-' + k) && typeof window.aplicarVitalFicha === 'function') window.aplicarVitalFicha(k, novo);
      else { P[k] = novo; salvar(); }
    }
    golpe(k, d, o.motivo);
  }
  // O golpe na tela: vermelho e tremor para PV, roxo e distorção para a mente; dourado suave para cura.
  function golpe(k, d, motivo) {
    const dano = d < 0, el = document.createElement('div');
    el.className = `golpe ${k} ${dano ? 'dano' : 'cura'}`; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="golpe-borda"></div><div class="golpe-txt"><b>${dano ? '−' : '+'}${Math.abs(d)} ${k === 'pv' ? 'PV' : 'Sanidade'}</b>${motivo ? `<small>${esc2(motivo)}</small>` : ''}</div>`;
    document.body.appendChild(el);
    if (dano) { const app = document.querySelector('#app'); if (app) { app.classList.remove('golpeado'); void app.offsetWidth; app.classList.add('golpeado'); setTimeout(() => app.classList.remove('golpeado'), 650); } }
    if (typeof Som === 'object') { if (!dano) Som.confirmar(); else if (k === 'san') Som.batida(); else Som.falha(); }
    anunciar(`O mestre: ${dano ? 'você perde' : 'você recupera'} ${Math.abs(d)} de ${k === 'pv' ? 'Pontos de Vida' : 'Sanidade'}${motivo ? ', ' + motivo : ''}`);
    setTimeout(() => el.remove(), 2600);
  }
  // Modo Terror da mesa: o mestre liga e desliga para todos, mas o jogador pode desligar o seu (o Terror pisca e tem som forte).
  const K_TERROR = 'lotm-rpg-terror-mesa';
  function terrorDaMesa(ligar, avisar) {
    try { localStorage.setItem(K_TERROR, con.mesa + ':' + (ligar ? 1 : 0)); } catch (e) { /* só nesta aba */ }
    const b = document.querySelector('#btn-terror');
    if (typeof Som === 'object' && Som.terror !== ligar && b) b.click();
    if (avisar) {
      const el = document.createElement('div'); el.className = 'aviso-terror ' + (ligar ? 'liga' : 'desliga'); el.setAttribute('role', 'status');
      el.innerHTML = ligar ? '<b>O mestre trouxe o Terror à mesa</b><small>Se precisar, desligue no olho, no topo da tela.</small>' : '<b>O Terror se dissipa</b>';
      document.body.appendChild(el); setTimeout(() => el.remove(), 5200);
    }
  }
  async function sincronizarTerror() {   // quem entra depois (ou volta) recebe o estado atual, uma vez por mudança
    try {
      const e = await Rede.rpc('jogador', 'estado_da_mesa', { p_mesa: con.mesa });
      const ligar = !!(e && e.terror); let visto = ''; try { visto = localStorage.getItem(K_TERROR) || ''; } catch (er) { /* sem armazenamento */ }
      if (ligar && visto !== con.mesa + ':1') terrorDaMesa(true, true);                 // o mestre ligou enquanto estava fora
      else if (!ligar && visto === con.mesa + ':1') terrorDaMesa(false, true);          // o mestre desligou o que ele tinha ligado
      else if (!ligar && !visto) { try { localStorage.setItem(K_TERROR, con.mesa + ':0'); } catch (er) { /* idem */ } }   // não mexe no Terror pessoal
    } catch (e) { /* sem estado: fica como está */ }
  }

  // ---------- o mestre pode tirar o jogador da mesa: conferido de tempos em tempos e ao voltar para a aba ----------
  let vigia = null;
  async function conferirSeAindaEstou() {
    if (estado !== 'ligado' || !con || !uid) return;
    try {
      const r = await (await Rede.tabela('jogador', 'jogadores')).select('user_id').eq('mesa_id', con.mesa).eq('user_id', uid);
      if (!r.error && r.data && !r.data.length) { desligar(); con = null; gravarConexao(null); estado = 'fora'; erro = 'O mestre tirou você da mesa. Se foi engano, peça o código de novo.'; redesenhar(); anunciar(erro); }
    } catch (e) { /* sem rede: confere depois */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferirSeAindaEstou(); });

  // ---------- Roda do Destino: faixa com a ordem e o momento "é a sua vez" ----------
  let encontro = null, ultimaVez = '', rodaRecolhida = false;
  const md = (p, tam) => {
    const cid = /^[a-z]{2,20}$/.test(p.caminhoId || '') ? p.caminhoId : '', cor = /^#[0-9a-f]{6}$/i.test(p.cor || '') ? p.cor : '#8a84b0';
    return '<span class="md" style="--cc:' + cor + '">' + (cid ? '<img src="img/sigilos/' + cid + '.webp" alt="" width="' + tam + '" height="' + tam + '">' : '<b aria-hidden="true">' + esc2((p.nome || '?').trim().charAt(0).toUpperCase()) + '</b>') + '</span>';
  };
  async function carregarEncontro(inicio) {
    if (!con) return;
    const r = await (await Rede.tabela('jogador', 'encontros')).select('ativo,rodada,vez,ordem').eq('mesa_id', con.mesa);
    if (r.error) throw r.error;
    encontro = (r.data || [])[0] || null; mostrarRoda(encontro && encontro.ativo ? encontro : null, !!inicio);
  }
  function mostrarRoda(e, inicio) {
    let faixa = document.querySelector('#roda-jog');
    if (!e) { if (faixa) faixa.remove(); document.body.classList.remove('com-roda'); ultimaVez = ''; return; }
    const ordem = (Array.isArray(e.ordem) ? e.ordem : []).filter(p => p && typeof p === 'object'), vez = Math.max(0, Math.min(ordem.length - 1, Number(e.vez) || 0)), atual = ordem[vez] || {};
    if (!faixa) { faixa = document.createElement('aside'); faixa.id = 'roda-jog'; faixa.className = 'roda-jog'; faixa.setAttribute('aria-label', 'Roda do Destino'); document.body.appendChild(faixa); }
    document.body.classList.add('com-roda');
    const minha = atual.tipo === 'jogador' && atual.id === uid;
    faixa.classList.toggle('recolhida', rodaRecolhida); faixa.classList.toggle('minha', minha);
    faixa.innerHTML = '<button type="button" class="rj-alt" aria-expanded="' + !rodaRecolhida + '" aria-label="' + (rodaRecolhida ? 'Mostrar' : 'Recolher') + ' a Roda do Destino">' + (rodaRecolhida ? '◂' : '▸') + '</button>'
      + '<div class="rj-cab"><small>Roda do Destino</small><b>Rodada ' + (Number(e.rodada) || 1) + '</b><span>' + (minha ? '<strong>Sua vez</strong>' : 'Vez de <strong>' + esc2(atual.nome || '—') + '</strong>') + '</span></div>'
      + '<ol class="rj-fila">' + ordem.map((p, i) => '<li class="' + (i === vez ? 'vez ' : '') + (i < vez ? 'foi ' : '') + (p.tipo === 'jogador' && p.id === uid ? 'eu' : '') + '"' + (i === vez ? ' aria-current="true"' : '') + '>' + md(p, 30) + '<span>' + esc2(p.nome || '') + '</span></li>').join('') + '</ol>';
    faixa.querySelector('.rj-alt').addEventListener('click', () => { rodaRecolhida = !rodaRecolhida; mostrarRoda(encontro && encontro.ativo ? encontro : null); const b = document.querySelector('#roda-jog .rj-alt'); if (b) b.focus(); });
    const chave = (e.rodada || 1) + ':' + vez + ':' + (atual.id || '');
    if (chave !== ultimaVez) { const discreto = !!inicio; ultimaVez = chave; if (minha) suaVez(e.rodada, discreto); else if (!discreto) anunciar('Rodada ' + (e.rodada || 1) + '. Vez de ' + (atual.nome || '')); }
  }
  function suaVez(rodada, discreto) {
    anunciar('É a sua vez. Rodada ' + (rodada || 1));
    if (discreto) return;   // ao entrar/recarregar já na sua vez: só a faixa avisa
    if (typeof Som === 'object') Som.selar();
    const el = document.createElement('div'); el.className = 'sua-vez'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="sv-chama"></div><b>É a sua vez</b><small>Rodada ' + (Number(rodada) || 1) + '</small>';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2800);
  }

  // ---------- Duelo: quando o jogador está num duelo visível, a cena aparece para ele ----------
  let duelosVistos = new Set();
  async function carregarDuelos(inicio) {
    if (!con) return;
    const r = await (await Rede.tabela('jogador', 'disputas')).select('id,rotulo,a,b,criado_em').eq('mesa_id', con.mesa).order('criado_em', { ascending: false }).limit(10);
    if (r.error) throw r.error;
    const ds = r.data || [];
    if (inicio) { duelosVistos = new Set(ds.map(d => d.id)); return; }   // os antigos não reaparecem
    ds.filter(d => !duelosVistos.has(d.id)).reverse().forEach(d => { duelosVistos.add(d.id); mostrarDuelo(d); });
  }
  function mostrarDuelo(d) {
    const A = d.a || {}, B = d.b || {}, ta = Number(A.total), tb = Number(B.total), venc = ta === tb ? null : ta > tb ? A : B, eu = !!venc && venc.tipo === 'jogador' && venc.id === uid;
    const lado = L => '<div class="du-lado ' + (venc ? (venc === L ? 'vence' : 'perde') : 'empata') + '">' + md(L, 54) + '<b class="du-nome">' + esc2(L.nome || '') + '</b><span class="du-num">' + (Number(L.total) || 0) + '</span><small>d20 ' + (Number(L.dado) || 0) + (Number(L.mod) ? ' ' + sinal(Number(L.mod)) : '') + '</small></div>';
    const m = document.createElement('div'); m.className = 'duelo-cena'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'dc-t');
    m.innerHTML = '<div class="dc-core"><small class="dc-olho">Duelo</small><h2 id="dc-t">' + esc2(d.rotulo || 'Duelo') + '</h2>'
      + '<div class="du jog"><div class="du-arena">' + lado(A) + '<span class="du-x" aria-hidden="true">×</span>' + lado(B) + '</div>'
      + '<p class="du-fim">' + (venc ? (eu ? '<b>Você leva a melhor</b>' : '<b>' + esc2(venc.nome || '') + '</b> leva a melhor') : '<b>Empate</b>') + ' · o mestre decide o que acontece</p></div>'
      + '<button type="button" class="primary" id="dc-ok">Fechar</button></div>';
    document.body.appendChild(m);
    if (typeof Som === 'object') Som.dado();
    anunciar('Duelo, ' + (d.rotulo || '') + ': ' + A.nome + ' ' + ta + ', ' + B.nome + ' ' + tb + '. ' + (venc ? venc.nome + ' leva a melhor' : 'Empate'));
    let soltar = () => {};
    const fechar = () => { soltar(); m.classList.add('saindo'); setTimeout(() => m.remove(), 220); };
    m.querySelector('#dc-ok').addEventListener('click', fechar);
    soltar = typeof prenderFoco === 'function' ? prenderFoco(m, fechar) : () => {};
    setTimeout(() => { const b = m.querySelector('#dc-ok'); if (b && b.isConnected) b.focus(); }, 60);
  }

  // ---------- sussurros e pistas do mestre ----------
  const IMG_OK = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  async function carregarSussurros() {
    const [s, l] = await Promise.all([
      (await Rede.tabela('jogador', 'sussurros')).select('id,para,titulo,texto,imagem,criado_em').eq('mesa_id', con.mesa).order('criado_em', { ascending: false }).limit(30),
      (await Rede.tabela('jogador', 'sussurros_leituras')).select('sussurro_id').eq('user_id', uid),
    ]);
    if (s.error || l.error) throw s.error || l.error;
    sussurros = (s.data || []).map(x => ({ ...x, imagem: typeof x.imagem === 'string' && IMG_OK.test(x.imagem) ? x.imagem : null }));
    lidos = new Set((l.data || []).map(x => x.sussurro_id));
  }
  async function aoMudarSussurros() {
    try { await carregarSussurros(); } catch (e) { return; }
    redesenhar(); enfileirarNaoLidos();
  }
  function enfileirarNaoLidos() {
    sussurros.slice().reverse().forEach(s => { if (!lidos.has(s.id) && !fila.includes(s.id) && aberto !== s.id) fila.push(s.id); });
    mostrarProximo();
  }
  function mostrarProximo() {
    if (aberto || !fila.length) return;
    const s = sussurros.find(x => x.id === fila.shift()); if (!s) return mostrarProximo();
    mostrarSussurro(s, false);
  }
  // A cena do sussurro: névoa, as palavras surgindo uma a uma, a pista como papel envelhecido.
  function mostrarSussurro(s, relendo) {
    aberto = s.id;
    const titulo = s.titulo || (s.imagem ? 'Uma pista' : 'Um sussurro');
    const palavras = (s.texto || '').split(/(\s+)/).map((w, i) => /^\s+$/.test(w) ? w : `<span style="--i:${Math.min(i, 120)}">${esc2(w)}</span>`).join('');
    const m = document.createElement('div');
    m.className = 'sussurro' + (relendo ? ' relendo' : '');
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'sus-t');
    m.innerHTML = `<div class="sus-nevoa" aria-hidden="true"></div>
      <div class="sus-core">
        <small class="sus-olho">${relendo ? 'Você relembra' : (s.para ? 'Só você ouve' : 'A mesa inteira ouve')}</small>
        <h2 id="sus-t">${esc2(titulo)}</h2>
        ${s.texto ? `<p class="sus-texto">${palavras}</p>` : ''}
        ${s.imagem ? `<figure class="sus-pista"><img src="${s.imagem}" alt="${esc2(s.titulo ? 'Pista: ' + s.titulo : 'Pista enviada pelo mestre')}"></figure>` : ''}
        <button type="button" class="primary" id="sus-ok">${relendo ? 'Fechar' : 'Guardar na memória'}</button>
      </div>`;
    document.body.appendChild(m); document.body.classList.add('com-sussurro');
    if (typeof decorarTudo === 'function') decorarTudo();
    if (!relendo && typeof Som === 'object') Som.carta();
    anunciar((relendo ? '' : 'O mestre sussurra. ') + titulo + (s.texto ? ': ' + s.texto : ''));
    let soltar = () => {};
    const fechar = () => {
      m.classList.add('saindo'); soltar(); document.body.classList.remove('com-sussurro');
      setTimeout(() => { m.remove(); aberto = null; redesenhar(); mostrarProximo(); }, 260);
      if (!relendo && !lidos.has(s.id)) { lidos.add(s.id); Rede.rpc('jogador', 'ler_sussurro', { p_id: s.id }).catch(() => lidos.delete(s.id)); }
    };
    m.querySelector('#sus-ok').addEventListener('click', fechar);
    soltar = typeof prenderFoco === 'function' ? prenderFoco(m, fechar) : () => {};
    setTimeout(() => { const b = m.querySelector('#sus-ok'); if (b && b.isConnected) b.focus(); }, 60);
  }
  function listaPistas() {
    if (!sussurros.length) return '';
    return `<div class="lbl pistas-lbl">Sussurros e pistas <i>${sussurros.length}</i></div><ul class="pistas">${sussurros.slice(0, 12).map(s => `<li>
      <button type="button" class="pista-b ${lidos.has(s.id) ? '' : 'nova'}" data-sus="${esc2(s.id)}">
        ${s.imagem ? `<img src="${s.imagem}" alt="" width="40" height="40">` : '<span class="pista-ico" aria-hidden="true">❦</span>'}
        <span><b>${esc2(s.titulo || (s.imagem ? 'Uma pista' : 'Um sussurro'))}</b><small>${esc2((s.texto || 'imagem').slice(0, 70))}${(s.texto || '').length > 70 ? '…' : ''}</small></span>
      </button></li>`).join('')}</ul>`;
  }

  // ---------- ficha ao vivo (debounce: só envia quando algo mudou) ----------
  let timerFicha = null;
  function fichaMudou() { if (estado !== 'ligado' || !minhaFicha()) return; clearTimeout(timerFicha); timerFicha = setTimeout(enviarFicha, 1200); }
  async function enviarFicha() {
    if (estado !== 'ligado' || !minhaFicha()) return;
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
      // nunca bloqueado: sem nome, pede o nome aqui mesmo; sem atributos, entra e o mestre vê "—" até rolar
      const temNome = !!(P.nome && P.nome.trim()), ocupado = estado === 'entrando';
      el.innerHTML = `<div class="lbl">Mesa online <i>com o mestre</i></div>
        <form class="on-entrar" id="on-form" novalidate>
          ${temNome ? '' : `<label for="on-nome">Nome do personagem</label><input type="text" id="on-nome" class="on-nome" maxlength="40" placeholder="Ex.: Klein Moretti" autocomplete="off" value="${esc2(nomeDigitado)}">`}
          <label for="on-cod">Código da mesa</label>
          <div class="on-linha"><input type="text" id="on-cod" maxlength="7" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc2(codigoDigitado)}">
          <button type="submit" class="primary" id="on-entrar" ${ocupado ? 'disabled' : ''}>${ocupado ? 'Entrando…' : 'Entrar'}</button></div>
          <small class="on-dica">${temNome ? `Você entra sem conta, como <b>${esc2(P.nome.trim())}</b>. ` : 'Você entra sem conta. '}O mestre vê só seus modificadores, PV e Sanidade${temAtributos() ? '' : ', que aparecem quando você rolar os atributos'}.</small>
          ${msgErro}</form>`;
      const f = el.querySelector('#on-form'), n = el.querySelector('#on-nome'), cod = el.querySelector('#on-cod');
      if (n) n.addEventListener('input', () => { nomeDigitado = n.value; });
      cod.addEventListener('input', () => { codigoDigitado = cod.value; });
      f.addEventListener('submit', ev => { ev.preventDefault(); if (n) nomeDigitado = n.value; codigoDigitado = cod.value; entrar(cod.value, n ? n.value : ''); });
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
        ${listaPistas()}${msgErro}<button type="button" class="link-remover" id="on-sair">Sair da mesa</button>`;
    }
    const b = el.querySelector('#on-religar'); if (b) b.addEventListener('click', ligar);
    el.querySelector('#on-sair').addEventListener('click', sairDaMesa);
    el.querySelectorAll('.rolar-pedido').forEach(x => x.addEventListener('click', () => rolarPedido(x.dataset.id)));
    el.querySelectorAll('.pista-b').forEach(x => x.addEventListener('click', () => { const s = sussurros.find(y => y.id === x.dataset.sus); if (s && !aberto) mostrarSussurro(s, lidos.has(s.id)); }));
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
      // com ficha salva, abre a ficha; sem ficha, abre a mesa aqui mesmo e o nome é pedido junto com o código
      if (idAtivoSalvo()) document.querySelector('#btn-continue').click();
      setTimeout(() => { Mesa.irParaTestes(); setTimeout(() => { const i = document.querySelector('#on-nome') || document.querySelector('#on-cod'); if (i) i.focus(); }, 150); }, 250);
    });
    // com pedido esperando, abrir a mesa já leva para a aba Testes
    const fab = document.querySelector('#fab-mesa');
    if (fab) fab.addEventListener('click', () => { const m = document.querySelector('#mesa'); if (pedidos.length && estado === 'ligado' && m && !m.hidden) Mesa.irParaTestes(); });
  });

  return { desenhar, entrar, sairDaMesa, ligar, rolarPedido, fichaParaMestre: ficha, get estado() { return estado; }, get encontro() { return encontro; }, get pedidos() { return pedidos.slice(); } };
})();
