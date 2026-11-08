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
 * Fuga clássica (docs/features/063-revisao-da-ia-selvagem.md): a pacífica que
 * te percebe foge (some do mapa) com a chance da espécie
 * (`species.wild.fleeChance`, 0-1 — sem ela, `DEFAULT_FLEE_CHANCE`).
 */
export function rollFlee(rng, species) {
  const chance =
    species?.wild?.fleeChance ?? GAME_CONFIG.WILD_BEHAVIOR.DEFAULT_FLEE_CHANCE
  return rng() < chance
}

/**
 * Limite de distância (m, no plano, até o alvo dela — ver
 * `WildBehavior.target`) que vale AGORA pra uma selvagem — `null` se nenhum:
 * - perseguindo: além dele, desiste (`AGGRO_RADIUS + AGGRO_EXIT_MARGIN`,
 *   ou `RETALIATE_LEASH_RADIUS` se provocada — apanhou);
 * - hostil vagando: o "perto demais" (`AGGRO_RADIUS`) — quem ela percebeu e
 *   chega a ele adianta o ataque (`wildAwarenessSystem.js`);
 * - pacífica vagando ou saindo: nenhum.
 *
 * Fonte única: os systems decidem por ele e o debug
 * (`WildBehaviorDebugView.jsx`) desenha o mesmo círculo.
 */
export function resolveBehaviorRadius(behavior) {
  const { AGGRO_RADIUS, AGGRO_EXIT_MARGIN, RETALIATE_LEASH_RADIUS } =
    GAME_CONFIG.WILD_BEHAVIOR

  if (behavior.state === 'chase') {
    return behavior.provoked
      ? RETALIATE_LEASH_RADIUS
      : AGGRO_RADIUS + AGGRO_EXIT_MARGIN
  }
  if (behavior.state === 'leave') return null
  return behavior.temperament === 'hostile' ? AGGRO_RADIUS : null
}
