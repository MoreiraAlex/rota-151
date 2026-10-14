/**
 * Floresta (docs/features/047-biomas.md) — Mata fechada de clima ameno e
 * úmido, com colinas médias.
 * Campos: ver `../_template/`.
 */
export const FOREST = {
  id: 'forest',
  name: 'Floresta',
  size: 700,
  climate: {
    temperature: [0.2, 0.7],
    humidity: [0.45, 0.85],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  relief: {
    baseHeight: 4,
    hillHeight: 7,
    hillSize: 120,
    roughness: 0.25,
    flatness: 1.2,
  },
  // A paleta casa com as texturas do Let's Go (a média delas): é a cor do
  // relevo distante — de perto, a cor vem das texturas (`ground.colors`).
  palette: {
    bed: '#6b5a3a',
    shore: '#c99c5a',
    // A mata fechada (a maior parte) puxa para o chão de mata, escuro.
    low: '#2c7438',
    high: '#286a33',
    highHeight: 10,
    slope: '#4a7c2b',
    trail: '#c39549',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js). `colors`:
  // a cor vem das texturas do Let's Go — grama nas clareiras, chão de mata
  // onde é fechado, terra na trilha e na margem, pedra com musgo na
  // encosta (docs/features/052-assets-do-lgpe-e-floresta.md).
  ground: {
    texture: 'forest-floor',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.7,
    colors: {
      base: 'lgpe-grass',
      shade: 'lgpe-grass-bright',
      trail: 'lgpe-soil-dark',
      shore: 'lgpe-soil',
      slope: 'lgpe-soil',
    },
  },
  // Trilhas de terra batida cortando a mata (core/terrain/trails.js).
  trails: true,
  // Mata fechada com clareiras, em camadas, com os modelos do Pokémon Let's
  // Go (`models`, docs/features/052-assets-do-lgpe-e-floresta.md): árvores
  // redondas grandes espalhadas (a copa alta), redondas comuns, bosques de
  // pinheiros de Viridian e uma ou outra árvore jovem; por baixo,
  // samambaias, moitas redondas, trevos e tufos (`patches`). Tudo isso
  // rareia nas clareiras, onde ficam as flores e a maioria dos conjuntos de
  // grama (`clusters`) — com o mato alto do Let's Go no miolo deles.
  clearings: { amount: 0.3 },
  vegetation: [
    {
      kind: 'ancient-tree',
      density: 0.55,
      place: 'shade',
      scale: 1.45,
      models: ['round-tree-d'],
    },
    {
      kind: 'pine-tree',
      density: 0.7,
      place: 'shade',
      patches: { amount: 0.3, size: 50 },
      scale: 1.1,
      models: ['pine-viridian'],
    },
    {
      kind: 'broadleaf-tree',
      density: 0.7,
      place: 'shade',
      scale: 1.2,
      models: ['round-tree', 'round-tree-b', 'round-tree-c'],
    },
    {
      kind: 'dead-tree',
      density: 0.2,
      place: 'shade',
      models: ['young-tree'],
    },
    {
      kind: 'bush',
      density: 0.6,
      place: 'shade',
      patches: { amount: 0.55, size: 16 },
      models: ['fern', 'round-bush'],
    },
    {
      kind: 'fern',
      density: 0.9,
      place: 'shade',
      patches: { amount: 0.4, size: 14 },
      models: ['fern-loose', 'clover-large'],
    },
    {
      kind: 'leafy-plant',
      density: 0.8,
      place: 'shade',
      patches: { amount: 0.3, size: 10 },
      models: ['clover', 'tuft'],
    },
    // Pedrinhas soltas na terra batida das trilhas.
    {
      kind: 'pebble',
      density: 0.8,
      place: 'trail',
      scale: 0.5,
      models: ['rock-small'],
    },
    { kind: 'rock', density: 2, scale: 1.8, models: ['rock-large'] },
    {
      kind: 'flower',
      density: 0.5,
      place: 'clearing',
      models: ['flower-white', 'flower-yellow', 'flower-forest'],
    },
    // O mato alto do Let's Go, no miolo dos conjuntos de grama.
    {
      kind: 'encounter-grass',
      density: 1,
      models: ['tall-grass', 'tall-grass-2'],
    },
    // Grama em conjuntos (o mato alto, core/vegetation/grassClusters.js):
    // manchas fechadas, a maioria nas clareiras, com grama baixa e rala
    // entre elas — o chão da mata fica para samambaias, arbustos e
    // cogumelos.
    {
      kind: 'tall-grass',
      density: 0.75,
      clusters: {
        density: 1,
        size: 14,
        sizeVariation: 0.6,
        roughness: 0.5,
        edge: 0.05,
        height: 1.15,
        holes: 0.25,
        coverage: 0.45,
        grouping: 0.5,
        variety: 0.35,
        background: 0.12,
        backgroundHeight: 0.55,
        clearingPreference: 0.5,
      },
      models: ['tall-grass', 'tall-grass-2'],
      colors: { a: '#ffffff', b: '#f2f5d8' },
    },
  ],
  tags: ['forest', 'temperate', 'humid'],
  weather: { clear: 4, sun: 1, rain: 4, storm: 1, snow: 0 },
}
