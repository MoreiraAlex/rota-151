/**
 * Planície (docs/features/047-biomas.md) — Campo aberto de grama, com
 * colinas baixas. Clima ameno.
 * Campos: ver `../_template/`.
 */
export const PLAINS = {
  id: 'plains',
  name: 'Planície',
  size: 900,
  climate: {
    temperature: [0.25, 0.7],
    humidity: [0.15, 0.55],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  relief: {
    baseHeight: 3.5,
    hillHeight: 4,
    hillSize: 140,
    roughness: 0.2,
    flatness: 1.4,
  },
  // A paleta casa com a textura do Let's Go (a média dela): é a cor do
  // relevo distante — de perto, a cor vem da textura (`ground.colors`). O
  // chão é todo grama (sem margem, trilha ou alto por textura), então
  // todos os papéis usam a mesma cor; a encosta, um verde um pouco mais
  // escuro para o morro distante não ficar chapado.
  palette: {
    bed: '#6b5a3e',
    shore: '#77c546',
    low: '#77c546',
    high: '#77c546',
    highHeight: 8,
    slope: '#64ad3a',
    trail: '#77c546',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js). `colors`:
  // a cor vem da grama do Let's Go em todo o chão, trilha e margem
  // inclusive (docs/features/053-planicie-com-assets-do-lgpe.md).
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.6,
    colors: {
      base: 'lgpe-grass',
    },
  },
  // Trilhas de terra batida cruzando o campo (core/terrain/trails.js).
  trails: false,
  // Campo aberto das rotas de Kanto, com os modelos do Pokémon Let's Go
  // (`models`, docs/features/053-planicie-com-assets-do-lgpe.md):
  // conjuntos de grama com o mato alto de encontro no miolo e chão ralo
  // entre eles, árvores redondas em capões, moitas, tufos e flores em
  // manchas, pedrinhas na grama e na trilha.
  vegetation: [
    {
      kind: 'broadleaf-tree',
      density: 0.6,
      patches: { amount: 0.18, size: 30 },
      scale: 1.2,
      models: ['round-tree', 'round-tree-b', 'round-tree-e', 'round-tree-f'],
    },
    {
      kind: 'bush',
      density: 0.5,
      patches: { amount: 0.3, size: 10 },
      models: ['round-bush', 'shrub', 'flower-bush'],
    },
    {
      kind: 'leafy-plant',
      density: 0.6,
      patches: { amount: 0.4, size: 10 },
      models: ['tuft-route', 'tuft-medium'],
    },
    {
      kind: 'flower',
      density: 0.15,
      patches: { amount: 0.4, size: 12 },
      models: ['flower-white', 'flower-yellow', 'flower-small', 'flower-9'],
    },
    {
      kind: 'rock',
      density: 0.05,
      scale: 1.2,
      models: ['rock-large', 'rock-grass'],
    },
    // Pedrinhas soltas na terra batida das trilhas.
    {
      kind: 'pebble',
      density: 0.6,
      place: 'trail',
      models: ['rock-soil', 'rock-soil-b'],
    },
    // O mato alto do Let's Go, no miolo dos conjuntos de grama.
    {
      kind: 'encounter-grass',
      density: 1,
      models: ['tall-grass', 'tall-grass-2'],
    },
    {
      kind: 'tall-grass',
      density: 0.75,
      clusters: {
        density: 1,
        size: 60,
        sizeVariation: 1,
        roughness: 1.5,
        edge: 0.005,
        height: 1.5,
        holes: 0,
        coverage: 0.4,
        grouping: 0.5,
        variety: 0.35,
        background: 0.07,
        backgroundHeight: 0.5,
        clearingPreference: 0,
      },
      models: ['tall-grass', 'tall-grass-2'],
      colors: { a: '#ffffff', b: '#fff2c0' },
    },
  ],
  tags: ['grassland', 'temperate'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
