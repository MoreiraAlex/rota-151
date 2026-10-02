import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '@/core/data/species'
import { ActionState, SummonedCreature, Velocity } from '@/core/traits'
import {
  creatureAppealSystem,
  resolveAppealActionState,
} from './creatureAppealSystem'

const DELTA = 1 / 60

describe('creatureAppealSystem', () => {
  let world

  afterEach(() => {
    world?.destroy()
  })

  it('espécie com actions.appeal nasce fazendo a apresentação, na velocidade 1/duration', () => {
    const { duration } = getSpecies('charmander').actions.appeal

    expect(resolveAppealActionState(getSpecies('charmander'))).toEqual({
      current: 'appeal',
      elapsed: 0,
      animationSpeed: 1 / duration,
    })
  })

  it('espécie sem actions.appeal nasce livre', () => {
    expect(resolveAppealActionState({ actions: {} })).toEqual({})
  })

  it('segura a criatura parada até o fim da duração, depois libera', () => {
    world = createWorld()
    const species = getSpecies('charmander')
    const creature = world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      ActionState(resolveAppealActionState(species)),
      Velocity({ x: 3, y: 0, z: 3 }),
    )

    creatureAppealSystem({ world, delta: DELTA })
    expect(creature.get(Velocity).x).toBe(0)
    expect(creature.get(ActionState).current).toBe('appeal')

    const ticks = Math.ceil(species.actions.appeal.duration / DELTA)
    for (let i = 0; i < ticks; i++)
      creatureAppealSystem({ world, delta: DELTA })

    expect(creature.get(ActionState).current).toBeNull()
  })

  it('não mexe em outra ação (ex.: ataque em andamento)', () => {
    world = createWorld()
    const creature = world.spawn(
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
      ActionState({ current: 'attack', elapsed: 0.1 }),
      Velocity({ x: 3, y: 0, z: 0 }),
    )

    creatureAppealSystem({ world, delta: DELTA })

    expect(creature.get(ActionState)).toMatchObject({
      current: 'attack',
      elapsed: 0.1,
    })
    expect(creature.get(Velocity).x).toBe(3)
  })
})
