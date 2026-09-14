import { trait } from 'koota'

/**
 * Capacidade de movimento da entidade — vem de `core/data/species/<id>/
 * index.js` (`movement`), copiado no spawn. Diferente de InputState (a
 * intenção do momento), isto é "o quanto essa criatura consegue", igual pra
 * toda instância da espécie: cada uma pode ter seus próprios números, sem
 * mexer em nenhum system.
 *
 * Dono de escrita: spawn (world.js / test/makeWorld.js).
 * Leem: movementSystem (walkSpeed/runSpeed/turnSpeed), characterPhysicsSystem
 * (jumpSpeed).
 */
export const MovementStats = trait({
  walkSpeed: 3,
  runSpeed: 7,
  turnSpeed: 10,
  jumpSpeed: 9,
})
