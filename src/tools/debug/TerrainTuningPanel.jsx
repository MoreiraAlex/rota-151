'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { GAME_CONFIG } from '@/core/gameConfig'
import { regenerarTerreno } from '@/core/actions/terrain'
import { BIOME_REGISTRY, listBiomes } from '@/core/data/biomes'
import { world } from '@/core/world/world'
import {
  TERRAIN_COLOR_MODES,
  getTerrainColorMode,
  setTerrainColorMode,
} from '@/view/terrain/terrainColorMode'
import { notifyTerrainLookChanged } from '@/view/terrain/terrainLook'
import { TERRAIN_LAYERS } from '@/view/terrain/terrainLayers'
import { rebuildVegetation } from '@/view/vegetation/vegetationSettings'

// Faixas dos controles: [mín, máx, passo]. Só a ferramenta usa.
// `keepsTerrain`: só muda o carregar/descarregar (o `chunkStreamingSystem`
// lê a config a cada tick) — não precisa refazer o relevo.
const CONTROLS = {
  WATER_LEVEL: { label: 'Nível da água (m)', range: [-15, 15, 0.1] },
  // O lado do chunk é fixo (`TERRAIN.CHUNK_SIZE`). O raio é o controle
  // de gráfico: máquina mais forte aguenta mais mundo na tela.
  LOAD_RADIUS: {
    label: 'Raio de carregar (chunks)',
    range: [1, 32, 1],
    keepsTerrain: true,
  },
  UNLOAD_RADIUS: {
    label: 'Raio de descarregar (chunks)',
    range: [1, 40, 1],
    keepsTerrain: true,
  },
}

// Mapa de biomas (`GAME_CONFIG.BIOMES`, docs/features/047-biomas.md).
const BIOME_MAP_CONTROLS = {
  CLIMATE_SIZE: { label: 'Tamanho do clima (m)', range: [500, 20000, 100] },
  CONTINENT_SIZE: {
    label: 'Tamanho dos continentes (m)',
    range: [500, 20000, 100],
  },
  CLIMATE_SHARPNESS: { label: 'Firmeza do clima', range: [0, 30, 0.5] },
  PRESENCE_STRENGTH: { label: 'Peso das manchas', range: [0, 2, 0.01] },
  PATCH_COVERAGE: { label: 'Cobertura das manchas', range: [0, 1, 0.01] },
  BLEND_CELL: { label: 'Largura da transição (m)', range: [4, 128, 1] },
}

// Por bioma (`size` e `relief`, core/data/biomes/).
const BIOME_CONTROLS = {
  size: { label: 'Tamanho (m)', range: [50, 5000, 10] },
  baseHeight: { label: 'Chão médio (m)', range: [-40, 60, 0.1] },
  hillHeight: { label: 'Altura dos morros (m)', range: [0, 60, 0.1] },
  hillSize: { label: 'Largura dos morros (m)', range: [10, 600, 1] },
  roughness: { label: 'Detalhe miúdo', range: [0, 1, 0.01] },
  flatness: { label: 'Campo plano', range: [0.3, 3, 0.05] },
}
const isBiomeSize = (key) => key === 'size'
const biomeTarget = (biome, key) => (isBiomeSize(key) ? biome : biome.relief)

const biomeTuning = (biome) =>
  Object.fromEntries(
    Object.keys(BIOME_CONTROLS).map((key) => [
      key,
      biomeTarget(biome, key)[key],
    ]),
  )

// Desenho do chão (`GAME_CONFIG.TERRAIN_LOOK`): só muda o material, sem
// refazer o relevo.
const LOOK_CONTROLS = {
  TEXTURE_SIZE: { label: 'Tamanho da textura (m)', range: [0.5, 20, 0.1] },
  NORMAL_STRENGTH: { label: 'Relevo da textura', range: [0, 2, 0.01] },
  TEXTURE_DETAIL: { label: 'Desenho da textura', range: [0, 2, 0.01] },
  PATCH_STRENGTH: { label: 'Manchas', range: [0, 1, 0.01] },
  PATCH_SIZE: { label: 'Tamanho das manchas (m)', range: [0.5, 50, 0.1] },
  GRAIN_STRENGTH: { label: 'Granulado', range: [0, 0.5, 0.01] },
}

// Trilhas (`GAME_CONFIG.TRAILS`, core/terrain/trails.js): mudam o relevo,
// refazem o terreno ao soltar.
const TRAIL_CONTROLS = {
  SIZE: { label: 'Distância entre trilhas (m)', range: [30, 500, 5] },
  WARP: { label: 'Serpenteio (m)', range: [0, 80, 1] },
  WARP_SIZE: { label: 'Tamanho das curvas (m)', range: [5, 200, 1] },
  WIDTH: { label: 'Largura (m)', range: [0.5, 6, 0.1] },
  EDGE: { label: 'Borda (m)', range: [0.1, 3, 0.05] },
  DEPTH: { label: 'Afundado (m)', range: [0, 1, 0.01] },
  BANK: { label: 'Beirada (m)', range: [0, 0.4, 0.01] },
  DETAIL: { label: 'Desenho da textura', range: [0, 1.5, 0.01] },
  SHORE_GAP: { label: 'Folga da água (m)', range: [0, 2, 0.05] },
}

// O que cada bioma tem de trilha (core/data/biomes/): se tem, a cor e a
// textura dela e da margem da água (a mesma terra, de preferência).
const trailTuning = ({ trails, palette, ground }) => ({
  trails: trails === true,
  trail: palette.trail ?? palette.slope,
  trailTexture: ground.trailTexture ?? ground.texture,
  shore: palette.shore,
  shoreTexture: ground.shoreTexture ?? ground.texture,
})

function applyTrailTuning(biome, tuning) {
  biome.trails = tuning.trails
  biome.palette.trail = tuning.trail
  biome.ground.trailTexture = tuning.trailTexture
  biome.palette.shore = tuning.shore
  biome.ground.shoreTexture = tuning.shoreTexture
}

// Valores de quando o jogo carregou — o "Voltar ao inicial".
const INITIAL = {
  seed: GAME_CONFIG.WORLD.SEED,
  terrain: { ...GAME_CONFIG.TERRAIN },
  look: { ...GAME_CONFIG.TERRAIN_LOOK },
  trails: { ...GAME_CONFIG.TRAILS },
  pebbles: GAME_CONFIG.PEBBLES.PER_M2,
  biomeTrails: Object.fromEntries(
    listBiomes().map((biome) => [biome.id, trailTuning(biome)]),
  ),
  biomeMap: {
    ...GAME_CONFIG.BIOMES,
    HIDDEN: [...GAME_CONFIG.BIOMES.HIDDEN],
  },
  biomes: Object.fromEntries(
    listBiomes().map((biome) => [biome.id, biomeTuning(biome)]),
  ),
}

const configAsText = () =>
  [
    `WORLD.SEED: ${GAME_CONFIG.WORLD.SEED}`,
    'TERRAIN:',
    ...Object.keys(CONTROLS).map(
      (key) => `  ${key}: ${GAME_CONFIG.TERRAIN[key]},`,
    ),
    'TERRAIN_LOOK:',
    ...Object.keys(GAME_CONFIG.TERRAIN_LOOK).map(
      (key) => `  ${key}: ${JSON.stringify(GAME_CONFIG.TERRAIN_LOOK[key])},`,
    ),
    `TRAILS: ${JSON.stringify(GAME_CONFIG.TRAILS, null, 2)}`,
    `PEBBLES.PER_M2: ${GAME_CONFIG.PEBBLES.PER_M2}`,
    ...listBiomes()
      .filter(({ trails }) => trails)
      .map(
        (biome) =>
          `${biome.id} (trilha e margem): ${JSON.stringify(trailTuning(biome))}`,
      ),
    'BIOMES:',
    ...Object.keys(BIOME_MAP_CONTROLS).map(
      (key) => `  ${key}: ${GAME_CONFIG.BIOMES[key]},`,
    ),
    ...listBiomes().map(
      (biome) => `${biome.id}: ${JSON.stringify(biomeTuning(biome))}`,
    ),
  ].join('\n')

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): painel `lil-gui` que
 * ajusta o relevo em tempo real (docs/features/045-terreno-de-um-chunk.md,
 * docs/features/047-biomas.md). Mexe direto em `GAME_CONFIG.TERRAIN`/
 * `BIOMES`/`WORLD.SEED` e no `size`/`relief` de um bioma escolhido (só
 * nesta sessão) e chama `regenerarTerreno`. "Copiar valores" leva os
 * números para colar no `gameConfig.js` e nos biomas
 * (`core/data/biomes/`) — é o caminho para o ajuste virar config de
 * verdade. "Chão por bioma" pinta cada bioma de uma cor chapada; "Biomas
 * no mundo" esconde biomas (`BIOMES.HIDDEN`) para olhar um só; "Trilhas"
 * (docs/features/049-vegetacao-e-floresta.md) ajusta a forma e o relevo
 * das trilhas, os seixos e a cor e textura da trilha e da margem de cada
 * bioma.
 *
 * A seed aqui só muda o relevo e o que depende dele: o RNG de gameplay já
 * foi criado com a seed do início.
 */
export function TerrainTuningPanel() {
  useEffect(() => {
    const regenerate = () => regenerarTerreno(world)

    const gui = new GUI({ title: 'Terreno' })
    // Digitar nos campos não pode virar comando do jogo (o teclado do jogo
    // escuta a janela inteira: "1" invocaria o slot 1).
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)
    const seedState = { seed: GAME_CONFIG.WORLD.SEED }
    gui
      .add(seedState, 'seed')
      .name('Seed')
      .step(1)
      .onFinishChange((seed) => {
        GAME_CONFIG.WORLD.SEED = seed
        regenerate()
      })

    for (const [key, { label, range, keepsTerrain }] of Object.entries(
      CONTROLS,
    )) {
      const controller = gui.add(GAME_CONFIG.TERRAIN, key, ...range).name(label)
      if (!keepsTerrain) controller.onChange(regenerate)
    }

    const colorState = {
      byBiome: getTerrainColorMode() === TERRAIN_COLOR_MODES.biome,
    }
    gui
      .add(colorState, 'byBiome')
      .name('Chão por bioma')
      .onChange((byBiome) =>
        setTerrainColorMode(
          byBiome ? TERRAIN_COLOR_MODES.biome : TERRAIN_COLOR_MODES.natural,
        ),
      )

    const lookFolder = gui.addFolder('Desenho do chão')
    for (const [key, { label, range }] of Object.entries(LOOK_CONTROLS)) {
      lookFolder
        .add(GAME_CONFIG.TERRAIN_LOOK, key, ...range)
        .name(label)
        .onChange(notifyTerrainLookChanged)
    }

    const trailFolder = gui.addFolder('Trilhas (refaz ao soltar)')
    for (const [key, { label, range }] of Object.entries(TRAIL_CONTROLS)) {
      trailFolder
        .add(GAME_CONFIG.TRAILS, key, ...range)
        .name(label)
        .onFinishChange(regenerate)
    }
    trailFolder
      .add(GAME_CONFIG.PEBBLES, 'PER_M2', 0, 2, 0.01)
      .name('Seixos por m²')
      .onFinishChange(rebuildVegetation)
    // Trilha e margem de um bioma por vez.
    const trailChoice = {
      id: listBiomes().find(({ trails }) => trails)?.id ?? listBiomes()[0].id,
    }
    let trailControllers = []
    const showTrailBiome = () => {
      trailControllers.forEach((controller) => controller.destroy())
      const biome = BIOME_REGISTRY[trailChoice.id]
      const tuning = trailTuning(biome)
      const apply = () => {
        applyTrailTuning(biome, tuning)
        regenerate()
      }
      trailControllers = [
        trailFolder.add(tuning, 'trails').name('Tem trilhas').onChange(apply),
        trailFolder.addColor(tuning, 'trail').name('Cor da trilha'),
        trailFolder
          .add(tuning, 'trailTexture', TERRAIN_LAYERS)
          .name('Textura da trilha'),
        trailFolder.addColor(tuning, 'shore').name('Cor da margem'),
        trailFolder
          .add(tuning, 'shoreTexture', TERRAIN_LAYERS)
          .name('Textura da margem'),
      ]
      trailControllers.slice(1).forEach((c) => c.onFinishChange(apply))
    }
    trailFolder
      .add(
        trailChoice,
        'id',
        Object.fromEntries(listBiomes().map(({ id, name }) => [name, id])),
      )
      .name('Bioma')
      .onChange(showTrailBiome)
    showTrailBiome()

    const mapFolder = gui.addFolder('Mapa de biomas')
    for (const [key, { label, range }] of Object.entries(BIOME_MAP_CONTROLS)) {
      mapFolder
        .add(GAME_CONFIG.BIOMES, key, ...range)
        .name(label)
        .onFinishChange(regenerate)
    }

    // Um bioma por vez: trocar o escolhido refaz os controles da pasta.
    const biomeFolder = gui.addFolder('Bioma')
    const choice = { id: listBiomes()[0].id }
    let biomeControllers = []
    const showBiome = () => {
      biomeControllers.forEach((controller) => controller.destroy())
      const biome = BIOME_REGISTRY[choice.id]
      biomeControllers = Object.entries(BIOME_CONTROLS).map(
        ([key, { label, range }]) =>
          biomeFolder
            .add(biomeTarget(biome, key), key, ...range)
            .name(label)
            .onFinishChange(regenerate),
      )
    }
    biomeFolder
      .add(
        choice,
        'id',
        Object.fromEntries(listBiomes().map(({ id, name }) => [name, id])),
      )
      .name('Escolhido')
      .onChange(showBiome)
    showBiome()

    // Esconder biomas (`BIOMES.HIDDEN`): o mundo é refeito sem eles — com
    // um só ligado, o mundo inteiro é ele. Pelo menos um fica ligado.
    const visibleFolder = gui.addFolder('Biomas no mundo')
    const visible = Object.fromEntries(
      listBiomes().map(({ id }) => [
        id,
        !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
      ]),
    )
    const applyVisible = () => {
      GAME_CONFIG.BIOMES.HIDDEN = listBiomes()
        .map(({ id }) => id)
        .filter((id) => !visible[id])
      visibleFolder.controllersRecursive().forEach((c) => c.updateDisplay())
      regenerate()
    }
    const showOnly = (keep) => {
      for (const id of Object.keys(visible)) visible[id] = keep(id)
      applyVisible()
    }
    for (const { id, name } of listBiomes()) {
      visibleFolder
        .add(visible, id)
        .name(name)
        .onChange(() => {
          if (!Object.values(visible).some(Boolean)) visible[id] = true
          applyVisible()
        })
    }
    visibleFolder
      .add({ only: () => showOnly((id) => id === choice.id) }, 'only')
      .name('Só o escolhido (pasta Bioma)')
    visibleFolder
      .add({ all: () => showOnly(() => true) }, 'all')
      .name('Mostrar todos')

    gui
      .add(
        {
          copy: () => navigator.clipboard?.writeText(configAsText()),
        },
        'copy',
      )
      .name('Copiar valores')
    gui
      .add(
        {
          reset: () => {
            GAME_CONFIG.WORLD.SEED = INITIAL.seed
            seedState.seed = INITIAL.seed
            Object.assign(GAME_CONFIG.TERRAIN, INITIAL.terrain)
            Object.assign(GAME_CONFIG.BIOMES, INITIAL.biomeMap)
            Object.assign(GAME_CONFIG.TERRAIN_LOOK, INITIAL.look)
            Object.assign(GAME_CONFIG.TRAILS, INITIAL.trails)
            GAME_CONFIG.PEBBLES.PER_M2 = INITIAL.pebbles
            for (const biome of listBiomes()) {
              applyTrailTuning(biome, INITIAL.biomeTrails[biome.id])
            }
            showTrailBiome()
            rebuildVegetation()
            notifyTerrainLookChanged()
            for (const id of Object.keys(visible)) {
              visible[id] = !INITIAL.biomeMap.HIDDEN.includes(id)
            }
            for (const biome of listBiomes()) {
              for (const [key, value] of Object.entries(
                INITIAL.biomes[biome.id],
              )) {
                biomeTarget(biome, key)[key] = value
              }
            }
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            regenerate()
          },
        },
        'reset',
      )
      .name('Voltar ao inicial')

    return () => gui.destroy()
  }, [])

  return null
}
