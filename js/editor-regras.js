// Editor de regras da mesa (Fase B de docs/SISTEMAS-DA-MESA.md), na aba "Regras" do Grimório.
// O mestre parte da predefinição LotM ou de uma versão salva, mexe em atributos, geração, modificador e recursos,
// e vê ao vivo (Regras.validar + Regras.calcular, o mesmo motor que o banco roda em plpgsql) o efeito numa ficha de
// exemplo ou na ficha de um jogador da mesa. Salvar = INSERT em mesa_regras: versão nova, nada é sobrescrito.
// O banco valida de novo (o navegador só adianta a mensagem, com a mesma posição do erro).
'use strict';
const EditorRegras = Object.freeze((() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sinal = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const copia = o => JSON.parse(JSON.stringify(o));
  // texto canônico (chaves em ordem) para saber se mudou algo
  const canon = v => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}` : JSON.stringify(v));
  const LOTM_IDS = ['forca', 'agil', 'vigor', 'intel', 'espir', 'pres'];   // pedidos.atributo só aceita estes (ver HANDOFF)
  const CORES = ['#e05a6a', '#6fb4ff', '#b08cff', '#f0b35a', '#5ad0a0', '#d9b86a', '#ff7ab8', '#9aa3b8'];
  const METODOS = { '4d6-menor': '4d6, descarta o menor', '3d6': '3d6 somados' };
  const EXEMPLO = [15, 14, 13, 12, 10, 8];
  const NOME_CAMPO = { id: 'id', abrev: 'abreviação', nome: 'nome', max: 'máximo' };
  const idDe = nome => String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '').slice(0, 12);
  const abrevDe = nome => String(nome).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '').slice(0, 3);

  let C = null;           // contexto do painel: { raiz, mesaId, confirmar, anunciar, jogadores() }
  let versoes = [];       // [{ versao, regras, criado_em }] da mais nova para a mais velha
  let base = null;        // as regras de onde o editor partiu (campos que o editor não mexe vêm daqui)
  let origem = 'lotm';    // 'lotm' ou 'v:N'
  let erros = [];

  const $ = s => C.raiz.querySelector(s);
  const vigor = () => (versoes[0] ? versoes[0].regras : Regras.LOTM);
  const nomeVigor = () => (versoes[0] ? `versão ${versoes[0].versao}` : 'predefinição Lord of the Mysteries');

  function secao() {
    return `<section class="m-cartao er" aria-labelledby="t-regras"><h2 id="t-regras">Regras da mesa <small class="er-vigor" id="er-vigor">…</small></h2>
      <p class="hint">O sistema que vale nos testes desta mesa. Mudar cria uma <b>versão nova</b>; as antigas ficam no histórico.</p>
      <div class="m-form er-form" id="er-form"><p class="hint">Abrindo as regras…</p></div>
      <div class="er-lado">
        <section class="er-previa" aria-labelledby="t-er-previa"><h3 id="t-er-previa">Prévia</h3>
          <div class="m-grade"><div class="m-campo"><label for="er-ficha">Ficha</label><select id="er-ficha"></select></div>
            <div class="m-campo"><label for="er-seq">Sequência <i>(só no exemplo)</i></label><select id="er-seq">${[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(s => `<option value="${s}">Sequência ${s}</option>`).join('')}</select></div></div>
          <div id="er-resultado" class="er-resultado" aria-live="polite"></div>
        </section>
        <div id="er-erros" class="er-erros" role="alert" hidden></div>
        <ul id="er-avisos" class="er-avisos" hidden></ul>
        <p class="m-erro" id="m-erro-regras" role="alert" hidden></p>
        <div class="m-acoes"><button type="button" class="primary" id="er-salvar" data-ic="selo">Salvar versão nova</button><button type="button" class="ghost" id="er-desfazer">Desfazer mudanças</button></div>
        <p class="hint er-estado" id="er-estado"></p>
        <section class="er-hist-s" aria-labelledby="t-er-hist"><h3 id="t-er-hist">Histórico</h3><ol id="er-hist" class="er-hist"></ol></section>
      </div>
    </section>`;
  }

  // ---------- formulário ----------
  // campos que o editor não mostra (de versões futuras) seguem na linha, para não se perderem ao salvar
  const extras = (o, vistos) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !vistos.includes(k) && k[0] !== '_'));
  const extrasDe = li => { try { const x = JSON.parse(li.dataset.extra || '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch (e) { return {}; } };
  const campoTexto =(campo, rot, valor, extra = '') => `<input type="text" data-campo="${esc(campo)}" aria-label="${esc(rot)}" value="${esc(valor)}" autocomplete="off" spellcheck="false" ${extra}>`;
  function linhaAtributo(a, k) {
    return `<li class="er-at" data-k="${k}" data-extra="${esc(JSON.stringify(extras(a, ['id', 'nome', 'abrev'])))}">
      ${campoTexto(`atributos[${k}].nome`, `Nome do atributo ${k + 1}`, a.nome, 'maxlength="30" class="er-nome"')}
      ${campoTexto(`atributos[${k}].abrev`, `Abreviação do atributo ${k + 1}`, a.abrev, 'maxlength="4" class="er-abrev"')}
      ${campoTexto(`atributos[${k}].id`, `Id do atributo ${k + 1}`, a.id, `maxlength="12" class="er-id"${a._auto ? ' data-auto="1"' : ''}`)}
      <button type="button" class="link-remover" data-tirar-at="${k}">Tirar<span class="sr-only"> ${esc(a.nome || 'atributo ' + (k + 1))}</span></button></li>`;
  }
  function linhaRecurso(r, k) {
    const cores = CORES.includes(r.cor) || !/^#[0-9a-f]{6}$/i.test(r.cor || '') ? CORES : [r.cor].concat(CORES);
    return `<li class="er-rc" data-k="${k}" data-extra="${esc(JSON.stringify(extras(r, ['id', 'nome', 'max', 'cor'])))}" style="--rc:${esc(/^#[0-9a-f]{6}$/i.test(r.cor || '') ? r.cor : '#9aa3b8')}">
      <div class="er-rc-l">${campoTexto(`recursos[${k}].nome`, `Nome do recurso ${k + 1}`, r.nome, 'maxlength="30" class="er-nome"')}
      ${campoTexto(`recursos[${k}].id`, `Id do recurso ${k + 1}`, r.id, `maxlength="12" class="er-id"${r._auto ? ' data-auto="1"' : ''}`)}
      <button type="button" class="link-remover" data-tirar-rc="${k}">Tirar<span class="sr-only"> ${esc(r.nome || 'recurso ' + (k + 1))}</span></button></div>
      <label class="er-f"><span>Máximo</span>${campoTexto(`recursos[${k}].max`, `Fórmula do máximo de ${r.nome || 'recurso ' + (k + 1)}`, r.max, 'maxlength="200" class="er-formula"')}</label>
      <div class="er-cores" role="radiogroup" aria-label="Cor de ${esc(r.nome || 'recurso ' + (k + 1))}">${cores.map(c => `<button type="button" role="radio" class="er-cor" data-cor="${c}" aria-checked="${c === r.cor}" aria-label="${c}" style="--c:${c}" tabindex="${c === r.cor || (!cores.includes(r.cor) && c === cores[0]) ? 0 : -1}"></button>`).join('')}</div></li>`;
  }

  const opcoesOrigem = () => `<option value="lotm">Predefinição Lord of the Mysteries</option>${versoes.length ? `<optgroup label="Versões salvas">${versoes.map(v => `<option value="v:${v.versao}">Versão ${v.versao}${v === versoes[0] ? ' (em vigor)' : ''}</option>`).join('')}</optgroup>` : ''}`;
  function desenharForm(R, foco) {
    const g = R.geracao || {}, met = Object.hasOwn(METODOS, g.metodo) ? METODOS : { ...METODOS, [g.metodo]: String(g.metodo) };
    const opcoes = opcoesOrigem();
    $('#er-form').innerHTML = `
      <div class="m-campo"><label for="er-origem">Começar de</label><select id="er-origem">${opcoes}</select></div>
      <fieldset class="er-bloco" data-campo="atributos"><legend>Atributos <i>(nome · abreviação nas fórmulas · id)</i></legend>
        <ol class="er-ats" id="er-ats">${R.atributos.map(linhaAtributo).join('')}</ol>
        <button type="button" class="ghost er-mais" id="er-mais-at" ${R.atributos.length >= 12 ? 'disabled' : ''}>+ Atributo</button></fieldset>
      <fieldset class="er-bloco" data-campo="geracao"><legend>Geração dos atributos</legend>
        <div class="m-grade er-g3"><div class="m-campo"><label for="er-metodo">Método <i>(assistente de ficha)</i></label><select id="er-metodo">${Object.entries(met).map(([k, v]) => `<option value="${esc(k)}" ${k === g.metodo ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          <div class="m-campo"><label for="er-min">Mínimo</label><input type="number" id="er-min" data-campo="geracao" min="1" max="100" value="${esc(g.min)}" inputmode="numeric"></div>
          <div class="m-campo"><label for="er-max">Máximo</label><input type="number" id="er-max" data-campo="geracao" min="1" max="100" value="${esc(g.max)}" inputmode="numeric"></div></div></fieldset>
      <fieldset class="er-bloco"><legend>Fórmulas</legend>
        <label class="er-f" for="er-mod"><span>Modificador <i>(ATR = total do atributo)</i></span></label>${campoTexto('modificador', 'Fórmula do modificador', R.modificador, 'id="er-mod" maxlength="200" class="er-formula"').replace('aria-label="Fórmula do modificador" ', '')}
        <label class="er-f" for="er-total"><span>Total <i>(opcional; ATR = dado + bônus)</i></span></label>${campoTexto('total', 'Fórmula do total', R.total || '', 'id="er-total" maxlength="200" class="er-formula" placeholder="ATR"').replace('aria-label="Fórmula do total" ', '')}
        <p class="hint er-ajuda">Vale: números, <code>+ - * /</code>, parênteses, as abreviações acima, <code>SEQ</code>, <code>NIVEL</code>, <code>mod(VIG)</code>, <code>min</code>, <code>max</code>, <code>floor</code>.</p></fieldset>
      <fieldset class="er-bloco" data-campo="recursos"><legend>Recursos</legend>
        <ol class="er-rcs" id="er-rcs">${(R.recursos || []).map(linhaRecurso).join('')}</ol>
        <button type="button" class="ghost er-mais" id="er-mais-rc" ${(R.recursos || []).length >= 12 ? 'disabled' : ''}>+ Recurso</button></fieldset>
      <fieldset class="er-bloco" data-campo="bonus"><legend>Bônus</legend>
        <label class="er-check"><input type="checkbox" id="er-bonus" ${R.bonus ? 'checked' : ''}><span>Bônus de Caminho, Raça e Sequência ${base && base.bonus ? 'da regra de origem' : 'do Lord of the Mysteries'}</span></label></fieldset>`;
    $('#er-origem').value = origem;
    if (foco) { const el = $(foco); if (el) el.focus(); }
    atualizar();
  }

  // ---------- do formulário para o JSON ----------
  const valorDe = el => (el ? el.value : '');
  const numero = v => (String(v).trim() === '' ? null : Number(v));
  function ler() {
    const R = copia(base);
    R.atributos = [...C.raiz.querySelectorAll('.er-at')].map(li => ({ ...extrasDe(li), id: valorDe(li.querySelector('.er-id')).trim(), nome: valorDe(li.querySelector('.er-nome')).trim(), abrev: valorDe(li.querySelector('.er-abrev')).trim().toUpperCase() }));
    R.geracao = { ...(base.geracao || {}), metodo: valorDe($('#er-metodo')), min: numero(valorDe($('#er-min'))), max: numero(valorDe($('#er-max'))) };
    R.modificador = valorDe($('#er-mod')).trim();
    const tot = valorDe($('#er-total')).trim(); if (tot) R.total = tot; else delete R.total;
    R.recursos = [...C.raiz.querySelectorAll('.er-rc')].map((li, k) => {
      const marcada = li.querySelector('.er-cor[aria-checked="true"]');
      return { ...extrasDe(li), id: valorDe(li.querySelector('.er-id')).trim(), nome: valorDe(li.querySelector('.er-nome')).trim(), max: valorDe(li.querySelector('.er-formula')).trim(), cor: marcada ? marcada.dataset.cor : CORES[k % CORES.length] };
    });
    if ($('#er-bonus') && $('#er-bonus').checked) R.bonus = copia(base.bonus || Regras.LOTM.bonus); else delete R.bonus;
    return R;
  }
  // o editor redesenha as linhas a partir do que está na tela (para acrescentar/tirar sem perder o que foi digitado)
  function redesenhar(mudar, foco) {
    const R = ler();
    const auto = sel => [...C.raiz.querySelectorAll(sel)].map(li => !!li.querySelector('.er-id[data-auto]'));
    const aa = auto('.er-at'), ar = auto('.er-rc');
    R.atributos.forEach((a, k) => { if (aa[k]) a._auto = true; }); R.recursos.forEach((r, k) => { if (ar[k]) r._auto = true; });
    mudar(R); desenharForm(R, foco);
  }

  // ---------- erros, avisos e prévia ----------
  function rotuloCampo(campo, R) {
    const m = /^(atributos|recursos)\[(\d+)\]\.(\w+)$/.exec(campo);
    if (m) { const lista = R[m[1]] || [], x = lista[+m[2]] || {}; return `${m[1] === 'atributos' ? 'Atributo' : 'Recurso'} ${+m[2] + 1}${x.nome ? ` (${x.nome})` : ''}, ${NOME_CAMPO[m[3]] || m[3]}`; }
    return { atributos: 'Atributos', geracao: 'Geração', modificador: 'Modificador', total: 'Total', recursos: 'Recursos', 'bonus.caminho': 'Bônus de Caminho', 'bonus.raca': 'Bônus de Raça', 'bonus.sequencia': 'Bônus de Sequência' }[campo] || campo;
  }
  function textoDoCampo(campo, R) {
    const m = /^recursos\[(\d+)\]\.max$/.exec(campo);
    if (m) return ((R.recursos || [])[+m[1]] || {}).max;
    return campo === 'modificador' ? R.modificador : campo === 'total' ? R.total : null;
  }
  // a fórmula com o caractere do erro marcado (posição conta de 1, como o banco)
  function trecho(texto, pos) {
    const s = String(texto ?? ''), i = Math.max(0, Math.min(s.length, pos - 1));
    return `<code class="er-trecho">${esc(s.slice(0, i))}<mark>${i < s.length ? esc(s[i]) : '&nbsp;'}</mark>${esc(s.slice(i + 1))}</code>`;
  }

  function fichasDaMesa() { return (C.jogadores() || []).filter(j => j && j.ficha && j.ficha.base && typeof j.ficha.base === 'object'); }
  function fichaExemplo(R) {
    const g = R.geracao || {}, lo = Number.isInteger(g.min) ? g.min : 3, hi = Number.isInteger(g.max) ? g.max : 18;
    return { base: Object.fromEntries(R.atributos.map((a, k) => [a.id, Math.max(lo, Math.min(hi, EXEMPLO[k % EXEMPLO.length]))])), seq: +valorDe($('#er-seq')) || 0, caminhoId: '', racaId: '' };
  }
  function preencherFichas() {
    const sel = $('#er-ficha'); if (!sel) return; const antes = sel.value;
    sel.innerHTML = '<option value="ex">Exemplo (15, 14, 13, 12, 10, 8)</option>' + fichasDaMesa().map(j => `<option value="${esc(j.user_id)}">${esc(j.ficha.nome || j.nome || 'Jogador')}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === antes) ? antes : 'ex';
  }

  function previa(R) {
    const uid = valorDe($('#er-ficha')), j = uid && uid !== 'ex' ? fichasDaMesa().find(x => x.user_id === uid) : null;
    $('#er-seq').disabled = !!j;
    const ficha = j ? j.ficha : fichaExemplo(R);
    let novo, velho;
    try { novo = Regras.calcular(R, ficha); } catch (e) { return '<p class="hint">A prévia volta quando as fórmulas estiverem certas.</p>'; }
    try { velho = Regras.calcular(vigor(), ficha); } catch (e) { velho = { attrs: {}, mods: {}, maximos: {} }; }
    const dif = (a, b) => (b == null || a == null || a === b ? '' : `<i class="er-dif ${a > b ? 'sobe' : 'desce'}" title="Na ${esc(nomeVigor())}: ${b}">${a > b ? '▲' : '▼'} ${Math.abs(a - b)}</i>`);
    const ats = R.atributos.map(a => {
      const t = novo.attrs[a.id], m = novo.mods[a.id];
      return t == null
        ? `<li class="er-p-at falta"><b>${esc(a.abrev)}</b><span>${esc(a.nome)}</span><em>sem valor</em></li>`
        : `<li class="er-p-at"><b>${esc(a.abrev)}</b><span>${esc(a.nome)}</span><strong>${t}</strong><em>${sinal(m)}${dif(m, velho.mods[a.id])}</em></li>`;
    }).join('');
    const rcs = (R.recursos || []).map(r => {
      const v = novo.maximos[r.id], cor = /^#[0-9a-f]{6}$/i.test(r.cor || '') ? r.cor : '#9aa3b8';
      return `<li class="er-p-rc" style="--rc:${cor}"><span>${esc(r.nome || r.id)}</span><b>${v == null ? '—' : v}</b>${dif(v, velho.maximos[r.id])}<i class="er-p-barra" style="--p:${v == null ? 0 : Math.max(4, Math.min(100, v))}%"></i></li>`;
    }).join('');
    return `<p class="hint">${j ? `Ficha de ${esc(j.ficha.nome || j.nome)}, Sequência ${esc(ficha.seq ?? 9)}.` : 'Ficha de exemplo, sem Caminho nem raça.'} ▲▼ = diferença para a ${esc(nomeVigor())}.</p>
      <ul class="er-p-ats">${ats}</ul>${rcs ? `<ul class="er-p-rcs">${rcs}</ul>` : ''}`;
  }

  function avisos(R) {
    const a = [], fora = R.atributos.filter(x => x.id && !LOTM_IDS.includes(x.id));
    if (fora.length) a.push(`Teste pedido ainda não mira ${fora.map(x => x.nome || x.id).join(', ')}: por enquanto o banco só aceita os 6 atributos do Lord of the Mysteries nos pedidos (nas fórmulas eles já valem).`);
    const fichas = fichasDaMesa(), semValor = fichas.filter(j => { try { const c = Regras.calcular(R, j.ficha); return R.atributos.some(x => c.attrs[x.id] == null); } catch (e) { return false; } });
    if (semValor.length) a.push(`${semValor.length === 1 ? 'A ficha de ' + (semValor[0].ficha.nome || semValor[0].nome) + ' ficaria' : semValor.length + ' fichas da mesa ficariam'} com atributo sem valor (rolagem fora de ${R.geracao.min} a ${R.geracao.max}, ou atributo que a ficha não tem): o modificador vira 0.`);
    return a;
  }

  function atualizar() {
    if (!$('#er-form') || !$('#er-mod')) return;
    const R = ler();
    erros = Regras.validar(R);
    C.raiz.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    C.raiz.querySelectorAll('.er-bloco.invalido').forEach(el => el.classList.remove('invalido'));
    erros.forEach(e => {
      const els = C.raiz.querySelectorAll(`#er-form input[data-campo="${CSS.escape(e.campo)}"]`);
      els.forEach(el => el.setAttribute('aria-invalid', 'true'));
      if (!els.length) { const b = C.raiz.querySelector(`.er-bloco[data-campo="${CSS.escape(e.campo.split('.')[0])}"]`); if (b) b.classList.add('invalido'); }
    });
    const caixa = $('#er-erros');
    caixa.hidden = !erros.length;
    caixa.innerHTML = erros.length ? `<p><b>${erros.length === 1 ? '1 problema' : erros.length + ' problemas'}</b> para salvar:</p><ul>${erros.map(e => { const t = e.pos ? textoDoCampo(e.campo, R) : null; return `<li><b>${esc(rotuloCampo(e.campo, R))}:</b> ${esc(e.erro.replace(/^Fórmula inválida na posição \d+: /, e.pos ? `posição ${e.pos}: ` : ''))}${t != null ? trecho(t, e.pos) : ''}</li>`; }).join('')}</ul>` : '';
    const av = erros.length ? [] : avisos(R), ul = $('#er-avisos');
    ul.hidden = !av.length; ul.innerHTML = av.map(x => `<li>${esc(x)}</li>`).join('');
    $('#er-resultado').innerHTML = erros.length ? '<p class="hint">A prévia volta quando os problemas forem resolvidos.</p>' : previa(R);
    const igual = canon(R) === canon(vigor()), proxima = (versoes[0] ? versoes[0].versao : 0) + 1, cheio = proxima > 100;
    const bt = $('#er-salvar'); bt.disabled = !!erros.length || igual || cheio;
    bt.textContent = `Salvar versão ${proxima}`;
    $('#er-desfazer').disabled = canon(R) === canon(base);
    $('#er-estado').textContent = cheio ? 'Esta mesa chegou a 100 versões de regras.' : igual ? `Igual à ${nomeVigor()}, que está em vigor.` : erros.length ? '' : `Pronto para salvar: os testes passam a usar a versão ${proxima} na hora.`;
  }

  function desenharHistorico() {
    const ol = $('#er-hist'); if (!ol) return;
    const data = t => { const d = new Date(t); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    const resumo = R => `${(R.atributos || []).length} atributos · ${(R.recursos || []).length} recursos · mod ${R.modificador}`;
    ol.innerHTML = versoes.map((v, i) => `<li class="${i === 0 ? 'vigor' : ''}"><span class="er-h-v">v${v.versao}</span><div><b>${i === 0 ? 'Em vigor' : 'Versão ' + v.versao}</b> <small>${esc(data(v.criado_em))}</small><p>${esc(resumo(v.regras || {}))}</p></div>
      <button type="button" class="link-remover" data-carregar="${v.versao}">Abrir no editor<span class="sr-only"> a versão ${v.versao}</span></button></li>`).join('')
      + `<li class="${versoes.length ? '' : 'vigor'}"><span class="er-h-v">LotM</span><div><b>Predefinição${versoes.length ? '' : ' (em vigor)'}</b><p>${esc(resumo(Regras.LOTM))}</p></div><button type="button" class="link-remover" data-carregar="lotm">Abrir no editor<span class="sr-only"> a predefinição</span></button></li>`;
    $('#er-vigor').textContent = 'em vigor: ' + nomeVigor();
  }

  // ---------- carregar uma origem no editor ----------
  async function abrir(o, perguntar = true) {
    const v = o === 'lotm' ? null : versoes.find(x => 'v:' + x.versao === o);
    if (o !== 'lotm' && !v) return;
    if (perguntar && base && $('#er-mod') && canon(ler()) !== canon(base)) {
      const sim = await C.confirmar({ titulo: 'Trocar as regras do editor?', texto: 'O que você mudou e não salvou será perdido.', botao: 'Trocar' });
      if (!sim) { $('#er-origem').value = origem; return; }
    }
    origem = o; base = copia(v ? v.regras : Regras.LOTM);
    desenharForm(copia(base));
  }

  // lê as versões de novo (outra aba ou aparelho do mestre pode ter salvo uma). Se o editor estava na versão em vigor
  // e sem mudanças, passa para a nova; com mudanças, só atualiza a lista (nada digitado se perde).
  async function carregar() {
    if (!C) return;
    const topoAntes = origem === (versoes[0] ? 'v:' + versoes[0].versao : 'lotm'), limpo = !base || !$('#er-mod') || canon(ler()) === canon(base);
    try {
      const r = await (await Rede.tabela('mestre', 'mesa_regras')).select('versao,regras,criado_em').eq('mesa_id', C.mesaId).order('versao', { ascending: false }).limit(100);
      if (r.error) throw r.error; versoes = r.data || [];
    } catch (e) { const el = $('#m-erro-regras'); if (el) { el.textContent = Rede.mensagem(e); el.hidden = false; } }
    desenharHistorico(); preencherFichas();
    const topo = versoes[0] ? 'v:' + versoes[0].versao : 'lotm';
    if (!base || (limpo && topoAntes && origem !== topo)) await abrir(topo, false);
    else { const s = $('#er-origem'); if (s) { s.innerHTML = opcoesOrigem(); s.value = origem; } atualizar(); }
  }

  async function salvar() {
    const R = ler(), el = $('#m-erro-regras'); el.hidden = true;
    if (Regras.validar(R).length) return atualizar();
    const n = (versoes[0] ? versoes[0].versao : 0) + 1;
    const sim = await C.confirmar({ titulo: `Salvar a versão ${n}?`, texto: `Os testes desta mesa passam a usar estas regras na hora. Cada ficha é recalculada quando o jogador sincronizar. A ${nomeVigor()} continua guardada no histórico.`, botao: `Salvar versão ${n}` });
    if (!sim) return;
    try {
      const r = await (await Rede.tabela('mestre', 'mesa_regras')).insert({ mesa_id: C.mesaId, regras: R }).select('versao,regras,criado_em');
      if (r.error) throw r.error;
      const nova = r.data && r.data[0]; if (nova) versoes = [nova].concat(versoes.filter(x => x.versao !== nova.versao));
      origem = 'v:' + (nova ? nova.versao : n); base = copia(nova ? nova.regras : R);
      desenharHistorico(); desenharForm(copia(base), '#er-salvar');
      C.anunciar(`Regras salvas: versão ${nova ? nova.versao : n} em vigor`);
      el.textContent = `Versão ${nova ? nova.versao : n} salva e em vigor.`; el.classList.add('m-ok'); el.hidden = false;
    } catch (e) { el.classList.remove('m-ok'); el.textContent = Rede.mensagem(e); el.hidden = false; }
  }

  // ---------- eventos (delegados: o formulário é redesenhado ao acrescentar/tirar linhas) ----------
  function ligar(ctx) {
    C = ctx; versoes = []; base = null; origem = 'lotm'; erros = [];
    const raiz = C.raiz;
    raiz.addEventListener('input', e => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.matches('.er-id')) delete t.dataset.auto;
      if (t.matches('.er-nome')) {   // id e abreviação acompanham o nome enquanto o mestre não mexer neles
        const li = t.closest('li'), id = li && li.querySelector('.er-id[data-auto]');
        if (id) id.value = idDe(t.value);
        const ab = li && li.querySelector('.er-abrev'); if (ab && li.dataset.novo) ab.value = abrevDe(t.value);
      }
      if (t.matches('.er-abrev')) { if (t.closest('li')) delete t.closest('li').dataset.novo; }
      if (t.id === 'er-origem') return;
      atualizar();
    });
    raiz.addEventListener('change', e => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t.id === 'er-origem') return abrir(t.value);
      if (t.id === 'er-ficha' || t.id === 'er-seq' || t.id === 'er-metodo' || t.id === 'er-bonus') atualizar();
    });
    raiz.addEventListener('click', e => {
      const b = /** @type {HTMLElement} */ (e.target).closest('button'); if (!b || !raiz.contains(b)) return;
      if (b.id === 'er-mais-at') { redesenhar(R => { R.atributos.push({ id: '', nome: '', abrev: '', _auto: true }); }, null); focarNovo('.er-at'); return; }
      if (b.id === 'er-mais-rc') { redesenhar(R => { R.recursos.push({ id: '', nome: '', max: '10', cor: CORES[R.recursos.length % CORES.length], _auto: true }); }, null); focarNovo('.er-rc'); return; }
      if (b.dataset.tirarAt != null) return redesenhar(R => { R.atributos.splice(+b.dataset.tirarAt, 1); }, '#er-mais-at');
      if (b.dataset.tirarRc != null) return redesenhar(R => { R.recursos.splice(+b.dataset.tirarRc, 1); }, '#er-mais-rc');
      if (b.classList.contains('er-cor')) { marcarCor(b); return atualizar(); }
      if (b.dataset.carregar) { const o = b.dataset.carregar === 'lotm' ? 'lotm' : 'v:' + b.dataset.carregar; abrir(o).then(() => { const s = $('#er-origem'); if (s) s.focus(); }); return; }
      if (b.id === 'er-desfazer') { desenharForm(copia(base), '#er-origem'); C.anunciar('Mudanças desfeitas'); return; }
      if (b.id === 'er-salvar') { if (b.disabled) return; b.disabled = true; salvar().finally(() => { if (b.isConnected) atualizar(); }); }
    });
    // cores: setas andam no grupo (radiogroup)
    raiz.addEventListener('keydown', e => {
      const b = /** @type {HTMLElement} */ (e.target); if (!b.classList || !b.classList.contains('er-cor')) return;
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
      e.preventDefault(); const bs = [...b.parentElement.querySelectorAll('.er-cor')], i = (bs.indexOf(b) + k + bs.length) % bs.length;
      marcarCor(bs[i]); bs[i].focus(); atualizar();
    });
    carregar();
  }
  function marcarCor(b) {
    b.parentElement.querySelectorAll('.er-cor').forEach(x => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    const li = b.closest('.er-rc'); if (li) li.style.setProperty('--rc', b.dataset.cor);
  }
  function focarNovo(sel) { const l = C.raiz.querySelectorAll(sel), li = l[l.length - 1]; if (!li) return; li.dataset.novo = '1'; const n = li.querySelector('.er-nome'); if (n) n.focus(); }

  // o painel avisa quando a lista de jogadores muda (a prévia pode usar a ficha deles)
  function jogadoresMudaram() { if (C && $('#er-ficha')) { preencherFichas(); atualizar(); } }

  // o painel chama ao abrir a aba Regras
  function aoAbrir() { if (C && $('#er-form')) carregar(); }

  return { secao, ligar, jogadoresMudaram, aoAbrir };
})());
