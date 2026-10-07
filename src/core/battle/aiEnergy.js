import { GAME_CONFIG } from '../gameConfig'

function staminaFraction(vitals) {
  return vitals.maxStamina > 0 ? vitals.stamina / vitals.maxStamina : 0
}

/**
 * Se a IA está DESCANSANDO agora (`resting` = como estava no tick anterior).
 * Todo gasto de energia (correr, qualquer golpe) reinicia o atraso da
 * regeneração (`staminaRegenDelayAfterUse`): gastando um pouco sempre que
 * entra, a energia nunca volta a regenerar. Então, com a energia em
 * `REST_ENTER_FRACTION` ou menos, a IA para de gastar (sem golpe, sem correr)
 * até voltar a `REST_EXIT_FRACTION` — a folga entre os dois evita voltar a
 * gastar com o primeiro tanto que regenerar.
 */
export function resolveResting(resting, vitals) {
  const { REST_ENTER_FRACTION, REST_EXIT_FRACTION } = GAME_CONFIG.AI_ENERGY
  const fraction = staminaFraction(vitals)
  if (resting) return fraction < REST_EXIT_FRACTION
  return fraction <= REST_ENTER_FRACTION
}

/**
 * O golpe cabe na reserva de energia? O mais barato dos prontos
 * (`cheapestCost`) sempre cabe; os outros só se, depois de pagar, sobrar
 * `SKILL_RESERVE_FRACTION` da energia máxima — a IA não esvazia a energia
 * nos golpes caros.
 */
export function fitsEnergyReserve(attack, vitals, cheapestCost) {
  const { SKILL_RESERVE_FRACTION } = GAME_CONFIG.AI_ENERGY
  if (attack.staminaCost <= cheapestCost) return true
  const after = vitals.stamina - attack.staminaCost
  return after >= SKILL_RESERVE_FRACTION * vitals.maxStamina
}
