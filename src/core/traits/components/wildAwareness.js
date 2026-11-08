import { trait } from 'koota'

/**
 * Percepção de uma selvagem (docs/features/063-revisao-da-ia-selvagem.md,
 * `wildAwarenessSystem.js`): ela te percebe (cone de visão + raio,
 * `core/battle/perception.js`), para te encarando com a exclamação e decide
 * pelo temperamento.
 *
 * - `state`:
 *   - `'unaware'`: não viu ninguém;
 *   - `'noticed'`: viu `target` e está parada encarando, com `timer` (s)
 *     até decidir (`PERCEPTION.ALERT_TIME`);
 *   - `'reacted'`: já decidiu (ficou, partiu para cima ou está saindo) — não
 *     percebe de novo até ninguém do lado do jogador estar a
 *     `PERCEPTION.FORGET_RADIUS`.
 * - `target`: quem ela viu (só no `'noticed'`).
 * - `emote`: o que aparece acima da cabeça — `null`, `'alert'` (a
 *   exclamação), `'angry'` (partiu para cima) ou `'fear'` (saindo). Só dado:
 *   o desenho é da view (`view/scene/WildEmote.jsx`).
 * - `emoteTimer` (s): quanto falta para o `'angry'` sumir
 *   (`PERCEPTION.ANGRY_DURATION`); os outros duram enquanto o estado durar.
 *
 * Só as selvagens do mundo têm (`nascerSelvagem`); as dos laboratórios não.
 * Dono de escrita: as actions de `core/actions/wildBehavior.js`.
 */
export const WildAwareness = trait({
  state: 'unaware',
  target: null,
  timer: 0,
  emote: null,
  emoteTimer: 0,
})
