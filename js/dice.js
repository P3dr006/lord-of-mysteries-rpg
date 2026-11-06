// Dado 3D (CSS) — face voltada para o jogador após a rolagem
const FACE_ROT = {
  1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0]
};
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};
const FACE_POS = {
  1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 2: 'rotateY(90deg)',
  5: 'rotateY(-90deg)', 3: 'rotateX(90deg)', 4: 'rotateX(-90deg)'
};

function criarDado() {
  const wrap = document.createElement('div');
  wrap.className = 'die';
  const cube = document.createElement('div');
  cube.className = 'cube';
  for (let n = 1; n <= 6; n++) {
    const f = document.createElement('div');
    f.className = 'face';
    f.style.transform = FACE_POS[n] + ' translateZ(var(--half))';
    for (let i = 0; i < 9; i++) {
      const c = document.createElement('i');
      if (PIPS[n].includes(i)) c.className = 'pip';
      f.appendChild(c);
    }
    cube.appendChild(f);
  }
  wrap.appendChild(cube);
  wrap._cube = cube;
  return wrap;
}

function mostrarFace(dado, valor, animar = true) {
  const [rx, ry] = FACE_ROT[valor];
  const cube = dado._cube;
  if (!animar) {
    cube.style.transition = 'none';
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    return Promise.resolve();
  }
  const ex = 360 * (2 + Math.floor(Math.random() * 2));
  const ey = 360 * (2 + Math.floor(Math.random() * 2));
  cube.style.transition = 'none';
  cube.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`;
  void cube.offsetWidth;
  const dur = 1100 + Math.random() * 500;
  cube.style.transition = `transform ${dur}ms cubic-bezier(.15,.7,.2,1)`;
  cube.style.transform = `rotateX(${rx + ex}deg) rotateY(${ry + ey}deg)`;
  return new Promise(res => setTimeout(res, dur + 50));
}

const d = n => 1 + Math.floor(Math.random() * n);

// 4d6 descartando o menor. Retorna { dados, descartado(índice), total }
function rolar4d6() {
  const dados = [d(6), d(6), d(6), d(6)];
  let menor = 0;
  dados.forEach((v, i) => { if (v < dados[menor]) menor = i; });
  const total = dados.reduce((a, b) => a + b, 0) - dados[menor];
  return { dados, descartado: menor, total };
}
