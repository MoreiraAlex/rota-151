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
  // Quase plana e lisa (o chão perfeitamente plano fica para a 083).
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
  // Só jardim: árvores de rua, moitas, tufos e flores, poucos.
  vegetation: [
    {
      kind: 'broadleaf-tree',
      density: 0.04,
      scale: 0.9,
      models: ['round-tree', 'round-tree-b'],
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
    // Tamanho dos modelos do Let's Go na escala do treinador.
    scale: 1.6,
    // Os prédios únicos de toda cidade, um de cada, nos lotes perto do
    // meio dela (sorteados entre os `centralLots` mais centrais). `bench`:
    // banco ao lado da porta. O ginásio vai ser um por tema (futuro).
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
    ],
    centralLots: 6,
    // O porte de cada cidade (core/town/citySites.js), sorteado pelo
    // `weight`: o `radius` (m) do disco dela no mapa e quais prédios únicos
    // ela tem (`landmarks`: os `model` de `landmarks` acima; `special`: o
    // prédio especial do tema). A primeira cidade tem o porte
    // `CITIES.FIRST_SIZE`.
    sizes: [
      {
        id: 'village',
        name: 'Vila',
        weight: 4,
        radius: 110,
        landmarks: ['pokecenter'],
        special: false,
      },
      {
        id: 'town',
        name: 'Cidade',
        weight: 4.5,
        radius: 160,
        landmarks: ['pokecenter', 'poke-mart'],
        special: false,
      },
      {
        id: 'big-city',
        name: 'Cidade grande',
        weight: 1.5,
        radius: 230,
        landmarks: ['pokecenter', 'poke-mart', 'gym'],
        special: true,
      },
    ],
    // Os temas: cada cidade sorteia um (pela seed, `weight`) e segue ele
    // inteira — as casas (pelo peso; `fence`: cerca na frente), o prédio
    // especial (mais um prédio único; `scale` próprio quando o modelo é
    // grande), o calçamento da rua (`street`, camada de cor do chão) e,
    // a cor do ginásio (`gymColor`) e, opcionais, o poste (`lamp`) e a
    // cerca (`fence`) — sem eles, os de `props`.
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
    // Objetos de rua (os de todo tema que não diz o seu).
    props: {
      lamp: 'street-lamp',
      fence: 'fence-wood',
      bench: 'bench',
    },
  },
  tags: ['urban'],
  weather: { clear: 4, sun: 2, rain: 3, storm: 1, snow: 0 },
}
