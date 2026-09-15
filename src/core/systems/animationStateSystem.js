import { resolveAnimationState } from '../data/animationStates'
import {
  Velocity,
  Rotation,
  AnimationState,
  ActionState,
  Grounded,
  CharacterController,
} from '../traits'

/**
 * Resolve o id de animação (ver core/data/animationStates.js) a partir da
 * velocidade horizontal, do estado "no chão" e de uma ação em andamento
 * (dash, etc.), e escreve no trait AnimationState. Não sabe nada sobre
 * clipes, modelos ou Three.js — só o id (e a direção de playback, abaixo).
 *
 * `direction`: normalmente o movimento e o Rotation.y andam juntos (quem
 * define pra onde o personagem se move é a própria direção que ele encara —
 * ver movementSystem.js), então "andar" sempre bate com o clipe de andar
 * pra frente. Mas com um alvo travado (lock-on estilo Zelda), Rotation.y
 * passa a encarar o alvo em vez do movimento — o personagem pode estar
 * indo pra trás (afastando do alvo) enquanto continua olhando pra ele. O
 * produto escalar entre a velocidade e o vetor de frente (derivado de
 * Rotation.y, mesma convenção de movementSystem.js: frente = (sin, 0,
 * cos)) diz se o movimento é a favor (positivo) ou contra (negativo) a
 * direção que o corpo encara — negativo toca o clipe de trás pra frente
 * (ver AnimationState.direction).
 *
 * Headless. Fase: simulation, depois do characterPhysicsSystem (que já
 * atualizou Velocity e Grounded neste tick) e do playerActionSystem (que já
 * decidiu se uma ação está ativa neste tick).
 */
export function animationStateSystem(context) {
  const { world } = context

  world
    .query(CharacterController, Velocity, Rotation, ActionState, AnimationState)
    .updateEach(([, vel, rot, action, anim], entity) => {
      const speed = Math.hypot(vel.x, vel.z)
      const grounded = entity.has(Grounded)
      anim.id = resolveAnimationState({
        speed,
        grounded,
        action: action.current,
      })

      const forwardDot = vel.x * Math.sin(rot.y) + vel.z * Math.cos(rot.y)
      anim.direction = forwardDot < 0 ? -1 : 1
    })
}
