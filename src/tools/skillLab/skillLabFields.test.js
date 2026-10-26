import { describe, expect, it } from 'vitest'
import { getCondition } from '@/core/data/conditions'
import {
  EFFECT_FIELDS,
  createEffect,
  readEffectField,
  resolveEffectField,
  writeEffectField,
} from './skillLabFields'

describe('campos de efeito do laboratório', () => {
  it('efeito novo só com os campos obrigatórios', () => {
    for (const type of Object.keys(EFFECT_FIELDS)) {
      const effect = createEffect(type)
      for (const field of EFFECT_FIELDS[type]) {
        expect(readEffectField(effect, field.key) !== undefined).toBe(
          !field.optional,
        )
      }
    }
  })

  it('campo aninhado: escreve sem perder o resto e lê de volta', () => {
    const effect = {
      type: 'condition',
      condition: 'burn',
      tick: { interval: 1 },
    }
    const next = writeEffectField(effect, 'tick.fraction', 0.5)
    expect(next.tick).toEqual({ interval: 1, fraction: 0.5 })
    expect(effect.tick).toEqual({ interval: 1 })
    expect(readEffectField(next, 'tick.fraction')).toBe(0.5)
  })

  it('campo ausente mostra o valor da condição', () => {
    const effect = createEffect('condition')
    const condition = getCondition(effect.condition)
    expect(resolveEffectField(effect, 'duration')).toBe(condition.duration)
    expect(resolveEffectField(effect, 'chance')).toBe(1)
  })
})
