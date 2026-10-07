import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { createEventQueue, EVENT_TYPES } from '../events'
import { listSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import { Burn, WildCreature } from '../traits'
import { applySecondaryEffects } from './attackStatusEffects'

// Chance 1: o sorteio sempre passa (o `gameplayRng` devolve [0, 1)).
const SURE_BURN = {
  type: 'burn',
  chance: 1,
  fraction: 1 / 16,
  interval: 2,
  duration: 8,
  attackMultiplier: 0.5,
  immuneTypes: ['fire'],
}
const ATTACK = { id: 'teste', damage: { power: 40 }, effects: [SURE_BURN] }

const vulnerable = listSpecies().find(
  (species) =>
    species.kind === 'pokemon' &&
    !resolveSpeciesTypes(species).some((type) =>
      SURE_BURN.immuneTypes.includes(type),
    ),
)

const worlds = []
const events = createEventQueue()
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
  events.drain()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  const entity = world.spawn()
  const target = world.spawn(WildCreature({ speciesId: vulnerable.id }))
  return { entity, target: { entity: target } }
}

describe('applySecondaryEffects', () => {
  it('aplica o efeito no alvo e avisa, sem um segundo attackResolved', () => {
    const { entity, target } = setup()
    events.beginStep()
    applySecondaryEffects(events, { entity, attack: ATTACK, target })

    expect(target.entity.has(Burn)).toBe(true)
    const types = events.drain().map((event) => event.type)
    expect(types).toContain(EVENT_TYPES.BURN_APPLIED)
    expect(types).not.toContain(EVENT_TYPES.ATTACK_RESOLVED)
  })

  it('golpe sem efeitos não faz nada', () => {
    const { entity, target } = setup()
    events.beginStep()
    applySecondaryEffects(events, {
      entity,
      attack: { ...ATTACK, effects: undefined },
      target,
    })
    expect(target.entity.has(Burn)).toBe(false)
    expect(events.drain()).toEqual([])
  })
})
