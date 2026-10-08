import { Burn, BurnedBy, StoredConditions } from '../traits'
import { resolveBurnDamage } from './burn'

/**
 * Condições dentro da bola (docs/features/043-captura.md): a criatura que
 * entra na bola — recolhida ou capturada — leva as condições pro registro
 * (`StoredConditions`), elas continuam correndo lá dentro
 * (`storedConditionSystem`) e voltam pra criatura ao invocar. Hoje só a
 * queimadura.
 */

/**
 * Copia as condições da `creature` (em campo) pro registro `pokemon`. Sem
 * condição nenhuma, o registro fica sem `StoredConditions`.
 */
export function guardarCondicoes(creature, pokemon) {
  if (!pokemon?.isAlive?.()) return
  const burn = creature?.get?.(Burn)
  if (!burn || burn.timeLeft <= 0) {
    if (pokemon.has(StoredConditions)) pokemon.remove(StoredConditions)
    return
  }
  const stored = { burn: { ...burn } }
  if (pokemon.has(StoredConditions)) pokemon.set(StoredConditions, stored)
  else pokemon.add(StoredConditions(stored))
}

/**
 * Devolve as condições guardadas no `pokemon` pra `creature` recém-invocada,
 * com o tempo que falta, e limpa o registro. Quem queimou não volta (o
 * crédito do XP é só de quem lutou em campo).
 */
export function devolverCondicoes(pokemon, creature) {
  const stored = pokemon?.get?.(StoredConditions)
  if (!stored) return
  pokemon.remove(StoredConditions)
  if (!stored.burn || !creature?.isAlive?.()) return
  if (creature.has(Burn)) creature.set(Burn, { ...stored.burn })
  else creature.add(Burn({ ...stored.burn }))
  creature.remove(BurnedBy('*'))
}

/**
 * Avança a queimadura guardada em `delta` segundos sobre a vida guardada
 * `vitals` — mesmas regras do `burnSystem` (dano a cada `interval`, conta
 * de `resolveBurnDamage`). Puro: devolve `{ burn, vitals }` novos (`burn`
 * `null` quando acabou o tempo ou a vida zerou).
 */
export function avancarQueimaduraGuardada(burn, vitals, delta) {
  const next = { ...burn }
  let nextVitals = vitals
  next.timeLeft -= delta
  next.tickTimer -= delta
  while (next.tickTimer <= 0 && next.interval > 0 && nextVitals.hp > 0) {
    next.tickTimer += next.interval
    const damage = resolveBurnDamage(nextVitals, next.fraction)
    nextVitals = { ...nextVitals, hp: nextVitals.hp - damage }
  }
  const over = next.timeLeft <= 0 || nextVitals.hp <= 0
  return { burn: over ? null : next, vitals: nextVitals }
}
