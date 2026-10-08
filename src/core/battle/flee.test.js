import { describe, expect, it, vi } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { findPath, isWalkableAt } from '../pathfinding'
import { resolveFleeDestination } from './flee'

// Física e navegação no nível plano de antes do relevo (as peças que estes
// testes usam) — ver `src/test/flatTestLevel.js`.
vi.mock('@/core/data/testLevel', async (importOriginal) => {
  const { withFlatTestLevel } = await import('@/test/flatTestLevel')
  return withFlatTestLevel(await importOriginal())
})

// No nível plano: muros em ±75 e a rocha `rock-1` em (30, 40), 2×2.
const { FLEE_STEP } = GAME_CONFIG.WILD_BEHAVIOR
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)

describe('isWalkableAt', () => {
  it('campo aberto sim; fora do mapa e dentro de obstáculo não', () => {
    expect(isWalkableAt(30, 30)).toBe(true)
    expect(isWalkableAt(90, 0)).toBe(false)
    expect(isWalkableAt(30, 40)).toBe(false)
  })
})

describe('resolveFleeDestination — fuga que não corre contra a parede', () => {
  it('campo aberto: pra longe de quem persegue', () => {
    const pos = { x: 30, z: 20 }
    const threat = { x: 30, z: 23 }
    const point = resolveFleeDestination(pos, threat)

    expect(point.z).toBeLessThan(pos.z)
    expect(distance(point, threat)).toBeCloseTo(3 + FLEE_STEP, 0)
  })

  it('encostada na parede com quem persegue do outro lado: escapa ao longo dela', () => {
    const pos = { x: 72, z: 0 }
    const threat = { x: 66, z: 0 }
    // Reto pra longe cairia em x = 78, fora do mapa.
    const point = resolveFleeDestination(pos, threat)

    expect(isWalkableAt(point.x, point.z)).toBe(true)
    expect(point.x).toBeLessThan(75)
    expect(distance(point, threat)).toBeGreaterThan(distance(pos, threat))
  })

  it('no canto: escolhe um ponto andável, não fora do mapa', () => {
    const pos = { x: 72, z: 72 }
    const point = resolveFleeDestination(pos, { x: 67, z: 67 })
    expect(isWalkableAt(point.x, point.z)).toBe(true)
  })

  it('obstáculo no caminho: o destino é andável e TEM caminho (contorna)', () => {
    // Rocha entre ela e o ponto reto pra longe.
    const pos = { x: 30, y: 0.45, z: 38.5 }
    const point = resolveFleeDestination(pos, { x: 30, z: 35 })

    expect(isWalkableAt(point.x, point.z)).toBe(true)
    expect(findPath(pos, point).length).toBeGreaterThan(0)
  })

  it('caminho reto bloqueado pela rocha: prefere a diagonal livre (bônus)', () => {
    // O ponto reto (30, 42.5) fica atrás da rocha; a diagonal tem o caminho
    // reto livre e ganha pelo bônus, mesmo um pouco mais perto de quem foge.
    const pos = { x: 30, z: 36.5 }
    const point = resolveFleeDestination(pos, { x: 30, z: 33 })
    expect(Math.abs(point.x - 30)).toBeGreaterThan(1)
  })

  it('perto da parede: nunca escolhe ponto sem caminho', () => {
    const pos = { x: 74, y: 0.45, z: 10 }
    const point = resolveFleeDestination(pos, { x: 70, z: 10 })
    expect(findPath(pos, point).length).toBeGreaterThan(0)
  })
})
