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
  // Ressaltos baixos e raros no campo, como os das rotas de Kanto: os
  // platôs da floresta com degrau baixo, barranco seco e bastante rampa — a
  // maior parte do morro continua subindo suave. O chão médio mais alto
  // que antes dos degraus: o patamar de baixo não afunda até a água
  // (docs/features/066-revisao-dos-biomas.md, core/terrain/terraces.js).
  relief: {
    baseHeight: 5.5,
    hillHeight: 4,
    hillSize: 140,
    roughness: 0.2,
    flatness: 1.4,
    terraces: {
      step: 1.5,
      cliff: 1,
      tilt: 0.1,
      ramps: 0.4,
      rampSize: 40,
    },
  },
  // Rios e lagos (docs/features/057-lagos-e-rios.md).
  water: { rivers: 1, lakes: 1 },
  // A paleta casa com a textura do Let's Go (a média dela): é a cor do
  // relevo distante — de perto, a cor vem da textura (`ground.colors`). O
  // chão é grama (sem trilha ou alto por textura), então quase todos os
  // papéis usam a mesma cor; a margem dos lagos e rios é areia; a encosta,
  // um verde um pouco mais escuro para o morro distante não ficar chapado.
  palette: {
    bed: '#6b5a3e',
    shore: '#e8d59a',
    low: '#77c546',
    high: '#77c546',
    highHeight: 8,
    slope: '#64ad3a',
    trail: '#77c546',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js). `colors`:
  // a cor vem da grama do Let's Go no chão e na trilha
  // (docs/features/053-planicie-com-assets-do-lgpe.md); margem e encosta,
  // da areia e da terra (docs/features/057-lagos-e-rios.md).
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.6,
    colors: {
      base: 'lgpe-grass',
      // Margem de areia nos lagos e rios (docs/features/057-lagos-e-
      // rios.md); a encosta e o barranco dos ressaltos com a terra de
      // trilha, como o barranco da floresta.
      shore: 'lgpe-sand',
      slope: 'lgpe-trail-soil',
    },
  },
  // Trilhas de terra batida cruzando o campo (core/terrain/trails.js).
  trails: false,
  // Campo aberto das rotas de Kanto, com os modelos do Pokémon Let's Go
  // (`models`, docs/features/053-planicie-com-assets-do-lgpe.md):
  // moitas, tufos e flores em manchas, pedrinhas espalhadas. A
  // grama e as árvores, como as da floresta (docs/features/066-revisao-
  // dos-biomas.md): grama em fios em manchas; árvores com tronco à vista e
  // copa alta, dos pacotes da Quaternius (com as folhas do Let's Go) —
  // bosquinhos de NormalTree e, raras, grandes soltas no campo.
  vegetation: [
    {
      kind: 'ancient-tree',
      density: 0.15,
      scale: 1.1,
      models: [
        'megakit-commontree-1',
        'megakit-commontree-2',
        'megakit-commontree-5',
      ],
    },
    {
      kind: 'broadleaf-tree',
      density: 0.6,
      patches: { amount: 0.15, size: 25 },
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
      kind: 'bush',
      density: 0.5,
      patches: { amount: 0.3, size: 10 },
      models: ['round-bush', 'shrub', 'flower-bush'],
    },
    {
      kind: 'leafy-plant',
      density: 0.6,
      patches: { amount: 0.4, size: 10 },
      models: ['tuft-route', 'tuft-medium'],
    },
    {
      kind: 'flower',
      density: 0.15,
      patches: { amount: 0.4, size: 12 },
      models: ['flower-white', 'flower-yellow', 'flower-small', 'flower-9'],
    },
    {
      kind: 'rock',
      density: 0.05,
      scale: 1.2,
      models: ['rock-large', 'rock-grass'],
    },
    // Pedrinhas soltas pelo bioma inteiro, poucas (pedido do usuário,
    // docs/features/066-revisao-dos-biomas.md).
    {
      kind: 'pebble',
      density: 0.025,
      models: ['rock-soil', 'rock-soil-b'],
    },
    // O mato alto do Let's Go, no miolo dos conjuntos de grama (desligado:
    // a grama em fios faz o papel dele, como na floresta).
    {
      kind: 'encounter-grass',
      density: 0,
      models: ['tall-grass', 'tall-grass-2'],
    },
    // Grama em conjuntos (core/vegetation/grassClusters.js), em fios
    // (view/vegetation/bladeGrass.js), como na floresta: manchas de mato
    // fechadas, de borda seca, como o mato das rotas dos jogos clássicos;
    // entre elas, só o chão (docs/features/066-revisao-dos-biomas.md). A
    // planície não tem clareiras: as manchas nascem em qualquer lugar.
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
        clearingPreference: 0,
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
    itemId: 'nanab-berry',
    bush: { chance: 0.15, min: 1, max: 2 },
    tree: { chance: 0.25, min: 1, max: 3 },
  },
  tags: ['grassland', 'temperate'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
