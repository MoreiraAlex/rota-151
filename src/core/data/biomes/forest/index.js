/**
 * Floresta (docs/features/047-biomas.md) — Mata fechada de clima ameno e
 * úmido, com colinas médias.
 * Campos: ver `../_template/`.
 */
export const FOREST = {
  id: 'forest',
  name: 'Floresta',
  size: 700,
  climate: {
    temperature: [0.2, 0.7],
    humidity: [0.45, 0.85],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  // Morros largos sem pico, em platôs com barranco e rampas, e algumas
  // montanhas com caminho até o topo (docs/features/066-revisao-dos-
  // biomas.md: core/terrain/terraces.js e mountains.js).
  relief: {
    baseHeight: 8,
    hillHeight: 10,
    hillSize: 160,
    roughness: 0.25,
    flatness: 1.2,
    terraces: {
      step: 3.5,
      cliff: 0.95,
      tilt: 0.1,
      ramps: 0.3,
      rampSize: 40,
    },
    mountains: {
      spacing: 700,
      chance: 0.6,
      radius: 120,
      height: 30,
      sizeJitter: 0.25,
      wobble: 0.15,
      step: 4,
      cliff: 0.95,
      tilt: 0.1,
      pathWidth: 5,
      turn: 0.3,
    },
  },
  // Rios e lagos (docs/features/057-lagos-e-rios.md).
  water: { rivers: 1, lakes: 0.8 },
  // A paleta casa com as texturas do Let's Go (a média delas): é a cor do
  // relevo distante — de perto, a cor vem das texturas (`ground.colors`).
  palette: {
    bed: '#6b5a3a',
    shore: '#c99c5a',
    // A mata fechada (a maior parte) puxa para o chão de mata, escuro.
    low: '#2c7438',
    high: '#286a33',
    highHeight: 10,
    slope: '#4a7c2b',
    trail: '#c39549',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js). `colors`:
  // a cor vem das texturas do Let's Go — grama nas clareiras, chão de mata
  // onde é fechado, terra na trilha e na margem, pedra com musgo na
  // encosta (docs/features/052-assets-do-lgpe-e-floresta.md).
  ground: {
    texture: 'forest-floor',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.7,
    colors: {
      base: 'lgpe-grass',
      shade: 'lgpe-grass-bright',
      trail: 'lgpe-soil-dark',
      shore: 'lgpe-soil',
      // O barranco dos platôs e das montanhas: terra de trilha.
      slope: 'lgpe-trail-soil',
    },
  },
  // Trilhas de terra batida cortando a mata (core/terrain/trails.js).
  trails: true,
  // Bosques no jeito do Scarlet/Violet (docs/features/066-revisao-dos-
  // biomas.md, o acerto do laboratório de biomas): árvores com tronco à
  // vista e copa alta dos pacotes da Quaternius (`usn-*`, `megakit-*`, em
  // public/assets/vegetation/packs/), cada tipo em bosques próprios com
  // campo aberto entre eles; as grandes soltas no campo, raras. Pouca
  // pedra, arbustos do Let's Go em manchas, sem o resto do sub-bosque
  // dele (samambaias soltas e trevos); o chão
  // coberto de grama em fios (`blade-grass`).
  clearings: { amount: 0.4 },
  vegetation: [
    // Poucas gigantes, da altura de vários andares, soltas pela mata
    // (`GIANT_TREES`): a CommonTree do MegaKit, de tronco grosso e copa
    // cheia.
    {
      kind: 'giant-tree',
      density: 0.3,
      // Árvores velhas, cheias de galhos, com copas nas pontas: os galhos de
      // árvores secas com as folhas da NormalTree
      // (scripts/lab/compor-arvore-gigante.py) — só as de copa larga.
      models: ['usn-gianttree-4', 'usn-gianttree-8', 'usn-gianttree-mk1'],
    },
    {
      kind: 'ancient-tree',
      density: 0.25,
      scale: 1.2,
      models: [
        'megakit-commontree-1',
        'megakit-commontree-2',
        'megakit-commontree-5',
        'megakit-twistedtree-1',
        'megakit-twistedtree-3',
      ],
    },
    // Os bordos (no lugar dos pinheiros).
    {
      kind: 'pine-tree',
      density: 0.8,
      patches: { amount: 0.2, size: 45 },
      scale: 1,
      models: [
        'usn-mapletree-1',
        'usn-mapletree-2',
        'usn-mapletree-4',
        'usn-mapletree-5',
      ],
    },
    {
      kind: 'broadleaf-tree',
      density: 0.9,
      patches: { amount: 0.3, size: 55 },
      scale: 1,
      models: [
        'usn-normaltree-1',
        'usn-normaltree-2',
        'usn-normaltree-3',
        'usn-normaltree-4',
        'usn-normaltree-5',
      ],
    },
    {
      kind: 'dead-tree',
      density: 0,
      models: ['young-tree'],
    },
    {
      kind: 'bush',
      density: 0.35,
      place: 'shade',
      patches: { amount: 0.25, size: 20 },
      models: ['fern', 'round-bush'],
    },
    {
      kind: 'fern',
      density: 0,
      place: 'shade',
      patches: { amount: 0.3, size: 14 },
      models: ['fern-loose', 'clover-large'],
    },
    {
      kind: 'leafy-plant',
      density: 0,
      place: 'shade',
      patches: { amount: 0.3, size: 10 },
      models: ['clover', 'tuft'],
    },
    // Pedrinhas soltas pelo bioma inteiro, poucas (pedido do usuário,
    // docs/features/066-revisao-dos-biomas.md: na trilha tinham saído).
    {
      kind: 'pebble',
      density: 0.025,
      scale: 0.5,
      models: ['rock-small'],
    },
    // Pedras de três famílias, para variar formato e tom: as do MegaKit
    // (largas, cinza-esverdeado), as do Ultimate Nature (altas, cinza-
    // escuro) e a grande com musgo do Let's Go.
    {
      kind: 'rock',
      density: 0.25,
      scale: 1,
      models: [
        'megakit-rock-medium-1',
        'megakit-rock-medium-2',
        'megakit-rock-medium-3',
        'usn-rock-1',
        'usn-rock-2',
        'usn-rock-3',
        'usn-rock-4',
        'usn-rock-5',
        'rock-large',
      ],
    },
    {
      kind: 'flower',
      density: 0.25,
      place: 'clearing',
      models: ['flower-white', 'flower-yellow', 'flower-forest'],
    },
    // O mato alto do Let's Go, no miolo dos conjuntos de grama (desligado:
    // a grama em fios faz o papel dele).
    {
      kind: 'encounter-grass',
      density: 0,
      models: ['tall-grass', 'tall-grass-2'],
    },
    // Grama em conjuntos (core/vegetation/grassClusters.js), em fios
    // (view/vegetation/bladeGrass.js): manchas de mato fechadas, de borda
    // seca, como o mato dos jogos clássicos, de preferência nas clareiras;
    // entre elas, só o chão (o tapete pelo bosque inteiro pesava demais —
    // docs/features/066-revisao-dos-biomas.md).
    {
      kind: 'tall-grass',
      density: 0.75,
      clusters: {
        density: 1,
        size: 14,
        sizeVariation: 0.6,
        roughness: 1,
        edge: 0.02,
        height: 1.4,
        holes: 0,
        coverage: 0.3,
        grouping: 0.5,
        variety: 0.25,
        background: 0,
        backgroundHeight: 0.6,
        clearingPreference: 0.5,
      },
      models: ['blade-grass'],
      colors: { a: '#ffffff', b: '#f2f5d8' },
    },
  ],
  // Pokébolas no chão (docs/features/055-itens-no-mundo.md).
  worldItems: {
    chance: 0.05,
    maxPerChunk: 1,
    refillMinutes: 120,
    table: [
      { itemId: 'poke-ball', weight: 10 },
      { itemId: 'great-ball', weight: 1 },
      { itemId: 'ultra-ball', weight: 0.5 },
    ],
  },
  // A fruta da vegetação (docs/features/055-itens-no-mundo.md): todo
  // arbusto e toda árvore podem ter, sorteado a cada dia.
  forage: {
    itemId: 'razz-berry',
    bush: { chance: 0.15, min: 1, max: 2 },
    tree: { chance: 0.25, min: 1, max: 3 },
  },
  tags: ['forest', 'temperate', 'humid'],
  weather: { clear: 4, sun: 1, rain: 4, storm: 1, snow: 0 },
}
