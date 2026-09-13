import { resolveAnimationState } from '../data/animationStates'
import {
  Velocity,
  AnimationState,
  Grounded,
  CharacterController,
} from '../traits'

/**
 * Resolve o id de animação (ver core/data/animationStates.js) a partir da
 * velocidade horizontal e do estado "no chão", e escreve no trait
 * AnimationState. Não sabe nada sobre clipes, modelos ou Three.js — só o id.
 *
 * Headless. Fase: simulation, depois do characterPhysicsSystem (que já
 * atualizou Velocity e Grounded neste tick).
 */
export function animationStateSystem(context) {
  const { world } = context

  world
    .query(CharacterController, Velocity, AnimationState)
    .updateEach(([vel, anim], entity) => {
      const speed = Math.hypot(vel.x, vel.z)
      const grounded = entity.has(Grounded)
      anim.id = resolveAnimationState({ speed, grounded })
    })
}
