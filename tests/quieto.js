// Saída enxuta dos testes (economiza leitura): `--quieto` mostra só as falhas (com o título da seção) e o placar.
// `--ate=7e` (só no mestre.js) para depois da seção 7e, pulando as seguintes. Sem as opções, nada muda.
const quieto = process.argv.includes('--quieto') || process.env.QUIETO === '1';
const ateArg = process.argv.find(a => a.startsWith('--ate='));
const ate = ateArg ? ateArg.slice(6).toLowerCase() : '';
if (quieto || ate) {
  const log = console.log.bind(console);
  let secao = '', secaoMostrada = true, passouDoAlvo = false, oks = 0, falhas = 0;
  console.log = (...args) => {
    const t = args.map(String).join(' ');
    if (/^\n\S/.test(t) && !/testes passaram/.test(t)) {        // título de seção
      const nome = t.trim().toLowerCase();
      if (ate && passouDoAlvo) {                                // chegou na seção seguinte ao alvo: encerra aqui
        log(`\n${oks} de ${oks + falhas} testes passaram${falhas ? ` — ${falhas} FALHARAM` : ''} (parou depois da seção ${ate})`);
        process.exit(falhas ? 1 : 0);
      }
      if (ate && nome.startsWith(ate)) passouDoAlvo = true;
      secao = t; secaoMostrada = !quieto; if (!quieto) log(t);
      return;
    }
    if (/^ {2}ok {2}/.test(t)) { oks++; if (!quieto) log(t); return; }
    if (/^ FALHA/.test(t)) { falhas++; if (!secaoMostrada) { log(secao); secaoMostrada = true; } log(t); return; }
    log(t);
  };
}
