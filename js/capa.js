// Capa: 22 sigilos orbitando o botão; o Caminho do personagem salvo brilha.
function montarCapa() {
  const orbit = document.querySelector('#orbit');
  const salvo = idAtivoSalvo() ? carregar() : null;
  const ativo = salvo && salvo.nome && salvo.caminho ? salvo.caminho : null;
  orbit.innerHTML = '';
  CAMINHOS.forEach((c, i) => {
    const a = (i * 2 * Math.PI) / CAMINHOS.length - Math.PI / 2;
    const r = i % 2 ? 41.5 : 46;                       // duas "pistas" alternadas
    const sg = document.createElement('div');
    sg.className = 'sg' + (c.id === ativo ? ' ativo' : '');
    sg.style.left = (50 + r * Math.cos(a)) + '%';
    sg.style.top = (50 + r * Math.sin(a)) + '%';
    sg.style.setProperty('--c', c.cor);
    sg.style.setProperty('--d', (i * -0.35) + 's');
    sg.title = c.nome + ' (clique para ouvir)';
    sg.addEventListener('click', () => tocarCaminho(c.id));
    sg.innerHTML = `<span class="in"><img src="img/sigilos/${c.id}.webp" alt="${c.nome}" loading="lazy"></span>`;
    sg.querySelector('img').addEventListener('error', e => { e.target.replaceWith(Object.assign(document.createElement('span'), { className: 'fallback', innerHTML: svgGlifo(c, 40) })); });
    orbit.appendChild(sg);
  });
  const info = document.querySelector('#cover-saved');
  if (ativo) {
    const c = caminhoPorId(ativo);
    info.hidden = false;
    info.innerHTML = `${salvo.retrato ? `<img class="mini-ret" src="${salvo.retrato}" alt="">` : ''}<span><b>${salvo.nome.replace(/[&<>"]/g, '')}</b> · Caminho ${c.nome} · ${c.seq9}</span>`;
    info.style.setProperty('--c', c.cor);
  } else info.hidden = true;
  const temNome = !!(salvo && salvo.nome), n = _lista().length;
  document.querySelector('#btn-continue').hidden = !temNome;
  if (temNome) document.querySelector('#continue-txt').textContent = 'Continuar: ' + salvo.nome;
  const lib = document.querySelector('#btn-lib'); lib.hidden = n < 2;
  if (n >= 2) document.querySelector('#lib-txt').textContent = `Meus personagens (${n})`;
}
