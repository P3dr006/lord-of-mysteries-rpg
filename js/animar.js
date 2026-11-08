// Carregador do GSAP, compartilhado pelo dado 3D e pelas cenas (decreto, sussurro, Roda).
// É OPCIONAL: o GSAP só é baixado quando alguém abre a mesa (versão fixa + hash de integridade). Sem rede, com
// "reduzir movimento" ligado ou se o navegador recusar, quem usa cai nas animações CSS de sempre.
const Animar = Object.freeze((() => {
  const GSAP = {
    src: 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js',
    sri: 'sha384-XmJ9SoHtVOHoQUcKvFAzVXwdkKo1Ie3bhmSoIAkcdsHGaIrVJIkmozyq0FJeb/Ly',
  };
  const temGSAP = () => typeof window.gsap === 'object' && !!window.gsap && typeof window.gsap.timeline === 'function';
  const reduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let baixando = null;

  function preparar() {
    if (temGSAP()) return Promise.resolve(true);
    if (baixando) return baixando;
    baixando = new Promise(ok => {
      const s = document.createElement('script');
      s.src = GSAP.src; s.integrity = GSAP.sri; s.crossOrigin = 'anonymous'; s.async = true;
      const fim = setTimeout(() => { s.remove(); ok(false); }, 6000);
      s.onload = () => { clearTimeout(fim); ok(temGSAP()); };
      s.onerror = () => { clearTimeout(fim); s.remove(); ok(false); };
      document.head.appendChild(s);
    }).then(r => { if (!r) baixando = null; return r; });   // falhou: a próxima tentativa baixa de novo
    return baixando;
  }
  // espera o GSAP por no máximo "ms"; devolve true se já dá para animar com ele
  const pronto = ms => Promise.race([preparar(), new Promise(ok => setTimeout(() => ok(false), ms))]);
  // pode animar agora? (GSAP carregado e a pessoa não pediu menos movimento)
  const pode = () => temGSAP() && !reduzido();

  return { GSAP, temGSAP, reduzido, preparar, pronto, pode };
})());
