import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { DroppedFood, Position, Rotation, Velocity } from '../traits'
import { droppedFoodSystem } from './droppedFoodSystem'

const DELTA = 1 / 60
const FLOOR = 0

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

// Sem física carregada no teste, o chão é o `floorY` de quem derrubou.
function setup({ y = 1, velocity = { x: 1, y: 2, z: 0 }, lifetime = 60 } = {}) {
  const world = createWorld()
  worlds.push(world)
  const food = world.spawn(
    Position({ x: 0, y, z: 0 }),
    Rotation,
    Velocity(velocity),
    DroppedFood({ itemId: 'x', lifetime, floorY: FLOOR }),
  )
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) droppedFoodSystem({ world, delta: DELTA })
  }
  return { world, food, tick }
}

describe('droppedFoodSystem', () => {
  it('cai com a gravidade, quica e para no chão', () => {
    const { food, tick } = setup()

    tick(10)
    expect(food.get(Position).y).toBeGreaterThan(FLOOR)

    tick(60 * 5)
    expect(food.get(Position).y).toBeCloseTo(FLOOR)
    expect(food.get(DroppedFood).resting).toBe(true)
    expect(food.get(Velocity)).toMatchObject({ x: 0, y: 0, z: 0 })
  })

  it('nunca atravessa o chão', () => {
    const { food, tick } = setup({ velocity: { x: 0, y: -20, z: 0 } })

    for (let i = 0; i < 120; i++) {
      tick()
      expect(food.get(Position).y).toBeGreaterThanOrEqual(FLOOR)
    }
  })

  it('batida forte no chão conta como quique (pulso pro respingo)', () => {
    const { food, tick } = setup()

    tick(60 * 3)

    expect(food.get(DroppedFood).landings).toBeGreaterThanOrEqual(1)
  })

  it('pousada de leve não conta como quique', () => {
    const { LANDING_MIN_SPEED } = GAME_CONFIG.ITEMS.DROPPED_FOOD_PHYSICS
    const { food, tick } = setup({
      y: FLOOR,
      velocity: { x: 0, y: 0, z: 0 },
    })

    // Parada no chão, a gravidade de um tick não chega a ser batida forte.
    expect(-GAME_CONFIG.PHYSICS.GRAVITY * DELTA).toBeLessThan(LANDING_MIN_SPEED)
    tick(5)

    expect(food.get(DroppedFood).landings).toBe(0)
  })

  it('some quando o tempo de vida acaba', () => {
    const { world, tick } = setup({ lifetime: DELTA * 3 })

    tick(4)

    expect(world.query(DroppedFood).length).toBe(0)
  })
})
