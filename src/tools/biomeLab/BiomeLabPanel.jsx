'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import {
  ASPECT_LEVELS,
  SHADOW_LEVELS,
  definirHorario,
  definirProporcao,
  definirDistanciaDeVisao,
  definirTamanhoDaTela,
  definirSombra,
  forcarClima,
} from '@/core/actions'
import { regenerarTerreno } from '@/core/actions/terrain'
import { getBiome, listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { hourOf } from '@/core/time/dayCycle'
import {
  GraphicsSettings,
  LocalWeather,
  Position,
  WorldClock,
} from '@/core/traits'
import { WEATHER_TYPES } from '@/core/weather/weatherMap'
import { cameraEntity, playerEntity, world } from '@/core/world/world'
import { notifyRenderSettingsChanged } from '@/view/scene/renderSettings'
import {
  BLADE_GRASS_ID,
  refazerGramaEmFios,
} from '@/view/vegetation/bladeGrass'
import { requestLgpeModels } from '@/view/vegetation/lgpeChoices'
import { rebuildVegetation } from '@/view/vegetation/vegetationSettings'
import { WEATHER_LABELS } from '@/tools/debug/dayWeatherLabels'
import { TERRAIN_COLOR_LAYERS } from '@/view/terrain/terrainLayers'
import { labState } from './labState'
import { changedValues, formatChangedValues } from './labValues'
import { TEST_LEVEL } from '@/core/data/testLevel'
import {
  LAB_CAMERAS,
  aplicarCameraDoLab,
  moverTreinadorPara,
  olharDoLabPara,
} from './labWorld'

const HOURS = 24
const AUTOMATIC = 'auto'
const WEATHER_OPTIONS = {
  automático: AUTOMATIC,
  ...Object.fromEntries(WEATHER_TYPES.map((t) => [WEATHER_LABELS[t], t])),
}

// [mín, máx, passo] e nome de cada controle.
const LIGHT_CONTROLS = [
  [GAME_CONFIG.DAY_CYCLE.ADJUST, 'SUN', 'Força do sol (×)', [0, 3, 0.01]],
  [GAME_CONFIG.DAY_CYCLE.ADJUST, 'AMBIENT', 'Luz ambiente (×)', [0, 3, 0.01]],
  [
    GAME_CONFIG.DAY_CYCLE.ADJUST,
    'SHADOW',
    'Escuro da sombra (×)',
    [0, 3, 0.01],
  ],
  [GAME_CONFIG.LGPE, 'RAMP_THRESHOLD', 'Degrau da luz (toon)', [0, 1, 0.01]],
  [GAME_CONFIG.LGPE, 'RAMP_SOFTNESS', 'Suavidade do degrau', [0, 1, 0.01]],
  [GAME_CONFIG.LGPE, 'RIM_STRENGTH', 'Luz de borda', [0, 1, 0.01]],
  [GAME_CONFIG.LGPE, 'VERTEX_COLOR', 'Sombreado pintado', [0, 1, 0.01]],
  [GAME_CONFIG.LGPE, 'BASE_SHADE', 'Base das plantas escura', [0, 1, 0.01]],
  [GAME_CONFIG.LGPE, 'BASE_SHADE_HEIGHT', 'Altura do escuro', [0.05, 1, 0.01]],
]
const GRADE_CONTROLS = [
  ['SATURATION', 'Saturação', [0, 2, 0.01]],
  ['CONTRAST', 'Contraste', [0.5, 1.5, 0.01]],
  ['EXPOSURE', 'Exposição', [-2, 2, 0.01]],
  ['GAMMA', 'Gama (meios-tons)', [0.5, 2, 0.01]],
  ['TEMPERATURE', 'Temperatura (frio ↔ quente)', [-1, 1, 0.01]],
]
const TONE_MAPPINGS = { ACES: 'aces', Neutral: 'neutral' }
// A forma do tufo da grama em fios (`GRASS_BLADES`): refaz o tufo ao soltar.
const BLADE_CONTROLS = [
  ['COUNT', 'Lâminas por tufo', [4, 80, 1]],
  ['RADIUS', 'Largura do tufo (m)', [0.05, 1, 0.01]],
  ['HEIGHT', 'Altura da lâmina (m)', [0.1, 1.5, 0.01]],
  ['HEIGHT_VARIATION', 'Variação da altura', [0, 0.9, 0.01]],
  ['WIDTH', 'Largura da lâmina (m)', [0.005, 0.12, 0.001]],
  ['SEGMENTS', 'Partes da lâmina (curva)', [1, 8, 1]],
  ['ROOT_SHADE', 'Tom da raiz', [0, 1.5, 0.01]],
  ['TIP_SHADE', 'Tom da ponta', [0, 2, 0.01]],
]
// Até onde a grama em fios vai (m da câmera), ao vivo.
const FADE_CONTROLS = [
  ['FADE_START', 'Começa a sumir em (m)', [5, 120, 1]],
  ['FADE_END', 'Some de vez em (m)', [5, 150, 1]],
  ['GROUND_COVER', 'Chão da mancha na cor da grama', [0, 1, 0.01]],
  ['GROUND_SHADE', 'Tom da grama no chão (e ao sumir)', [0.2, 1.6, 0.01]],
]
// A grama no mundo (`GRASS`): refaz a vegetação ao soltar.
const GRASS_CONTROLS = [
  ['CLUMPS_PER_M2', 'Tufos por m²', [0, 12, 0.05]],
  ['HEIGHT', 'Altura no mundo (×)', [0.2, 4, 0.05]],
]
// O tapete entre as manchas (`clusters` da grama do bioma): refaz o mundo.
const CARPET_CONTROLS = [
  ['background', 'Grama entre as manchas', [0, 1, 0.01]],
  ['backgroundHeight', 'Altura entre as manchas', [0, 1.5, 0.01]],
  ['coverage', 'Cobertura das manchas', [0, 1, 0.01]],
]

// "Tapete do Scarlet/Violet": a grama em fios cobrindo o chão, sem o mato
// alto do Let's Go, com o chão verde-escuro por baixo e a base das plantas
// escura (o primeiro acerto com as referências do usuário, 066).
const SV_CARPET = { background: 0.7, backgroundHeight: 0.6, coverage: 0.5 }
// Grama alta em manchas no meio da baixa, e mais claro e escuro.
const SV_GRASS = {
  CLUMPS_PER_M2: 6,
  HEIGHT_VARIATION: 0.6,
  MACRO_VARIATION: 0.35,
}
const SV_GROUND = { TINT: '#3f6e30', TINT_AMOUNT: 0.75, BRIGHTNESS: 0.7 }
const SV_PLANTS = { BASE_SHADE: 0.45 }

// A luz do chão (066, desempenho do terreno).
const GROUND_LIGHTING = {
  'Lambert (padrão, mais leve)': 'lambert',
  'Standard (com brilho)': 'standard',
}

// "Árvores dos pacotes": bosques com campo aberto entre eles (066, a
// segunda volta com o usuário — menos coisa na tela, mais variedade), dos
// pacotes Ultimate Stylized Nature (`usn`) e MegaKit (`megakit`) convertidos
// por `scripts/lab/pack-natureza.sh`. Cada tipo de árvore é um jeito de
// bosque, com as próprias manchas: folhosas (NormalTree) e bordos (MapleTree,
// na entrada dos pinheiros); as grandes ficam soltas no campo, raras. Pouca
// pedra, arbustos em manchas e sem o sub-bosque do Let's Go. Por tipo: o que
// muda na entrada do bioma; os modelos que não estiverem carregados ficam
// de fora.
const PACK_TREES = {
  'broadleaf-tree': {
    models: [
      'usn-normaltree-1',
      'usn-normaltree-2',
      'usn-normaltree-3',
      'usn-normaltree-4',
      'usn-normaltree-5',
    ],
    density: 0.9,
    place: undefined,
    patches: { amount: 0.3, size: 55 },
    scale: 1,
  },
  'pine-tree': {
    models: [
      'usn-mapletree-1',
      'usn-mapletree-2',
      'usn-mapletree-4',
      'usn-mapletree-5',
    ],
    density: 0.8,
    place: undefined,
    patches: { amount: 0.2, size: 45 },
    scale: 1,
  },
  'ancient-tree': {
    models: [
      'megakit-commontree-1',
      'megakit-commontree-2',
      'megakit-commontree-5',
      'megakit-twistedtree-1',
      'megakit-twistedtree-3',
    ],
    density: 0.25,
    place: undefined,
    scale: 1.2,
  },
  'dead-tree': { density: 0 },
  bush: {
    models: ['megakit-bush-common', 'usn-bush', 'usn-bush-large'],
    density: 0.35,
    patches: { amount: 0.25, size: 20 },
  },
  fern: { density: 0 },
  'leafy-plant': { density: 0 },
  flower: { density: 0.25 },
  rock: {
    models: [
      'megakit-rock-medium-1',
      'megakit-rock-medium-2',
      'megakit-rock-medium-3',
    ],
    density: 0.25,
    scale: 1,
  },
}

// O relevo do bioma do ponto (`relief`): refaz o mundo ao soltar.
const RELIEF_CONTROLS = [
  ['baseHeight', 'Chão médio (m acima da água)', [-5, 30, 0.5]],
  ['hillHeight', 'Altura dos morros (m)', [0, 40, 0.5]],
  ['hillSize', 'Largura dos morros (m)', [30, 600, 5]],
  ['flatness', 'Achatar o meio', [0.3, 3, 0.05]],
  ['roughness', 'Detalhe miúdo', [0, 0.8, 0.01]],
]
// Os platôs (`relief.terraces`, core/terrain/terraces.js).
const TERRACE_CONTROLS = [
  ['step', 'Altura do degrau (m)', [1, 15, 0.25]],
  ['cliff', 'Barranco (0 = sem degrau)', [0, 1, 0.01]],
  ['tilt', 'Declive no topo', [0, 1, 0.01]],
  ['ramps', 'Rampas (parte do chão)', [0, 1, 0.01]],
  ['rampSize', 'Tamanho da rampa (m)', [5, 200, 1]],
]
// "Platôs": morros mais altos e largos, sem pico, em patamares com
// barranco de penhasco e rampas (066, a primeira volta do relevo).
const PLATEAU_RELIEF = {
  baseHeight: 8,
  hillHeight: 10,
  hillSize: 160,
  flatness: 1.2,
}
const PLATEAU_TERRACES = {
  step: 3.5,
  cliff: 0.95,
  tilt: 0.1,
  ramps: 0.3,
  rampSize: 40,
}
const PLATEAU_SLOPE_COLOR = 'lgpe-cliff'
// As montanhas com caminho até o topo (`relief.mountains`,
// core/terrain/mountains.js).
const MOUNTAIN_CONTROLS = [
  ['spacing', 'Distância entre montanhas (m)', [150, 2000, 10]],
  ['chance', 'Chance de ter montanha', [0, 1, 0.01]],
  ['radius', 'Raio da base (m)', [30, 300, 1]],
  ['height', 'Altura (m)', [5, 80, 0.5]],
  ['sizeJitter', 'Variação de tamanho', [0, 0.6, 0.01]],
  ['wobble', 'Base fora do círculo', [0, 0.5, 0.01]],
  ['step', 'Altura do patamar (m)', [1.5, 12, 0.25]],
  ['cliff', 'Barranco (0 = sem degrau)', [0, 1, 0.01]],
  ['tilt', 'Declive no patamar', [0, 1, 0.01]],
  ['pathWidth', 'Largura do caminho (m)', [2, 12, 0.5]],
  ['turn', 'Volta entre rampas (fração)', [0.05, 0.9, 0.01]],
]
// "Montanhas": algumas por região, bem maiores que os platôs, no mesmo
// jeito de patamar e barranco, com o caminho dando a volta até o topo
// (066, a primeira volta das montanhas).
const MOUNTAIN_PRESET = {
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
}
const COLOR_LAYER_OPTIONS = TERRAIN_COLOR_LAYERS.map(([name]) => name)

/** A entrada de um tipo no bioma do ponto atual (ou `null`). */
const entryHere = (kind) =>
  getBiome(labState.point)?.vegetation.find((entry) => entry.kind === kind) ??
  null

// Refaz o mundo (core: conjuntos de grama, sólidos) e a vegetação.
const refazerMundo = () => {
  regenerarTerreno(world)
  rebuildVegetation()
}

/**
 * Painel do laboratório de biomas (docs/features/066-revisao-dos-
 * biomas.md): o ponto (um por bioma), hora, clima e selvagens; câmeras
 * prontas, volta em torno e "Capturar"; luz e sombra; cor e atmosfera; os
 * pacotes de fora carregados; e "Copiar valores" de tudo que mudou desde
 * que o lab abriu (`snapshot`), daqui e dos painéis do F2.
 *
 * @param {object} props
 * @param {HTMLElement} props.container - a coluna do painel
 * @param {Record<string, { x: number, z: number } | null>} props.points
 * @param {{ config: object, biomes: object }} props.snapshot
 * @param {{ id: string, count: number, ids: string[] }[]} props.packs
 * @param {() => void} props.onCapture
 */
export function BiomeLabPanel({
  container,
  points,
  snapshot,
  packs,
  onCapture,
}) {
  useEffect(() => {
    const gui = new GUI({ title: 'Laboratório de biomas', container })
    gui.domElement.style.width = '100%'
    // Digitar nos campos não pode virar comando do jogo.
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)

    // Cena -----------------------------------------------------------------
    const pointOptions = Object.fromEntries(
      Object.entries(points)
        .filter(([, point]) => point)
        .map(([id]) => [getBiome(id)?.name ?? id, id]),
    )
    const scene = {
      get point() {
        return labState.point
      },
      set point(id) {
        labState.point = id
        if (points[id]) moverTreinadorPara(playerEntity, points[id])
      },
      get hour() {
        return hourOf(world.get(WorldClock).time)
      },
      set hour(hour) {
        const { time } = world.get(WorldClock)
        definirHorario(world, Math.floor(time) + hour / HOURS)
      },
      get weather() {
        return world.get(LocalWeather).forced ?? AUTOMATIC
      },
      set weather(type) {
        forcarClima(world, type === AUTOMATIC ? null : type)
      },
      get wild() {
        return GAME_CONFIG.WILD_SPAWN.ENABLED
      },
      set wild(enabled) {
        GAME_CONFIG.WILD_SPAWN.ENABLED = enabled
      },
    }
    const sceneFolder = gui.addFolder('Cena')
    sceneFolder.add(scene, 'point', pointOptions).name('Ponto').listen()
    sceneFolder
      .add(scene, 'hour', 0, HOURS - 0.01, 0.05)
      .name('Hora')
      .listen()
    sceneFolder.add(scene, 'weather', WEATHER_OPTIONS).name('Clima').listen()
    sceneFolder.add(scene, 'wild').name('Selvagens nascem')

    // Câmera ----------------------------------------------------------------
    const cameraFolder = gui.addFolder('Câmera')
    for (const [id, { label }] of Object.entries(LAB_CAMERAS)) {
      cameraFolder
        .add({ go: () => aplicarCameraDoLab(cameraEntity, id) }, 'go')
        .name(label)
    }
    cameraFolder.add(labState, 'orbit').name('Volta em torno').listen()
    cameraFolder
      .add(labState, 'orbitSpeed', 0.02, 1, 0.01)
      .name('Velocidade da volta (rad/s)')
    cameraFolder.add({ capture: onCapture }, 'capture').name('Capturar (PNG)')

    // Luz e sombra ----------------------------------------------------------
    const lightFolder = gui.addFolder('Luz e sombra')
    for (const [target, key, label, range] of LIGHT_CONTROLS) {
      lightFolder.add(target, key, ...range).name(label)
    }
    lightFolder
      .addColor(GAME_CONFIG.LGPE, 'SHADOW_TINT')
      .name('Cor da sombra (toon)')
    // O nível da sombra do menu "Gráficos" (066, desempenho).
    const shadowLevel = {
      get value() {
        return playerEntity.get(GraphicsSettings)?.shadow
      },
      set value(level) {
        definirSombra(playerEntity, level)
      },
    }
    lightFolder
      .add(shadowLevel, 'value', SHADOW_LEVELS)
      .name('Nível da sombra (menu)')
      .listen()
    const aspect = {
      get value() {
        return playerEntity.get(GraphicsSettings)?.aspect
      },
      set value(level) {
        definirProporcao(playerEntity, level)
      },
    }
    lightFolder
      .add(aspect, 'value', ASPECT_LEVELS)
      .name('Proporção (menu)')
      .listen()
    const canvasSize = {
      get value() {
        return playerEntity.get(GraphicsSettings)?.canvasScale
      },
      set value(scale) {
        definirTamanhoDaTela(playerEntity, scale)
      },
    }
    const { MIN, STEP } = GAME_CONFIG.GRAPHICS.CANVAS_SIZE
    lightFolder
      .add(canvasSize, 'value', MIN, 1, STEP)
      .name('Tamanho da tela (menu)')
      .listen()
    const viewDistance = {
      get value() {
        return playerEntity.get(GraphicsSettings)?.viewDistance
      },
      set value(chunks) {
        definirDistanciaDeVisao(playerEntity, chunks)
      },
    }
    const VIEW = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE
    lightFolder
      .add(viewDistance, 'value', VIEW.MIN, VIEW.MAX, 1)
      .name('Distância de visão (menu)')
      .listen()

    // Cor e atmosfera -------------------------------------------------------
    const colorFolder = gui.addFolder('Cor e atmosfera')
    for (const [key, label, range] of GRADE_CONTROLS) {
      colorFolder
        .add(GAME_CONFIG.RENDER.GRADE, key, ...range)
        .name(label)
        .onChange(notifyRenderSettingsChanged)
    }
    colorFolder
      .add(GAME_CONFIG.RENDER, 'TONE_MAPPING', TONE_MAPPINGS)
      .name('Curva de cor')
      .onChange(notifyRenderSettingsChanged)
    colorFolder
      .add(GAME_CONFIG.FOG, 'START_FRACTION', 0, 1, 0.01)
      .name('Névoa começa em (fração)')
    colorFolder.addColor(GAME_CONFIG.TERRAIN_LOOK, 'TINT').name('Tom do chão')
    colorFolder
      .add(GAME_CONFIG.TERRAIN_LOOK, 'TINT_AMOUNT', 0, 1, 0.01)
      .name('Força do tom do chão')
    colorFolder
      .add(GAME_CONFIG.TERRAIN_LOOK, 'BRIGHTNESS', 0.2, 1.5, 0.01)
      .name('Brilho do chão')

    colorFolder
      .add(GAME_CONFIG.TERRAIN_LOOK, 'LIGHTING', GROUND_LIGHTING)
      .name('Luz do chão')
      .listen()

    // Grama em fios ----------------------------------------------------------
    // Os modelos da grama de cada bioma como estavam ao abrir (para voltar).
    const originalGrass = Object.fromEntries(
      Object.entries(snapshot.biomes).map(([id, biome]) => [
        id,
        biome.vegetation.find((entry) => entry.kind === 'tall-grass')?.models,
      ]),
    )
    const bladeFolder = gui.addFolder('Grama em fios')
    bladeFolder
      .add(
        {
          use: () => {
            const grass = entryHere('tall-grass')
            if (!grass) return
            requestLgpeModels([BLADE_GRASS_ID])
            grass.models = [BLADE_GRASS_ID]
            rebuildVegetation()
          },
        },
        'use',
      )
      .name('Usar neste bioma')
    bladeFolder
      .add(
        {
          preset: () => {
            const grass = entryHere('tall-grass')
            if (!grass) return
            requestLgpeModels([BLADE_GRASS_ID])
            grass.models = [BLADE_GRASS_ID]
            Object.assign(grass.clusters ?? {}, SV_CARPET)
            const encounterEntry = entryHere('encounter-grass')
            if (encounterEntry) encounterEntry.density = 0
            Object.assign(GAME_CONFIG.GRASS, SV_GRASS)
            Object.assign(GAME_CONFIG.TERRAIN_LOOK, SV_GROUND)
            Object.assign(GAME_CONFIG.LGPE, SV_PLANTS)
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            refazerMundo()
          },
        },
        'preset',
      )
      .name('Tapete do Scarlet/Violet (tudo)')
    bladeFolder
      .add(
        {
          back: () => {
            const grass = entryHere('tall-grass')
            const original = originalGrass[labState.point]
            if (!grass || !original) return
            grass.models = [...original]
            rebuildVegetation()
          },
        },
        'back',
      )
      .name("Voltar à do Let's Go")
    const encounter = {
      get on() {
        return (entryHere('encounter-grass')?.density ?? 0) > 0
      },
      set on(value) {
        const entry = entryHere('encounter-grass')
        if (!entry) return
        entry.density = value
          ? (snapshot.biomes[labState.point]?.vegetation.find(
              (item) => item.kind === 'encounter-grass',
            )?.density ?? 1)
          : 0
        rebuildVegetation()
      },
    }
    bladeFolder.add(encounter, 'on').name("Mato alto do Let's Go").listen()
    bladeFolder.addColor(GAME_CONFIG.GRASS_BLADES, 'COLOR').name('Cor da grama')
    for (const [key, label, range] of BLADE_CONTROLS) {
      bladeFolder
        .add(GAME_CONFIG.GRASS_BLADES, key, ...range)
        .name(label)
        .onFinishChange(() => {
          refazerGramaEmFios()
          rebuildVegetation()
        })
    }
    for (const [key, label, range] of FADE_CONTROLS) {
      bladeFolder.add(GAME_CONFIG.GRASS_BLADES, key, ...range).name(label)
    }
    for (const [key, label, range] of GRASS_CONTROLS) {
      bladeFolder
        .add(GAME_CONFIG.GRASS, key, ...range)
        .name(label)
        .onFinishChange(rebuildVegetation)
    }
    const carpet = Object.fromEntries(
      CARPET_CONTROLS.map(([key]) => [
        key,
        {
          get value() {
            return entryHere('tall-grass')?.clusters?.[key] ?? 0
          },
          set value(next) {
            const clusters = entryHere('tall-grass')?.clusters
            if (clusters) clusters[key] = next
          },
        },
      ]),
    )
    for (const [key, label, range] of CARPET_CONTROLS) {
      bladeFolder
        .add(carpet[key], 'value', ...range)
        .name(label)
        .onFinishChange(refazerMundo)
        .listen()
    }

    // Árvores ----------------------------------------------------------------
    const loadedIds = new Set(packs.flatMap(({ ids }) => ids ?? []))
    const treeFolder = gui.addFolder('Árvores')
    treeFolder
      .add(
        {
          use: () => {
            const requested = []
            for (const [kind, change] of Object.entries(PACK_TREES)) {
              const entry = entryHere(kind)
              if (!entry) continue
              const models = change.models?.filter((id) => loadedIds.has(id))
              if (change.models && !models.length) continue
              Object.assign(entry, change, models ? { models } : {})
              // `place: undefined` tira a regra (nasce em qualquer lugar).
              if ('place' in change && change.place === undefined) {
                delete entry.place
              }
              requested.push(...(models ?? []))
            }
            requestLgpeModels(requested)
            // Os modelos carregam à parte; a vegetação se refaz sozinha
            // quando chegam (o mundo já sai com os tamanhos novos).
            refazerMundo()
          },
        },
        'use',
      )
      .name('Árvores dos pacotes (tudo)')
    treeFolder
      .add(
        {
          back: () => {
            const original = snapshot.biomes[labState.point]?.vegetation ?? []
            for (const kind of Object.keys(PACK_TREES)) {
              const entry = entryHere(kind)
              const before = original.find((item) => item.kind === kind)
              if (!entry || !before) continue
              for (const key of [
                'models',
                'density',
                'scale',
                'place',
                'patches',
              ]) {
                if (before[key] === undefined) delete entry[key]
                else entry[key] = structuredClone(before[key])
              }
            }
            refazerMundo()
          },
        },
        'back',
      )
      .name("Voltar às do Let's Go")
    // Some perto da câmera (desempenho, item 1): a copa, as pedras e os
    // prédios com a câmera dentro.
    const nearHide = GAME_CONFIG.CAMERA.NEAR_HIDE
    treeFolder.add(nearHide, 'ENABLED').name('Some perto da câmera')
    for (const [kind, label] of [
      ['CANOPY', 'copa'],
      ['SOLID', 'pedra e prédio'],
    ]) {
      treeFolder
        .add(nearHide[kind], 'HIDE', -2, 3, 0.1)
        .name(`Some a (m): ${label}`)
      treeFolder
        .add(nearHide[kind], 'FADE', 0, 3, 0.1)
        .name(`Pontilhado (m): ${label}`)
    }

    // Relevo -----------------------------------------------------------------
    const reliefFolder = gui.addFolder('Relevo')
    const biomeHere = () => getBiome(labState.point)
    const reliefValue = (key, inner) => ({
      get value() {
        const relief = biomeHere()?.relief
        return (inner ? relief?.terraces?.[key] : relief?.[key]) ?? 0
      },
      set value(next) {
        const relief = biomeHere()?.relief
        if (!relief) return
        if (!inner) relief[key] = next
        else
          relief.terraces = {
            ...PLATEAU_TERRACES,
            ...relief.terraces,
            [key]: next,
          }
      },
    })
    reliefFolder
      .add(
        {
          plateaus: () => {
            const biome = biomeHere()
            if (!biome) return
            Object.assign(biome.relief, PLATEAU_RELIEF)
            biome.relief.terraces = { ...PLATEAU_TERRACES }
            if (biome.ground?.colors)
              biome.ground.colors.slope = PLATEAU_SLOPE_COLOR
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            regenerarTerreno(world)
            rebuildVegetation()
          },
        },
        'plateaus',
      )
      .name('Platôs (tudo)')
    reliefFolder
      .add(
        {
          back: () => {
            const biome = biomeHere()
            const before = snapshot.biomes[labState.point]
            if (!biome || !before) return
            biome.relief = structuredClone(before.relief)
            if (biome.ground?.colors && before.ground?.colors) {
              biome.ground.colors.slope = before.ground.colors.slope
            }
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            refazerMundo()
          },
        },
        'back',
      )
      .name('Voltar ao relevo de antes')
    for (const [key, label, range] of RELIEF_CONTROLS) {
      reliefFolder
        .add(reliefValue(key, false), 'value', ...range)
        .name(label)
        .onFinishChange(refazerMundo)
        .listen()
    }
    for (const [key, label, range] of TERRACE_CONTROLS) {
      reliefFolder
        .add(reliefValue(key, true), 'value', ...range)
        .name(label)
        .onFinishChange(refazerMundo)
        .listen()
    }
    const slopeColor = {
      get value() {
        return biomeHere()?.ground?.colors?.slope ?? COLOR_LAYER_OPTIONS[0]
      },
      set value(next) {
        const colors = biomeHere()?.ground?.colors
        if (colors) colors.slope = next
      },
    }
    reliefFolder
      .add(slopeColor, 'value', COLOR_LAYER_OPTIONS)
      .name('Textura do barranco')
      .onChange(refazerMundo)
      .listen()
    reliefFolder
      .add(GAME_CONFIG.TERRAIN_COLOR, 'SLOPE_START', 0.5, 1, 0.01)
      .name('Barranco começa (inclinação)')
      .onFinishChange(refazerMundo)
    reliefFolder
      .add(GAME_CONFIG.TERRAIN_COLOR, 'SLOPE_FULL', 0.3, 1, 0.01)
      .name('Barranco cheio (inclinação)')
      .onFinishChange(refazerMundo)

    // Montanhas ---------------------------------------------------------------
    const mountainFolder = gui.addFolder('Montanhas')
    const mountainStatus = { text: '—' }
    const mountainValue = (key) => ({
      get value() {
        return biomeHere()?.relief?.mountains?.[key] ?? MOUNTAIN_PRESET[key]
      },
      set value(next) {
        const relief = biomeHere()?.relief
        if (!relief) return
        relief.mountains = {
          ...MOUNTAIN_PRESET,
          ...relief.mountains,
          [key]: next,
        }
      },
    })
    const goToMountain = () => {
      const here = playerEntity.has(Position)
        ? playerEntity.get(Position)
        : points[labState.point]
      const mountain = here
        ? TEST_LEVEL.terrain.nearestMountain?.(here.x, here.z)
        : null
      if (!mountain) {
        mountainStatus.text = 'nenhuma por perto'
        return
      }
      moverTreinadorPara(playerEntity, mountain.foot)
      olharDoLabPara(cameraEntity, mountain.foot, mountain)
      mountainStatus.text = `${Math.round(mountain.height)} m de altura`
    }
    mountainFolder
      .add(
        {
          mountains: () => {
            const biome = biomeHere()
            if (!biome) return
            biome.relief.mountains = { ...MOUNTAIN_PRESET }
            if (biome.ground?.colors)
              biome.ground.colors.slope = PLATEAU_SLOPE_COLOR
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            refazerMundo()
            goToMountain()
          },
        },
        'mountains',
      )
      .name('Montanhas (tudo)')
    mountainFolder
      .add({ go: goToMountain }, 'go')
      .name('Ir à montanha mais perto')
    mountainFolder
      .add(
        {
          off: () => {
            const relief = biomeHere()?.relief
            if (!relief) return
            const before = snapshot.biomes[labState.point]?.relief?.mountains
            if (before) relief.mountains = structuredClone(before)
            else delete relief.mountains
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            refazerMundo()
          },
        },
        'off',
      )
      .name('Tirar as montanhas')
    mountainFolder
      .add(mountainStatus, 'text')
      .name('Montanha')
      .disable()
      .listen()
    for (const [key, label, range] of MOUNTAIN_CONTROLS) {
      mountainFolder
        .add(mountainValue(key), 'value', ...range)
        .name(label)
        .onFinishChange(refazerMundo)
        .listen()
    }

    // Pacotes de fora -------------------------------------------------------
    const packFolder = gui.addFolder('Pacotes de fora')
    if (packs.length === 0) {
      packFolder
        .add({ info: 'nenhum (ver scripts/lab/)' }, 'info')
        .name('Carregados')
        .disable()
    }
    for (const { id, count } of packs) {
      packFolder
        .add({ info: `${count} modelos` }, 'info')
        .name(id)
        .disable()
    }
    packFolder
      .add({ info: 'F2 → Vegetação → Modelos' }, 'info')
      .name('Usar')
      .disable()
    packFolder.close()

    // Copiar ----------------------------------------------------------------
    gui
      .add(
        {
          copiar: () => {
            const current = {
              config: GAME_CONFIG,
              biomes: Object.fromEntries(listBiomes().map((b) => [b.id, b])),
            }
            const text =
              formatChangedValues(changedValues(snapshot, current)) ||
              '// nada mudou desde que o lab abriu'
            navigator.clipboard?.writeText(text).catch(() => {})
          },
        },
        'copiar',
      )
      .name('Copiar valores (o que mudou)')

    return () => gui.destroy()
  }, [container, points, snapshot, packs, onCapture])

  return null
}
