import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listSkills } from '@/core/data/skills'
import { listItems } from '@/core/data/items'
import { buildWikiData } from './wikiData'
import { listWikiSpecies } from './speciesEntry'

/** Todo valor folha do objeto, com o caminho até ele. */
function leaves(value, path = 'data') {
  if (value === null || typeof value !== 'object') return [[path, value]]
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, `${path}.${key}`),
  )
}

describe('buildWikiData', () => {
  const data = buildWikiData()

  it('é um retrato simples: sobrevive a JSON sem perder nada', () => {
    expect(JSON.parse(JSON.stringify(data))).toEqual(data)
  })

  it('não tem valor indefinido nem número inválido', () => {
    for (const [path, value] of leaves(data)) {
      expect(value, path).not.toBeUndefined()
      if (typeof value === 'number') {
        expect(Number.isNaN(value), path).toBe(false)
      }
    }
  })

  it('traz toda criatura e todo golpe do jogo', () => {
    expect(data.species.map((entry) => entry.id)).toEqual(
      listWikiSpecies().map((entry) => entry.id),
    )
    expect(data.skills).toHaveLength(listSkills().length)
  })

  it('traz todo item do jogo, com o que cada categoria faz', () => {
    expect(data.items.map((item) => item.id).sort()).toEqual(
      listItems()
        .map((item) => item.id)
        .sort(),
    )
    for (const item of data.items) {
      if (item.category === 'consumable') expect(item.heal).toBeGreaterThan(0)
      if (item.category === 'berry') {
        expect(item.berryHeal).toBeGreaterThan(0)
        expect(item.berryDuration).toBeGreaterThan(0)
      }
      if (item.category === 'pokeball') {
        expect(item.captureMultiplier).toBeGreaterThan(0)
      }
    }
  })

  it('números de regra saem da config do jogo', () => {
    expect(data.battle.criticalChance).toBe(
      GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE,
    )
    expect(data.cost.divisor).toBe(GAME_CONFIG.ACTION_COST.COST_DIVISOR)
    expect(data.faint.minutes).toBe(GAME_CONFIG.FAINT.DURATION_MINUTES)
  })

  it('tabela de níveis de efeito vai de −limite a +limite, com o 0 neutro', () => {
    const { limit, rows } = data.stages
    expect(rows).toHaveLength(limit * 2 + 1)
    const neutral = rows.find((row) => row.stage === 0)
    expect(neutral.stat).toBe(1)
    expect(neutral.accuracy).toBe(1)
  })

  it('vida baixa: cheia não muda nada, e piora conforme a vida cai', () => {
    const [full, ...rest] = data.lowHp.rows
    expect(full.cost).toBe(1)
    expect(full.speed).toBe(1)
    for (const row of rest) {
      expect(row.cost).toBeGreaterThanOrEqual(1)
      expect(row.speed).toBeLessThanOrEqual(1)
    }
  })
})
