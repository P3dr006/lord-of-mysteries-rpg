// Papéis, recursos de classe e nível (Fase C1 de docs/SISTEMAS-DA-MESA.md, modo MMO).
// Emblemas desenhados aqui (SVG original, viewBox 24): escudo (tanque), cálice (cura), lâmina (dano), estandarte (suporte);
// cristal (mana), chama (fúria), raio (energia). Usado no site (assistente, aba Testes, cerimônia) e no Grimório.
// Nada de barra de progresso: a XP é uma corrente de elos que acendem.
'use strict';
const Papeis = Object.freeze((() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PAPEL = Object.freeze({
    tanque: { nome: 'Tanque', cor: '#d9a441', faz: 'Protege o grupo e atrai os golpes',
      g: '<path d="M12 2.6l7.4 2.9v6.1c0 4.9-3.3 8.3-7.4 9.8-4.1-1.5-7.4-4.9-7.4-9.8V5.5z"/><path d="M12 6.2v11.4M7.6 10.6h8.8"/><path d="M8.6 5.9L12 4.6l3.4 1.3"/>' },
    cura: { nome: 'Cura', cor: '#5fd0a0', faz: 'Recupera o grupo e devolve o fôlego',
      g: '<path d="M5.6 3.2h12.8c0 5.3-2.7 8.4-6.4 8.4S5.6 8.5 5.6 3.2z"/><path d="M12 11.6v5.6M8.2 21h7.6M9.6 17.2h4.8"/><path d="M12 4.8v3.6M10.2 6.6h3.6"/>' },
    dano: { nome: 'Dano', cor: '#e05a5a', faz: 'Derruba os inimigos, de perto ou à distância',
      g: '<path d="M20.6 3.4L10.2 13.8l-1.9-1.9L18.7 1.5z" transform="translate(-.2 .9)"/><path d="M6.2 12.6l5.2 5.2"/><path d="M8.8 15.2l-4.6 4.6"/><path d="M2.9 18.9l2.2 2.2"/>' },
    suporte: { nome: 'Suporte', cor: '#9b7bff', faz: 'Fortalece os aliados e atrapalha os inimigos',
      g: '<path d="M6.2 3v18.4"/><path d="M6.2 4.4h12.2l-3 3.8 3 3.8H6.2"/><circle cx="6.2" cy="2.4" r="1.1"/><path d="M9.6 8.2l1.6 1.1 1.6-1.1"/><path d="M4.2 21.4h4"/>' },
  });
  const RECURSO = Object.freeze({
    mana: { nome: 'Mana', cor: '#5b8cff', faz: 'regenera devagar',
      g: '<path d="M12 2.4l5.2 7.2L12 21.6 6.8 9.6z"/><path d="M6.8 9.6h10.4M12 2.4v19.2M9.4 6l5.2 0"/>' },
    furia: { nome: 'Fúria', cor: '#e0652a', faz: 'sobe ao bater e apanhar',
      g: '<path d="M12 21.6c-3.9 0-6.4-2.7-6.4-6.2 0-3.4 2.9-5.1 3.4-8.8 2 1.5 3 3.4 3 5.4.9-1 1.4-2.4 1.4-3.9 3 2.5 5 4.9 5 7.3 0 3.5-2.5 6.2-6.4 6.2z"/><path d="M12 21.6c-1.6 0-2.6-1.1-2.6-2.7 0-1.5 1.3-2.5 2.6-4.3 1.3 1.8 2.6 2.8 2.6 4.3 0 1.6-1 2.7-2.6 2.7z"/>' },
    energia: { nome: 'Energia', cor: '#e8c84a', faz: 'volta rápido, mas acaba logo',
      g: '<path d="M13.6 2.4L5.6 13.4h6l-1 8.2 8-11h-6z"/>' },
  });
  const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  // medalhão com aro duplo e 12 marcas, o glifo no centro; a cor vem de --pc (ou da cor do papel/recurso)
  function medalhao(g, cor, tam, classe) {
    const marcas = Array.from({ length: 12 }, (_, k) => { const a = (k * 30 * Math.PI) / 180, r1 = 21.2, r2 = k % 3 ? 22.6 : 23.4; return `M${(24 + r1 * Math.sin(a)).toFixed(2)} ${(24 - r1 * Math.cos(a)).toFixed(2)}L${(24 + r2 * Math.sin(a)).toFixed(2)} ${(24 - r2 * Math.cos(a)).toFixed(2)}`; }).join('');
    return `<svg class="pp-med ${classe || ''}" viewBox="0 0 48 48" width="${tam}" height="${tam}" aria-hidden="true" focusable="false" style="--pc:${esc(cor)}">
      <circle class="pp-fundo" cx="24" cy="24" r="20"/><circle class="pp-aro" cx="24" cy="24" r="20"/><circle class="pp-aro2" cx="24" cy="24" r="17.2"/><path class="pp-marcas" d="${marcas}"/>
      <g class="pp-g" transform="translate(11.4 11.4) scale(1.05)">${g}</g></svg>`;
  }
  const emblema = (papel, tam = 40) => { const p = PAPEL[papel]; return p ? medalhao(p.g, p.cor, tam, 'pp-' + papel) : ''; };
  const runa = (recurso, tam = 22) => { const r = RECURSO[recurso]; return r ? medalhao(r.g, r.cor, tam, 'pp-runa pp-' + recurso) : ''; };
  const glifo = (recurso, tam = 16) => { const r = RECURSO[recurso] || PAPEL[recurso]; return r ? `<svg class="pp-gl" viewBox="0 0 24 24" width="${tam}" height="${tam}" aria-hidden="true" focusable="false">${r.g}</svg>` : ''; };

  // a XP dentro do nível: quanto já foi (de, até) — null no nível máximo
  function trecho(regras, xp, nivel) {
    const t = (regras && regras.progressao && Array.isArray(regras.progressao.xp)) ? regras.progressao.xp : [];
    const n = Math.max(1, Math.min(20, nivel || 1)), de = t[n - 1] ?? 0, ate = n < 20 ? t[n] : null;
    if (ate == null) return { de, ate: null, frac: 1, falta: 0 };
    const x = Math.max(de, Math.min(ate, xp || 0));
    return { de, ate, frac: ate > de ? (x - de) / (ate - de) : 1, falta: Math.max(0, ate - (xp || 0)) };
  }
  // corrente de elos: os elos acendem conforme a XP do nível (o último acende pela metade no meio do caminho)
  function corrente(regras, xp, nivel, elos = 10) {
    const t = trecho(regras, xp, nivel), acesos = t.frac * elos;
    const rot = t.ate == null ? `Nível ${nivel}: o máximo` : `${xp} de ${t.ate} XP para o nível ${nivel + 1} (faltam ${t.falta})`;
    return `<span class="pp-corrente" role="img" aria-label="${esc(rot)}">${Array.from({ length: elos }, (_, k) => `<i class="pp-elo${k < Math.floor(acesos) ? ' on' : k < acesos ? ' meio' : ''}"></i>`).join('')}</span>`;
  }

  return { PAPEL, RECURSO, ROMANOS, emblema, runa, glifo, corrente, trecho };
})());
if (typeof module === 'object' && module) module.exports = Papeis;
