/**
 * Regra ÚNICA de correr gastando fôlego, pra qualquer um que corre —
 * jogador (`movementSystem.js`), criatura do time seguindo
 * (`creatureFollowSystem.js`) e selvagem perseguindo/fugindo
 * (`wildBehaviorSystem.js`): correr neste tick custa
 * `runStaminaDrainPerSecond * delta`; sem stamina pra isso, não corre
 * (quem chama anda em vez disso). Correndo, reseta o delay de regeneração.
 *
 * Recebe o `Vitals` VIVO do `updateEach` de quem chama (escreve nele) e
 * devolve se pode correr.
 */
export function tentarCorrer(vitals, delta) {
  const cost = vitals.runStaminaDrainPerSecond * delta
  if (vitals.stamina < cost) return false

  vitals.stamina -= cost
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
  return true
}
