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
  palette: {
    bed: '#5a4a32',
    // Margem e trilha da mesma terra (a margem, um pouco mais clara).
    shore: '#8f7c5a',
    // O chão na família da grama: o mesmo verde amarelado, mais escuro.
    low: '#5b8137',
    high: '#4b6f2f',
    highHeight: 10,
    slope: '#75684e',
    trail: '#7d6a4c',
    debug: '#2e7d32',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'forest-floor',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.7,
  },
  // Trilhas de terra batida cortando a mata (core/terrain/trails.js).
  trails: true,
  // Mata fechada com clareiras, em camadas: árvores antigas espalhadas (a
  // copa alta), folhosas, bosques de pinheiros e uma ou outra árvore morta;
  // por baixo, arbustos, tapetes de samambaia, plantas de folha larga e
  // rodas de cogumelos (`patches`). Tudo isso rareia nas clareiras, onde
  // ficam as flores e a maioria dos conjuntos de grama (`clusters`).
  clearings: { amount: 0.3 },
  vegetation: [
    { kind: 'ancient-tree', density: 0.55, place: 'shade' },
    {
      kind: 'pine-tree',
      density: 0.7,
      place: 'shade',
      patches: { amount: 0.3, size: 50 },
    },
    { kind: 'broadleaf-tree', density: 0.7, place: 'shade' },
    { kind: 'dead-tree', density: 0.2, place: 'shade' },
    {
      kind: 'bush',
      density: 0.6,
      place: 'shade',
      patches: { amount: 0.55, size: 16 },
    },
    {
      kind: 'fern',
      density: 0.9,
      place: 'shade',
      patches: { amount: 0.4, size: 14 },
    },
    {
      kind: 'leafy-plant',
      density: 0.8,
      place: 'shade',
      patches: { amount: 0.3, size: 10 },
    },
    {
      kind: 'mushroom',
      density: 0.9,
      place: 'shade',
      patches: { amount: 0.2, size: 5 },
    },
    { kind: 'fallen-log', density: 0.4, place: 'shade' },
    // Seixos soltos na terra batida das trilhas.
    { kind: 'pebble', density: 0.8, place: 'trail' },
    { kind: 'rock', density: 0.25, moss: 0.8 },
    { kind: 'flower', density: 0.35, place: 'clearing' },
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
      colors: {
        root: '#3f7a3a',
        tip: '#7fae3c',
        rootB: '#4d8a2c',
        tipB: '#a8c64a',
      },
    },
  ],
  tags: ['forest', 'temperate', 'humid'],
  weather: { clear: 4, sun: 1, rain: 4, storm: 1, snow: 0 },
}
