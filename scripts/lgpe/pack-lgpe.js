#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { decodeDds } from './dds.js'
import { bonePath, decodeVertices, parseGfbmdl } from './gfbmdl.js'
import { encodePng, hasAlpha, shrinkTo } from './image.js'
import { writeGlb } from './glb.js'
import { clusterObjects, piecesOf, sizeSignature } from './splitObjects.js'

/**
 * Empacota os assets de cenário do Pokémon Let's Go para o jogo
 * (docs/features/052-assets-do-lgpe-e-floresta.md — a vegetação e o chão
 * dos biomas):
 *
 * - **props** tirados dos mapas da Floresta de Viridian (`forest001_00`),
 *   da Rota 1 (`road001_00`, as árvores redondas) e das rotas de campo da
 *   planície (Rotas 3 e 22 — docs/features/053-planicie-com-assets-do-
 *   lgpe.md) e das rotas secas da savana (Rotas 4 e 9 —
 *   docs/features/054-savana-lgpe-e-saida-do-megakit.md), onde cada tipo de
 *   árvore, planta ou pedra vem fundido numa malha só: separa os objetos
 *   (`splitObjects.js`) e fica com o mais comum de cada tipo;
 * - **props soltos** da `buildmodel/` (mato alto, flores, tufos, árvore de
 *   Corte), inteiros;
 * - **texturas** (DDS BC1/BC3 → PNG, até `MAX_TEXTURE` px) dos props, do
 *   chão do mapa e as tabelas de toon (rampa da sombra).
 *
 * Grava em `public/assets/vegetation/lgpe/`: `props/<id>.glb` (centímetros →
 * metros, base no chão e centro no meio), `textures/<nome>.png` e
 * `manifest.json` (o material de cada parte: texturas por papel, corte do
 * alfa, cor da sombra e da luz de borda — os números do jogo original).
 *
 * Entrada: a pasta `field/` extraída do `LGPE-FieldMaps.7z` (guardado em
 * `.exemple/ambient/LGPE/`). Para extrair só o necessário:
 *   npx -y -p 7zip-bin node -e "console.log(require('7zip-bin').path7za)"
 *   <7za> x LGPE-FieldMaps.7z 'field/forest/*' 'field/area02/*' 'field/area03/*' 'field/area04/*' 'field/buildmodel/*' -o<pasta>
 *
 * Uso:
 *   node scripts/lgpe/pack-lgpe.js --field <pasta>/field
 *
 * `--extra <arquivo.json>`: props a mais (a mesma forma de `MAP_PROPS`),
 * para olhar candidatos sem mexer na lista — com `--out` numa pasta à
 * parte.
 *
 * Nos do `--extra`, `scale` (opcional) muda o tamanho do modelo (a
 * árvore de 12 m do cenário de batalha vira uma de rota).
 *
 * `--only-extra`: só os do `--extra` (sem os do jogo, o chão e as tabelas
 * de toon) e `--prefix <texto>` antes do nome de cada textura — um pacote
 * para o laboratório de biomas (docs/features/066-revisao-dos-biomas.md,
 * `scripts/lab/README.md`), ex.: a folhosa do cenário de batalha.
 *
 * As salas por dentro dos prédios (docs/features/068-interior-dos-
 * predios.md) saem assim, com `all: true` e `whole: true` no `--extra`
 * (`scripts/lgpe/interiors.json`, o mapa inteiro da sala) e `--out` em
 * `public/assets/interiors/lgpe` — a colisão delas vem depois, de
 * `scripts/lgpe/interior-colliders.js`. Um objeto solto da `buildmodel/`
 * que vai na sala (a máquina de cura) entra no mesmo `--extra` com `file`
 * (e `skip`, as partes de efeito que ficam de fora).
 *
 * Um pedaço de um nó inteiro sai com `crop` (a janela, m do original: só
 * os triângulos com o meio nela), e um objeto de um nó fundido, com
 * `objectAt` (o objeto que cobre o ponto, m do original; `objectMargin`,
 * a folga em cm do grupo de peças) — o kit das cercas, cercas-vivas e
 * moitas de Viridian montada à mão
 * (docs/features/069-revisao-do-bioma-cidade.md).
 *
 * As cidades copiadas inteiras (docs/features/069-revisao-do-bioma-
 * cidade.md, Pallet) saem do mesmo jeito (`scripts/lgpe/town-maps.json`,
 * `--out public/assets/town-maps/lgpe`), com `doors` (uma porta da
 * `buildmodel/` por vão escuro) e `skipShaders` (os efeitos do mapa); o
 * manifesto guarda a `origin` do modelo e a colisão vem de
 * `scripts/lgpe/town-map-colliders.js`.
 */

const { values: args } = parseArgs({
  options: {
    field: { type: 'string' },
    out: { type: 'string', default: 'public/assets/vegetation/lgpe' },
    extra: { type: 'string' },
    'only-extra': { type: 'boolean', default: false },
    prefix: { type: 'string', default: '' },
  },
})
const onlyExtra = args['only-extra']
if (!args.field) throw new Error('faltou --field <pasta field/ extraída>')

const MAX_TEXTURE = 512
const CENTIMETERS = 0.01
// Props tirados de mapas (onde vêm fundidos): o mapa, a pasta das
// texturas dele e o nó (caminho do osso) de cada um.
const FOREST = { map: 'forest/forest001_00.gfbmdl', folder: 'forest' }
const ROUTE_1 = { map: 'area02/road001_00.gfbmdl', folder: 'area02' }
const ROUTE_1_TREES = 'road001_00_tree/tree35'
const ROUTE_1_GRASS = 'road001_00_grass'
// Rotas de campo (docs/features/053-planicie-com-assets-do-lgpe.md): as
// árvores, tufos, flores e pedras da planície.
const ROUTE_3 = { map: 'area03/road003_00.gfbmdl', folder: 'area03' }
const ROUTE_22 = { map: 'area02/road022_00.gfbmdl', folder: 'area02' }
// Rotas secas (docs/features/054-savana-lgpe-e-saida-do-megakit.md): as
// pedras na terra da savana.
const ROUTE_4 = { map: 'area03/road004_1_00.gfbmdl', folder: 'area03' }
const ROUTE_9 = { map: 'area04/road009_00.gfbmdl', folder: 'area04' }
// Cidades (docs/features/056-bioma-cidade.md): os prédios e os objetos de
// rua. Os prédios vêm em nós próprios (com filhos: telhado, janela, placa),
// tirados inteiros (`whole`); a porta fica do lado +Z do modelo.
const PALLET = { map: 'area02/town001_00.gfbmdl', folder: 'area02' }
const PEWTER = { map: 'area03/town003_00.gfbmdl', folder: 'area03' }
// Os temas das cidades (um tema por cidade de Kanto): as casas, o prédio
// especial e o poste de cada uma. Nas cidades em que as casas vêm fundidas
// num nó, `object` diz qual delas.
const CERULEAN = { map: 'area04/town004_00.gfbmdl', folder: 'area04' }
const VERMILION = { map: 'area09/town006_00.gfbmdl', folder: 'area09' }
const LAVENDER = { map: 'area08/town005_00.gfbmdl', folder: 'area08' }
// Os detalhes das cidades (docs/features/069-revisao-do-bioma-cidade.md):
// caixa de correio, hidrante, floreira, vaso, pedras de caminho, fonte e
// canteiro, tirados de outras cidades de Kanto.
const VIRIDIAN = { map: 'area02/town002_00.gfbmdl', folder: 'area02' }
const CELADON = { map: 'area06/town007_00.gfbmdl', folder: 'area06' }
const SAFFRON = { map: 'area07/town011_00.gfbmdl', folder: 'area07' }
// Os nós com os vãos escuros das portas de Pallet e de Viridian (fora dos
// prédios).
const PALLET_DOORWAYS = 'inndoor'
const VIRIDIAN_DOORWAYS = 'town002_00_doorway'
// O kit da cerca de Viridian: a janela (m do original) de um trilho de
// cada comprimento, do poste do começo até antes do poste do fim, e a do
// poste da ponta de um trecho.
const VIRIDIAN_FENCE_KIT = [
  ['viridian-fence-3', 'Cerca 3 m (Viridian)', [5.94, -75.8, 8.93, -75.2]],
  ['viridian-fence-2', 'Cerca 2 m (Viridian)', [13.94, -77.8, 15.93, -77.2]],
  ['viridian-fence-1', 'Cerca 1 m (Viridian)', [14.94, -75.8, 15.93, -75.2]],
  [
    'viridian-fence-2-4',
    'Cerca 2,4 m (Viridian)',
    [35.29, -62.55, 37.68, -61.95],
  ],
  [
    'viridian-fence-post',
    'Poste da cerca (Viridian)',
    [37.65, -65.2, 37.85, -64.8],
  ],
].map(([id, label, crop]) => ({ id, label, crop }))
// As cercas-vivas de Viridian: um ponto (m do original) dentro de cada
// formato.
const VIRIDIAN_HEDGE_KIT = [
  ['viridian-hedge', 'Cerca-viva (Viridian)', [16.5, -71.5]],
  ['viridian-hedge-2', 'Cerca-viva dupla (Viridian)', [20.5, -74.5]],
  ['viridian-hedge-4', 'Cerca-viva comprida (Viridian)', [23, -69.5]],
].map(([id, label, at]) => ({ id, label, at }))
// Um objeto de um nó fundido (`object`, docs/features/056-bioma-cidade.md):
// os grandes (prédios), da esquerda para a direita e de trás para a frente.
const BUILDING_MIN_WIDTH = 200
const BUILDING_MIN_HEIGHT = 150
// Folga (cm) em que as peças de um prédio ainda são o mesmo objeto (o
// telhado solto da parede).
const BUILDING_MARGIN = 30
// Quanto (m) para cada lado do buraco da porta conta como a parede em
// volta dele (a frente onde a porta encaixa).
const DOOR_WALL_REACH = 1
const MAP_PROPS = [
  {
    id: 'round-tree',
    label: 'Árvore redonda (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree001`,
  },
  {
    id: 'round-tree-b',
    label: 'Árvore redonda 2 (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree002`,
  },
  {
    id: 'round-tree-c',
    label: 'Árvore redonda 3 (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree004`,
  },
  {
    id: 'round-tree-d',
    label: 'Árvore redonda 4 (Rota 1)',
    category: 'tree',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree005`,
  },
  {
    id: 'round-bush',
    label: 'Moita redonda (Rota 1)',
    category: 'bush',
    ...ROUTE_1,
    node: `${ROUTE_1_TREES}/tree006`,
  },
  {
    id: 'pine-viridian',
    label: 'Pinheiro (Viridian)',
    category: 'tree',
    ...FOREST,
    node: 'tree1',
  },
  {
    id: 'tall-trunk',
    label: 'Tronco alto (borda da mata)',
    category: 'tree',
    ...FOREST,
    node: 'tree/tree01',
  },
  {
    id: 'young-tree',
    label: 'Árvore jovem (Viridian)',
    category: 'tree',
    ...FOREST,
    node: 'tree/tree02',
  },
  {
    id: 'fern',
    label: 'Samambaia',
    category: 'bush',
    ...FOREST,
    node: 'plant02',
  },
  { id: 'tuft', label: 'Tufo', category: 'tuft', ...FOREST, node: 'plant01' },
  {
    id: 'clover',
    label: 'Trevo',
    category: 'plant',
    ...FOREST,
    node: 'plant03',
  },
  {
    id: 'clover-large',
    label: 'Trevo grande',
    category: 'plant',
    ...FOREST,
    node: 'plant04',
  },
  {
    id: 'rock-large',
    label: 'Pedra com trevo',
    category: 'rock',
    ...FOREST,
    node: 'rock/rock01',
  },
  {
    id: 'rock-small',
    label: 'Pedra pequena',
    category: 'rock',
    ...FOREST,
    node: 'rock/rock02',
  },
  {
    id: 'round-tree-e',
    label: 'Pinheiro (Rota 3)',
    category: 'tree',
    ...ROUTE_3,
    node: 'road003_00_tree/tree02_3',
  },
  {
    id: 'round-tree-f',
    label: 'Árvore redonda média (Rota 3)',
    category: 'tree',
    ...ROUTE_3,
    node: 'road003_00_tree/tree01_2',
  },
  {
    id: 'tuft-route',
    label: 'Tufo (Rota 1)',
    category: 'tuft',
    ...ROUTE_1,
    node: `${ROUTE_1_GRASS}/road001_00_grass01`,
  },
  {
    id: 'tuft-medium',
    label: 'Tufo médio (Rota 1)',
    category: 'tuft',
    ...ROUTE_1,
    node: `${ROUTE_1_GRASS}/road001_00_grass06`,
  },
  {
    id: 'rock-grass',
    label: 'Pedrinha na grama (Rota 1)',
    category: 'rock',
    ...ROUTE_1,
    node: 'road001_00_rock',
  },
  {
    id: 'rock-soil',
    label: 'Pedrinha na terra (Rota 22)',
    category: 'rock',
    ...ROUTE_22,
    node: 'road022_00_rock/road022_00_rock02',
  },
  {
    id: 'rock-soil-b',
    label: 'Pedrinha na terra (Rota 3)',
    category: 'rock',
    ...ROUTE_3,
    node: 'road003_00_rock/road003_00_rock02_001',
  },
  {
    id: 'rock-dirt',
    label: 'Pedra na terra (Rota 9)',
    category: 'rock',
    ...ROUTE_9,
    node: 'road009_00_rock/road009_00_mountain_rock01',
  },
  {
    id: 'rock-dirt-b',
    label: 'Pedra na terra escura (Rota 4)',
    category: 'rock',
    ...ROUTE_4,
    node: 'road004_1_00_rock/road004_1_00_rock03',
  },
  {
    id: 'rock-dirt-c',
    label: 'Pedra média na terra (Rota 4)',
    category: 'rock',
    ...ROUTE_4,
    node: 'road004_1_00_rock/road004_1_00_rock04',
  },
  {
    id: 'pokecenter',
    label: 'Pokécenter',
    category: 'building',
    ...PEWTER,
    node: 'bldg_pc',
    door: { model: 'combldg_pc_door01' },
    whole: true,
  },
  {
    id: 'poke-mart',
    label: 'Loja',
    category: 'building',
    ...PEWTER,
    node: 'bldg_shop',
    door: { model: 'combldg_shop_door01' },
    whole: true,
  },
  {
    id: 'gym',
    label: 'Ginásio',
    category: 'building',
    ...PEWTER,
    node: 'bldg_gym',
    door: { model: 'combldg_gym_door01' },
    whole: true,
  },
  {
    id: 'house-lab',
    label: 'Laboratório (Pallet)',
    category: 'building',
    ...PALLET,
    node: 'masaratown_house_labo',
    // O vão escuro fica no nó das portas de Pallet (`inndoor`), fora do
    // prédio, como em Viridian (docs/features/069-revisao-do-bioma-
    // cidade.md: o laboratório em Viridian).
    doorways: PALLET_DOORWAYS,
    door: { model: 'town001_door02' },
    whole: true,
  },
  {
    id: 'house-pewter',
    label: 'Casa de pedra (Pewter)',
    category: 'building',
    ...PEWTER,
    node: 'bldg_nibi_minka01',
    door: { model: 'town003_door02' },
    whole: true,
  },
  {
    id: 'house-pewter-b',
    label: 'Casa de pedra 2 (Pewter)',
    category: 'building',
    ...PEWTER,
    node: 'bldg_nibi_minka02',
    door: { model: 'town003_door02' },
    whole: true,
  },
  {
    id: 'pewter-museum',
    label: 'Museu (Pewter)',
    category: 'building',
    ...PEWTER,
    node: 'bldg_nibi_museum',
    whole: true,
  },
  // As duas últimas não têm porta na frente (casas fechadas no jogo).
  ...[2, 3, 5, 6].map((object, index) => ({
    id: `cerulean-house-${'abcd'[index]}`,
    label: `Casa ${index + 1} (Cerulean)`,
    category: 'building',
    ...CERULEAN,
    node: 'house',
    object,
    ...(index < 2 && { door: { model: 'town004_door01' } }),
  })),
  {
    id: 'cerulean-bike-shop',
    label: 'Loja de bicicleta (Cerulean)',
    category: 'building',
    ...CERULEAN,
    node: 'house',
    object: 1,
    door: { model: 'town004_door01' },
  },
  {
    id: 'cerulean-lamp',
    label: 'Poste (Cerulean)',
    category: 'street',
    ...CERULEAN,
    node: 'lamp',
  },
  // A segunda não tem porta na frente (casa fechada no jogo).
  ...[0, 2].map((object, index) => ({
    id: `vermilion-house-${'ab'[index]}`,
    label: `Casa ${index + 1} (Vermilion)`,
    category: 'building',
    ...VERMILION,
    node: 'bldg_minka',
    object,
    ...(index === 0 && { door: { model: 'town006_door01' } }),
  })),
  {
    id: 'vermilion-fan-club',
    label: 'Fã-clube (Vermilion)',
    category: 'building',
    ...VERMILION,
    node: 'bldg_minka',
    object: 1,
    door: { model: 'town006_door02' },
  },
  {
    id: 'lavender-house',
    label: 'Casa (Lavender)',
    category: 'building',
    ...LAVENDER,
    node: 'bldg_minka005_00',
    door: { model: 'town005_door01', x: 0 },
    whole: true,
  },
  {
    id: 'lavender-tower',
    label: 'Torre Pokémon (Lavender)',
    category: 'building',
    ...LAVENDER,
    node: 'tower005_00',
    whole: true,
  },
  {
    id: 'fence-wood',
    label: 'Cerca de madeira (Pallet)',
    category: 'street',
    ...PALLET,
    node: 'fence02',
    whole: true,
  },
  {
    id: 'bench',
    label: 'Banco (Pewter)',
    category: 'street',
    ...PEWTER,
    node: 'benchi_1',
  },
  {
    id: 'street-lamp',
    label: 'Poste (Pewter)',
    category: 'street',
    ...PEWTER,
    node: 'lamp01',
    // O vidro acende à noite (docs/features/069-revisao-do-bioma-cidade.md).
    glow: ['lamp_glass01_area03_2'],
  },
  // Os detalhes das cidades (docs/features/069-revisao-do-bioma-cidade.md).
  {
    id: 'mailbox',
    label: 'Caixa de correio (Saffron)',
    category: 'street',
    ...SAFFRON,
    node: 'posts/minka_post',
  },
  {
    id: 'hydrant',
    label: 'Hidrante (Saffron)',
    category: 'street',
    ...SAFFRON,
    node: 'firehiderants',
  },
  {
    id: 'planter',
    label: 'Floreira (Saffron)',
    category: 'street',
    ...SAFFRON,
    node: 'flower_bed',
  },
  {
    id: 'potted-plant',
    label: 'Vaso (Celadon)',
    category: 'street',
    ...CELADON,
    node: 'gardening02',
  },
  // Sem o piso da bacia (`dropFloor`, m da base): o chão da praça é o
  // fundo dela.
  {
    id: 'fountain',
    label: 'Fonte (Celadon)',
    category: 'street',
    ...CELADON,
    node: 'fountain01',
    dropFloor: 0.05,
  },
  {
    id: 'log-flower-bed',
    label: 'Canteiro de tronco (Viridian)',
    category: 'street',
    ...VIRIDIAN,
    node: 'kadan02_002_00',
    whole: true,
  },
  // A casa de Viridian, a cidade montada à mão (docs/features/069-revisao-
  // do-bioma-cidade.md): as duas do mapa são iguais (uma só, posta duas
  // vezes). O vão escuro da porta fica num nó à parte (`doorways`, o
  // pedaço dele debaixo da casa), e o manifesto guarda a `origin` (o
  // layout põe a casa no lugar do original). O Pokécenter, a loja e o
  // ginásio de Viridian são os mesmos de Pewter (`pokecenter`,
  // `poke-mart`, `gym`).
  {
    id: 'viridian-house',
    label: 'Casa (Viridian)',
    category: 'building',
    ...VIRIDIAN,
    node: 'bldg_minka',
    object: 0,
    doorways: VIRIDIAN_DOORWAYS,
    door: { model: 'town002_door01' },
    keepOrigin: true,
  },
  // As cercas, cercas-vivas e moitas de Viridian (docs/features/069-
  // revisao-do-bioma-cidade.md): um kit tirado do mapa, cada peça posta e
  // assentada sozinha pelo layout (o nosso degrau não é o do original) —
  // `scripts/lgpe/city-props.js` acha onde cada uma fica, pela `origin`.
  // A cerca: um módulo por comprimento de trilho (de poste a poste, com os
  // postes do começo e do meio; a janela é a de um trilho do mapa) e o
  // poste da ponta.
  ...VIRIDIAN_FENCE_KIT.map(({ id, label, crop }) => ({
    id,
    label,
    category: 'street',
    ...VIRIDIAN,
    node: 'fence_01_002_00',
    whole: true,
    crop,
    keepOrigin: true,
  })),
  // As cercas-vivas: o bloco, o duplo e o comprido (cada um como no mapa).
  ...VIRIDIAN_HEDGE_KIT.map(({ id, label, at }) => ({
    id,
    label,
    category: 'street',
    ...VIRIDIAN,
    node: 'town002_00_tree/town002_00_tree08',
    objectAt: at,
    keepOrigin: true,
  })),
  // A moita redonda: uma que fica sozinha no mapa.
  {
    id: 'viridian-bush',
    label: 'Moita (Viridian)',
    category: 'street',
    ...VIRIDIAN,
    node: 'town002_00_tree/town002_00_tree05',
    objectAt: [40.19, -53.44],
    keepOrigin: true,
  },
  // Os objetos de rua de Viridian (docs/features/069-revisao-do-bioma-
  // cidade.md): o poste, o banco, os vasos e as placas do mapa — cada um
  // posto pelo layout (`scripts/lgpe/city-props.js`). As cópias do mapa
  // estão todas viradas para o mesmo lado (a frente do banco para o sul).
  // `glow`: os materiais que acendem à noite (o vidro do poste).
  {
    id: 'viridian-lamp',
    label: 'Poste (Viridian)',
    category: 'street',
    ...VIRIDIAN,
    node: 'lamp_town002',
    objectAt: [26.51, -53.56],
    glow: ['lamp01_02_area02_6'],
  },
  {
    id: 'viridian-bench',
    label: 'Banco (Viridian)',
    category: 'street',
    ...VIRIDIAN,
    node: 'obj002_01',
    objectAt: [13.02, -55.5],
  },
  {
    id: 'viridian-pot',
    label: 'Vaso (Viridian)',
    category: 'street',
    ...VIRIDIAN,
    node: 'plant002_00/plant02',
    whole: true,
  },
  {
    id: 'viridian-pot-long',
    label: 'Floreira comprida (Viridian)',
    category: 'street',
    ...VIRIDIAN,
    node: 'plant002_00/plant05',
    whole: true,
  },
  ...[
    ['viridian-sign-town', 'Placa da cidade (Viridian)', 'signboard_town'],
    [
      'viridian-sign-gym',
      'Placa do ginásio (Viridian)',
      'bm_signboard04_bm_signboard04',
    ],
    ['viridian-sign', 'Placa (Viridian)', 'bm_signboard05'],
    ['viridian-sign-glass', 'Placa com vidro (Viridian)', 'bm_signboard02'],
  ].map(([id, label, node]) => ({
    id,
    label,
    category: 'street',
    ...VIRIDIAN,
    node: `signbord/${node}`,
    whole: true,
  })),
  // Chata: enfeite do chão, sem colisão (`decor`, fora do `colliders.js`).
  {
    id: 'stepping-stone',
    label: 'Pedra de caminho (Pewter)',
    category: 'decor',
    ...PEWTER,
    node: 'tobi_ishi/tobi_ishi01',
  },
  // Só de um tema: a bicicleta de Cerulean e o tambor do porto de
  // Vermilion.
  {
    id: 'bike',
    label: 'Bicicleta (Cerulean)',
    category: 'street',
    ...CERULEAN,
    node: 'bike_03',
  },
  {
    id: 'drum',
    label: 'Tambor (Vermilion)',
    category: 'street',
    ...VERMILION,
    node: 'obj006_00/can006',
  },
]

// Props soltos (`buildmodel/<arquivo>.gfbmdl`).
const LOOSE_PROPS = [
  {
    id: 'tall-grass',
    label: 'Mato alto',
    category: 'tall-grass',
    file: 'enc_grass01',
  },
  {
    id: 'tall-grass-2',
    label: 'Mato alto 2',
    category: 'tall-grass',
    file: 'enc_grass02',
  },
  { id: 'grass-low', label: 'Grama baixa', category: 'tuft', file: 'grass01' },
  {
    id: 'grass-clump',
    label: 'Moita de grama',
    category: 'tuft',
    file: 'grass03',
  },
  { id: 'reeds', label: 'Capim alto', category: 'tall-grass', file: 'grass04' },
  { id: 'shrub', label: 'Arbusto', category: 'bush', file: 'grass02_2' },
  {
    id: 'fern-loose',
    label: 'Samambaia solta',
    category: 'bush',
    file: 'grass05',
  },
  {
    id: 'flower-white',
    label: 'Flores brancas',
    category: 'flower',
    file: 'flower01',
  },
  {
    id: 'flower-small',
    label: 'Flores pequenas',
    category: 'flower',
    file: 'flower02',
  },
  {
    id: 'flower-carpet',
    label: 'Tapete de flores',
    category: 'flower',
    file: 'flower04',
  },
  {
    id: 'flower-yellow',
    label: 'Flores amarelas',
    category: 'flower',
    file: 'flowers03',
  },
  {
    id: 'flower-bush',
    label: 'Moita florida',
    category: 'bush',
    file: 'flowers05',
  },
  {
    id: 'flower-forest',
    label: 'Flores da mata',
    category: 'flower',
    file: 'flowers_forest01',
  },
  {
    id: 'flower-tree',
    label: 'Árvore florida',
    category: 'tree',
    file: 'flower12',
  },
  {
    id: 'flower-bush-b',
    label: 'Moita florida grande',
    category: 'bush',
    file: 'flowers07',
  },
  {
    id: 'flower-6',
    label: 'Flores 6',
    category: 'flower',
    file: 'flowers06',
  },
  {
    id: 'flower-9',
    label: 'Flores 9',
    category: 'flower',
    file: 'flowers09',
  },
  {
    id: 'flower-10',
    label: 'Flores 10',
    category: 'flower',
    file: 'flowers10',
  },
  {
    id: 'flower-11',
    label: 'Flores 11',
    category: 'flower',
    file: 'flowers11',
  },
  {
    id: 'flower-13',
    label: 'Flores 13',
    category: 'flower',
    file: 'flowers13',
  },
  {
    id: 'cut-tree-b',
    label: 'Árvore de Corte 2',
    category: 'tree',
    file: 'iaigiri_tree02',
  },
  {
    id: 'cut-tree',
    label: 'Árvore de Corte',
    category: 'tree',
    file: 'iaigiri_tree01',
  },
]

// Texturas do chão do mapa (as camadas de cor do chão dos biomas), pela
// pasta de onde vêm: as da floresta e as das rotas de campo.
const GROUND_TEXTURES = {
  forest: [
    'floor01_forest',
    'grass01_com',
    'grass02_com',
    'soil01_com',
    'soil08_com',
    'soil12_com',
    'soil13_com',
    'rock01_forest',
    'cliff01_com',
    'roadstone01_com',
    'greenblend01_com',
    'glassmask01_com',
  ],
  area02: [
    'grass01_area02',
    'grass02_area02',
    'grass03_area02',
    'grass03_com',
    'grass04_com',
    'soil01_area02',
    'soil08_area02',
    'soil09_com',
    'soil10_com',
    'sand01_com',
    'sand02_com',
    'cliff01_area02',
    // A rocha do paredão de Viridian, embaixo (com grama) e em cima (com
    // terra) — o barranco da montanha da cidade montada à mão
    // (docs/features/069-revisao-do-bioma-cidade.md).
    'cliff03_com',
    'cliff04_com',
    // Calçamento das ruas das cidades (docs/features/056-bioma-cidade.md).
    'roadtile01_area02',
    'roadtile02_area02',
    'asphalt01_area02',
    // As máscaras da beira da rua de Viridian montada à mão (a borda de
    // terra e a guia — docs/features/069-revisao-do-bioma-cidade.md); a do
    // lote é a `glassmask01_com`, da floresta.
    'asphaltmask01_area02',
    'tile02_01_area02',
  ],
  area03: ['tile01_01_area03'],
  area04: ['cliff02_com', 'tile01_01_area04'],
  // As ruas dos temas de Vermilion e Lavender.
  area09: ['tile02_01_area09'],
  area08: ['asphalt01_area08'],
}
const TOON_TABLES = ['shadowtable01_t', 'shadowtable02_t', 'lighttable01_t']

// Papéis de textura que não vão (profundidade, rampa e nuvem projetada).
const SKIPPED_SAMPLERS = new Set([
  'DepthBuffer',
  'ShadowToonTable',
  'lightToonTable',
  'LightProjMap',
])
const SHADOW_ONLY = 'FieldShadowOnlyShader'

const out = args.out
for (const dir of ['', 'props', 'textures'])
  mkdirSync(join(out, dir), { recursive: true })

const textures = {}
function packTexture(folder, name) {
  const id = `${args.prefix}${name}`
  if (textures[id]) return id
  const path = join(args.field, folder, `${name}.dds`)
  if (!existsSync(path)) return null
  const image = decodeDds(readFileSync(path))
  const small = shrinkTo(image, MAX_TEXTURE)
  const alpha = hasAlpha(small)
  writeFileSync(
    join(out, 'textures', `${id}.png`),
    encodePng(small, { opaque: !alpha }),
  )
  textures[id] = {
    file: `textures/${id}.png`,
    width: small.width,
    height: small.height,
    alpha,
  }
  return id
}

function materialEntry(model, material, folder) {
  const maps = {}
  for (const { sampler, index } of material.textures) {
    if (SKIPPED_SAMPLERS.has(sampler)) continue
    const name = packTexture(folder, model.textureNames[index])
    if (name) maps[sampler] = name
  }
  const { values, colors, commonValues } = material
  return {
    shader: material.shader,
    maps,
    // Corte do alfa (só nos recortados: folha, planta, mato).
    cutoff: values.DiscardValuie ?? null,
    doubleSided: commonValues.CullMode === 2 || values.DiscardValuie != null,
    shadowColor: colors.Shadow_Color ?? null,
    rimColor: colors.RimColor ?? null,
    rim:
      values.RimLight_Strength != null
        ? [values.RimLight_Min, values.RimLight_Max, values.RimLight_Strength]
        : null,
    lightColor: colors.LightColor ?? null,
    greenColor: colors.GreenColor ?? null,
    // Misturado com o fundo (vidro, brilho no chão — nas salas por dentro,
    // docs/features/068-interior-dos-predios.md): `'add'` com o alfa
    // pré-multiplicado (soma luz), `'alpha'` sem. Opaco: sem o campo.
    ...(material.blendMode !== 0 && {
      blend: commonValues.PreMultiplieMode === 1 ? 'add' : 'alpha',
    }),
    ...layerOf(material.shader, maps),
  }
}

// Os shaders de mistura do chão do mapa (a cidade copiada de Pallet,
// docs/features/069-revisao-do-bioma-cidade.md): duas texturas, a de baixo
// (grama, no UV plano do mundo) e a de cima (terra, barranco ou pedra), e
// o canal vermelho da cor por vértice é quanto da de cima aparece — não é
// cor. `uv`: o UV em que a de cima é lida (o barranco e a pedra têm o
// próprio, o chão usa o mesmo da grama).
const LAYER_SHADERS = {
  FieldGroundShader01: { base: 'GrassTex01', top: 'GroundTex01', uv: 0 },
  FieldCliffShader01: { base: 'GroundTex01', top: 'CliffTex01', uv: 1 },
  FieldRockShader: { base: 'GroundTex01', top: 'Rock_tex', uv: 1 },
}

function layerOf(shader, maps) {
  const layer = LAYER_SHADERS[shader]
  if (!layer || !maps[layer.base] || !maps[layer.top]) return {}
  return {
    layer: { base: maps[layer.base], top: maps[layer.top], uv: layer.uv },
  }
}

/**
 * Monta as primitivas (uma por material) dos vértices escolhidos
 * (`keepVertex(mesh, vertex, triângulo, vértices decodificados)`, pelo
 * primeiro vértice de cada triângulo), em metros, com o centro em XZ e a base em
 * Y = 0 — `center` é onde esse ponto ficava no original (m). Os materiais
 * de shader em `skipShaders` ficam de fora (os efeitos de um mapa
 * inteiro).
 */
function buildPrimitives(
  model,
  meshes,
  keepVertex,
  scale = 1,
  skipShaders = [],
) {
  const parts = []
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const { meshIndex, decoded } of meshes) {
    const mesh = model.meshes[meshIndex]
    for (const polygon of mesh.polygons) {
      const material = model.materials[polygon.materialIndex]
      if (material.shader === SHADOW_ONLY) continue
      if (skipShaders.includes(material.shader)) continue
      const remap = new Map()
      const indices = []
      for (let i = 0; i < polygon.faces.length; i += 3) {
        const triangle = [
          polygon.faces[i],
          polygon.faces[i + 1],
          polygon.faces[i + 2],
        ]
        if (!keepVertex(meshIndex, triangle[0], triangle, decoded)) continue
        for (const vertex of triangle) {
          if (!remap.has(vertex)) remap.set(vertex, remap.size)
          indices.push(remap.get(vertex))
        }
      }
      if (indices.length === 0) continue
      const vertices = [...remap.keys()]
      const pick = (attribute, size) => {
        if (!decoded[attribute]) return undefined
        const array = new Float32Array(vertices.length * size)
        vertices.forEach((vertex, i) => {
          for (let c = 0; c < size; c++) {
            array[i * size + c] =
              decoded[attribute].array[vertex * decoded[attribute].size + c]
          }
        })
        return array
      }
      const position = pick('position', 3).map(
        (value) => value * CENTIMETERS * scale,
      )
      for (let i = 0; i < position.length; i += 3) {
        for (let c = 0; c < 3; c++) {
          box[c] = Math.min(box[c], position[i + c])
          box[c + 3] = Math.max(box[c + 3], position[i + c])
        }
      }
      const normal = pick('normal', 3)
      if (normal) {
        for (let i = 0; i < normal.length; i += 3) {
          const length =
            Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1
          for (let c = 0; c < 3; c++) normal[i + c] /= length
        }
      }
      const color = decoded.color0
        ? Uint8Array.from(pick('color0', 4), (value) => Math.round(value))
        : undefined
      parts.push({
        material: material.name,
        position,
        normal,
        uv0: pick('uv0', 2),
        uv1: pick('uv1', 2),
        color,
        indices: Uint32Array.from(indices),
      })
    }
  }
  const center = [(box[0] + box[3]) / 2, box[1], (box[2] + box[5]) / 2]
  for (const part of parts) {
    for (let i = 0; i < part.position.length; i += 3) {
      for (let c = 0; c < 3; c++) part.position[i + c] -= center[c]
    }
  }
  const size = [box[3] - box[0], box[4] - box[1], box[5] - box[2]]
  return { parts, size, center }
}

/**
 * Sem o piso: os triângulos com os três vértices até `height` m da base
 * (`dropFloor` no prop) — o fundo da bacia da fonte, que brigava com o chão
 * calçado da praça (docs/features/069-revisao-do-bioma-cidade.md); o chão
 * dela vira o fundo, debaixo da água.
 */
function withoutFloor(built, height) {
  const parts = built.parts.map((part) => {
    const isLow = (vertex) => part.position[vertex * 3 + 1] <= height
    const indices = []
    for (let i = 0; i < part.indices.length; i += 3) {
      const triangle = part.indices.slice(i, i + 3)
      if ([...triangle].every(isLow)) continue
      indices.push(...triangle)
    }
    return { ...part, indices: Uint32Array.from(indices) }
  })
  return { ...built, parts: parts.filter(({ indices }) => indices.length) }
}

const props = {}
function saveProp(spec, model, folder, { parts, size }, extra = {}) {
  const materials = {}
  // A parte pode vir de outro modelo (`source`: a porta encaixada no
  // prédio, `withDoor`).
  for (const { material, source = { model, folder } } of parts) {
    materials[material] ??= materialEntry(
      source.model,
      source.model.materials.find(({ name }) => name === material),
      source.folder,
    )
  }
  for (const name of spec.glow ?? []) {
    if (!materials[name]) throw new Error(`${spec.id}: sem o material ${name}`)
    materials[name].glow = true
  }
  writeFileSync(join(out, 'props', `${spec.id}.glb`), writeGlb(spec.id, parts))
  props[spec.id] = {
    label: spec.label,
    category: spec.category,
    file: `props/${spec.id}.glb`,
    size: size.map((value) => Number(value.toFixed(3))),
    materials,
    ...extra,
  }
  const triangles = parts.reduce(
    (sum, part) => sum + part.indices.length / 3,
    0,
  )
  console.log(
    `${spec.id.padEnd(16)} ${size.map((v) => v.toFixed(2)).join(' × ')} m, ${triangles} triângulos`,
  )
}

// A caixa `[minX, minY, minZ, maxX, maxY, maxZ]` dos vértices das partes.
function boxOfParts(parts) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const { position } of parts) {
    for (let i = 0; i < position.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        box[c] = Math.min(box[c], position[i + c])
        box[c + 3] = Math.max(box[c + 3], position[i + c])
      }
    }
  }
  return box
}

// Folga (m) em volta do prédio em que um pedaço do vão escuro ainda é
// dele (a boca do vão fica rente à frente da parede).
const DOORWAY_REACH = 0.5

/**
 * O vão escuro da porta quando o mapa o põe num nó à parte (`spec.doorways`,
 * Viridian): os pedaços desse nó com o meio dentro da caixa do prédio (com
 * `DOORWAY_REACH` de folga) entram como mais partes dele, na mesma
 * origem — e o `withDoor` acha o vão neles.
 */
function withDoorways(spec, map, built) {
  if (!spec.doorways) return built
  const scale = spec.scale ?? 1
  const [centerX, , centerZ] = built.center
  const [sizeX, , sizeZ] = built.size
  const isUnder = ([minX, , minZ, maxX, , maxZ]) => {
    const x = ((minX + maxX) / 2) * CENTIMETERS * scale
    const z = ((minZ + maxZ) / 2) * CENTIMETERS * scale
    return (
      Math.abs(x - centerX) <= sizeX / 2 + DOORWAY_REACH &&
      Math.abs(z - centerZ) <= sizeZ / 2 + DOORWAY_REACH
    )
  }
  const keep = new Map()
  const meshes = map.groups
    .filter(({ boneIndex }) => bonePath(map, boneIndex) === spec.doorways)
    .map(({ meshIndex }) => {
      const decoded = decodeVertices(map.meshes[meshIndex])
      const { boxes, vertexPiece } = piecesOf(
        decoded.position.array,
        map.meshes[meshIndex].polygons.map(({ faces }) => faces),
      )
      const under = boxes.map(isUnder)
      keep.set(meshIndex, (vertex) => under[vertexPiece[vertex]])
      return { meshIndex, decoded }
    })
  const doorways = buildPrimitives(
    map,
    meshes,
    (meshIndex, vertex) => keep.get(meshIndex)(vertex),
    scale,
  )
  if (doorways.parts.length === 0) {
    throw new Error(`${spec.id}: nenhum vão de porta em ${spec.doorways}`)
  }
  // Da origem dos vãos para a do prédio.
  const offset = doorways.center.map((value, c) => value - built.center[c])
  for (const part of doorways.parts) {
    for (let i = 0; i < part.position.length; i += 3) {
      for (let c = 0; c < 3; c++) part.position[i + c] += offset[c]
    }
  }
  return { ...built, parts: [...built.parts, ...doorways.parts] }
}

// Onde o centro do modelo ficava no original (m): a cidade montada à mão
// põe o prédio no lugar dele (`keepOrigin`), e o mapa inteiro (`all`)
// precisa do mesmo ponto para a colisão (`scripts/lgpe/town-map-
// colliders.js`).
const originOf = (spec, built) =>
  spec.all || spec.keepOrigin
    ? { origin: built.center.map((value) => Number(value.toFixed(4))) }
    : {}

/**
 * A porta do prédio (docs/features/056-bioma-cidade.md): no Let's Go ela é
 * um modelo à parte da `buildmodel/` (`spec.door.model`), posto pelo mapa;
 * no prédio só fica o vão escuro (material `doorway`). Encaixa a porta na
 * boca do vão (o meio dele em X, o chão dele, a frente dele em Z) — ou,
 * sem vão (a porta é um buraco na parede), em `spec.door.x`, na frente da
 * parede ali. A porta entra como mais partes do prédio (`source`: os
 * materiais vêm do modelo dela).
 */
function withDoor(spec, built) {
  if (!spec.door) return built
  const door = parseGfbmdl(
    readFileSync(join(args.field, 'buildmodel', `${spec.door.model}.gfbmdl`)),
  )
  const doorParts = buildPrimitives(
    door,
    door.meshes.map((mesh, meshIndex) => ({
      meshIndex,
      decoded: decodeVertices(mesh),
    })),
    () => true,
  )
  const doorways = built.parts.filter(({ material }) =>
    /doorway/i.test(material),
  )
  let at
  if (doorways.length > 0) {
    const box = boxOfParts(doorways)
    at = [(box[0] + box[3]) / 2, box[1], box[5]]
  } else {
    // A frente da parede em volta do buraco (sem o telhado, que avança).
    const x = spec.door.x
    const near = built.parts.map(({ position }) => {
      const kept = []
      for (let i = 0; i < position.length; i += 3) {
        const isNear =
          Math.abs(position[i] - x) < DOOR_WALL_REACH &&
          position[i + 1] < doorParts.size[1]
        if (isNear) kept.push(position[i], position[i + 1], position[i + 2])
      }
      return { position: kept }
    })
    at = [x, 0, boxOfParts(near)[5]]
  }
  const [x, y, z] = [at[0], at[1], at[2] - doorParts.size[2] / 2]
  for (const part of doorParts.parts) {
    for (let i = 0; i < part.position.length; i += 3) {
      part.position[i] += x
      part.position[i + 1] += y
      part.position[i + 2] += z
    }
    part.source = { model: door, folder: 'buildmodel' }
  }
  return { ...built, parts: [...built.parts, ...doorParts.parts] }
}

// Folga (m) em que dois pedaços do vão escuro ainda são o mesmo vão.
const DOORWAY_MARGIN = 0.1

/**
 * Várias portas num modelo só (`spec.doors`, a lista dos modelos da
 * `buildmodel/`): o mapa inteiro de uma cidade, com um vão escuro por
 * prédio (docs/features/069-revisao-do-bioma-cidade.md, Pallet). Os vãos
 * são separados em pedaços e ordenados de oeste para leste (e de norte
 * para sul); a porta `n` vai no vão `n`, como em `withDoor`.
 */
function withDoors(spec, built) {
  if (!spec.doors) return built
  const doorways = built.parts.filter(({ material }) =>
    /doorway/i.test(material),
  )
  const boxes = doorways.flatMap(
    ({ position, indices }) => piecesOf(position, [indices]).boxes,
  )
  const { objectBoxes } = clusterObjects(boxes, DOORWAY_MARGIN)
  const sorted = objectBoxes.sort((a, b) => a[0] - b[0] || a[2] - b[2])
  if (sorted.length !== spec.doors.length) {
    throw new Error(
      `${spec.id}: ${sorted.length} vãos de porta, ${spec.doors.length} portas`,
    )
  }
  const parts = [...built.parts]
  spec.doors.forEach((name, index) => {
    const door = parseGfbmdl(
      readFileSync(join(args.field, 'buildmodel', `${name}.gfbmdl`)),
    )
    const doorParts = buildPrimitives(
      door,
      door.meshes.map((mesh, meshIndex) => ({
        meshIndex,
        decoded: decodeVertices(mesh),
      })),
      () => true,
    )
    const box = sorted[index]
    const x = (box[0] + box[3]) / 2
    const y = box[1]
    const z = box[5] - doorParts.size[2] / 2
    for (const part of doorParts.parts) {
      for (let i = 0; i < part.position.length; i += 3) {
        part.position[i] += x
        part.position[i + 1] += y
        part.position[i + 2] += z
      }
      part.source = { model: door, folder: 'buildmodel' }
      parts.push(part)
    }
  })
  return { ...built, parts }
}

/**
 * Só os triângulos com o meio dentro da janela `spec.crop` (`[minX, minZ,
 * maxX, maxZ]`, m do original): um pedaço de um nó que vem inteiro — um
 * módulo da cerca de Viridian (docs/features/069-revisao-do-bioma-
 * cidade.md), de poste a poste.
 */
function cropKeep(spec) {
  if (!spec.crop) return () => true
  const [minX, minZ, maxX, maxZ] = spec.crop
  return (meshIndex, vertex, triangle, decoded) => {
    const { array, size } = decoded.position
    let x = 0
    let z = 0
    for (const v of triangle) {
      x += array[v * size] * CENTIMETERS
      z += array[v * size + 2] * CENTIMETERS
    }
    x /= 3
    z /= 3
    return x >= minX && x < maxX && z >= minZ && z < maxZ
  }
}

// O objeto (índice em `objectBoxes`, cm) que cobre o ponto `[x, z]` (m do
// original), ou erro.
function objectAt(objectBoxes, [x, z]) {
  const index = objectBoxes.findIndex(
    (box) =>
      x * 100 >= box[0] &&
      x * 100 <= box[3] &&
      z * 100 >= box[2] &&
      z * 100 <= box[5],
  )
  if (index < 0) throw new Error(`nenhum objeto em ${x}, ${z}`)
  return index
}

// Dos mapas: o objeto mais comum do nó.
const extraProps = args.extra
  ? JSON.parse(readFileSync(args.extra, 'utf8'))
  : []
const maps = new Map()
const mapOf = (path) => {
  if (!maps.has(path))
    maps.set(path, parseGfbmdl(readFileSync(join(args.field, path))))
  return maps.get(path)
}
// O `n`-ésimo objeto grande (prédio) de um nó fundido, pela posição.
function nthBuildingOf(objectBoxes, n) {
  const buildings = objectBoxes
    .map((box, index) => ({ box, index }))
    .filter(
      ({ box }) =>
        box[3] - box[0] >= BUILDING_MIN_WIDTH &&
        box[4] - box[1] >= BUILDING_MIN_HEIGHT,
    )
    .sort((a, b) => a.box[0] - b.box[0] || a.box[2] - b.box[2])
  if (!buildings[n]) throw new Error(`não há o prédio ${n} no nó`)
  return buildings[n].index
}

// O nó (ou, com `whole` ou `object`, o nó e os filhos dele). Com `all`, o
// mapa inteiro: as salas por dentro dos prédios (docs/features/068-
// interior-dos-predios.md), que são um mapa só.
const isNodeOf = (spec, path) =>
  spec.all ||
  path === spec.node ||
  ((spec.whole || spec.object != null) && path.startsWith(`${spec.node}/`))
// Os do `--extra` com `file` são soltos (da `buildmodel/`), não de mapa.
const extraMapProps = extraProps.filter((spec) => !spec.file)
const extraLooseProps = extraProps.filter((spec) => spec.file)
for (const spec of [...(onlyExtra ? [] : MAP_PROPS), ...extraMapProps]) {
  const map = mapOf(spec.map)
  const meshes = map.groups
    .filter(({ boneIndex }) => isNodeOf(spec, bonePath(map, boneIndex)))
    .map(({ meshIndex }) => ({
      meshIndex,
      decoded: decodeVertices(map.meshes[meshIndex]),
    }))
  if (meshes.length === 0)
    throw new Error(`nó ${spec.node} não achado em ${spec.map}`)
  // Inteiro: o prédio é um objeto só (telhado, janela e placa juntos).
  if (spec.whole) {
    const built = withDoors(
      spec,
      withDoor(
        spec,
        withDoorways(
          spec,
          map,
          buildPrimitives(
            map,
            meshes,
            cropKeep(spec),
            spec.scale,
            spec.skipShaders,
          ),
        ),
      ),
    )
    saveProp(spec, map, spec.folder, built, originOf(spec, built))
    continue
  }
  const boxes = []
  const pieceOffset = new Map()
  const vertexPieces = new Map()
  for (const { meshIndex, decoded } of meshes) {
    const { boxes: own, vertexPiece } = piecesOf(
      decoded.position.array,
      map.meshes[meshIndex].polygons.map(({ faces }) => faces),
    )
    pieceOffset.set(meshIndex, boxes.length)
    vertexPieces.set(meshIndex, vertexPiece)
    boxes.push(...own)
  }
  // Os prédios (`object`) e os escolhidos por ponto (`objectAt`, folhas
  // soltas) juntam as peças perto umas das outras.
  const { pieceObject, objectBoxes } = clusterObjects(
    boxes,
    spec.object == null && !spec.objectAt
      ? 0
      : (spec.objectMargin ?? BUILDING_MARGIN),
  )
  const counts = new Map()
  objectBoxes.forEach((box, i) => {
    const signature = sizeSignature(box)
    if (!counts.has(signature)) counts.set(signature, [])
    counts.get(signature).push(i)
  })
  const [, objects] = [...counts.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0]
  const chosen = spec.objectAt
    ? objectAt(objectBoxes, spec.objectAt)
    : spec.object == null
      ? objects[0]
      : nthBuildingOf(objectBoxes, spec.object)
  const objectOf = (meshIndex, vertex) =>
    pieceObject[
      pieceOffset.get(meshIndex) + vertexPieces.get(meshIndex)[vertex]
    ]
  const built = withDoor(
    spec,
    withDoorways(
      spec,
      map,
      buildPrimitives(
        map,
        meshes,
        (meshIndex, vertex) => objectOf(meshIndex, vertex) === chosen,
        spec.scale,
      ),
    ),
  )
  saveProp(
    spec,
    map,
    spec.folder,
    spec.dropFloor ? withoutFloor(built, spec.dropFloor) : built,
    { copiesInMap: objects.length, ...originOf(spec, built) },
  )
}

// Soltos: o modelo inteiro.
// Com `skip` (expressão sobre o caminho do nó), sem as partes que batem —
// os efeitos de animação de um modelo (a máquina de cura do Pokécenter,
// docs/features/068-interior-dos-predios.md).
for (const spec of [...(onlyExtra ? [] : LOOSE_PROPS), ...extraLooseProps]) {
  const model = parseGfbmdl(
    readFileSync(join(args.field, 'buildmodel', `${spec.file}.gfbmdl`)),
  )
  const skip = spec.skip ? new RegExp(spec.skip) : null
  const meshes = skip
    ? model.groups
        .filter(({ boneIndex }) => !skip.test(bonePath(model, boneIndex)))
        .map(({ meshIndex }) => ({
          meshIndex,
          decoded: decodeVertices(model.meshes[meshIndex]),
        }))
    : model.meshes.map((mesh, meshIndex) => ({
        meshIndex,
        decoded: decodeVertices(mesh),
      }))
  saveProp(
    spec,
    model,
    'buildmodel',
    buildPrimitives(model, meshes, () => true),
  )
}

const ground = onlyExtra
  ? []
  : Object.entries(GROUND_TEXTURES)
      .flatMap(([folder, names]) =>
        names.map((name) => packTexture(folder, name)),
      )
      .filter(Boolean)
if (!onlyExtra) for (const name of TOON_TABLES) packTexture('forest', name)

writeFileSync(
  join(out, 'manifest.json'),
  JSON.stringify(
    {
      source: onlyExtra
        ? `Pokémon Let's Go Pikachu/Eevee — ${args.extra}`
        : "Pokémon Let's Go Pikachu/Eevee — forest001_00, road001_00, road003_00, road022_00, road004_1_00, road009_00, town001_00, town002_00, town003_00, town004_00, town005_00, town006_00, town007_00, town011_00 e buildmodel",
      props,
      ground,
      toonTables: onlyExtra ? [] : TOON_TABLES,
      textures,
    },
    null,
    2,
  ),
)
console.log(
  `${Object.keys(props).length} props, ${Object.keys(textures).length} texturas → ${out}`,
)
