import { describe, expect, it } from 'vitest'
import { setEatStage } from './itemEatStages'

const make = (n) => Array.from({ length: n }, () => ({ visible: true }))
const visibleIndexes = (stages) =>
  stages.flatMap((stage, i) => (stage.visible ? [i] : []))

describe('setEatStage', () => {
  it('um pedaço por vez: o primeiro no começo, o último no fim', () => {
    const stages = make(3)

    setEatStage(stages, 0)
    expect(visibleIndexes(stages)).toEqual([0])

    setEatStage(stages, 0.5)
    expect(visibleIndexes(stages)).toEqual([1])

    setEatStage(stages, 1)
    expect(visibleIndexes(stages)).toEqual([2])
  })

  it('sem pedaços, não faz nada', () => {
    expect(() => setEatStage(null, 0.5)).not.toThrow()
    expect(() => setEatStage([], 0.5)).not.toThrow()
  })
})
