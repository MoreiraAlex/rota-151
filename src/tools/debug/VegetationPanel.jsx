'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { regenerarTerreno } from '@/core/actions/terrain'
import { listBiomes } from '@/core/data/biomes'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WEATHER_TYPES } from '@/core/weather/weatherMap'
import { world } from '@/core/world/world'
import { notifyRenderSettingsChanged } from '@/view/scene/renderSettings'
import { GRASS_MODEL_CHOICES } from '@/view/vegetation/lgpeModels'
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

const COLOR_LABELS = {
  a: 'Cor (A)',
  b: 'Cor (B)',
}

const regenerate = () => regenerarTerreno(world)

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
  'ancient-tree': 'Antiga',
  'pine-tree': 'Pinheiro',
  'acacia-tree': 'Acácia',
  'dead-tree': 'Morta',
  bush: 'Arbustos',
  fern: 'Samambaias',
  'leafy-plant': 'Plantas',
  rock: 'Pedras',
}

/**
 * Subpasta "No bioma": escolhe um bioma (dos que têm algum dos `kinds`) e
 * mostra a densidade de cada entrada desses tipos no `vegetation` dele.
 * `apply` ao soltar.
 */
function addBiomeDensities(folder, kinds, apply) {
  const biomes = listBiomes().filter(({ vegetation }) =>
    vegetation.some(({ kind }) => kinds.includes(kind)),
  )
  if (biomes.length === 0) return
  const biomeFolder = folder.addFolder('Densidade no bioma')
  const choice = { biome: biomes[0].id }
  let controllers = []
  const show = () => {
    for (const controller of controllers) controller.destroy()
    const biome = biomes.find(({ id }) => id === choice.biome)
    controllers = biome.vegetation
      .filter(({ kind }) => kinds.includes(kind))
      .map((entry) =>
        biomeFolder
          .add(entry, 'density', 0, 2, 0.01)
          .name(KIND_LABELS[entry.kind] ?? entry.kind)
          .onFinishChange(apply),
      )
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
function addTreeSpecies(folder, title, config, colors) {
  const species = folder.addFolder(title)
  addControls(species, config, SOLID_CONTROLS, regenerate)
  addControls(species, config.SCALE, scaleControls([0.2, 3, 0.01]), regenerate)
  if (colors.leaf) species.addColor(config, 'LEAF_COLOR').name('Folha')
  if (colors.bark) species.addColor(config, 'BARK_COLOR').name('Casca')
}

// As partes do "Mostrar" (`setVegetationVisible`) — cada uma tem a pasta
// dos números dela.
const PARTS = [
  ['grass', 'Grama'],
  ['flowers', 'Flores'],
  ['trees', 'Árvores'],
  ['undergrowth', 'Arbustos, samambaias, plantas e cogumelos'],
  ['rocks', 'Pedras'],
]
const TREE_KINDS = [
  'broadleaf-tree',
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
  const { CLEARINGS, ROCKS, BUSHES, FERNS, MUSHROOMS } = GAME_CONFIG
  const { ANCIENT_TREES, PINES, ACACIAS, DEAD_TREES, LEAFY_PLANTS } =
    GAME_CONFIG
  const { VEGETATION_PATCHES } = GAME_CONFIG
  const vegetationByBiome = Object.fromEntries(
    listBiomes().map(({ id, vegetation }) => [id, vegetation]),
  )
  const text = [
    `GRASS: ${JSON.stringify(GRASS, null, 2)},`,
    `FLOWERS: ${JSON.stringify(FLOWERS, null, 2)},`,
    `TREES: ${JSON.stringify(TREES, null, 2)},`,
    `WIND: ${JSON.stringify(WIND, null, 2)},`,
    `VEGETATION_QUALITY: ${JSON.stringify(VEGETATION_QUALITY, null, 2)},`,
    `FOLIAGE_FILL: ${GAME_CONFIG.FOLIAGE_FILL},`,
    `LGPE: ${JSON.stringify(GAME_CONFIG.LGPE, null, 2)},`,
    `ENCOUNTER_GRASS: ${JSON.stringify(GAME_CONFIG.ENCOUNTER_GRASS, null, 2)},`,
    ...Object.entries({
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
      MUSHROOMS,
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
 * árvores e sub-bosque por espécie e pedras, cada uma com
 * a densidade no bioma; mais o toon do Let's Go e o vento. Mexe no
 * `GAME_CONFIG` e nos biomas ao vivo (só nesta sessão); "Copiar valores"
 * leva os números para o código. O que o core sorteia (árvores e pedras)
 * refaz o terreno ao soltar.
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
      const modelFolder = grassBiomeFolder.addFolder('Modelos')
      grassControllers.push(modelFolder)
      const chosen = Object.fromEntries(
        Object.keys(GRASS_MODEL_CHOICES).map((id) => [
          id,
          entry.models.includes(id),
        ]),
      )
      for (const [id, label] of Object.entries(GRASS_MODEL_CHOICES)) {
        modelFolder
          .add(chosen, id)
          .name(label)
          .onChange(() => {
            const ids = Object.keys(chosen).filter((key) => chosen[key])
            if (ids.length === 0) {
              chosen[id] = true
              modelFolder
                .controllersRecursive()
                .forEach((c) => c.updateDisplay())
              return
            }
            entry.models = ids
            rebuildVegetation()
          })
      }
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
    addControls(
      flowerFolder,
      FLOWERS.SCALE,
      scaleControls([0.05, 1.5, 0.01]),
      rebuildVegetation,
    )
    addBiomeDensities(flowerFolder, ['flower'], rebuildVegetation)

    // Árvores: o que vale para todas (material da copa e do tronco) e uma
    // subpasta por espécie; onde nascem vem do terreno (refaz ao soltar).
    const treeFolder = folderOf.trees
    treeFolder.add(TREES, 'LEAF_FILL', 0, 1, 0.01).name('Folha na sombra')
    treeFolder.add(TREES, 'INNER_SHADE', 0, 1, 0.01).name('Miolo da copa')
    treeFolder.add(TREES, 'TOP_LIGHT', 0, 1, 0.01).name('Alto da copa')
    treeFolder.add(TREES, 'TRANSLUCENCY', 0, 2, 0.05).name('Sol pela folha')
    treeFolder.add(TREES, 'TRUNK_FILL', 0, 1, 0.01).name('Tronco na sombra')
    treeFolder
      .add(TREES, 'TINT_VARIATION', 0, 0.5, 0.01)
      .name('Variação do tom')
      .onFinishChange(rebuildVegetation)
    addTreeSpecies(treeFolder, 'Folhosa (casca vale p/ antiga)', TREES, {
      leaf: true,
      bark: true,
    })
    addTreeSpecies(treeFolder, 'Antiga', ANCIENT_TREES, { leaf: true })
    addTreeSpecies(treeFolder, 'Pinheiro', PINES, { leaf: true, bark: true })
    addTreeSpecies(treeFolder, 'Acácia', ACACIAS, { leaf: true, bark: true })
    addTreeSpecies(treeFolder, 'Morta', DEAD_TREES, { bark: true })
    addBiomeDensities(treeFolder, TREE_KINDS, regenerate)

    // Sub-bosque: uma subpasta por planta (refaz ao soltar).
    const undergrowthFolder = folderOf.undergrowth
    undergrowthFolder
      .add(GAME_CONFIG, 'FOLIAGE_FILL', 0, 1, 0.01)
      .name('Planta baixa na sombra')
    for (const [title, config, maxPerM2] of [
      ['Arbustos', BUSHES, 0.2],
      ['Samambaias', FERNS, 0.4],
      ['Plantas', LEAFY_PLANTS, 0.3],
    ]) {
      const folder = undergrowthFolder.addFolder(title)
      addControls(folder, config, perM2Controls(maxPerM2), rebuildVegetation)
      addControls(
        folder,
        config.SCALE,
        scaleControls([0.05, 2, 0.01]),
        rebuildVegetation,
      )
      if (config === BUSHES) folder.addColor(BUSHES, 'LEAF_COLOR').name('Cor')
    }
    addBiomeDensities(undergrowthFolder, UNDERGROWTH_KINDS, rebuildVegetation)

    // Pedras: onde nascem vem do terreno (refaz ao soltar); a cor vale na
    // hora.
    const rockFolder = folderOf.rocks
    addControls(rockFolder, ROCKS, SOLID_CONTROLS, regenerate)
    addControls(
      rockFolder,
      ROCKS.SCALE,
      scaleControls([0.1, 3, 0.01]),
      regenerate,
    )
    rockFolder.addColor(ROCKS, 'COLOR').name('Cor')
    rockFolder.add(ROCKS, 'BRIGHTNESS', 0.5, 3, 0.05).name('Brilho')
    rockFolder.add(ROCKS, 'FILL', 0, 1, 0.01).name('Na sombra')
    rockFolder.addColor(ROCKS, 'MOSS_COLOR').name('Cor do musgo')
    addBiomeDensities(rockFolder, ['rock'], regenerate)

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
    lgpeFolder
      .add(ENCOUNTER_GRASS, 'PER_M2', 0, 3, 0.05)
      .name('Mato alto por m²')
      .onFinishChange(rebuildVegetation)
    lgpeFolder
      .add(ENCOUNTER_GRASS, 'MIN_CLUSTER_HEIGHT', 0, 1.5, 0.01)
      .name('Mato alto: só no miolo')
      .onFinishChange(rebuildVegetation)

    const windFolder = gui.addFolder('Vento')
    for (const type of WEATHER_TYPES) {
      windFolder
        .add(WIND.STRENGTH, type, 0, 1.5, 0.01)
        .name(`Força (${WEATHER_LABELS[type]})`)
    }
    addControls(windFolder, WIND, WIND_CONTROLS)

    gui.add({ copiar: copyValues }, 'copiar').name('Copiar valores')
    for (const folder of gui.foldersRecursive()) folder.close()

    return () => gui.destroy()
  }, [])

  return null
}
