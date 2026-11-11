// Tipos SÓ para o verificador (npm run tipos). O site não carrega este arquivo.
// O código escolhe elementos por seletor (querySelector devolve "Element", sem saber se é um campo, um botão...).
// Em vez de anotar centenas de linhas, afrouxamos aqui só as propriedades de DOM mais usadas. O que importa para
// o verificador é achar nome errado, chamada errada e valor indefinido, e isso continua valendo.
interface Element {
  dataset: any; value: any; hidden: any; disabled: any; checked: any; focus(options?: any): void; click(): void;
  offsetWidth: number; offsetHeight: number; offsetParent: any; style: any; select(): void;
  tabIndex: number; title: string; selectionStart: any; selectionEnd: any; setSelectionRange(a: any, b: any): void;
  getContext(tipo: string, opcoes?: any): any; files: any;
}
interface Element { setAttribute(nome: string, valor: any): void; }   // o navegador converte número em texto sozinho
interface Node { contains(outro: any): boolean; }
interface EventTarget { value: any; replaceWith(...nos: any[]): void; closest(seletor: string): any; classList: any; dataset: any; files: any; }
interface Event { pointerId: any; key: any; clientX: any; clientY: any; deltaY: any; }
interface Window {
  turnstile: any; supabase: any; gsap: any; webkitAudioContext: any; __onRetrato: any; Painel: any;
  sincronizarPainelSom: any; onTick: any; aplicarVitalFicha: any;
}

// js/regras.js também é carregado pelo Node nos testes (module.exports); no navegador é um global
declare const Regras: typeof import("./regras.js");
declare const Papeis: typeof import("./papeis.js");
