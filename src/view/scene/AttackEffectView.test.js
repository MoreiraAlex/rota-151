import { describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { AttackPath, Position, Rotation } from '@/core/traits'
import { resolveEffectRise } from './AttackEffectView'

describe('resolveEffectRise — o caminho do golpe no espaço do efeito', () => {
  it('Z local ao longo do golpe (criatura atrás, negativo) e altura relativa ao efeito', () => {
    const world = createWorld()
    const effectPos = { x: 3, y: 1, z: 0 }
    // golpe indo pra +X (yaw 90°), subindo
    const points = [
      { x: 0, y: 0.5, z: 0 },
      { x: 2, y: 0.8, z: 0 },
      { x: 4, y: 1.2, z: 0 },
    ]
    const effect = world.spawn(
      Position(effectPos),
      Rotation({ y: Math.PI / 2 }),
      AttackPath({ points }),
    )

    const rise = resolveEffectRise(effect)

    rise.forEach(([z, y], i) => {
      expect(z).toBeCloseTo(points[i].x - effectPos.x)
      expect(y).toBeCloseTo(points[i].y - effectPos.y)
    })
    world.destroy()
  })

  it('sem caminho (golpe em si mesmo), sem perfil', () => {
    const world = createWorld()
    const effect = world.spawn(Position, Rotation)
    expect(resolveEffectRise(effect)).toBeNull()
    world.destroy()
  })
})
