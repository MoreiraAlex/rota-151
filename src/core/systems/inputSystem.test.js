import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { HeldItem, InputState } from '@/core/traits'
import { inputSystem } from './inputSystem'

function run(input) {
  const { world, player } = makeWorld()
  inputSystem({ world, delta: 1 / 60, input })
  return player.get(InputState)
}

describe('inputSystem', () => {
  it('sem input, a intenção é zero', () => {
    const state = run({})
    expect(state.x).toBe(0)
    expect(state.z).toBe(0)
  })

  it('forward move em -z, right move em +x', () => {
    expect(run({ forward: true })).toMatchObject({ x: 0, z: -1 })
    expect(run({ right: true })).toMatchObject({ x: 1, z: 0 })
    expect(run({ back: true })).toMatchObject({ x: 0, z: 1 })
    expect(run({ left: true })).toMatchObject({ x: -1, z: 0 })
  })

  it('eixos opostos se cancelam', () => {
    expect(run({ forward: true, back: true })).toMatchObject({ x: 0, z: 0 })
  })

  it('diagonais são normalizadas (magnitude ≤ 1)', () => {
    const state = run({ forward: true, right: true })
    const magnitude = Math.hypot(state.x, state.z)
    expect(magnitude).toBeCloseTo(1)
    expect(state.x).toBeCloseTo(Math.SQRT1_2)
    expect(state.z).toBeCloseTo(-Math.SQRT1_2)
  })

  it('repassa o modificador de corrida (Shift)', () => {
    expect(run({ forward: true, run: true }).run).toBe(true)
    expect(run({ forward: true }).run).toBe(false)
  })
})

describe('inputSystem — bloqueio de ações no modo Scan', () => {
  it('segurando o botão direito com a pokédex equipada, corrida fica bloqueada', () => {
    const { world, player } = makeWorld()
    player.set(HeldItem, { itemId: 'pokedex' })

    const input = { forward: true, run: true, secondaryHeld: true }
    inputSystem({ world, delta: 1 / 60, input })

    expect(player.get(InputState).run).toBe(false)
  })

  it('segurando o botão direito com a pokédex equipada, zera pulo/dash/Q/E/R no input', () => {
    const { world, player } = makeWorld()
    player.set(HeldItem, { itemId: 'pokedex' })

    const input = {
      secondaryHeld: true,
      jump: true,
      dash: true,
      secondary1: true,
      secondary2: true,
      secondary3: true,
    }
    inputSystem({ world, delta: 1 / 60, input })

    expect(input.jump).toBe(false)
    expect(input.dash).toBe(false)
    expect(input.secondary1).toBe(false)
    expect(input.secondary2).toBe(false)
    expect(input.secondary3).toBe(false)
  })

  it('andar continua funcionando no modo Scan', () => {
    const { world, player } = makeWorld()
    player.set(HeldItem, { itemId: 'pokedex' })

    const input = { forward: true, secondaryHeld: true }
    inputSystem({ world, delta: 1 / 60, input })

    expect(player.get(InputState)).toMatchObject({ x: 0, z: -1 })
  })

  it('clique esquerdo (confirmação do scan) não é bloqueado', () => {
    const { world, player } = makeWorld()
    player.set(HeldItem, { itemId: 'pokedex' })

    const input = { secondaryHeld: true, primary: true }
    inputSystem({ world, delta: 1 / 60, input })

    expect(input.primary).toBe(true)
  })

  it('sem item scanner equipado, segurar o botão direito não bloqueia nada', () => {
    const { world, player } = makeWorld()
    player.set(HeldItem, { itemId: 'pebble' })

    const input = { run: true, jump: true, secondaryHeld: true }
    inputSystem({ world, delta: 1 / 60, input })

    expect(player.get(InputState).run).toBe(true)
    expect(input.jump).toBe(true)
  })

  it('com a pokédex equipada mas SEM segurar o botão direito, nada é bloqueado', () => {
    const { world, player } = makeWorld()
    player.set(HeldItem, { itemId: 'pokedex' })

    const input = { run: true, jump: true }
    inputSystem({ world, delta: 1 / 60, input })

    expect(player.get(InputState).run).toBe(true)
    expect(input.jump).toBe(true)
  })
})
