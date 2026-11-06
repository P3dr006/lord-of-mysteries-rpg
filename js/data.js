// Dados estáticos do sistema
const ATTRS = [
  { key: 'forca',  nome: 'Força',          desc: 'Poder físico bruto', cor: '#ff7a5c', g: '<path d="M5 19L17 7M14 4h6v6M3 21l3-3M7 15l2 2"/>' },
  { key: 'agil',   nome: 'Agilidade',      desc: 'Reflexos e precisão', cor: '#6fe0c5', g: '<path d="M3 12c4-6 9-6 18-3-4 1-6 3-6 3 4 0 6 2 6 2-9 3-14 3-18-2z"/>' },
  { key: 'vigor',  nome: 'Vigor',          desc: 'Resistência e saúde', cor: '#ff6a8a', g: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.7A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/>' },
  { key: 'intel',  nome: 'Intelecto',      desc: 'Raciocínio e conhecimento', cor: '#7ab8ff', g: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>' },
  { key: 'espir',  nome: 'Espiritualidade', desc: 'Sintonia com o místico', cor: '#b08cff', g: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>' },
  { key: 'pres',   nome: 'Presença',       desc: 'Carisma e vontade', cor: '#ffd36a', g: '<path d="M3 18l2-11 5 5 2-8 2 8 5-5 2 11zM3 21h18"/>' },
];

// Patamares de Sequência (9 = mais fraca, 0 = divindade)
const SEQ_NAMES = {
  9: 'Baixa', 8: 'Baixa', 7: 'Baixa',
  6: 'Média', 5: 'Média',
  4: 'Semideus', 3: 'Santo', 2: 'Anjo', 1: 'Rei Anjo', 0: 'Divindade'
};
