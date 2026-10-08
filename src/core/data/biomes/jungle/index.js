/**
 * Selva (docs/features/047-biomas.md) — Mata quente e muito úmida, de relevo
 * irregular.
 * Campos: ver `../_template/`.
 */
export const JUNGLE = {
  id: 'jungle',
  name: 'Selva',
  size: 500,
  climate: {
    temperature: [0.65, 1],
    humidity: [0.65, 1],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  relief: {
    baseHeight: 4,
    hillHeight: 9,
    hillSize: 90,
    roughness: 0.35,
    flatness: 1.1,
  },
  palette: {
    bed: '#4f4630',
    shore: '#9c9466',
    low: '#3f9a3e',
    high: '#2e8436',
    highHeight: 10,
    slope: '#5d5238',
    debug: '#00a86b',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'forest-floor',
    slopeTexture: 'rock',
    shoreTexture: 'mud',
    detail: 0.7,
  },
  vegetation: [
    { kind: 'jungle-tree', density: 0.7 },
    { kind: 'bush', density: 0.5 },
    { kind: 'flower', density: 0.2 },
    { kind: 'tall-grass', density: 0.4 },
  ],
  tags: ['forest', 'jungle', 'hot', 'humid'],
  weather: { clear: 2, sun: 1, rain: 5, storm: 2, snow: 0 },
}
