// Livro de regras da mesa (Fase B de docs/SISTEMAS-DA-MESA.md).
// A aba "Regras" do Grimório mostra as regras em vigor EM PALAVRAS e abre o "Livro de regras": uma tela cheia com
// seções (Começar, Atributos, Modificador, Recursos, Caminhos, Raças, Sequência) e a prévia sempre à vista.
// O mestre não precisa escrever fórmula: preenche frases ("a cada 2 pontos acima de 10, +1") e o livro escreve a
// fórmula da mini-linguagem de js/regras.js. Quem quiser, abre o modo avançado e escreve à mão.
// Tudo é validado com Regras.validar (o mesmo que o banco) e a prévia usa Regras.calcular (o mesmo que o servidor).
// Salvar = INSERT em mesa_regras: versão nova, nada é sobrescrito.
'use strict';
const EditorRegras = Object.freeze((() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const copia = o => JSON.parse(JSON.stringify(o));
  const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}` : JSON.stringify(v));
  // tira os campos de tela (começam com _) antes de validar, comparar e salvar
  const limpo = v => (Array.isArray(v) ? v.map(limpo) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => k[0] !== '_').map(([k, x]) => [k, limpo(x)])) : v);
  const inteiro = v => Number.isInteger(v);
  const LOTM_IDS = ['forca', 'agil', 'vigor', 'intel', 'espir', 'pres'];   // pedidos.atributo só aceita estes (ver HANDOFF)
  const RESERVADOS = ['ATR', 'SEQ', 'NIVEL', 'MOD', 'MIN', 'MAX', 'FLOOR'];
  const CORES = ['#e05a6a', '#6fb4ff', '#b08cff', '#f0b35a', '#5ad0a0', '#d9b86a', '#ff7ab8', '#9aa3b8'];
  const METODOS = { '4d6-menor': '4d6, descarta o menor', '3d6': '3d6 somados' };
  const EXEMPLO = [15, 14, 13, 12, 10, 8];
  const SECOES = [['comecar', 'Começar'], ['atributos', 'Atributos'], ['modificador', 'Modificador'], ['recursos', 'Recursos'], ['caminho', 'Caminhos'], ['racas', 'Raças'], ['sequencia', 'Sequência']];
  const LISTA_CAMINHOS = () => (typeof CAMINHOS !== 'undefined' ? CAMINHOS : []);
  const LISTA_RACAS = () => (typeof RACAS !== 'undefined' ? RACAS : []);
  const sem = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const base = (nome, atributos, modificador, recursos, extra = {}) => ({ versao: 1, base: nome, atributos, geracao: { metodo: '4d6-menor', min: 3, max: 18 }, total: 'max(1, ATR)', modificador, recursos, progressao: { tipo: 'sequencia', de: 9, ate: 0 }, classes: [], habilidades: 'livres', ...extra });
  const MODELOS = [
    { id: 'lotm', nome: 'Lord of the Mysteries', desc: 'O padrão do site: seis atributos, bônus de Caminho, de raça e por Sequência; Vida, Sanidade e Espiritualidade.', regras: () => Regras.LOTM },
    { id: 'd20', nome: 'Clássico d20', desc: 'Seis atributos de 3 a 18, +1 a cada 2 pontos acima de 10, sem bônus de Caminho. Vida, Defesa e Iniciativa.',
      regras: () => base('d20', [{ id: 'forca', nome: 'Força', abrev: 'FOR' }, { id: 'agil', nome: 'Destreza', abrev: 'DES' }, { id: 'vigor', nome: 'Constituição', abrev: 'CON' }, { id: 'intel', nome: 'Inteligência', abrev: 'INT' }, { id: 'espir', nome: 'Sabedoria', abrev: 'SAB' }, { id: 'pres', nome: 'Carisma', abrev: 'CAR' }], 'floor((ATR - 10) / 2)',
        [{ id: 'pv', nome: 'Pontos de Vida', max: '10 + mod(CON) * 2', cor: '#e05a6a' }, { id: 'defesa', nome: 'Defesa', max: '10 + mod(DES)', cor: '#9aa3b8' }, { id: 'inic', nome: 'Iniciativa', max: 'mod(DES)', cor: '#f0b35a' }]) },
    { id: 'simples', nome: 'Simples', desc: 'Três atributos (Corpo, Mente, Alma), +1 a cada 3 pontos acima de 10. Bom para uma sessão rápida.',
      regras: () => base('simples', [{ id: 'forca', nome: 'Corpo', abrev: 'COR' }, { id: 'intel', nome: 'Mente', abrev: 'MEN' }, { id: 'espir', nome: 'Alma', abrev: 'ALM' }], 'floor((ATR - 10) / 3)',
        [{ id: 'pv', nome: 'Vida', max: '10 + mod(COR) * 3', cor: '#e05a6a' }, { id: 'foco', nome: 'Foco', max: '5 + mod(MEN) * 2', cor: '#6fb4ff' }]) },
  ];
  // recursos prontos: o atributo preferido (id do LotM) vira a abreviação que existir na regra
  const RAPIDOS = [
    { nome: 'Vida', id: 'pv', pref: 'vigor', b: 10, m: 2, s: 0, cor: '#e05a6a' }, { nome: 'Sanidade', id: 'san', pref: 'pres', b: 10, m: 2, s: 0, cor: '#6fb4ff' },
    { nome: 'Mana', id: 'mana', pref: 'intel', b: 10, m: 2, s: 0, cor: '#b08cff' }, { nome: 'Defesa', id: 'defesa', pref: 'agil', b: 10, m: 1, s: 0, cor: '#9aa3b8' },
    { nome: 'Iniciativa', id: 'inic', pref: 'agil', b: 0, m: 1, s: 0, cor: '#f0b35a' }, { nome: 'Vazio', id: 'novo', pref: '', b: 10, m: 0, s: 0, cor: '#5ad0a0' },
  ];

  let C = null;            // contexto do painel: { raiz, mesaId, confirmar, anunciar, jogadores() }
  let versoes = [];        // [{ versao, regras, criado_em }] da mais nova para a mais velha
  let R = null;            // as regras sendo editadas (com campos de tela _*)
  let partida = null;      // de onde o livro partiu (para "desfazer" e para saber se mudou)
  let nomePartida = '';
  let secao = 'comecar';
  let modoMod = 'frase', modoTot = 'frase';
  let livro = null;        // o elemento da tela cheia
  let antesDoLivro = null;
  let errosAtuais = [];

  const $ = s => (livro ? livro.querySelector(s) : null);
  const vigor = () => (versoes[0] ? versoes[0].regras : Regras.LOTM);
  const nomeVigor = () => (versoes[0] ? `versão ${versoes[0].versao}` : 'predefinição Lord of the Mysteries');
  const mudou = () => !!R && canon(limpo(R)) !== canon(limpo(partida));
  const nomeAtr = abrev => { const a = (R || vigor()).atributos.find(x => x.abrev === abrev); return a ? a.nome || a.abrev : abrev; };

  // ---------- frases <-> fórmulas ----------
  // modificador: "a cada P pontos acima de B, +1"   floor((ATR - B) / P)  ·  ATR - B  ·  0
  function lerMod(t) {
    const s = String(t || '').replace(/\s+/g, '').toUpperCase();
    let m = /^FLOOR\(\(ATR-(\d{1,3})\)\/(\d{1,2})\)$/.exec(s); if (m && +m[2] >= 1) return { tipo: 'degraus', ref: +m[1], passo: +m[2] };
    m = /^ATR-(\d{1,3})$/.exec(s); if (m) return { tipo: 'degraus', ref: +m[1], passo: 1 };
    if (s === 'ATR') return { tipo: 'degraus', ref: 0, passo: 1 };
    if (s === '0') return { tipo: 'nenhum' };
    return null;
  }
  const escreverMod = p => (p.tipo === 'nenhum' ? '0' : p.passo === 1 ? (p.ref ? `ATR - ${p.ref}` : 'ATR') : `floor((ATR - ${p.ref}) / ${p.passo})`);
  function fraseMod(t) {
    const p = lerMod(t); if (!p) return `fórmula própria: ${t}`;
    if (p.tipo === 'nenhum') return 'nenhum: os testes usam só o dado';
    return p.passo === 1 ? `o atributo menos ${p.ref} (cada ponto conta)` : `+1 a cada ${p.passo} pontos acima de ${p.ref} (e −1 a cada ${p.passo} abaixo)`;
  }
  // total: "nunca abaixo de N"   max(N, ATR)  ·  (vazio)
  function lerTot(t) {
    if (t == null || String(t).trim() === '' || String(t).replace(/\s+/g, '').toUpperCase() === 'ATR') return { piso: null };
    const m = /^MAX\((\d{1,3}),ATR\)$|^MAX\(ATR,(\d{1,3})\)$/.exec(String(t).replace(/\s+/g, '').toUpperCase());
    return m ? { piso: +(m[1] || m[2]) } : null;
  }
  // recurso: "começa com B + M × (modificador|valor) de X + S por Sequência avançada"
  function lerRc(t, ats) {
    const s = String(t || '').replace(/\s+/g, '').toUpperCase();
    const m = /^(\d{1,4})?(?:(?:^|\+)(?:MOD\(([A-Z]{2,4})\)|([A-Z]{2,4}))(?:\*(\d{1,3}))?)?(?:\+\(9-SEQ\)\*(\d{1,3}))?(?:\+(\d{1,4}))?$/.exec(s);
    if (!m || !s) return null;
    const ab = m[2] || m[3] || '';
    if (ab && (!ats.some(a => a.abrev === ab) || RESERVADOS.includes(ab))) return null;
    return { b: (+m[1] || 0) + (+m[6] || 0), atr: ab, tipo: m[3] ? 'valor' : 'mod', m: ab ? (m[4] ? +m[4] : 1) : 0, s: m[5] ? +m[5] : 0 };
  }
  function escreverRc(p) {
    const partes = [];
    if (p.b || ((!p.atr || !p.m) && !p.s)) partes.push(String(p.b || 0));
    if (p.atr && p.m) partes.push((p.tipo === 'valor' ? p.atr : `mod(${p.atr})`) + (p.m !== 1 ? ` * ${p.m}` : ''));
    if (p.s) partes.push(`(9 - SEQ) * ${p.s}`);
    return partes.join(' + ');
  }
  function fraseRc(r, ats) {
    const p = lerRc(r.max, ats); if (!p) return `fórmula própria: ${r.max}`;
    const t = [String(p.b)];
    if (p.atr && p.m) t.push(`${p.m === 1 ? '' : p.m + ' × '}${p.tipo === 'valor' ? 'o valor' : 'o modificador'} de ${nomeAtr(p.atr)}`);
    if (p.s) t.push(`${p.s} por Sequência avançada`);
    return t.join(' + ');
  }

  // ---------- a aba (resumo em palavras) ----------
  function secaoHTML() {
    return `<section class="m-cartao er" aria-labelledby="t-regras"><h2 id="t-regras">Regras da mesa <small class="er-vigor" id="er-vigor">…</small></h2>
      <p class="hint">O sistema que vale nos testes desta mesa. Mudar cria uma <b>versão nova</b>; as antigas ficam guardadas.</p>
      <div id="er-resumo" class="er-resumo"><p class="hint">Abrindo as regras…</p></div>
      <div class="m-acoes"><button type="button" class="primary er-abrir" id="er-abrir" data-ic="livro">Abrir o livro de regras</button></div>
      <p class="m-erro" id="m-erro-regras" role="alert" hidden></p>
    </section>`;
  }
  function desenharResumo() {
    const caixa = C.raiz.querySelector('#er-resumo'); if (!caixa) return;
    const V = vigor(), bo = V.bonus || {}, ats = V.atributos || [];
    const bonus = [bo.caminho && `de Caminho (${sinal(bo.caminho.valor)} no atributo do Caminho)`, bo.raca && 'de raça', bo.sequencia && 'por Sequência'].filter(Boolean);
    caixa.innerHTML = `<dl class="er-dl">
      <div><dt>Atributos</dt><dd>${ats.map(a => `<span class="er-tag">${esc(a.nome)} <b>${esc(a.abrev)}</b></span>`).join(' ')}</dd></div>
      <div><dt>Rolagem</dt><dd>de ${esc(V.geracao && V.geracao.min)} a ${esc(V.geracao && V.geracao.max)} (${esc(METODOS[V.geracao && V.geracao.metodo] || (V.geracao && V.geracao.metodo) || '')})</dd></div>
      <div><dt>Modificador</dt><dd>${esc(fraseMod(V.modificador))}</dd></div>
      ${(V.recursos || []).map(r => `<div><dt><i class="er-pingo" style="--rc:${esc(r.cor || '#9aa3b8')}"></i>${esc(r.nome || r.id)}</dt><dd>${esc(fraseRc(r, ats))}</dd></div>`).join('')}
      <div><dt>Bônus</dt><dd>${bonus.length ? esc(bonus.join(', ')) : 'nenhum'}</dd></div></dl>`;
    C.raiz.querySelector('#er-vigor').textContent = 'em vigor: ' + nomeVigor();
  }

  async function buscar() {
    try {
      const r = await (await Rede.tabela('mestre', 'mesa_regras')).select('versao,regras,criado_em').eq('mesa_id', C.mesaId).order('versao', { ascending: false }).limit(100);
      if (r.error) throw r.error; versoes = r.data || [];
      const el = C.raiz.querySelector('#m-erro-regras'); if (el && !el.classList.contains('m-ok')) el.hidden = true;
    } catch (e) { const el = C.raiz.querySelector('#m-erro-regras'); if (el) { el.classList.remove('m-ok'); el.textContent = Rede.mensagem(e); el.hidden = false; } }
    desenharResumo();
  }

  // ---------- o livro (tela cheia) ----------
  function abrirLivro(gatilho) {
    if (livro) return;
    antesDoLivro = gatilho || document.activeElement;
    carregarNoLivro(copia(vigor()), nomeVigor());
    livro = document.createElement('div'); livro.className = 'm-ficha-fundo er-livro-fundo';
    livro.innerHTML = `<section class="er-livro" role="dialog" aria-modal="true" aria-labelledby="erl-t">
      <div class="er-l-cab"><div><h2 id="erl-t">Livro de regras</h2><p class="er-l-sub" id="erl-sub"></p></div>
        <div class="er-l-acoes"><span class="er-l-estado" id="er-estado" role="status"></span>
          <button type="button" class="ghost" id="er-desfazer">Desfazer</button>
          <button type="button" class="primary" id="er-salvar" data-ic="estrela">Salvar</button>
          <button type="button" class="ghost er-fechar" id="er-fechar" aria-label="Fechar o livro de regras">✕</button></div></div>
      <nav class="er-l-nav" role="tablist" aria-label="Seções do livro de regras">${SECOES.map(([id, nome]) => `<button type="button" role="tab" class="er-b er-l-aba" id="erl-a-${id}" data-sec="${id}" aria-controls="erl-sec" aria-selected="false" tabindex="-1"><span>${esc(nome)}</span><b class="er-l-n" hidden></b></button>`).join('')}</nav>
      <div class="er-l-corpo"><div class="er-l-sec" id="erl-sec" role="tabpanel" tabindex="-1"></div>
        <aside class="er-l-previa" aria-labelledby="t-er-previa"><h3 id="t-er-previa">Prévia</h3>
          <div class="m-grade er-p-esc"><div class="m-campo"><label for="er-ficha">Ficha</label><select id="er-ficha"></select></div>
            <div class="m-campo"><label for="er-seq">Sequência</label><select id="er-seq">${[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(s => `<option value="${s}" ${s === 7 ? 'selected' : ''}>Sequência ${s}</option>`).join('')}</select></div></div>
          <div id="er-resultado" class="er-resultado" aria-live="polite"></div>
          <div id="er-erros" class="er-erros" hidden></div><ul id="er-avisos" class="er-avisos" hidden></ul>
          <p class="m-erro" id="er-msg" role="alert" hidden></p></aside></div>
    </section>`;
    document.body.appendChild(livro); document.body.classList.add('er-livro-aberto');
    ligarLivro(); preencherFichas(); irPara('comecar', false);
    $('#erl-a-' + secao).focus();
  }
  async function fecharLivro(perguntar = true) {
    if (!livro) return;
    if (perguntar && mudou() && !(await C.confirmar({ titulo: 'Fechar sem salvar?', texto: 'O que você mudou no livro de regras será perdido.', botao: 'Fechar sem salvar', perigo: true }))) return;
    livro.remove(); livro = null; document.body.classList.remove('er-livro-aberto');
    if (antesDoLivro && antesDoLivro.isConnected) antesDoLivro.focus();
  }
  function carregarNoLivro(regras, nome) {
    R = copia(regras); partida = copia(regras); nomePartida = nome;
    modoMod = lerMod(R.modificador) ? 'frase' : 'avancado'; modoTot = lerTot(R.total) ? 'frase' : 'avancado';
    (R.recursos || []).forEach(r => { r._modo = lerRc(r.max, R.atributos) ? 'frase' : 'avancado'; });
  }
  async function trocarPara(regras, nome) {
    if (mudou() && !(await C.confirmar({ titulo: 'Trocar as regras do livro?', texto: 'O que você mudou e não salvou será perdido.', botao: 'Trocar' }))) return false;
    carregarNoLivro(regras, nome); irPara('atributos', true); C.anunciar(`Livro aberto em: ${nome}`); return true;
  }

  function irPara(id, foco) {
    secao = id;
    livro.querySelectorAll('.er-l-aba').forEach(b => { const on = b.dataset.sec === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    const sec = $('#erl-sec'); sec.setAttribute('aria-labelledby', 'erl-a-' + id);
    sec.innerHTML = ({ comecar: secComecar, atributos: secAtributos, modificador: secModificador, recursos: secRecursos, caminho: secCaminho, racas: secRacas, sequencia: secSequencia })[id]();
    sec.scrollTop = 0;
    if (foco === true) sec.focus({ preventScroll: true }); else if (typeof foco === 'string') { const el = $(foco); if (el) el.focus(); }
    atualizar();
  }

  // ---------- seções ----------
  const ajuda = t => `<p class="er-ajuda">${t}</p>`;
  const num = (k, v, min, max, rot, extra = '') => `<input type="number" data-k="${k}" value="${esc(v)}" min="${min}" max="${max}" inputmode="numeric" aria-label="${esc(rot)}" class="er-num" ${extra}>`;
  function selAtr(k, valor, rot, vazio) {
    return `<select data-k="${k}" aria-label="${esc(rot)}">${vazio ? `<option value="">${esc(vazio)}</option>` : ''}${R.atributos.map(a => `<option value="${esc(a.abrev)}" ${a.abrev === valor ? 'selected' : ''}>${esc(a.nome || a.abrev)}</option>`).join('')}</select>`;
  }

  function secComecar() {
    const data = t => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    return `<h3 class="er-s-t">Por onde começar</h3>
      ${ajuda(`O livro está aberto em: <b>${esc(nomePartida)}</b>. Escolha um modelo pronto ou uma versão salva e depois ajuste nas outras seções.`)}
      <h4 class="er-s-sub">Modelos prontos</h4>
      <ul class="er-cartas">${MODELOS.map(m => `<li><button type="button" class="er-b er-carta" data-modelo="${m.id}"><b>${esc(m.nome)}</b><span>${esc(m.desc)}</span></button></li>`).join('')}</ul>
      <h4 class="er-s-sub">Versões desta mesa</h4>
      ${versoes.length ? `<ul class="er-cartas er-versoes">${versoes.map((v, i) => `<li><button type="button" class="er-b er-carta ${i === 0 ? 'vigor' : ''}" data-versao="${v.versao}"><b>Versão ${v.versao}${i === 0 ? ' <em>em vigor</em>' : ''}</b><span>${esc(data(v.criado_em))} · ${(v.regras.atributos || []).length} atributos · ${(v.regras.recursos || []).length} recursos</span><span>Modificador: ${esc(fraseMod(v.regras.modificador))}</span></button></li>`).join('')}</ul>` : ajuda('Nenhuma ainda: a mesa usa o padrão Lord of the Mysteries até você salvar a primeira.')}`;
  }

  function secAtributos() {
    const g = R.geracao || {}, met = Object.hasOwn(METODOS, g.metodo) ? METODOS : { ...METODOS, [g.metodo]: String(g.metodo) };
    return `<h3 class="er-s-t">Atributos</h3>
      ${ajuda('O nome aparece nas fichas; a <b>abreviação</b> (2 a 4 letras) é como o atributo aparece nas contas. Até 12 atributos.')}
      <ol class="er-ats">${R.atributos.map((a, k) => `<li class="er-at" data-at="${k}">
        <label class="er-mini"><span>Nome</span><input type="text" data-k="at-nome:${k}" value="${esc(a.nome)}" maxlength="30" autocomplete="off" aria-label="Nome do atributo ${k + 1}"></label>
        <label class="er-mini er-ab"><span>Abreviação</span><input type="text" data-k="at-abrev:${k}" value="${esc(a.abrev)}" maxlength="4" autocomplete="off" spellcheck="false" aria-label="Abreviação do atributo ${k + 1}"></label>
        <span class="er-at-info">${LOTM_IDS.includes(a.id) ? '' : '<i class="er-novo" title="Atributo novo: ainda não pode ser pedido em teste">novo</i>'}</span>
        <button type="button" class="link-remover" data-tirar-at="${k}" ${R.atributos.length <= 1 ? 'disabled' : ''}>Tirar<span class="sr-only"> ${esc(a.nome || 'atributo ' + (k + 1))}</span></button></li>`).join('')}</ol>
      <button type="button" class="ghost er-mais" id="er-mais-at" ${R.atributos.length >= 12 ? 'disabled' : ''}>+ Atributo</button>
      <h4 class="er-s-sub">Rolagem dos atributos</h4>
      <p class="er-frase">Cada atributo é rolado com ${`<select data-k="ger-metodo" aria-label="Método de rolagem">${Object.entries(met).map(([k, v]) => `<option value="${esc(k)}" ${k === g.metodo ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`} e vale de ${num('ger-min', g.min, 1, 100, 'Valor mínimo')} a ${num('ger-max', g.max, 1, 100, 'Valor máximo')}.</p>
      ${ajuda('Hoje o site rola 4d6 (de 3 a 18). Uma faixa menor deixa de fora as rolagens que caírem fora dela (o atributo fica sem modificador).')}`;
  }

  function secModificador() {
    const p = lerMod(R.modificador) || { tipo: 'degraus', ref: 10, passo: 2 }, t = lerTot(R.total) || { piso: 1 };
    return `<h3 class="er-s-t">Modificador</h3>
      ${ajuda('O modificador é o que se soma ao dado nos testes. Ele sai do total do atributo.')}
      <div class="er-opcoes" role="radiogroup" aria-label="Como o modificador é calculado">
        ${[['degraus', 'Por degraus', 'O jeito clássico: sobe +1 a cada tantos pontos.'], ['nenhum', 'Sem modificador', 'Os testes usam só o dado.'], ['avancado', 'Fórmula própria', 'Para quem quer escrever a conta.']].map(([v, n, d]) => {
          const on = modoMod === 'avancado' ? v === 'avancado' : v === p.tipo;
          return `<button type="button" role="radio" class="er-b er-opcao" data-mod-tipo="${v}" aria-checked="${on}" tabindex="${on ? 0 : -1}"><b>${n}</b><span>${d}</span></button>`;
        }).join('')}</div>
      ${modoMod === 'avancado'
        ? `<label class="er-f"><span>Fórmula do modificador <i>(ATR = total do atributo)</i></span><input type="text" class="er-formula" data-k="mod-texto" data-campo="modificador" value="${esc(R.modificador)}" maxlength="200" autocomplete="off" spellcheck="false"></label>${ajudaFormula()}`
        : p.tipo === 'degraus'
          ? `<p class="er-frase" data-campo="modificador">+1 a cada ${num('mod-passo', p.passo, 1, 20, 'Pontos por degrau')} pontos acima de ${num('mod-ref', p.ref, 0, 100, 'Valor de referência')} <span class="hint" data-derivado="mod-abaixo">(e −1 a cada ${esc(p.passo)} abaixo)</span>.</p>`
          : ''}
      <div class="er-tabela-mod" data-derivado="mod-tabela"></div>
      <h4 class="er-s-sub">Limite do atributo</h4>
      ${modoTot === 'avancado'
        ? `<label class="er-f"><span>Fórmula do total <i>(ATR = dado + bônus)</i></span><input type="text" class="er-formula" data-k="tot-texto" data-campo="total" value="${esc(R.total || '')}" maxlength="200" autocomplete="off" spellcheck="false" placeholder="ATR"></label>`
        : `<label class="er-check"><input type="checkbox" data-k="tot-on" ${t.piso != null ? 'checked' : ''}><span>O atributo nunca fica abaixo de</span></label> ${num('tot-piso', t.piso != null ? t.piso : 1, 0, 100, 'Valor mínimo do atributo', t.piso == null ? 'disabled' : '')}
          ${ajuda('Um bônus negativo de raça pode derrubar um atributo; este limite segura.')}`}
      <button type="button" class="link-remover er-alt" data-alternar="tot">${modoTot === 'avancado' ? 'Voltar ao modo simples' : 'Escrever a fórmula do total'}</button>`;
  }
  const ajudaFormula = () => ajuda('Vale: números, <code>+ - * /</code>, parênteses, as abreviações dos atributos, <code>SEQ</code> (a Sequência), <code>NIVEL</code>, <code>mod(VIG)</code>, <code>min(a, b)</code>, <code>max(a, b)</code>, <code>floor(x)</code> (arredonda para baixo).');

  function secRecursos() {
    return `<h3 class="er-s-t">Recursos</h3>
      ${ajuda('Vida, Sanidade, Mana… Cada um tem um máximo calculado pela ficha. “Sequência avançada” conta quantas Sequências o personagem subiu desde a 9 (na 9 é 0; na 7, 2).')}
      <ol class="er-rcs">${(R.recursos || []).map(linhaRc).join('')}</ol>
      <div class="er-rapidos" role="group" aria-label="Acrescentar recurso pronto"><span class="er-s-sub">Acrescentar:</span>${RAPIDOS.map((q, i) => `<button type="button" class="c-chip er-rapido" data-rapido="${i}" ${(R.recursos || []).length >= 12 ? 'disabled' : ''}>+ ${esc(q.nome)}</button>`).join('')}</div>`;
  }
  function linhaRc(r, k) {
    const p = lerRc(r.max, R.atributos), frase = r._modo !== 'avancado' && p, cor = /^#[0-9a-f]{6}$/i.test(r.cor || '') ? r.cor : '#9aa3b8';
    const cores = CORES.includes(cor) ? CORES : [cor].concat(CORES);
    return `<li class="er-rc" data-rc="${k}" style="--rc:${cor}">
      <div class="er-rc-cab"><label class="er-mini"><span>Nome</span><input type="text" data-k="rc-nome:${k}" value="${esc(r.nome)}" maxlength="30" autocomplete="off" aria-label="Nome do recurso ${k + 1}"></label>
        <div class="er-cores" role="radiogroup" aria-label="Cor de ${esc(r.nome || 'recurso ' + (k + 1))}">${cores.map(c => `<button type="button" role="radio" class="er-b er-cor" data-cor="${c}" data-rcor="${k}" aria-checked="${c === cor}" aria-label="Cor ${c}" style="--c:${c}" tabindex="${c === cor ? 0 : -1}"></button>`).join('')}</div>
        <button type="button" class="link-remover" data-tirar-rc="${k}">Tirar<span class="sr-only"> ${esc(r.nome || 'recurso ' + (k + 1))}</span></button></div>
      ${frase
        ? `<p class="er-frase er-rc-frase" data-campo="recursos[${k}].max">Máximo: começa com ${num(`rc-b:${k}`, p.b, 0, 9999, 'Valor inicial')}
            + ${num(`rc-m:${k}`, p.m, 0, 99, 'Multiplicador')} × <select data-k="rc-tipo:${k}" aria-label="Modificador ou valor"><option value="mod" ${p.tipo === 'mod' ? 'selected' : ''}>o modificador</option><option value="valor" ${p.tipo === 'valor' ? 'selected' : ''}>o valor</option></select>
            de ${selAtr(`rc-atr:${k}`, p.atr, 'Atributo', 'nenhum atributo')}
            + ${num(`rc-s:${k}`, p.s, 0, 99, 'Por Sequência avançada')} por Sequência avançada.</p>`
        : `<label class="er-f"><span>Fórmula do máximo</span><input type="text" class="er-formula" data-k="rc-texto:${k}" data-campo="recursos[${k}].max" value="${esc(r.max)}" maxlength="200" autocomplete="off" spellcheck="false"></label>${ajudaFormula()}`}
      <p class="er-rc-res" data-derivado="rc:${k}"></p>
      <button type="button" class="link-remover er-alt" data-alternar="rc:${k}">${frase ? 'Escrever a fórmula' : 'Voltar ao modo simples'}</button></li>`;
  }

  const ligado = (k, on, texto) => `<label class="er-check er-liga"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}><span>${texto}</span></label>`;
  function secCaminho() {
    const cam = R.bonus && R.bonus.caminho;
    return `<h3 class="er-s-t">Bônus de Caminho</h3>
      ${ajuda('Cada Caminho reforça um atributo. O personagem ganha o bônus no atributo do Caminho dele.')}
      ${ligado('cam-on', !!cam, 'Usar bônus de Caminho')}
      ${cam ? `<p class="er-frase">O atributo do Caminho ganha ${num('cam-valor', cam.valor, -10, 10, 'Bônus do Caminho')}.</p>
        <ul class="er-cams">${LISTA_CAMINHOS().map(c => `<li style="--cc:${esc(c.cor || '#9b7bff')}"><span class="er-cam-n">${typeof svgGlifo === 'function' ? `<span class="er-glifo" aria-hidden="true">${svgGlifo(c, 18)}</span>` : ''}${esc(c.nome)}</span>
          <select data-k="cam-at:${esc(c.id)}" aria-label="Atributo do Caminho ${esc(c.nome)}"><option value="">nenhum</option>${R.atributos.map(a => `<option value="${esc(a.id)}" ${cam.atributo && cam.atributo[c.id] === a.id ? 'selected' : ''}>${esc(a.nome || a.abrev)}</option>`).join('')}</select></li>`).join('')}</ul>` : ''}`;
  }
  function secRacas() {
    const rb = R.bonus && R.bonus.raca, ats = R.atributos;
    return `<h3 class="er-s-t">Bônus de raça</h3>
      ${ajuda('Quanto cada raça soma (ou tira) de cada atributo. Vazio = 0.')}
      ${ligado('raca-on', !!rb, 'Usar bônus de raça')}
      ${rb ? `<div class="er-tab-rol"><table class="er-tab-racas"><thead><tr><th scope="col">Raça</th>${ats.map(a => `<th scope="col" title="${esc(a.nome)}">${esc(a.abrev)}</th>`).join('')}</tr></thead>
        <tbody>${LISTA_RACAS().map(r => `<tr><th scope="row">${esc(r.nome)}</th>${ats.map(a => { const v = rb[r.id] && rb[r.id][a.id]; return `<td><input type="number" class="er-num er-cel ${v > 0 ? 'mais' : v < 0 ? 'menos' : ''}" data-k="raca:${esc(r.id)}:${esc(a.id)}" value="${inteiro(v) && v !== 0 ? v : ''}" min="-10" max="10" inputmode="numeric" aria-label="${esc(r.nome)}, ${esc(a.nome)}"></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : ''}`;
  }
  function secSequencia() {
    const sq = R.bonus && R.bonus.sequencia;
    const linha = (k, txt) => `<div class="er-seqs"><p>${txt}</p><div role="group" aria-label="${esc(txt)}">${[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(n => { const on = Array.isArray(sq[k]) && sq[k].includes(n); return `<button type="button" class="er-b er-pilula" data-seq="${k}:${n}" aria-pressed="${on}">${n}</button>`; }).join('')}</div></div>`;
    return `<h3 class="er-s-t">Bônus por Sequência</h3>
      ${ajuda('Ao chegar em certas Sequências o personagem fica mais forte: +1 em cada Sequência marcada (marcar a 6 vale da 6 até a 0).')}
      ${ligado('seq-on', !!sq, 'Usar bônus por Sequência')}
      ${sq ? linha('principal', 'O atributo do Caminho ganha +1 ao chegar na Sequência:') + linha('todos', 'Todos os atributos ganham +1 ao chegar na Sequência:') : ''}`;
  }

  // ---------- mudanças nos campos ----------
  const idUnico = (bruto, lista, menos) => { const b = (sem(bruto).toLowerCase().replace(/[^a-z]/g, '') || 'novo').slice(0, 10); let id = b, n = 0; while (lista.some((x, i) => i !== menos && x.id === id)) id = b + '_' + 'abcdefghij'[n++ % 10]; return id; };
  const abrevUnica = (nome, menos) => { const b = sem(nome).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); if (b.length < 2) return b; let a = b; for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { if (!R.atributos.some((x, i) => i !== menos && x.abrev === a) && !RESERVADOS.includes(a)) return a; a = b.slice(0, 2) + c; } return b; };
  const bonus = () => { if (!R.bonus) R.bonus = {}; return R.bonus; };
  const semBonusVazio = () => { if (R.bonus && !Object.keys(R.bonus).length) delete R.bonus; };
  const padraoBonus = k => copia((partida.bonus && partida.bonus[k]) || Regras.LOTM.bonus[k]);
  // troca a abreviação nas fórmulas (só palavras inteiras; mod/min/max não são tocados)
  function trocarAbrev(velha, nova) {
    if (!velha || !nova || velha === nova || RESERVADOS.includes(nova) || !/^[A-Z]{2,4}$/.test(nova)) return;
    const rx = new RegExp(`(^|[^A-Za-z_])${velha}(?![A-Za-z_])`, 'gi'), tr = t => (typeof t === 'string' ? t.replace(rx, (_, a) => a + nova) : t);
    R.modificador = tr(R.modificador); if (R.total) R.total = tr(R.total);
    (R.recursos || []).forEach(r => { r.max = tr(r.max); });
  }

  function aplicar(el) {
    const k = el.dataset.k, [tipo, a, b] = k.split(':'), v = el.type === 'checkbox' ? el.checked : el.value, n = String(v).trim() === '' ? null : Number(v);
    const rc = (R.recursos || [])[+a];
    switch (tipo) {
      case 'at-nome': { const at = R.atributos[+a]; at.nome = String(v).trim();
        if (at._novo) { at.id = idUnico(at.nome, R.atributos, +a); if (!at._abrevMexida) { at.abrev = abrevUnica(at.nome, +a); const ab = $(`[data-k="at-abrev:${a}"]`); if (ab) ab.value = at.abrev; } } break; }
      case 'at-abrev': R.atributos[+a].abrev = String(v).trim().toUpperCase(); R.atributos[+a]._abrevMexida = true; break;
      case 'ger-metodo': R.geracao.metodo = v; break;
      case 'ger-min': R.geracao.min = n; break;
      case 'ger-max': R.geracao.max = n; break;
      case 'mod-passo': case 'mod-ref': { const p = lerMod(R.modificador) || { tipo: 'degraus', ref: 10, passo: 2 }; const x = Math.max(0, Math.round(n == null ? 0 : n)); if (tipo === 'mod-passo') p.passo = Math.max(1, x); else p.ref = x; R.modificador = escreverMod(p); break; }
      case 'mod-texto': R.modificador = String(v).trim(); break;
      case 'tot-on': R.total = v ? `max(${Math.max(0, Math.round(Number(($('[data-k="tot-piso"]') || {}).value) || 1))}, ATR)` : 'ATR'; { const p = $('[data-k="tot-piso"]'); if (p) p.disabled = !v; } break;
      case 'tot-piso': R.total = `max(${Math.max(0, Math.round(n || 0))}, ATR)`; break;
      case 'tot-texto': if (String(v).trim()) R.total = String(v).trim(); else delete R.total; break;
      case 'rc-nome': rc.nome = String(v).trim(); if (rc._novo) rc.id = idUnico(rc.nome, R.recursos, +a); break;
      case 'rc-b': case 'rc-m': case 'rc-s': case 'rc-tipo': case 'rc-atr': {
        const p = lerRc(rc.max, R.atributos) || { b: 0, atr: '', tipo: 'mod', m: 0, s: 0 };
        if (tipo === 'rc-tipo') p.tipo = v; else if (tipo === 'rc-atr') { p.atr = v; if (v && !p.m) { p.m = 1; const mm = $(`[data-k="rc-m:${a}"]`); if (mm) mm.value = '1'; } }
        else p[tipo.slice(3)] = Math.max(0, Math.round(n || 0));
        rc.max = escreverRc(p); break; }
      case 'rc-texto': rc.max = String(v).trim(); break;
      case 'cam-on': if (v) bonus().caminho = padraoBonus('caminho'); else { delete bonus().caminho; semBonusVazio(); } return irPara('caminho', '[data-k="cam-on"]');
      case 'cam-valor': R.bonus.caminho.valor = n; break;
      case 'cam-at': { const m = R.bonus.caminho.atributo || (R.bonus.caminho.atributo = {}); if (v) m[a] = v; else delete m[a]; break; }
      case 'raca-on': if (v) bonus().raca = padraoBonus('raca'); else { delete bonus().raca; semBonusVazio(); } return irPara('racas', '[data-k="raca-on"]');
      case 'raca': { const t = R.bonus.raca, linha = t[a] || (t[a] = {}); if (n == null || n === 0) delete linha[b]; else linha[b] = n; if (!Object.keys(linha).length) delete t[a];
        el.classList.toggle('mais', n > 0); el.classList.toggle('menos', n < 0); break; }
      case 'seq-on': if (v) bonus().sequencia = padraoBonus('sequencia'); else { delete bonus().sequencia; semBonusVazio(); } return irPara('sequencia', '[data-k="seq-on"]');
    }
    atualizar();
  }

  // ---------- derivados: erros, frases, tabela, prévia, botão salvar ----------
  const SEC_DO_CAMPO = c => (/^atributos|^geracao/.test(c) ? 'atributos' : /^modificador|^total/.test(c) ? 'modificador' : /^recursos/.test(c) ? 'recursos' : c === 'bonus.caminho' ? 'caminho' : c === 'bonus.raca' ? 'racas' : c === 'bonus.sequencia' ? 'sequencia' : 'atributos');
  function rotuloCampo(campo) {
    const m = /^(atributos|recursos)\[(\d+)\]\.(\w+)$/.exec(campo);
    if (m) { const x = (R[m[1]] || [])[+m[2]] || {}; return `${m[1] === 'atributos' ? 'Atributo' : 'Recurso'} ${+m[2] + 1}${x.nome ? ` (${x.nome})` : ''}, ${{ id: 'nome', abrev: 'abreviação', nome: 'nome', max: 'máximo' }[m[3]] || m[3]}`; }
    return { atributos: 'Atributos', geracao: 'Rolagem', modificador: 'Modificador', total: 'Limite do atributo', recursos: 'Recursos', 'bonus.caminho': 'Bônus de Caminho', 'bonus.raca': 'Bônus de raça', 'bonus.sequencia': 'Bônus por Sequência' }[campo] || campo;
  }
  // mensagens do motor em palavras de mesa
  function emPalavras(e) {
    const m = e.erro.replace(/^Fórmula inválida na posição \d+: /, '');
    if (/^id:/.test(m)) return 'dois atributos (ou recursos) com o mesmo nome, ou nome sem letras';
    if (/^abreviação:/.test(m)) return 'use de 2 a 4 letras, sem repetir outra abreviação (e sem ATR, SEQ, MOD…)';
    if (/^nome:/.test(m)) return 'dê um nome (até 30 letras)';
    if (/^min e max/.test(m)) return 'o mínimo e o máximo vão de 1 a 100, e o mínimo não pode passar do máximo';
    if (/atributos que existem/.test(m)) return 'algum Caminho ou raça aponta para um atributo que não existe mais';
    if (/^nome desconhecido: (\w+)/.test(m)) return `a conta usa ${/: (\w+)/.exec(m)[1]}, que não é a abreviação de nenhum atributo`;
    return (e.pos ? `posição ${e.pos}: ` : '') + m;
  }
  function textoDoCampo(campo) {
    const m = /^recursos\[(\d+)\]\.max$/.exec(campo);
    if (m) return ((R.recursos || [])[+m[1]] || {}).max;
    return campo === 'modificador' ? R.modificador : campo === 'total' ? R.total : null;
  }
  function trecho(texto, pos) {
    const s = String(texto ?? ''), i = Math.max(0, Math.min(s.length, pos - 1));
    return `<code class="er-trecho">${esc(s.slice(0, i))}<mark>${i < s.length ? esc(s[i]) : '&nbsp;'}</mark>${esc(s.slice(i + 1))}</code>`;
  }
  function seletorDoCampo(campo) {
    let m = /^atributos\[(\d+)\]\.(\w+)$/.exec(campo); if (m) return `[data-k="at-${m[2] === 'abrev' ? 'abrev' : 'nome'}:${m[1]}"]`;
    m = /^recursos\[(\d+)\]\.(\w+)$/.exec(campo); if (m) return m[2] === 'max' ? `[data-rc="${m[1]}"] [data-campo] input, [data-rc="${m[1]}"] input[data-campo]` : `[data-k="rc-nome:${m[1]}"]`;
    return { geracao: '[data-k="ger-min"]', modificador: '[data-k="mod-passo"], [data-k="mod-texto"]', total: '[data-k="tot-piso"], [data-k="tot-texto"]', 'bonus.caminho': '[data-k="cam-valor"]', 'bonus.raca': '[data-k="raca-on"]', 'bonus.sequencia': '[data-k="seq-on"]' }[campo] || '';
  }

  function fichasDaMesa() { return (C.jogadores() || []).filter(j => j && j.ficha && j.ficha.base && typeof j.ficha.base === 'object'); }
  function fichaExemplo(L) {
    const g = L.geracao || {}, lo = inteiro(g.min) ? g.min : 3, hi = inteiro(g.max) ? g.max : 18;
    return { base: Object.fromEntries(L.atributos.map((a, k) => [a.id, Math.max(lo, Math.min(hi, EXEMPLO[k % EXEMPLO.length]))])), seq: +(($('#er-seq') || {}).value) || 0, caminhoId: '', racaId: '' };
  }
  function preencherFichas() {
    const sel = $('#er-ficha'); if (!sel) return; const antes = sel.value;
    sel.innerHTML = '<option value="ex">Ficha de exemplo</option>' + fichasDaMesa().map(j => `<option value="${esc(j.user_id)}">${esc(j.ficha.nome || j.nome || 'Jogador')}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === antes) ? antes : 'ex';
  }
  function previa(L) {
    const uid = ($('#er-ficha') || {}).value, j = uid && uid !== 'ex' ? fichasDaMesa().find(x => x.user_id === uid) : null;
    $('#er-seq').disabled = !!j;
    const ficha = j ? j.ficha : fichaExemplo(L);
    let novo, velho;
    try { novo = Regras.calcular(L, ficha); } catch (e) { return '<p class="hint">A prévia volta quando as contas estiverem certas.</p>'; }
    try { velho = Regras.calcular(vigor(), ficha); } catch (e) { velho = { attrs: {}, mods: {}, maximos: {} }; }
    const dif = (a, b) => (b == null || a == null || a === b ? '' : `<i class="er-dif ${a > b ? 'sobe' : 'desce'}" title="Na ${esc(nomeVigor())}: ${b}">${a > b ? '▲' : '▼'}${Math.abs(a - b)}</i>`);
    const ats = L.atributos.map(a => {
      const t = novo.attrs[a.id], m = novo.mods[a.id];
      return t == null ? `<li class="er-p-at falta"><b>${esc(a.abrev)}</b><span>${esc(a.nome)}</span><em>sem valor</em></li>`
        : `<li class="er-p-at"><b>${esc(a.abrev)}</b><span>${esc(a.nome)}</span><strong>${t}</strong><em>${sinal(m)}${dif(m, velho.mods[a.id])}</em></li>`;
    }).join('');
    const rcs = (L.recursos || []).map(r => { const v = novo.maximos[r.id], cor = /^#[0-9a-f]{6}$/i.test(r.cor || '') ? r.cor : '#9aa3b8';
      return `<li class="er-p-rc" style="--rc:${cor}"><span>${esc(r.nome || r.id)}</span><b>${v == null ? '—' : v}</b>${dif(v, velho.maximos[r.id])}<i class="er-p-barra" style="--p:${v == null ? 0 : Math.max(4, Math.min(100, v * 2))}%"></i></li>`; }).join('');
    return `<p class="hint">${j ? `Ficha de ${esc(j.ficha.nome || j.nome)}, Sequência ${esc(ficha.seq ?? 9)}.` : 'Ficha de exemplo, sem Caminho nem raça.'} ▲▼ comparam com a ${esc(nomeVigor())}.</p>
      <ul class="er-p-ats">${ats}</ul>${rcs ? `<ul class="er-p-rcs">${rcs}</ul>` : ''}`;
  }
  function avisos(L) {
    const a = [], fora = L.atributos.filter(x => x.id && !LOTM_IDS.includes(x.id));
    if (fora.length) a.push(`Teste pedido ainda não mira ${fora.map(x => x.nome || x.id).join(', ')}: por enquanto os pedidos só aceitam os seis atributos do Lord of the Mysteries (nas contas eles já valem).`);
    const semValor = fichasDaMesa().filter(j => { try { const c = Regras.calcular(L, j.ficha); return L.atributos.some(x => c.attrs[x.id] == null); } catch (e) { return false; } });
    if (semValor.length) a.push(`${semValor.length === 1 ? 'A ficha de ' + (semValor[0].ficha.nome || semValor[0].nome) + ' ficaria' : semValor.length + ' fichas da mesa ficariam'} com atributo sem valor (rolagem fora de ${L.geracao.min} a ${L.geracao.max}, ou atributo que a ficha não tem): o modificador vira 0.`);
    return a;
  }
  function tabelaMod(L, erroMod) {
    if (erroMod) return '';
    const g = L.geracao || {}, lo = inteiro(g.min) ? g.min : 3, hi = inteiro(g.max) ? g.max : 18;
    const vals = [...new Set([lo, 6, 8, 10, 12, 14, 16, hi].filter(v => v >= lo && v <= hi))].sort((x, y) => x - y);
    let linhas; try { linhas = vals.map(v => [v, Regras.formula(L.modificador, { nomes: ['ATR'], mod: false, dados: false }, { vars: { ATR: v } })]); } catch (e) { return ''; }
    return `<p class="er-s-sub">Como fica</p><table class="er-tmod"><tr><th scope="row">Atributo</th>${linhas.map(([v]) => `<td>${v}</td>`).join('')}</tr><tr><th scope="row">Modificador</th>${linhas.map(([, m]) => `<td class="${m > 0 ? 'mais' : m < 0 ? 'menos' : ''}">${m == null ? '—' : sinal(m)}</td>`).join('')}</tr></table>`;
  }

  function atualizar() {
    if (!livro) return;
    const L = limpo(R), erros = Regras.validar(L);
    livro.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    erros.forEach(e => { const s = seletorDoCampo(e.campo); if (s) livro.querySelectorAll(`#erl-sec :is(${s})`).forEach(el => el.setAttribute('aria-invalid', 'true')); });
    // contagem por seção
    const porSec = {}; erros.forEach(e => { const s = SEC_DO_CAMPO(e.campo); porSec[s] = (porSec[s] || 0) + 1; });
    livro.querySelectorAll('.er-l-aba').forEach(b => { const n = porSec[b.dataset.sec] || 0, el = b.querySelector('.er-l-n'); el.hidden = !n; el.textContent = String(n); b.classList.toggle('com-erro', !!n); });
    const caixa = $('#er-erros'); caixa.hidden = !erros.length;
    caixa.innerHTML = erros.length ? `<p><b>${erros.length === 1 ? 'Falta acertar 1 coisa' : `Faltam acertar ${erros.length} coisas`}</b> para salvar:</p><ul>${erros.map((e, i) => { const t = e.pos ? textoDoCampo(e.campo) : null; return `<li><b>${esc(rotuloCampo(e.campo))}:</b> ${esc(emPalavras(e))}${t != null ? trecho(t, e.pos) : ''} <button type="button" class="link-remover" data-ir-erro="${i}">Ir até lá</button></li>`; }).join('')}</ul>` : '';
    errosAtuais = erros;
    const av = erros.length ? [] : avisos(L), ul = $('#er-avisos'); ul.hidden = !av.length; ul.innerHTML = av.map(x => `<li>${esc(x)}</li>`).join('');
    $('#er-resultado').innerHTML = erros.length ? '<p class="hint">A prévia volta quando tudo estiver certo.</p>' : previa(L);
    // frases que acompanham os números
    const ab = $('[data-derivado="mod-abaixo"]'), pm = lerMod(R.modificador); if (ab && pm && pm.tipo === 'degraus') ab.textContent = pm.passo === 1 ? '(e −1 a cada ponto abaixo)' : `(e −1 a cada ${pm.passo} abaixo)`;
    const tm = $('[data-derivado="mod-tabela"]'); if (tm) tm.innerHTML = tabelaMod(L, erros.some(e => e.campo === 'modificador'));
    livro.querySelectorAll('[data-derivado^="rc:"]').forEach(el => { const k = +el.dataset.derivado.slice(3), r = L.recursos[k]; if (!r) return; const er = erros.find(e => e.campo === `recursos[${k}].max`);
      let v = null; if (!er && !erros.length) { try { v = Regras.calcular(L, fichaExemplo(L)).maximos[r.id]; } catch (e) { v = null; } }
      el.innerHTML = er ? '' : `<span>${esc(r.nome || 'Recurso')} = ${esc(fraseRc(r, L.atributos))}</span>${v != null ? ` <b>→ ${v} na ficha de exemplo</b>` : ''}`; });
    const igual = canon(L) === canon(limpo(vigor())), proxima = (versoes[0] ? versoes[0].versao : 0) + 1, cheio = proxima > 100;
    const bt = $('#er-salvar'); bt.disabled = !!erros.length || igual || cheio; bt.textContent = `Salvar versão ${proxima}`;
    $('#er-desfazer').disabled = !mudou();
    $('#erl-sub').textContent = `Aberto em: ${nomePartida}${mudou() ? ' · com mudanças' : ''}`;
    $('#er-estado').textContent = cheio ? 'Esta mesa chegou a 100 versões.' : erros.length ? `${erros.length} para acertar` : igual ? 'Igual às regras em vigor' : 'Pronto para salvar';
  }

  async function salvar() {
    const L = limpo(R), el = $('#er-msg'); el.hidden = true;
    if (Regras.validar(L).length) return atualizar();
    const n = (versoes[0] ? versoes[0].versao : 0) + 1;
    if (!(await C.confirmar({ titulo: `Salvar a versão ${n}?`, texto: `${C.fichaNaMesa && C.fichaNaMesa() ? 'As fichas montadas na mesa continuam na versão delas até você migrar (botão na carta do jogador); fichas novas já usam esta.' : 'Os testes desta mesa passam a usar estas regras na hora.'} Cada ficha é recalculada quando o jogador sincronizar. A ${nomeVigor()} continua guardada.`, botao: `Salvar versão ${n}` }))) return;
    try {
      const r = await (await Rede.tabela('mestre', 'mesa_regras')).insert({ mesa_id: C.mesaId, regras: L }).select('versao,regras,criado_em');
      if (r.error) throw r.error;
      const nova = r.data && r.data[0]; if (nova) versoes = [nova].concat(versoes.filter(x => x.versao !== nova.versao));
      const vn = nova ? nova.versao : n;
      carregarNoLivro(nova ? nova.regras : L, `versão ${vn}`); irPara(secao, '#er-salvar'); desenharResumo();
      C.anunciar(`Regras salvas: versão ${vn} em vigor`);
      if (C.aoSalvar) C.aoSalvar();
      el.textContent = `Versão ${vn} salva e em vigor.`; el.classList.add('m-ok'); el.hidden = false;
    } catch (e) { el.classList.remove('m-ok'); el.textContent = Rede.mensagem(e); el.hidden = false; }
  }

  // ---------- eventos do livro ----------
  function ligarLivro() {
    livro.addEventListener('input', e => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.id === 'er-ficha' || t.id === 'er-seq') return atualizar();
      if (t.dataset && t.dataset.k) aplicar(t);
    });
    livro.addEventListener('focusin', e => { const t = /** @type {HTMLElement} */ (e.target); if (t.dataset && /^at-abrev:/.test(t.dataset.k || '')) t.dataset.antes = t.value.toUpperCase(); });
    livro.addEventListener('change', e => {   // abreviação confirmada: as contas que usavam a antiga passam a usar a nova
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.dataset && /^at-abrev:/.test(t.dataset.k || '') && t.dataset.antes) { trocarAbrev(t.dataset.antes, t.value.trim().toUpperCase()); t.dataset.antes = t.value.trim().toUpperCase(); atualizar(); }
    });
    livro.addEventListener('click', async e => {
      const b = /** @type {HTMLElement} */ (e.target).closest('button'); if (!b || !livro.contains(b) || b.disabled) return;
      const d = b.dataset;
      if (b.id === 'er-fechar') return fecharLivro();
      if (b.id === 'er-salvar') { b.disabled = true; try { await salvar(); } finally { atualizar(); } return; }
      if (b.id === 'er-desfazer') { carregarNoLivro(partida, nomePartida); irPara(secao, '#er-desfazer'); C.anunciar('Mudanças desfeitas'); return; }
      if (d.sec) return irPara(d.sec);
      if (d.modelo) { const m = MODELOS.find(x => x.id === d.modelo); if (m) await trocarPara(m.regras(), `modelo ${m.nome}`); return; }
      if (d.versao) { const v = versoes.find(x => String(x.versao) === d.versao); if (v) await trocarPara(v.regras, `versão ${v.versao}`); return; }
      if (d.irErro != null) { const er = errosAtuais[+d.irErro]; if (er) { irPara(SEC_DO_CAMPO(er.campo)); const el = $(`#erl-sec :is(${seletorDoCampo(er.campo) || 'input'})`); if (el) el.focus(); } return; }
      if (b.id === 'er-mais-at') { R.atributos.push({ id: idUnico('novo', R.atributos, -1), nome: '', abrev: '', _novo: true }); return irPara('atributos', `[data-k="at-nome:${R.atributos.length - 1}"]`); }
      if (d.tirarAt != null) {
        const [at] = R.atributos.splice(+d.tirarAt, 1), bo = R.bonus || {};
        if (bo.caminho && bo.caminho.atributo) Object.keys(bo.caminho.atributo).forEach(c => { if (bo.caminho.atributo[c] === at.id) delete bo.caminho.atributo[c]; });
        if (bo.raca) Object.values(bo.raca).forEach(l => { delete l[at.id]; });
        C.anunciar(`${at.nome || 'Atributo'} tirado`); return irPara('atributos', '#er-mais-at');
      }
      if (d.rapido != null) {
        const q = RAPIDOS[+d.rapido], at = R.atributos.find(a => a.id === q.pref) || (q.pref ? R.atributos[0] : null);
        const nome = (R.recursos || []).some(r => r.nome === q.nome) ? `${q.nome} ${R.recursos.length + 1}` : q.nome;
        const novo = { id: idUnico(q.id === 'novo' ? 'recurso' : q.id, R.recursos || [], -1), nome: q.nome === 'Vazio' ? '' : nome, max: escreverRc({ b: q.b, atr: at ? at.abrev : '', tipo: 'mod', m: at ? q.m : 0, s: q.s }), cor: q.cor, _modo: 'frase', _novo: q.nome === 'Vazio' };
        (R.recursos || (R.recursos = [])).push(novo); return irPara('recursos', `[data-k="rc-nome:${R.recursos.length - 1}"]`);
      }
      if (d.tirarRc != null) { R.recursos.splice(+d.tirarRc, 1); return irPara('recursos', '.er-rapido'); }
      if (d.rcor != null) { marcarCor(b); R.recursos[+d.rcor].cor = d.cor; return atualizar(); }
      if (d.modTipo) {
        if (d.modTipo === 'avancado') modoMod = 'avancado';
        else { modoMod = 'frase'; R.modificador = d.modTipo === 'nenhum' ? '0' : escreverMod(lerMod(partida.modificador) && lerMod(partida.modificador).tipo === 'degraus' ? lerMod(partida.modificador) : { tipo: 'degraus', ref: 10, passo: 2 }); }
        return irPara('modificador', `[data-mod-tipo="${d.modTipo}"]`);
      }
      if (d.alternar) {
        if (d.alternar === 'tot') { if (modoTot === 'avancado' && !lerTot(R.total)) R.total = 'max(1, ATR)'; modoTot = modoTot === 'avancado' ? 'frase' : 'avancado'; return irPara('modificador', '[data-alternar="tot"]'); }
        const k = +d.alternar.slice(3), r = R.recursos[k];
        if (r._modo === 'avancado') { if (!lerRc(r.max, R.atributos)) r.max = escreverRc({ b: 10, atr: '', tipo: 'mod', m: 0, s: 0 }); r._modo = 'frase'; } else r._modo = 'avancado';
        return irPara('recursos', `[data-alternar="rc:${k}"]`);
      }
      if (d.seq) {
        const [k, n] = d.seq.split(':'), sq = R.bonus.sequencia, l = Array.isArray(sq[k]) ? sq[k] : (sq[k] = []), i = l.indexOf(+n);
        if (i >= 0) l.splice(i, 1); else if (l.length < 10) { l.push(+n); l.sort((x, y) => y - x); }
        b.setAttribute('aria-pressed', String(i < 0)); return atualizar();
      }
    });
    livro.addEventListener('keydown', e => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (e.key === 'Escape') { if (document.querySelector('.m-conf-fundo, .esc-lista')) return; e.preventDefault(); fecharLivro(); return; }
      // setas nos grupos (abas do livro, cores, opções do modificador)
      const grupo = t.classList && (t.classList.contains('er-l-aba') ? '.er-l-aba' : t.classList.contains('er-cor') ? '.er-cor' : t.classList.contains('er-opcao') ? '.er-opcao' : '');
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (grupo && k) { e.preventDefault(); const bs = [...t.parentElement.querySelectorAll(grupo)], alvo = bs[(bs.indexOf(t) + k + bs.length) % bs.length]; alvo.focus(); if (grupo !== '.er-opcao') alvo.click(); return; }
      if (e.key === 'Tab') {   // o foco não sai do livro
        const f = [...livro.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]):not(.esc-nativo),[tabindex="0"]')].filter(x => x.offsetParent !== null);
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }
  function marcarCor(b) {
    b.parentElement.querySelectorAll('.er-cor').forEach(x => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    const li = b.closest('.er-rc'); if (li) li.style.setProperty('--rc', b.dataset.cor);
  }

  // ---------- painel ----------
  function ligar(ctx) {
    C = ctx; versoes = []; R = null; partida = null; secao = 'comecar';
    if (livro) { livro.remove(); livro = null; document.body.classList.remove('er-livro-aberto'); }
    C.raiz.addEventListener('click', e => { const b = /** @type {HTMLElement} */ (e.target).closest('#er-abrir'); if (b) buscar().then(() => abrirLivro(b)); });
    buscar();
  }
  function aoAbrir() { if (C && !livro) buscar(); }
  function jogadoresMudaram() { if (livro) { preencherFichas(); atualizar(); } }

  return { secao: secaoHTML, ligar, jogadoresMudaram, aoAbrir, abrirLivro, fecharLivro, lerMod, lerRc, escreverRc, escreverMod };
})());
