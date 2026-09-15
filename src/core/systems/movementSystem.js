import { GAME_CONFIG } from '../gameConfig'
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
  AimAnchor,
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
 * Mirando com um ponto travado (`AimAnchor.active` — ver
 * `aimAnchorSystem.js`), só o REFERENCIAL de movimento muda: em vez do
 * yaw da câmera, "frente"/"trás" (radial) aproxima/afasta do ponto
 * travado, "esquerda"/"direita" (tangencial) circula ao redor dele. A
 * ROTAÇÃO do personagem não muda de regra — continua girando na direção
 * do próprio movimento (WASD), igual ao modo normal, mesmo travado; ele
 * não passa a encarar o ponto de mira (isso foi tentado e revertido —
 * ver rodada 13 em docs/features/016-mira-e-arremesso.md). A câmera
 * (`cameraFollowSystem.js`) é quem de fato gira sozinha pra manter o
 * ponto em vista — o personagem em si só gira conforme se move.
 *
 * Correr só vale com stamina disponível — sem isso, cai pra andar sozinho
 * (sem travar o jogador em nenhum estado quebrado) e drena
 * `RUN_STAMINA_DRAIN_PER_SECOND` enquanto realmente em movimento (segurar
 * o modificador de corrida parado não gasta nada). Mirando (`input.aiming`,
 * botão direito segurado — ver `platform/input/pointerInput.js`), correr
 * também não vale, mesma lógica: cai pra andar em vez de travar — não dá
 * pra atirar correndo, só andando ou parado.
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
  const aiming = !!context.input?.aiming
  // Lido a cada tick (não guardado num const no topo do módulo) pra
  // manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  const { RUN_STAMINA_DRAIN_PER_SECOND, STAMINA_REGEN_DELAY_AFTER_USE } =
    GAME_CONFIG.VITALS

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
      AimAnchor,
    )
    .updateEach(([input, stats, vitals, vel, rot, pos, action, anchor]) => {
      if (action.current !== null) {
        vel.x = 0
        vel.z = 0
        return
      }

      // Travado, o referencial do input vira o ângulo DO PONTO PRO
      // JOGADOR (`atan2(pos - anchor)`, não o inverso) — mover "frente"
      // (input.z = -1) precisa resultar numa direção que aponta PRA o
      // alvo, não pra longe dele; sem inverter o sinal, "frente" andaria
      // pro lado errado.
      const moveYaw = anchor.active
        ? Math.atan2(pos.x - anchor.x, pos.z - anchor.z)
        : cameraYaw
      const sinYaw = Math.sin(moveYaw)
      const cosYaw = Math.cos(moveYaw)

      // Rotaciona a intenção (espaço da câmera, ou do alvo travado) para
      // o espaço do mundo. x = direita, z = frente (InputState: frente = -z).
      const worldX = input.x * cosYaw + input.z * sinYaw
      const worldZ = -input.x * sinYaw + input.z * cosYaw

      const hasMoveIntent = worldX !== 0 || worldZ !== 0
      const runCost = RUN_STAMINA_DRAIN_PER_SECOND * delta
      const isRunning =
        input.run && !aiming && hasMoveIntent && vitals.stamina >= runCost
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
