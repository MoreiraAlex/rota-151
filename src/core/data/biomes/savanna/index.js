/**
 * Savana (docs/features/047-biomas.md) — Campo seco e quente, de terra
 * batida com manchas de grama e árvores esparsas. Na beta, a casa de
 * Rattata, Spearow e Ekans: como as rotas secas e pedregosas de Kanto
 * (docs/features/054-savana-lgpe-e-saida-do-megakit.md).
 * Campos: ver `../_template/`.
 */
export const SAVANNA = {
  id: 'savanna',
  name: 'Savana',
  size: 800,
  climate: {
    temperature: [0.6, 0.9],
    humidity: [0.2, 0.5],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  // Os vales descem um pouco abaixo da água (`hillHeight` maior que
  // `baseHeight`): lagoas espalhadas, como os bebedouros da savana.
  relief: {
    baseHeight: 2,
    hillHeight: 3.5,
    hillSize: 200,
    roughness: 0.15,
    flatness: 1.2,
  },
  // Rios e lagos (docs/features/057-lagos-e-rios.md): menos que nos biomas
  // úmidos — os bebedouros dos vales já fazem parte da água.
  water: { rivers: 0.6, lakes: 0.7 },
  // A paleta casa com as texturas do Let's Go (a média delas): é a cor do
  // relevo distante — de perto, a cor vem das texturas (`ground.colors`).
  // O chão baixo e alto é a mistura da terra com as manchas de grama; a
  // encosta, o penhasco de terra.
  palette: {
    bed: '#6f5a3a',
    shore: '#f7e19e',
    low: '#a5a848',
    high: '#a5a848',
    highHeight: 8,
    slope: '#986e49',
    trail: '#bb9261',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js). `colors`:
  // terra batida na maior parte (`shade`, fora das clareiras), grama nas
  // manchas abertas (`base`, as clareiras), terra clara na trilha, areia
  // na margem e o penhasco de terra das rotas secas na encosta.
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.6,
    colors: {
      base: 'lgpe-soil',
      shade: 'lgpe-sand',
      shore: 'lgpe-sand',
    },
  },
  // As manchas de grama no meio da terra (as clareiras pintam o chão de
  // grama, `ground.colors.base`).
  clearings: { amount: 0.4 },
  // Trilhas de terra batida cruzando o campo (core/terrain/trails.js).
  trails: false,
  // As rotas secas de Kanto com os modelos do Pokémon Let's Go (`models`):
  // árvores redondas esparsas, moitas, tufos, pedras na terra,
  // seixos na trilha e conjuntos de grama nas manchas, com o mato alto de
  // encontro no miolo. O verde puxa para o amarelado seco pela tinta
  // (`tint`).
  vegetation: [
    {
      kind: 'acacia-tree',
      density: 0.6,
      models: ['round-tree', 'round-tree-b', 'round-tree-f'],
      tint: { color: '#c8b860', amount: 0.75 },
    },
    {
      kind: 'bush',
      density: 0.35,
      patches: { amount: 0.3, size: 12 },
      models: ['round-bush', 'shrub'],
      tint: { color: '#d0b860', amount: 0.75 },
    },
    {
      kind: 'leafy-plant',
      density: 0.4,
      patches: { amount: 0.4, size: 10 },
      models: ['tuft-route', 'tuft-medium'],
      tint: { color: '#e0c060', amount: 1 },
    },
    {
      kind: 'flower',
      density: 0,
      patches: { amount: 0.3, size: 10 },
      models: ['flower-yellow'],
    },
    {
      kind: 'rock',
      density: 0.3,
      scale: 1.4,
      models: ['rock-dirt-c'],
    },
    // Pedrinhas soltas na terra batida das trilhas.
    {
      kind: 'pebble',
      density: 0.6,
      place: 'trail',
      models: ['rock-dirt', 'rock-dirt-b', 'rock-soil', 'rock-soil-b'],
    },
    // O mato alto do Let's Go, no miolo dos conjuntos de grama.
    {
      kind: 'encounter-grass',
      density: 0.8,
      models: ['tall-grass', 'tall-grass-2'],
      tint: { color: '#e0c060', amount: 1 },
    },
    {
      kind: 'tall-grass',
      density: 0.7,
      clusters: {
        density: 1,
        size: 28,
        sizeVariation: 0.7,
        roughness: 0.4,
        edge: 0.1,
        height: 1.4,
        holes: 0.15,
        coverage: 0.75,
        grouping: 0,
        variety: 0.3,
        background: 0,
        backgroundHeight: 0.5,
        clearingPreference: 0.5,
      },
      models: ['tall-grass', 'tall-grass-2'],
      colors: { a: '#ffffff', b: '#fff0c8' },
      tint: { color: '#e0c060', amount: 1 },
    },
  ],
  // Pokébolas no chão (docs/features/055-itens-no-mundo.md).
  worldItems: {
    chance: 0.05,
    maxPerChunk: 1,
    refillMinutes: 120,
    table: [
      { itemId: 'poke-ball', weight: 10 },
      { itemId: 'great-ball', weight: 1 },
      { itemId: 'ultra-ball', weight: 0.5 },
    ],
  },
  // A fruta da vegetação (docs/features/055-itens-no-mundo.md): todo
  // arbusto e toda árvore podem ter, sorteado a cada dia.
  forage: {
    itemId: 'pinap-berry',
    bush: { chance: 0.15, min: 1, max: 2 },
    tree: { chance: 0.25, min: 1, max: 3 },
  },
  tags: ['grassland', 'hot', 'dry'],
  weather: { clear: 4, sun: 4, rain: 1.5, storm: 0.5, snow: 0 },
}
