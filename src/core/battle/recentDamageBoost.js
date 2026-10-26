/**
 * Poder maior contra quem levou dano há pouco (o Assurance —
 * docs/features/061-revisao-das-skills.md). Na série o poder dobra se o alvo
 * já apanhou no mesmo turno; no tempo real, se o alvo levou dano de
 * QUALQUER fonte (golpe, tick de condição) há no máximo `window` segundos
 * (decisão do usuário).
 *
 * O golpe declara `damage.recentDamageBoost: { window, multiplier }`. Sem o
 * campo, nada muda.
 *
 * O tempo desde o último dano é o `Vitals.hpDamageAge` (zerado por todo
 * dano, contado pelo `vitalsRegenSystem`).
 */

/** Segundos desde o último dano do alvo, ou `null` se nunca levou. */
export function readTimeSinceDamage(vitals) {
  if (!vitals || !(vitals.hpDamageAge >= 0)) return null
  return vitals.hpDamageAge
}

/**
 * O multiplicador do poder contra este alvo: o `multiplier` do golpe se o
 * dano dele foi há no máximo `window` s; 1 no resto.
 */
export function resolveRecentDamageMultiplier(damage, vitals) {
  const boost = damage?.recentDamageBoost
  if (!boost) return 1
  const since = readTimeSinceDamage(vitals)
  if (since === null || since > boost.window) return 1
  return boost.multiplier
}

/** A seção `damage` com o poder já multiplicado (a mesma, sem bônus). */
export function applyPowerMultiplier(damage, multiplier) {
  if (multiplier === 1) return damage
  return { ...damage, power: damage.power * multiplier }
}
