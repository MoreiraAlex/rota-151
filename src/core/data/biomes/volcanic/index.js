/**
 * Vulcânico (docs/features/047-biomas.md) — Rocha escura e quente, íngreme.
 * Raro: só no calor extremo com relevo alto.
 * Campos: ver `../_template/`.
 */
export const VOLCANIC = {
  id: 'volcanic',
  name: 'Vulcânico',
  size: 300,
  climate: {
    temperature: [0.8, 1],
    continent: [0.36, 1],
    relief: [0.85, 1],
  },
  relief: {
    baseHeight: 16,
    hillHeight: 24,
    hillSize: 200,
    roughness: 0.35,
    flatness: 1.2,
  },
  palette: {
    bed: '#2e2622',
    shore: '#4a3a33',
    low: '#4b3b34',
    high: '#3a2e2a',
    highHeight: 18,
    slope: '#2a2220',
    peak: '#6b2a1c',
    peakHeight: 30,
    debug: '#c0392b',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'volcanic-rock',
    slopeTexture: 'volcanic-rock',
    peakTexture: 'volcanic-rock',
    detail: 0.7,
  },
  vegetation: [
    { kind: 'lava-rock', density: 0.4 },
    { kind: 'dead-tree', density: 0.05 },
  ],
  tags: ['volcanic', 'hot', 'rocky'],
  weather: { clear: 4, sun: 3, rain: 1, storm: 2, snow: 0 },
}
