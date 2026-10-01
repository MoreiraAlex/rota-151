import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '@/core/gameConfig'
import { Party, SummonedCreature, WildCreature } from '@/core/traits'
import {
  FEEDBACK_KINDS,
  resolveFeedbackColor,
  resolveSide,
} from './feedbackColors'

const { OPPONENT, ALLY } = GAME_CONFIG.FEEDBACK.FEEDBACK_COLORS

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})
function spawn(...traits) {
  const world = createWorld()
  worlds.push(world)
  return world.spawn(...traits)
}

describe('resolveSide', () => {
  it('o treinador (Party) e as criaturas do time (SummonedCreature) são aliados', () => {
    expect(resolveSide(spawn(Party))).toBe('ally')
    expect(
      resolveSide(
        spawn(SummonedCreature({ slot: 'slot1', speciesId: 'charmander' })),
      ),
    ).toBe('ally')
  })

  it('selvagens são oponentes', () => {
    expect(resolveSide(spawn(WildCreature({ speciesId: 'charmander' })))).toBe(
      'opponent',
    )
  })

  it('o que não é do jogador conta como oponente, e valores que nem são entidade não quebram', () => {
    expect(resolveSide(spawn())).toBe('opponent')
    expect(resolveSide('alvo')).toBe('opponent')
    expect(resolveSide(null)).toBe('opponent')
    expect(resolveSide(undefined)).toBe('opponent')
  })
})

describe('resolveFeedbackColor', () => {
  it('lê a paleta da config: dano, status negativo e positivo, por lado', () => {
    expect(resolveFeedbackColor('damage', 'opponent')).toBe(OPPONENT.DAMAGE)
    expect(resolveFeedbackColor('debuff', 'opponent')).toBe(OPPONENT.DEBUFF)
    expect(resolveFeedbackColor('buff', 'opponent')).toBe(OPPONENT.BUFF)
    expect(resolveFeedbackColor('crit', 'opponent')).toBe(OPPONENT.CRIT)
    expect(resolveFeedbackColor('crit', 'ally')).toBe(ALLY.CRIT)
    expect(resolveFeedbackColor('damage', 'ally')).toBe(ALLY.DAMAGE)
    expect(resolveFeedbackColor('debuff', 'ally')).toBe(ALLY.DEBUFF)
    expect(resolveFeedbackColor('buff', 'ally')).toBe(ALLY.BUFF)
  })

  it('o oponente usa vermelho / laranja / verde como o pedido original', () => {
    expect(OPPONENT.DAMAGE).toBe('#ff3b30')
    expect(OPPONENT.DEBUFF).toBe('#ff9f0a')
    expect(OPPONENT.BUFF).toBe('#32d74b')
  })

  it('aliado e oponente têm cores DIFERENTES em todo tipo (dá pra distinguir o lado)', () => {
    for (const kind of FEEDBACK_KINDS) {
      expect(resolveFeedbackColor(kind, 'ally'), kind).not.toBe(
        resolveFeedbackColor(kind, 'opponent'),
      )
    }
  })

  it('os tipos de um mesmo lado também diferem entre si', () => {
    for (const side of ['ally', 'opponent']) {
      const colors = FEEDBACK_KINDS.map((kind) =>
        resolveFeedbackColor(kind, side),
      )
      expect(new Set(colors).size, side).toBe(FEEDBACK_KINDS.length)
    }
  })

  it('tipo desconhecido cai na cor de dano; todas as cores são #rrggbb', () => {
    expect(resolveFeedbackColor('outro', 'opponent')).toBe(OPPONENT.DAMAGE)
    for (const palette of [OPPONENT, ALLY]) {
      for (const color of Object.values(palette)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})
