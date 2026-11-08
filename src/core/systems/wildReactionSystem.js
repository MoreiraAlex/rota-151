import { perseguirJogador, registrarAmeaca } from '../actions/wildBehavior'
import { EVENT_TYPES } from '../events'
import { Fainted, WildBehavior } from '../traits'

/**
 * Reação de uma selvagem ao APANHAR (`attackResolved` com `hit`, lido de
 * `context.events.stepEvents()` — só o que saiu neste passo). Todo golpe
 * soma o dano na tabela de ameaça dela (`registrarAmeaca`, `Threat`) —
 * perseguindo, ela mira quem mais causou dano (`wildBehaviorSystem.js`).
 * E ela parte para cima, provocada (limite de perseguição maior, mesmo
 * atingida de longe): a hostil e também a pacífica — na luta ninguém foge
 * (a fuga clássica, docs/features/063-revisao-da-ia-selvagem.md). Apanhar
 * pula a percepção (o alerta). Saindo do mapa, não reage (nem é alvo).
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
    if (event.target.get(WildBehavior).state === 'leave') continue

    registrarAmeaca(event.target, event.attacker, event.damage)
    perseguirJogador(event.target, { provoked: true })
  }
}
