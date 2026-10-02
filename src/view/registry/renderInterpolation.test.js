import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { Position, Rotation } from '@/core/traits'
import {
  captureRenderTransforms,
  resetRenderInterpolation,
  resolveRenderPosition,
  resolveRenderRotation,
  setRenderAlpha,
} from './renderInterpolation'

describe('renderInterpolation', () => {
  let world
  afterEach(() => {
    resetRenderInterpolation()
    world?.destroy()
  })

  it('desenha entre o passo anterior e o atual, pelo alpha', () => {
    world = createWorld()
    const entity = world.spawn(Position({ x: 0, y: 1, z: 0 }), Rotation)
    captureRenderTransforms(world)
    entity.set(Position, { x: 0.1, y: 1, z: -0.2 })

    setRenderAlpha(0.5)
    expect(resolveRenderPosition(entity)).toEqual({ x: 0.05, y: 1, z: -0.1 })
    setRenderAlpha(1)
    expect(resolveRenderPosition(entity)).toEqual({ x: 0.1, y: 1, z: -0.2 })
  })

  it('frame sem passo novo: anda com o alpha, sem degrau', () => {
    world = createWorld()
    const entity = world.spawn(Position({ x: 0, y: 0, z: 0 }), Rotation)
    captureRenderTransforms(world)
    entity.set(Position, { x: 1, y: 0, z: 0 })

    const xs = [0.25, 0.5, 0.75].map((a) => {
      setRenderAlpha(a)
      return resolveRenderPosition(entity).x
    })
    expect(xs).toEqual([0.25, 0.5, 0.75])
  })

  it('rotação pelo menor ângulo (passando por ±π)', () => {
    world = createWorld()
    const entity = world.spawn(Position, Rotation({ y: Math.PI - 0.1 }))
    captureRenderTransforms(world)
    entity.set(Rotation, { y: -Math.PI + 0.1 })

    setRenderAlpha(0.5)
    expect(Math.abs(resolveRenderRotation(entity).y)).toBeCloseTo(Math.PI)
  })

  it('sem captura (nasceu no último passo) usa o estado atual', () => {
    world = createWorld()
    captureRenderTransforms(world)
    const entity = world.spawn(Position({ x: 3, y: 0, z: 4 }), Rotation)

    setRenderAlpha(0)
    expect(resolveRenderPosition(entity)).toEqual({ x: 3, y: 0, z: 4 })
  })

  it('cada captura descarta a anterior (quem sumiu não fica guardado)', () => {
    world = createWorld()
    const entity = world.spawn(Position({ x: 0, y: 0, z: 0 }), Rotation)
    captureRenderTransforms(world)
    entity.set(Position, { x: 1, y: 0, z: 0 })
    captureRenderTransforms(world)
    entity.set(Position, { x: 2, y: 0, z: 0 })

    setRenderAlpha(0)
    expect(resolveRenderPosition(entity).x).toBe(1)
  })
})
