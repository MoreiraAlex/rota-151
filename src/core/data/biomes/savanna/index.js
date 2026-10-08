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
    debug: '#d9b44a',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'dry-ground',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    detail: 0.6,
  },
  vegetation: [
    { kind: 'tall-grass', density: 0.5 },
    { kind: 'acacia-tree', density: 0.08 },
    { kind: 'rock', density: 0.05 },
  ],
  tags: ['grassland', 'hot', 'dry'],
  weather: { clear: 4, sun: 4, rain: 1.5, storm: 0.5, snow: 0 },
}
