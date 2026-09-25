export { createEventQueue } from './eventQueue'

export const EVENT_TYPES = {
  ATTACK_RESOLVED: 'attackResolved',
}

/**
 * @typedef {object} AttackResolvedEvent
 * @property {'attackResolved'} type
 * @property {'hit' | 'miss'} result
 * @property {import('koota').Entity} attacker
 * @property {import('koota').Entity | null} target `null` num miss
 * @property {string} attackId id do ataque (`core/data/attacks/<id>`)
 * @property {string} slot `'primary' | 'secondary1-3'`
 * @property {{x:number,y:number,z:number}} origin onde o golpe começou
 * @property {{x:number,y:number,z:number}} impactPoint onde a trajetória terminou
 * @property {{x:number,y:number,z:number} | null} contactPoint onde tocou o alvo (`null` num miss)
 * @property {number} damage dano aplicado (`0` num miss)
 * @property {boolean} critical se o crítico saiu (`false` num miss)
 */

/**
 * O instante ativo de um golpe já resolvido, acertando ou não.
 *
 * - Quem emite: `creatureAttackSystem.js`, no instante `effectAt`, depois
 *   de aplicar o dano (o dano em si é estado e não depende do evento).
 * - Quem consome: `view/systems/hitFlashSystem.js` (brilho no alvo) e
 *   `view/systems/damageNumberSystem.js` (número de dano). É o
 *   ponto de encaixe pra hit stop, reação, knockback, VFX/SFX de impacto e
 *   tremor de câmera.
 * - Drenado uma vez por frame, antes da apresentação; sem consumidor, some.
 *
 * @returns {AttackResolvedEvent}
 */
export function attackResolved({
  attacker,
  target,
  attackId,
  slot,
  origin,
  impactPoint,
  contactPoint,
  damage,
  critical,
}) {
  return {
    type: EVENT_TYPES.ATTACK_RESOLVED,
    result: target ? 'hit' : 'miss',
    attacker,
    target: target ?? null,
    attackId,
    slot,
    origin,
    impactPoint,
    contactPoint: contactPoint ?? null,
    damage: damage ?? 0,
    critical: critical ?? false,
  }
}
