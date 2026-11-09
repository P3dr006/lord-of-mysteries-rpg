// Mesa online (Supabase): cliente compartilhado pela página do mestre e pelo lado do jogador.
// É OPCIONAL: a biblioteca só é baixada quando alguém usa a mesa online, e só se houver rede.
// Sem rede, sem banco ou com a CDN fora do ar, o resto do site continua funcionando igual.
const Rede = Object.freeze((() => {
  // Versão FIXA + hash de integridade: se o arquivo da CDN mudar, o navegador recusa.
  const SDK = {
    src: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
    sri: 'sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK',
  };
  const ESPERA_MS = 12000;
  const clientes = {};          // um cliente por papel: a sessão do mestre não apaga a do jogador
  let baixando = null;

  class ErroRede extends Error { constructor(msg, codigo) { super(msg); this.codigo = codigo; } }

  const configurada = () => typeof CONFIG === 'object' && CONFIG && CONFIG.supabase && !!CONFIG.supabase.url && !!CONFIG.supabase.chave;
  const temSDK = () => typeof window.supabase === 'object' && window.supabase && typeof window.supabase.createClient === 'function';

  function baixarSDK() {
    if (temSDK()) return Promise.resolve();
    if (baixando) return baixando;
    baixando = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = SDK.src; s.integrity = SDK.sri; s.crossOrigin = 'anonymous'; s.async = true;
      const fim = setTimeout(() => { s.remove(); falha(new ErroRede('A conexão demorou demais. Tente de novo.', 'tempo')); }, ESPERA_MS);
      // @ts-expect-error resolve sem valor é válido; o verificador exige um argumento
      s.onload = () => { clearTimeout(fim); temSDK() ? ok() : falha(new ErroRede('Não foi possível iniciar a mesa online.', 'sdk')); };
      s.onerror = () => { clearTimeout(fim); s.remove(); falha(new ErroRede('Sem conexão com a mesa online. O resto do site continua funcionando.', 'sem-rede')); };
      document.head.appendChild(s);
    }).catch(e => { baixando = null; throw e; });   // falhou: a próxima tentativa baixa de novo
    return baixando;
  }

  async function cliente(papel = 'jogador') {
    if (clientes[papel]) return clientes[papel];
    if (!configurada()) throw new ErroRede('A mesa online não está configurada neste site.', 'config');
    if (navigator.onLine === false) throw new ErroRede('Você está sem internet. A ficha e os dados continuam funcionando sem a mesa online.', 'offline');
    await baixarSDK();
    clientes[papel] = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.chave, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'lotm-rpg-auth-' + papel },
    });
    return clientes[papel];
  }

  // Regra de senha para criar conta: a mesma configurada no Supabase (mínimo 10, minúscula, maiúscula e número).
  const REGRA_SENHA = 'A senha precisa ter pelo menos 10 caracteres, com letra minúscula, maiúscula e número.';
  const senhaForte = s => typeof s === 'string' && s.length >= 10 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);

  // Erros do banco viram frases para pessoas (a frase das funções do servidor já vem em português).
  function mensagem(e) {
    if (!e) return 'Algo deu errado.';
    if (e instanceof ErroRede) return e.message;
    // (REGRA_SENHA e senhaForte ficam logo abaixo desta função)
    const m = String(e.message || e.error_description || e);
    if (/Anonymous sign-ins are disabled/i.test(m)) return 'A mesa online ainda não aceita jogadores sem conta. Avise o mestre: no Supabase, ligar “Allow anonymous sign-ins”.';
    if (/Signups not allowed|Email signups are disabled/i.test(m)) return 'O cadastro por e-mail está desligado no Supabase (Authentication → Sign In / Providers → Email).';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme o e-mail pelo link que enviamos antes de entrar.';
    if (/User already registered/i.test(m)) return 'Este e-mail já tem conta. Use “Entrar”.';
    if (/Password should|weak.password|password.*(known|easy to guess|pwned)/i.test(m)) return REGRA_SENHA;
    if (/different from the old password|same_password/i.test(m)) return 'A nova senha precisa ser diferente da senha antiga.';
    if (/current password/i.test(m)) return 'O Supabase pediu a senha atual para trocar a senha. Avise o administrador do site.';
    if (/session missing|not authenticated/i.test(m)) return 'O link de recuperação venceu. Peça um novo em “Esqueci minha senha”.';
    if (/captcha/i.test(m)) return 'A verificação anti-robô falhou. Recarregue a página e tente de novo.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
    if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return 'A imagem ficou grande demais para o servidor. Tente outra.';
    if (/mime type .*not supported|invalid_mime_type/i.test(m)) return 'Esse formato de imagem não é aceito (use JPG, PNG ou WebP).';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem conexão com a mesa online. Tente de novo em instantes.';
    if (/[áéíóúâêôãõç]/i.test(m) || /^(Entre|Limite|Mesa|A mesa|Pedido|Este|Jogador|Só|Escreva|Sussurro)\b/.test(m)) return m;   // frases das nossas funções
    return 'Não deu certo: ' + m.slice(0, 120);
  }

  const resposta = r => { if (r.error) throw r.error; return r.data; };

  // ---------- verificação anti-robô (Cloudflare Turnstile) ----------
  // Só vale quando CONFIG.captcha.chave existir (a chave do SITE é pública). Sem ela nada é pedido, e o CAPTCHA
  // do Supabase (Authentication > Attack Protection) precisa estar desligado: os dois andam juntos.
  const CAPTCHA_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const captchaLigado = () => typeof CONFIG === 'object' && CONFIG && CONFIG.captcha && !!CONFIG.captcha.chave;
  const erroCaptcha = msg => new ErroRede(msg || 'Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.', 'captcha');
  let baixandoCaptcha = null;
  function baixarCaptcha() {
    if (window.turnstile) return Promise.resolve();
    if (baixandoCaptcha) return baixandoCaptcha;
    baixandoCaptcha = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = CAPTCHA_SRC; s.async = true;   // sem SRI: a Cloudflare exige carregar a versão dela, sempre atual
      const fim = setTimeout(() => { s.remove(); falha(erroCaptcha('A verificação anti-robô demorou demais. Tente de novo.')); }, ESPERA_MS);
      // @ts-expect-error resolve sem valor é válido; o verificador exige um argumento
      s.onload = () => { clearTimeout(fim); window.turnstile ? ok() : falha(erroCaptcha()); };
      s.onerror = () => { clearTimeout(fim); s.remove(); falha(erroCaptcha('Sem conexão com a verificação anti-robô. Tente de novo.')); };
      document.head.appendChild(s);
    }).catch(e => { baixandoCaptcha = null; throw e; });
    return baixandoCaptcha;
  }
  // Um token novo por tentativa (vale uma vez só). O desafio só aparece na tela se a Cloudflare achar necessário.
  async function tokenCaptcha() {
    if (!captchaLigado()) return undefined;
    await baixarCaptcha();
    return new Promise((ok, falha) => {
      const caixa = document.createElement('div'); caixa.className = 'captcha-caixa'; document.body.appendChild(caixa);
      let id;
      const limpar = () => { clearTimeout(fim); try { window.turnstile.remove(id); } catch (e) { /* já removido */ } caixa.remove(); };
      const fim = setTimeout(() => { limpar(); falha(erroCaptcha('A verificação anti-robô demorou demais. Tente de novo.')); }, 60000);
      try {
        id = window.turnstile.render(caixa, {
          sitekey: CONFIG.captcha.chave, appearance: 'interaction-only',
          callback: t => { limpar(); ok(t); },
          'error-callback': () => { limpar(); falha(erroCaptcha()); },
        });
      } catch (e) { limpar(); falha(erroCaptcha()); }
    });
  }
  const comCaptcha = (t, o = {}) => (t ? { ...o, captchaToken: t } : o);

  // ---------- autenticação ----------
  async function usuario(papel) { const c = await cliente(papel); const s = resposta(await c.auth.getSession()); return s && s.session ? s.session.user : null; }
  async function entrarAnonimo() {
    const atual = await usuario('jogador'); if (atual) return atual;
    const c = await cliente('jogador'), t = await tokenCaptcha();
    return resposta(await c.auth.signInAnonymously(t ? { options: { captchaToken: t } } : undefined)).user;
  }
  async function entrarEmail(email, senha) {
    const c = await cliente('mestre'), t = await tokenCaptcha();
    return resposta(await c.auth.signInWithPassword(t ? { email, password: senha, options: { captchaToken: t } } : { email, password: senha })).user;
  }
  async function criarConta(email, senha) {
    const c = await cliente('mestre'), t = await tokenCaptcha();
    const volta = /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined;
    const d = resposta(await c.auth.signUp({ email, password: senha, options: comCaptcha(t, volta ? { emailRedirectTo: volta } : {}) }));
    return { user: d.user, precisaConfirmar: !d.session };
  }
  // ---------- recuperar a senha ----------
  // O link do e-mail volta para esta página com "#...type=recovery". O supabase-js apaga esse trecho da barra ao lê-lo,
  // por isso o tipo do link é lido ANTES de criar o cliente. Devolve 'ok' (link de recuperação), 'erro' (link vencido/usado) ou ''.
  const linkDeRecuperacao = () => { const h = location.hash || ''; return /[#&]type=recovery\b/.test(h) ? 'ok' : /[#&]error(_code)?=/.test(h) ? 'erro' : ''; };
  const limparLink = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sem histórico: segue */ } };
  async function pedirRecuperacao(email) {
    const c = await cliente('mestre'), t = await tokenCaptcha();
    const volta = /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined;
    resposta(await c.auth.resetPasswordForEmail(email, comCaptcha(t, volta ? { redirectTo: volta } : {})));
  }
  async function novaSenha(senha) { const c = await cliente('mestre'); return resposta(await c.auth.updateUser({ password: senha })).user; }
  async function sair(papel) { const c = clientes[papel]; if (c) await c.auth.signOut(); }

  // ---------- dados ----------
  async function rpc(papel, nome, args) { const c = await cliente(papel); return resposta(await c.rpc(nome, args)); }
  async function tabela(papel, nome) { return (await cliente(papel)).from(nome); }

  // Tempo real: as regras de RLS valem para quem escuta. Devolve uma função para parar de ouvir.
  async function ouvir(papel, nomeCanal, tabelaNome, filtro, cb) {
    const c = await cliente(papel);
    const canal = c.channel(nomeCanal + '-' + Math.random().toString(36).slice(2, 8))
      .on('postgres_changes', { event: '*', schema: 'public', table: tabelaNome, filter: filtro }, cb)
      .subscribe();
    return () => { try { c.removeChannel(canal); } catch (e) { /* já fechado */ } };
  }

  // Presença (quem está com a aba aberta): canal com o nome da mesa; quem passa `dados` se anuncia, todos recebem o estado.
  async function presenca(papel, mesaId, chave, dados, aoMudar) {
    const c = await cliente(papel);
    const canal = c.channel('presenca-' + mesaId, { config: { presence: { key: chave } } });
    canal.on('presence', { event: 'sync' }, () => { try { aoMudar(canal.presenceState()); } catch (e) { /* tela já fechou */ } })
      .subscribe(async st => { if (st === 'SUBSCRIBED' && dados) { try { await canal.track(dados); } catch (e) { /* tenta na reconexão */ } } });
    return () => { try { c.removeChannel(canal); } catch (e) { /* já fechado */ } };
  }

  // ---------- imagens no Storage (bucket privado "imagens"; regras de quem vê no banco: migração 20261114) ----------
  // A linha guarda só o caminho. Para mostrar, o site pede uma URL assinada (1 h) e a reaproveita enquanto vale:
  // a mesma URL = o navegador usa o cache em vez de baixar de novo.
  const BUCKET = 'imagens', VALIDADE_S = 3600;
  const EXT_IMG = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
  const caminhoOk = c => typeof c === 'string' && /^(bestiario|mesas)\/[\w-]{1,64}\/[\w-]{1,64}\.(webp|jpg|png)$/.test(c);
  const assinadas = new Map();   // caminho -> { url, vence }
  const urlDoStorage = u => typeof u === 'string' && /^[^"'<>\s`]+$/.test(u) && typeof CONFIG === 'object' && u.startsWith(CONFIG.supabase.url.replace(/\/$/, '') + '/storage/v1/object/sign/' + BUCKET + '/');
  const novoNome = ext => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')) + '.' + ext;
  // data:image/webp;base64,... → Blob (sem fetch: a CSP não deixa buscar data:)
  function blobDe(dataUrl) {
    const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new ErroRede('Imagem inválida.');
    const bin = atob(m[2]), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return new Blob([b], { type: m[1] });
  }
  const pastaOk = p => typeof p === 'string' && /^(bestiario|mesas)\/[\w-]{1,64}$/.test(p);
  // Envia a imagem já reduzida (comprimirImagem) para a pasta e devolve o caminho novo.
  async function enviarImagem(papel, pasta, dataUrl) {
    if (!pastaOk(pasta)) throw new ErroRede('Pasta de imagem inválida.');
    const blob = blobDe(dataUrl), caminho = pasta + '/' + novoNome(EXT_IMG[blob.type]);
    const c = await cliente(papel);
    resposta(await c.storage.from(BUCKET).upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
    return caminho;
  }
  // Copia um arquivo (ex.: retrato do bestiário → pasta da mesa, ao revelar) e devolve o caminho da cópia.
  async function copiarImagem(papel, de, pasta) {
    if (!caminhoOk(de) || !pastaOk(pasta)) throw new ErroRede('Imagem inválida.');
    const para = pasta + '/' + novoNome(de.split('.').pop());
    const c = await cliente(papel);
    resposta(await c.storage.from(BUCKET).copy(de, para));
    return para;
  }
  // Apagar é "melhor esforço": se falhar, o arquivo fica órfão, mas nada quebra para quem joga.
  async function apagarImagens(papel, caminhos) {
    const l = (caminhos || []).filter(caminhoOk); if (!l.length) return;
    try { const c = await cliente(papel); await c.storage.from(BUCKET).remove(l); l.forEach(x => assinadas.delete(x)); } catch (e) { /* fica órfão */ }
  }
  async function apagarPasta(papel, pasta) {
    if (!pastaOk(pasta)) return;
    try { const c = await cliente(papel), r = await c.storage.from(BUCKET).list(pasta, { limit: 1000 }); await apagarImagens(papel, (r.data || []).map(o => pasta + '/' + o.name)); } catch (e) { /* fica órfão */ }
  }
  // caminhos → Map(caminho → URL assinada). Pede de uma vez só as que faltam; o que o banco negar fica de fora.
  async function urlsDasImagens(papel, caminhos) {
    const agora = Date.now(), fora = new Map(), faltam = [];
    for (const x of new Set((caminhos || []).filter(caminhoOk))) { const a = assinadas.get(x); if (a && a.vence - agora > 300e3) fora.set(x, a.url); else faltam.push(x); }
    if (faltam.length) {
      try {
        const c = await cliente(papel), r = await c.storage.from(BUCKET).createSignedUrls(faltam, VALIDADE_S);
        for (const s of (r.data || [])) if (s && !s.error && urlDoStorage(s.signedUrl) && faltam.includes(s.path)) { assinadas.set(s.path, { url: s.signedUrl, vence: agora + VALIDADE_S * 1000 }); fora.set(s.path, s.signedUrl); }
      } catch (e) { /* sem rede: a imagem só não aparece */ }
    }
    return fora;
  }

  return { cliente, configurada, mensagem, usuario, entrarAnonimo, entrarEmail, criarConta, pedirRecuperacao, novaSenha, linkDeRecuperacao, limparLink, sair, rpc, tabela, ouvir, presenca, SDK, ErroRede, senhaForte, REGRA_SENHA,
    enviarImagem, copiarImagem, apagarImagens, apagarPasta, urlsDasImagens, caminhoOk };
})());
