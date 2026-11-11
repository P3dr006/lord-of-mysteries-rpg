// Supabase FALSO para os testes da mesa online (nada sai da máquina).
// Imita o que o site usa: login (e-mail e anônimo), consultas com RLS, as 5 funções do banco e o tempo real.
// O "servidor" roda no Node e é compartilhado por todas as páginas (mestre e jogadores), como o banco real.
// Ele também registra TUDO que entregou a cada usuário, para provar o que o jogador nunca recebe.

const Regras = require('../js/regras.js');   // o mesmo motor que o banco roda em plpgsql (migração 20261115)

const CLIENTE = `(() => {
  const chamar = (op, dados) => window.__sb(op, dados);
  window.__subs = {};
  window.__sbEmitir = (id, ev) => { const f = window.__subs[id]; if (f) f(ev); };
  function criar(url, chave, opts) {
    const K = (opts && opts.auth && opts.auth.storageKey) || 'sb-falso';
    const sessao = () => { try { return JSON.parse(localStorage.getItem(K)); } catch (e) { return null; } };
    const uid = () => { const s = sessao(); return s ? s.user.id : null; };
    const guardar = u => { localStorage.setItem(K, JSON.stringify({ user: u })); return { data: { user: u, session: { user: u } }, error: null }; };
    const auth = {
      getSession: async () => ({ data: { session: sessao() }, error: null }),
      signInAnonymously: async () => { const r = await chamar('anon', {}); return r.error ? r : guardar(r.data); },
      signInWithPassword: async c => { const r = await chamar('login', c); return r.error ? { data: {}, error: r.error } : guardar(r.data); },
      signUp: async c => { const r = await chamar('signup', c); return r.error ? { data: {}, error: r.error } : { data: { user: r.data, session: null }, error: null }; },
      signOut: async () => { localStorage.removeItem(K); return { error: null }; },
      resetPasswordForEmail: async (email, o) => chamar('recuperar', { email, ...(o || {}) }),
      updateUser: async a => { const r = await chamar('novasenha', { uid: uid(), password: a && a.password }); return r.error ? { data: {}, error: r.error } : guardar(r.data); },
    };
    function consulta(tabela) {
      const q = { tabela, op: 'select', filtros: [], ordem: null, limite: null, valores: null, devolver: true };
      const b = {
        select(c) { if (q.op !== 'select') q.devolver = true; else q.colunas = c; return b; },
        update(v) { q.op = 'update'; q.valores = v; q.devolver = false; return b; },
        delete() { q.op = 'delete'; q.devolver = false; return b; },
        eq(c, v) { q.filtros.push([c, v]); return b; },
        is(c, v) { q.filtros.push([c, v]); return b; },
        order(c, o) { q.ordem = [c, !o || o.ascending !== false]; return b; },
        limit(n) { q.limite = n; return b; },
        then(ok, falha) { return chamar('query', { uid: uid(), ...q }).then(ok, falha); },
      };
      // como no supabase-js: from() NÃO é "aguardável"; só depois de select/update/delete
      return { select: c => b.select(c), update: v => b.update(v), delete: () => b.delete(), insert: v => { q.op = 'insert'; q.valores = v; q.devolver = false; return b; } };
    }
    // Storage: o arquivo vai como base64 (o canal do Playwright não leva Blob); as regras ficam no servidor falso
    const b64 = async blob => { const u8 = new Uint8Array(await blob.arrayBuffer()); let t = ''; for (let i = 0; i < u8.length; i += 8192) t += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(t); };
    const storage = { from: bucket => ({
      upload: async (caminho, blob, o) => chamar('st_upload', { uid: uid(), bucket, caminho, tipo: (o && o.contentType) || blob.type, b64: await b64(blob), upsert: !!(o && o.upsert) }),
      copy: (de, para) => chamar('st_copy', { uid: uid(), bucket, de, para }),
      remove: caminhos => chamar('st_remove', { uid: uid(), bucket, caminhos }),
      list: (pasta, o) => chamar('st_list', { uid: uid(), bucket, pasta, limite: o && o.limit }),
      createSignedUrls: (caminhos, s) => chamar('st_sign', { uid: uid(), bucket, caminhos, segundos: s, url }),
    }) };
    return {
      auth,
      storage,
      from: consulta,
      rpc: (nome, args) => chamar('rpc', { uid: uid(), nome, args }),
      channel(nome, opcoes) {
        const ch = { subs: [], pres: [], estado: {}, nome, chave: opcoes && opcoes.config && opcoes.config.presence && opcoes.config.presence.key };
        ch.on = (tipo, cfg, cb) => { (tipo === 'presence' ? ch.pres : ch.subs).push([cfg, cb]); return ch; };
        ch.subscribe = cbEstado => {
          ch.subs.forEach(([cfg, cb]) => { const id = Math.random().toString(36).slice(2); ch.ids = (ch.ids || []).concat(id); window.__subs[id] = cb; chamar('sub', { id, uid: uid(), tabela: cfg.table, filtro: cfg.filter }); });
          if (ch.pres.length) {   // presença: o servidor falso mantém quem está em cada canal e avisa todos
            ch.pid = Math.random().toString(36).slice(2);
            window.__pres = window.__pres || {}; window.__pres[ch.pid] = est => { ch.estado = est; ch.pres.forEach(([, cb]) => cb()); };
            chamar('pjoin', { pid: ch.pid, canal: nome }).then(() => cbEstado && cbEstado('SUBSCRIBED'));
          } else if (cbEstado) setTimeout(() => cbEstado('SUBSCRIBED'), 0);
          return ch;
        };
        ch.track = dados => chamar('ptrack', { pid: ch.pid, canal: nome, chave: ch.chave, dados });
        ch.presenceState = () => ch.estado;
        return ch;
      },
      removeChannel(ch) { (ch.ids || []).forEach(id => { delete window.__subs[id]; chamar('unsub', { id }); }); if (ch.pid) { delete window.__pres[ch.pid]; chamar('pleave', { pid: ch.pid, canal: ch.nome }); } },
    };
  }
  window.supabase = { createClient: criar };
})();`;

function criarServidor() {
  const db = { usuarios: [], mesas: [], jogadores: [], pedidos: [], segredos_pedido: [], resultados: [], sussurros: [], sussurros_leituras: [], ordens: [], notas_mestre: [], figuras: [], efeitos: [], encontros: [], disputas: [], cronica: [], bestiario: [], habilidades: [], arquivos: [], mesa_regras: [], fichas_mesa: [], ascensoes: [] };
  const naMesa = (u, mesa) => db.jogadores.some(j => j.mesa_id === mesa && j.user_id === u);
  const assinaturas = [];          // { id, uid, tabela, filtro, page }
  const entregue = {};             // uid -> [cada resposta entregue a esse usuário]
  const dados = [];                // próximos valores do dado (para testes determinísticos)
  let seq = 0;
  const id = p => p + '-' + (++seq).toString().padStart(4, '0') + '-' + Math.random().toString(16).slice(2, 10);
  const erro = m => ({ data: null, error: { message: m } });
  const mestreDe = mesa => (db.mesas.find(m => m.id === mesa) || {}).mestre_id;
  const anonimo = uid => !!(db.usuarios.find(u => u.id === uid) || {}).anon;
  const rolar = l => dados.length ? dados.shift() : 1 + Math.floor(Math.random() * l);

  // as mesmas regras de RLS do banco real
  const VE = {
    mesas: (u, r) => r.mestre_id === u,
    jogadores: (u, r) => r.user_id === u || mestreDe(r.mesa_id) === u,
    pedidos: (u, r) => mestreDe(r.mesa_id) === u || (r.para === u && r.tipo === 'aberto'),
    segredos_pedido: (u, r) => mestreDe(r.mesa_id) === u,
    resultados: (u, r) => mestreDe(r.mesa_id) === u || (r.user_id === u && r.tipo === 'aberto'),
    sussurros: (u, r) => mestreDe(r.mesa_id) === u || r.para === u || (r.para === null && naMesa(u, r.mesa_id)),
    sussurros_leituras: (u, r) => mestreDe(r.mesa_id) === u || r.user_id === u,
    ordens: (u, r) => mestreDe(r.mesa_id) === u || r.para === u,
    notas_mestre: (u, r) => mestreDe(r.mesa_id) === u,
    figuras: (u, r) => mestreDe(r.mesa_id) === u,
    cronica: (u, r) => mestreDe(r.mesa_id) === u,
    mesa_regras: (u, r) => mestreDe(r.mesa_id) === u || naMesa(u, r.mesa_id),
    encontros: (u, r) => mestreDe(r.mesa_id) === u || (naMesa(u, r.mesa_id) && [...(r.jogadores || []), ...(r.sairam || [])].includes(u)),
    efeitos: (u, r) => mestreDe(r.mesa_id) === u || (r.user_id === u && !r.secreto && naMesa(u, r.mesa_id)),
    disputas: (u, r) => mestreDe(r.mesa_id) === u || (r.visivel && (r.a.id === u || r.b.id === u)),
    bestiario: (u, r) => r.dono === u && !anonimo(u),
    habilidades: (u, r) => mestreDe(r.mesa_id) === u || (r.user_id === u && naMesa(u, r.mesa_id)),
    fichas_mesa: (u, r) => mestreDe(r.mesa_id) === u || (r.user_id === u && naMesa(u, r.mesa_id)),
    ascensoes: (u, r) => mestreDe(r.mesa_id) === u || (r.user_id === u && naMesa(u, r.mesa_id)),
  };
  function visao(u) {     // resultados_mestre (security_invoker: vale a RLS de quem consulta)
    return db.resultados.filter(r => VE.resultados(u, r)).map(r => {
      const p = db.pedidos.find(x => x.id === r.pedido_id), s = db.segredos_pedido.find(x => x.pedido_id === r.pedido_id);
      if (!p || !VE.pedidos(u, p) || !s || !VE.segredos_pedido(u, s)) return null;
      const oc = s.oculto || 0;
      return { ...r, modificador: r.modificador + oc, total: r.total + oc, rotulo: p.rotulo, atributo: p.atributo, dificuldade: s.dificuldade, passou: r.total + oc >= s.dificuldade, oculto: oc };
    }).filter(Boolean);
  }

  async function avisar(tabela, linha) {
    for (const a of assinaturas.slice()) {
      if (a.tabela !== tabela || !a.uid || !VE[tabela](a.uid, linha)) continue;
      const m = /^(\w+)=eq\.(.+)$/.exec(a.filtro || ''); if (m && String(linha[m[1]]) !== m[2]) continue;
      a.page.evaluate(([i, l]) => window.__sbEmitir && window.__sbEmitir(i, { eventType: '*', new: l }), [a.id, linha]).catch(() => {});
    }
  }
  const registrar = (u, r) => { if (u) (entregue[u] = entregue[u] || []).push(JSON.parse(JSON.stringify(r))); return r; };

  // igual a privado.mod_da_ficha: valor ilegível vira 0, limite ±30 (agora só para as figuras do mestre)
  const modDaFicha = (f, attr) => { if (!attr) return 0; const v = ((f || {}).mods || {})[attr]; return /^-?[0-9]{1,3}$/.test(String(v)) ? Math.max(-30, Math.min(30, parseInt(v, 10))) : 0; };
  const d20 = () => rolar(20);
  // igual a privado.regras_da_mesa / mod_calculado / ficha_do_servidor: o modificador sai da base + regras, nunca de ficha.mods
  const regrasDaMesa = mesa => { const r = db.mesa_regras.filter(x => x.mesa_id === mesa).sort((a, b) => b.versao - a.versao)[0]; return r ? { regras: r.regras, versao: r.versao } : { regras: Regras.LOTM, versao: 0 }; };
  // igual a privado.regras_na_versao: 0 = lotm; versão sumida = a em vigor
  const regrasNaVersao = (mesa, v) => { if (v === 0) return { regras: Regras.LOTM, versao: 0 }; const r = db.mesa_regras.find(x => x.mesa_id === mesa && x.versao === v); return r ? { regras: r.regras, versao: r.versao } : regrasDaMesa(mesa); };
  const mesaDe = mesa => db.mesas.find(m => m.id === mesa) || {};
  const fichaMesa = (mesa, u) => db.fichas_mesa.find(x => x.mesa_id === mesa && x.user_id === u);
  // cada ficha na sua versão (só na mesa com ficha montada)
  const modCalculado = (mesa, f, attr) => { try { const R = mesaDe(mesa).ficha_na_mesa && f && typeof f.regras_versao === 'number' ? regrasNaVersao(mesa, f.regras_versao).regras : regrasDaMesa(mesa).regras; return Regras.modificador(R, f, attr); } catch (e) { return 0; } };
  // igual ao gatilho ficha_do_servidor (20261116): na mesa com ficha montada, base/Caminho/raça vêm da ficha aprovada
  const fichaDoServidor = (mesa, f0, u, recalculo) => {
    if (!f0 || typeof f0 !== 'object' || Array.isArray(f0)) return f0;
    let f = { ...f0 }, rg;
    const jj = db.jogadores.find(x => x.mesa_id === mesa && x.user_id === u);
    if (!recalculo) f.seq_site = f0.seq ?? null;
    f.seq = jj ? jj.sequencia : 9;
    try {
      if (mesaDe(mesa).ficha_na_mesa) {
        if (!('do_site' in f)) f.do_site = { base: f.base || {}, caminhoId: f.caminhoId || '', racaId: f.racaId || '' };
        const fm = fichaMesa(mesa, u);
        if (fm && fm.estado === 'aprovada') { rg = regrasNaVersao(mesa, fm.regras_versao); Object.assign(f, { base: fm.base, caminhoId: fm.caminho_id || '', racaId: fm.raca_id || '' }); }
        else { rg = regrasDaMesa(mesa); f.base = {}; }
        f.ficha_estado = fm ? fm.estado : 'sem';
      } else {
        rg = regrasDaMesa(mesa);
        if (f.do_site && typeof f.do_site === 'object') Object.assign(f, f.do_site);
        delete f.do_site; delete f.ficha_estado;
      }
      const c = Regras.calcular(rg.regras, f), x = { ...f, attrs: c.attrs, mods: c.mods, maximos: c.maximos, regras_versao: rg.versao };
      for (const [id, k] of [['pv', 'pvMax'], ['san', 'sanMax'], ['esp', 'espMax']]) if (Object.hasOwn(c.maximos, id)) x[k] = c.maximos[id];
      return x;
    } catch (e) { return { ...f, attrs: {}, mods: {} }; }
  };
  const modJog = (mesa, u, f, attr, soVisivel) => { if (!attr) return 0; const extra = db.efeitos.filter(e => e.mesa_id === mesa && e.user_id === u && ['bencao', 'maldicao'].includes(e.tipo) && e.atributo === attr && !(soVisivel && e.secreto)).reduce((t, e) => t + e.valor, 0); return Math.max(-30, Math.min(30, modCalculado(mesa, f, attr) + extra)); };
  const entradaRoda = (mesa, tipo, idL) => {
    if (tipo === 'jogador') { const j = db.jogadores.find(x => x.mesa_id === mesa && x.user_id === idL); if (!j) throw new Error('Jogador não encontrado.'); const d = d20(), b = modJog(mesa, j.user_id, j.ficha, 'agil'); return { tipo, id: idL, nome: j.nome, caminhoId: (j.ficha || {}).caminhoId || null, cor: (j.ficha || {}).cor || null, dado: d, bonus: b, total: d + b }; }
    if (tipo === 'figura') { const f = db.figuras.find(x => x.mesa_id === mesa && x.id === idL); if (!f) throw new Error('Figura não encontrada.'); const d = d20(); return { tipo, id: idL, nome: f.nome, caminhoId: null, cor: null, dado: d, bonus: f.bonus, total: d + f.bonus }; }
    throw new Error('Participante inválido.');
  };
  const jaEm = (mesa, tipo, idL) => db.encontros.find(e => e.mesa_id === mesa && e.ativo && e.ordem.some(p => p.tipo === tipo && p.id === idL));
  const cronicaSrv = (mesa, texto) => { const l = { id: id('cro'), mesa_id: mesa, texto: String(texto).slice(0, 500), criado_em: new Date().toISOString() }; db.cronica.push(l); avisar('cronica', l); };
  const batalhaDoMestre = (u, b) => { const e = db.encontros.find(x => x.id === b && x.ativo); return e && mestreDe(e.mesa_id) === u ? e : null; };
  function ladoDuelo(mesa, tipo, idL, attr) {
    if (tipo === 'jogador') { const j = db.jogadores.find(x => x.mesa_id === mesa && x.user_id === idL); if (!j) throw new Error('Jogador não encontrado.'); const d = d20(), m = modJog(mesa, j.user_id, j.ficha, attr); return { tipo, id: idL, nome: j.nome, caminhoId: (j.ficha || {}).caminhoId || null, cor: (j.ficha || {}).cor || null, atributo: attr || null, dado: d, mod: m, total: d + m }; }
    if (tipo === 'figura') { const f = db.figuras.find(x => x.mesa_id === mesa && x.id === idL); if (!f) throw new Error('Figura não encontrada.'); const d = d20(), tem = !!attr && Object.hasOwn(f.mods || {}, attr), m = tem ? modDaFicha({ mods: f.mods }, attr) : f.bonus; return { tipo, id: idL, nome: f.nome, atributo: tem ? attr : null, dado: d, mod: m, total: d + m }; }
    throw new Error('Lado inválido.');
  }
  const recalcular = (mesa, u) => db.jogadores.filter(j => j.mesa_id === mesa && (!u || j.user_id === u)).forEach(j => { j.ficha = fichaDoServidor(mesa, j.ficha, j.user_id, true); j.atualizado_em = new Date().toISOString(); avisar('jogadores', j); });
  const fichaLivre = (mesa, u) => { const fm = fichaMesa(mesa, u); return !fm || fm.liberada || fm.estado === 'recusada'; };
  const conferirFicha = (u, mesa) => !naMesa(u, mesa) ? erro('Entre na mesa primeiro.') : !mesaDe(mesa).ficha_na_mesa ? erro('Nesta mesa a ficha é feita no site.') : null;
  const idOk = v => !v || /^[a-z]{2,20}$/.test(v);
  // igual a privado.atributo_da_mesa: o atributo do teste tem de existir nas regras em vigor
  const atributoOk = (mesa, at) => !at || regrasDaMesa(mesa).regras.atributos.some(x => x.id === at);
  const RPC = {
    propor_habilidade(u, a) {
      if (!naMesa(u, a.p_mesa)) return erro('Entre na mesa para propor uma habilidade.');
      const n = String(a.p_nome || '').trim().slice(0, 60); if (!n) return erro('Dê um nome à habilidade.');
      if (db.habilidades.filter(h => h.mesa_id === a.p_mesa && h.user_id === u && h.estado === 'pendente').length >= 5) return erro('Limite de 5 propostas esperando o mestre.');
      const c = (v, m) => String(v || '').trim().slice(0, m) || null, agora = new Date().toISOString();
      const h = { id: id('hab'), mesa_id: a.p_mesa, user_id: u, nome: n, descricao: c(a.p_descricao, 600), custo: c(a.p_custo, 60), efeito: c(a.p_efeito, 60), origem: 'jogador', estado: 'pendente', resposta: null, alterada: false, criado_em: agora, atualizado_em: agora };
      db.habilidades.push(h); avisar('habilidades', h); return { data: h.id, error: null };
    },
    retirar_habilidade(u, a) {
      const h = db.habilidades.find(x => x.id === a.p_id && x.user_id === u && x.origem === 'jogador' && ['pendente', 'rejeitada'].includes(x.estado));
      if (!h) return erro('Esta habilidade não pode ser retirada.');
      db.habilidades.splice(db.habilidades.indexOf(h), 1); avisar('habilidades', h); return { data: null, error: null };
    },
    iniciar_batalha(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre começa uma batalha.');
      db.encontros = db.encontros.filter(e => !(e.mesa_id === a.p_mesa && !e.ativo));
      if (db.encontros.filter(e => e.mesa_id === a.p_mesa && e.ativo).length >= 4) return erro('No máximo 4 batalhas ao mesmo tempo.');
      const pedidos2 = new Set(a.p_jogadores || []), js = db.jogadores.filter(j => j.mesa_id === a.p_mesa && pedidos2.has(j.user_id)).map(j => j.user_id), fs2 = [...new Set(a.p_figuras || [])];
      for (const x of js) { const o = jaEm(a.p_mesa, 'jogador', x); if (o) return erro(`${db.jogadores.find(j => j.mesa_id === a.p_mesa && j.user_id === x).nome} já está na batalha "${o.nome}".`); }
      for (const x of fs2) { const o = jaEm(a.p_mesa, 'figura', x); if (o) return erro(`Essa figura já está na batalha "${o.nome}".`); }
      let ps; try { ps = js.map(x => entradaRoda(a.p_mesa, 'jogador', x)).concat(fs2.map(x => entradaRoda(a.p_mesa, 'figura', x))); } catch (e) { return erro(e.message); }
      ps.sort((x, y) => y.total - x.total || y.bonus - x.bonus);
      if (!ps.length) return erro('Ninguém para entrar na Roda.');
      const nome = String(a.p_nome || '').trim().slice(0, 40) || 'Encontro', agora = new Date().toISOString();
      const e = { id: id('bat'), mesa_id: a.p_mesa, nome, ativo: true, rodada: 1, vez: 0, ordem: ps, jogadores: js, sairam: [], criado_em: agora, atualizado_em: agora };
      db.encontros.push(e); avisar('encontros', e); cronicaSrv(a.p_mesa, '⚔ ' + nome + ' começa: ' + ps.map(p => p.nome).join(', '));
      return { data: e.id, error: null };
    },
    regirar_batalha(u, a) {
      const e = batalhaDoMestre(u, a.p_batalha); if (!e) return erro('Batalha não encontrada.');
      e.ordem = e.ordem.map(p => entradaRoda(e.mesa_id, p.tipo, p.id)).sort((x, y) => y.total - x.total || y.bonus - x.bonus); e.rodada = 1; e.vez = 0; e.atualizado_em = new Date().toISOString(); avisar('encontros', e);
      return { data: null, error: null };
    },
    passar_turno(u, a) {
      const e = batalhaDoMestre(u, a.p_batalha); if (!e) return erro('Batalha não encontrada.');
      const n = Math.max(1, e.ordem.length); if (e.vez + 1 >= n) e.rodada++; e.vez = (e.vez + 1) % n; e.atualizado_em = new Date().toISOString(); avisar('encontros', e);
      return { data: { rodada: e.rodada, vez: e.vez }, error: null };
    },
    encerrar_batalha(u, a) {
      const e = batalhaDoMestre(u, a.p_batalha); if (!e) return erro('Batalha não encontrada.');
      e.ativo = false; e.atualizado_em = new Date().toISOString(); avisar('encontros', e); cronicaSrv(e.mesa_id, '⚔ ' + e.nome + ' termina na rodada ' + e.rodada);
      return { data: null, error: null };
    },
    entrar_na_batalha(u, a) {
      const e = batalhaDoMestre(u, a.p_batalha); if (!e) return erro('Batalha não encontrada.');
      if (e.ordem.length >= 30) return erro('A Roda já está cheia (30).');
      const o = jaEm(e.mesa_id, a.p_tipo, a.p_id); if (o) return erro(`Já está na batalha "${o.nome}".`);
      let v; try { v = entradaRoda(e.mesa_id, a.p_tipo, a.p_id); } catch (er) { return erro(er.message); }
      let pos = e.ordem.findIndex(x => v.total > x.total); if (pos < 0) pos = e.ordem.length;
      e.ordem.splice(pos, 0, v); if (pos <= e.vez) e.vez++;
      if (a.p_tipo === 'jogador') { e.jogadores = [...e.jogadores.filter(x => x !== a.p_id), a.p_id]; e.sairam = e.sairam.filter(x => x !== a.p_id); }
      e.atualizado_em = new Date().toISOString(); avisar('encontros', e); cronicaSrv(e.mesa_id, e.nome + ' — ' + v.nome + ' entra na rodada ' + e.rodada);
      return { data: null, error: null };
    },
    sair_da_batalha(u, a) {
      const e = batalhaDoMestre(u, a.p_batalha); if (!e) return erro('Batalha não encontrada.');
      const i = e.ordem.findIndex(x => x.tipo === a.p_tipo && x.id === a.p_id); if (i < 0) return erro('Não está nesta batalha.');
      const [quem] = e.ordem.splice(i, 1), n = e.ordem.length, rod = e.rodada;
      if (i < e.vez) e.vez--; if (n > 0 && e.vez >= n) { e.vez = 0; e.rodada++; } if (!n) { e.vez = 0; e.ativo = false; }
      if (a.p_tipo === 'jogador') { e.jogadores = e.jogadores.filter(x => x !== a.p_id); e.sairam = [...e.sairam.filter(x => x !== a.p_id), a.p_id]; }
      e.atualizado_em = new Date().toISOString(); avisar('encontros', e); cronicaSrv(e.mesa_id, e.nome + ' — ' + quem.nome + ' sai na rodada ' + rod + (n ? '' : ' (a batalha termina)'));
      return { data: null, error: null };
    },
    disputar(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre começa um duelo.');
      if (a.p_a_tipo === a.p_b_tipo && a.p_a_id === a.p_b_id) return erro('Escolha dois lados diferentes.');
      try {
        const A = ladoDuelo(a.p_mesa, a.p_a_tipo, a.p_a_id, a.p_a_attr), B = ladoDuelo(a.p_mesa, a.p_b_tipo, a.p_b_id, a.p_b_attr), rot = String(a.p_rotulo || '').trim().slice(0, 80) || 'Duelo';
        const d = { id: id('due'), mesa_id: a.p_mesa, rotulo: rot, a: A, b: B, visivel: a.p_visivel !== false, criado_em: new Date().toISOString() };
        db.disputas.push(d); avisar('disputas', d); return { data: { rotulo: rot, a: A, b: B }, error: null };
      } catch (e) { return erro(e.message); }
    },
    ordenar(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre dá ordens.');
      if (!['pv', 'san', 'terror'].includes(a.p_tipo)) return erro('Ordem desconhecida.');
      if (a.p_tipo === 'terror') { if (![0, 1].includes(a.p_valor)) return erro('Terror é ligar (1) ou desligar (0).'); db.mesas.find(m => m.id === a.p_mesa).terror = a.p_valor === 1; }
      else if (!a.p_valor || Math.abs(a.p_valor) > 999) return erro('Quantidade inválida (1 a 999).');
      const alvos = db.jogadores.filter(j => j.mesa_id === a.p_mesa && (!a.p_para || j.user_id === a.p_para));
      if (!alvos.length && a.p_tipo !== 'terror') return erro('Jogador não encontrado.');
      alvos.forEach(j => { const o = { id: id('ord'), mesa_id: a.p_mesa, para: j.user_id, tipo: a.p_tipo, valor: a.p_valor, motivo: String(a.p_motivo || '').trim().slice(0, 80) || null, criado_em: new Date().toISOString(), aplicada_em: null }; db.ordens.push(o); avisar('ordens', o); });
      return { data: alvos.length, error: null };
    },
    aplicar_ordem(u, a) {
      const o = db.ordens.find(x => x.id === a.p_id && x.para === u && x.aplicada_em === null);
      if (!o) return { data: null, error: null };
      o.aplicada_em = new Date().toISOString(); avisar('ordens', o);
      return { data: { tipo: o.tipo, valor: o.valor, motivo: o.motivo }, error: null };
    },
    estado_da_mesa(u, a) {
      if (!(naMesa(u, a.p_mesa) || mestreDe(a.p_mesa) === u)) return erro('Mesa inválida.');
      const m = mesaDe(a.p_mesa); return { data: { terror: !!m.terror, ficha_na_mesa: !!m.ficha_na_mesa, aprovar_fichas: !!m.aprovar_fichas }, error: null };
    },
    // ---- Sequência no servidor (20261117) ----
    pedir_ascensao(u, a) {
      const j = db.jogadores.find(x => x.mesa_id === a.p_mesa && x.user_id === u); if (!j) return erro('Entre na mesa primeiro.');
      if (!Number.isInteger(a.p_para) || a.p_para < 0 || a.p_para >= j.sequencia) return erro(`Só dá para pedir uma Sequência acima da atual (${j.sequencia}).`);
      db.ascensoes.filter(x => x.mesa_id === a.p_mesa && x.user_id === u && x.estado === 'pendente').forEach(x => { db.ascensoes.splice(db.ascensoes.indexOf(x), 1); avisar('ascensoes', x); });
      const agora = new Date().toISOString(), r = { id: id('asc'), mesa_id: a.p_mesa, user_id: u, de: j.sequencia, para: a.p_para, origem: 'jogador', estado: 'pendente', resposta: null, criado_em: agora, atualizado_em: agora };
      db.ascensoes.push(r); avisar('ascensoes', r); return { data: r.id, error: null };
    },
    julgar_ascensao(u, a) {
      const r = db.ascensoes.find(x => x.id === a.p_id); if (!r || mestreDe(r.mesa_id) !== u) return erro('Só o mestre decide a ascensão.');
      if (r.estado !== 'pendente') return erro('Este pedido já foi decidido.');
      if (a.p_aprovar) {
        const j = db.jogadores.find(x => x.mesa_id === r.mesa_id && x.user_id === r.user_id && x.sequencia === r.de); if (!j) return erro('A Sequência deste jogador mudou desde o pedido.');
        j.sequencia = r.para; recalcular(r.mesa_id, r.user_id);
      }
      Object.assign(r, { estado: a.p_aprovar ? 'aprovada' : 'recusada', resposta: String(a.p_resposta || '').trim().slice(0, 300) || null, atualizado_em: new Date().toISOString() });
      avisar('ascensoes', r); return { data: null, error: null };
    },
    definir_sequencia(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre muda a Sequência.');
      if (!Number.isInteger(a.p_seq) || a.p_seq < 0 || a.p_seq > 9) return erro('A Sequência vai de 9 a 0.');
      const j = db.jogadores.find(x => x.mesa_id === a.p_mesa && x.user_id === a.p_user); if (!j) return erro('Jogador não encontrado.');
      if (j.sequencia === a.p_seq) return erro(`O jogador já está na Sequência ${j.sequencia}.`);
      const de = j.sequencia; j.sequencia = a.p_seq; recalcular(a.p_mesa, a.p_user);
      db.ascensoes.filter(x => x.mesa_id === a.p_mesa && x.user_id === a.p_user && x.estado === 'pendente').forEach(x => { db.ascensoes.splice(db.ascensoes.indexOf(x), 1); avisar('ascensoes', x); });
      const agora = new Date().toISOString(), r = { id: id('asc'), mesa_id: a.p_mesa, user_id: a.p_user, de, para: a.p_seq, origem: 'mestre', estado: 'aprovada', resposta: String(a.p_resposta || '').trim().slice(0, 300) || null, criado_em: agora, atualizado_em: agora };
      db.ascensoes.push(r); avisar('ascensoes', r); return { data: null, error: null };
    },
    // ---- ficha montada na mesa (20261116) ----
    rolar_ficha(u, a) {
      const e = conferirFicha(u, a.p_mesa); if (e) return e;
      if (!fichaLivre(a.p_mesa, u)) return erro('Seus atributos já foram rolados. Para rolar de novo, peça ao mestre.');
      const rg = regrasDaMesa(a.p_mesa), g = rg.regras.geracao || {}, met = g.metodo || '4d6-menor', mn = g.min ?? 3, mx = g.max ?? 18, base = {}, rolagens = {};
      for (const at of rg.regras.atributos) {
        const d = Array.from({ length: met === '3d6' ? 3 : 4 }, () => rolar(6)), s = d.reduce((t, v) => t + v, 0) - (d.length === 4 ? Math.min(...d) : 0);
        base[at.id] = Math.max(mn, Math.min(mx, s)); rolagens[at.id] = d;
      }
      const antes = fichaMesa(a.p_mesa, u), agora = new Date().toISOString();
      const fm = Object.assign(antes || { mesa_id: a.p_mesa, user_id: u, rolagens_feitas: 0, criado_em: agora }, { base, rolagens, caminho_id: null, raca_id: null, origem: 'servidor', estado: 'rolada', regras_versao: rg.versao, liberada: false, resposta: null, atualizado_em: agora });
      fm.rolagens_feitas++; if (!antes) db.fichas_mesa.push(fm);
      avisar('fichas_mesa', fm); recalcular(a.p_mesa, u);
      return { data: { base, rolagens, metodo: met, regras_versao: rg.versao }, error: null };
    },
    enviar_ficha(u, a) {
      const e = conferirFicha(u, a.p_mesa); if (e) return e;
      if (!idOk(a.p_caminho) || !idOk(a.p_raca)) return erro('Caminho ou raça inválidos.');
      const fm = fichaMesa(a.p_mesa, u); if (!fm || fm.estado !== 'rolada' || fm.origem !== 'servidor') return erro('Role os atributos antes de enviar a ficha.');
      Object.assign(fm, { caminho_id: a.p_caminho || null, raca_id: a.p_raca || null, estado: mesaDe(a.p_mesa).aprovar_fichas ? 'pendente' : 'aprovada', atualizado_em: new Date().toISOString() });
      avisar('fichas_mesa', fm); recalcular(a.p_mesa, u); return { data: fm.estado, error: null };
    },
    converter_ficha(u, a) {
      const e = conferirFicha(u, a.p_mesa); if (e) return e;
      if (!fichaLivre(a.p_mesa, u)) return erro('Sua ficha desta mesa já existe. Para trocar, peça ao mestre.');
      if (!idOk(a.p_caminho) || !idOk(a.p_raca)) return erro('Caminho ou raça inválidos.');
      const rg = regrasDaMesa(a.p_mesa), g = rg.regras.geracao || {}, mn = g.min ?? 3, mx = g.max ?? 18, base = {}, b = a.p_base && typeof a.p_base === 'object' ? a.p_base : {};
      for (const at of rg.regras.atributos) { const v = b[at.id]; if (!Number.isInteger(v) || v < mn || v > mx) return erro(`Os atributos da sua ficha não batem com as regras desta mesa (${at.nome}). Monte uma ficha nova.`); base[at.id] = v; }
      const antes = fichaMesa(a.p_mesa, u), agora = new Date().toISOString();
      const fm = Object.assign(antes || { mesa_id: a.p_mesa, user_id: u, rolagens_feitas: 0, criado_em: agora }, { base, rolagens: {}, caminho_id: a.p_caminho || null, raca_id: a.p_raca || null, origem: 'convertida', estado: 'pendente', regras_versao: rg.versao, liberada: false, resposta: null, atualizado_em: agora });
      if (!antes) db.fichas_mesa.push(fm);
      avisar('fichas_mesa', fm); recalcular(a.p_mesa, u); return { data: 'pendente', error: null };
    },
    configurar_mesa(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre configura a mesa.');
      const m = mesaDe(a.p_mesa); if (a.p_ficha_na_mesa != null) m.ficha_na_mesa = !!a.p_ficha_na_mesa; if (a.p_aprovar_fichas != null) m.aprovar_fichas = !!a.p_aprovar_fichas;
      recalcular(a.p_mesa, null); return { data: null, error: null };
    },
    julgar_ficha(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre aprova fichas.');
      const fm = fichaMesa(a.p_mesa, a.p_user); if (!fm || fm.estado !== 'pendente') return erro('Esta ficha não está esperando aprovação.');
      Object.assign(fm, { estado: a.p_aprovar ? 'aprovada' : 'recusada', resposta: String(a.p_resposta || '').trim().slice(0, 300) || null, atualizado_em: new Date().toISOString() });
      avisar('fichas_mesa', fm); recalcular(a.p_mesa, a.p_user); return { data: null, error: null };
    },
    liberar_ficha(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre libera uma nova ficha.');
      const fm = fichaMesa(a.p_mesa, a.p_user); if (!fm) return erro('Este jogador ainda não tem ficha nesta mesa.');
      fm.liberada = true; fm.atualizado_em = new Date().toISOString(); avisar('fichas_mesa', fm); return { data: null, error: null };
    },
    migrar_ficha(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre migra fichas.');
      const fm = fichaMesa(a.p_mesa, a.p_user); if (!fm) return erro('Este jogador ainda não tem ficha nesta mesa.');
      const rg = regrasDaMesa(a.p_mesa), g = rg.regras.geracao || {}, mn = g.min ?? 3, mx = g.max ?? 18;
      for (const at of rg.regras.atributos) { const v = fm.base[at.id]; if (!Number.isInteger(v) || v < mn || v > mx) return erro(`A versão ${rg.versao} tem atributos que esta ficha não tem (${at.nome}): libere o jogador para refazer a ficha.`); }
      fm.regras_versao = rg.versao; fm.atualizado_em = new Date().toISOString(); avisar('fichas_mesa', fm); recalcular(a.p_mesa, a.p_user);
      return { data: rg.versao, error: null };
    },
    sussurrar(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre sussurra.');
      const t = String(a.p_texto || '').trim().slice(0, 1000) || null, ti = String(a.p_titulo || '').trim().slice(0, 80) || null, img = a.p_imagem || null;
      if (img && (img.length > 300000 || !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(img))) return erro('new row violates check constraint "sussurros_imagem_check"');
      const cam = a.p_imagem_caminho || null;
      if (!t && !img && !cam) return erro('Escreva algo ou escolha uma imagem.');
      if (img && cam) return erro('Mande a imagem de um jeito só.');
      if (cam && !db.arquivos.some(x => x.nome === cam)) return erro('A imagem não chegou ao servidor. Tente enviar de novo.');
      if (cam && !(ARQ.test(cam) && cam.split('/')[0] === 'mesas' && cam.split('/')[1] === a.p_mesa)) return erro('new row violates check constraint "sussurros_imagem_caminho_check"');
      if (a.p_para && !naMesa(a.p_para, a.p_mesa)) return erro('Jogador não encontrado.');
      const s = { id: id('sus'), mesa_id: a.p_mesa, para: a.p_para || null, titulo: ti, texto: t, imagem: img, imagem_caminho: cam, tem_imagem: !!(img || cam), criado_em: new Date().toISOString() };
      db.sussurros.push(s); avisar('sussurros', s); return { data: s.id, error: null };
    },
    ler_sussurro(u, a) {
      const s = db.sussurros.find(x => x.id === a.p_id);
      if (!s || !(s.para === u || (s.para === null && naMesa(u, s.mesa_id)))) return erro('Sussurro inválido.');
      if (!db.sussurros_leituras.some(l => l.sussurro_id === s.id && l.user_id === u)) { const l = { sussurro_id: s.id, mesa_id: s.mesa_id, user_id: u, lido_em: new Date().toISOString() }; db.sussurros_leituras.push(l); avisar('sussurros_leituras', l); }
      return { data: null, error: null };
    },
    criar_mesa(u, a) {
      if (!u || anonimo(u)) return erro('Entre com e-mail para criar uma mesa.');
      const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = Array.from({ length: 6 }, () => AL[Math.floor(Math.random() * AL.length)]).join(''); } while (db.mesas.some(m => m.codigo === c));
      db.mesas.push({ id: id('mesa'), codigo: c, nome: String(a.p_nome).trim().slice(0, 60), mestre_id: u, criada_em: new Date().toISOString(), terror: false, ficha_na_mesa: false, aprovar_fichas: false });
      return { data: c, error: null };
    },
    entrar_na_mesa(u, a) {
      if (!u) return erro('Entre primeiro.');
      // igual ao banco real: 15 códigos errados por hora por usuário; código errado devolve vazio (um erro desfaria a contagem)
      db.tentativas = db.tentativas || []; const agora = Date.now();
      if (db.tentativas.filter(t => t.u === u && agora - t.t < 3600e3).length >= 15) return erro('Muitas tentativas com código errado. Espere um pouco e tente de novo.');
      const m = db.mesas.find(x => x.codigo === String(a.p_codigo).trim().toUpperCase()); if (!m) { db.tentativas.push({ u, t: agora }); return { data: null, error: null }; }
      let j = db.jogadores.find(x => x.mesa_id === m.id && x.user_id === u);
      if (j) Object.assign(j, { nome: a.p_nome, ficha: fichaDoServidor(m.id, a.p_ficha || {}, u) });
      else db.jogadores.push(j = { mesa_id: m.id, user_id: u, nome: String(a.p_nome).trim().slice(0, 40), sequencia: 9, ficha: fichaDoServidor(m.id, a.p_ficha || {}, u), atualizado_em: new Date().toISOString() });
      avisar('jogadores', j); return { data: m.id, error: null };
    },
    pedir_teste(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre pede testes.');
      if (!atributoOk(a.p_mesa, a.p_atributo)) return erro('Este atributo não existe nas regras da mesa.');
      const p = { id: id('ped'), mesa_id: a.p_mesa, para: a.p_para, tipo: 'aberto', rotulo: a.p_rotulo, atributo: a.p_atributo || null, lados: a.p_lados || 20, estado: 'pendente', criado_em: new Date().toISOString() };
      db.pedidos.push(p); db.segredos_pedido.push({ pedido_id: p.id, mesa_id: a.p_mesa, dificuldade: a.p_dificuldade });
      avisar('pedidos', p); return { data: p.id, error: null };
    },
    responder_pedido(u, a) {
      const p = db.pedidos.find(x => x.id === a.p_pedido);
      if (!p || p.para !== u || p.tipo !== 'aberto') return erro('Pedido inválido.');
      if (p.estado !== 'pendente') return erro('Este teste já foi rolado.');
      // à prova de trapaça: o modificador vem da ficha guardada, não do navegador (p_modificador é ignorado)
      const fj = (db.jogadores.find(j => j.mesa_id === p.mesa_id && j.user_id === u) || {}).ficha;
      const mo = modJog(p.mesa_id, u, fj, p.atributo), mv = modJog(p.mesa_id, u, fj, p.atributo, true), v = rolar(p.lados), r = { pedido_id: p.id, mesa_id: p.mesa_id, user_id: u, tipo: 'aberto', dado: v, lados: p.lados, modificador: mv, total: v + mv, criado_em: new Date().toISOString() };
      const sg = db.segredos_pedido.find(x => x.pedido_id === p.id); if (sg) sg.oculto = mo - mv;
      db.resultados.push(r); p.estado = 'feito'; avisar('resultados', r); avisar('pedidos', p);
      return { data: { dado: v, lados: p.lados, modificador: mv, total: v + mv }, error: null };
    },
    rolar_secreto(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre rola testes secretos.');
      if (!atributoOk(a.p_mesa, a.p_atributo)) return erro('Este atributo não existe nas regras da mesa.');
      const j = db.jogadores.find(x => x.mesa_id === a.p_mesa && x.user_id === a.p_para); if (!j) return erro('Jogador não encontrado.');
      const l = a.p_lados || 20, mo = modJog(a.p_mesa, a.p_para, j.ficha, a.p_atributo), mv = modJog(a.p_mesa, a.p_para, j.ficha, a.p_atributo, true), v = rolar(l);
      const p = { id: id('ped'), mesa_id: a.p_mesa, para: a.p_para, tipo: 'secreto', rotulo: a.p_rotulo, atributo: a.p_atributo || null, lados: l, estado: 'feito', criado_em: new Date().toISOString() };
      db.pedidos.push(p); db.segredos_pedido.push({ pedido_id: p.id, mesa_id: a.p_mesa, dificuldade: a.p_dificuldade, oculto: mo - mv });
      const r = { pedido_id: p.id, mesa_id: a.p_mesa, user_id: a.p_para, tipo: 'secreto', dado: v, lados: l, modificador: mv, total: v + mv, criado_em: new Date().toISOString() };
      db.resultados.push(r); avisar('pedidos', p); avisar('resultados', r);
      return { data: { pedido: p.id, dado: v, modificador: mo, total: v + mo, passou: v + mo >= a.p_dificuldade }, error: null };
    },
  };

  const IMG = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  // ---- Storage (bucket privado "imagens"): as mesmas regras de privado.imagem_posso_gerir / imagem_posso_ver ----
  const ARQ = /^(bestiario|mesas)\/([\w-]{1,64})\/[\w-]{1,64}\.(webp|jpg|png)$/;
  const podeGerir = (u, nome) => { const m = ARQ.exec(String(nome || '')); if (!m || !u) return false; return m[1] === 'bestiario' ? m[2] === u && !anonimo(u) : mestreDe(m[2]) === u; };
  const podeVer = (u, nome) => podeGerir(u, nome) || db.sussurros.some(x => x.imagem_caminho === nome && (x.para === u || (x.para === null && naMesa(u, x.mesa_id))));
  const assinaturasUrl = new Map();   // token -> { nome, vence }
  const erroSt = (m, status) => ({ data: null, error: { message: m, statusCode: String(status || 400) } });
  function storage(op, d) {
    const u = d.uid; if (!u) return erroSt('JWT ausente', 401);
    if (d.bucket !== 'imagens') return erroSt('Bucket not found', 404);
    if (op === 'st_upload') {
      if (!podeGerir(u, d.caminho)) return erroSt('new row violates row-level security policy', 403);
      if (!['image/webp', 'image/jpeg', 'image/png'].includes(d.tipo)) return erroSt('mime type ' + d.tipo + ' is not supported', 415);
      const n = Buffer.from(d.b64, 'base64').length; if (n > 307200) return erroSt('The object exceeded the maximum allowed size', 413);
      if (db.arquivos.some(a => a.nome === d.caminho)) return erroSt('The resource already exists', 409);   // sem upsert: nome novo a cada envio
      db.arquivos.push({ nome: d.caminho, tipo: d.tipo, b64: d.b64, dono: u }); return { data: { path: d.caminho }, error: null };
    }
    if (op === 'st_copy') {
      const a = db.arquivos.find(x => x.nome === d.de);
      if (!a || !podeVer(u, d.de)) return erroSt('Object not found', 404);
      if (!podeGerir(u, d.para)) return erroSt('new row violates row-level security policy', 403);
      if (db.arquivos.some(x => x.nome === d.para)) return erroSt('The resource already exists', 409);
      db.arquivos.push({ ...a, nome: d.para, dono: u }); return { data: { path: d.para }, error: null };
    }
    if (op === 'st_remove') {
      const sai = db.arquivos.filter(a => (d.caminhos || []).includes(a.nome) && podeGerir(u, a.nome));   // sem permissão: some da lista, sem erro (como o real)
      db.arquivos = db.arquivos.filter(a => !sai.includes(a)); return { data: sai.map(a => ({ name: a.nome })), error: null };
    }
    if (op === 'st_list') {
      const pre = String(d.pasta || '').replace(/\/$/, '') + '/';
      return { data: db.arquivos.filter(a => a.nome.startsWith(pre) && !a.nome.slice(pre.length).includes('/') && podeVer(u, a.nome)).slice(0, d.limite || 100).map(a => ({ name: a.nome.slice(pre.length) })), error: null };
    }
    if (op === 'st_sign') {
      const base = String(d.url || '').replace(/\/$/, '');
      return { data: (d.caminhos || []).map(c => {
        if (!db.arquivos.some(a => a.nome === c) || !podeVer(u, c)) return { path: c, error: 'Either the object does not exist or you do not have access to it', signedUrl: null };
        const tok = require('crypto').randomBytes(12).toString('hex'); assinaturasUrl.set(tok, { nome: c, vence: Date.now() + (d.segundos || 60) * 1000 });
        return { path: c, error: null, signedUrl: base + '/storage/v1/object/sign/imagens/' + c + '?token=' + tok };
      }), error: null };
    }
    return erroSt('op desconhecida');
  }
  // o navegador pede a URL assinada: só serve o arquivo com token válido (e o arquivo ainda existindo)
  function servirAssinada(rota) {
    const q = new URL(rota.request().url()), t = assinaturasUrl.get(q.searchParams.get('token') || ''), nome = decodeURIComponent(q.pathname.replace(/^.*\/object\/sign\/imagens\//, ''));
    const a = t && t.nome === nome && t.vence > Date.now() && db.arquivos.find(x => x.nome === nome);
    servidas.push({ nome, ok: !!a });
    if (!a) return rota.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"InvalidJWT"}' });
    return rota.fulfill({ status: 200, contentType: a.tipo, body: Buffer.from(a.b64, 'base64'), headers: { 'cache-control': 'max-age=3600' } });
  }
  const servidas = [];
  // os mesmos checks da tabela bestiario (devolve o nome do check que falhou)
  function validarBestiario(v, parcial, dono) {
    const tem = k => !parcial || k in v;
    if (tem('nome') && (!String(v.nome || '').length || String(v.nome).length > 60)) return 'nome';
    if (tem('perigo') && v.perigo != null && !(v.perigo >= 1 && v.perigo <= 5)) return 'perigo';
    if (tem('pv_max') && v.pv_max != null && !(v.pv_max >= 1 && v.pv_max <= 9999)) return 'pv_max';
    if (tem('defesa') && v.defesa != null && !(v.defesa >= 0 && v.defesa <= 99)) return 'defesa';
    if (tem('habilidades') && v.habilidades != null && (!Array.isArray(v.habilidades) || v.habilidades.length > 12)) return 'habilidades';
    if (tem('mods') && v.mods != null && (typeof v.mods !== 'object' || Array.isArray(v.mods))) return 'mods';
    if (tem('imagem') && v.imagem != null && (v.imagem.length > 300000 || !IMG.test(v.imagem))) return 'imagem';
    if (tem('imagem_caminho') && v.imagem_caminho != null && !(ARQ.test(v.imagem_caminho) && v.imagem_caminho.split('/')[0] === 'bestiario' && v.imagem_caminho.split('/')[1] === dono)) return 'imagem_caminho';
    if (v.imagem != null && v.imagem_caminho != null) return 'uma_imagem';
    if (tem('descricao') && v.descricao != null && v.descricao.length > 1000) return 'descricao';
    if (tem('notas') && v.notas != null && v.notas.length > 1500) return 'notas';
    // NPC (migração 20261113)
    if (tem('categoria') && v.categoria != null && !['criatura', 'npc'].includes(v.categoria)) return 'categoria';
    if (tem('caminho') && v.caminho != null && !/^[a-z]{2,20}$/.test(v.caminho)) return 'caminho';
    if (tem('sequencia') && v.sequencia != null && !(Number.isInteger(v.sequencia) && v.sequencia >= 0 && v.sequencia <= 9)) return 'sequencia';
    if (tem('faccao') && v.faccao != null && v.faccao.length > 60) return 'faccao';
    if (tem('relacao') && v.relacao != null && !['aliado', 'amigavel', 'neutro', 'desconfiado', 'hostil'].includes(v.relacao)) return 'relacao';
    if (tem('local') && v.local != null && v.local.length > 120) return 'local';
    if (tem('personalidade') && v.personalidade != null && v.personalidade.length > 600) return 'personalidade';
    if (tem('falas') && (!Array.isArray(v.falas ?? []) || (v.falas || []).length > 10)) return 'falas';
    if (tem('segredos') && (!Array.isArray(v.segredos ?? []) || (v.segredos || []).length > 8)) return 'segredos';
    return null;
  }
  const limparBestiario = v => ({ nome: v.nome, tipo: v.tipo || null, perigo: v.perigo || 1, pv_max: v.pv_max ?? null, defesa: v.defesa ?? null, horror: v.horror || null, mods: v.mods || {}, habilidades: v.habilidades || [], descricao: v.descricao || null, notas: v.notas || null, imagem: v.imagem || null, imagem_caminho: v.imagem_caminho || null,
    categoria: v.categoria || 'criatura', caminho: v.caminho || null, sequencia: v.sequencia ?? null, faccao: v.faccao || null, relacao: v.relacao || null, local: v.local || null, personalidade: v.personalidade || null, falas: v.falas || [], segredos: v.segredos || [] });
  function consulta(q) {
    const u = q.uid; if (!u) return erro('JWT ausente');
    let linhas = q.tabela === 'resultados_mestre' ? visao(u) : (db[q.tabela] || []).filter(r => VE[q.tabela](u, r));
    linhas = linhas.filter(r => q.filtros.every(([c, v]) => String(r[c]) === String(v)));
    if (q.op === 'insert' && q.tabela === 'bestiario') {   // o bestiário é do mestre (dono), não da mesa
      const v = q.valores; if (!u || anonimo(u)) return erro('new row violates row-level security policy for table "bestiario"');
      const ch = validarBestiario(v, false, u); if (ch) return erro('new row violates check constraint "bestiario_' + ch + '_check"');
      if (db.bestiario.filter(x => x.dono === u).length >= 100) return erro('Limite de 100 criaturas no bestiário. Apague algumas antigas.');   // gatilho do banco
      const agora = new Date().toISOString(), linha = { id: id('bes'), dono: u, ...limparBestiario(v), criado_em: agora, atualizado_em: agora };
      db.bestiario.push(linha); return { data: q.devolver ? [{ ...linha }] : null, error: null };
    }
    if (q.op === 'insert' && q.tabela === 'habilidades') {   // o mestre concede direto; o jogador só pela função
      const v = q.valores; if (mestreDe(v.mesa_id) !== u || v.origem !== 'mestre' || v.estado !== 'aprovada' || !naMesa(v.user_id, v.mesa_id)) return erro('new row violates row-level security policy for table "habilidades"');
      const n = String(v.nome || ''); if (!n || n.length > 60) return erro('new row violates check constraint "habilidades_nome_check"');
      const agora = new Date().toISOString(), linha = { id: id('hab'), mesa_id: v.mesa_id, user_id: v.user_id, nome: n, descricao: v.descricao || null, custo: v.custo || null, efeito: v.efeito || null, origem: 'mestre', estado: 'aprovada', resposta: v.resposta || null, alterada: false, criado_em: agora, atualizado_em: agora };
      db.habilidades.push(linha); avisar('habilidades', linha); return { data: q.devolver ? [{ ...linha }] : null, error: null };
    }
    if (q.op === 'insert' && q.tabela === 'efeitos') {
      const v = q.valores; if (mestreDe(v.mesa_id) !== u || !naMesa(v.user_id, v.mesa_id)) return erro('new row violates row-level security policy for table "efeitos"');
      if (!['bencao', 'maldicao', 'bloqueio', 'perda'].includes(v.tipo)) return erro('new row violates check constraint "efeitos_tipo_check"');
      const atr = ['bencao', 'maldicao'].includes(v.tipo);
      if (atr ? !(v.atributo && v.valor && !v.habilidade && (v.tipo === 'bencao' ? v.valor > 0 : v.valor < 0) && Math.abs(v.valor) <= 20) : !(v.habilidade && v.atributo == null && v.valor == null)) return erro('new row violates check constraint "efeitos_check"');
      const rot = String(v.rotulo || ''); if (!rot || rot.length > 60) return erro('new row violates check constraint "efeitos_rotulo_check"');
      if (db.efeitos.filter(e => e.mesa_id === v.mesa_id && e.user_id === v.user_id).length >= 30) return erro('No máximo 30 efeitos por jogador.');
      const agora = new Date().toISOString(), linha = { id: id('efe'), mesa_id: v.mesa_id, user_id: v.user_id, tipo: v.tipo, atributo: v.atributo || null, valor: v.valor ?? null, habilidade: v.habilidade || null, rotulo: rot, descricao: v.descricao || null, secreto: !!v.secreto, criado_em: agora, atualizado_em: agora };
      db.efeitos.push(linha); avisar('efeitos', linha); return { data: q.devolver ? [{ ...linha }] : null, error: null };
    }
    if (q.op === 'insert' && q.tabela === 'mesa_regras') {   // só o mestre; versão dada pelo servidor; regras validadas como no banco
      const v = q.valores; if (mestreDe(v.mesa_id) !== u) return erro('new row violates row-level security policy for table "mesa_regras"');
      if ('versao' in v) return erro('permission denied for table mesa_regras');
      const versao = db.mesa_regras.filter(x => x.mesa_id === v.mesa_id).reduce((m, x) => Math.max(m, x.versao), 0) + 1;
      if (versao > 100) return erro('No máximo 100 versões de regras por mesa.');
      const e = Regras.validar(v.regras)[0]; if (e) return erro(`Regras inválidas (${e.campo}): ${e.erro}`);
      const linha = { mesa_id: v.mesa_id, versao, regras: JSON.parse(JSON.stringify(v.regras)), criado_em: new Date().toISOString() };
      db.mesa_regras.push(linha); avisar('mesa_regras', linha); return { data: q.devolver ? [{ ...linha }] : null, error: null };
    }
    if (q.op === 'insert' && (q.tabela === 'figuras' || q.tabela === 'cronica')) {   // escritas diretas só do mestre
      const v = q.valores; if (mestreDe(v.mesa_id) !== u) return erro(`new row violates row-level security policy for table "${q.tabela}"`);
      let linha;
      if (q.tabela === 'figuras') {
        const nome = String(v.nome || '').trim(); if (!nome || nome.length > 40) return erro('new row violates check constraint "figuras_nome_check"');
        const bonus = v.bonus == null ? 0 : v.bonus; if (bonus < -10 || bonus > 20) return erro('new row violates check constraint "figuras_bonus_check"');
        linha = { id: id('fig'), mesa_id: v.mesa_id, nome, bonus, pv: v.pv == null ? null : v.pv, pv_max: v.pv_max == null ? null : v.pv_max, ficha_id: v.ficha_id || null, mods: v.mods || {}, defesa: v.defesa == null ? null : v.defesa, criado_em: new Date().toISOString() };
      } else {
        const t = String(v.texto || ''); if (!t || t.length > 500) return erro('new row violates check constraint "cronica_texto_check"');
        linha = { id: id('cro'), mesa_id: v.mesa_id, texto: t, criado_em: new Date().toISOString() };
      }
      db[q.tabela].push(linha); avisar(q.tabela, linha);
      return { data: q.devolver ? [{ ...linha }] : null, error: null };
    }
    if (q.op === 'insert') {   // notas_mestre aceita escrita direta do mestre; as outras tabelas são só por função
      if (q.tabela !== 'notas_mestre') return erro('permission denied for table ' + q.tabela);
      const v = q.valores; if (mestreDe(v.mesa_id) !== u) return erro('new row violates row-level security policy for table "notas_mestre"');
      if (!naMesa(v.user_id, v.mesa_id)) return erro('violates foreign key constraint');
      if (db.notas_mestre.some(n => n.mesa_id === v.mesa_id && n.user_id === v.user_id)) return erro('duplicate key value violates unique constraint "notas_mestre_pkey"');
      db.notas_mestre.push({ mesa_id: v.mesa_id, user_id: v.user_id, texto: String(v.texto || '').slice(0, 4000), atualizado_em: new Date().toISOString() });
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      const COLS = { jogadores: ['nome', 'ficha'], notas_mestre: ['texto'], figuras: ['nome', 'bonus', 'pv', 'pv_max'], bestiario: ['nome', 'tipo', 'perigo', 'pv_max', 'defesa', 'horror', 'mods', 'habilidades', 'descricao', 'notas', 'imagem', 'imagem_caminho', 'categoria', 'caminho', 'sequencia', 'faccao', 'relacao', 'local', 'personalidade', 'falas', 'segredos'], habilidades: ['nome', 'descricao', 'custo', 'efeito', 'estado', 'resposta', 'alterada'], efeitos: ['rotulo', 'descricao', 'secreto', 'valor'] }[q.tabela];
      if (!COLS) return erro('permission denied for table ' + q.tabela);
      if (['bestiario', 'habilidades', 'efeitos', 'jogadores'].includes(q.tabela) && Object.keys(q.valores).some(k => !COLS.includes(k))) return erro('permission denied for table ' + q.tabela);   // grant de update só nas colunas permitidas
      if (q.tabela === 'bestiario') { const ch = validarBestiario(q.valores, true, u); if (ch) return erro('new row violates check constraint "bestiario_' + ch + '_check"'); }
      if (q.tabela === 'habilidades' && 'estado' in q.valores && !['pendente', 'aprovada', 'rejeitada'].includes(q.valores.estado)) return erro('new row violates check constraint "habilidades_estado_check"');
      const pode = linhas.filter(r => q.tabela === 'jogadores' ? r.user_id === u : q.tabela === 'bestiario' ? r.dono === u : mestreDe(r.mesa_id) === u);
      pode.forEach(r => { for (const k of COLS) if (k in q.valores) r[k] = q.valores[k]; if (q.tabela === 'jogadores' && 'ficha' in q.valores) r.ficha = fichaDoServidor(r.mesa_id, r.ficha, r.user_id); r.atualizado_em = new Date().toISOString(); avisar(q.tabela, r); });
      return { data: q.devolver ? pode.map(r => ({ ...r })) : null, error: null };
    }
    if (q.op === 'delete') {
      const DEL = { jogadores: r => r.user_id === u || mestreDe(r.mesa_id) === u, sussurros: r => mestreDe(r.mesa_id) === u, pedidos: r => mestreDe(r.mesa_id) === u, notas_mestre: r => mestreDe(r.mesa_id) === u, mesas: r => r.mestre_id === u, figuras: r => mestreDe(r.mesa_id) === u, cronica: r => mestreDe(r.mesa_id) === u, bestiario: r => r.dono === u, habilidades: r => mestreDe(r.mesa_id) === u, efeitos: r => mestreDe(r.mesa_id) === u }[q.tabela];
      if (!DEL) return erro('permission denied for table ' + q.tabela);
      const tab = db[q.tabela]; linhas.filter(DEL).forEach(r => {
        tab.splice(tab.indexOf(r), 1); avisar(q.tabela, r);
        if (q.tabela === 'bestiario') db.figuras.forEach(f => { if (f.ficha_id === r.id) f.ficha_id = null; });   // on delete set null
        if (q.tabela === 'mesas') for (const t of Object.keys(db)) if (t !== 'mesas' && t !== 'usuarios') db[t] = db[t].filter(x => x.mesa_id !== r.id);   // on delete cascade
        if (q.tabela === 'jogadores') for (const t of ['ordens', 'notas_mestre']) db[t] = db[t].filter(x => !(x.mesa_id === r.mesa_id && (x.para || x.user_id) === r.user_id));   // on delete cascade
      });
      return { data: null, error: null };
    }
    if (q.ordem) { const [c, asc] = q.ordem; linhas = linhas.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
    if (q.limite) linhas = linhas.slice(0, q.limite);
    const cols = q.colunas && q.colunas !== '*' ? q.colunas.split(',').map(c => c.trim()) : null;   // como o real: só as colunas pedidas
    return { data: linhas.map(r => cols ? Object.fromEntries(cols.map(c => [c, r[c]])) : { ...r }), error: null };
  }

  const canais = {};
  function presencaAvisar(nome) {
    const c = canais[nome]; if (!c) return; const estado = {};
    for (const m of c.values()) if (m.chave) (estado[m.chave] = estado[m.chave] || []).push({ ...(m.dados || {}), presence_ref: 'r' });
    for (const [pid, m] of c) m.page.evaluate(([p, e]) => window.__pres && window.__pres[p] && window.__pres[p](e), [pid, estado]).catch(() => {});
  }
  async function tratar(page, op, d) {
    if (op === 'anon') { const u = { id: id('anon'), is_anonymous: true }; db.usuarios.push({ ...u, anon: true }); return { data: u, error: null }; }
    if (op === 'signup') { if (db.usuarios.some(x => x.email === d.email)) return erro('User already registered'); db.usuarios.push({ id: id('user'), email: d.email, senha: d.password, confirmado: false }); return { data: { email: d.email }, error: null }; }
    // recuperar senha: o servidor real manda o e-mail (sem revelar se a conta existe) e o link devolve uma sessão de recuperação
    if (op === 'recuperar') { (db.recuperacoes = db.recuperacoes || []).push({ email: d.email, redirectTo: d.redirectTo, captchaToken: d.captchaToken }); return { data: {}, error: null }; }
    if (op === 'novasenha') {
      const x = db.usuarios.find(y => y.id === d.uid); if (!x) return erro('Auth session missing!');
      if (x.senha === d.password) return erro('New password should be different from the old password.');
      x.senha = d.password; return { data: { id: x.id, email: x.email, is_anonymous: false }, error: null };
    }
    if (op === 'login') { const x = db.usuarios.find(y => y.email === d.email && y.senha === d.password); if (!x) return erro('Invalid login credentials'); if (x.confirmado === false) return erro('Email not confirmed'); return { data: { id: x.id, email: x.email, is_anonymous: false }, error: null }; }
    if (op === 'sub') { assinaturas.push({ ...d, page }); return { data: null, error: null }; }
    if (op === 'pjoin' || op === 'ptrack' || op === 'pleave') {   // Presence: { chave: [dados] } como no Supabase
      const c = canais[d.canal] = canais[d.canal] || new Map();
      if (op === 'pjoin') { c.set(d.pid, { page, chave: null, dados: null }); if (!page.__presencaFecha) { page.__presencaFecha = true; page.on('close', () => { for (const [nome, cc] of Object.entries(canais)) { let mudou = false; for (const [pid, m] of cc) if (m.page === page) { cc.delete(pid); mudou = true; } if (mudou) presencaAvisar(nome); } }); } }
      if (op === 'ptrack' && c.has(d.pid)) Object.assign(c.get(d.pid), { chave: d.chave, dados: d.dados });
      if (op === 'pleave') c.delete(d.pid);
      presencaAvisar(d.canal); return { data: null, error: null };
    }
    if (op === 'unsub') { const i = assinaturas.findIndex(a => a.id === d.id); if (i >= 0) assinaturas.splice(i, 1); return { data: null, error: null }; }
    if (op === 'rpc') return registrar(d.uid, RPC[d.nome] ? RPC[d.nome](d.uid, d.args || {}) : erro('função desconhecida'));
    if (op === 'query') return registrar(d.uid, consulta(d));
    if (op.startsWith('st_')) return registrar(d.uid, storage(op, d));
    return erro('op desconhecida');
  }

  return {
    db, entregue, assinaturas, servidas,
    proximosDados: (...v) => dados.push(...v),
    criarMestre: (email, senha) => { const u = { id: id('user'), email, senha, confirmado: true }; db.usuarios.push(u); return u; },
    async ligar(contexto) {
      await contexto.exposeBinding('__sb', ({ page }, op, d) => tratar(page, op, d));
      await contexto.addInitScript(CLIENTE);
      await contexto.route('**/storage/v1/object/sign/**', servirAssinada);
    },
  };
}

module.exports = { criarServidor };
