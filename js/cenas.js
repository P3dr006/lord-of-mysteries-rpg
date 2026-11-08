// Cenas com GSAP (linhas do tempo): sussurro, decreto do mestre e virada de turno da Roda.
// Tudo aqui é ENFEITE: o conteúdo já está na página e visível pelo CSS. Sem GSAP (rede, "reduzir movimento"), cada função
// devolve false e a cena segue só com as animações CSS. A classe "gs" desliga as animações CSS dos elementos que o GSAP
// passa a conduzir (senão as duas brigariam pela mesma propriedade).
const Cenas = Object.freeze((() => {
  const $$ = (raiz, sel) => Array.from(raiz.querySelectorAll(sel));

  // O sussurro: névoa (CSS), título que sai do desfoque, palavras que surgem uma a uma e a pista como papel que se desdobra.
  function sussurro(m) {
    if (!Animar.pode() || m.classList.contains('relendo')) return false;
    const g = window.gsap, olho = m.querySelector('.sus-olho'), h2 = m.querySelector('h2'), pal = $$(m, '.sus-texto span'),
      pista = m.querySelector('.sus-pista'), bt = m.querySelector('.primary');
    m.classList.add('gs');
    const tl = g.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(m, { opacity: 0 }, { opacity: 1, duration: .6, ease: 'power1.out', clearProps: 'opacity' }, 0);
    if (olho) tl.fromTo(olho, { opacity: 0, letterSpacing: '.7em' }, { opacity: 1, letterSpacing: '.32em', duration: 1.2, clearProps: 'all' }, .1);
    if (h2) tl.fromTo(h2, { opacity: 0, y: 22, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, clearProps: 'all' }, .3);
    if (pal.length) tl.fromTo(pal, { opacity: 0, y: 14, filter: 'blur(7px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .7, stagger: { amount: Math.min(2.6, pal.length * .045) }, clearProps: 'all' }, .75);
    if (pista) tl.fromTo(pista, { opacity: 0, rotateX: -42, y: 30, scale: .92, rotate: -6, transformPerspective: 900, transformOrigin: '50% 0%' },
      { opacity: 1, rotateX: 0, y: 0, scale: 1, rotate: -1.6, duration: 1.15, ease: 'back.out(1.3)' }, .9);
    if (bt) tl.fromTo(bt, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, clearProps: 'all' }, pal.length || pista ? '>-.4' : 1);
    return true;
  }

  // O decreto: o papel cai e se assenta, o texto surge e o selo de cera CARIMBA com impacto (o papel treme e um anel se abre).
  function decreto(m) {
    if (!Animar.pode()) return false;
    const g = window.gsap, papel = m.querySelector('.dec-papel'), selo = m.querySelector('.dec-selo');
    if (!papel || !selo) return false;
    const partes = ['.dec-olho', 'h2', '.dec-hab', '.dec-recado', '.primary'].map(s => m.querySelector(s)).filter(Boolean);
    m.classList.add('gs');
    const ruim = m.classList.contains('recusa');
    const anel = document.createElement('span'); anel.className = 'dec-anel'; anel.setAttribute('aria-hidden', 'true'); selo.appendChild(anel);
    const tl = g.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(m, { opacity: 0 }, { opacity: 1, duration: .4, ease: 'power1.out', clearProps: 'opacity' }, 0)
      .fromTo(papel, { y: -70, rotate: -3.5, opacity: 0, scale: .95 }, { y: 0, rotate: 0, opacity: 1, scale: 1, duration: .75, clearProps: 'transform,opacity' }, 0)
      .fromTo(partes, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .5, stagger: .09, clearProps: 'all' }, .4)
      .fromTo(selo, { scale: 2.8, rotate: ruim ? 28 : -38, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: .5, ease: 'back.out(2.4)', transformOrigin: '50% 50%', clearProps: 'all' }, .85)
      .to(papel, { y: ruim ? 8 : 5, duration: .07, ease: 'power2.in' }, 1.28)
      .to(papel, { y: 0, duration: .5, ease: 'elastic.out(1.3,.35)', clearProps: 'transform' }, 1.35)
      .fromTo(anel, { scale: .7, opacity: ruim ? .5 : .85 }, { scale: 2.6, opacity: 0, duration: .85, ease: 'power2.out' }, 1.3);
    return true;
  }

  // A Roda: quem ganhou a vez salta com mola, a chama acende e a faixa rola até centralizá-lo.
  function turno(li, { rodada = false } = {}) {
    if (!Animar.pode() || !li) return false;
    const g = window.gsap, chama = li.querySelector('.rd-chama'), fila = li.parentElement;
    g.fromTo(li, { scale: .88, y: 8 }, { scale: 1, y: 0, duration: 1, ease: 'elastic.out(1.1,.42)', clearProps: 'transform' });
    if (chama) g.fromTo(chama, { scaleY: .3, opacity: 0 }, { scaleY: 1, opacity: 1, duration: .55, ease: 'back.out(3)', clearProps: 'transform,opacity' });
    if (fila && fila.scrollWidth > fila.clientWidth) {
      const alvo = Math.max(0, li.offsetLeft - (fila.clientWidth - li.offsetWidth) / 2);
      g.to(fila, { scrollLeft: alvo, duration: .7, ease: 'power2.inOut' });
    }
    if (rodada) { const rod = li.closest('.rd-bat'); const r = rod && rod.querySelector('.rd-rod'); if (r) g.fromTo(r, { scale: 1.5, color: '#fff3c4' }, { scale: 1, duration: .8, ease: 'back.out(2)', clearProps: 'all' }); }
    return true;
  }

  return { sussurro, decreto, turno };
})());
