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
    shore: '#a99c6e',
    low: '#4c8a36',
    high: '#3e7a30',
    highHeight: 10,
    slope: '#75684e',
    debug: '#2e7d32',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'forest-floor',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    detail: 0.7,
  },
  vegetation: [
    { kind: 'broadleaf-tree', density: 0.6 },
    { kind: 'bush', density: 0.4 },
    { kind: 'mushroom', density: 0.15 },
    { kind: 'tall-grass', density: 0.3 },
  ],
  tags: ['forest', 'temperate', 'humid'],
  weather: { clear: 4, sun: 1, rain: 4, storm: 1, snow: 0 },
}
