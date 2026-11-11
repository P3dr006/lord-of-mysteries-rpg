// Motor de regras da mesa (Fase A de docs/SISTEMAS-DA-MESA.md).
// As regras são DADOS (um JSON por mesa). As fórmulas usam uma mini-linguagem lida aqui, NUNCA com eval:
// números inteiros, + - * /, parênteses, dados NdM, abreviações dos atributos, NIVEL, SEQ, DV e mod/min/max/floor.
// O MESMO intérprete existe em plpgsql (supabase/migrations/20261115_regras_da_mesa.sql): lá vale, aqui é prévia e teste.
// Mudou uma regra aqui? Mude lá também (tests/mestre.js compara os dois com os mesmos casos).
const Regras = Object.freeze((() => {
  const congelar = o => { if (o && typeof o === 'object') { Object.values(o).forEach(congelar); Object.freeze(o); } return o; };

  // Predefinição "lotm": idêntica ao site de hoje (js/state.js: mod/total/pvMax/sanMax/espMax; js/poder.js: bonusSeq;
  // js/caminhos.js: atributo de cada Caminho; js/mundo.js: bônus das raças). Mesa sem regras = esta.
  const LOTM = congelar({
    versao: 1, base: 'lotm',
    atributos: [
      { id: 'forca', nome: 'Força', abrev: 'FOR' }, { id: 'agil', nome: 'Agilidade', abrev: 'AGI' },
      { id: 'vigor', nome: 'Vigor', abrev: 'VIG' }, { id: 'intel', nome: 'Intelecto', abrev: 'INT' },
      { id: 'espir', nome: 'Espiritualidade', abrev: 'ESP' }, { id: 'pres', nome: 'Presença', abrev: 'PRE' },
    ],
    geracao: { metodo: '4d6-menor', min: 3, max: 18 },
    total: 'max(1, ATR)',
    modificador: 'floor((ATR - 10) / 2)',
    bonus: {
      caminho: { valor: 2, atributo: { louco: 'espir', erro: 'agil', porta: 'intel', visionario: 'pres', sol: 'pres', tirano: 'forca', torre: 'intel', enforcado: 'espir', escuridao: 'agil', morte: 'vigor', gigante: 'forca', demonessa: 'agil', sacerdote: 'vigor', eremita: 'intel', paragono: 'intel', roda: 'espir', mae: 'vigor', lua: 'espir', abismo: 'forca', acorrentado: 'vigor', imperador: 'pres', justiceiro: 'pres' } },
      raca: { humano: { intel: 1, pres: 1, vigor: 1 }, mutante: { vigor: 2, forca: 1, pres: -1 }, gigante: { forca: 3, vigor: 1, agil: -2 }, elfo: { agil: 2, espir: 1, forca: -1 }, sanguineo: { vigor: 2, pres: 1, espir: -1 }, lobo: { agil: 2, intel: 1, pres: -1 }, dragao: { forca: 2, intel: 2, espir: 1, pres: -2 }, fenix: { espir: 2, agil: 1, vigor: -1 }, diabo: { pres: 2, forca: 1, espir: -1 }, sereia: { espir: 2, pres: 1, forca: -1 }, peixe: { agil: 1, vigor: 1, pres: -1 }, banshee: { espir: 2, pres: 1, vigor: -2 }, fohan: { agil: 2, vigor: 1, intel: -1 } },
      // +1 para cada limite alcançado (SEQ <= limite): "principal" só no atributo do Caminho, "todos" em todos
      sequencia: { principal: [6, 3, 1], todos: [4, 2, 0] },
    },
    recursos: [
      { id: 'pv', nome: 'Pontos de Vida', max: '10 + mod(VIG) * 2 + (9 - SEQ) * 3', cor: '#e05a6a' },
      { id: 'san', nome: 'Sanidade', max: '10 + mod(PRE) * 2 + 5', cor: '#6fb4ff' },
      { id: 'esp', nome: 'Espiritualidade', max: '10 + mod(ESP) * 2 + (9 - SEQ) * 2', cor: '#b08cff' },
    ],
    progressao: { tipo: 'sequencia', de: 9, ate: 0 },
    classes: [], habilidades: 'livres',
  });

  // Predefinição "aventura" (Fase C1, modo MMO): nível 1 a 20 com XP dada pelo mestre, uma classe por papel e um recurso
  // de classe (mana, fúria ou energia). Os 6 atributos têm os ids do LotM: o Teste, o Duelo e a Roda continuam valendo.
  // XP: para passar do nível N ao N+1 são 100 × N de experiência (a tabela guarda o total acumulado).
  const AVENTURA = congelar({
    versao: 1, base: 'aventura',
    atributos: LOTM.atributos.map(a => ({ ...a })),
    geracao: { metodo: '4d6-menor', min: 3, max: 18 },
    total: 'max(1, ATR)',
    modificador: 'floor((ATR - 10) / 2)',
    bonus: {},
    recursos: [
      { id: 'pv', nome: 'Pontos de Vida', max: '10 + DV + mod(VIG) + (NIVEL - 1) * (DV / 2 + mod(VIG))', cor: '#e05a6a' },
      { id: 'mana', nome: 'Mana', max: '20 + mod(ESP) * 4 + NIVEL * 5', cor: '#5b8cff', so: 'mana' },
      { id: 'furia', nome: 'Fúria', max: '100', cor: '#e0652a', so: 'furia' },
      { id: 'energia', nome: 'Energia', max: '40 + mod(AGI) * 2', cor: '#e8c84a', so: 'energia' },
    ],
    progressao: { tipo: 'nivel', de: 1, ate: 20, xp: Array.from({ length: 20 }, (_, n) => 50 * n * (n + 1)) },
    classes: [
      { id: 'sentinela', nome: 'Sentinela', papel: 'tanque', recurso: 'furia', principal: 'vigor', dv: 12, desc: 'Fica na frente e atrai os golpes para si. A fúria cresce a cada pancada, dada ou levada.' },
      { id: 'lamparineiro', nome: 'Lamparineiro', papel: 'cura', recurso: 'mana', principal: 'espir', dv: 8, desc: 'Mantém a chama do grupo acesa: fecha feridas e devolve o fôlego a quem caiu.' },
      { id: 'duelista', nome: 'Duelista', papel: 'dano', recurso: 'energia', principal: 'agil', dv: 10, desc: 'Golpes rápidos, de perto ou à distância. A energia volta depressa, mas acaba logo.' },
      { id: 'arauto', nome: 'Arauto', papel: 'suporte', recurso: 'mana', principal: 'pres', dv: 8, desc: 'Ergue o estandarte: fortalece os aliados e atrapalha os inimigos.' },
    ],
    habilidades: 'livres',
  });
  const PAPEIS = ['tanque', 'cura', 'dano', 'suporte'], RECURSOS_CLASSE = ['mana', 'furia', 'energia'];

  const RESERVADOS = ['ATR', 'SEQ', 'NIVEL', 'DV', 'MOD', 'MIN', 'MAX', 'FLOOR'];
  const FUNCOES = { MOD: [1, 1], FLOOR: [1, 1], MIN: [2, 10], MAX: [2, 10] };
  const PROF_MAX = 20, LIMITE = 9999;
  class ErroFormula extends Error { constructor(pos, motivo) { super(`Fórmula inválida na posição ${pos}: ${motivo}`); this.pos = pos; this.motivo = motivo; } }
  const falha = (pos, motivo) => { throw new ErroFormula(pos, motivo); };
  const digito = c => c >= '0' && c <= '9', letra = c => /^[A-Za-z_]$/.test(c || '');
  const limpar = v => Math.sign(v) * Math.round(Math.abs(v) * 1e6) / 1e6;   // como round(x, 6) do banco (empate longe do zero): 1/3*3 = 1 nos dois

  // ---------- tokens (posições contam de 1, como o banco) ----------
  function tokens(s) {
    if (typeof s !== 'string' || !/[^ \t]/.test(s)) falha(1, 'a fórmula está vazia');
    if (s.length > 200) falha(201, 'fórmula longa demais (máximo 200 caracteres)');
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i], p = i + 1;
      if (c === ' ' || c === '\t') { i++; continue; }
      if (digito(c) || ((c === 'd' || c === 'D') && digito(s[i + 1] || ''))) {
        let j = i; while (j < s.length && digito(s[j])) j++;
        const num = s.slice(i, j);
        if (s[j] === 'd' || s[j] === 'D') {
          let k = j + 1; while (k < s.length && digito(s[k])) k++;
          const lados = s.slice(j + 1, k);
          if (!lados) falha(j + 2, 'faltou o número de lados do dado');
          if (num.length > 3 || (num && (+num < 1 || +num > 100))) falha(p, 'dado com quantidade fora de 1 a 100');
          if (lados.length > 4 || +lados < 2 || +lados > 1000) falha(j + 2, 'dado com lados fora de 2 a 1000');
          if (letra(s[k])) falha(k + 1, 'faltou um operador');
          t.push({ t: 'd', n: num ? +num : 1, m: +lados, p }); i = k; continue;
        }
        if (num.length > 6) falha(p, 'número grande demais (máximo 6 algarismos)');
        if (letra(s[j])) falha(j + 1, 'faltou um operador');
        t.push({ t: 'n', v: +num, p }); i = j; continue;
      }
      if (letra(c)) {
        let j = i; while (j < s.length && letra(s[j])) j++;
        if (j - i > 20) falha(p, 'nome longo demais');
        t.push({ t: 'id', v: s.slice(i, j).toUpperCase(), p }); i = j; continue;
      }
      if ('+-*/(),'.includes(c)) { t.push({ t: 'op', v: c, p }); i++; continue; }
      falha(p, `símbolo não permitido: "${c}"`);
    }
    t.push({ t: 'fim', p: s.length + 1 });
    return t;
  }

  // ---------- análise: devolve a árvore (a mesma gramática do banco, na mesma ordem de erros) ----------
  // ctx: { nomes: [...], mod: bool (mod() permitido), dados: bool }
  function analisar(texto, ctx) {
    const tk = tokens(texto); let i = 0;
    const ver = () => tk[i], eOp = v => tk[i].t === 'op' && tk[i].v === v;
    function expr(prof) {
      let a = termo(prof);
      while (eOp('+') || eOp('-')) { const op = tk[i++].v; a = { t: op, a, b: termo(prof) }; }
      return a;
    }
    function termo(prof) {
      let a = unario(prof);
      while (eOp('*') || eOp('/')) { const op = tk[i++].v; a = { t: op, a, b: unario(prof) }; }
      return a;
    }
    function unario(prof) {
      if (eOp('-')) { if (prof >= PROF_MAX) falha(ver().p, 'aninhamento fundo demais (máximo 20)'); i++; return { t: 'neg', a: unario(prof + 1) }; }
      return primario(prof);
    }
    function primario(prof) {
      const k = ver();
      if (k.t === 'n') { i++; return { t: 'n', v: k.v }; }
      if (k.t === 'd') { if (!ctx.dados) falha(k.p, 'dados não são permitidos aqui'); i++; return { t: 'd', n: k.n, m: k.m }; }
      if (k.t === 'op' && k.v === '(') {
        if (prof >= PROF_MAX) falha(k.p, 'aninhamento fundo demais (máximo 20)');
        i++; const e = expr(prof + 1);
        if (!eOp(')')) falha(ver().p, 'faltou fechar o parêntese');
        i++; return e;
      }
      if (k.t === 'id') {
        i++;
        if (eOp('(')) {
          const f = FUNCOES[k.v]; if (!f) falha(k.p, `função desconhecida: ${k.v.toLowerCase()}`);
          if (k.v === 'MOD' && !ctx.mod) falha(k.p, 'mod() não é permitido aqui');
          if (prof >= PROF_MAX) falha(k.p, 'aninhamento fundo demais (máximo 20)');
          i++; const args = [expr(prof + 1)];
          while (eOp(',')) { i++; args.push(expr(prof + 1)); }
          if (!eOp(')')) falha(ver().p, 'esperava , ou )');
          i++;
          if (args.length < f[0] || args.length > f[1]) falha(k.p, f[0] === f[1] ? `${k.v.toLowerCase()}() recebe 1 valor` : `${k.v.toLowerCase()}() recebe de 2 a 10 valores`);
          return { t: 'f', f: k.v, args };
        }
        if (!ctx.nomes.includes(k.v)) falha(k.p, `nome desconhecido: ${k.v}`);
        return { t: 'v', v: k.v };
      }
      if (k.t === 'fim') falha(k.p, 'a fórmula terminou antes da hora');
      return falha(k.p, 'esperava um número, um nome ou (');
    }
    if (tk.length === 1) falha(1, 'a fórmula está vazia');
    const arv = expr(0);
    if (ver().t !== 'fim') falha(ver().p, 'esperava + - * / ou o fim');
    return arv;
  }

  // ---------- avaliação: null = falta um valor (atributo não rolado) ou divisão por zero ----------
  // op: { vars, modDe(v) -> número|null, validar, rolar(n, m) }
  function avaliar(no, op) {
    const ir = x => avaliar(x, op);
    switch (no.t) {
      case 'n': return no.v;
      case 'd': { if (op.validar) return no.n; let s = 0; for (let k = 0; k < no.n; k++) s += op.rolar ? op.rolar(no.m) : 1 + Math.floor(Math.random() * no.m); return s; }
      case 'v': { const v = op.vars[no.v]; return typeof v === 'number' && Number.isFinite(v) ? v : null; }
      case 'neg': { const a = ir(no.a); return a == null ? null : -a; }
      case '+': case '-': case '*': { const a = ir(no.a), b = ir(no.b); if (a == null || b == null) return null; return no.t === '+' ? a + b : no.t === '-' ? a - b : a * b; }
      case '/': { const a = ir(no.a), b = ir(no.b); if (b === 0) return op.validar ? 0 : null; if (a == null || b == null) return null; return a / b; }
      case 'f': {
        const vs = no.args.map(ir);
        if (vs.some(v => v == null)) return null;
        if (no.f === 'FLOOR') return Math.floor(limpar(vs[0]));
        if (no.f === 'MIN') return Math.min(...vs);
        if (no.f === 'MAX') return Math.max(...vs);
        return op.modDe(vs[0]);
      }
    }
    return null;
  }
  const fechar = v => (v == null ? null : Math.max(-LIMITE, Math.min(LIMITE, Math.floor(limpar(v)))));

  // Compila e avalia uma fórmula. Lança ErroFormula (com .pos) se o texto for inválido.
  function formula(texto, ctx, op) { return fechar(avaliar(analisar(texto, ctx), op)); }
  function checar(texto, ctx) { try { analisar(texto, ctx); return null; } catch (e) { if (e instanceof ErroFormula) return { pos: e.pos, erro: e.message }; throw e; } }

  // ---------- a ficha calculada a partir dos dados rolados (o que o servidor faz) ----------
  const obj = o => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const inteiro = v => typeof v === 'number' && Number.isInteger(v);
  const CTX_ATR = { nomes: ['ATR'], mod: false, dados: false };
  function modDe(R, v) { return v == null ? null : formula(R.modificador, CTX_ATR, { vars: { ATR: v } }); }
  function seqDe(f) { return inteiro(f.seq) && f.seq >= 0 && f.seq <= 9 ? f.seq : 9; }
  function nivelDe(f) { return inteiro(f.nivel) && f.nivel >= 1 && f.nivel <= 20 ? f.nivel : 1; }

  function totalDe(R, f, id) {
    const g = obj(R.geracao), min = inteiro(g.min) ? g.min : 3, max = inteiro(g.max) ? g.max : 18, b = obj(f.base)[id];
    if (!inteiro(b) || b < min || b > max) return null;
    const bo = obj(R.bonus), cam = obj(bo.caminho), seq = obj(bo.sequencia), s = seqDe(f);
    const caminhoId = typeof f.caminhoId === 'string' ? f.caminhoId : '', racaId = typeof f.racaId === 'string' ? f.racaId : '';
    const principal = Object.hasOwn(obj(cam.atributo), caminhoId) && cam.atributo[caminhoId] === id;
    const rb = Object.hasOwn(obj(bo.raca), racaId) ? obj(bo.raca[racaId])[id] : 0;
    const conta = l => (Array.isArray(l) ? l.filter(x => inteiro(x) && s <= x).length : 0);
    const bonus = (principal && inteiro(cam.valor) ? cam.valor : 0) + (inteiro(rb) ? rb : 0) + conta(seq.todos) + (principal ? conta(seq.principal) : 0);
    return R.total ? formula(R.total, CTX_ATR, { vars: { ATR: b + bonus } }) : b + bonus;
  }

  // a classe da ficha (ficha.classeId entre as classes das regras) ou null
  function classeDe(regras, ficha) {
    const id = obj(ficha).classeId, cs = Array.isArray(obj(regras).classes) ? regras.classes : [];
    return typeof id === 'string' && id ? cs.find(c => obj(c).id === id) || null : null;
  }
  // o nível que a XP alcança na tabela (progressão por nível); 1 quando as regras não usam nível
  function nivelPorXp(regras, xp) {
    const p = obj(obj(regras).progressao), t = Array.isArray(p.xp) ? p.xp : [];
    if (p.tipo !== 'nivel' || !inteiro(xp)) return 1;
    let n = 0; for (let k = 0; k < t.length && k < 20; k++) if (inteiro(t[k]) && xp >= t[k]) n = k + 1;
    return Math.max(1, n);
  }

  // { attrs: {id: total}, mods: {id: mod}, maximos: {recurso: max|null} } — atributo não rolado não aparece;
  // recurso com "so" (mana/furia/energia) só aparece para a ficha cuja classe usa aquele recurso. DV = dado de vida da classe.
  function calcular(regras, ficha) {
    const R = regras || LOTM, f = obj(ficha), attrs = {}, mods = {}, maximos = {}, cl = classeDe(R, f);
    const vars = { SEQ: seqDe(f), NIVEL: nivelDe(f), DV: cl && inteiro(cl.dv) ? cl.dv : null };
    for (const a of R.atributos) {
      const t = totalDe(R, f, a.id);
      if (t == null) continue;
      attrs[a.id] = t; mods[a.id] = Math.max(-30, Math.min(30, modDe(R, t))); vars[a.abrev] = t;
    }
    const nomes = R.atributos.map(a => a.abrev).concat(['SEQ', 'NIVEL', 'DV']);
    for (const r of R.recursos || []) {
      if (r.so != null && !(cl && cl.recurso === r.so)) continue;
      maximos[r.id] = formula(r.max, { nomes, mod: true, dados: false }, { vars, modDe: v => modDe(R, v) });
    }
    return { attrs, mods, maximos };
  }
  // o modificador de UM atributo, para a rolagem (0 se não rolado, como antes)
  function modificador(regras, ficha, id) { const m = calcular(regras, ficha).mods[id]; return m == null ? 0 : m; }

  // ---------- validação do JSON de regras (o banco recusa o mesmo, com a mesma posição) ----------
  function validar(regras) {
    const erros = [], R = obj(regras), add = (campo, erro, pos) => erros.push(pos ? { campo, pos, erro } : { campo, erro });
    const ats = Array.isArray(R.atributos) ? R.atributos : null;
    if (!ats || ats.length < 1 || ats.length > 12) { add('atributos', 'de 1 a 12 atributos'); return erros; }
    const ids = [], abrevs = [];
    ats.forEach((a, k) => {
      const x = obj(a);
      if (typeof x.id !== 'string' || !/^[a-z_]{1,12}$/.test(x.id) || ids.includes(x.id)) add(`atributos[${k}].id`, 'id: de 1 a 12 letras minúsculas, sem repetir');
      if (typeof x.abrev !== 'string' || !/^[A-Z]{2,4}$/.test(x.abrev) || abrevs.includes(x.abrev) || RESERVADOS.includes(x.abrev)) add(`atributos[${k}].abrev`, 'abreviação: de 2 a 4 letras maiúsculas, sem repetir nem usar nome reservado');
      if (typeof x.nome !== 'string' || x.nome.length < 1 || x.nome.length > 30) add(`atributos[${k}].nome`, 'nome: de 1 a 30 letras');
      ids.push(x.id); abrevs.push(x.abrev);
    });
    const g = obj(R.geracao);
    if (!inteiro(g.min) || !inteiro(g.max) || g.min < 1 || g.max > 100 || g.min > g.max) add('geracao', 'min e max inteiros de 1 a 100 (min <= max)');
    const f1 = (campo, texto, ctx) => { const e = checar(texto, ctx); if (e) add(campo, e.erro, e.pos); };
    f1('modificador', R.modificador, CTX_ATR);
    if (R.total != null) f1('total', R.total, CTX_ATR);
    const bo = obj(R.bonus), cam = obj(bo.caminho), seq = obj(bo.sequencia);
    if (bo.caminho != null && (!inteiro(cam.valor) || cam.valor < -10 || cam.valor > 10 || !Object.values(obj(cam.atributo)).every(v => ids.includes(v)))) add('bonus.caminho', 'valor de -10 a 10 e atributos que existem');
    if (bo.raca != null && !Object.values(obj(bo.raca)).every(r => Object.entries(obj(r)).every(([k, v]) => ids.includes(k) && inteiro(v) && v >= -10 && v <= 10))) add('bonus.raca', 'bônus de -10 a 10 em atributos que existem');
    if (bo.sequencia != null && !['principal', 'todos'].every(k => seq[k] == null || (Array.isArray(seq[k]) && seq[k].length <= 10 && seq[k].every(x => inteiro(x) && x >= 0 && x <= 9)))) add('bonus.sequencia', 'listas de até 10 limites de 0 a 9');
    const rs = R.recursos == null ? [] : R.recursos;
    if (!Array.isArray(rs) || rs.length > 12) add('recursos', 'até 12 recursos');
    else {
      const nomes = abrevs.concat(['SEQ', 'NIVEL', 'DV']), rids = [];
      rs.forEach((r, k) => {
        const x = obj(r);
        if (typeof x.id !== 'string' || !/^[a-z_]{1,12}$/.test(x.id) || rids.includes(x.id)) add(`recursos[${k}].id`, 'id: de 1 a 12 letras minúsculas, sem repetir');
        rids.push(x.id);
        f1(`recursos[${k}].max`, x.max, { nomes, mod: true, dados: false });
        if (x.so != null && !RECURSOS_CLASSE.includes(x.so)) add(`recursos[${k}].so`, 'recurso de classe: mana, furia ou energia');
      });
    }
    // progressão por nível: a tabela de XP acumulada (20 valores crescentes, começando em 0)
    const pg = obj(R.progressao);
    if (pg.tipo === 'nivel' && !(Array.isArray(pg.xp) && pg.xp.length === 20 && pg.xp[0] === 0 && pg.xp.every((x, k) => inteiro(x) && x <= 1000000 && (k === 0 || x > pg.xp[k - 1])))) add('progressao.xp', 'tabela de XP: 20 valores inteiros crescentes, começando em 0 (até 1000000)');
    // classes (opcionais): papel, recurso de classe, atributo principal e dado de vida
    const cs = R.classes == null ? [] : R.classes;
    if (!Array.isArray(cs) || cs.length > 12) add('classes', 'até 12 classes');
    else {
      const cids = [];
      cs.forEach((c, k) => {
        const x = obj(c);
        if (typeof x.id !== 'string' || !/^[a-z_]{1,12}$/.test(x.id) || cids.includes(x.id)) add(`classes[${k}].id`, 'id: de 1 a 12 letras minúsculas, sem repetir');
        cids.push(x.id);
        if (typeof x.nome !== 'string' || x.nome.length < 1 || x.nome.length > 30) add(`classes[${k}].nome`, 'nome: de 1 a 30 letras');
        if (!PAPEIS.includes(x.papel)) add(`classes[${k}].papel`, 'papel: tanque, cura, dano ou suporte');
        if (!RECURSOS_CLASSE.includes(x.recurso)) add(`classes[${k}].recurso`, 'recurso de classe: mana, furia ou energia');
        if (!ids.includes(x.principal)) add(`classes[${k}].principal`, 'atributo principal: um atributo que existe');
        if (!inteiro(x.dv) || x.dv < 4 || x.dv > 20) add(`classes[${k}].dv`, 'dado de vida: inteiro de 4 a 20');
        if (x.desc != null && (typeof x.desc !== 'string' || x.desc.length > 200)) add(`classes[${k}].desc`, 'descrição: até 200 letras');
      });
    }
    return erros;
  }

  return { LOTM, AVENTURA, PAPEIS, RECURSOS_CLASSE, ErroFormula, tokens, analisar, avaliar, formula, checar, calcular, modificador, validar, classeDe, nivelPorXp };
})());
if (typeof module === 'object' && module) module.exports = Regras;
