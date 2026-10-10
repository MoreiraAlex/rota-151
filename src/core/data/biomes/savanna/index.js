/**
 * Savana (docs/features/047-biomas.md) — Campo seco e quente, de grama alta
 * amarelada e árvores esparsas.
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
  relief: {
    baseHeight: 3,
    hillHeight: 3,
    hillSize: 200,
    roughness: 0.15,
    flatness: 1.2,
  },
  palette: {
    bed: '#6f5a3a',
    shore: '#c8b07a',
    low: '#c2b05a',
    high: '#b39a4c',
    highHeight: 8,
    slope: '#8a6e4a',
    trail: '#b0905e',
    debug: '#d9b44a',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  // A terra rachada (`dry-ground`) lia como deserto: o chão é o de campo,
  // com a cor seca da paleta.
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.6,
  },
  // Trilhas de terra batida cruzando o campo (core/terrain/trails.js).
  trails: true,
  // Campos grandes de capim amarelo, acácias isoladas, uma ou outra árvore
  // morta, arbustos secos e pedras (docs/features/050-planicie-e-
  // savana.md).
  vegetation: [
    { kind: 'acacia-tree', density: 0.6 },
    { kind: 'dead-tree', density: 0.12 },
    {
      kind: 'bush',
      density: 0.35,
      patches: { amount: 0.3, size: 12 },
      color: '#b2a457',
    },
    // Arenito: pedras quentes, da cor da terra seca, e maiores que as da
    // mata (`scale`).
    { kind: 'rock', density: 0.3, color: '#e6ad78', scale: 1.8 },
    { kind: 'pebble', density: 0.6, place: 'trail', color: '#e6ad78' },
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
        coverage: 0.45,
        grouping: 0.7,
        variety: 0.3,
        background: 0.15,
        backgroundHeight: 0.6,
        clearingPreference: 0,
      },
      colors: {
        root: '#8a8a3c',
        tip: '#d8c46a',
        rootB: '#9a7f3a',
        tipB: '#e6d48a',
      },
    },
  ],
  tags: ['grassland', 'hot', 'dry'],
  weather: { clear: 4, sun: 4, rain: 1.5, storm: 0.5, snow: 0 },
}
