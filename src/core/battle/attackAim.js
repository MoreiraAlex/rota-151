import { resolveAimDirection } from '../aim'
import { GAME_CONFIG } from '../gameConfig'
import {
  CharacterController,
  Position,
  Rotation,
  Vitals,
  WildCreature,
} from '../traits'
import {
  closestPointsOnGroundPlane,
  isWithinCombatHeight,
  resolveCapsuleSegment,
  resolveFootElevation,
} from './attackGeometry'

function horizontalOf(direction) {
  const length = Math.hypot(direction.x, direction.z)
  return { x: direction.x / length, y: 0, z: direction.z / length }
}

function horizontalAngle(forward, vector) {
  const length = Math.hypot(vector.x, vector.z)
  if (length < 1e-6) return 0
  const cos = (forward.x * vector.x + forward.z * vector.z) / length
  return Math.acos(Math.min(1, Math.max(-1, cos)))
}

/**
 * Pra onde puxar um golpe corpo a corpo, no plano horizontal: o ponto da
 * "pegada" do corpo do alvo (cápsula projetada no chão) mais perto do
 * atacante.
 *
 * Candidatos: `WildCreature` viva, no mesmo plano de combate
 * (`isWithinCombatHeight`), com a pegada a até `range + radius +
 * capsuleRadius` na horizontal (alcançável) e dentro do cone horizontal
 * de `MELEE_AIM_HALF_ANGLE` em volta de `forward`. Entre vários, ganha o
 * de menor ângulo — o mais perto de onde o jogador está olhando.
 */
function findMeleeAimPoint(world, pos, attackerElevation, forward, attack) {
  const halfAngle = GAME_CONFIG.BATTLE.MELEE_AIM_HALF_ANGLE
  const maxReach = attack.range + attack.radius
  let best = null

  world
    .query(WildCreature, Position, Rotation, CharacterController, Vitals)
    .readEach(([, targetPos, rot, controller, vitals]) => {
      if (vitals.hp <= 0) return
      if (
        !isWithinCombatHeight(
          attackerElevation,
          resolveFootElevation(targetPos, controller),
        )
      )
        return

      const capsule = resolveCapsuleSegment(targetPos, rot.y, controller)
      const { pointOnSecond, distance } = closestPointsOnGroundPlane(
        pos,
        pos,
        capsule.a,
        capsule.b,
      )
      if (distance > maxReach + controller.capsuleRadius) return

      const angle = horizontalAngle(forward, {
        x: pointOnSecond.x - pos.x,
        z: pointOnSecond.z - pos.z,
      })
      if (angle > halfAngle) return
      if (best && angle >= best.angle) return

      best = { angle, point: pointOnSecond }
    })

  return best?.point ?? null
}

/**
 * Direção do golpe, travada no disparo por `creatureAttackSystem.js` e
 * reusada pelo indicador de alcance (`AttackIndicatorView.jsx`), pros dois
 * nunca divergirem. **Sempre horizontal** (`y: 0`) — combate 2.5D, sem
 * mira vertical: a altura quem resolve é a trajetória, acompanhando o
 * terreno (`resolveAttackImpactPoint`). Depende de `attack.aim`
 * (`core/data/attacks/<id>/index.js`):
 *
 * - `'melee'`: giro horizontal da câmera, puxado pro alvo dentro do cone
 *   à frente (`findMeleeAimPoint`) quando houver.
 * - `'ranged'` (ou ausente): giro horizontal da câmera, sem assistência.
 */
export function resolveAttackDirection(
  world,
  pos,
  excludeColliderHandle,
  species,
  attack,
) {
  const forward = horizontalOf(
    resolveAimDirection(
      world,
      pos,
      excludeColliderHandle,
      species?.camera?.targetHeight,
      species?.camera?.shoulderOffset,
    ),
  )
  if (attack.aim !== 'melee') return forward

  const aimPoint = findMeleeAimPoint(
    world,
    pos,
    resolveFootElevation(pos, species.body),
    forward,
    attack,
  )
  if (!aimPoint) return forward

  const toTarget = { x: aimPoint.x - pos.x, z: aimPoint.z - pos.z }
  const length = Math.hypot(toTarget.x, toTarget.z)
  if (length < 1e-6) return forward

  return { x: toTarget.x / length, y: 0, z: toTarget.z / length }
}
