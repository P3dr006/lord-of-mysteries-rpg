const STORE_KEY = 'lotm-rpg-personagem';

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

// O retrato (imagem em base64, dezenas de KB) fica numa chave própria e só é regravado quando muda.
// Assim, cada tecla digitada regrava só o JSON pequeno da ficha.
const RET_KEY = 'lotm-rpg-retrato';
let _retSalvo = undefined;            // último valor do retrato que está no armazenamento
function salvar() {
  try {
    const { retrato, ...resto } = P;
    localStorage.setItem(STORE_KEY, JSON.stringify(resto));
    const r = retrato || null;
    if (r !== _retSalvo) {
      if (r) localStorage.setItem(RET_KEY, r); else localStorage.removeItem(RET_KEY);
      _retSalvo = r;
    }
    return true;
  } catch (e) { return false; }
}
function carregar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw), guardado = localStorage.getItem(RET_KEY) || null;
    _retSalvo = guardado;
    if (!obj.retrato) obj.retrato = guardado;   // fichas antigas traziam o retrato dentro do JSON; a próxima gravação o move
    return sanear(obj);
  } catch (e) { return null; }
}
function importarJSON(file, cb) {
  const r = new FileReader();
  r.onerror = () => cb(false);
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      if (!_objeto(obj)) return cb(false);                     // lista, texto, número ou null não são uma ficha
      P = sanear(obj); salvar(); cb(true);
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
