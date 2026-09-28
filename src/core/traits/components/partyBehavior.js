import { trait } from 'koota'

/**
 * IA de combate de uma criatura do time quando ela NÃO está sob controle
 * do jogador — sempre DEFENSIVA (decisão do usuário: nunca outra postura):
 * só entra na luta contra a selvagem que acertou alguém do grupo
 * (treinador ou criatura do time, `partyReactionSystem.js`), luta só com o
 * ataque básico e volta a seguir quando não sobra ninguém lutando com o
 * grupo ou quando se afasta demais de quem segue
 * (`PARTY_BEHAVIOR.LEASH_RADIUS`).
 *
 * - `state`: `'follow'` (segue quem está no controle,
 *   `creatureFollowSystem.js`) ou `'fight'` (lutando com `target`,
 *   `partyBehaviorSystem.js`).
 * - `target`: a selvagem que está combatendo (`null` seguindo).
 * - `attackTimer` (s): quanto falta pra pedir o próximo golpe
 *   (`PARTY_BEHAVIOR.ATTACK_INTERVAL` — mais lento que o jogador de
 *   propósito: a IA ajuda, quem decide a luta é quem joga).
 *
 * Donos de escrita: as actions de `core/actions/partyBehavior.js` (trocas
 * de estado) e `partyBehaviorSystem.js` (`attackTimer`).
 */
export const PartyBehavior = trait({
  state: 'follow',
  target: null,
  attackTimer: 0,
})
