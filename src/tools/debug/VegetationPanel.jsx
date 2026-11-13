'use client'

import { useEffect, useState } from 'react'
import GUI from 'lil-gui'
import { regenerarTerreno } from '@/core/actions/terrain'
import { cityArrivalPoint, irPara } from '@/core/actions/travel'
import { irParaMapaDaCidade, sairDoMapaDaCidade } from '@/core/actions/townMap'
import { townMapScale } from '@/core/townMap/townMapPlacement'
import { listBiomes } from '@/core/data/biomes'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WEATHER_TYPES } from '@/core/weather/weatherMap'
import { playerEntity, world } from '@/core/world/world'
import { Position } from '@/core/traits'
import { notifyRenderSettingsChanged } from '@/view/scene/renderSettings'
import { TERRAIN_COLOR_LAYERS } from '@/view/terrain/terrainLayers'
import { setColorLayerSizes } from '@/view/terrain/terrainMaterial'
import { requestLgpeModels } from '@/view/vegetation/lgpeChoices'
import { withProceduralProps } from '@/view/vegetation/bladeGrass'
import {
  LGPE_MANIFEST_PATH,
  lgpeChoicesOf,
  mergeLgpeManifests,
} from '@/view/vegetation/lgpeModels'
import {
  getVegetationSettings,
  rebuildVegetation,
  setVegetationVisible,
} from '@/view/vegetation/vegetationSettings'
import { WEATHER_LABELS } from './dayWeatherLabels'
import { isStatsVisible, setStatsVisible } from './statsOverlay'

// Ao lado dos painéis "Terreno" e "Dia e clima".
const PANEL_RIGHT = '520px'
const GRASS_KIND = 'tall-grass'

// [mín, máx, passo] e nome. A grama refaz os blocos ao soltar.
const GRASS_CONTROLS = {
  CLUMPS_PER_M2: { label: 'Tufos por m²', range: [0, 6, 0.05] },
  HEIGHT: { label: 'Altura (vertical)', range: [0.2, 4, 0.05] },
  HEIGHT_VARIATION: { label: 'Variação de altura', range: [0, 1, 0.01] },
  HEIGHT_PATCH_SIZE: { label: 'Manchas de altura (m)', range: [1, 30, 0.5] },
  COLOR_PATCH_SIZE: { label: 'Manchas de cor (m)', range: [0.2, 10, 0.1] },
  COLOR_VARIATION: { label: 'Variação de cor', range: [0, 1, 0.01] },
  MACRO_VARIATION: { label: 'Claro e escuro', range: [0, 1, 0.01] },
  MACRO_SIZE: { label: 'Claro e escuro (m)', range: [1, 40, 0.5] },
}
// Faixa de tamanho (`SCALE: [mín, máx]`): os dois números do array.
const scaleControls = (range) => ({
  0: { label: 'Tamanho mínimo', range },
  1: { label: 'Tamanho máximo', range },
})
// Onde o core sorteia (árvores e pedras, `solidParams`):
// mudam com o terreno refeito.
const SOLID_CONTROLS = {
  SPACING: { label: 'Espaçamento (m)', range: [2, 40, 0.5] },
  CHANCE: { label: 'Chance por célula', range: [0, 1, 0.01] },
}
// A planta das cidades (`town` do bioma, core/town/townPlan.js): muda com
// o terreno refeito. O quarteirão tem que dividir o bloco de sólidos.
const TOWN_CONTROLS = {
  scale: { label: 'Tamanho dos prédios', range: [0.5, 3, 0.05] },
  propScale: { label: 'Tamanho dos objetos de rua', range: [0.5, 3, 0.05] },
  streetWidth: { label: 'Largura da rua (m)', range: [2, 12, 0.5] },
  lotsPerSide: { label: 'Lotes por lado', range: [1, 3, 1] },
  setback: { label: 'Recuo da rua (m)', range: [0, 6, 0.1] },
  sink: { label: 'Base no chão (m)', range: [0, 1, 0.05] },
  minShare: { label: 'Borda (peso da cidade)', range: [0.1, 0.95, 0.01] },
  centralLots: {
    label: 'Pokécenter, loja e ginásio: entre os N lotes do meio',
    range: [3, 20, 1],
  },
}
// Os detalhes da cidade (`town.details`, docs/features/069-revisao-do-
// bioma-cidade.md) — refazem o terreno ao soltar.
const TOWN_DETAIL_CONTROLS = {
  mailbox: { label: 'Caixa de correio (chance)', range: [0, 1, 0.01] },
  planter: { label: 'Floreira (chance)', range: [0, 1, 0.01] },
  pot: { label: 'Vaso (chance)', range: [0, 1, 0.01] },
  path: { label: 'Caminho de pedras (chance)', range: [0, 1, 0.01] },
  pathStep: { label: 'Passo das pedras (m)', range: [0.4, 3, 0.05] },
  stoneScale: { label: 'Tamanho das pedras', range: [0.1, 1.5, 0.05] },
  hydrants: { label: 'Hidrante por esquina (chance)', range: [0, 1, 0.01] },
  streetTrees: { label: 'Árvore de rua (chance)', range: [0, 1, 0.01] },
  treeInset: {
    label: 'Árvore de rua: distância da rua (m)',
    range: [0, 6, 0.1],
  },
}
// A praça (`town.plaza`) — refaz o terreno ao soltar.
const PLAZA_CONTROLS = {
  fountainSink: { label: 'Fonte: quanto afunda (m)', range: [0, 1, 0.01] },
  fountainScale: { label: 'Tamanho da fonte', range: [0.3, 2, 0.05] },
  benchRing: { label: 'Bancos: distância do meio (m)', range: [2, 9, 0.1] },
  bedOffset: { label: 'Canteiros: distância do meio (m)', range: [2, 9, 0.1] },
  bedScale: { label: 'Tamanho dos canteiros', range: [0.2, 1.5, 0.05] },
  groundInset: { label: 'Calçamento: recuo da divisa (m)', range: [0, 3, 0.1] },
  groundEdge: { label: 'Calçamento: borda (m)', range: [0, 4, 0.1] },
}
// A água da fonte (`town.plaza.water`) — refaz o terreno ao soltar.
const FOUNTAIN_WATER_CONTROLS = {
  depth: { label: 'Profundidade (m)', range: [0, 0.3, 0.005] },
  colorDepth: { label: 'Cor: profundidade no meio', range: [0, 2, 0.01] },
  edgeDepth: { label: 'Cor: profundidade na beira', range: [0, 0.5, 0.005] },
  radius: { label: 'Raio (no modelo)', range: [0.5, 2, 0.01] },
}
// O campo de treino da cidade (`town.trainingField`, docs/features/067-
// campo-de-treino-e-avisos-de-nivel.md) — refaz o terreno ao soltar.
const TRAINING_FIELD_CONTROLS = {
  spacing: { label: 'Espaço entre bonecos (m)', range: [1.5, 8, 0.1] },
  columns: { label: 'Colunas', range: [1, 5, 1] },
  rows: { label: 'Fileiras', range: [1, 4, 1] },
  scale: { label: 'Tamanho do boneco', range: [0.5, 2, 0.05] },
  turn: { label: 'Giro do boneco (rad)', range: [-Math.PI, Math.PI, 0.01] },
}
// O balanço do boneco ao levar o golpe (`FEEDBACK.TRAINING_DUMMY_WOBBLE`) —
// vale na hora, no próximo golpe.
const DUMMY_WOBBLE_CONTROLS = {
  AMPLITUDE: { label: 'Inclinação máxima (rad)', range: [0, 0.6, 0.01] },
  FREQUENCY: { label: 'Idas e voltas por segundo', range: [0.5, 6, 0.1] },
  DAMPING: { label: 'Quanto morre por segundo', range: [0, 10, 0.1] },
  DURATION: { label: 'Duração (s)', range: [0.2, 4, 0.05] },
}
// As texturas que a rua de um tema pode usar (as camadas de cor do chão).
const STREET_LAYER_OPTIONS = TERRAIN_COLOR_LAYERS.map(([name]) => name)
// Onde ficam as cidades (`GAME_CONFIG.CITIES`, core/town/citySites.js,
// docs/features/058-ajuste-dos-biomas.md).
const CITIES_CONTROLS = {
  SPACING: { label: 'Distância entre cidades (m)', range: [400, 4000, 50] },
  JITTER: { label: 'Desvio do centro da célula', range: [0, 0.32, 0.01] },
  EDGE: { label: 'Borda da cidade (m)', range: [4, 120, 1] },
  WATER_GAP: { label: 'Folga da água (m)', range: [0, 80, 1] },
}
// Cada camada das serras do fundo (`GAME_CONFIG.BACKDROP.LAYERS`,
// view/scene/BackdropView.jsx): a cor vale na hora; a forma (os ângulos e
// as serras) só ao recarregar.
const BACKDROP_LAYER_CONTROLS = {
  shade: { label: 'Escurecer (1 = cor da névoa)', range: [0.3, 1.2, 0.01] },
  tintAmount: { label: 'Força do tom', range: [0, 1, 0.01] },
  mist: { label: 'Sai da névoa em (fração da altura)', range: [0, 1.5, 0.01] },
  minAngle: {
    label: 'Crista mais baixa (graus, recarregar)',
    range: [0, 15, 0.1],
  },
  maxAngle: {
    label: 'Crista mais alta (graus, recarregar)',
    range: [0, 25, 0.1],
  },
  frequency: { label: 'Serras em volta (recarregar)', range: [0.2, 6, 0.1] },
  ridged: { label: 'Crista pontuda (recarregar)', range: [0, 1, 0.01] },
}
// As estradas entre elas (`GAME_CONFIG.ROADS`, core/town/roads.js).
const ROADS_CONTROLS = {
  EXTRA: { label: 'Estradas extras (chance)', range: [0, 1, 0.01] },
  WARP: { label: 'Curvas da estrada', range: [0, 0.3, 0.01] },
  WIDTH: { label: 'Largura da estrada (m)', range: [1, 12, 0.1] },
  EDGE: { label: 'Borda da estrada (m)', range: [0.1, 5, 0.1] },
  DEPTH: { label: 'Afundado da estrada (m)', range: [0, 0.5, 0.01] },
  BANK: { label: 'Beirada da estrada (m)', range: [0, 0.3, 0.01] },
  FORD_DEPTH: { label: 'Fundura do vau (m)', range: [0, 0.3, 0.01] },
  FORD_WIDTH: { label: 'Largura do vau (m)', range: [2, 30, 0.5] },
}
// O que nasce por m² (sub-bosque): muda com a vegetação refeita.
const perM2Controls = (max) => ({
  PER_M2: { label: 'Por m²', range: [0, max, 0.005] },
})
const WIND_CONTROLS = {
  DIRECTION: { label: 'Direção (rad)', range: [0, Math.PI * 2, 0.01] },
  SPEED: { label: 'Velocidade', range: [0, 6, 0.05] },
  GUST_SCALE: { label: 'Faixas de rajada', range: [0.05, 2, 0.01] },
  TURBULENCE: { label: 'Agitação', range: [0, 1, 0.01] },
  FLUTTER: { label: 'Tremor na ponta', range: [0, 1, 0.01] },
}
// Conjuntos de grama (`clusters` da grama do bioma,
// core/vegetation/grassClusters.js): cada mancha e o mapa delas.
const CLUSTER_CONTROLS = {
  density: { label: 'Densidade', range: [0, 1, 0.01] },
  size: { label: 'Tamanho (m)', range: [2, 60, 0.5] },
  sizeVariation: { label: 'Variação de tamanho', range: [0, 1, 0.01] },
  roughness: { label: 'Borda recortada', range: [0, 1.5, 0.01] },
  edge: { label: 'Borda suave (0 = seca)', range: [0.005, 0.3, 0.005] },
  height: { label: 'Altura', range: [0.3, 2, 0.01] },
  holes: { label: 'Falhas', range: [0, 1, 0.01] },
}
const CLUSTER_MAP_CONTROLS = {
  coverage: { label: 'Quantidade', range: [0, 1, 0.01] },
  grouping: { label: 'Agrupamento', range: [0, 1, 0.01] },
  variety: { label: 'Variedade', range: [0, 1, 0.01] },
  background: { label: 'Grama de fundo', range: [0, 1, 0.01] },
  backgroundHeight: {
    label: 'Altura da grama de fundo',
    range: [0.2, 1.5, 0.01],
  },
  clearingPreference: {
    label: 'Preferência por clareira',
    range: [0, 1, 0.01],
  },
}

// Plantas abrindo para quem passa (`GRASS_PUSH`): vale na hora.
const PUSH_CONTROLS = {
  RADIUS: { label: 'Alcance além do corpo (m)', range: [0, 2, 0.01] },
  INNER: { label: 'Miolo com dobra inteira', range: [0, 1, 0.01] },
  BEND: { label: 'Dobra máxima (rad)', range: [0, 1.5, 0.01] },
  BUSH: { label: 'Dobra nos arbustos (parte)', range: [0, 1, 0.01] },
  ATTACK: { label: 'Tempo para deitar (s)', range: [0, 2, 0.01] },
  RECOVERY: { label: 'Tempo para voltar (s)', range: [0, 6, 0.05] },
  RUSTLE: { label: 'Tremor', range: [0, 0.5, 0.01] },
  HEIGHT_GATE: {
    label: 'Altura do pulo que solta (m)',
    range: [0.05, 3, 0.05],
  },
}

const COLOR_LABELS = {
  a: 'Cor (A)',
  b: 'Cor (B)',
}

const regenerate = () => regenerarTerreno(world)

// Quantas cidades (as mais perto do treinador) o "Ir para a cidade" lista.
const TRAVEL_CITY_COUNT = 12
// Rosa dos ventos (leste = +x, norte = +z, como as estradas).
const COMPASS = ['L', 'NE', 'N', 'NO', 'O', 'SO', 'S', 'SE']

// As cidades mais perto do treinador: o rótulo de cada uma no seletor
// (porte, tema, distância e direção) → a cidade.
function nearbyCities() {
  const { terrain } = TEST_LEVEL
  const { x, z } = playerEntity.get(Position) ?? { x: 0, z: 0 }
  const nearest = terrain.nearestCities?.(x, z, TRAVEL_CITY_COUNT) ?? []
  const byLabel = new Map()
  for (const { city, distance } of nearest) {
    const angle = Math.atan2(city.z - z, city.x - x)
    const sector = Math.round(angle / (Math.PI / 4))
    const direction = COMPASS[(sector + COMPASS.length) % COMPASS.length]
    // A cidade fixa (Viridian, 069) é a do mapa ou a montada à mão: nem
    // porte nem tema.
    const name = city.fixedTown
      ? city.fixedTown.name
      : `${city.size.name} · ${terrain.cityThemeAt?.(city.x, city.z)?.name ?? '?'}`
    const label = `${name} · ${Math.round(distance)} m ${direction}`
    byLabel.set(label, city)
  }
  return byLabel
}

/**
 * "Ir para a cidade" (docs/features/069-revisao-do-bioma-cidade.md): as
 * cidades mais perto do treinador num seletor e o botão que leva ele para
 * a rua do meio da escolhida (`irPara`) — para avaliar as cidades sem
 * correr até elas. "Atualizar lista" refaz a lista a partir de onde ele
 * está agora.
 */
function addTravelControls(folder, town) {
  const travel = folder.addFolder('Ir para a cidade')
  const state = { city: '' }
  let cities = new Map()
  let selector = null
  const refresh = () => {
    cities = nearbyCities()
    state.city = [...cities.keys()][0] ?? ''
    selector?.destroy()
    selector = travel.add(state, 'city', [...cities.keys()]).name('Cidade')
    // O seletor em cima dos botões (o lil-gui põe o novo no fim).
    travel.$children.prepend(selector.domElement)
  }
  const go = () => {
    const city = cities.get(state.city)
    if (!city) return
    const point = cityArrivalPoint(city, town)
    irPara(world, playerEntity, point.x, point.z)
  }
  travel.add({ go }, 'go').name('Ir')
  travel.add({ refresh }, 'refresh').name('Atualizar lista')
  refresh()
}

/**
 * "Pallet" (docs/features/069-revisao-do-bioma-cidade.md): a cidade
 * tutorial, copiada inteira do Let's Go — por enquanto só pelo F2. "Ir"
 * leva o treinador para a frente da casa dele, "Sair" o devolve para onde
 * estava; "Tamanho" é o do mapa (`TOWN_MAP.SCALE`, começa no dos prédios
 * da cidade) e vale na próxima ida.
 */
function addPalletControls(folder) {
  const pallet = folder.addFolder('Pallet')
  const config = GAME_CONFIG.TOWN_MAP
  config.SCALE = townMapScale()
  pallet
    .add({ go: () => irParaMapaDaCidade(world, playerEntity, 'pallet') }, 'go')
    .name('Ir para Pallet')
  pallet
    .add({ leave: () => sairDoMapaDaCidade(world, playerEntity) }, 'leave')
    .name('Sair de Pallet')
  pallet.add(config, 'SCALE', 0.5, 3, 0.05).name('Tamanho (na próxima ida)')
}

/**
 * "Viridian" (docs/features/069-revisao-do-bioma-cidade.md): a primeira
 * cidade, fixa no mundo, onde o treinador nasce. "Tamanho" é o da cidade
 * (`CITIES.FIRST_TOWN.SCALE`, começa no dos prédios da cidade) — faz
 * parte do relevo: refaz o mundo ao soltar.
 */
function addViridianControls(folder, town) {
  const viridian = folder.addFolder('Viridian')
  const config = GAME_CONFIG.CITIES.FIRST_TOWN
  config.SCALE ??= town.scale
  viridian
    .add(config, 'SCALE', 0.5, 3, 0.05)
    .name('Tamanho (refaz o mundo)')
    .onFinishChange(regenerate)
}

// O tamanho (m) da textura da rua de um tema de cidade: o próprio da
// camada que ela usa (`TERRAIN_LOOK.COLOR_LAYER_SIZES`) ou o de todas.
function streetTextureSizeOf(theme) {
  const look = GAME_CONFIG.TERRAIN_LOOK
  const layer = () => theme.street
  return {
    get size() {
      return look.COLOR_LAYER_SIZES[layer()] ?? look.COLOR_TEXTURE_SIZE
    },
    set size(value) {
      if (!layer()) return
      look.COLOR_LAYER_SIZES[layer()] = value
      setColorLayerSizes(look)
    },
  }
}

// Os lados de quarteirão que dividem a metade do bloco de sólidos (os
// blocos vão de -metade a +metade: nenhum quarteirão fica em dois).
const quarterSizesOf = ({ SOLIDS_BLOCK_SIZE }) =>
  [8, 4, 2].map((parts) => SOLIDS_BLOCK_SIZE / parts)

// `apply` (ao soltar): `rebuildVegetation` ou `regenerate`; o controle com
// `rebuild` refaz a vegetação mesmo sem `apply`. Sem nenhum, vale na hora
// (o material lê a cada quadro).
function addControls(folder, target, controls, apply) {
  for (const [key, { label, range, rebuild }] of Object.entries(controls)) {
    const controller = folder.add(target, key, ...range).name(label)
    const onFinish = apply ?? (rebuild ? rebuildVegetation : null)
    if (onFinish) controller.onFinishChange(onFinish)
  }
}

// Nomes dos tipos de vegetação dos biomes (`kind`) no painel.
const KIND_LABELS = {
  'tall-grass': 'Grama',
  'encounter-grass': 'Mato alto',
  flower: 'Flores',
  'broadleaf-tree': 'Folhosa',
  'giant-tree': 'Gigante',
  'ancient-tree': 'Antiga',
  'pine-tree': 'Pinheiro',
  'acacia-tree': 'Acácia',
  'dead-tree': 'Morta',
  bush: 'Arbustos',
  fern: 'Samambaias',
  'leafy-plant': 'Plantas',
  rock: 'Pedras',
  pebble: 'Pedrinhas da trilha',
}

/**
 * Pasta "Modelos" de uma entrada do bioma: uma caixa por prop do Let's Go
 * que serve ao tipo dela (`lgpeChoicesOf`, pela categoria), pelo menos uma
 * marcada (docs/features/053-planicie-com-assets-do-lgpe.md). O que ainda
 * não carregou é pedido (`requestLgpeModels`) e entra quando chegar.
 * Devolve a pasta (ou `null`, sem opções).
 */
function addModelChoices(folder, title, entry, manifest, apply) {
  const choices = lgpeChoicesOf(manifest, entry.kind)
  if (Object.keys(choices).length === 0) return null
  const modelFolder = folder.addFolder(title)
  const chosen = Object.fromEntries(
    Object.keys(choices).map((id) => [id, (entry.models ?? []).includes(id)]),
  )
  for (const [id, label] of Object.entries(choices)) {
    modelFolder
      .add(chosen, id)
      .name(label)
      .onChange(() => {
        const ids = Object.keys(chosen).filter((key) => chosen[key])
        if (ids.length === 0) {
          chosen[id] = true
          modelFolder.controllersRecursive().forEach((c) => c.updateDisplay())
          return
        }
        requestLgpeModels(ids)
        entry.models = ids
        apply()
      })
  }
  modelFolder.close()
  return modelFolder
}

// Tinta de uma entrada do bioma (`tint: { color, amount }`, view/vegetation/
// biomeColor.js): a cor e quanto o tom puxa para ela (0 tira o campo).
// Refaz a vegetação ao soltar. Devolve a pasta.
function addTint(folder, entry, title) {
  const tint = { color: '#d8b860', amount: 0, ...entry.tint }
  const sync = () => {
    if (tint.amount > 0) entry.tint = { color: tint.color, amount: tint.amount }
    else delete entry.tint
  }
  const tintFolder = folder.addFolder(title)
  tintFolder
    .addColor(tint, 'color')
    .name('Cor')
    .onChange(sync)
    .onFinishChange(rebuildVegetation)
  tintFolder
    .add(tint, 'amount', 0, 1, 0.01)
    .name('Quanto puxa')
    .onChange(sync)
    .onFinishChange(rebuildVegetation)
  tintFolder.close()
  return tintFolder
}

/**
 * Subpasta "No bioma": escolhe um bioma (dos que têm algum dos `kinds`) e
 * mostra a densidade, a tinta (`addTint`) e os modelos do Let's Go
 * (`addModelChoices`) de cada entrada desses tipos no `vegetation` dele.
 * `apply` ao soltar.
 */
function addBiomeDensities(folder, kinds, apply, manifest) {
  const biomes = listBiomes().filter(({ vegetation }) =>
    vegetation.some(({ kind }) => kinds.includes(kind)),
  )
  if (biomes.length === 0) return
  const biomeFolder = folder.addFolder('No bioma')
  const choice = { biome: biomes[0].id }
  let controllers = []
  const show = () => {
    for (const controller of controllers) controller.destroy()
    const biome = biomes.find(({ id }) => id === choice.biome)
    controllers = biome.vegetation
      .filter(({ kind }) => kinds.includes(kind))
      .flatMap((entry) => {
        const label = KIND_LABELS[entry.kind] ?? entry.kind
        return [
          biomeFolder
            .add(entry, 'density', 0, 2, 0.01)
            .name(label)
            .onFinishChange(apply),
          addTint(biomeFolder, entry, `Tinta: ${label}`),
          addModelChoices(
            biomeFolder,
            `Modelos: ${label}`,
            entry,
            manifest,
            apply,
          ),
        ].filter(Boolean)
      })
  }
  biomeFolder
    .add(
      choice,
      'biome',
      Object.fromEntries(biomes.map(({ id, name }) => [name, id])),
    )
    .name('Bioma')
    .onChange(show)
  show()
}

/** Subpasta de uma espécie de árvore (`TREES`, `PINES`...). */
function addTreeSpecies(folder, title, config) {
  const species = folder.addFolder(title)
  addControls(species, config, SOLID_CONTROLS, regenerate)
  addControls(species, config.SCALE, scaleControls([0.2, 3, 0.01]), regenerate)
}

// As partes do "Mostrar" (`setVegetationVisible`) — cada uma tem a pasta
// dos números dela.
const PARTS = [
  ['grass', 'Grama'],
  ['flowers', 'Flores'],
  ['trees', 'Árvores'],
  ['undergrowth', 'Arbustos, samambaias e plantas'],
  ['rocks', 'Pedras'],
  ['buildings', 'Cidade'],
]
const TREE_KINDS = [
  'broadleaf-tree',
  'giant-tree',
  'ancient-tree',
  'pine-tree',
  'acacia-tree',
  'dead-tree',
]
const UNDERGROWTH_KINDS = ['bush', 'fern', 'leafy-plant']

const grassEntryOf = (biome) =>
  biome.vegetation.find(({ kind }) => kind === GRASS_KIND)

function copyValues() {
  const { GRASS, FLOWERS, TREES, WIND, VEGETATION_QUALITY, RENDER } =
    GAME_CONFIG
  const { CLEARINGS, ROCKS, BUSHES, FERNS } = GAME_CONFIG
  const { ANCIENT_TREES, PINES, ACACIAS, DEAD_TREES, LEAFY_PLANTS } =
    GAME_CONFIG
  const { GIANT_TREES, VEGETATION_PATCHES } = GAME_CONFIG
  const vegetationByBiome = Object.fromEntries(
    listBiomes().map(({ id, vegetation }) => [id, vegetation]),
  )
  const text = [
    `GRASS: ${JSON.stringify(GRASS, null, 2)},`,
    `FLOWERS: ${JSON.stringify(FLOWERS, null, 2)},`,
    `TREES: ${JSON.stringify(TREES, null, 2)},`,
    `WIND: ${JSON.stringify(WIND, null, 2)},`,
    `VEGETATION_QUALITY: ${JSON.stringify(VEGETATION_QUALITY, null, 2)},`,
    `LGPE: ${JSON.stringify(GAME_CONFIG.LGPE, null, 2)},`,
    `ENCOUNTER_GRASS: ${JSON.stringify(GAME_CONFIG.ENCOUNTER_GRASS, null, 2)},`,
    `GRASS_PUSH: ${JSON.stringify(GAME_CONFIG.GRASS_PUSH, null, 2)},`,
    `CITIES: ${JSON.stringify(GAME_CONFIG.CITIES, null, 2)},`,
    `ROADS: ${JSON.stringify(GAME_CONFIG.ROADS, null, 2)},`,
    `BACKDROP: ${JSON.stringify(GAME_CONFIG.BACKDROP, null, 2)},`,
    ...Object.entries({
      GIANT_TREES,
      ANCIENT_TREES,
      PINES,
      ACACIAS,
      DEAD_TREES,
      CLEARINGS,
      VEGETATION_PATCHES,
      ROCKS,
      BUSHES,
      FERNS,
      LEAFY_PLANTS,
    }).map(([name, value]) => `${name}: ${JSON.stringify(value, null, 2)},`),
    `RENDER.MAX_FPS: ${RENDER.MAX_FPS},`,
    `// vegetation por bioma (core/data/biomes/<id>/): ${JSON.stringify(vegetationByBiome, null, 2)}`,
  ].join('\n')
  navigator.clipboard?.writeText(text)
}

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): painel "Vegetação"
 * (docs/features/049-vegetacao-e-floresta.md) — FPS e Stats, qualidade,
 * ligar e desligar cada parte ("Mostrar") e uma pasta com os números de
 * cada parte: grama (e, por bioma, cor, densidade e conjuntos), flores,
 * árvores e sub-bosque por espécie e pedras, cada uma com a densidade, a
 * tinta e os modelos do Let's Go no bioma; mais o toon do Let's Go (com o
 * mato alto) e o vento. Mexe no
 * `GAME_CONFIG` e nos biomas ao vivo (só nesta sessão); "Copiar valores"
 * leva os números para o código. O que o core sorteia (árvores e pedras)
 * refaz o terreno ao soltar.
 */
export function VegetationPanel() {
  // O manifesto do Let's Go (as opções de "Modelos"); o painel monta quando
  // chega.
  const [manifest, setManifest] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch(LGPE_MANIFEST_PATH)
      .then((response) => response.json())
      .then((loaded) => {
        if (!cancelled) {
          setManifest(withProceduralProps(mergeLgpeManifests(loaded)))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!manifest) return undefined
    const {
      GRASS,
      FLOWERS,
      TREES,
      WIND,
      VEGETATION_QUALITY,
      RENDER,
      BUSHES,
      FERNS,
      ROCKS,
      ANCIENT_TREES,
      PINES,
      ACACIAS,
      DEAD_TREES,
      LEAFY_PLANTS,
    } = GAME_CONFIG
    const gui = new GUI({ title: 'Vegetação' })
    gui.domElement.style.right = PANEL_RIGHT
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)

    const render = gui.addFolder('Render (cena inteira)')
    // Lido a cada quadro pelo FrameLimiter — vale na hora.
    render
      .add(RENDER, 'MAX_FPS', {
        'Sem limite (tela)': 0,
        30: 30,
        40: 40,
        45: 45,
        60: 60,
      })
      .name('FPS máximo')
    // Fica na tela mesmo com o F2 fechado (statsOverlay.js).
    render
      .add({ stats: isStatsVisible() }, 'stats')
      .name('Stats (fica fora do F2)')
      .onChange(setStatsVisible)

    gui
      .add(VEGETATION_QUALITY, 'CURRENT', { alta: 'high', baixa: 'low' })
      .name('Qualidade')
      .onChange(() => {
        rebuildVegetation()
        notifyRenderSettingsChanged()
      })

    const visible = { ...getVegetationSettings() }
    const show = gui.addFolder('Mostrar')
    for (const [part, label] of PARTS) {
      show
        .add(visible, part)
        .name(label)
        .onChange((isVisible) => setVegetationVisible(part, isVisible))
    }

    // Uma pasta por item do "Mostrar", com os números dele.
    const folderOf = Object.fromEntries(
      PARTS.map(([part, label]) => [part, gui.addFolder(label)]),
    )

    // Grama: o tufo (`GRASS`) e, por bioma, a densidade, as cores e os
    // conjuntos (um bioma por vez).
    const grassFolder = folderOf.grass
    addControls(grassFolder, GRASS, GRASS_CONTROLS, rebuildVegetation)
    addControls(
      grassFolder,
      GRASS.SCALE,
      scaleControls([0.2, 3, 0.01]),
      rebuildVegetation,
    )
    const biomesWithGrass = listBiomes().filter(grassEntryOf)
    // Plantas abrindo para quem passa (grassPush.js; grama e o resto das
    // plantas, árvores não) — vale na hora.
    const pushFolder = grassFolder.addFolder('Abrir ao passar')
    pushFolder.add(GAME_CONFIG.GRASS_PUSH, 'ENABLED').name('Ligado')
    addControls(pushFolder, GAME_CONFIG.GRASS_PUSH, PUSH_CONTROLS)
    const grassBiomeFolder = grassFolder.addFolder('No bioma')
    // Modelo de conjuntos para "Usar conjuntos" (o primeiro bioma que tem).
    const clusterTemplate = biomesWithGrass
      .map(grassEntryOf)
      .find((entry) => entry.clusters)?.clusters
    const grassChoice = {
      biome: (
        biomesWithGrass.find((biome) => grassEntryOf(biome).clusters) ??
        biomesWithGrass[0]
      )?.id,
      clusters: false,
    }
    let grassControllers = []
    const showGrassBiome = () => {
      for (const controller of grassControllers) controller.destroy()
      const entry = grassEntryOf(
        biomesWithGrass.find(({ id }) => id === grassChoice.biome),
      )
      grassChoice.clusters = Boolean(entry.clusters)
      grassControllers = [
        grassBiomeFolder
          .add(entry, 'density', 0, 1, 0.01)
          .name('Densidade')
          .onFinishChange(rebuildVegetation),
        ...Object.entries(COLOR_LABELS).map(([key, label]) =>
          grassBiomeFolder
            .addColor(entry.colors, key)
            .name(label)
            .onFinishChange(rebuildVegetation),
        ),
        addTint(grassBiomeFolder, entry, 'Tinta'),
        grassBiomeFolder
          .add(grassChoice, 'clusters')
          .name('Usar conjuntos')
          .onChange((enabled) => {
            if (enabled) entry.clusters = { ...clusterTemplate }
            else delete entry.clusters
            rebuildVegetation()
            showGrassBiome()
          }),
      ]
      // Modelos do Let's Go da grama no bioma (pelo menos um).
      grassControllers.push(
        addModelChoices(
          grassBiomeFolder,
          'Modelos',
          entry,
          manifest,
          rebuildVegetation,
        ),
      )
      if (!entry.clusters) return
      for (const [title, controls] of [
        ['Conjunto', CLUSTER_CONTROLS],
        ['Mapa dos conjuntos', CLUSTER_MAP_CONTROLS],
      ]) {
        const folder = grassBiomeFolder.addFolder(title)
        grassControllers.push(folder)
        addControls(folder, entry.clusters, controls, rebuildVegetation)
      }
    }
    if (biomesWithGrass.length > 0) {
      grassBiomeFolder
        .add(
          grassChoice,
          'biome',
          Object.fromEntries(biomesWithGrass.map(({ id, name }) => [name, id])),
        )
        .name('Bioma')
        .onChange(showGrassBiome)
      showGrassBiome()
    }

    const flowerFolder = folderOf.flowers
    addControls(
      flowerFolder,
      FLOWERS,
      {
        CLUMPS_PER_M2: { label: 'Moitas por m²', range: [0, 1, 0.01] },
      },
      rebuildVegetation,
    )
    addBiomeDensities(flowerFolder, ['flower'], rebuildVegetation, manifest)

    // Árvores: o tom de uma para outra e uma subpasta por espécie; onde
    // nascem vem do terreno (refaz ao soltar).
    const treeFolder = folderOf.trees
    treeFolder
      .add(TREES, 'TINT_VARIATION', 0, 0.5, 0.01)
      .name('Variação do tom')
      .onFinishChange(rebuildVegetation)
    addTreeSpecies(treeFolder, 'Folhosa', TREES)
    addTreeSpecies(treeFolder, 'Gigante', GAME_CONFIG.GIANT_TREES)
    addTreeSpecies(treeFolder, 'Antiga', ANCIENT_TREES)
    addTreeSpecies(treeFolder, 'Pinheiro', PINES)
    addTreeSpecies(treeFolder, 'Acácia', ACACIAS)
    addTreeSpecies(treeFolder, 'Morta', DEAD_TREES)
    addBiomeDensities(treeFolder, TREE_KINDS, regenerate, manifest)

    // Sub-bosque: uma subpasta por planta (refaz ao soltar). Os arbustos
    // saem do core com o chunk (o F vasculha, 055): refazem com o terreno.
    const undergrowthFolder = folderOf.undergrowth
    for (const [title, config, maxPerM2, onChange] of [
      ['Arbustos', BUSHES, 0.2, regenerate],
      ['Samambaias', FERNS, 0.4, rebuildVegetation],
      ['Plantas', LEAFY_PLANTS, 0.3, rebuildVegetation],
    ]) {
      const folder = undergrowthFolder.addFolder(title)
      addControls(folder, config, perM2Controls(maxPerM2), onChange)
    }
    addBiomeDensities(
      undergrowthFolder,
      UNDERGROWTH_KINDS,
      rebuildVegetation,
      manifest,
    )

    // Pedras: onde nascem vem do terreno (refaz ao soltar).
    const rockFolder = folderOf.rocks
    addControls(rockFolder, ROCKS, SOLID_CONTROLS, regenerate)
    addControls(
      rockFolder,
      ROCKS.SCALE,
      scaleControls([0.1, 3, 0.01]),
      regenerate,
    )
    addBiomeDensities(rockFolder, ['rock', 'pebble'], regenerate, manifest)

    // Cidade (docs/features/056-bioma-cidade.md): a planta e onde ficam as
    // cidades (058) vêm do terreno (refaz ao soltar).
    const cityFolder = folderOf.buildings
    const cityTown = listBiomes().find(({ town }) => town)?.town
    if (cityTown) addTravelControls(cityFolder, cityTown)
    if (cityTown) addPalletControls(cityFolder)
    if (cityTown && GAME_CONFIG.CITIES.FIRST_TOWN.LAYOUT) {
      addViridianControls(cityFolder, cityTown)
    }
    addControls(cityFolder, GAME_CONFIG.CITIES, CITIES_CONTROLS, regenerate)
    addControls(
      cityFolder.addFolder('Estradas'),
      GAME_CONFIG.ROADS,
      ROADS_CONTROLS,
      regenerate,
    )
    for (const biome of listBiomes().filter(({ town }) => town)) {
      const folder = cityFolder.addFolder(biome.name)
      addControls(folder, biome.town, TOWN_CONTROLS, regenerate)
      folder
        .add(biome.town, 'blockSize', quarterSizesOf(GAME_CONFIG.TERRAIN))
        .name('Quarteirão (m)')
        .onFinishChange(regenerate)
      // Os detalhes e a praça (069).
      if (biome.town.details) {
        addControls(
          folder.addFolder('Detalhes'),
          biome.town.details,
          TOWN_DETAIL_CONTROLS,
          regenerate,
        )
      }
      if (biome.town.plaza) {
        const plazaFolder = folder.addFolder('Praça')
        addControls(plazaFolder, biome.town.plaza, PLAZA_CONTROLS, regenerate)
        if (biome.town.plaza.water) {
          addControls(
            plazaFolder.addFolder('Água da fonte'),
            biome.town.plaza.water,
            FOUNTAIN_WATER_CONTROLS,
            regenerate,
          )
        }
      }
      // O campo de treino (067): a grade de bonecos e o balanço deles.
      if (biome.town.trainingField) {
        const fieldFolder = folder.addFolder('Campo de treino')
        addControls(
          fieldFolder,
          biome.town.trainingField,
          TRAINING_FIELD_CONTROLS,
          regenerate,
        )
        addControls(
          fieldFolder.addFolder('Balanço do boneco'),
          GAME_CONFIG.FEEDBACK.TRAINING_DUMMY_WOBBLE,
          DUMMY_WOBBLE_CONTROLS,
        )
      }
      // Um tema por pasta: o peso no sorteio e a rua (a textura refaz o
      // terreno; o tamanho dela vale na hora).
      for (const theme of biome.town.themes) {
        const themeFolder = folder.addFolder(`Tema: ${theme.name}`)
        themeFolder
          .add(theme, 'weight', 0, 5, 0.1)
          .name('Peso no sorteio')
          .onFinishChange(regenerate)
        themeFolder
          .add(theme, 'street', STREET_LAYER_OPTIONS)
          .name('Rua')
          .onFinishChange(regenerate)
        themeFolder
          .add(streetTextureSizeOf(theme), 'size', 0.5, 12, 0.1)
          .name('Textura da rua (m)')
        // A cor do ginásio: refaz só as malhas.
        if (theme.gymColor) {
          themeFolder
            .addColor(theme, 'gymColor')
            .name('Cor do ginásio')
            .onFinishChange(rebuildVegetation)
        }
      }
      // A força da cor do tema no ginásio (todos os temas).
      for (const landmark of biome.town.landmarks) {
        if (!landmark.paint) continue
        folder
          .add(landmark.paint, 'amount', 0, 1, 0.01)
          .name('Força da cor do ginásio')
          .onFinishChange(rebuildVegetation)
      }
    }

    // Modelos do Let's Go (docs/features/052-*.md): o material toon muda
    // na hora; o mato alto refaz ao soltar.
    const { LGPE, ENCOUNTER_GRASS } = GAME_CONFIG
    const lgpeFolder = gui.addFolder("Let's Go (toon)")
    lgpeFolder.add(LGPE, 'RAMP_THRESHOLD', 0, 1, 0.01).name('Degrau da luz')
    lgpeFolder.add(LGPE, 'RAMP_SOFTNESS', 0, 0.5, 0.005).name('Degrau suave')
    lgpeFolder.addColor(LGPE, 'SHADOW_TINT').name('Cor da sombra')
    lgpeFolder.add(LGPE, 'RIM_STRENGTH', 0, 2, 0.01).name('Luz de borda')
    lgpeFolder.add(LGPE, 'VERTEX_COLOR', 0, 1, 0.01).name('Sombreado pintado')
    lgpeFolder.add(LGPE, 'CUTOFF', 0.2, 1.5, 0.01).name('Corte das folhas')
    lgpeFolder.addColor(LGPE.LAMP_GLOW, 'COLOR').name('Luz dos postes (cor)')
    lgpeFolder
      .add(LGPE.LAMP_GLOW, 'STRENGTH', 0, 4, 0.05)
      .name('Luz dos postes (força)')
    lgpeFolder
      .addColor(LGPE.LAMP_LIGHT, 'COLOR')
      .name('Luz no chão dos postes (cor)')
    lgpeFolder
      .add(LGPE.LAMP_LIGHT, 'INTENSITY', 0, 60, 0.5)
      .name('Luz no chão dos postes (força)')
    lgpeFolder
      .add(LGPE.LAMP_LIGHT, 'DISTANCE', 1, 30, 0.5)
      .name('Luz no chão dos postes (alcance)')
    lgpeFolder
      .add(LGPE.LAMP_LIGHT, 'DECAY', 0, 3, 0.05)
      .name('Luz no chão dos postes (queda)')
    lgpeFolder
      .add(ENCOUNTER_GRASS, 'PER_M2', 0, 3, 0.05)
      .name('Mato alto por m²')
      .onFinishChange(rebuildVegetation)
    lgpeFolder
      .add(ENCOUNTER_GRASS, 'MIN_CLUSTER_HEIGHT', 0, 1.5, 0.01)
      .name('Mato alto: só no miolo')
      .onFinishChange(rebuildVegetation)
    addBiomeDensities(
      lgpeFolder,
      ['encounter-grass'],
      rebuildVegetation,
      manifest,
    )

    const windFolder = gui.addFolder('Vento')
    for (const type of WEATHER_TYPES) {
      windFolder
        .add(WIND.STRENGTH, type, 0, 1.5, 0.01)
        .name(`Força (${WEATHER_LABELS[type]})`)
    }
    addControls(windFolder, WIND, WIND_CONTROLS)

    // Serras do fundo (docs/features/058-ajuste-dos-biomas.md): a cor vale
    // na hora; a forma, ao recarregar a página.
    const backdropFolder = gui.addFolder('Serras do fundo')
    GAME_CONFIG.BACKDROP.LAYERS.forEach((layer, index) => {
      const folder = backdropFolder.addFolder(`Camada ${index + 1}`)
      addControls(folder, layer, BACKDROP_LAYER_CONTROLS)
      folder.addColor(layer, 'tint').name('Tom')
    })

    gui.add({ copiar: copyValues }, 'copiar').name('Copiar valores')
    for (const folder of gui.foldersRecursive()) folder.close()

    return () => gui.destroy()
  }, [manifest])

  return null
}
