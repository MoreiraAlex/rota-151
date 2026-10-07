/**
 * Wiki da fase 0.0.x do jogo (antes do primeiro beta) — menu e situação dos
 * dados. A wiki tem UMA versão por beta (MINOR do semver: 0.0.x, 0.1.x, ...),
 * não uma por feature: as features do beta atualizam esta versão no lugar.
 *
 * `data: null` = versão ATUAL: os números são lidos do jogo na hora
 * (`buildWikiData`). Quando o beta 0.1.0 sair, esta congela:
 * `npm run wiki:freeze -- 0.0.x` grava `data.json` aqui e `data` passa a
 * importá-lo, então os números desta versão nunca mais mudam.
 *
 * `soon: true` marca página que ainda não tem conteúdo (vai entrar quando a
 * mecânica estiver definida) — aparece no menu como "em breve".
 */
export const WIKI_V0_0_X = {
  id: '0.0.x',
  data: null,
  nav: [
    {
      title: 'Começando',
      links: [
        { slug: '', label: 'Início' },
        { slug: 'controles', label: 'Controles', soon: true },
        { slug: 'treinador', label: 'O treinador', soon: true },
        { slug: 'inventario', label: 'Inventário' },
      ],
    },
    {
      title: 'Criaturas',
      links: [
        { slug: 'criaturas/status', label: 'Status' },
        { slug: 'criaturas/vida-e-energia', label: 'Vida e energia' },
        { slug: 'criaturas/seu-time', label: 'Seu time' },
        {
          slug: 'criaturas/experiencia-e-nivel',
          label: 'Experiência e nível',
        },
        { slug: 'criaturas/golpes-e-treino', label: 'Golpes e treino' },
      ],
    },
    {
      title: 'Batalha',
      links: [
        { slug: 'batalha/golpes', label: 'Golpes' },
        { slug: 'batalha/dano', label: 'Dano' },
        { slug: 'batalha/tipos', label: 'Tipos' },
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
        { slug: 'catalogo/itens', label: 'Itens' },
      ],
    },
    {
      title: 'Ferramentas',
      links: [{ slug: 'calculadora', label: 'Calculadora de dano' }],
    },
  ],
}
