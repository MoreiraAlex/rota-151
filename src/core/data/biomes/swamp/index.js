/**
 * Pântano (docs/features/047-biomas.md) — Terra encharcada e plana, rente à
 * água, com poças.
 * Campos: ver `../_template/`.
 */
export const SWAMP = {
  id: 'swamp',
  name: 'Pântano',
  size: 300,
  climate: {
    temperature: [0.35, 0.8],
    humidity: [0.75, 1],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  relief: {
    baseHeight: 0.6,
    hillHeight: 1.5,
    hillSize: 50,
    roughness: 0.3,
    flatness: 1,
  },
  palette: {
    bed: '#3e3a2a',
    shore: '#6f6a48',
    low: '#56703a',
    high: '#4a5f34',
    highHeight: 4,
    slope: '#5a5038',
    debug: '#6b6b2f',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'mud',
    slopeTexture: 'mud',
    shoreTexture: 'mud',
    detail: 0.6,
  },
  vegetation: [
    { kind: 'reed', density: 0.6 },
    { kind: 'dead-tree', density: 0.15 },
    { kind: 'mushroom', density: 0.2 },
  ],
  tags: ['swamp', 'humid', 'water'],
}
