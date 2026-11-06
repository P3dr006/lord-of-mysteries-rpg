function novoPersonagem() {
  return {
    versao: 1,
    step: 0,
    nome: '', jogador: '', idade: '', genero: '', aparencia: '', historia: '',
    attrs: {},            // { key: { dados:[4], total } }
    relanceUsado: false,
    retrato: null, retratoEstilo: 'natural',
    mesa: { lados: 20, qtd: 1, mod: 0, modo: 'normal' }, historico: [],
    sequencia: 9, digestao: 0, nomesSeq: {},
    caminho: null,
    raca: null, origem: null,
    traco: null, artefato: null,
    pv: null, san: null,
    habilidades: [],          // [{nome, desc}] anotadas pelo jogador (as do Caminho vêm de CAMINHOS)
    notas: ''
  };
}

// ---------- Validação ----------
// Tudo que vem de fora (armazenamento, arquivo importado, versão antiga) passa por aqui antes de virar o personagem.
// Campo inválido volta ao padrão; nada que sobrar pode quebrar a tela. Retorna sempre um personagem válido.
const _objeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function _inteiro(v, min, max, padrao) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return padrao;
  const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : padrao;
}
function _texto(v, max) { return (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').slice(0, max); }

// primeiro passo que ainda falta preencher (0 = Identidade … 5 = Ficha)
function primeiroIncompleto(p) {
  if (!p.nome.trim()) return 0;
  if (!ATTRS.every(a => p.attrs[a.key])) return 1;
  if (!p.caminho) return 2;
  if (!p.raca || !p.origem) return 3;
  if (p.traco === null || p.artefato === null) return 4;
  return 5;
}

function sanear(bruto) {
  const r = _objeto(bruto) ? bruto : {}, p = novoPersonagem();
  p.nome = _texto(r.nome, 80); p.jogador = _texto(r.jogador, 80); p.idade = _texto(r.idade, 20); p.genero = _texto(r.genero, 40);
  p.aparencia = _texto(r.aparencia, 2000); p.historia = _texto(r.historia, 8000); p.notas = _texto(r.notas, 20000);
  p.sequencia = _inteiro(r.sequencia, 0, 9, 9);
  p.digestao = _inteiro(r.digestao, 0, typeof DIG_MAX === 'number' ? DIG_MAX : 10, 0);
  p.relanceUsado = r.relanceUsado === true;
  p.caminho = typeof r.caminho === 'string' && caminhoPorId(r.caminho) ? r.caminho : null;
  p.raca = typeof r.raca === 'string' && racaPorId(r.raca) ? r.raca : null;
  p.origem = typeof r.origem === 'string' && origemPorId(r.origem) ? r.origem : null;
  p.traco = _inteiro(r.traco, 0, TRACOS.length - 1, null);
  p.artefato = _inteiro(r.artefato, 0, ARTEFATOS.length - 1, null);
  // atributos: precisam ter 4 dados de 1 a 6. O total salvo é mantido quando é plausível (3 a 18, o intervalo de 4d6 sem o menor);
  // só se estiver ilegível ele é recalculado a partir dos dados.
  if (_objeto(r.attrs)) ATTRS.forEach(a => {
    const x = r.attrs[a.key]; if (!_objeto(x) || !Array.isArray(x.dados) || x.dados.length !== 4) return;
    const d = x.dados.map(v => _inteiro(v, 1, 6, 0)); if (d.some(v => !v)) return;
    const menor = d.indexOf(Math.min(...d));
    p.attrs[a.key] = { dados: d, descartado: _inteiro(x.descartado, 0, 3, menor), total: _inteiro(x.total, 3, 18, d.reduce((m, v) => m + v, 0) - d[menor]) };
  });
  p.pv = Number.isFinite(Number(r.pv)) && r.pv !== null && r.pv !== '' && typeof r.pv !== 'boolean' ? Math.max(0, Math.round(Number(r.pv))) : null;
  p.san = Number.isFinite(Number(r.san)) && r.san !== null && r.san !== '' && typeof r.san !== 'boolean' ? Math.max(0, Math.round(Number(r.san))) : null;
  if (Array.isArray(r.habilidades)) p.habilidades = r.habilidades.filter(_objeto).slice(0, 40)
    .map(h => ({ nome: _texto(h.nome, 60).trim(), desc: _texto(h.desc, 600).trim() })).filter(h => h.nome);
  p.retrato = typeof r.retrato === 'string' && r.retrato.length < 4e6 && /^data:image\/(jpeg|png|webp|gif);base64,/.test(r.retrato) ? r.retrato : null;
  p.retratoEstilo = typeof ESTILOS_RET !== 'undefined' && ESTILOS_RET.some(e => e.id === r.retratoEstilo) ? r.retratoEstilo : 'natural';
  if (_objeto(r.nomesSeq)) for (let i = 0; i <= 9; i++) { const t = _texto(r.nomesSeq[i], 60).trim(); if (t) p.nomesSeq[i] = t; }
  if (_objeto(r.mesa)) {
    if ([4, 6, 8, 10, 12, 20, 22, 100].includes(Number(r.mesa.lados))) p.mesa.lados = Number(r.mesa.lados);
    p.mesa.qtd = _inteiro(r.mesa.qtd, 1, 10, 1); p.mesa.mod = _inteiro(r.mesa.mod, -20, 20, 0);
    if (['normal', 'vantagem', 'desvantagem'].includes(r.mesa.modo)) p.mesa.modo = r.mesa.modo;
  }
  if (Array.isArray(r.historico)) p.historico = r.historico.filter(_objeto).slice(0, 30).map(h => ({
    hora: _texto(h.hora, 10), rotulo: _texto(h.rotulo, 60), detalhe: _texto(h.detalhe, 120),
    total: Number.isFinite(Number(h.total)) ? Number(h.total) : 0, res: h.res === 'crit' || h.res === 'fumble' ? h.res : null }));
  // nunca mostrar um passo cujos dados anteriores faltam (o que também cobre raças/origens que deixaram de existir)
  p.step = Math.min(_inteiro(r.step, 0, 5, 0), primeiroIncompleto(p));
  return p;
}

let P = novoPersonagem();

// ---------- Armazenamento: vários personagens ----------
// lotm-rpg-lista       -> [{id, atualizado}]            (ordem e datas)
// lotm-rpg-ativo       -> id do personagem aberto por último ("Continuar")
// lotm-rpg-p-<id>      -> JSON da ficha, sem o retrato
// lotm-rpg-r-<id>      -> retrato (base64), gravado à parte e só quando muda
// Versões antigas guardavam uma ficha só em lotm-rpg-personagem: ela é migrada sozinha para a lista.
const STORE_KEY = 'lotm-rpg-personagem', RET_KEY = 'lotm-rpg-retrato';          // legado (uma ficha só)
const K_LISTA = 'lotm-rpg-lista', K_ATIVO = 'lotm-rpg-ativo', K_P = 'lotm-rpg-p-', K_R = 'lotm-rpg-r-';
let _idAtivo = null, _retCache = { id: null, v: undefined }, _migrado = false;

const _ler = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function _lista() {
  try { const l = JSON.parse(_ler(K_LISTA) || '[]'); return Array.isArray(l) ? l.filter(x => _objeto(x) && typeof x.id === 'string') : []; }
  catch (e) { return []; }
}
function _lerSlot(id) {
  try {
    const raw = _ler(K_P + id); if (raw === null) return null;
    const obj = JSON.parse(raw); if (!_objeto(obj)) return null;
    obj.retrato = _ler(K_R + id) || obj.retrato || null;
    return sanear(obj);
  } catch (e) { return null; }
}
// grava a ficha de um id (e a registra na lista). `ativar` = vira o personagem aberto por último.
function _gravarSlot(id, p, ativar = true) {
  const { retrato, ...resto } = p;
  localStorage.setItem(K_P + id, JSON.stringify(resto));
  const r = retrato || null;
  if (_retCache.id !== id || _retCache.v !== r) {            // o retrato (dezenas de KB) só é regravado quando muda
    if (r) localStorage.setItem(K_R + id, r); else localStorage.removeItem(K_R + id);
    _retCache = { id, v: r };
  }
  const lista = _lista(), e = lista.find(x => x.id === id), agora = Date.now();
  if (e) e.atualizado = agora; else lista.push({ id, atualizado: agora });
  localStorage.setItem(K_LISTA, JSON.stringify(lista));
  if (ativar) localStorage.setItem(K_ATIVO, id);
}
function _migrar() {
  if (_migrado) return; _migrado = true;
  try {
    const raw = localStorage.getItem(STORE_KEY); if (raw === null) return;
    let obj; try { obj = JSON.parse(raw); } catch (e) { return; }          // ilegível: não mexe (a janela de recuperação mostra o texto)
    if (_objeto(obj)) { if (!obj.retrato) obj.retrato = localStorage.getItem(RET_KEY) || null; _gravarSlot(novoId(), sanear(obj)); }
    localStorage.removeItem(STORE_KEY); localStorage.removeItem(RET_KEY);
  } catch (e) {}
}

function salvar() {
  try {
    _migrar();
    if (!_idAtivo) { if (!P.nome.trim()) return true; _idAtivo = novoId(); }   // a ficha só entra na lista quando ganha um nome
    _gravarSlot(_idAtivo, P);
    return true;
  } catch (e) { return false; }
}
// ficha do personagem aberto por último (ou null); não altera o personagem em tela
function carregar() { _migrar(); const id = _ler(K_ATIVO); return id ? _lerSlot(id) : null; }
function idAtivoSalvo() { _migrar(); const id = _ler(K_ATIVO); return id && _lista().some(x => x.id === id) ? id : null; }
function idAtual() { return _idAtivo; }
// abre um personagem da lista: devolve a ficha validada, ou null se não puder ser lida
function abrirPersonagem(id) {
  _migrar(); const p = _lerSlot(id); if (!p) return null;
  _idAtivo = id; _retCache = { id, v: p.retrato || null };
  try { localStorage.setItem(K_ATIVO, id); } catch (e) {}
  return p;
}
// começa uma ficha em branco, que só será guardada quando tiver nome (o personagem anterior fica intacto)
function novoSlot() { _idAtivo = null; _retCache = { id: null, v: undefined }; P = novoPersonagem(); }
// guarda uma ficha já pronta (ex.: importada) como um personagem novo e a deixa aberta
function adicionarPersonagem(p) {
  _migrar(); const id = novoId(); _gravarSlot(id, p); _idAtivo = id; P = p; return id;
}
function listarPersonagens() {
  _migrar();
  return _lista().map(e => { const p = _lerSlot(e.id); return p ? { id: e.id, atualizado: e.atualizado || 0, p } : null; })
    .filter(Boolean).sort((a, b) => b.atualizado - a.atualizado);
}
function duplicarPersonagem(id) {
  const p = _lerSlot(id); if (!p) return null;
  p.nome = (p.nome.trim() + ' (cópia)').slice(0, 80);
  const novo = novoId(); _gravarSlot(novo, p, false); return novo;
}
function excluirPersonagem(id) {
  try {
    localStorage.removeItem(K_P + id); localStorage.removeItem(K_R + id);
    const lista = _lista().filter(x => x.id !== id); localStorage.setItem(K_LISTA, JSON.stringify(lista));
    if (_ler(K_ATIVO) === id) { const rec = lista.sort((a, b) => (b.atualizado || 0) - (a.atualizado || 0))[0]; if (rec) localStorage.setItem(K_ATIVO, rec.id); else localStorage.removeItem(K_ATIVO); }
    if (_idAtivo === id) { _idAtivo = null; _retCache = { id: null, v: undefined }; }
  } catch (e) {}
}

function importarJSON(file, cb) {
  const r = new FileReader();
  r.onerror = () => cb(false);
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      if (!_objeto(obj)) return cb(false);                     // lista, texto, número ou null não são uma ficha
      cb(sanear(obj));                                         // quem chama decide onde guardar (como um personagem novo)
    } catch (e) { cb(false); }
  };
  r.readAsText(file.slice(0, 8 * 1024 * 1024));
}

// Cálculos derivados
const mod = v => Math.floor((v - 10) / 2);
const bonusCaminho = k => { const c = P.caminho && caminhoPorId(P.caminho); return c && c.attr === k ? 2 : 0; };
const bonusRaca = k => { const r = P.raca && racaPorId(P.raca); return (r && r.bonus[k]) || 0; };
const total = k => (P.attrs[k] ? Math.max(1, P.attrs[k].total + bonusCaminho(k) + bonusRaca(k) + bonusSeq(k)) : null);
function pvMax() { const v = total('vigor'); return v == null ? 0 : 10 + mod(v) * 2 + (9 - P.sequencia) * 3; }
function espMax() { const v = total('espir'); return v == null ? 0 : 10 + mod(v) * 2 + (9 - P.sequencia) * 2; }
function sanMax() { const v = total('pres'); return v == null ? 0 : 10 + mod(v) * 2 + 5; }
