import { trait } from 'koota'

/**
 * Recarga do dash — `timeLeft` (s) até poder dar outro. Igual pra todos,
 * jogador e IA (`PLAYER_ACTIONS.dash.COOLDOWN`,
 * docs/features/035-balanceamento-de-acoes-e-correcoes.md). Entra no primeiro dash
 * (`travarRecargaDoDash`, `core/actions/dash.js`); sem o trait, o dash está
 * pronto.
 *
 * Donos de escrita: `travarRecargaDoDash` (trava) e `dashCooldownSystem.js`
 * (contagem).
 */
export const DashCooldown = trait({
  timeLeft: 0,
})
