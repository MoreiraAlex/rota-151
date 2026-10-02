import { GAME_CONFIG } from '../gameConfig'

/**
 * Quanto da velocidade de andar/correr sobra com a vida baixa — pra todo
 * mundo (jogador, criatura do time, selvagem): `1` com a vida cheia, caindo
 * até `SPEED_BY_HP.MIN_MULTIPLIER` com a vida em 0, pela curva
 * `(1 - vida) ^ EXPONENT` (pouco efeito arranhado, muito quase desmaiando).
 * Par do custo de energia pela vida (`resolveMovementCostMultiplier`,
 * `stamina.js`): ferido cansa mais E corre menos — dá pra alcançar quem foge
 * machucado (docs/features/034-ia-de-batalha.md, Parte 3). Não vale pro dash
 * (o impulso é o mesmo; só custa mais). Sem `hp`/`maxHp`, `1`.
 */
export function resolveSpeedMultiplier(vitals) {
  const { MIN_MULTIPLIER, EXPONENT } = GAME_CONFIG.SPEED_BY_HP
  if (!vitals || !(vitals.maxHp > 0) || vitals.hp == null) return 1
  const fraction = Math.min(1, Math.max(0, vitals.hp / vitals.maxHp))
  return 1 - (1 - MIN_MULTIPLIER) * (1 - fraction) ** EXPONENT
}

/**
 * Velocidade de andar (`running` false) ou correr (true) da entidade agora:
 * `walkSpeed`/`runSpeed` da espécie × `resolveSpeedMultiplier`. Regra única
 * de quem anda/corre (jogador, time seguindo/lutando, selvagem vagando/
 * perseguindo/fugindo).
 */
export function resolveMoveSpeed(stats, vitals, running) {
  const base = running ? stats.runSpeed : stats.walkSpeed
  return base * resolveSpeedMultiplier(vitals)
}
