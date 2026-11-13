/**
 * Cidade (docs/features/056-bioma-cidade.md) — Manchas pequenas e raras de
 * chão quase plano, com ruas em grade e quarteirões de prédios e objetos de
 * rua do Pokémon Let's Go — um Pokécenter, uma loja e um ginásio por
 * cidade, o resto casas, tudo no tema de uma cidade de Kanto (Pewter,
 * Cerulean, Vermilion, Lavender), com o prédio especial e a rua dela. Por enquanto sem funcionalidade: os prédios só
 * colidem. Sem selvagens, sem itens no chão e sem fruta.
 * Campos: ver `../_template/`.
 */
export const CITY = {
  id: 'city',
  name: 'Cidade',
  // Sem `size`, `coverage` nem `climate`: a cidade não disputa pelo clima —
  // é posta pela seed, uma por área (core/town/citySites.js,
  // docs/features/058-ajuste-dos-biomas.md), num disco do raio do porte
  // dela (`town.sizes`).
  // Quase plana e lisa (o chão perfeitamente plano fica para a 090).
  relief: {
    baseHeight: 3.5,
    hillHeight: 0.8,
    hillSize: 220,
    roughness: 0,
    flatness: 1,
  },
  palette: {
    bed: '#6b5a3e',
    shore: '#77c546',
    low: '#77c546',
    high: '#77c546',
    highHeight: 8,
    slope: '#64ad3a',
    trail: '#b9b2a4',
  },
  // Grama de jardim e o calçamento do Let's Go nas ruas (o canal das
  // trilhas, `town` abaixo).
  ground: {
    texture: 'grass',
    slopeTexture: 'rock',
    shoreTexture: 'sand',
    trailTexture: 'dry-ground',
    detail: 0.4,
    colors: {
      base: 'lgpe-grass',
      trail: 'lgpe-street',
    },
  },
  trails: false,
  // Só jardim: árvores de rua, moitas, tufos, flores e manchas de grama
  // em fios, poucos. As árvores e a grama são as do mundo (as folhosas dos
  // pacotes com as folhas do Let's Go e a grama da planície,
  // docs/features/069-revisao-do-bioma-cidade.md).
  vegetation: [
    {
      kind: 'broadleaf-tree',
      density: 0.04,
      scale: 0.9,
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
      density: 0.3,
      patches: { amount: 0.3, size: 8 },
      models: ['round-bush', 'flower-bush'],
    },
    {
      kind: 'leafy-plant',
      density: 0.3,
      patches: { amount: 0.3, size: 8 },
      models: ['tuft-route'],
    },
    {
      kind: 'flower',
      density: 0.3,
      patches: { amount: 0.4, size: 6 },
      models: ['flower-white', 'flower-yellow', 'flower-9'],
    },
    // A grama em fios da planície, em manchas de jardim.
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
  // A grade da cidade (core/town/townPlan.js).
  town: {
    // Lado (m) de um quarteirão, rua inclusa — divide a metade do bloco de
    // sólidos (`TERRAIN.SOLIDS_BLOCK_SIZE`, centrado na origem): nenhum
    // quarteirão fica em dois.
    blockSize: 40,
    // Largura (m) da rua e da borda dela (onde o calçamento some).
    streetWidth: 4,
    streetEdge: 1,
    // Peso da cidade (0 a 1) a partir do qual há rua e lote: abaixo, a
    // borda (o bioma vizinho entra aos poucos).
    minShare: 0.6,
    // Lotes por lado de um quarteirão.
    lotsPerSide: 2,
    // Distância (m) da frente do prédio até a rua.
    setback: 2.5,
    // Quanto (m) a base do prédio desce no chão (sem vão no chão inclinado).
    sink: 0.3,
    // Tamanho dos prédios do Let's Go na escala do treinador.
    scale: 1.6,
    // Tamanho dos objetos de rua (postes, bancos, cercas e os detalhes), à
    // parte do dos prédios (docs/features/069-revisao-do-bioma-cidade.md):
    // no Let's Go a porta e os objetos de rua estão na escala do jogador e
    // o corpo da casa é pequeno — aumentar os prédios não aumenta o resto.
    propScale: 1.25,
    // Os prédios únicos de toda cidade, um de cada, nos lotes perto do
    // meio dela (sorteados entre os `centralLots` mais centrais, na ordem
    // da lista). `bench`: banco ao lado da porta. O ginásio vai ser um por
    // tema (futuro). O campo de treino (`field`) não é um modelo: o lote
    // ganha cerca e bonecos (`trainingField`, abaixo). Nem a praça
    // (`plaza`): fonte, bancos e canteiros (`plaza`, abaixo).
    landmarks: [
      { model: 'pokecenter', bench: true },
      { model: 'poke-mart', bench: true },
      // O ginásio leva a cor do tema (`gymColor`) nas partes coloridas do
      // modelo (`paint.materials`: telhado, frisos e porta), com a força
      // `paint.amount` (0 a 1).
      {
        model: 'gym',
        paint: {
          amount: 0.85,
          materials: [
            'bldg_gym_roof01_com',
            'bldg_gym_wall02_com',
            'bldg_gym_door01_com',
            'bldg_gym_door01_com1',
          ],
        },
      },
      { id: 'training-field', field: true },
      { id: 'plaza', plaza: true },
    ],
    // O campo de treino (docs/features/067-campo-de-treino-e-avisos-de-
    // nivel.md): o único lugar onde o Pokémon do time treina golpe. O lote
    // inteiro, cercado (a cerca do tema; a entrada, de `gateWidth` m, de
    // frente para a rua), com o chão de terra das estradas (até `groundInset`
    // m da divisa, esmaecendo em `groundEdge` m) e os bonecos (`dummy`, o
    // modelo; `scale` próprio; `turn`, quanto ele gira (rad) para a frente
    // dele olhar a entrada) em `columns` × `rows`, a `spacing` m um do
    // outro, virados para a entrada. `fenceInset`: quanto a cerca fica para
    // dentro da divisa.
    trainingField: {
      dummy: 'treino-training-dummy',
      scale: 1,
      turn: -Math.PI / 2,
      columns: 3,
      rows: 2,
      spacing: 5,
      fenceInset: 0.6,
      gateWidth: 4,
      groundInset: 0.4,
      groundEdge: 1.2,
    },
    // A praça (docs/features/069-revisao-do-bioma-cidade.md): a fonte no
    // meio do lote (`fountainScale`, vezes o `propScale`), um banco de cada
    // lado a `benchRing` m do meio, virado para ela, e um canteiro em cada
    // canto a `bedOffset` m do meio em X e em Z (`bedScale`). O chão é
    // calçado com a rua da cidade até `groundInset` m da divisa,
    // esmaecendo em `groundEdge` m. A fonte afunda `fountainSink` m no
    // chão (do ponto mais alto debaixo dela): a borda fica baixa o bastante
    // para qualquer um passar por cima andando (o degrau do character
    // controller) — só ela colide (`ring`, `scripts/lgpe/colliders.js`). A
    // fonte não tem piso: o fundo é o chão calçado. A água (`water`,
    // core/town/fountains.js): um disco de raio `radius` (no tamanho do
    // modelo) a `depth` m acima desse chão — rasa, abaixo do que o menor
    // Pokémon entra andando (`WATER.WADE_FRACTION`), e é essa a
    // profundidade que a física e os efeitos da beirada dos rios veem. A cor
    // lê `colorDepth` no meio e `edgeDepth` na beira (a espuma, no raso).
    plaza: {
      fountainSink: 0.5,
      water: { radius: 1.37, depth: 0.05, colorDepth: 0.4, edgeDepth: 0.04 },
      fountainScale: 1,
      benchRing: 5.5,
      bedOffset: 6,
      bedScale: 0.6,
      groundInset: 0.4,
      groundEdge: 1.2,
    },
    // Os detalhes (docs/features/069-revisao-do-bioma-cidade.md), cada um
    // com a chance dele (0 a 1): no quintal de cada casa, a caixa de
    // correio, a floreira, o vaso e o caminho de pedras (uma pedra a cada
    // `pathStep` m, no tamanho `stoneScale` vezes o `propScale`); em cada
    // esquina de dentro do quarteirão, o hidrante; em cada divisa de lotes
    // na beira da rua, a árvore de rua (a folhosa do jardim, a `treeInset`
    // m da rua).
    details: {
      mailbox: 0.7,
      planter: 0.6,
      pot: 0.5,
      path: 0.8,
      pathStep: 0.9,
      stoneScale: 0.45,
      hydrants: 0,
      streetTrees: 0.85,
      treeInset: 1.6,
    },
    centralLots: 6,
    // O porte de cada cidade (core/town/citySites.js), sorteado pelo
    // `weight`: o `radius` (m) do disco dela no mapa e quais prédios únicos
    // ela tem (`landmarks`: o `id` ou o `model` de `landmarks` acima; o
    // campo de treino em todas; `special`: o
    // prédio especial do tema). A primeira cidade tem o porte
    // `CITIES.FIRST_SIZE`.
    sizes: [
      {
        id: 'village',
        name: 'Vila',
        weight: 4,
        radius: 110,
        landmarks: ['pokecenter', 'training-field', 'plaza'],
        special: false,
      },
      {
        id: 'town',
        name: 'Cidade',
        weight: 4.5,
        radius: 160,
        landmarks: ['pokecenter', 'poke-mart', 'training-field', 'plaza'],
        special: false,
      },
      {
        id: 'big-city',
        name: 'Cidade grande',
        weight: 1.5,
        radius: 230,
        landmarks: [
          'pokecenter',
          'poke-mart',
          'gym',
          'training-field',
          'plaza',
        ],
        special: true,
      },
    ],
    // Os temas: cada cidade sorteia um (pela seed, `weight`) e segue ele
    // inteira — as casas (pelo peso; `fence`: cerca na frente), o prédio
    // especial (mais um prédio único; `scale` próprio quando o modelo é
    // grande), o calçamento da rua (`street`, camada de cor do chão) e,
    // a cor do ginásio (`gymColor`) e, opcionais, o poste (`lamp`), a
    // cerca (`fence`) — sem eles, os de `props` — e o objeto do quintal
    // (`yard`: ao lado da casa, com a chance `chance`).
    themes: [
      {
        id: 'pewter',
        gymColor: '#a08a6a',
        name: 'Pewter',
        weight: 1,
        street: 'lgpe-pewter-tile',
        special: { model: 'pewter-museum', scale: 0.95 },
        houses: [
          { model: 'house-pewter', weight: 1 },
          { model: 'house-pewter-b', weight: 1, fence: true },
        ],
      },
      {
        id: 'cerulean',
        gymColor: '#3d8fe0',
        name: 'Cerulean',
        weight: 1,
        street: 'lgpe-cerulean-tile',
        special: { model: 'cerulean-bike-shop', bench: true },
        lamp: 'cerulean-lamp',
        yard: [{ model: 'bike', chance: 0.3 }],
        houses: [
          { model: 'cerulean-house-a', weight: 1 },
          { model: 'cerulean-house-b', weight: 1 },
          { model: 'cerulean-house-c', weight: 1, fence: true },
          { model: 'cerulean-house-d', weight: 1 },
        ],
      },
      {
        id: 'vermilion',
        gymColor: '#f2c230',
        name: 'Vermilion',
        weight: 1,
        street: 'lgpe-vermilion-tile',
        special: { model: 'vermilion-fan-club', bench: true },
        houses: [
          { model: 'vermilion-house-a', weight: 2, fence: true },
          { model: 'vermilion-house-b', weight: 1 },
        ],
      },
      {
        id: 'lavender',
        gymColor: '#8a5cc7',
        name: 'Lavender',
        weight: 1,
        street: 'lgpe-lavender-asphalt',
        special: { model: 'lavender-tower' },
        houses: [{ model: 'lavender-house', weight: 1, fence: true }],
      },
    ],
    // Objetos de rua (os de todo tema que não diz o seu) e os dos detalhes
    // (docs/features/069-revisao-do-bioma-cidade.md): caixa de correio,
    // hidrante, floreira, vaso, pedra de caminho e, na praça, a fonte e o
    // canteiro.
    props: {
      lamp: 'street-lamp',
      fence: 'fence-wood',
      bench: 'bench',
      mailbox: 'mailbox',
      hydrant: 'hydrant',
      planter: 'planter',
      pot: 'potted-plant',
      stone: 'stepping-stone',
      fountain: 'fountain',
      flowerBed: 'log-flower-bed',
    },
  },
  tags: ['urban'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
