import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { ActionState, Conditions, SummonedCreature, Velocity } from '../traits'
import { listConditions } from '../data/conditions'
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

  describe('atordoada por condição', () => {
    // Uma condição que atordoa (a paralisia), sem fixar qual.
    const stunning = listConditions().find((condition) => condition.stun)

    function stunWith(current) {
      const creature = setup(current)
      creature.add(
        Conditions({
          list: [{ id: stunning.id, timeLeft: 1, stun: true, modifiers: {} }],
        }),
      )
      return creature
    }

    it('existe uma condição que atordoa', () => {
      expect(stunning).toBeDefined()
    })

    it('interrompe o que estava fazendo e fica parada enquanto dura', () => {
      const creature = stunWith('attack')
      creatureHitStunSystem({ world, delta: 0.1 })
      expect(creature.get(ActionState).current).toBe('stunned')
      expect(creature.get(Velocity)).toMatchObject({ x: 0, z: 0 })
    })

    it('a condição acabou: volta a agir', () => {
      const creature = stunWith(null)
      creatureHitStunSystem({ world, delta: 0.1 })
      creature.set(Conditions, { list: [] })
      creatureHitStunSystem({ world, delta: 0.1 })
      expect(creature.get(ActionState).current).toBeNull()
    })
  })
})
