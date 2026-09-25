import { describe, expect, it } from 'vitest'
import { createDamageNumberPool } from './damageNumberPool'

const AT = { x: 1, y: 2, z: 3 }

describe('createDamageNumberPool', () => {
  it('spawn ativa um slot com o número e reinicia a idade', () => {
    const pool = createDamageNumberPool(3)
    const slot = pool.spawn({
      position: AT,
      text: '12',
      critical: true,
      lifetime: 1,
    })

    expect(slot).toMatchObject({
      active: true,
      age: 0,
      text: '12',
      critical: true,
      x: 1,
      y: 2,
      z: 3,
    })
  })

  it('advance envelhece e desativa no fim da vida', () => {
    const pool = createDamageNumberPool(3)
    const slot = pool.spawn({
      position: AT,
      text: '5',
      critical: false,
      lifetime: 1,
    })

    pool.advance(0.6)
    expect(slot.active).toBe(true)
    expect(slot.age).toBeCloseTo(0.6)
    pool.advance(0.5)
    expect(slot.active).toBe(false)
  })

  it('tamanho fixo: cheio, o próximo reaproveita o slot mais antigo', () => {
    const pool = createDamageNumberPool(2)
    const first = pool.spawn({
      position: AT,
      text: 'a',
      critical: false,
      lifetime: 9,
    })
    pool.spawn({ position: AT, text: 'b', critical: false, lifetime: 9 })
    const third = pool.spawn({
      position: AT,
      text: 'c',
      critical: false,
      lifetime: 9,
    })

    expect(pool.slots).toHaveLength(2)
    expect(third).toBe(first)
    expect(first.text).toBe('c')
  })

  it('serial muda a cada spawn, mesmo reaproveitando o slot', () => {
    const pool = createDamageNumberPool(1)
    const a = pool.spawn({
      position: AT,
      text: 'a',
      critical: false,
      lifetime: 1,
    }).serial
    const b = pool.spawn({
      position: AT,
      text: 'b',
      critical: false,
      lifetime: 1,
    }).serial

    expect(b).not.toBe(a)
  })
})
