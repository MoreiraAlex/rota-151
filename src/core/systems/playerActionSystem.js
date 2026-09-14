import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  Rotation,
  Velocity,
  Vitals,
  Grounded,
  InputControlled,
} from '../traits'

const { DURATION, SPEED, STAMINA_COST } = GAME_CONFIG.PLAYER_ACTIONS.dash
const { STAMINA_REGEN_DELAY_AFTER_USE } = GAME_CONFIG.VITALS

/**
 * Inicia, avança e encerra ações disparadas por input (hoje só dash) — o
 * mecanismo genérico descrito em docs/features/007-sistema-de-acoes-do-jogador.md.
 *
 * Ao contrário da locomoção (idle/walk/run, resolvida a cada frame a partir
 * de velocidade/grounded), uma ação tem começo e fim: só inicia com um
 * gatilho de borda ("apertou agora", não "está segurando") e enquanto ativa
 * é dona da Velocity horizontal, sobrescrevendo o que o movementSystem já
 * calculou pra este frame.
 *
 * Dash custa stamina (`STAMINA_COST`), descontada uma vez no disparo — sem
 * stamina suficiente, o dash simplesmente não dispara, mesma forma que a
 * precondição de `Grounded` já bloqueia hoje.
 *
 * Headless. Fase: simulation, depois do movementSystem (cuja Rotation.y já
 * reflete a direção do input deste frame — é essa direção que o dash trava)
 * e antes do characterPhysicsSystem (que resolve a Velocity contra o mundo).
 */
export function playerActionSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}

  world
    .query(InputControlled, ActionState, Vitals, Velocity, Rotation)
    .updateEach(([action, vitals, vel, rot], entity) => {
      if (action.current === null) {
        if (
          !input.dash ||
          !entity.has(Grounded) ||
          vitals.stamina < STAMINA_COST
        ) {
          return
        }

        action.current = 'dash'
        action.elapsed = 0
        action.dirX = Math.sin(rot.y)
        action.dirZ = Math.cos(rot.y)
        vitals.stamina -= STAMINA_COST
        vitals.staminaRegenDelay = STAMINA_REGEN_DELAY_AFTER_USE
      }

      action.elapsed += delta

      if (action.current === 'dash') {
        if (action.elapsed >= DURATION) {
          action.current = null
          return
        }

        vel.x = action.dirX * SPEED
        vel.z = action.dirZ * SPEED
      }
    })
}
