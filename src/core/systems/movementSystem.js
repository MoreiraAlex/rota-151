import { lerpAngle } from '../math'
import {
  Velocity,
  Rotation,
  Position,
  InputState,
  InputControlled,
  MovementStats,
  Vitals,
  OrbitCamera,
  ActionState,
} from '../traits'

/**
 * Produz a velocidade horizontal desejada a partir do InputState e gira a
 * entidade na direção do movimento. NÃO integra Position — quem resolve o
 * movimento contra o mundo é o characterPhysicsSystem (Rapier KCC).
 *
 * A intenção do InputState está no espaço da câmera (x = direita, z = frente);
 * aqui ela é rotacionada pelo yaw de OrbitCamera para o espaço do mundo.
 * Velocidades vêm de MovementStats — dado por entidade (de
 * core/data/species/<id>/index.js, copiado no spawn), não config global.
 *
 * Correr só vale com stamina disponível — sem isso, cai pra andar sozinho
 * (sem travar o jogador em nenhum estado quebrado) e drena
 * `Vitals.runStaminaDrainPerSecond` (por espécie, ver
 * docs/features/018-troca-de-controle-treinador-criatura.md) enquanto
 * realmente em movimento (segurar o modificador de corrida parado não
 * gasta nada).
 *
 * Com uma ação em andamento (`ActionState.current` não-nulo — arremesso,
 * uso, dash), o movimento horizontal fica congelado (`vel.x/z = 0`, sem
 * girar): o certo seria só liberar de novo quando a animação da ação
 * terminasse, mas isso ainda não existe (ver docs/features/016-mira-e-
 * arremesso.md) — até lá, trava por `ActionState` mesmo, pra não dar pra
 * "arremessar andando". Não afeta `vel.y` (gravidade/pulo, resolvidos em
 * `characterPhysicsSystem`) — só a locomoção horizontal.
 *
 * Headless. Fase: simulation, depois do cameraControlSystem e antes do
 * characterPhysicsSystem.
 */
export function movementSystem(context) {
  const { world, delta } = context

  const rig = world.queryFirst(OrbitCamera)
  const cameraYaw = rig ? rig.get(OrbitCamera).yaw : 0

  world
    .query(
      InputControlled,
      InputState,
      MovementStats,
      Vitals,
      Velocity,
      Rotation,
      Position,
      ActionState,
    )
    .updateEach(([input, stats, vitals, vel, rot, , action]) => {
      if (action.current !== null) {
        vel.x = 0
        vel.z = 0
        return
      }

      const moveYaw = cameraYaw
      const sinYaw = Math.sin(moveYaw)
      const cosYaw = Math.cos(moveYaw)

      // Rotaciona a intenção (espaço da câmera) para o espaço do mundo.
      // x = direita, z = frente (InputState: frente = -z).
      const worldX = input.x * cosYaw + input.z * sinYaw
      const worldZ = -input.x * sinYaw + input.z * cosYaw

      const hasMoveIntent = worldX !== 0 || worldZ !== 0
      const runCost = vitals.runStaminaDrainPerSecond * delta
      const isRunning = input.run && hasMoveIntent && vitals.stamina >= runCost
      const speed = isRunning ? stats.runSpeed : stats.walkSpeed

      if (isRunning) {
        vitals.stamina = Math.max(0, vitals.stamina - runCost)
        vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
      }

      vel.x = worldX * speed
      vel.z = worldZ * speed

      if (hasMoveIntent) {
        const facing = Math.atan2(worldX, worldZ)
        rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)
      }
    })
}
