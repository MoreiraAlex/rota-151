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
    // Terra batida das trilhas, mais clara que a da floresta.
    trail: '#a08a62',
    debug: '#8fd16a',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js).
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.6,
  },
  // Trilhas de terra batida cruzando o campo (core/terrain/trails.js).
  trails: true,
  // Campo aberto no estilo dos jogos de Pokémon (docs/features/050-
  // planicie-e-savana.md): conjuntos de mato alto com chão ralo entre eles,
  // manchas de flores, folhosas em capões, arbustos e pedras soltas.
  vegetation: [
    {
      kind: 'broadleaf-tree',
      density: 0.6,
      patches: { amount: 0.18, size: 30 },
    },
    // Arbusto mais claro que o da mata, para não virar mancha escura no
    // campo aberto.
    {
      kind: 'bush',
      density: 0.5,
      patches: { amount: 0.3, size: 10 },
      color: '#8aad48',
    },
    { kind: 'flower', density: 0.9, patches: { amount: 0.4, size: 12 } },
    { kind: 'rock', density: 0.15, moss: 0.3 },
    // Seixos soltos na terra batida das trilhas.
    { kind: 'pebble', density: 0.6, place: 'trail' },
    {
      kind: 'tall-grass',
      density: 0.75,
      clusters: {
        density: 1,
        size: 12,
        sizeVariation: 0.6,
        roughness: 0.5,
        edge: 0.05,
        height: 1.15,
        holes: 0.2,
        coverage: 0.4,
        grouping: 0.5,
        variety: 0.35,
        background: 0.07,
        backgroundHeight: 0.5,
        clearingPreference: 0,
      },
      colors: {
        root: '#6aa14f',
        tip: '#a1cc33',
        rootB: '#74a022',
        tipB: '#e8e84f',
      },
    },
  ],
  tags: ['grassland', 'temperate'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
