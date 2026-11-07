// Supabase FALSO para os testes da mesa online (nada sai da máquina).
// Imita o que o site usa: login (e-mail e anônimo), consultas com RLS, as 5 funções do banco e o tempo real.
// O "servidor" roda no Node e é compartilhado por todas as páginas (mestre e jogadores), como o banco real.
// Ele também registra TUDO que entregou a cada usuário, para provar o que o jogador nunca recebe.

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
    return {
      auth,
      from: consulta,
      rpc: (nome, args) => chamar('rpc', { uid: uid(), nome, args }),
      channel(nome) {
        const ch = { subs: [] };
        ch.on = (tipo, cfg, cb) => { ch.subs.push([cfg, cb]); return ch; };
        ch.subscribe = () => { ch.subs.forEach(([cfg, cb]) => { const id = Math.random().toString(36).slice(2); ch.ids = (ch.ids || []).concat(id); window.__subs[id] = cb; chamar('sub', { id, uid: uid(), tabela: cfg.table, filtro: cfg.filter }); }); return ch; };
        return ch;
      },
      removeChannel(ch) { (ch.ids || []).forEach(id => { delete window.__subs[id]; chamar('unsub', { id }); }); },
    };
  }
  window.supabase = { createClient: criar };
})();`;

function criarServidor() {
  const db = { usuarios: [], mesas: [], jogadores: [], pedidos: [], segredos_pedido: [], resultados: [], sussurros: [], sussurros_leituras: [], ordens: [], notas_mestre: [] };
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
  };
  function visao(u) {     // resultados_mestre (security_invoker: vale a RLS de quem consulta)
    return db.resultados.filter(r => VE.resultados(u, r)).map(r => {
      const p = db.pedidos.find(x => x.id === r.pedido_id), s = db.segredos_pedido.find(x => x.pedido_id === r.pedido_id);
      if (!p || !VE.pedidos(u, p) || !s || !VE.segredos_pedido(u, s)) return null;
      return { ...r, rotulo: p.rotulo, atributo: p.atributo, dificuldade: s.dificuldade, passou: r.total >= s.dificuldade };
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

  const RPC = {
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
      return { data: { terror: !!db.mesas.find(m => m.id === a.p_mesa).terror }, error: null };
    },
    sussurrar(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre sussurra.');
      const t = String(a.p_texto || '').trim().slice(0, 1000) || null, ti = String(a.p_titulo || '').trim().slice(0, 80) || null, img = a.p_imagem || null;
      if (!t && !img) return erro('Escreva algo ou escolha uma imagem.');
      if (img && (img.length > 450000 || !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(img))) return erro('new row violates check constraint "sussurros_imagem_check"');
      if (a.p_para && !naMesa(a.p_para, a.p_mesa)) return erro('Jogador não encontrado.');
      const s = { id: id('sus'), mesa_id: a.p_mesa, para: a.p_para || null, titulo: ti, texto: t, imagem: img, tem_imagem: !!img, criado_em: new Date().toISOString() };
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
      db.mesas.push({ id: id('mesa'), codigo: c, nome: String(a.p_nome).trim().slice(0, 60), mestre_id: u, criada_em: new Date().toISOString(), terror: false });
      return { data: c, error: null };
    },
    entrar_na_mesa(u, a) {
      if (!u) return erro('Entre primeiro.');
      const m = db.mesas.find(x => x.codigo === String(a.p_codigo).trim().toUpperCase()); if (!m) return erro('Mesa não encontrada.');
      let j = db.jogadores.find(x => x.mesa_id === m.id && x.user_id === u);
      if (j) Object.assign(j, { nome: a.p_nome, ficha: a.p_ficha || {} });
      else db.jogadores.push(j = { mesa_id: m.id, user_id: u, nome: String(a.p_nome).trim().slice(0, 40), ficha: a.p_ficha || {}, atualizado_em: new Date().toISOString() });
      avisar('jogadores', j); return { data: m.id, error: null };
    },
    pedir_teste(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre pede testes.');
      const p = { id: id('ped'), mesa_id: a.p_mesa, para: a.p_para, tipo: 'aberto', rotulo: a.p_rotulo, atributo: a.p_atributo || null, lados: a.p_lados || 20, estado: 'pendente', criado_em: new Date().toISOString() };
      db.pedidos.push(p); db.segredos_pedido.push({ pedido_id: p.id, mesa_id: a.p_mesa, dificuldade: a.p_dificuldade });
      avisar('pedidos', p); return { data: p.id, error: null };
    },
    responder_pedido(u, a) {
      const p = db.pedidos.find(x => x.id === a.p_pedido);
      if (!p || p.para !== u || p.tipo !== 'aberto') return erro('Pedido inválido.');
      if (p.estado !== 'pendente') return erro('Este teste já foi rolado.');
      const mo = Math.max(-30, Math.min(30, a.p_modificador || 0)), v = rolar(p.lados), r = { pedido_id: p.id, mesa_id: p.mesa_id, user_id: u, tipo: 'aberto', dado: v, lados: p.lados, modificador: mo, total: v + mo, criado_em: new Date().toISOString() };
      db.resultados.push(r); p.estado = 'feito'; avisar('resultados', r); avisar('pedidos', p);
      return { data: { dado: v, lados: p.lados, modificador: mo, total: v + mo }, error: null };
    },
    rolar_secreto(u, a) {
      if (mestreDe(a.p_mesa) !== u) return erro('Só o mestre rola testes secretos.');
      const j = db.jogadores.find(x => x.mesa_id === a.p_mesa && x.user_id === a.p_para); if (!j) return erro('Jogador não encontrado.');
      const l = a.p_lados || 20, mo = a.p_atributo ? Math.max(-30, Math.min(30, parseInt((j.ficha.mods || {})[a.p_atributo], 10) || 0)) : 0, v = rolar(l);
      const p = { id: id('ped'), mesa_id: a.p_mesa, para: a.p_para, tipo: 'secreto', rotulo: a.p_rotulo, atributo: a.p_atributo || null, lados: l, estado: 'feito', criado_em: new Date().toISOString() };
      db.pedidos.push(p); db.segredos_pedido.push({ pedido_id: p.id, mesa_id: a.p_mesa, dificuldade: a.p_dificuldade });
      const r = { pedido_id: p.id, mesa_id: a.p_mesa, user_id: a.p_para, tipo: 'secreto', dado: v, lados: l, modificador: mo, total: v + mo, criado_em: new Date().toISOString() };
      db.resultados.push(r); avisar('pedidos', p); avisar('resultados', r);
      return { data: { pedido: p.id, dado: v, modificador: mo, total: v + mo, passou: v + mo >= a.p_dificuldade }, error: null };
    },
  };

  function consulta(q) {
    const u = q.uid; if (!u) return erro('JWT ausente');
    let linhas = q.tabela === 'resultados_mestre' ? visao(u) : (db[q.tabela] || []).filter(r => VE[q.tabela](u, r));
    linhas = linhas.filter(r => q.filtros.every(([c, v]) => String(r[c]) === String(v)));
    if (q.op === 'insert') {   // só notas_mestre aceita escrita direta (as outras tabelas são só por função)
      if (q.tabela !== 'notas_mestre') return erro('permission denied for table ' + q.tabela);
      const v = q.valores; if (mestreDe(v.mesa_id) !== u) return erro('new row violates row-level security policy for table "notas_mestre"');
      if (!naMesa(v.user_id, v.mesa_id)) return erro('violates foreign key constraint');
      if (db.notas_mestre.some(n => n.mesa_id === v.mesa_id && n.user_id === v.user_id)) return erro('duplicate key value violates unique constraint "notas_mestre_pkey"');
      db.notas_mestre.push({ mesa_id: v.mesa_id, user_id: v.user_id, texto: String(v.texto || '').slice(0, 4000), atualizado_em: new Date().toISOString() });
      return { data: null, error: null };
    }
    if (q.op === 'update') {
      const COLS = { jogadores: ['nome', 'ficha'], notas_mestre: ['texto'] }[q.tabela];
      if (!COLS) return erro('permission denied for table ' + q.tabela);
      const pode = linhas.filter(r => q.tabela === 'jogadores' ? r.user_id === u : mestreDe(r.mesa_id) === u);
      pode.forEach(r => { for (const k of COLS) if (k in q.valores) r[k] = q.valores[k]; r.atualizado_em = new Date().toISOString(); avisar(q.tabela, r); });
      return { data: q.devolver ? pode.map(r => ({ ...r })) : null, error: null };
    }
    if (q.op === 'delete') {
      const DEL = { jogadores: r => r.user_id === u || mestreDe(r.mesa_id) === u, sussurros: r => mestreDe(r.mesa_id) === u, pedidos: r => mestreDe(r.mesa_id) === u, notas_mestre: r => mestreDe(r.mesa_id) === u, mesas: r => r.mestre_id === u }[q.tabela];
      if (!DEL) return erro('permission denied for table ' + q.tabela);
      const tab = db[q.tabela]; linhas.filter(DEL).forEach(r => {
        tab.splice(tab.indexOf(r), 1); avisar(q.tabela, r);
        if (q.tabela === 'jogadores') for (const t of ['ordens', 'notas_mestre']) db[t] = db[t].filter(x => !(x.mesa_id === r.mesa_id && (x.para || x.user_id) === r.user_id));   // on delete cascade
      });
      return { data: null, error: null };
    }
    if (q.ordem) { const [c, asc] = q.ordem; linhas = linhas.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
    if (q.limite) linhas = linhas.slice(0, q.limite);
    const cols = q.colunas && q.colunas !== '*' ? q.colunas.split(',').map(c => c.trim()) : null;   // como o real: só as colunas pedidas
    return { data: linhas.map(r => cols ? Object.fromEntries(cols.map(c => [c, r[c]])) : { ...r }), error: null };
  }

  async function tratar(page, op, d) {
    if (op === 'anon') { const u = { id: id('anon'), is_anonymous: true }; db.usuarios.push({ ...u, anon: true }); return { data: u, error: null }; }
    if (op === 'signup') { if (db.usuarios.some(x => x.email === d.email)) return erro('User already registered'); db.usuarios.push({ id: id('user'), email: d.email, senha: d.password, confirmado: false }); return { data: { email: d.email }, error: null }; }
    if (op === 'login') { const x = db.usuarios.find(y => y.email === d.email && y.senha === d.password); if (!x) return erro('Invalid login credentials'); if (x.confirmado === false) return erro('Email not confirmed'); return { data: { id: x.id, email: x.email, is_anonymous: false }, error: null }; }
    if (op === 'sub') { assinaturas.push({ ...d, page }); return { data: null, error: null }; }
    if (op === 'unsub') { const i = assinaturas.findIndex(a => a.id === d.id); if (i >= 0) assinaturas.splice(i, 1); return { data: null, error: null }; }
    if (op === 'rpc') return registrar(d.uid, RPC[d.nome] ? RPC[d.nome](d.uid, d.args || {}) : erro('função desconhecida'));
    if (op === 'query') return registrar(d.uid, consulta(d));
    return erro('op desconhecida');
  }

  return {
    db, entregue, assinaturas,
    proximosDados: (...v) => dados.push(...v),
    criarMestre: (email, senha) => { const u = { id: id('user'), email, senha, confirmado: true }; db.usuarios.push(u); return u; },
    async ligar(contexto) {
      await contexto.exposeBinding('__sb', ({ page }, op, d) => tratar(page, op, d));
      await contexto.addInitScript(CLIENTE);
    },
  };
}

module.exports = { criarServidor };
