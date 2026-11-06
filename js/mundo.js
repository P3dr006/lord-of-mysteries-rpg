// Raças, origens e Cartas de Destino
const RACAS = [
  { id:'humano', nome:'Humano', icone:'👤', bonus:{ intel:1, pres:1, vigor:1 },
    desc:'Adaptável e ambicioso. A maioria dos Beyonders nasce entre eles.', traco:'Adaptável: pode refazer um teste fracassado uma vez por sessão.' },
  { id:'elfo', nome:'Elfo do Crepúsculo', icone:'🌙', bonus:{ agil:2, espir:1, forca:-1 },
    desc:'Esguios, longevos e sensíveis ao invisível.', traco:'Olhos do Crepúsculo: enxerga bem na penumbra.' },
  { id:'anao', nome:'Anão das Forjas', icone:'⚒', bonus:{ vigor:2, forca:1, agil:-1 },
    desc:'Robustos, teimosos e mestres do metal e do vapor.', traco:'Pele de Forja: resiste a calor e a veneno comum.' },
  { id:'sereiano', nome:'Sereiano', icone:'🌊', bonus:{ espir:2, agil:1, forca:-1 },
    desc:'Povo das marés, com voz que embala e confunde.', traco:'Fôlego das Marés: respira sob a água.' },
  { id:'gigante', nome:'Meio-Gigante', icone:'🗻', bonus:{ forca:2, vigor:1, intel:-1 },
    desc:'Descendentes dos antigos gigantes do crepúsculo.', traco:'Passada Pesada: carrega o dobro do peso.' },
  { id:'lunar', nome:'Filho da Lua', icone:'🌕', bonus:{ pres:2, espir:1, vigor:-1 },
    desc:'Nascidos sob a lua vermelha, belos e inquietos.', traco:'Brilho Lunar: vantagem em testes de sedução à noite.' },
  { id:'cinzas', nome:'Nascido das Cinzas', icone:'🔥', bonus:{ pres:1, forca:1, espir:1, intel:-1 },
    desc:'Marcados por um antepassado demoníaco, com chama no sangue.', traco:'Centelha Interior: acende fogo pequeno com um toque.' },
  { id:'palido', nome:'Sangue-Pálido', icone:'🩸', bonus:{ agil:1, pres:1, vigor:1, espir:-1 },
    desc:'Linhagem de sangue frio, elegante e sedenta.', traco:'Sede Contida: cura 1 PV ao ferir um inimigo (1x por cena).' },
];

const ORIGENS = [
  { id:'nobre', nome:'Nobre Decaído', icone:'🏰', libras:30,
    itens:['Anel de brasão', 'Roupas finas', 'Carta de apresentação'], perk:'Etiqueta: conhece regras da alta sociedade.' },
  { id:'operario', nome:'Operário de Fábrica', icone:'🏭', libras:8,
    itens:['Macacão remendado', 'Chave inglesa', 'Relógio de bolso barato'], perk:'Mãos calejadas: reconhece máquinas e defeitos.' },
  { id:'marinheiro', nome:'Marinheiro', icone:'⚓', libras:12,
    itens:['Faca de marujo', 'Bússola', 'Capa impermeável'], perk:'Pés no convés: nunca enjoa e conhece os portos.' },
  { id:'estudioso', nome:'Estudioso', icone:'📚', libras:15,
    itens:['Caderno cifrado', 'Lupa', 'Livro de ocultismo raro'], perk:'Biblioteca mental: sabe onde achar informação.' },
  { id:'clerigo', nome:'Noviço de Igreja', icone:'⛪', libras:10,
    itens:['Símbolo sagrado', 'Pequeno missal', 'Vela bendita'], perk:'Fé treinada: resiste a influências sombrias.' },
  { id:'mercenario', nome:'Mercenário', icone:'⚔', libras:14,
    itens:['Revólver velho', 'Faca de combate', 'Colete de couro'], perk:'Cicatrizes de guerra: sabe avaliar adversários.' },
  { id:'rua', nome:'Criança das Ruas', icone:'🌫', libras:3,
    itens:['Gazua', 'Mapa dos becos', 'Casaco puído'], perk:'Instinto de rua: percebe emboscadas e rotas de fuga.' },
  { id:'boticario', nome:'Aprendiz de Boticário', icone:'⚗', libras:11,
    itens:['Frasco de ervas', 'Bisturi', 'Receituário'], perk:'Mãos de cura: estabiliza feridos com facilidade.' },
];

// d12: traços de destino (nem sempre bons)
const TRACOS = [
  { t:'Sonhos Proféticos', d:'Uma vez por sessão, o mestre revela uma pista de um sonho seu.' },
  { t:'Sombra Alongada', d:'Sua sombra se move um instante depois de você. Vantagem em furtividade; animais desconfiam.' },
  { t:'Voz Familiar', d:'Ouve sussurros que às vezes ajudam e às vezes mentem.' },
  { t:'Dívida de Sangue', d:'Alguém poderoso espera um favor seu. Pode ser aliado ou perigo.' },
  { t:'Olhar Magnético', d:'+1 em Presença, mas não consegue passar despercebido.' },
  { t:'Mão de Sorte', d:'Uma vez por sessão, role um dado de novo.' },
  { t:'Ferida que não fecha', d:'Uma cicatriz antiga dói perto de coisas sobrenaturais — um alerta.' },
  { t:'Nome Esquecido', d:'Pessoas esquecem seu nome rápido. Ótimo para fugir, ruim para ser lembrado.' },
  { t:'Relógio Parado', d:'Seu relógio sempre para antes de eventos importantes.' },
  { t:'Inimigo Oculto', d:'Alguém o vigia. Sorte ou azar quando menos esperar.' },
  { t:'Coração de Aço', d:'Vantagem contra medo, mas dificuldade em demonstrar emoção.' },
  { t:'Marca Estelar', d:'Uma marca lembra uma constelação. Reconhecido por certos cultos.' },
];

// d10: artefatos selados (dádiva e maldição)
const ARTEFATOS = [
  { n:'Moeda de Duas Faces', dadiva:'Uma vez por sessão, decide um cara-ou-coroa a seu favor.', maldicao:'Depois, deve dizer uma verdade desconfortável.' },
  { n:'Chave Sem Porta', dadiva:'Abre qualquer fechadura simples.', maldicao:'Às vezes abre o que devia ficar fechado.' },
  { n:'Lamparina de Ossos', dadiva:'Sua luz revela espíritos próximos.', maldicao:'Espíritos também veem você.' },
  { n:'Espelho Rachado', dadiva:'Mostra o reflexo verdadeiro de uma pessoa.', maldicao:'Mostra também o seu — e nem sempre agrada.' },
  { n:'Relicário Murmurante', dadiva:'+2 de Espiritualidade em rituais.', maldicao:'Sussurra durante o sono; descanso pior.' },
  { n:'Luvas de Cinza', dadiva:'Segura objetos quentes ou perigosos sem dano.', maldicao:'Esquenta sozinha em momentos de tensão.' },
  { n:'Baralho Incompleto', dadiva:'Pode sacar uma carta para um aviso vago.', maldicao:'Falta sempre a carta que você mais precisa.' },
  { n:'Colar de Dentes', dadiva:'+1 PV por cena ao vencer um combate.', maldicao:'Fica famoso entre predadores.' },
  { n:'Diário em Branco', dadiva:'Qualquer coisa escrita é lembrada para sempre.', maldicao:'Páginas somem quando você mente.' },
  { n:'Sino Silencioso', dadiva:'Abafa sons num raio curto.', maldicao:'Quando toca, algo desperta ao longe.' },
];

const racaPorId = id => RACAS.find(r => r.id === id);
const origemPorId = id => ORIGENS.find(o => o.id === id);
