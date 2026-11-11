import { describe, expect, it } from 'vitest'
import { BIOME_REGISTRY, getBiome, listBiomes } from '../data/biomes'
import { listSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { createRng } from '../rng'
import { loadedFogRange } from '../terrain/fogRange'
import {
  despawnBand,
  despawnChanceByAge,
  despawnReason,
  isOutOfView,
  listSpawnCandidates,
  nearestDistance,
  pickSpawnSpecies,
  rollRarity,
  rollSpawnPoint,
  spawnParams,
  spawnWeightOf,
} from './wildSpawn'

// Spawn e despawn das selvagens (docs/features/062-spawn-estilo-
// cobblemon.md). Espécies e biomas só como dado de teste: as regras valem
// para qualquer um.

const params = spawnParams()
const WILD_SPECIES = listSpecies().filter((species) => species.spawn)
const [SPECIES] = WILD_SPECIES

// Um bioma que a espécie aceita (o primeiro da lista dela).
const homeOf = (species) => getBiome(species.spawn.biomes[0])

// Uma fase e um clima sem multiplicador nenhum da espécie.
const neutralContext = (species) => ({
  biome: homeOf(species),
  phase: ['dawn', 'day', 'dusk', 'night'].find(
    (phase) => species.spawn.phases?.[phase] == null,
  ),
  weather: ['clear', 'sun', 'rain', 'storm', 'snow'].find(
    (weather) => species.spawn.weather?.[weather] == null,
  ),
})

// Chão de teste: plano, seco, carregado e sem sólidos — cada teste estraga
// o que quer.
function flatGround(overrides = {}) {
  return {
    isLoadedAt: () => true,
    heightAt: () => params.WATER_LEVEL + 10,
    footprintsIn: () => [],
    ...overrides,
  }
}

describe('dados de spawn das espécies', () => {
  it('só espécies com `spawn` nascem; quem não tem nunca é candidata', () => {
    const withoutSpawn = listSpecies().filter((species) => !species.spawn)
    expect(withoutSpawn.length).toBeGreaterThan(0)
    for (const species of withoutSpawn) {
      for (const biome of listBiomes()) {
        expect(
          spawnWeightOf(species, { biome, phase: 'day', weather: 'clear' }),
        ).toBe(0)
      }
    }
  })

  it('cada espécie com `spawn` tem raridade conhecida e biomas que existem e aparecem', () => {
    expect(WILD_SPECIES.length).toBeGreaterThan(0)
    for (const species of WILD_SPECIES) {
      expect(params.RARITY_CHANCES[species.spawn.rarity]).toBeGreaterThan(0)
      for (const biomeId of species.spawn.biomes ?? []) {
        expect(BIOME_REGISTRY[biomeId]).toBeTruthy()
        expect(params.HIDDEN_BIOMES).not.toContain(biomeId)
      }
      expect(spawnWeightOf(species, neutralContext(species))).toBeGreaterThan(0)
    }
  })
})

describe('spawnWeightOf', () => {
  it('sem fase nem clima especial, todas da faixa pesam igual', () => {
    const weights = WILD_SPECIES.map((species) =>
      spawnWeightOf(species, neutralContext(species)),
    )
    expect(new Set(weights).size).toBe(1)
  })

  it('raridade desconhecida não nasce', () => {
    const species = { ...SPECIES, spawn: { ...SPECIES.spawn, rarity: 'nada' } }
    expect(spawnWeightOf(species, neutralContext(SPECIES))).toBe(0)
  })

  it('bioma que não casa, escondido ou cidade não recebe ninguém', () => {
    const context = neutralContext(SPECIES)
    const other = listBiomes().find(
      (biome) =>
        !SPECIES.spawn.biomes.includes(biome.id) &&
        !biome.tags?.some((tag) => SPECIES.spawn.tags?.includes(tag)),
    )
    expect(spawnWeightOf(SPECIES, { ...context, biome: other })).toBe(0)

    const hidden = { ...params, HIDDEN_BIOMES: [context.biome.id] }
    expect(spawnWeightOf(SPECIES, context, hidden)).toBe(0)

    const town = { ...context.biome, town: {} }
    expect(spawnWeightOf(SPECIES, { ...context, biome: town })).toBe(0)
  })

  it('casa pela tag do bioma', () => {
    const biome = listBiomes().find((candidate) => candidate.tags?.length)
    const species = {
      id: 'teste',
      spawn: { tags: [biome.tags[0]], rarity: SPECIES.spawn.rarity },
    }
    const weight = spawnWeightOf(
      species,
      {
        biome,
        phase: 'day',
        weather: 'clear',
      },
      { ...params, HIDDEN_BIOMES: [] },
    )
    expect(weight).toBeGreaterThan(0)
  })

  it('multiplicador zero da fase ou do clima tira a espécie; maior que um aumenta o peso', () => {
    const base = neutralContext(SPECIES)
    const species = {
      ...SPECIES,
      spawn: {
        ...SPECIES.spawn,
        phases: { [base.phase]: 0 },
        weather: { [base.weather]: 2 },
      },
    }
    expect(spawnWeightOf(species, base)).toBe(0)

    const boosted = { ...species, spawn: { ...species.spawn, phases: {} } }
    expect(spawnWeightOf(boosted, base)).toBeGreaterThan(
      spawnWeightOf(SPECIES, base),
    )
  })
})

describe('rollRarity', () => {
  it('sorteia só faixas da config, a de maior chance mais vezes', () => {
    const rng = createRng(5)
    const counts = {}
    for (let i = 0; i < 2000; i++) {
      const rarity = rollRarity(rng)
      counts[rarity] = (counts[rarity] ?? 0) + 1
    }
    const known = Object.keys(params.RARITY_CHANCES)
    expect(Object.keys(counts).every((rarity) => known.includes(rarity))).toBe(
      true,
    )
    const likeliest = known.reduce((best, rarity) =>
      params.RARITY_CHANCES[rarity] > params.RARITY_CHANCES[best]
        ? rarity
        : best,
    )
    const mostRolled = Object.keys(counts).reduce((best, rarity) =>
      counts[rarity] > counts[best] ? rarity : best,
    )
    expect(mostRolled).toBe(likeliest)
  })
})

describe('pickSpawnSpecies', () => {
  const rarities = Object.keys(params.RARITY_CHANCES)
  const byChance = [...rarities].sort(
    (a, b) => params.RARITY_CHANCES[b] - params.RARITY_CHANCES[a],
  )
  const [COMMONEST] = byChance
  const RAREST = byChance.at(-1)

  // Quantas de `tries` tentativas nascem alguém com só `candidates`.
  function hits(candidates, tries = 2000, seed = 11) {
    const rng = createRng(seed)
    let count = 0
    for (let i = 0; i < tries; i++) {
      if (pickSpawnSpecies(rng, candidates)) count++
    }
    return count
  }

  it('sem candidatos, ninguém', () => {
    expect(pickSpawnSpecies(createRng(1), [])).toBe(null)
  })

  it('sorteia só entre os candidatos (ou ninguém, se a faixa sair vazia)', () => {
    const rng = createRng(7)
    const candidates = listSpawnCandidates(
      WILD_SPECIES,
      neutralContext(SPECIES),
    )
    const ids = candidates.map(({ speciesId }) => speciesId)
    for (let i = 0; i < 50; i++) {
      const picked = pickSpawnSpecies(rng, candidates)
      if (picked) expect(ids).toContain(picked)
    }
  })

  it('a faixa vem antes: sozinha no lugar, a rara continua rara', () => {
    const rare = [{ speciesId: 'rara', rarity: RAREST, weight: 1 }]
    const common = [{ speciesId: 'comum', rarity: COMMONEST, weight: 1 }]
    expect(hits(rare)).toBeLessThan(hits(common))
    expect(hits(rare)).toBeLessThan(2000)
  })

  it('dentro da faixa, o mais pesado sai mais vezes', () => {
    const rng = createRng(3)
    const candidates = [
      { speciesId: 'leve', rarity: COMMONEST, weight: 1 },
      { speciesId: 'pesado', rarity: COMMONEST, weight: 9 },
    ]
    const counts = { leve: 0, pesado: 0 }
    for (let i = 0; i < 1000; i++) {
      const picked = pickSpawnSpecies(rng, candidates)
      if (picked) counts[picked]++
    }
    expect(counts.pesado).toBeGreaterThan(counts.leve)
  })
})

describe('isOutOfView', () => {
  // Câmera na origem olhando para -z (`yaw` 0).
  const view = { x: 0, z: 0, yaw: 0 }

  it('à frente e perto está à vista; atrás, não', () => {
    const near = params.VIEW_DISTANCE / 2
    expect(isOutOfView({ x: 0, z: -near }, view)).toBe(false)
    expect(isOutOfView({ x: 0, z: near }, view)).toBe(true)
  })

  it('à frente, além da distância de visão, está fora', () => {
    expect(isOutOfView({ x: 0, z: -params.VIEW_DISTANCE * 2 }, view)).toBe(true)
  })

  it('sem câmera, tudo está fora', () => {
    expect(isOutOfView({ x: 0, z: -1 }, null)).toBe(true)
  })
})

describe('rollSpawnPoint', () => {
  const view = { x: 0, z: 0, yaw: 0 }
  const viewers = [{ x: 0, z: 0 }]

  function roll(ground, seed = 1, tries = 200) {
    const rng = createRng(seed)
    const points = []
    for (let i = 0; i < tries; i++) {
      const point = rollSpawnPoint(rng, {
        center: view,
        viewers,
        view,
        ground,
      })
      if (point) points.push(point)
    }
    return points
  }

  it('o ponto fica no anel, longe de todos os pontos do jogador e fora da vista', () => {
    const points = roll(flatGround())
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) {
      const distance = nearestDistance(point, viewers)
      expect(distance).toBeGreaterThanOrEqual(params.MIN_RADIUS)
      expect(distance).toBeLessThanOrEqual(params.MAX_RADIUS + 1e-9)
      expect(isOutOfView(point, view)).toBe(true)
    }
  })

  it('andando, parte vai para a frente, logo além da névoa; parado, nenhum ponto na frente passa da névoa', () => {
    const heading = { x: 0, z: -1 }
    const rng = createRng(4)
    let ahead = 0
    for (let i = 0; i < 200; i++) {
      const point = rollSpawnPoint(rng, {
        center: view,
        viewers,
        view,
        ground: flatGround(),
        heading,
      })
      if (!point || point.z >= 0) continue
      const distance = nearestDistance(point, viewers)
      if (isOutOfView(point, view) && distance >= params.VIEW_DISTANCE) {
        expect(distance).toBeLessThanOrEqual(
          params.VIEW_DISTANCE + params.AHEAD_DEPTH + 1e-9,
        )
        ahead++
      }
    }
    expect(ahead).toBeGreaterThan(0)

    // Parado, o anel não chega além da névoa: à frente, nada.
    const still = roll(flatGround()).filter((point) => point.z < 0)
    for (const point of still) expect(isOutOfView(point, view)).toBe(true)
  })

  it('nunca na água, fora dos chunks carregados, em encosta íngreme ou em cima de sólido', () => {
    const wet = flatGround({ heightAt: () => params.WATER_LEVEL - 1 })
    const unloaded = flatGround({ isLoadedAt: () => false })
    const steep = flatGround({ heightAt: (x) => x * params.MAX_SLOPE * 2 })
    const covered = flatGround({
      footprintsIn: (minX, maxX, minZ, maxZ) => [
        { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, radius: 1 },
      ],
    })
    for (const ground of [wet, unloaded, steep, covered]) {
      expect(roll(ground)).toEqual([])
    }
  })
})

describe('despawn', () => {
  const near = params.NEAR_RADIUS / 2
  const mid = (params.NEAR_RADIUS + params.FAR_RADIUS) / 2
  const far = params.FAR_RADIUS * 2

  it('as três faixas pela distância', () => {
    expect(despawnBand(near)).toBe('near')
    expect(despawnBand(mid)).toBe('mid')
    expect(despawnBand(far)).toBe('far')
  })

  it('a chance pela idade cresce: nada antes da mínima, certeza na máxima', () => {
    expect(despawnChanceByAge(params.MIN_AGE / 2)).toBe(0)
    const middle = (params.MIN_AGE + params.MAX_AGE) / 2
    expect(despawnChanceByAge(middle)).toBeGreaterThan(0)
    expect(despawnChanceByAge(middle)).toBeLessThan(1)
    expect(despawnChanceByAge(params.MAX_AGE)).toBe(1)
  })

  it('perto nunca some, nem velha e fora da vista', () => {
    const state = { distance: near, age: params.MAX_AGE, outOfView: true }
    expect(despawnReason(state, 0)).toBe(null)
  })

  it('longe sempre some, mesmo nova e à vista', () => {
    const state = { distance: far, age: 0, outOfView: false }
    expect(despawnReason(state, 1)).toBe('far')
  })

  it('no meio, só a velha e fora da vista', () => {
    const old = { distance: mid, age: params.MAX_AGE, outOfView: true }
    expect(despawnReason(old, 0.99)).toBe('aged')
    expect(despawnReason({ ...old, outOfView: false }, 0)).toBe(null)
    expect(despawnReason({ ...old, age: 0 }, 0)).toBe(null)
  })

  it('protegida (captura em andamento) nunca some', () => {
    const state = { distance: far, age: params.MAX_AGE, outOfView: true }
    expect(despawnReason({ ...state, isProtected: true }, 0)).toBe(null)
  })
})

describe('config', () => {
  it('a distância de visão é onde a névoa da tela fecha', () => {
    expect(params.VIEW_DISTANCE).toBe(
      loadedFogRange(GAME_CONFIG.TERRAIN.CHUNK_SIZE).far,
    )
  })

  // Em toda distância de visão que o menu oferece.
  const { MIN, MAX } = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE
  const everyDistance = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i)

  it('quem nasce na frente, além da névoa, não some logo pelo longe', () => {
    for (const radius of everyDistance) {
      const at = spawnParams(radius)
      expect(at.VIEW_DISTANCE + at.AHEAD_DEPTH).toBeLessThan(at.FAR_RADIUS)
    }
  })

  it('o raio longe fica dentro do raio de carga dos chunks', () => {
    const { CHUNK_SIZE } = GAME_CONFIG.TERRAIN
    for (const radius of everyDistance) {
      expect(spawnParams(radius).FAR_RADIUS).toBeLessThan(radius * CHUNK_SIZE)
    }
  })

  it('a distância de visão e o raio longe acompanham o raio carregado', () => {
    expect(spawnParams(MAX).VIEW_DISTANCE).toBeGreaterThan(
      spawnParams(MIN).VIEW_DISTANCE,
    )
    expect(spawnParams(MAX).FAR_RADIUS).toBeGreaterThan(
      spawnParams(MIN).FAR_RADIUS,
    )
  })

  it('o anel do spawn cabe antes da faixa longe do despawn', () => {
    for (const radius of everyDistance) {
      const at = spawnParams(radius)
      expect(at.MIN_RADIUS).toBeLessThan(at.MAX_RADIUS)
      expect(at.MAX_RADIUS).toBeLessThan(at.FAR_RADIUS)
      expect(at.NEAR_RADIUS).toBeLessThan(at.FAR_RADIUS)
    }
  })
})
