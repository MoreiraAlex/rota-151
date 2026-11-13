import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { getCityLayout } from '../data/cityLayouts'
import { GAME_CONFIG } from '../gameConfig'
import { deriveSeed } from '../rng'
import { createTerrainSampler } from '../terrain/terrainHeight'
import {
  chunkHeightAt,
  generateTerrainChunk,
  heightIndex,
} from '../terrain/terrainChunk'
import {
  CURB_REACH,
  chunkFixedTown,
  chunkTownBareOpen,
  chunkTownPaint,
  createFixedTown,
  distanceOutside,
  fixedTownGroundAt,
  fixedTownWaterDepthAt,
  fixedTownHeight,
  fixedTownSolidsIn,
  gateToward,
  isInsideFixedTown,
} from './fixedTown'
import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import {
  TREE_KIND,
  footprintOf,
  solidParams,
} from '../vegetation/solidPlacement'
import {
  DECOR_KIND,
  TRAINING_DUMMY_KIND,
  modelBoxOf,
  rectFootprints,
} from './townPlan'

// A primeira cidade fixa no mundo (docs/features/069-revisao-do-bioma-
// cidade.md — Viridian, montada à mão): regras do lugar, do relevo e dos
// objetos, com o layout e os números do jogo.
const PARAMS = GAME_CONFIG.CITIES.FIRST_TOWN
const TOWN_BIOME = listBiomes().find(({ town }) => town)
const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
const fixedTown =
  PARAMS.LAYOUT && TOWN_BIOME
    ? createFixedTown({
        params: PARAMS,
        townBiome: TOWN_BIOME,
        waterLevel: WATER_LEVEL,
      })
    : null

describe('createFixedTown', () => {
  it('sem layout, a primeira cidade é a procedural', () => {
    expect(
      createFixedTown({
        params: { ...PARAMS, LAYOUT: null },
        townBiome: TOWN_BIOME,
        waterLevel: WATER_LEVEL,
      }),
    ).toBeNull()
    expect(
      createFixedTown({ params: PARAMS, townBiome: null, waterLevel: 0 }),
    ).toBeNull()
  })
})

describe.runIf(fixedTown)('a cidade fixa', () => {
  const [minX, minZ, maxX, maxZ] = fixedTown?.rect ?? [0, 0, 0, 0]

  it('o tamanho é o dos prédios da cidade, sem um próprio', () => {
    const scale = PARAMS.SCALE ?? TOWN_BIOME.town.scale
    expect(fixedTown.place.scale).toBe(scale)
  })

  it('o raio cobre a área inteira', () => {
    for (const [x, z] of [
      [minX, minZ],
      [minX, maxZ],
      [maxX, minZ],
      [maxX, maxZ],
    ]) {
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(fixedTown.radius + 1e-9)
    }
  })

  it('além da faixa de mistura, a altura é a da seed', () => {
    const x = maxX + fixedTown.blend
    const z = (minZ + maxZ) / 2
    expect(fixedTownHeight(fixedTown, x, z, 12.5)).toBe(12.5)
  })

  it('a faixa de mistura vai da borda à seed sem degrau', () => {
    const z = (minZ + maxZ) / 2
    const natural = 30
    // Na borda, o chão do layout (com a ondulação da seed).
    const edge = fixedTownHeight(fixedTown, maxX, z, natural)
    let previous = edge
    const steps = 50
    const largestJump = (Math.abs(natural - edge) / steps) * 2
    for (let i = 1; i <= steps; i++) {
      const x = maxX + (fixedTown.blend * i) / steps
      const height = fixedTownHeight(fixedTown, x, z, natural)
      expect(Math.abs(height - previous)).toBeLessThanOrEqual(largestJump)
      previous = height
    }
    expect(previous).toBeCloseTo(natural, 6)
  })

  it('distância até a área: zero dentro, a do ponto mais perto fora', () => {
    expect(distanceOutside(fixedTown, (minX + maxX) / 2, minZ)).toBe(0)
    expect(distanceOutside(fixedTown, maxX + 3, maxZ + 4)).toBeCloseTo(5, 9)
  })

  it('as saídas ficam na borda, e a estrada sai pela que dá para o destino', () => {
    expect(fixedTown.gates.length).toBeGreaterThan(0)
    for (const gate of fixedTown.gates) {
      const onEdge =
        Math.min(
          Math.abs(gate.x - minX),
          Math.abs(gate.x - maxX),
          Math.abs(gate.z - minZ),
          Math.abs(gate.z - maxZ),
        ) < 1e-6
      expect(onEdge).toBe(true)
      // Bem longe na direção da saída: é ela.
      const far = 10000
      const length = Math.hypot(gate.x, gate.z)
      expect(
        gateToward(fixedTown, (gate.x / length) * far, (gate.z / length) * far),
      ).toEqual({ x: gate.x, z: gate.z })
    }
  })

  it('a área no chunk: um dentro dela, zero fora; nada longe', () => {
    const sampler = createTerrainSampler(
      deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain'),
    )
    const chunk = generateTerrainChunk(sampler, 0, 0)
    const area = chunkFixedTown(chunk, fixedTown)
    const step = chunk.size / chunk.resolution
    for (let ix = 0; ix <= chunk.resolution; ix += 7) {
      for (let iz = 0; iz <= chunk.resolution; iz += 7) {
        const x = chunk.minX + ix * step
        const z = chunk.minZ + iz * step
        expect(area[iz + ix * (chunk.resolution + 1)]).toBe(
          isInsideFixedTown(fixedTown, x, z) ? 1 : 0,
        )
      }
    }
    const far = generateTerrainChunk(sampler, 40, 40)
    expect(chunkFixedTown(far, fixedTown)).toBeNull()
  })
})

describe('a cidade montada à mão (o layout)', () => {
  const layoutTown = createFixedTown({
    params: { ...PARAMS, LAYOUT: 'viridian' },
    townBiome: TOWN_BIOME,
    waterLevel: WATER_LEVEL,
  })
  const groundLevel = WATER_LEVEL + TOWN_BIOME.relief.baseHeight
  const [minX, minZ, maxX, maxZ] = layoutTown.rect

  it('a primeira cidade do jogo é a montada à mão', () => {
    expect(layoutTown.layoutId).toBe('viridian')
    expect(fixedTown?.layoutId).toBe(PARAMS.LAYOUT)
  })

  it('o treinador nasce na origem, no chão da cidade da seed', () => {
    expect(layoutTown.spawn).toMatchObject({ x: 0, z: 0, y: groundLevel })
    expect(isInsideFixedTown(layoutTown, 0, 0)).toBe(true)
    expect(fixedTownGroundAt(layoutTown, 0, 0)).toBeCloseTo(groundLevel, 6)
  })

  it('a área é a grade do layout no tamanho da cidade', () => {
    const scale = PARAMS.SCALE ?? TOWN_BIOME.town.scale
    const { cols, rows } = layoutTown.layout
    expect(maxX - minX).toBeCloseTo(cols * scale, 6)
    expect(maxZ - minZ).toBeCloseTo(rows * scale, 6)
  })

  it('uma saída por vão do layout, na borda', () => {
    expect(layoutTown.gates).toHaveLength(layoutTown.layout.layout.exits.length)
    for (const gate of layoutTown.gates) {
      const onEdge =
        Math.min(
          Math.abs(gate.x - minX),
          Math.abs(gate.x - maxX),
          Math.abs(gate.z - minZ),
          Math.abs(gate.z - maxZ),
        ) < 1e-6
      expect(onEdge).toBe(true)
    }
  })

  it('dentro, o chão do layout acompanha de leve a seed (o topo do degrau)', () => {
    const tilt = layoutTown.ground.swell
    const ground = fixedTownGroundAt(layoutTown, 0, 0)
    for (const swell of [-2, 0, 2]) {
      expect(
        fixedTownHeight(layoutTown, 0, 0, groundLevel + swell),
      ).toBeCloseTo(ground + swell * tilt, 6)
    }
  })

  it('os objetos do layout ficam no mundo, no tamanho e no chão da cidade', () => {
    const { props } = layoutTown.layout.layout
    expect(layoutTown.buildings).toHaveLength(props.length)
    const { place } = layoutTown
    layoutTown.buildings.forEach((building, i) => {
      expect(building.model).toBe(props[i].model)
      expect(building.scale).toBeCloseTo(place.scale * (props[i].scale ?? 1), 9)
      expect(building.x).toBeCloseTo(place.x + props[i].x * place.scale, 6)
      expect(building.y).toBeCloseTo(
        place.y + (props[i].y ?? 0) * place.scale,
        6,
      )
    })
  })

  it('cada objeto cai num bloco de sólidos só', () => {
    const size = GAME_CONFIG.TERRAIN.SOLIDS_BLOCK_SIZE
    const cell = GAME_CONFIG.TOWN.FOOTPRINT_CELL
    let found = 0
    const reach = Math.ceil(layoutTown.radius / size) + 1
    for (let bx = -reach; bx <= reach; bx++) {
      for (let bz = -reach; bz <= reach; bz++) {
        const rect = [
          (bx - 0.5) * size,
          (bz - 0.5) * size,
          (bx + 0.5) * size,
          (bz + 0.5) * size,
        ]
        found += fixedTownSolidsIn(layoutTown, rect, cell).buildings.length
      }
    }
    expect(found).toBe(layoutTown.buildings.length + layoutTown.dummies.length)
  })

  // Os prédios do layout (os objetos com `kind` que não é enfeite).
  const layoutBuildings = () =>
    layoutTown.buildings.filter(({ kind }) => kind !== DECOR_KIND)

  it('os objetos do layout que colidem têm pegada (a caixa do modelo ou o círculo do tronco); os enfeites, não', () => {
    expect(layoutBuildings().length).toBeGreaterThan(0)
    const cell = GAME_CONFIG.TOWN.FOOTPRINT_CELL
    for (const building of layoutTown.buildings) {
      // Só ele na cidade (os vizinhos não entram na conta).
      const alone = { ...layoutTown, buildings: [building] }
      const rect = [
        building.x - 0.5,
        building.z - 0.5,
        building.x + 0.5,
        building.z + 0.5,
      ]
      const { footprints } = fixedTownSolidsIn(alone, rect, cell)
      if (building.kind === DECOR_KIND) {
        expect(footprints).toEqual([])
        continue
      }
      const collider = LGPE_COLLIDERS[building.model]
      expect(footprints).toEqual(
        collider.box
          ? rectFootprints(collider.box, building, cell)
          : [
              {
                x: building.x,
                z: building.z,
                radius: collider.reach * building.scale,
              },
            ],
      )
    }
  })

  it('com o relevo do bloco, o prédio assenta no chão: não flutua nem fica acima dele', () => {
    const cell = GAME_CONFIG.TOWN.FOOTPRINT_CELL
    // Um chão inclinado debaixo da cidade inteira.
    const resolution = 64
    const chunk = {
      minX: minX - 10,
      minZ: minZ - 10,
      size: Math.max(maxX - minX, maxZ - minZ) + 20,
      resolution,
      heights: new Float32Array((resolution + 1) ** 2),
    }
    const step = chunk.size / resolution
    for (let ix = 0; ix <= resolution; ix++) {
      for (let iz = 0; iz <= resolution; iz++) {
        chunk.heights[heightIndex(resolution, ix, iz)] =
          groundLevel + ix * step * 0.05 - iz * step * 0.03
      }
    }
    const rect = [
      chunk.minX,
      chunk.minZ,
      chunk.minX + chunk.size,
      chunk.minZ + chunk.size,
    ]
    const { buildings } = fixedTownSolidsIn(layoutTown, rect, cell, chunk)
    expect(buildings).toHaveLength(
      layoutTown.buildings.length + layoutTown.dummies.length,
    )
    // Os do layout e, depois deles, os bonecos (assentam como os prédios).
    const { props } = layoutTown.layout.layout
    buildings.forEach((building, i) => {
      expect(building).not.toHaveProperty('grounded')
      if (props[i]?.y != null) {
        expect(building.y).toBe(layoutTown.buildings[i].y)
        return
      }
      if (props[i]?.rest === 'center') {
        expect(building.y).toBeCloseTo(
          chunkHeightAt(chunk, building.x, building.z),
          9,
        )
        return
      }
      const under = [
        building,
        ...rectFootprints(modelBoxOf(building.model), building, cell),
      ].map(({ x, z }) => chunkHeightAt(chunk, x, z))
      for (const height of under) {
        expect(building.y).toBeLessThanOrEqual(height + 1e-9)
      }
      expect(Math.min(...under)).toBeCloseTo(building.y, 9)
    })
  })

  it('as células debaixo de cada prédio e de cada cerca ficam num nível só, fora do lago e da montanha', () => {
    const { cols, rows, levels, lake, mountainDepth } = layoutTown.layout
    const { props } = layoutTown.layout.layout
    // A célula `index` está debaixo de `[min, max]` num eixo: o meio dela
    // dentro; numa peça mais fina que a célula (a cerca), a da linha dela.
    const covers = (index, min, max) =>
      max - min < 1
        ? index === Math.floor((min + max) / 2)
        : index + 0.5 > min && index + 0.5 < max
    // As peças que não assentam pelo meio (as moitas afundam no barranco).
    const flat = props.filter(({ kind, rest }) => kind && rest !== 'center')
    for (const prop of flat) {
      // A caixa no chão girada (só de quarto em quarto de volta).
      const turned = Math.abs(Math.sin(prop.yaw ?? 0)) > 0.5
      const box = modelBoxOf(prop.model).map((v) => v * (prop.scale ?? 1))
      const [boxMinX, boxMinZ, boxMaxX, boxMaxZ] = turned
        ? [box[1], box[0], box[3], box[2]]
        : box
      const found = new Set()
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isUnder =
            covers(col, prop.x + boxMinX, prop.x + boxMaxX) &&
            covers(row, prop.z + boxMinZ, prop.z + boxMaxZ)
          if (!isUnder) continue
          const index = row * cols + col
          expect(lake[index]).toBe(0)
          expect(mountainDepth[index]).toBeLessThan(0)
          found.add(levels[index])
        }
      }
      expect(found.size).toBe(1)
    }
  })

  // O campo de treino do layout (o que a cidade original não tem): os
  // bonecos do campo das cidades procedurais (`town.trainingField`).
  const field = TOWN_BIOME.town.trainingField
  const spot = layoutTown.layout.layout.trainingField

  it('o campo de treino tem os bonecos do campo procedural, no tamanho e no giro dele', () => {
    expect(layoutTown.dummies).toHaveLength(field.columns * field.rows)
    for (const dummy of layoutTown.dummies) {
      expect(dummy.kind).toBe(TRAINING_DUMMY_KIND)
      expect(dummy.model).toBe(field.dummy)
      expect(dummy.scale).toBe(field.scale)
      expect(dummy.biome).toBe(TOWN_BIOME.id)
    }
    // Todos olham para o mesmo lado (a entrada), e o giro do modelo não
    // conta: a frente fica do lado da entrada, a partir do meio do campo.
    const yaws = new Set(layoutTown.dummies.map(({ yaw }) => yaw))
    expect(yaws.size).toBe(1)
    const front = layoutTown.dummies[0].yaw - (field.turn ?? 0)
    const { place } = layoutTown
    const center = {
      x: place.x + spot.x * place.scale,
      z: place.z + spot.z * place.scale,
    }
    const meanX =
      layoutTown.dummies.reduce((sum, { x }) => sum + x, 0) /
      layoutTown.dummies.length
    const meanZ =
      layoutTown.dummies.reduce((sum, { z }) => sum + z, 0) /
      layoutTown.dummies.length
    expect(meanX).toBeCloseTo(center.x, 6)
    expect(meanZ).toBeCloseTo(center.z, 6)
    const gate = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] }[
      spot.facing
    ]
    expect(Math.sin(front)).toBeCloseTo(gate[0], 9)
    expect(Math.cos(front)).toBeCloseTo(gate[1], 9)
  })

  it('os bonecos ficam a `spacing` m um do outro, sem encostar', () => {
    const { dummies } = layoutTown
    const reach = LGPE_COLLIDERS[field.dummy].reach * field.scale
    for (let i = 0; i < dummies.length; i++) {
      const gaps = dummies
        .filter((_, j) => j !== i)
        .map((other) =>
          Math.hypot(other.x - dummies[i].x, other.z - dummies[i].z),
        )
      expect(Math.min(...gaps)).toBeCloseTo(field.spacing, 6)
      expect(Math.min(...gaps)).toBeGreaterThan(2 * reach)
    }
  })

  it('o campo de treino fica dentro da cerca, num nível só, sem prédio, árvore nem gramado', () => {
    const { place } = layoutTown
    const { cols, levels, letters, letter } = layoutTown.layout
    const lawn = letters.indexOf(layoutTown.layout.layout.lawn)
    // A cerca do campo: as peças de cerca em volta do meio dele.
    const fences = layoutTown.layout.layout.props.filter(
      ({ model, x, z }) =>
        model.startsWith('viridian-fence') &&
        Math.abs(x - spot.x) < 6 &&
        Math.abs(z - spot.z) < 6,
    )
    const fenceMinX = Math.min(...fences.map(({ x }) => x))
    const fenceMaxX = Math.max(...fences.map(({ x }) => x))
    const fenceMinZ = Math.min(...fences.map(({ z }) => z))
    const fenceMaxZ = Math.max(...fences.map(({ z }) => z))
    const found = new Set()
    for (const dummy of layoutTown.dummies) {
      const x = (dummy.x - place.x) / place.scale
      const z = (dummy.z - place.z) / place.scale
      expect(x).toBeGreaterThan(fenceMinX)
      expect(x).toBeLessThan(fenceMaxX)
      expect(z).toBeGreaterThan(fenceMinZ)
      expect(z).toBeLessThan(fenceMaxZ)
      const index = Math.floor(z) * cols + Math.floor(x)
      found.add(levels[index])
      expect(letter[index]).not.toBe(lawn)
    }
    expect(found.size).toBe(1)
    // Nenhuma árvore do layout dentro da cerca.
    for (const tree of layoutTown.layout.layout.trees) {
      const inside =
        tree.x > fenceMinX &&
        tree.x < fenceMaxX &&
        tree.z > fenceMinZ &&
        tree.z < fenceMaxZ
      expect(inside).toBe(false)
    }
  })

  it('os bonecos entram nos sólidos do bloco como boneco de treino, com pegada', () => {
    const cell = GAME_CONFIG.TOWN.FOOTPRINT_CELL
    for (const dummy of layoutTown.dummies) {
      const alone = { ...layoutTown, buildings: [], dummies: [dummy] }
      const rect = [dummy.x - 0.5, dummy.z - 0.5, dummy.x + 0.5, dummy.z + 0.5]
      const { buildings, footprints } = fixedTownSolidsIn(alone, rect, cell)
      expect(buildings).toHaveLength(1)
      expect(buildings[0].kind).toBe(TRAINING_DUMMY_KIND)
      expect(footprints).toEqual(
        rectFootprints(LGPE_COLLIDERS[field.dummy].box, buildings[0], cell),
      )
    }
  })

  it('as árvores do layout são a folhosa do bioma da cidade, uma por ponto, no tamanho do ponto', () => {
    const { trees } = layoutTown.layout.layout
    expect(layoutTown.trees).toHaveLength(trees.length)
    const { place } = layoutTown
    layoutTown.trees.forEach((tree, i) => {
      expect(tree.kind).toBe(TREE_KIND)
      expect(tree.biome).toBe(TOWN_BIOME.id)
      expect(tree.x).toBeCloseTo(place.x + trees[i].x * place.scale, 6)
      expect(tree.z).toBeCloseTo(place.z + trees[i].z * place.scale, 6)
      expect(tree.variant).toBeGreaterThanOrEqual(0)
      expect(tree.variant).toBeLessThan(1)
    })
    // O tamanho segue o do ponto (a mata grande é maior).
    const sized = trees.map((t, i) => [t.scale ?? 1, layoutTown.trees[i].scale])
    for (const [a, b] of sized) {
      expect(b / a).toBeCloseTo(sized[0][1] / sized[0][0], 6)
    }
  })

  it('as árvores entram nos sólidos do bloco com a pegada e a base das do mundo', () => {
    const cell = GAME_CONFIG.TOWN.FOOTPRINT_CELL
    const params = solidParams()
    for (const tree of layoutTown.trees.slice(0, 5)) {
      const alone = { ...layoutTown, buildings: [], trees: [tree] }
      const rect = [tree.x - 0.5, tree.z - 0.5, tree.x + 0.5, tree.z + 0.5]
      const { trees, footprints } = fixedTownSolidsIn(alone, rect, cell)
      expect(trees).toHaveLength(1)
      expect(trees[0]).not.toHaveProperty('grounded')
      expect(footprints).toEqual(footprintOf(TREE_KIND, trees[0], params))
    }
  })

  it('a grama e as flores nascem só no gramado; o resto não nasce na cidade', () => {
    const sampler = createTerrainSampler(
      deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain'),
    )
    const chunk = generateTerrainChunk(sampler, 0, 0)
    const open = chunkTownBareOpen(chunk, layoutTown)
    expect(open.kinds).toEqual(PARAMS.GROWS)
    const area = chunkFixedTown(chunk, layoutTown)
    const { layout, cols, rows } = layoutTown.layout
    const { place } = layoutTown
    const step = chunk.size / chunk.resolution
    let lawn = 0
    let street = 0
    for (let ix = 0; ix <= chunk.resolution; ix++) {
      for (let iz = 0; iz <= chunk.resolution; iz++) {
        const index = iz + ix * (chunk.resolution + 1)
        const value = open.values[index]
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1 + 1e-6)
        if (area[index] <= 0) {
          expect(value).toBe(0)
          continue
        }
        // No meio de uma célula cercada pela mesma letra: 0 no gramado
        // (fora do lago), 1 no resto.
        const x = (chunk.minX + ix * step - place.x) / place.scale
        const z = (chunk.minZ + iz * step - place.z) / place.scale
        const col = Math.floor(x)
        const row = Math.floor(z)
        if (col < 1 || row < 1 || col >= cols - 1 || row >= rows - 1) continue
        const letter = layout.ground[row][col]
        const same = [-1, 0, 1].every((dr) =>
          [-1, 0, 1].every(
            (dc) => layout.ground[row + dr][col + dc] === letter,
          ),
        )
        if (!same || layout.rows[row][col] === '~') continue
        if (letter === layout.lawn) {
          expect(value).toBeCloseTo(0, 6)
          lawn += 1
        } else {
          expect(value).toBeCloseTo(1, 6)
          street += 1
        }
      }
    }
    expect(lawn).toBeGreaterThan(0)
    expect(street).toBeGreaterThan(0)
  })

  it('o lago: água no meio dele, a superfície menos o chão; fora, nenhuma', () => {
    // Viridian não tem mais lago: uma cópia dela com um, no chão da
    // cidade longe da chegada.
    const layout = getCityLayout('viridian')
    const row = layout.rows.findIndex((line) => line.includes('.....'))
    const col = layout.rows[row].indexOf('.....')
    const withLake = {
      ...layout,
      id: 'viridian-com-lago',
      rows: layout.rows.map((line, index) =>
        index === row || index === row + 1
          ? line.slice(0, col) + '~~~~~' + line.slice(col + 5)
          : line,
      ),
    }
    const lakeTown = createFixedTown({
      params: { ...PARAMS, LAYOUT: withLake },
      townBiome: TOWN_BIOME,
      waterLevel: WATER_LEVEL,
    })
    const { lake, ground } = lakeTown
    expect(lake).not.toBeNull()
    expect(lake.surface).toBeCloseTo(groundLevel - ground.lakeWater, 6)
    const x = (lake.rect[0] + lake.rect[2]) / 2
    const z = (lake.rect[1] + lake.rect[3]) / 2
    const bottom = groundLevel - ground.lakeDepth
    expect(fixedTownWaterDepthAt(lakeTown, x, z, bottom)).toBeCloseTo(
      ground.lakeDepth - ground.lakeWater,
      6,
    )
    expect(fixedTownWaterDepthAt(lakeTown, 0, 0, groundLevel)).toBe(-Infinity)
    expect(layoutTown.lake).toBeNull()
    expect(fixedTownWaterDepthAt(null, x, z, bottom)).toBe(-Infinity)
  })

  it('o desenho do chão no chunk: só dentro da cidade, pesos somando um', () => {
    const sampler = createTerrainSampler(
      deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain'),
    )
    const chunk = generateTerrainChunk(sampler, 0, 0)
    const paint = chunkTownPaint(chunk, layoutTown)
    expect(paint).not.toBeNull()
    const count = paint.layers.length
    for (let index = 0; index < paint.area.length; index += 13) {
      const sum = paint.weights
        .subarray(index * count, (index + 1) * count)
        .reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(paint.area[index] > 0 ? 1 : 0, 5)
    }
    expect(paint.cliffLayers.length).toBeGreaterThan(0)
    // A beira da rua: as camadas do layout e a distância dentro do alcance,
    // a rua e o lote aparecendo no chunk da chegada.
    const { layout } = layoutTown.layout
    expect(paint.curb.road).toBe(layout.paint.ground[layout.road])
    expect(paint.curb.soil).toBe(layout.paint.curb)
    let road = 0
    let lot = 0
    paint.curb.distance.forEach((distance, index) => {
      expect(Math.abs(distance)).toBeLessThanOrEqual(CURB_REACH + 1e-6)
      if (paint.area[index] <= 0) {
        expect(distance).toBe(CURB_REACH)
        return
      }
      if (distance < 0) road += 1
      else lot += 1
    })
    expect(road).toBeGreaterThan(0)
    expect(lot).toBeGreaterThan(0)
    expect(
      chunkTownPaint(generateTerrainChunk(sampler, 40, 40), layoutTown),
    ).toBeNull()
  })
})
