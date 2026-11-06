const STORE_KEY = 'lotm-rpg-personagem';

function novoPersonagem() {
  return {
    versao: 1,
    step: 0,
    nome: '', jogador: '', idade: '', genero: '', aparencia: '', historia: '',
    attrs: {},            // { key: { dados:[4], total } }
    relanceUsado: false,
    sequencia: 9,
    pv: null, san: null,
    notas: ''
  };
}

let P = novoPersonagem();

function salvar() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(P)); } catch (e) {}
}
function carregar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return Object.assign(novoPersonagem(), JSON.parse(raw));
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
    try { P = Object.assign(novoPersonagem(), JSON.parse(r.result)); salvar(); cb(true); }
    catch (e) { cb(false); }
  };
  r.readAsText(file);
}

// Cálculos derivados
const mod = v => Math.floor((v - 10) / 2);
const total = k => (P.attrs[k] ? P.attrs[k].total : null);
function pvMax() { const v = total('vigor'); return v == null ? 0 : 10 + mod(v) * 2 + (9 - P.sequencia) * 3; }
function espMax() { const v = total('espir'); return v == null ? 0 : 10 + mod(v) * 2 + (9 - P.sequencia) * 2; }
function sanMax() { const v = total('pres'); return v == null ? 0 : 10 + mod(v) * 2 + 5; }
