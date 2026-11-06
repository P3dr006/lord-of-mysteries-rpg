// Raças, origens e Cartas de Destino
const RACAS = [
  // --- Humanidade ---
  { id:'humano', grupo:'Humanidade', nome:'Humano', icone:'👤', bonus:{ intel:1, pres:1, vigor:1 },
    desc:'A raça que domina a Quinta Época. Fisicamente frágil, mas ambiciosa e adaptável; quem bebe poções se torna Beyonder.',
    traco:'Adaptável: pode refazer um teste fracassado uma vez por sessão.' },
  // --- Raças Antigas ---
  { id:'mutante', grupo:'Raças Antigas', nome:'Humano Mutante', icone:'🧬', bonus:{ vigor:2, forca:1, pres:-1 },
    desc:'Humanos alterados pela contaminação e pelo poder místico na Época Escura, outrora governados pelo Rei Mutante Kvastir.',
    traco:'Carne Instável: resiste a doenças e toxinas, mas sua aparência inquieta os outros.' },
  { id:'gigante', grupo:'Raças Antigas', nome:'Gigante', icone:'🗻', bonus:{ forca:3, vigor:1, agil:-2 },
    desc:'Colossos de força imensa que dominavam o norte, ligados ao Caminho do Guerreiro.',
    traco:'Passada Pesada: carrega o dobro do peso e derruba oponentes menores.' },
  { id:'elfo', grupo:'Raças Antigas', nome:'Elfo', icone:'🧝', bonus:{ agil:2, espir:1, forca:-1 },
    desc:'Belos e ligados aos mares e às tempestades, liderados pelo Rei Elfo Soniathrym.',
    traco:'Voz da Tempestade: sente mudanças de clima e se move bem sobre a água.' },
  { id:'sanguineo', grupo:'Raças Antigas', nome:'Sanguíneo', icone:'🩸', bonus:{ vigor:2, pres:1, espir:-1 },
    desc:'Os vampiros do mundo: aristocratas arrogantes, longevos e de grande regeneração, descendentes da ancestral Lilith.',
    traco:'Regeneração: recupera 1 PV no início de cada turno de combate (se não estiver sob luz solar forte).' },
  { id:'lobo', grupo:'Raças Antigas', nome:'Lobo Demoníaco', icone:'🐺', bonus:{ agil:2, intel:1, pres:-1 },
    desc:'Lobos gigantes de inteligência extraordinária e traços místicos, ligados à ocultação e à escuridão; seu líder era Flegrea.',
    traco:'Faro do Destino: sente rastros e perigos próximos.' },
  { id:'dragao', grupo:'Raças Antigas', nome:'Dragão', icone:'🐉', bonus:{ forca:2, intel:2, espir:1, pres:-2 },
    desc:'Criaturas aladas colossais de poder mental ou elemental, como Ankewelt, o Dragão da Imaginação.',
    traco:'Sopro Ancestral: uma vez por sessão, libera uma rajada de força elemental.' },
  { id:'fenix', grupo:'Raças Antigas', nome:'Fênix', icone:'🔥', bonus:{ espir:2, agil:1, vigor:-1 },
    desc:'Seres míticos que governavam os céus, ligados ao Caminho da Morte e à pós-vida.',
    traco:'Renascer em Cinzas: ao cair a 0 PV, uma vez por campanha, volta com metade dos PV.' },
  { id:'diabo', grupo:'Raças Antigas', nome:'Diabo', icone:'😈', bonus:{ pres:2, forca:1, espir:-1 },
    desc:'Nascidos da pura corrupção e do desejo de destruição, nativos do Caminho do Abismo.',
    traco:'Pacto Sombrio: vantagem em barganhas e intimidação, com sanidade mais frágil.' },
  // --- Povo do Mar ---
  { id:'sereia', grupo:'Povo do Mar', nome:'Sereia', icone:'🧜', bonus:{ espir:2, pres:1, forca:-1 },
    desc:'Metade humano, metade peixe, conhecidas pelo canto místico, essenciais para o avanço no Caminho do Marinheiro.',
    traco:'Canto Místico: pode acalmar ou confundir ouvintes próximos.' },
  { id:'peixe', grupo:'Povo do Mar', nome:'Homem-Peixe', icone:'🐟', bonus:{ agil:1, vigor:1, pres:-1 },
    desc:'Humanoides adaptados à vida subaquática, com guelras e escamas.',
    traco:'Guelras: respira sob a água e nada com facilidade.' },
  // --- Mundo Espiritual ---
  { id:'banshee', grupo:'Mundo Espiritual', nome:'Banshee do Terror', icone:'👻', bonus:{ espir:2, pres:1, vigor:-2 },
    desc:'Espíritos femininos cujos gritos dilaceram a alma.',
    traco:'Grito Dilacerante: uma vez por cena, abala a mente de quem ouvir.' },
  { id:'fohan', grupo:'Mundo Espiritual', nome:'Cão de Fohan', icone:'🐕', bonus:{ agil:2, vigor:1, intel:-1 },
    desc:'Criaturas que correm pelas linhas do Mundo Espiritual e caçam viajantes.',
    traco:'Caçada Espiritual: rastreia alvos pelo Mundo Espiritual.' },
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
