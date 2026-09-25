import { describe, expect, it } from 'vitest'
import { attackResolved, createEventQueue, EVENT_TYPES } from './index'

describe('createEventQueue', () => {
  it('drain devolve os eventos na ordem de emissão e esvazia a fila', () => {
    const queue = createEventQueue()
    queue.emit({ type: 'a' })
    queue.emit({ type: 'b' })

    expect(queue.drain()).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(queue.drain()).toEqual([])
  })

  it('eventos emitidos depois de um drain ficam pro próximo', () => {
    const queue = createEventQueue()
    queue.emit({ type: 'a' })
    const first = queue.drain()
    queue.emit({ type: 'b' })

    expect(first).toEqual([{ type: 'a' }])
    expect(queue.drain()).toEqual([{ type: 'b' }])
  })
})

describe('attackResolved', () => {
  const base = {
    attacker: 1,
    attackId: 'scratch',
    slot: 'primary',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
  }

  it('com alvo: result hit', () => {
    const event = attackResolved({
      ...base,
      target: 2,
      contactPoint: { x: 0, y: 0, z: 0.8 },
      damage: 7,
    })

    expect(event).toMatchObject({
      type: EVENT_TYPES.ATTACK_RESOLVED,
      result: 'hit',
      target: 2,
      damage: 7,
    })
  })

  it('sem alvo: result miss, target/contactPoint null, dano 0 e sem crítico', () => {
    const event = attackResolved(base)

    expect(event).toMatchObject({
      result: 'miss',
      target: null,
      contactPoint: null,
      damage: 0,
      critical: false,
    })
  })

  it('leva o crítico adiante', () => {
    expect(
      attackResolved({ ...base, target: 2, critical: true }).critical,
    ).toBe(true)
  })
})
