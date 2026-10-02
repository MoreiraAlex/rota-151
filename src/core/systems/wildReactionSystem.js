import {
  resolveRetaliateChance,
  rollAttackReaction,
} from '../battle/wildBehavior'
import {
  fugirDoJogador,
  perseguirJogador,
  registrarAmeaca,
} from '../actions/wildBehavior'
import { EVENT_TYPES } from '../events'
import { gameplayRng } from '../rng'
import { Fainted, Vitals, WildBehavior } from '../traits'

/**
 * Reação de uma selvagem ao APANHAR (`attackResolved` com `hit`, lido de
 * `context.events.stepEvents()` — só o que saiu neste passo). Todo golpe
 * soma o dano na tabela de ameaça dela (`registrarAmeaca`, `Threat`) —
 * perseguindo, ela mira quem mais causou dano (`wildBehaviorSystem.js`).
 * Além disso:
 * - hostil: persegue (provocada — limite maior, mesmo se foi atingida de
 *   longe, fora do raio de aggro);
 * - pacífica vagando: sorteia revidar (persegue, provocada) ou fugir
 *   (`rollAttackReaction`), com a chance pela "coragem" dela
 *   (`resolveRetaliateChance`: a vida dela, o tamanho do golpe, a vida do
 *   agressor). Já fugindo ou perseguindo, mantém o que está fazendo;
 * - abalada (`shaken`, fugiu com a vida baixa): continua fugindo.
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
    reactToHit(event.target, event.target.get(WildBehavior), event)
  }
}

function reactToHit(entity, behavior, event) {
  // Abalada (fugiu com a vida baixa): apanhando, continua fugindo.
  if (behavior.shaken) {
    if (behavior.state !== 'flee') fugirDoJogador(entity)
    return
  }
  if (behavior.temperament === 'hostile') {
    perseguirJogador(entity, { provoked: true })
    return
  }
  if (behavior.state !== 'wander') return

  const chance = resolveRetaliateChance(
    entity.get(Vitals),
    event.attacker?.isAlive?.() ? event.attacker.get(Vitals) : null,
    event.damage,
  )
  if (rollAttackReaction(gameplayRng, chance) === 'retaliate') {
    perseguirJogador(entity, { provoked: true })
  } else {
    fugirDoJogador(entity)
  }
}
