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
 * Entidade movida pelo KinematicCharacterController do Rapier. Além de
 * marcar a entidade (uso em queries como tag), carrega a forma do collider
 * cápsula — vem de `core/data/species/<id>/index.js` (`body`), copiado no
 * spawn; cada entidade pode ter um corpo de tamanho diferente.
 *
 * `capsuleAxis` é o eixo LOCAL (relativo ao corpo, não ao mundo) ao longo do
 * qual a cápsula é comprida: `'y'` (padrão) é em pé, como um humanoide;
 * `'x'`/`'z'` deita a cápsula de lado, pra corpos alongados na horizontal
 * (quadrúpedes). Como o corpo físico agora gira junto com `Rotation.y` (ver
 * characterPhysicsSystem), uma cápsula deitada continua alinhada com a
 * frente da criatura conforme ela vira, em vez de ficar presa a um eixo do
 * mundo.
 *
 * Dono de escrita: spawn (world.js / test/makeWorld.js).
 * Lê: physicsBootstrapSystem, ao criar o collider.
 */
export const CharacterController = trait({
  capsuleRadius: 0.5,
  capsuleHalfHeight: 0.01,
  capsuleAxis: 'y',
})

/**
 * Tag: presente quando o character controller reporta contato com o chão.
 * Adicionada/removida por frame pelo characterPhysicsSystem.
 */
export const Grounded = trait()
