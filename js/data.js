// Dados estáticos do sistema
const ATTRS = [
  { key: 'forca',  nome: 'Força',          desc: 'Poder físico bruto' },
  { key: 'agil',   nome: 'Agilidade',      desc: 'Reflexos e precisão' },
  { key: 'vigor',  nome: 'Vigor',          desc: 'Resistência e saúde' },
  { key: 'intel',  nome: 'Intelecto',      desc: 'Raciocínio e conhecimento' },
  { key: 'espir',  nome: 'Espiritualidade', desc: 'Sintonia com o místico' },
  { key: 'pres',   nome: 'Presença',       desc: 'Carisma e vontade' },
];

// Patamares de Sequência (9 = mais fraca, 0 = divindade)
const SEQ_NAMES = {
  9: 'Baixa', 8: 'Baixa', 7: 'Baixa',
  6: 'Média', 5: 'Média',
  4: 'Semideus', 3: 'Santo', 2: 'Anjo', 1: 'Rei Anjo', 0: 'Divindade'
};
