import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  IndividualValues,
  PhysicsBody,
  WanderState,
  WildCreature,
} from '@/core/traits'
import { wildCreatureSpawnSystem } from './wildCreatureSpawnSystem'

const STAT_KEYS = ['hp', 'attack', 'defense', 'sp_atk', 'sp_def', 'speed']

const spawnedWorlds = []
function spawnWorld() {
  const world = createWorld()
  spawnedWorlds.push(world)
  return world
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function tick(world) {
  wildCreatureSpawnSystem({ world })
}

describe('wildCreatureSpawnSystem', () => {
  it('spawna uma WildCreature por entrada de TEST_LEVEL.wildCreatures', () => {
    const world = spawnWorld()

    tick(world)

    const wild = world.query(WildCreature)
    expect(wild.length).toBe(TEST_LEVEL.wildCreatures.length)
  })

  it('sem física pronta (ambiente de teste), spawna mesmo assim com handles placeholder', () => {
    const world = spawnWorld()

    tick(world)

    for (const entity of world.query(WildCreature, PhysicsBody)) {
      const body = entity.get(PhysicsBody)
      expect(body.bodyHandle).toBe(-1)
      expect(body.colliderHandle).toBe(-1)
    }
  })

  it('idempotente — rodar de novo não duplica as criaturas', () => {
    const world = spawnWorld()

    tick(world)
    tick(world)
    tick(world)

    expect(world.query(WildCreature).length).toBe(
      TEST_LEVEL.wildCreatures.length,
    )
  })

  it('cada WildCreature nasce com WanderState centrado na própria posição de spawn', () => {
    const world = spawnWorld()

    tick(world)

    const entry = TEST_LEVEL.wildCreatures[0]
    const entity = world
      .query(WildCreature, WanderState)
      .find(
        (e) =>
          e.get(WanderState).homeX === entry.position[0] &&
          e.get(WanderState).homeZ === entry.position[2],
      )

    const wander = entity.get(WanderState)
    expect(wander.homeX).toBeCloseTo(entry.position[0])
    expect(wander.homeZ).toBeCloseTo(entry.position[2])
    expect(wander.targetX).toBeCloseTo(entry.position[0])
    expect(wander.targetZ).toBeCloseTo(entry.position[2])
    expect(wander.pauseTimer).toBeGreaterThan(0)
  })

  it('cada WildCreature nasce com seus próprios IVs, dentro do range configurado', () => {
    const world = spawnWorld()

    tick(world)

    const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
    for (const entity of world.query(WildCreature, IndividualValues)) {
      const iv = entity.get(IndividualValues)
      for (const key of STAT_KEYS) {
        expect(iv[key]).toBeGreaterThanOrEqual(IV_MIN)
        expect(iv[key]).toBeLessThanOrEqual(IV_MAX)
      }
    }
  })

  it('duas WildCreature da mesma espécie não têm necessariamente o mesmo IV', () => {
    const world = spawnWorld()

    tick(world)

    const ivSets = world
      .query(WildCreature, IndividualValues)
      .map((entity) => JSON.stringify(entity.get(IndividualValues)))

    // Sorteio independente por criatura — com várias criaturas spawnadas,
    // pelo menos um par deveria divergir (não é garantido matematicamente,
    // mas a chance de todas baterem exatamente é desprezível com o range
    // configurado e a quantidade de criaturas do nível de teste).
    expect(new Set(ivSets).size).toBeGreaterThan(1)
  })
})
