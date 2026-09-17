import { describe, it, expect } from 'vitest'
import { pickRandomVariation } from './pickRandomVariation'

describe('pickRandomVariation', () => {
  it('com 1 variação só, sempre devolve ela mesma', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickRandomVariation(['unica'])).toBe('unica')
    }
  })

  it('sempre devolve um item que está de fato no array (qualquer tamanho)', () => {
    const variations = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    for (let i = 0; i < 100; i++) {
      expect(variations).toContain(pickRandomVariation(variations))
    }
  })

  it('com várias chamadas, cobre variações diferentes (não trava sempre no mesmo índice)', () => {
    const variations = ['a', 'b', 'c', 'd', 'e']
    const seen = new Set()
    for (let i = 0; i < 200; i++) {
      seen.add(pickRandomVariation(variations))
    }
    // Estatisticamente, 200 sorteios entre 5 itens vêem todos — não é o
    // objetivo provar uniformidade, só que não fica preso num item só.
    expect(seen.size).toBeGreaterThan(1)
  })
})
