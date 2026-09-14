import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  Rotation,
  Velocity,
  Grounded,
  InputControlled,
} from '../traits'

const { DURATION, SPEED } = GAME_CONFIG.PLAYER_ACTIONS.dash

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
 * Headless. Fase: simulation, depois do movementSystem (cuja Rotation.y já
 * reflete a direção do input deste frame — é essa direção que o dash trava)
 * e antes do characterPhysicsSystem (que resolve a Velocity contra o mundo).
 */
export function playerActionSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}

  world
    .query(InputControlled, ActionState, Velocity, Rotation)
    .updateEach(([action, vel, rot], entity) => {
      if (action.current === null) {
        if (!input.dash || !entity.has(Grounded)) return

        action.current = 'dash'
        action.elapsed = 0
        action.dirX = Math.sin(rot.y)
        action.dirZ = Math.cos(rot.y)
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
