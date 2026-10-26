import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { createEventQueue, EVENT_TYPES } from '../events'
import { listSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import { getCondition, listConditions } from '../data/conditions'
import { Conditions, WildCreature } from '../traits'
import { listSkills } from '../data/skills'
import { readStatStages } from './statStages'
import { readCondition } from '../actions/conditions'
import { applySecondaryEffects, applySelfEffects } from './attackStatusEffects'

// Chance 1: o sorteio sempre passa (o `gameplayRng` devolve [0, 1)).
const SURE_BURN = { type: 'condition', condition: 'burn', chance: 1 }
const IMMUNE_TYPES = getCondition('burn').immuneTypes
const ATTACK = { id: 'teste', damage: { power: 40 }, effects: [SURE_BURN] }

const vulnerable = listSpecies().find(
  (species) =>
    species.kind === 'pokemon' &&
    !resolveSpeciesTypes(species).some((type) => IMMUNE_TYPES.includes(type)),
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

    expect(readCondition(target.entity, 'burn')).not.toBe(null)
    const emitted = events.drain()
    const applied = emitted.find(
      (event) => event.type === EVENT_TYPES.CONDITION_APPLIED,
    )
    expect(applied).toMatchObject({ condition: 'burn', attackId: ATTACK.id })
    const types = emitted.map((event) => event.type)
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
    expect(readCondition(target.entity, 'burn')).toBe(null)
    expect(events.drain()).toEqual([])
  })
})

describe('applySelfEffects', () => {
  it('golpe em si mesmo aplica a condição em quem usa', () => {
    const good = listConditions().find((condition) => condition.beneficial)
    const { entity } = setup()
    const attack = {
      id: 'teste-si',
      effects: [{ type: 'condition', condition: good.id }],
    }
    events.beginStep()
    applySelfEffects(events, { entity, attack })
    expect(readCondition(entity, good.id)).not.toBe(null)
    const applied = events
      .drain()
      .find((event) => event.type === EVENT_TYPES.CONDITION_APPLIED)
    expect(applied).toMatchObject({ target: entity, source: entity })
  })
})

describe('selfEffects — o que um golpe de dano dá a quem usa', () => {
  // O golpe de dano que sobe atributo e solta de condições (o Rapid Spin),
  // sem fixar qual.
  const attack = listSkills().find((skill) =>
    skill.selfEffects?.some((effect) => effect.type === 'removeConditions'),
  )
  const stage = attack.selfEffects.find((effect) => effect.type === 'statStage')
  const removes = attack.selfEffects.find(
    (effect) => effect.type === 'removeConditions',
  ).conditions

  it('sobe o atributo de quem usa', () => {
    const { entity } = setup()
    events.beginStep()
    applySelfEffects(events, {
      entity,
      attack,
      slot: 'secondary1',
      effects: attack.selfEffects,
    })
    expect(readStatStages(entity)[stage.stat]).toBe(stage.stages)
  })

  it('solta quem usa das condições listadas, e só delas', () => {
    const { entity } = setup()
    const kept = listConditions().find(
      (condition) => !removes.includes(condition.id) && !condition.interrupt,
    )
    entity.add(
      Conditions({
        list: [...removes, kept.id].map((id) => ({
          id,
          timeLeft: 5,
          modifiers: {},
        })),
      }),
    )
    applySelfEffects(events, {
      entity,
      attack,
      slot: 'secondary1',
      effects: attack.selfEffects,
    })
    for (const id of removes) expect(readCondition(entity, id)).toBeNull()
    expect(readCondition(entity, kept.id)).not.toBeNull()
  })
})
