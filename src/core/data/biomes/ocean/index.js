/**
 * Oceano (docs/features/047-biomas.md) — Mar aberto: chão bem abaixo da
 * água, longe da costa. Sem nado na beta, anda-se pelo fundo.
 * Campos: ver `../_template/`.
 */
export const OCEAN = {
  id: 'ocean',
  name: 'Oceano',
  size: 1600,
  climate: {
    continent: [0, 0.3],
  },
  relief: {
    baseHeight: -14,
    hillHeight: 4,
    hillSize: 160,
    roughness: 0.3,
    flatness: 1,
  },
  palette: {
    bed: '#7d7254',
    shore: '#c9b98a',
    low: '#b8a774',
    high: '#a08f60',
    highHeight: 6,
    slope: '#6f6650',
    debug: '#1f4e9c',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'sand',
    slopeTexture: 'sand',
    detail: 0.4,
  },
  vegetation: [
    { kind: 'coral-rock', density: 0.2 },
    { kind: 'seaweed', density: 0.4 },
  ],
  tags: ['ocean', 'water', 'deep-water'],
}
