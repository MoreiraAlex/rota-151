import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { changedValues, formatChangedValues, snapshotOf } from './labValues'

describe('"Copiar valores" do laboratório de biomas (066)', () => {
  it('sem mudança, não leva nada', () => {
    const before = snapshotOf(GAME_CONFIG)
    expect(changedValues(before, snapshotOf(GAME_CONFIG))).toEqual([])
    expect(formatChangedValues([])).toBe('')
  })

  it('leva só o campo que mudou, com o caminho até ele', () => {
    const before = snapshotOf(GAME_CONFIG)
    const after = snapshotOf(GAME_CONFIG)
    after.DAY_CYCLE.ADJUST.SUN = before.DAY_CYCLE.ADJUST.SUN + 0.5
    expect(changedValues(before, after)).toEqual([
      {
        path: ['DAY_CYCLE', 'ADJUST', 'SUN'],
        value: after.DAY_CYCLE.ADJUST.SUN,
      },
    ])
  })

  it('uma lista que mudou vai inteira', () => {
    const before = { biome: { models: ['a', 'b'] } }
    const after = { biome: { models: ['a', 'c'] } }
    expect(changedValues(before, after)).toEqual([
      { path: ['biome', 'models'], value: ['a', 'c'] },
    ])
  })

  it('campo novo e campo tirado também contam', () => {
    const changes = changedValues({ a: 1 }, { b: { color: '#fff' } })
    expect(changes.map(({ path }) => path.join('.')).sort()).toEqual(['a', 'b'])
  })

  it('o texto tem um valor por linha, no formato do config', () => {
    const text = formatChangedValues([
      { path: ['RENDER', 'GRADE', 'SATURATION'], value: 0.8 },
      { path: ['LGPE', 'SHADOW_TINT'], value: '#aabbcc' },
    ])
    expect(text.split('\n')).toEqual([
      'RENDER.GRADE.SATURATION: 0.8',
      'LGPE.SHADOW_TINT: "#aabbcc"',
    ])
  })

  it('a cópia não muda com o original', () => {
    const original = { a: { b: 1 } }
    const copy = snapshotOf(original)
    original.a.b = 2
    expect(copy.a.b).toBe(1)
  })
})
