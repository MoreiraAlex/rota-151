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
 * (jumpSpeed), animationStateSystem (walkSpeed/runSpeed — o meio entre os
 * dois é onde a animação passa de andar pra correr).
 */
export const MovementStats = trait({
  walkSpeed: 3,
  runSpeed: 7,
  turnSpeed: 10,
  jumpSpeed: 9,
})

/**
 * Voo livre da espécie (`species.flight`, docs/features/060-ajustes-por-
 * especie.md, Parte 2): velocidade do voo normal e do rápido (Shift).
 * Só quem tem este trait pode decolar.
 *
 * Dono de escrita: spawn da criatura invocada (`summonBallSystem.js`).
 * Lê: `flightSystem`, `animationStateSystem`.
 */
export const FlightStats = trait({
  speed: 4,
  fastSpeed: 8,
})

/**
 * No ar, voando (não é pulo nem queda). Dono de escrita: `flightSystem` —
 * põe ao decolar e tira ao pousar ou desmaiar.
 *
 * `takeoff` (s): quanto falta da decolagem (sobe sozinho e ainda não pousa
 * encostando no chão). `landing`: descendo pra pousar (`V` no ar ou o
 * controle devolvido ao treinador). `intentSpeed`: a velocidade que o
 * jogador pediu (sem a descida forçada pelo teto) — a animação escolhe
 * pairar/voar por ela (`animationStateSystem`).
 */
export const Flying = trait({
  takeoff: 0,
  landing: false,
  intentSpeed: 0,
})
