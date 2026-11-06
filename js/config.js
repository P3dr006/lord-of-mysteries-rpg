// Configuração PÚBLICA do site. Só entra aqui o que foi feito para ficar no navegador.
// NUNCA coloque neste arquivo: senha do banco, chave service_role / sb_secret_, tokens pessoais.
// (O verificador de segredos bloqueia o commit se isso acontecer.)
const CONFIG = {
  supabase: {
    url: 'https://adkecwrxjmmzqxnmwips.supabase.co',
    chave: 'sb_publishable_qndZD1sDMoBmF6ejtlQO-Q_TdOrSWRf', // chave pública (segredo-ok)
  },
};
