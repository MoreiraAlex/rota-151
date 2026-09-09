import { trait } from 'koota'

/**
 * Handles do corpo e do collider Rapier associados à entidade.
 * `-1` = ainda não criado (o physicsBootstrapSystem preenche quando o WASM
 * estiver pronto).
 *
 * Dono de escrita: physicsBootstrapSystem.
 * Leem: characterPhysicsSystem, syncPhysicsSystem.
 */
export const PhysicsBody = trait({
  bodyHandle: -1,
  colliderHandle: -1,
})

/**
 * Tag: entidade movida pelo KinematicCharacterController do Rapier.
 */
export const CharacterController = trait()

/**
 * Tag: presente quando o character controller reporta contato com o chão.
 * Adicionada/removida por frame pelo characterPhysicsSystem.
 */
export const Grounded = trait()
