/**
 * Deserto (docs/features/047-biomas.md) — Areia quente e seca, em dunas
 * largas.
 * Campos: ver `../_template/`.
 */
export const DESERT = {
  id: 'desert',
  name: 'Deserto',
  size: 800,
  climate: {
    temperature: [0.65, 1],
    humidity: [0, 0.25],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  relief: {
    baseHeight: 4,
    hillHeight: 5,
    hillSize: 90,
    roughness: 0.1,
    flatness: 0.8,
  },
  palette: {
    bed: '#9a7f55',
    shore: '#e0c48a',
    low: '#ecd197',
    high: '#e0bd7c',
    highHeight: 8,
    slope: '#b8915c',
    debug: '#f0c060',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'sand',
    slopeTexture: 'sand',
    detail: 0.5,
  },
  vegetation: [
    { kind: 'cactus', density: 0.1 },
    { kind: 'rock', density: 0.1 },
    { kind: 'dead-tree', density: 0.03 },
  ],
  tags: ['desert', 'hot', 'dry', 'sand'],
  weather: { clear: 8, sun: 11, rain: 0.5, storm: 0.5, snow: 0 },
}
