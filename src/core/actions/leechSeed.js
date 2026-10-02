import { LeechSeed, SeededBy } from '../traits'

/**
 * Planta a semente do Leech Seed em `target` (efeito `{ type: 'leechSeed',
 * fraction, interval, duration }` da skill — ver `applyAttackEffects`,
 * `creatureAttackSystem.js`), plantada por `source`. Já com semente: RENOVA
 * o tempo (`duration`), mantém o ritmo da próxima drenagem e passa a curar
 * quem plantou agora — mesma regra de renovar dos estágios de atributo.
 * Devolve `false` se o efeito não for de semente.
 */
export function plantarSemente(target, source, effect) {
  if (effect?.type !== 'leechSeed') return false
  const { fraction = 0, interval = 0, duration = 0 } = effect

  if (target.has(LeechSeed)) {
    target.set(LeechSeed, { timeLeft: duration, fraction, interval })
  } else {
    target.add(
      LeechSeed({
        timeLeft: duration,
        tickTimer: interval,
        fraction,
        interval,
      }),
    )
  }
  if (source?.isAlive?.()) target.add(SeededBy(source))
  return true
}

/**
 * Quanto uma drenagem tira (HP inteiro): `fraction` do HP máximo, nunca menos
 * que 1 nem mais que o HP que sobra — a regra do Pokémon (1/8 do máximo).
 */
export function resolveLeechDrain(vitals, fraction) {
  const amount = Math.max(1, Math.floor(vitals.maxHp * fraction))
  return Math.min(amount, vitals.hp)
}
