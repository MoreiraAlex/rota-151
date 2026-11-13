import { describe, expect, it } from 'vitest'
import { listBiomes } from '../data/biomes'
import { listSpecies } from '../data/species'
import { verticalClearance } from '../physics/capsule'
import { wadeLimit } from '../terrain/water'
import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { GAME_CONFIG } from '../gameConfig'
import { fountainAt, fountainsOfChunk, fountainWaterOf } from './fountains'

const CITY = listBiomes().find(({ town }) => town?.plaza?.water)
const town = CITY?.town

// A fonte como a planta da cidade põe (o `y` já afundado).
const fountain = (x, z, ground = 3) => ({
  kind: 'street-prop',
  model: town.props.fountain,
  biome: CITY.id,
  x,
  y: ground - town.plaza.fountainSink,
  z,
  yaw: 0,
  scale: town.propScale * town.plaza.fountainScale,
})

describe.runIf(CITY)('fountainWaterOf', () => {
  it('a água fica a `depth` acima do chão, no raio de dentro da bacia', () => {
    const building = fountain(5, -2, 4)
    const water = fountainWaterOf(building)
    expect(water.surface).toBeCloseTo(4 + town.plaza.water.depth)
    expect(water.radius).toBeCloseTo(town.plaza.water.radius * building.scale)
    // Dentro da borda (a parede de dentro do anel que colide).
    const ring = LGPE_COLLIDERS[town.props.fountain].ring
    expect(water.radius).toBeLessThanOrEqual(ring.outer * building.scale)
  })

  it('outro objeto da cidade não tem água', () => {
    expect(
      fountainWaterOf({ ...fountain(0, 0), model: town.props.bench }),
    ).toBe(null)
  })
})

describe.runIf(CITY)('a fonte nos dados', () => {
  it('a borda que sobra acima do chão cabe no degrau (qualquer um entra)', () => {
    const { ring } = LGPE_COLLIDERS[town.props.fountain]
    const scale = town.propScale * town.plaza.fountainScale
    const aboveGround = ring.height * scale - town.plaza.fountainSink
    expect(aboveGround).toBeLessThanOrEqual(
      GAME_CONFIG.PHYSICS.CHARACTER.AUTOSTEP_HEIGHT,
    )
  })

  it('a água é rasa: todo Pokémon entra andando (nem o menor fica de fora)', () => {
    for (const species of listSpecies()) {
      const height = verticalClearance(species.body) * 2
      expect(town.plaza.water.depth).toBeLessThan(wadeLimit(height))
    }
  })
})

describe.runIf(CITY)('fountainsOfChunk e fountainAt', () => {
  const chunk = {
    solids: {
      buildings: [fountain(0, 0), { ...fountain(9, 9), model: 'bench' }],
    },
  }

  it('só as fontes do chunk, a mesma lista a cada pergunta', () => {
    const list = fountainsOfChunk(chunk)
    expect(list).toHaveLength(1)
    expect(fountainsOfChunk(chunk)).toBe(list)
    expect(fountainsOfChunk({})).toEqual([])
  })

  it('acha a fonte só dentro do raio da água', () => {
    const [water] = fountainsOfChunk(chunk)
    expect(fountainAt([water], 0, 0)).toBe(water)
    expect(fountainAt([water], water.radius * 0.9, 0)).toBe(water)
    expect(fountainAt([water], water.radius * 1.1, 0)).toBeNull()
  })
})
