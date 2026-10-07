import { GAME_CONFIG } from '../gameConfig'
import { castRay } from '../physics/raycast'
import { DroppedFood, Position, Velocity } from '../traits'

// Folga (m) acima da fruta de onde sai o raio que procura o chão.
const GROUND_PROBE_LIFT = 0.5
const DOWN = { x: 0, y: -1, z: 0 }

/**
 * Fruta derrubada (`derrubarComida`, docs/features/042-itens-da-beta.md):
 * cai com a gravidade do jogo, quica (devolvendo `RESTITUTION` da velocidade
 * vertical), rola com atrito e para — tudo só visual, ninguém pega. O chão é
 * o terreno embaixo dela (raio só na geometria fixa do nível); sem física
 * carregada (ou sem nada embaixo), o chão de quem derrubou (`floorY`). Batida
 * forte soma em `landings` (o respingo da view). Também conta o `lifetime` e
 * destrói ao zerar.
 *
 * `Position` é a BASE da fruta (o ponto que encosta no chão).
 *
 * Headless. Fase: simulation — sem dependência de ordem.
 */
export function droppedFoodSystem(context) {
  const { world, delta } = context
  const { RESTITUTION, FRICTION, REST_SPEED, LANDING_MIN_SPEED } =
    GAME_CONFIG.ITEMS.DROPPED_FOOD_PHYSICS
  const gravity = GAME_CONFIG.PHYSICS.GRAVITY

  world
    .query(DroppedFood, Position, Velocity)
    .updateEach(([food, pos, vel], entity) => {
      food.lifetime -= delta
      if (food.lifetime <= 0) {
        entity.destroy()
        return
      }
      if (food.resting) return

      vel.y += gravity * delta
      pos.x += vel.x * delta
      pos.y += vel.y * delta
      pos.z += vel.z * delta

      const groundY = resolveGroundY(pos, food.floorY)
      if (pos.y > groundY) return

      // No chão: quica, perde velocidade pro atrito e, devagar, para.
      pos.y = groundY
      // Batida fraca não quica (senão a gravidade de um tick a faria tremer
      // no chão pra sempre).
      const impact = -vel.y
      const bounces = impact >= LANDING_MIN_SPEED
      if (bounces) food.landings += 1
      vel.y = bounces ? impact * RESTITUTION : 0
      const keep = Math.max(0, 1 - FRICTION * delta)
      vel.x *= keep
      vel.z *= keep
      if (vel.y === 0 && Math.hypot(vel.x, vel.z) < REST_SPEED) {
        vel.x = 0
        vel.z = 0
        food.resting = true
      }
    })
}

function resolveGroundY(pos, floorY) {
  const hit = castRay(
    { x: pos.x, y: pos.y + GROUND_PROBE_LIFT, z: pos.z },
    DOWN,
    GROUND_PROBE_LIFT * 2,
    { terrainOnly: true },
  )
  return hit ? hit.point.y : floorY
}
