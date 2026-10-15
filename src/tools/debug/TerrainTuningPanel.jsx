'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { GAME_CONFIG } from '@/core/gameConfig'
import { regenerarTerreno } from '@/core/actions/terrain'
import { BIOME_REGISTRY, listBiomes } from '@/core/data/biomes'
import { world } from '@/core/world/world'
import { TERRAIN_COLOR_LAYERS } from '@/view/terrain/terrainLayers'
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
  hillHeight: { label: 'Altura dos morros (m)', range: [0, 150, 0.1] },
  hillSize: { label: 'Largura dos morros (m)', range: [10, 1000, 1] },
  roughness: { label: 'Detalhe miúdo', range: [0, 1, 0.01] },
  flatness: { label: 'Campo plano', range: [0.3, 3, 0.05] },
  ridges: { label: 'Cristas', range: [0, 1, 0.01] },
}
const isBiomeSize = (key) => key === 'size'
const biomeTarget = (biome, key) => (isBiomeSize(key) ? biome : biome.relief)
// Os controles do bioma: a cidade não tem `size` (é posta pela seed,
// docs/features/058-ajuste-dos-biomas.md).
const biomeControlsOf = (biome) =>
  Object.fromEntries(
    Object.entries(BIOME_CONTROLS).filter(
      ([key]) => !(biome.town && isBiomeSize(key)),
    ),
  )

const biomeTuning = (biome) =>
  Object.fromEntries(
    Object.keys(biomeControlsOf(biome)).map((key) => [
      key,
      // Campo opcional (`ridges`) ausente vale 0.
      biomeTarget(biome, key)[key] ?? 0,
    ]),
  )

// Texturas do chão por área (`ground.colors` do bioma, os papéis de
// `addColorLayers` em view/terrain/terrainGeometry.js). Sem `base`, o bioma
// volta ao chão antigo (paleta e desenho) — as outras áreas ficam guardadas.
const GROUND_AREAS = {
  base: 'Chão',
  shade: 'Mata fechada',
  trail: 'Trilha',
  shore: 'Margem',
  slope: 'Encosta',
  high: 'Alto',
  peak: 'Pico',
}
const NO_TEXTURE = '—'
const GROUND_TEXTURE_OPTIONS = [
  NO_TEXTURE,
  ...TERRAIN_COLOR_LAYERS.map(([name]) => name),
]

const groundTuning = ({ ground }) =>
  Object.fromEntries(
    Object.keys(GROUND_AREAS).map((area) => [
      area,
      ground.colors?.[area] ?? NO_TEXTURE,
    ]),
  )

function applyGroundTuning(biome, tuning) {
  const chosen = Object.entries(tuning).filter(
    ([, layer]) => layer !== NO_TEXTURE,
  )
  if (tuning.base === NO_TEXTURE) delete biome.ground.colors
  else biome.ground.colors = Object.fromEntries(chosen)
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

// Lagos e rios (`GAME_CONFIG.WATER_BODIES`, core/terrain/waterBodies.js,
// docs/features/057-lagos-e-rios.md): mudam o relevo, refazem o terreno ao
// soltar.
const WATER_BODY_CONTROLS = {
  RIVER: {
    SIZE: { label: 'Distância entre rios (m)', range: [100, 3000, 10] },
    WARP: { label: 'Serpenteio (m)', range: [0, 300, 1] },
    WARP_SIZE: { label: 'Tamanho das curvas (m)', range: [20, 800, 5] },
    WIDTH: { label: 'Largura (m)', range: [1, 40, 0.5] },
    DEPTH: { label: 'Fundura (m)', range: [0.2, 6, 0.1] },
    SHORE_SLOPE: { label: 'Descida da margem', range: [0.02, 2, 0.01] },
  },
  LAKE: {
    SIZE: { label: 'Tamanho das manchas (m)', range: [40, 1500, 10] },
    COVERAGE: { label: 'Cobertura (0 a 1)', range: [0, 0.6, 0.01] },
    DEPTH: { label: 'Fundura (m)', range: [0.2, 8, 0.1] },
    SHORE_SLOPE: { label: 'Descida da margem', range: [0.02, 2, 0.01] },
  },
  BANK_SLOPE: { label: 'Encosta do vale', range: [0.02, 2, 0.01] },
  BLEND: { label: 'Curva do encontro (m)', range: [0.1, 6, 0.1] },
  BED_ROUGHNESS: { label: 'Ruído do fundo (m)', range: [0, 1, 0.01] },
  BED_SIZE: { label: 'Tamanho do ruído do fundo (m)', range: [1, 30, 0.5] },
  SPAWN_CLEAR_RADIUS: { label: 'Sem água na origem (m)', range: [0, 300, 5] },
}

// O desenho da água e o raso/fundo (`GAME_CONFIG.WATER`,
// docs/features/057-lagos-e-rios.md): valem na hora. `color` = seletor de
// cor; `regenerate` = refaz o terreno ao soltar (a grade de navegação sabe
// do fundo).
const WATER_CONTROLS = {
  WADE_FRACTION: {
    label: 'Entra até (fração da altura)',
    range: [0.05, 1, 0.01],
  },
  NAV_DEPTH: {
    label: 'Raso da navegação (m)',
    range: [0, 1.5, 0.01],
    regenerate: true,
  },
  SHALLOW_MIN_SPEED: {
    label: 'Velocidade no limite',
    range: [0.1, 1, 0.01],
  },
  FLOW_SPEED: { label: 'Correnteza (m/s)', range: [0, 5, 0.05] },
  FLOW_CYCLE: { label: 'Ciclo da correnteza (s)', range: [0.5, 10, 0.1] },
  DEEP_DEPTH: { label: 'Cor do fundo a partir de (m)', range: [0.2, 8, 0.1] },
  OPACITY_DEPTH: {
    label: 'Opacidade do fundo a partir de (m)',
    range: [0.1, 5, 0.05],
  },
}
const TOON_WATER_CONTROLS = {
  SHALLOW_COLOR: { label: 'Cor da margem', color: true },
  DEEP_COLOR: { label: 'Cor do fundo', color: true },
  SHORE_OPACITY: { label: 'Opacidade na margem', range: [0, 1, 0.01] },
  DEEP_OPACITY: { label: 'Opacidade no fundo', range: [0, 1, 0.01] },
  FOAM_COLOR: { label: 'Cor da espuma', color: true },
  FOAM_WIDTH: { label: 'Espuma (m)', range: [0, 1, 0.01] },
  WAVE_SIZE: { label: 'Tamanho das ondas (m)', range: [0.2, 10, 0.1] },
  WAVE_SPEED: { label: 'Velocidade das ondas', range: [0, 2, 0.01] },
  WAVE_STRENGTH: { label: 'Força das ondas', range: [0, 2, 0.01] },
  REFLECTION: { label: 'Reflexo do céu', range: [0, 1, 0.01] },
}

const SHORE_WAVE_CONTROLS = {
  HEIGHT: { label: 'Altura (m)', range: [0, 1, 0.01] },
  SPEED: { label: 'Ondas por segundo', range: [0, 1.5, 0.01] },
  SIZE: { label: 'Trechos da margem (m)', range: [1, 60, 0.5] },
  DEPTH: { label: 'Até a profundidade (m)', range: [0.1, 3, 0.05] },
}
const RIPPLE_CONTROLS = {
  SIZE: { label: 'Tamanho (m)', range: [0.1, 2, 0.05] },
  OPACITY: { label: 'Opacidade', range: [0, 1, 0.01] },
  DURATION: { label: 'Duração (s)', range: [0.2, 3, 0.05] },
}

// Quanto cada bioma aceita de rio e de lago (`water`, 0 a 1).
const waterTuning = ({ water }) => ({
  rivers: water?.rivers ?? 0,
  lakes: water?.lakes ?? 0,
})

function applyWaterTuning(biome, tuning) {
  if (tuning.rivers === 0 && tuning.lakes === 0) delete biome.water
  else biome.water = { ...tuning }
}

// O que cada bioma tem de trilha (core/data/biomes/): se tem e a cor dela
// e da margem da água (a de longe — de perto vale a textura da área).
const trailTuning = ({ trails, palette }) => ({
  trails: trails === true,
  trail: palette.trail ?? palette.slope,
  shore: palette.shore,
})

function applyTrailTuning(biome, tuning) {
  biome.trails = tuning.trails
  biome.palette.trail = tuning.trail
  biome.palette.shore = tuning.shore
}

// Valores de quando o jogo carregou — o "Voltar ao inicial".
const INITIAL = {
  seed: GAME_CONFIG.WORLD.SEED,
  terrain: { ...GAME_CONFIG.TERRAIN },
  trails: { ...GAME_CONFIG.TRAILS },
  waterBodies: structuredClone(GAME_CONFIG.WATER_BODIES),
  water: structuredClone(GAME_CONFIG.WATER),
  biomeWaters: Object.fromEntries(
    listBiomes().map((biome) => [biome.id, waterTuning(biome)]),
  ),
  pebbles: GAME_CONFIG.PEBBLES.PER_M2,
  biomeGrounds: Object.fromEntries(
    listBiomes().map((biome) => [biome.id, groundTuning(biome)]),
  ),
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
    ...listBiomes()
      .filter(({ ground }) => ground.colors)
      .map(
        ({ id, ground }) =>
          `${id} (ground.colors): ${JSON.stringify(ground.colors)}`,
      ),
    `TRAILS: ${JSON.stringify(GAME_CONFIG.TRAILS, null, 2)}`,
    `PEBBLES.PER_M2: ${GAME_CONFIG.PEBBLES.PER_M2}`,
    `WATER_BODIES: ${JSON.stringify(GAME_CONFIG.WATER_BODIES, null, 2)}`,
    `WATER: ${JSON.stringify(GAME_CONFIG.WATER, null, 2)}`,
    ...listBiomes()
      .filter(({ water }) => water)
      .map(({ id, water }) => `${id} (water): ${JSON.stringify(water)}`),
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
 * verdade. "Texturas do chão" escolhe a textura de cada área de um
 * bioma (`ground.colors`, docs/features/052-assets-do-lgpe-e-floresta.md);
 * "Biomas no mundo" esconde biomas (`BIOMES.HIDDEN`) para olhar um só;
 * "Trilhas" (docs/features/049-vegetacao-e-floresta.md) ajusta a forma e o
 * relevo das trilhas, os seixos e a cor da trilha e da margem de cada
 * bioma; "Lagos e rios" (docs/features/057-lagos-e-rios.md), a forma deles
 * e quanto cada bioma aceita.
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

    // Texturas de um bioma por vez: trocar o escolhido refaz os controles.
    const groundFolder = gui.addFolder('Texturas do chão')
    const groundChoice = { id: listBiomes()[0].id }
    const groundTunings = Object.fromEntries(
      listBiomes().map((biome) => [biome.id, groundTuning(biome)]),
    )
    let groundControllers = []
    const showGroundBiome = () => {
      groundControllers.forEach((controller) => controller.destroy())
      const biome = BIOME_REGISTRY[groundChoice.id]
      const tuning = groundTunings[biome.id]
      groundControllers = Object.entries(GROUND_AREAS).map(([area, label]) =>
        groundFolder
          .add(tuning, area, GROUND_TEXTURE_OPTIONS)
          .name(label)
          .onChange(() => {
            applyGroundTuning(biome, tuning)
            regenerate()
          }),
      )
    }
    groundFolder
      .add(
        groundChoice,
        'id',
        Object.fromEntries(listBiomes().map(({ id, name }) => [name, id])),
      )
      .name('Bioma')
      .onChange(showGroundBiome)
    showGroundBiome()

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
        trailFolder.addColor(tuning, 'shore').name('Cor da margem'),
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
      biomeControllers = Object.entries(biomeControlsOf(biome)).map(
        ([key, { label, range }]) => {
          const target = biomeTarget(biome, key)
          // O lil-gui não cria controle para campo ausente: o opcional
          // (`ridges`) entra com 0, que é o mesmo relevo de sem ele.
          target[key] ??= 0
          return biomeFolder
            .add(target, key, ...range)
            .name(label)
            .onFinishChange(regenerate)
        },
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

    const waterFolder = gui.addFolder('Lagos e rios (refaz ao soltar)')
    const addWaterControls = (folder, target, controls) => {
      for (const [key, control] of Object.entries(controls)) {
        if (!control.label) {
          addWaterControls(
            folder.addFolder(key === 'RIVER' ? 'Rios' : 'Lagos'),
            target[key],
            control,
          )
          continue
        }
        folder
          .add(target, key, ...control.range)
          .name(control.label)
          .onFinishChange(regenerate)
      }
    }
    addWaterControls(waterFolder, GAME_CONFIG.WATER_BODIES, WATER_BODY_CONTROLS)
    // O desenho da água, na hora.
    const addLookControls = (folder, target, controls) => {
      for (const [key, control] of Object.entries(controls)) {
        let controller
        if (control.color) controller = folder.addColor(target, key)
        else controller = folder.add(target, key, ...control.range)
        controller.name(control.label)
        if (control.regenerate) controller.onFinishChange(regenerate)
      }
    }
    const lookFolder = gui.addFolder('Água (desenho)')
    addLookControls(lookFolder, GAME_CONFIG.WATER, WATER_CONTROLS)
    addLookControls(
      lookFolder.addFolder('Cores e ondas'),
      GAME_CONFIG.WATER,
      TOON_WATER_CONTROLS,
    )
    addLookControls(
      lookFolder.addFolder('Ondas na margem'),
      GAME_CONFIG.WATER.SHORE_WAVE,
      SHORE_WAVE_CONTROLS,
    )
    addLookControls(
      lookFolder.addFolder('Marolinha dos passos'),
      GAME_CONFIG.WATER.RIPPLE,
      RIPPLE_CONTROLS,
    )

    // Quanto cada bioma aceita, um por vez.
    const waterChoice = { id: listBiomes()[0].id }
    const waterTunings = Object.fromEntries(
      listBiomes().map((biome) => [biome.id, waterTuning(biome)]),
    )
    let waterControllers = []
    const showWaterBiome = () => {
      waterControllers.forEach((controller) => controller.destroy())
      const biome = BIOME_REGISTRY[waterChoice.id]
      const tuning = waterTunings[biome.id]
      const apply = () => {
        applyWaterTuning(biome, tuning)
        regenerate()
      }
      waterControllers = [
        waterFolder
          .add(tuning, 'rivers', 0, 1, 0.05)
          .name('Rios no bioma')
          .onFinishChange(apply),
        waterFolder
          .add(tuning, 'lakes', 0, 1, 0.05)
          .name('Lagos no bioma')
          .onFinishChange(apply),
      ]
    }
    waterFolder
      .add(
        waterChoice,
        'id',
        Object.fromEntries(listBiomes().map(({ id, name }) => [name, id])),
      )
      .name('Bioma')
      .onChange(showWaterBiome)
    showWaterBiome()

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
            Object.assign(GAME_CONFIG.TRAILS, INITIAL.trails)
            // No lugar: os controles do F2 apontam para `RIVER` e `LAKE`.
            const { RIVER, LAKE, ...waterRest } = INITIAL.waterBodies
            Object.assign(GAME_CONFIG.WATER_BODIES.RIVER, RIVER)
            Object.assign(GAME_CONFIG.WATER_BODIES.LAKE, LAKE)
            Object.assign(GAME_CONFIG.WATER_BODIES, waterRest)
            const { RIPPLE, SHORE_WAVE, ...waterLook } = INITIAL.water
            Object.assign(GAME_CONFIG.WATER.SHORE_WAVE, SHORE_WAVE)
            Object.assign(GAME_CONFIG.WATER.RIPPLE, RIPPLE)
            Object.assign(GAME_CONFIG.WATER, waterLook)
            for (const biome of listBiomes()) {
              Object.assign(
                waterTunings[biome.id],
                INITIAL.biomeWaters[biome.id],
              )
              applyWaterTuning(biome, waterTunings[biome.id])
            }
            showWaterBiome()
            GAME_CONFIG.PEBBLES.PER_M2 = INITIAL.pebbles
            for (const biome of listBiomes()) {
              applyTrailTuning(biome, INITIAL.biomeTrails[biome.id])
            }
            showTrailBiome()
            for (const biome of listBiomes()) {
              Object.assign(
                groundTunings[biome.id],
                INITIAL.biomeGrounds[biome.id],
              )
              applyGroundTuning(biome, groundTunings[biome.id])
            }
            rebuildVegetation()
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
