import { GAME_CONFIG } from '../gameConfig'

/**
 * Temperamento de uma selvagem, sorteado uma vez no spawn: hostil com
 * chance `species.wild.hostileChance` (0-1, opcional — sem ela,
 * `WILD_BEHAVIOR.DEFAULT_HOSTILE_CHANCE`). `rng` vem de fora
 * (`gameplayRng`) — regra 3.5, sem `Math.random()`.
 */
export function rollTemperament(rng, species) {
  const chance =
    species?.wild?.hostileChance ??
    GAME_CONFIG.WILD_BEHAVIOR.DEFAULT_HOSTILE_CHANCE
  return rng() < chance ? 'hostile' : 'peaceful'
}

/**
 * Reação de uma pacífica que apanhou: `'retaliate'` (revida — persegue o
 * lado do jogador, mirando por ameaça) ou `'flee'` (foge). Por enquanto só sorteio
 * (`RETALIATE_CHANCE`), o critério de verdade ainda vai ser definido.
 */
export function rollAttackReaction(rng) {
  return rng() < GAME_CONFIG.WILD_BEHAVIOR.RETALIATE_CHANCE
    ? 'retaliate'
    : 'flee'
}

/**
 * Limite de distância (m, no plano, até o alvo dela — ver
 * `WildBehavior.target`) que vale AGORA pra uma selvagem — `null` se nenhum:
 * - hostil vagando: raio de aggro — dentro dele, passa a perseguir;
 * - perseguindo: além dele, desiste (`AGGRO_RADIUS + AGGRO_EXIT_MARGIN`,
 *   ou `RETALIATE_LEASH_RADIUS` se provocada — apanhou);
 * - fugindo: além dele (distância segura), volta a vagar;
 * - pacífica vagando: nenhum (só reage apanhando).
 *
 * Fonte única: o `wildBehaviorSystem.js` decide por ele e o debug
 * (`WildBehaviorDebugView.jsx`) desenha o mesmo círculo.
 */
export function resolveBehaviorRadius(behavior) {
  const {
    AGGRO_RADIUS,
    AGGRO_EXIT_MARGIN,
    RETALIATE_LEASH_RADIUS,
    FLEE_SAFE_DISTANCE,
  } = GAME_CONFIG.WILD_BEHAVIOR

  if (behavior.state === 'chase') {
    return behavior.provoked
      ? RETALIATE_LEASH_RADIUS
      : AGGRO_RADIUS + AGGRO_EXIT_MARGIN
  }
  if (behavior.state === 'flee') return FLEE_SAFE_DISTANCE
  return behavior.temperament === 'hostile' ? AGGRO_RADIUS : null
}
