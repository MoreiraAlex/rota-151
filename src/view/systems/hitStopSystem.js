import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { advanceHitStops, startHitStop } from '@/view/registry/hitStopRegistry'

/**
 * Hit stop: a cada acerto do frame (`attackResolved` com `result: 'hit'`),
 * congela a animação do atacante e do alvo por `HIT_STOP.DURATION` (mais
 * no crítico) — o "peso" do golpe que se sente em jogo de ação. Só visual:
 * a simulação segue normal, `animationSystem` é que deixa de avançar o
 * relógio dessas entidades (`resolveHitStopScale`). Ticks de ataque
 * canalizado (`event.channel`) não disparam — travariam o canal a cada
 * tick.
 *
 * Fase: presentation, ANTES do `animationSystem` (o congelamento vale no
 * mesmo frame do acerto).
 */
export function hitStopSystem(context) {
  const { delta, frameEvents = [] } = context
  const { DURATION, CRIT_DURATION } = GAME_CONFIG.FEEDBACK.HIT_STOP

  advanceHitStops(delta)

  for (const event of frameEvents) {
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit' || event.channel || event.status) continue
    const duration = event.critical ? CRIT_DURATION : DURATION
    startHitStop(event.attacker, duration)
    startHitStop(event.target, duration)
  }
}
