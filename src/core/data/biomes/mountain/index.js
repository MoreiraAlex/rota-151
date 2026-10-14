/**
 * Montanha (docs/features/047-biomas.md) — Morros altos e íngremes de rocha,
 * com neve no alto. É onde ficarão as bocas das cavernas (061).
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
  // Serras (docs/features/051-montanha.md): morros grandes e altos, com
  // crista (`ridges`) e pouco detalhe miúdo — mais que isso e a encosta
  // passa do que dá para subir a pé.
  relief: {
    baseHeight: 28,
    hillHeight: 90,
    hillSize: 600,
    roughness: 0.25,
    flatness: 1.3,
    ridges: 0.6,
  },
  // Faixas por altura (docs/features/051-montanha.md): pé verde, meio de
  // rocha a partir de `highHeight` e neve no pico.
  palette: {
    bed: '#5a5248',
    shore: '#9a9080',
    low: '#7c9a4c',
    high: '#a3a093',
    highHeight: 45,
    slope: '#96918a',
    peak: '#f2f4f7',
    peakHeight: 60,
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js): grama no
  // pé e rocha no alto (`highTexture`, como a cor vai de `low` a `high`).
  ground: {
    texture: 'grass',
    highTexture: 'rock',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    peakTexture: 'snow',
    detail: 0.45,
  },
  // Bosques de pinheiro no pé, até a linha das árvores (`maxHeight`);
  // acima, rocha com pedregulhos; no pico, só neve.
  vegetation: [
    {
      kind: 'pine-tree',
      density: 0.8,
      patches: { amount: 0.45, size: 40 },
      maxHeight: 42,
    },
    { kind: 'dead-tree', density: 0.1, maxHeight: 45 },
    // Pedregulhos (`scale`) de granito cinza, sem musgo, até pouco acima
    // da neve.
    {
      kind: 'rock',
      density: 0.6,
      color: '#dcc4cc',
      scale: 1.8,
      maxHeight: 66,
    },
    {
      kind: 'bush',
      density: 0.25,
      patches: { amount: 0.3, size: 10 },
      color: '#6f8f3e',
      maxHeight: 34,
    },
    {
      kind: 'flower',
      density: 0.3,
      patches: { amount: 0.3, size: 8 },
      maxHeight: 30,
    },
    // Grama de pasto alto: conjuntos baixos e ralos, até antes da rocha.
    {
      kind: 'tall-grass',
      density: 0.6,
      maxHeight: 40,
      clusters: {
        density: 1,
        size: 10,
        sizeVariation: 0.6,
        roughness: 0.5,
        edge: 0.05,
        height: 0.9,
        holes: 0.3,
        coverage: 0.25,
        grouping: 0.5,
        variety: 0.35,
        background: 0.15,
        backgroundHeight: 0.5,
        clearingPreference: 0.5,
      },
      models: ['grass-low', 'grass-clump'],
      colors: { a: '#e8eedc', b: '#f4f2d0' },
    },
  ],
  tags: ['mountain', 'rocky', 'cave-entrance'],
  weather: { clear: 4, sun: 1, rain: 2, storm: 1, snow: 2 },
}
