const STORE_KEY = 'lotm-rpg-personagem';

function novoPersonagem() {
  return {
    versao: 1,
    step: 0,
    nome: '', jogador: '', idade: '', genero: '', aparencia: '', historia: '',
    attrs: {},            // { key: { dados:[4], total } }
    relanceUsado: false,
    sequencia: 9, digestao: 0, nomesSeq: {},
    caminho: null,
    raca: null, origem: null,
    traco: null, artefato: null,
    pv: null, san: null,
    notas: ''
  };
}

// Remove referências a raças/origens que não existem mais (saves antigos)
function sanear(p) {
  if (p.raca && !racaPorId(p.raca)) { p.raca = null; p.step = Math.min(p.step, 3); }
  if (p.origem && !origemPorId(p.origem)) { p.origem = null; p.step = Math.min(p.step, 3); }
  return p;
}

let P = novoPersonagem();

function salvar() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(P)); } catch (e) {}
}
function carregar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return sanear(Object.assign(novoPersonagem(), JSON.parse(raw)));
  } catch (e) { return null; }
}
function exportarJSON() {
  const blob = new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (P.nome || 'personagem').replace(/\W+/g, '_') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importarJSON(file, cb) {
  const r = new FileReader();
  r.onload = () => {
    try { P = sanear(Object.assign(novoPersonagem(), JSON.parse(r.result))); salvar(); cb(true); }
    catch (e) { cb(false); }
  };
  r.readAsText(file);
}

// Cálculos derivados
const mod = v => Math.floor((v - 10) / 2);
const bonusCaminho = k => { const c = P.caminho && caminhoPorId(P.caminho); return c && c.attr === k ? 2 : 0; };
const bonusRaca = k => { const r = P.raca && racaPorId(P.raca); return (r && r.bonus[k]) || 0; };
const total = k => (P.attrs[k] ? Math.max(1, P.attrs[k].total + bonusCaminho(k) + bonusRaca(k) + bonusSeq(k)) : null);
function pvMax() { const v = total('vigor'); return v == null ? 0 : 10 + mod(v) * 2 + (9 - P.sequencia) * 3; }
function espMax() { const v = total('espir'); return v == null ? 0 : 10 + mod(v) * 2 + (9 - P.sequencia) * 2; }
function sanMax() { const v = total('pres'); return v == null ? 0 : 10 + mod(v) * 2 + 5; }
