// Configuração PÚBLICA do site. Só entra aqui o que foi feito para ficar no navegador.
// NUNCA coloque neste arquivo: senha do banco, chave service_role / sb_secret_, tokens pessoais.
// (O verificador de segredos bloqueia o commit se isso acontecer.)
const CONFIG = {
  supabase: {
    url: 'https://adkecwrxjmmzqxnmwips.supabase.co',
    chave: 'sb_publishable_qndZD1sDMoBmF6ejtlQO-Q_TdOrSWRf', // chave pública (segredo-ok)
  },
  // Cloudflare Turnstile (anti-robô). A chave do SITE é pública; a chave SECRETA fica só no painel do Supabase.
  // Vazio = desligado. Só preencha depois de criar o widget, e ligue o CAPTCHA no Supabase em seguida.
  captcha: { chave: '0x4AAAAAAF4042VahWN-Z87Y' }, // Site Key pública (segredo-ok)
};
