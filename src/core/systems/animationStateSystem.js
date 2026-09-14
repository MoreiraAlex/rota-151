import { resolveAnimationState } from '../data/animationStates'
import {
  Velocity,
  AnimationState,
  ActionState,
  Grounded,
  CharacterController,
} from '../traits'

/**
 * Resolve o id de animação (ver core/data/animationStates.js) a partir da
 * velocidade horizontal, do estado "no chão" e de uma ação em andamento
 * (dash, etc.), e escreve no trait AnimationState. Não sabe nada sobre
 * clipes, modelos ou Three.js — só o id.
 *
 * Headless. Fase: simulation, depois do characterPhysicsSystem (que já
 * atualizou Velocity e Grounded neste tick) e do playerActionSystem (que já
 * decidiu se uma ação está ativa neste tick).
 */
export function animationStateSystem(context) {
  const { world } = context

  world
    .query(CharacterController, Velocity, ActionState, AnimationState)
    .updateEach(([vel, action, anim], entity) => {
      const speed = Math.hypot(vel.x, vel.z)
      const grounded = entity.has(Grounded)
      anim.id = resolveAnimationState({
        speed,
        grounded,
        action: action.current,
      })
    })
}
