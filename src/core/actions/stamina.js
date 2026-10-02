import { GAME_CONFIG } from '../gameConfig'

/**
 * Quanto a corrida e o dash custam A MAIS pela vida baixa — pra todo mundo
 * (jogador, criatura do time, selvagem): `1` com a vida cheia, subindo até
 * `STAMINA_BY_HP.MAX_MULTIPLIER` com a vida em 0, pela curva
 * `(1 - vida) ^ EXPONENT` (expoente > 1: pouco efeito arranhado, muito
 * quase desmaiando). Machucado cansa mais rápido — fugir, perseguir e dar
 * dash ferido custam caro (docs/features/034-ia-de-batalha.md, Parte 3).
 * Sem `hp`/`maxHp`, `1`.
 */
export function resolveMovementCostMultiplier(vitals) {
  const { MAX_MULTIPLIER, EXPONENT } = GAME_CONFIG.STAMINA_BY_HP
  if (!vitals || !(vitals.maxHp > 0) || vitals.hp == null) return 1
  const fraction = Math.min(1, Math.max(0, vitals.hp / vitals.maxHp))
  return 1 + (MAX_MULTIPLIER - 1) * (1 - fraction) ** EXPONENT
}

/** Custo de energia de um dash agora (`PLAYER_ACTIONS.dash.STAMINA_COST` × vida). */
export function resolveDashCost(vitals) {
  return (
    GAME_CONFIG.PLAYER_ACTIONS.dash.STAMINA_COST *
    resolveMovementCostMultiplier(vitals)
  )
}

/**
 * Regra ÚNICA de correr gastando fôlego, pra qualquer um que corre —
 * jogador (`movementSystem.js`), criatura do time seguindo
 * (`creatureFollowSystem.js`) e IA na luta (`wildBehaviorSystem.js`,
 * `core/battle/aiMovement.js`): correr neste tick custa
 * `runStaminaDrainPerSecond * delta`, × o multiplicador da vida baixa
 * (`resolveMovementCostMultiplier`); sem stamina pra isso, não corre (quem
 * chama anda em vez disso). Correndo, reseta o delay de regeneração.
 *
 * Recebe o `Vitals` VIVO do `updateEach` de quem chama (escreve nele) e
 * devolve se pode correr.
 */
export function tentarCorrer(vitals, delta) {
  const cost =
    vitals.runStaminaDrainPerSecond *
    delta *
    resolveMovementCostMultiplier(vitals)
  if (vitals.stamina < cost) return false

  vitals.stamina -= cost
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
  return true
}
