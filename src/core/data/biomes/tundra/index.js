/**
 * Tundra (docs/features/047-biomas.md) — Campo gelado, de colinas suaves
 * cobertas de neve.
 * Campos: ver `../_template/`.
 */
export const TUNDRA = {
  id: 'tundra',
  name: 'Tundra',
  size: 800,
  climate: {
    temperature: [0, 0.2],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  relief: {
    baseHeight: 4,
    hillHeight: 6,
    hillSize: 160,
    roughness: 0.2,
    flatness: 1.2,
  },
  palette: {
    bed: '#5e646a',
    shore: '#c9d0d6',
    low: '#dfe6ec',
    high: '#eef2f5',
    highHeight: 10,
    slope: '#9aa3ab',
    debug: '#bfe3ff',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'snow',
    slopeTexture: 'rock',
    shoreTexture: 'snow',
    detail: 0.4,
  },
  vegetation: [
    { kind: 'pine-tree', density: 0.1 },
    { kind: 'ice-rock', density: 0.2 },
  ],
  tags: ['tundra', 'cold', 'snow'],
}
