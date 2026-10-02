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

function hpFraction(vitals) {
  return vitals && vitals.maxHp > 0 ? vitals.hp / vitals.maxHp : 1
}

/**
 * Chance (0-1) de uma pacífica que apanhou REVIDAR — a "coragem" dela pela
 * situação (docs/features/034-ia-de-batalha.md, Parte 3): parte de
 * `RETALIATE_CHANCE` e
 * - sobe com a vida dela (`COURAGE_HP_WEIGHT` × quanto passa de metade);
 * - cai com o tamanho do golpe que levou (`COURAGE_HIT_WEIGHT` × o dano em
 *   fração da vida máxima dela) — golpe forte assusta;
 * - sobe se ela está melhor que o agressor (`COURAGE_ADVANTAGE_WEIGHT` × a
 *   diferença das vidas em fração).
 * Limitada a `[COURAGE_MIN_CHANCE, COURAGE_MAX_CHANCE]` — sempre sobra
 * surpresa. `vitals` dela (já com o dano), `attackerVitals` do agressor (sem
 * → conta como vida cheia).
 */
export function resolveRetaliateChance(vitals, attackerVitals, damage) {
  const {
    RETALIATE_CHANCE,
    COURAGE_HP_WEIGHT,
    COURAGE_HIT_WEIGHT,
    COURAGE_ADVANTAGE_WEIGHT,
    COURAGE_MIN_CHANCE,
    COURAGE_MAX_CHANCE,
  } = GAME_CONFIG.WILD_BEHAVIOR
  const own = hpFraction(vitals)
  const hit = vitals?.maxHp > 0 ? (damage ?? 0) / vitals.maxHp : 0
  const chance =
    RETALIATE_CHANCE +
    COURAGE_HP_WEIGHT * (own - 0.5) -
    COURAGE_HIT_WEIGHT * hit +
    COURAGE_ADVANTAGE_WEIGHT * (own - hpFraction(attackerVitals))
  return Math.min(COURAGE_MAX_CHANCE, Math.max(COURAGE_MIN_CHANCE, chance))
}

/**
 * Reação de uma pacífica que apanhou: `'retaliate'` (revida — persegue o
 * lado do jogador, mirando por ameaça) ou `'flee'` (foge), sorteado com a
 * `chance` de revidar (`resolveRetaliateChance`; sem ela, `RETALIATE_CHANCE`).
 */
export function rollAttackReaction(
  rng,
  chance = GAME_CONFIG.WILD_BEHAVIOR.RETALIATE_CHANCE,
) {
  return rng() < chance ? 'retaliate' : 'flee'
}

/**
 * Fuga com HP baixo (Parte 3): perseguindo com a vida em
 * `LOW_HP_FLEE_FRACTION` ou menos, ainda sem ter sorteado nessa queda.
 */
export function isLowHp(vitals) {
  return hpFraction(vitals) <= GAME_CONFIG.WILD_BEHAVIOR.LOW_HP_FLEE_FRACTION
}

/** Já se recuperou da fuga com HP baixo (`LOW_HP_RECOVER_FRACTION`)? */
export function isRecoveredFromLowHp(vitals) {
  return hpFraction(vitals) >= GAME_CONFIG.WILD_BEHAVIOR.LOW_HP_RECOVER_FRACTION
}

/** Sorteio (uma vez por queda) de fugir com HP baixo. */
export function rollLowHpFlee(rng) {
  return rng() < GAME_CONFIG.WILD_BEHAVIOR.LOW_HP_FLEE_CHANCE
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
