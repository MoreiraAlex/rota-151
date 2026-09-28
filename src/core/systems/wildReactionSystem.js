import { rollAttackReaction } from '../battle/wildBehavior'
import {
  fugirDoJogador,
  perseguirJogador,
  registrarAmeaca,
} from '../actions/wildBehavior'
import { EVENT_TYPES } from '../events'
import { gameplayRng } from '../rng'
import { Fainted, WildBehavior } from '../traits'

/**
 * Reação de uma selvagem ao APANHAR (`attackResolved` com `hit`, lido de
 * `context.events.stepEvents()` — só o que saiu neste passo). Todo golpe
 * soma o dano na tabela de ameaça dela (`registrarAmeaca`, `Threat`) —
 * perseguindo, ela mira quem mais causou dano (`wildBehaviorSystem.js`).
 * Além disso:
 * - hostil: persegue (provocada — limite maior, mesmo se foi atingida de
 *   longe, fora do raio de aggro);
 * - pacífica vagando: sorteia revidar (persegue, provocada) ou fugir
 *   (`rollAttackReaction`). Já fugindo ou perseguindo, mantém o que está
 *   fazendo.
 *
 * Headless. Fase: events (depois de todo o `simulation` do passo — o golpe
 * já foi resolvido); o movimento da reação começa no próximo passo.
 */
export function wildReactionSystem(context) {
  const { events } = context

  for (const event of events.stepEvents()) {
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.result !== 'hit') continue
    if (!event.target.has(WildBehavior)) continue
    // O golpe que derrubou: desmaiada não reage (acorda vagando).
    if (event.target.has(Fainted)) continue

    registrarAmeaca(event.target, event.attacker, event.damage)
    reactToHit(event.target, event.target.get(WildBehavior))
  }
}

function reactToHit(entity, behavior) {
  if (behavior.temperament === 'hostile') {
    perseguirJogador(entity, { provoked: true })
    return
  }
  if (behavior.state !== 'wander') return

  if (rollAttackReaction(gameplayRng) === 'retaliate') {
    perseguirJogador(entity, { provoked: true })
  } else {
    fugirDoJogador(entity)
  }
}
