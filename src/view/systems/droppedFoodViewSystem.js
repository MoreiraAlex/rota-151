import * as THREE from 'three'
import { getItem } from '@/core/data/items'
import { DroppedFood, Position, Rotation, Velocity } from '@/core/traits'
import {
  getDroppedFood,
  resolveDroppedFoodPivot,
} from '../registry/droppedFoodRegistry'
import { EATING_FOOD_RADIUS } from '../scene/EatingFoodView'
import { requestFoodVfx } from '../vfx/foodVfxQueue'

// No ar a fruta gira mais rápido do que rolando (multiplica o giro).
const AIR_SPIN = 1.6

const axis = new THREE.Vector3()
const roll = new THREE.Quaternion()

/**
 * Fruta caída (docs/features/042-itens-da-beta.md): gira como se rolasse
 * pela velocidade dela (`Velocity` do `droppedFoodSystem`) — eixo deitado,
 * perpendicular ao movimento, e ângulo `distância / raio`, mais rápido no ar
 * — e pede o respingo a cada quique novo (`DroppedFood.landings`,
 * `foodVfxQueue.js`). Parada (`resting`), fica como está.
 *
 * Fase: presentation.
 */
export function droppedFoodViewSystem(context) {
  const { world, delta = 0 } = context

  world
    .query(DroppedFood, Position, Velocity, Rotation)
    .readEach(([food, pos, vel, rot], entity) => {
      const entry = getDroppedFood(entity)
      if (!entry) return

      if (food.landings > entry.landings) {
        entry.landings = food.landings
        requestFoodVfx({
          kind: 'land',
          itemId: food.itemId,
          position: [pos.x, pos.y, pos.z],
        })
      }
      const pivot = resolveDroppedFoodPivot(entry)
      if (food.resting || !pivot) return

      const speed = Math.hypot(vel.x, vel.z)
      if (speed < 1e-4) return
      const size = getItem(food.itemId)?.model?.size
      const radius = size ? size / 2 : EATING_FOOD_RADIUS
      const spin = vel.y === 0 ? 1 : AIR_SPIN
      // Eixo de rolar no mundo (cima × direção), levado pro espaço do grupo
      // de fora, que já está girado em `Rotation.y`.
      axis.set(vel.z / speed, 0, -vel.x / speed)
      axis.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -rot.y)
      roll.setFromAxisAngle(axis, ((speed * delta) / radius) * spin)
      pivot.quaternion.premultiply(roll)
    })
}
