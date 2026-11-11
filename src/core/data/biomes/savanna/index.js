/**
 * Savana (docs/features/047-biomas.md) — Campo seco e quente, de terra
 * batida com manchas de grama e árvores esparsas. Na beta, a casa de
 * Rattata, Spearow e Ekans: como as rotas secas e pedregosas de Kanto
 * (docs/features/054-savana-lgpe-e-saida-do-megakit.md).
 * Campos: ver `../_template/`.
 */
export const SAVANNA = {
  id: 'savanna',
  name: 'Savana',
  size: 800,
  climate: {
    temperature: [0.6, 0.9],
    humidity: [0.2, 0.5],
    continent: [0.36, 1],
    relief: [0, 0.8],
  },
  // Os vales descem um pouco abaixo da água (`hillHeight` maior que
  // `baseHeight`): lagoas espalhadas, como os bebedouros da savana. Com
  // ressaltos baixos e raros, como na planície (docs/features/066-revisao-
  // dos-biomas.md, core/terrain/terraces.js): degrau baixo, barranco seco
  // e bastante rampa. O relevo da savana era plano demais para o degrau
  // ficar íngreme — os morros ficaram um pouco mais altos e estreitos, e o
  // chão médio subiu junto para as lagoas não crescerem.
  relief: {
    baseHeight: 3.5,
    hillHeight: 5,
    hillSize: 150,
    roughness: 0.15,
    flatness: 1.2,
    terraces: {
      step: 1.5,
      cliff: 1,
      tilt: 0.1,
      ramps: 0.4,
      rampSize: 40,
    },
  },
  // Rios e lagos (docs/features/057-lagos-e-rios.md): menos que nos biomas
  // úmidos — os bebedouros dos vales já fazem parte da água.
  water: { rivers: 0.6, lakes: 0.7 },
  // A paleta casa com as texturas do Let's Go (a média delas): é a cor do
  // relevo distante — de perto, a cor vem das texturas (`ground.colors`).
  // O chão baixo e alto é a mistura da terra com as manchas de grama; a
  // encosta, o penhasco de terra.
  palette: {
    bed: '#6f5a3a',
    shore: '#f7e19e',
    low: '#a5a848',
    high: '#a5a848',
    highHeight: 8,
    slope: '#986e49',
    trail: '#bb9261',
  },
  // Desenho do chão (camadas de view/terrain/terrainLayers.js). `colors`:
  // terra batida na maior parte (`shade`, fora das clareiras), grama nas
  // manchas abertas (`base`, as clareiras), terra clara na trilha, areia
  // na margem e, na encosta e no barranco dos ressaltos, a terra de
  // trilha, como na floresta e na planície.
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'sand',
    detail: 0.6,
    colors: {
      base: 'lgpe-soil',
      shade: 'lgpe-sand',
      shore: 'lgpe-sand',
      slope: 'lgpe-trail-soil',
    },
  },
  // As manchas de grama no meio da terra (as clareiras pintam o chão de
  // grama, `ground.colors.base`).
  clearings: { amount: 0.4 },
  // Trilhas de terra batida cruzando o campo (core/terrain/trails.js).
  trails: false,
  // As rotas secas de Kanto com os modelos do Pokémon Let's Go (`models`):
  // moitas, tufos, afloramentos de pedra, árvores secas e seixos
  // espalhados. As árvores e a
  // grama, como as da floresta (docs/features/066-revisao-dos-biomas.md):
  // árvores esparsas com tronco à vista e copa alta, dos pacotes da
  // Quaternius (com as folhas do Let's Go) — as de tronco torcido e as de
  // copa aberta; grama em fios em manchas. O verde puxa para o amarelado
  // seco pela tinta (`tint`).
  vegetation: [
    {
      kind: 'acacia-tree',
      density: 0.6,
      // As árvores dos pacotes já vêm na altura delas (a árvore redonda do
      // Let's Go, menor, pedia o tamanho grande de `ACACIAS`).
      scale: 0.5,
      models: [
        'megakit-twistedtree-1',
        'megakit-twistedtree-3',
        'usn-normaltree-1',
        'usn-normaltree-2',
        'usn-normaltree-3',
        'usn-normaltree-4',
        'usn-normaltree-5',
      ],
      tint: { color: '#c8b860', amount: 0.75 },
    },
    // Árvores secas, raras, soltas no campo: só os galhos (as DeadTree do
    // Ultimate Nature).
    {
      kind: 'dead-tree',
      density: 0.3,
      models: [
        'usn-deadtree-3',
        'usn-deadtree-5',
        'usn-deadtree-6',
        'usn-deadtree-7',
        'usn-deadtree-10',
      ],
    },
    {
      kind: 'bush',
      density: 0.35,
      patches: { amount: 0.3, size: 12 },
      models: ['round-bush', 'shrub'],
      tint: { color: '#d0b860', amount: 0.75 },
    },
    {
      kind: 'leafy-plant',
      density: 0.4,
      patches: { amount: 0.4, size: 10 },
      models: ['tuft-route', 'tuft-medium'],
      tint: { color: '#e0c060', amount: 1 },
    },
    {
      kind: 'flower',
      density: 0,
      patches: { amount: 0.3, size: 10 },
      models: ['flower-yellow'],
    },
    // Afloramentos: pedras grandes juntas em manchas, como os rochedos no
    // meio do capim, e nada entre elas. Dentro da mancha a densidade passa
    // de 1 (a chance de cada célula da grade de `ROCKS` satura): as pedras
    // ficam quase lado a lado. A de terra do Let's Go com as altas do
    // Ultimate Nature.
    {
      kind: 'rock',
      density: 3,
      patches: { amount: 0.12, size: 30 },
      scale: 1.6,
      models: [
        'rock-dirt-c',
        'usn-rock-1',
        'usn-rock-2',
        'usn-rock-3',
        'usn-rock-4',
        'usn-rock-5',
      ],
    },
    // Pedrinhas soltas pelo bioma inteiro, não só na trilha (pedido do
    // usuário, docs/features/066-revisao-dos-biomas.md): a quantidade é a
    // `density` vezes `PEBBLES.PER_M2` — baixa, para ficarem espalhadas.
    {
      kind: 'pebble',
      density: 0.025,
      models: ['rock-dirt', 'rock-dirt-b', 'rock-soil', 'rock-soil-b'],
    },
    // O mato alto do Let's Go, no miolo dos conjuntos de grama (desligado:
    // a grama em fios faz o papel dele, como na floresta).
    {
      kind: 'encounter-grass',
      density: 0,
      models: ['tall-grass', 'tall-grass-2'],
      tint: { color: '#e0c060', amount: 1 },
    },
    // Grama em conjuntos (core/vegetation/grassClusters.js), em fios
    // (view/vegetation/bladeGrass.js), como na floresta: manchas de mato
    // fechadas, de borda seca, de preferência nas manchas de grama do chão
    // (as clareiras); entre elas, só o chão (docs/features/066-revisao-dos-
    // biomas.md). Amarelada pela tinta.
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
      colors: { a: '#ffffff', b: '#fff0c8' },
      tint: { color: '#e0c060', amount: 1 },
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
    itemId: 'pinap-berry',
    bush: { chance: 0.15, min: 1, max: 2 },
    tree: { chance: 0.25, min: 1, max: 3 },
  },
  tags: ['grassland', 'hot', 'dry'],
  weather: { clear: 4, sun: 4, rain: 1.5, storm: 0.5, snow: 0 },
}
