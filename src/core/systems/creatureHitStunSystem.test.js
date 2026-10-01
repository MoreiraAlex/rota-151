import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { ActionState, SummonedCreature, Velocity } from '../traits'
import { getSpecies } from '../data/species'
import { resolveHitStunDuration } from '../actions/hitStun'
import { creatureHitStunSystem } from './creatureHitStunSystem'

describe('creatureHitStunSystem', () => {
  let world
  afterEach(() => world?.destroy())

  function setup(current = 'hit') {
    world = createWorld()
    return world.spawn(
      ActionState({ current, elapsed: 0 }),
      Velocity({ x: 3, y: 0, z: 2 }),
      SummonedCreature({ slot: 'slot1', speciesId: 'bulbasaur' }),
    )
  }

  it('fica parada enquanto dura e a ação acaba ao fim da duração da espécie', () => {
    const creature = setup()
    const duration = resolveHitStunDuration(getSpecies('bulbasaur'))

    creatureHitStunSystem({ world, delta: duration / 2 })
    expect(creature.get(ActionState).current).toBe('hit')
    expect(creature.get(Velocity)).toMatchObject({ x: 0, z: 0 })

    creatureHitStunSystem({ world, delta: duration / 2 + 0.01 })
    expect(creature.get(ActionState).current).toBeNull()
  })

  it('não mexe em quem não está atordoada', () => {
    const creature = setup('attack')

    creatureHitStunSystem({ world, delta: 1 })

    expect(creature.get(ActionState)).toMatchObject({
      current: 'attack',
      elapsed: 0,
    })
    expect(creature.get(Velocity).x).toBe(3)
  })
})
