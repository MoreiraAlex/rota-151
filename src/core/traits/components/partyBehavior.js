import { trait } from 'koota'

/**
 * IA de combate de uma criatura do time quando ela NÃO está sob controle
 * do jogador. Quando entra na luta e contra quem depende da postura do
 * Pokémon (`Pokemon.posture`, `core/party/posture.js`,
 * docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2) —
 * `partyReactionSystem.js` (golpe que acertou) e `partyBehaviorSystem.js`
 * (selvagem partindo para cima, selvagem à vista). Luta com o básico e as
 * habilidades da espécie e volta a seguir quando não sobra ninguém para
 * lutar ou quando se afasta demais de quem segue
 * (`PARTY_BEHAVIOR.LEASH_RADIUS`).
 *
 * - `state`: `'follow'` (segue quem está no controle,
 *   `creatureFollowSystem.js`) ou `'fight'` (lutando com `target`,
 *   `partyBehaviorSystem.js`).
 * - `target`: a selvagem que está combatendo (`null` seguindo).
 * - `attackTimer` (s): quanto falta pra pedir o próximo golpe
 *   (`PARTY_BEHAVIOR.ATTACK_INTERVAL` — mais lento que o jogador de
 *   propósito: a IA ajuda, quem decide a luta é quem joga).
 * - `attackSlot` / `lastAttackSlot`: o golpe planejado e o último pedido —
 *   mesmo significado de `WildBehavior` (`planAiAttack`,
 *   `core/battle/aiAttackChoice.js`).
 * - `resting`: descansando com a energia baixa (mesmo de `WildBehavior`,
 *   `resolveResting`).
 *
 * Donos de escrita: as actions de `core/actions/partyBehavior.js` (trocas
 * de estado) e `partyBehaviorSystem.js` (`attackTimer`, `attackSlot`,
 * `lastAttackSlot`, `resting`).
 */
export const PartyBehavior = trait({
  state: 'follow',
  target: null,
  attackTimer: 0,
  attackSlot: null,
  lastAttackSlot: null,
  resting: false,
})

/**
 * As selvagens que ACERTARAM esta criatura do time desde que ela entrou na
 * luta (`entries`: entidades) — é contra elas, e só elas, que a neutra luta
 * (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2). Esvazia quando
 * ela volta a seguir.
 *
 * Trait AoS (`entries` é um array): mutação sempre por objeto novo +
 * `entity.set`.
 *
 * Donos de escrita: `registrarAgressor` e `voltarASeguir`
 * (`core/actions/partyBehavior.js`).
 */
export const PartyAttackers = trait(() => ({ entries: [] }))
