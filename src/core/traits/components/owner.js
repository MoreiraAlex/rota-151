import { relation } from 'koota'

/**
 * De qual treinador é esta entidade: relação da criatura invocada
 * (`SummonedCreature`) e da esfera em voo (`SummonBall`) pro treinador dono
 * (quem tem `Party`). `exclusive`: um dono por entidade. É por ela que o core
 * acha "o treinador desta criatura" — nunca `world.queryFirst(Party)`, que
 * só funciona com um treinador no mundo (ver
 * docs/features/040-dono-da-criatura.md).
 *
 * Os dados do Pokémon continuam no treinador, por slot (`Party`,
 * `PartyVitals`…); a relação só liga a entidade em campo ao dono.
 *
 * Dono de escrita: `spawnSummonBall` (`partySummonSystem.js`, na esfera) e
 * `spawnCreature` (`summonBallSystem.js`, na criatura, copiando o da esfera).
 */
export const OwnedBy = relation({ exclusive: true })
