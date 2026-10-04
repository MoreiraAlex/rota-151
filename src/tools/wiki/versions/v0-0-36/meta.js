import DATA from './data.json'

/**
 * Wiki da versão 0.0.36 do jogo — a primeira. Menu e situação dos dados.
 *
 * `data: null` = versão ATUAL: os números são lidos do jogo na hora
 * (`buildWikiData`). Quando uma versão nova da wiki abrir, esta congela:
 * `npm run wiki:freeze -- 0.0.36` grava `data.json` aqui e `data` passa a
 * importá-lo, então os números desta versão nunca mais mudam.
 *
 * `soon: true` marca página que ainda não tem conteúdo (vai entrar quando a
 * mecânica estiver definida) — aparece no menu como "em breve".
 */
export const WIKI_V0_0_36 = {
  id: '0.0.36',
  // Congelada (retrato da 0.0.36, antes do nível por criatura e do XP).
  data: DATA,
  nav: [
    {
      title: 'Começando',
      links: [
        { slug: '', label: 'Início' },
        { slug: 'controles', label: 'Controles', soon: true },
        { slug: 'treinador', label: 'O treinador', soon: true },
      ],
    },
    {
      title: 'Criaturas',
      links: [
        { slug: 'criaturas/status', label: 'Status' },
        { slug: 'criaturas/vida-e-energia', label: 'Vida e energia' },
        { slug: 'criaturas/seu-time', label: 'Seu time' },
      ],
    },
    {
      title: 'Batalha',
      links: [
        { slug: 'batalha/golpes', label: 'Golpes' },
        { slug: 'batalha/dano', label: 'Dano' },
        { slug: 'batalha/acerto-e-erro', label: 'Acerto e erro' },
        { slug: 'batalha/efeitos', label: 'Efeitos em batalha' },
        { slug: 'batalha/energia-e-recarga', label: 'Energia e recarga' },
        { slug: 'batalha/alcance-e-area', label: 'Alcance e área' },
        { slug: 'batalha/desmaio', label: 'Desmaio' },
      ],
    },
    {
      title: 'Criaturas selvagens',
      links: [
        { slug: 'selvagens/comportamento', label: 'Comportamento' },
        { slug: 'selvagens/como-lutam', label: 'Como as criaturas lutam' },
      ],
    },
    {
      title: 'Pokédex',
      links: [{ slug: 'pokedex', label: 'Scanner e registro' }],
    },
    {
      title: 'Catálogo',
      links: [
        { slug: 'catalogo/criaturas', label: 'Criaturas' },
        { slug: 'catalogo/golpes', label: 'Golpes' },
        { slug: 'catalogo/itens', label: 'Itens', soon: true },
      ],
    },
    {
      title: 'Ferramentas',
      links: [{ slug: 'calculadora', label: 'Calculadora de dano' }],
    },
  ],
}
