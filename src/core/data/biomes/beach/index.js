/**
 * Praia (docs/features/047-biomas.md) — Faixa de areia entre o mar e a
 * terra, rente à água.
 * Campos: ver `../_template/`.
 */
export const BEACH = {
  id: 'beach',
  name: 'Praia',
  size: 300,
  climate: {
    continent: [0.3, 0.36],
  },
  relief: {
    baseHeight: 0.8,
    hillHeight: 0.8,
    hillSize: 60,
    roughness: 0.2,
    flatness: 1,
  },
  palette: {
    bed: '#8c7b55',
    shore: '#ecdba4',
    low: '#e6d39a',
    high: '#d9c48a',
    highHeight: 3,
    slope: '#a89470',
    debug: '#f2d98a',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'sand',
    slopeTexture: 'rock',
    detail: 0.5,
  },
  vegetation: [
    { kind: 'palm-tree', density: 0.15 },
    { kind: 'rock', density: 0.1 },
    { kind: 'shell', density: 0.2 },
  ],
  tags: ['coast', 'sand', 'water'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
