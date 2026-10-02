import { DashCooldown } from '../traits'

/**
 * Conta a recarga do dash (`DashCooldown.timeLeft`) de todo mundo — jogador e
 * IA, a mesma regra (docs/features/035-balanceamento-de-acoes-e-correcoes.md).
 *
 * Headless. Fase: simulation, antes de quem dispara dash
 * (`playerActionSystem`, e a IA no `wildBehaviorSystem`/`partyBehaviorSystem`).
 */
export function dashCooldownSystem(context) {
  const { world, delta } = context
  world.query(DashCooldown).updateEach(([cooldown]) => {
    if (cooldown.timeLeft > 0) {
      cooldown.timeLeft = Math.max(0, cooldown.timeLeft - delta)
    }
  })
}
