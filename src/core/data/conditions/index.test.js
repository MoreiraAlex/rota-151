import { describe, expect, it } from 'vitest'
import { listSkills } from '../skills'
import { listTypes } from '../types'
import { CONDITION_TEMPLATE } from './_template'
import { getCondition, listConditions, resolveConditionEffect } from './index'

// Regras do registro de condições (docs/features/061-revisao-das-skills.md),
// sem fixar o conteúdo de nenhuma.
describe('registro de condições', () => {
  const typeIds = listTypes().map((type) => type.id)

  it.each(listConditions().map((condition) => [condition.id, condition]))(
    '%s tem todos os campos do molde, com tipos que existem',
    (_, condition) => {
      for (const key of Object.keys(CONDITION_TEMPLATE)) {
        expect(condition).toHaveProperty(key)
      }
      for (const type of condition.immuneTypes) {
        expect(typeIds).toContain(type)
      }
      if (condition.tick) {
        expect(condition.tick.interval).toBeGreaterThan(0)
        expect([null, 'source']).toContain(condition.tick.to)
      }
    },
  )

  it('todo efeito de condição dos golpes aponta pra uma condição do registro', () => {
    for (const skill of listSkills()) {
      for (const effect of skill.effects ?? []) {
        if (effect.type !== 'condition') continue
        expect(getCondition(effect.condition)).not.toBe(null)
      }
    }
  })
})

describe('resolveConditionEffect', () => {
  const [condition] = listConditions().filter((item) => item.tick)

  it('sem nada no efeito: os valores da condição, com chance cheia', () => {
    const resolved = resolveConditionEffect({
      type: 'condition',
      condition: condition.id,
    })
    expect(resolved).toMatchObject({
      id: condition.id,
      duration: condition.duration,
      tick: condition.tick,
      modifiers: condition.modifiers,
      chance: 1,
    })
  })

  it('o golpe troca duração e o tick campo a campo', () => {
    const interval = condition.tick.interval * 2
    const resolved = resolveConditionEffect({
      type: 'condition',
      condition: condition.id,
      duration: condition.duration + 1,
      tick: { interval },
      modifiers: { defense: 2 },
    })
    expect(resolved.duration).toBe(condition.duration + 1)
    expect(resolved.tick).toEqual({ ...condition.tick, interval })
    expect(resolved.modifiers).toEqual({ ...condition.modifiers, defense: 2 })
  })

  it('efeito de outro tipo ou condição desconhecida: null', () => {
    expect(resolveConditionEffect({ type: 'statStage' })).toBe(null)
    expect(
      resolveConditionEffect({ type: 'condition', condition: 'nada' }),
    ).toBe(null)
  })
})
