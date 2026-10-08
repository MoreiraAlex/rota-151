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
  palette: {
    bed: '#6b5a3e',
    shore: '#c2b280',
    low: '#6fa33d',
    high: '#a3c255',
    highHeight: 8,
    slope: '#8a7a5c',
    debug: '#8fd16a',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    detail: 0.6,
  },
  vegetation: [
    { kind: 'tall-grass', density: 0.6 },
    { kind: 'flower', density: 0.3 },
    { kind: 'broadleaf-tree', density: 0.05 },
    { kind: 'rock', density: 0.05 },
  ],
  tags: ['grassland', 'temperate'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
