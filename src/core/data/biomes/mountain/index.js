/**
 * Montanha (docs/features/047-biomas.md) — Morros altos e íngremes de rocha,
 * com neve no alto. É onde ficarão as bocas das cavernas (057).
 * Campos: ver `../_template/`.
 */
export const MOUNTAIN = {
  id: 'mountain',
  name: 'Montanha',
  size: 600,
  climate: {
    temperature: [0.1, 0.75],
    continent: [0.36, 1],
    relief: [0.8, 1],
  },
  relief: {
    baseHeight: 18,
    hillHeight: 28,
    hillSize: 260,
    roughness: 0.3,
    flatness: 1.3,
  },
  palette: {
    bed: '#5a5248',
    shore: '#9a9080',
    low: '#7f9050',
    high: '#8f8b7e',
    highHeight: 22,
    slope: '#8c867a',
    peak: '#f2f4f7',
    peakHeight: 34,
    debug: '#8d8d8d',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'rock',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    peakTexture: 'snow',
    detail: 0.7,
  },
  vegetation: [
    { kind: 'pine-tree', density: 0.2 },
    { kind: 'rock', density: 0.4 },
    { kind: 'boulder', density: 0.2 },
  ],
  tags: ['mountain', 'rocky', 'cave-entrance'],
  weather: { clear: 4, sun: 1, rain: 2, storm: 1, snow: 2 },
}
