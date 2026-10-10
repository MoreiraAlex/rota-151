'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WEATHER_TYPES } from '@/core/weather/weatherMap'
import { notifyRenderSettingsChanged } from '@/view/scene/renderSettings'
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

// [mín, máx, passo] e nome. `rebuild`: só vale refazendo os blocos.
const GRASS_CONTROLS = {
  HEIGHT: { label: 'Altura (m)', range: [0.1, 1.5, 0.01], rebuild: true },
  CLUMPS_PER_M2: {
    label: 'Tufos por m²',
    range: [0.5, 20, 0.5],
    rebuild: true,
  },
  FACE_CAMERA: { label: 'De frente pra câmera', range: [0, 1, 0.01] },
  HEIGHT_VARIATION: { label: 'Variação de altura', range: [0, 1, 0.01] },
  HEIGHT_PATCH_SIZE: { label: 'Manchas de altura (m)', range: [1, 30, 0.5] },
  COLOR_PATCH_SIZE: { label: 'Manchas de cor (m)', range: [0.2, 10, 0.1] },
  COLOR_VARIATION: { label: 'Variação de cor', range: [0, 1, 0.01] },
  MACRO_VARIATION: { label: 'Claro e escuro', range: [0, 1, 0.01] },
  MACRO_SIZE: { label: 'Claro e escuro (m)', range: [1, 40, 0.5] },
  BASE_SHADE: { label: 'Sombra na base', range: [0, 1, 0.01] },
  TRANSLUCENCY: { label: 'Luz pela folha', range: [0, 3, 0.05] },
  RIM: { label: 'Brilho de borda', range: [0, 1, 0.01] },
}
const FLOWER_CONTROLS = {
  CLUMPS_PER_M2: { label: 'Moitas por m²', range: [0, 1, 0.01], rebuild: true },
}
// Faixa de tamanho (`SCALE: [mín, máx]`): os dois números do array.
const SCALE_CONTROLS = {
  0: { label: 'Tamanho mínimo', range: [0.05, 1.5, 0.01], rebuild: true },
  1: { label: 'Tamanho máximo', range: [0.05, 1.5, 0.01], rebuild: true },
}
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

const COLOR_LABELS = {
  root: 'Raiz',
  tip: 'Ponta',
  rootB: 'Raiz (B)',
  tipB: 'Ponta (B)',
}

function addControls(folder, target, controls) {
  for (const [key, { label, range, rebuild }] of Object.entries(controls)) {
    const controller = folder.add(target, key, ...range).name(label)
    if (rebuild) controller.onFinishChange(rebuildVegetation)
  }
}

const grassEntryOf = (biome) =>
  biome.vegetation.find(({ kind }) => kind === GRASS_KIND)

function copyValues() {
  const { GRASS, FLOWERS, TREES, WIND, VEGETATION_QUALITY, RENDER } =
    GAME_CONFIG
  const { CLEARINGS, ROCKS, LOGS, BUSHES, FERNS, MUSHROOMS } = GAME_CONFIG
  const { ANCIENT_TREES, PINES, ACACIAS, DEAD_TREES, LEAFY_PLANTS } =
    GAME_CONFIG
  const { VEGETATION_PATCHES } = GAME_CONFIG
  const grassByBiome = Object.fromEntries(
    listBiomes()
      .filter(grassEntryOf)
      .map((biome) => [biome.id, grassEntryOf(biome)]),
  )
  const text = [
    `GRASS: ${JSON.stringify(GRASS, null, 2)},`,
    `FLOWERS: ${JSON.stringify(FLOWERS, null, 2)},`,
    `TREES: ${JSON.stringify(TREES, null, 2)},`,
    `WIND: ${JSON.stringify(WIND, null, 2)},`,
    `VEGETATION_QUALITY: ${JSON.stringify(VEGETATION_QUALITY, null, 2)},`,
    `FOLIAGE_FILL: ${GAME_CONFIG.FOLIAGE_FILL},`,
    ...Object.entries({
      ANCIENT_TREES,
      PINES,
      ACACIAS,
      DEAD_TREES,
      CLEARINGS,
      VEGETATION_PATCHES,
      ROCKS,
      LOGS,
      BUSHES,
      FERNS,
      LEAFY_PLANTS,
      MUSHROOMS,
    }).map(([name, value]) => `${name}: ${JSON.stringify(value, null, 2)},`),
    `RENDER (curva, SMAA e FPS): ${JSON.stringify({ TONE_MAPPING: RENDER.TONE_MAPPING, SMAA: RENDER.SMAA, MAX_FPS: RENDER.MAX_FPS })}`,
    `// grama por bioma (core/data/biomes/<id>/): ${JSON.stringify(grassByBiome, null, 2)}`,
  ].join('\n')
  navigator.clipboard?.writeText(text)
}

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): painel "Vegetação"
 * (docs/features/049-vegetacao-e-floresta.md) — curva de cor e SMAA
 * para comparar, qualidade, ligar e desligar cada parte, e ajustar a grama
 * (também a cor de cada bioma e os conjuntos de grama), as flores, o
 * sub-bosque da floresta, as
 * copas e o vento. Mexe no `GAME_CONFIG` e nos biomas ao vivo (só nesta
 * sessão); "Copiar valores" leva os números para o código. Árvores, pedras,
 * troncos caídos e clareiras vêm do relevo: mudam com "Regenerar" no
 * painel "Terreno".
 */
export function VegetationPanel() {
  useEffect(() => {
    const {
      GRASS,
      FLOWERS,
      TREES,
      WIND,
      VEGETATION_QUALITY,
      RENDER,
      BUSHES,
      FERNS,
      MUSHROOMS,
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
    render
      .add(RENDER, 'TONE_MAPPING', {
        'ACES (antes)': 'aces',
        Neutral: 'neutral',
      })
      .name('Curva de cor')
      .onChange(notifyRenderSettingsChanged)
    render
      .add(RENDER, 'SMAA')
      .name('SMAA')
      .onChange(notifyRenderSettingsChanged)
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
    for (const [part, label] of [
      ['grass', 'Grama'],
      ['flowers', 'Flores'],
      ['trees', 'Árvores'],
      ['undergrowth', 'Arbustos, samambaias, plantas e cogumelos'],
      ['rocks', 'Pedras e troncos caídos'],
    ]) {
      show
        .add(visible, part)
        .name(label)
        .onChange((isVisible) => setVegetationVisible(part, isVisible))
    }

    const grassFolder = gui.addFolder('Grama')
    addControls(grassFolder, GRASS, GRASS_CONTROLS)

    const biomesWithGrass = listBiomes().filter(grassEntryOf)
    const colorFolder = gui.addFolder('Grama do bioma')
    const choice = { biome: biomesWithGrass[0]?.id }
    let colorControllers = []
    const showBiomeColors = () => {
      for (const controller of colorControllers) controller.destroy()
      const biome = biomesWithGrass.find(({ id }) => id === choice.biome)
      if (!biome) return
      const entry = grassEntryOf(biome)
      colorControllers = [
        colorFolder
          .add(entry, 'density', 0, 1, 0.01)
          .name('Densidade')
          .onFinishChange(rebuildVegetation),
        ...Object.entries(COLOR_LABELS).map(([key, label]) =>
          colorFolder
            .addColor(entry.colors, key)
            .name(label)
            .onFinishChange(rebuildVegetation),
        ),
      ]
    }
    colorFolder
      .add(
        choice,
        'biome',
        Object.fromEntries(biomesWithGrass.map(({ id, name }) => [name, id])),
      )
      .name('Bioma')
      .onChange(showBiomeColors)
    showBiomeColors()

    // Um bioma por vez; "Usar conjuntos" liga (com os números do primeiro
    // bioma que tem) ou desliga a grama em conjuntos.
    const clusterFolder = gui.addFolder('Conjuntos de grama (refaz ao soltar)')
    const clusterTemplate = biomesWithGrass
      .map(grassEntryOf)
      .find((entry) => entry.clusters)?.clusters
    // Abre no primeiro bioma que já tem conjuntos.
    const clusterChoice = {
      biome: (
        biomesWithGrass.find((biome) => grassEntryOf(biome).clusters) ??
        biomesWithGrass[0]
      )?.id,
      enabled: false,
    }
    let clusterControllers = []
    const showClusters = () => {
      for (const controller of clusterControllers) controller.destroy()
      clusterControllers = []
      const entry = grassEntryOf(
        biomesWithGrass.find(({ id }) => id === clusterChoice.biome),
      )
      clusterChoice.enabled = Boolean(entry.clusters)
      clusterControllers.push(
        clusterFolder
          .add(clusterChoice, 'enabled')
          .name('Usar conjuntos')
          .onChange((enabled) => {
            if (enabled) entry.clusters = { ...clusterTemplate }
            else delete entry.clusters
            rebuildVegetation()
            showClusters()
          }),
      )
      if (!entry.clusters) return
      const addGroup = (title, controls) => {
        const folder = clusterFolder.addFolder(title)
        clusterControllers.push(folder)
        addControls(
          folder,
          entry.clusters,
          Object.fromEntries(
            Object.entries(controls).map(([key, control]) => [
              key,
              { ...control, rebuild: true },
            ]),
          ),
        )
      }
      addGroup('Conjunto', CLUSTER_CONTROLS)
      addGroup('Mapa', CLUSTER_MAP_CONTROLS)
    }
    clusterFolder
      .add(
        clusterChoice,
        'biome',
        Object.fromEntries(biomesWithGrass.map(({ id, name }) => [name, id])),
      )
      .name('Bioma')
      .onChange(showClusters)
    showClusters()

    const flowerFolder = gui.addFolder('Flores')
    addControls(flowerFolder, FLOWERS, FLOWER_CONTROLS)
    addControls(flowerFolder, FLOWERS.SCALE, SCALE_CONTROLS)

    const forestFolder = gui.addFolder('Floresta (refaz ao soltar)')
    addControls(forestFolder, BUSHES, {
      PER_M2: {
        label: 'Arbustos por m²',
        range: [0, 0.2, 0.005],
        rebuild: true,
      },
    })
    addControls(forestFolder, FERNS, {
      PER_M2: {
        label: 'Samambaias por m²',
        range: [0, 0.4, 0.01],
        rebuild: true,
      },
    })
    addControls(forestFolder, LEAFY_PLANTS, {
      PER_M2: {
        label: 'Plantas por m²',
        range: [0, 0.3, 0.005],
        rebuild: true,
      },
    })
    addControls(forestFolder, MUSHROOMS, {
      PER_M2: {
        label: 'Cogumelos por m²',
        range: [0, 0.3, 0.01],
        rebuild: true,
      },
    })
    forestFolder
      .add(GAME_CONFIG, 'FOLIAGE_FILL', 0, 1, 0.01)
      .name('Planta baixa na sombra')
    forestFolder.addColor(ROCKS, 'MOSS_COLOR').name('Cor do musgo')
    forestFolder.addColor(ROCKS, 'COLOR').name('Cor das pedras')
    forestFolder.add(ROCKS, 'BRIGHTNESS', 0.5, 3, 0.05).name('Pedras: brilho')
    forestFolder.add(ROCKS, 'FILL', 0, 1, 0.01).name('Pedras na sombra')
    forestFolder
      .add(TREES, 'TINT_VARIATION', 0, 0.5, 0.01)
      .name('Variação do tom')
      .onFinishChange(rebuildVegetation)

    const treeFolder = gui.addFolder('Árvores')
    treeFolder.add(TREES, 'SWAY', 0, 4, 0.05).name('Balanço')
    treeFolder.add(TREES, 'LEAF_FILL', 0, 1, 0.01).name('Folha na sombra')
    treeFolder.add(TREES, 'INNER_SHADE', 0, 1, 0.01).name('Miolo da copa')
    treeFolder.add(TREES, 'TOP_LIGHT', 0, 1, 0.01).name('Alto da copa')
    treeFolder.add(TREES, 'TRANSLUCENCY', 0, 2, 0.05).name('Sol pela folha')
    treeFolder.add(TREES, 'TRUNK_FILL', 0, 1, 0.01).name('Tronco na sombra')
    treeFolder.addColor(TREES, 'LEAF_COLOR').name('Folha (folhosa)')
    treeFolder.addColor(ANCIENT_TREES, 'LEAF_COLOR').name('Folha (antiga)')
    treeFolder.addColor(PINES, 'LEAF_COLOR').name('Folha (pinheiro)')
    treeFolder.addColor(ACACIAS, 'LEAF_COLOR').name('Folha (acácia)')
    treeFolder.addColor(TREES, 'BARK_COLOR').name('Casca (folhosa e antiga)')
    treeFolder.addColor(PINES, 'BARK_COLOR').name('Casca (pinheiro)')
    treeFolder.addColor(ACACIAS, 'BARK_COLOR').name('Casca (acácia)')
    treeFolder.addColor(DEAD_TREES, 'BARK_COLOR').name('Casca (morta)')
    forestFolder.addColor(BUSHES, 'LEAF_COLOR').name('Cor dos arbustos')

    const windFolder = gui.addFolder('Vento')
    for (const type of WEATHER_TYPES) {
      windFolder
        .add(WIND.STRENGTH, type, 0, 1.5, 0.01)
        .name(`Força (${WEATHER_LABELS[type]})`)
    }
    addControls(windFolder, WIND, WIND_CONTROLS)

    gui.add({ copiar: copyValues }, 'copiar').name('Copiar valores')
    for (const folder of gui.folders) folder.close()

    return () => gui.destroy()
  }, [])

  return null
}
