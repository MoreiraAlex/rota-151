import { GAME_CONFIG } from '../gameConfig'

/**
 * Modificadores clássicos do clima no dano (docs/features/048-dia-noite-e-
 * clima.md): com chuva o golpe de Água fica mais forte e o de Fogo mais
 * fraco; com neve o Pokémon de Gelo defende melhor. Os números são da config
 * (`WEATHER.MOVE_TYPE_MULTIPLIER` e `DEFENSE_MULTIPLIER`). Só contas — quem
 * diz o clima do lugar é `combatWeather.js`.
 */

/** Multiplicador do dano de um golpe do tipo `attackType` no clima. */
export function resolveWeatherMoveMultiplier(
  weather,
  attackType,
  params = GAME_CONFIG.WEATHER,
) {
  return params.MOVE_TYPE_MULTIPLIER[weather]?.[attackType] ?? 1
}

/**
 * Multiplicador do atributo de defesa `defenseKey` (`'defense'` ou
 * `'sp_def'`) de quem tem os tipos `defenderTypes`, no clima — o de cada
 * tipo dele, multiplicados.
 */
export function resolveWeatherDefenseMultiplier(
  weather,
  defenderTypes,
  defenseKey,
  params = GAME_CONFIG.WEATHER,
) {
  const byType = params.DEFENSE_MULTIPLIER[weather]
  if (!byType) return 1
  let multiplier = 1
  for (const type of defenderTypes ?? []) {
    multiplier *= byType[type]?.[defenseKey] ?? 1
  }
  return multiplier
}
