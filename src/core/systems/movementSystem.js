import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import {
  Velocity,
  Rotation,
  InputState,
  InputControlled,
  MovementStats,
  Vitals,
  OrbitCamera,
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
 * `RUN_STAMINA_DRAIN_PER_SECOND` enquanto realmente em movimento (segurar
 * o modificador de corrida parado não gasta nada).
 *
 * Headless. Fase: simulation, depois do cameraControlSystem e antes do
 * characterPhysicsSystem.
 */
export function movementSystem(context) {
  const { world, delta } = context
  // Lido a cada tick (não guardado num const no topo do módulo) pra
  // manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  const { RUN_STAMINA_DRAIN_PER_SECOND, STAMINA_REGEN_DELAY_AFTER_USE } =
    GAME_CONFIG.VITALS

  const rig = world.queryFirst(OrbitCamera)
  const yaw = rig ? rig.get(OrbitCamera).yaw : 0
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)

  world
    .query(
      InputControlled,
      InputState,
      MovementStats,
      Vitals,
      Velocity,
      Rotation,
    )
    .updateEach(([input, stats, vitals, vel, rot]) => {
      // Rotaciona a intenção (espaço da câmera) para o espaço do mundo.
      // x = direita da câmera, z = frente da câmera (InputState: frente = -z).
      const worldX = input.x * cosYaw + input.z * sinYaw
      const worldZ = -input.x * sinYaw + input.z * cosYaw

      const hasMoveIntent = worldX !== 0 || worldZ !== 0
      const runCost = RUN_STAMINA_DRAIN_PER_SECOND * delta
      const isRunning = input.run && hasMoveIntent && vitals.stamina >= runCost
      const speed = isRunning ? stats.runSpeed : stats.walkSpeed

      if (isRunning) {
        vitals.stamina = Math.max(0, vitals.stamina - runCost)
        vitals.staminaRegenDelay = STAMINA_REGEN_DELAY_AFTER_USE
      }

      vel.x = worldX * speed
      vel.z = worldZ * speed

      if (hasMoveIntent) {
        const facing = Math.atan2(worldX, worldZ)
        rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)
      }
    })
}
