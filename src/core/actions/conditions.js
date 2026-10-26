import { getCondition, resolveConditionEffect } from '../data/conditions'
import { getSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import {
  ActionState,
  Conditions,
  StoredConditions,
  conditionSource,
  resolveCreatureSpeciesId,
} from '../traits'
import { iniciarAtordoamento } from './hitStun'

/**
 * Condições (docs/features/061-revisao-das-skills.md, "Condições
 * padronizadas"): aplicar, ler e levar pra bola. Quem conta o tempo e tira
 * HP é o `conditionSystem`; dentro da bola, o `storedConditionSystem`.
 */

/**
 * Aplica em `target` a condição do efeito `{ type: 'condition', condition,
 * chance, ... }` de um golpe de `source`. Sorteia `chance` (`rng`, sempre de
 * fora — regra 3.5); alvo de um tipo em `immuneTypes` não pega. Já com a
 * mesma condição: RENOVA o tempo e os valores, mantém o ritmo do próximo
 * tick e troca quem aplicou.
 *
 * Condição que INTERROMPE (`interrupt`, ex.: o recuo do Bite) não fica na
 * lista: na hora, o alvo para o que estava fazendo e fica atordoado como no
 * golpe interrompido (`iniciarAtordoamento`, a animação de hit).
 *
 * Devolve `null` se o efeito não for de condição; senão `true`/`false`
 * (pegou ou não).
 */
export function aplicarCondicao(target, source, effect, rng) {
  const condition = resolveConditionEffect(effect)
  if (!condition) return null
  if (isImmune(target, condition)) return false
  if (condition.chance < 1 && rng() >= condition.chance) return false

  if (condition.interrupt) {
    if (!target.has(ActionState)) return false
    const action = target.get(ActionState)
    iniciarAtordoamento(action, getSpecies(resolveCreatureSpeciesId(target)))
    target.set(ActionState, action)
    return true
  }

  const entry = {
    id: condition.id,
    timeLeft: condition.duration,
    tickTimer: condition.tick?.interval ?? 0,
    fraction: condition.tick?.fraction ?? 0,
    interval: condition.tick?.interval ?? 0,
    to: condition.tick?.to ?? null,
    modifiers: { ...condition.modifiers },
    // atordoa enquanto dura (`creatureHitStunSystem`)
    stun: condition.stun === true,
  }
  const list = target.get(Conditions)?.list ?? []
  const current = list.find((item) => item.id === condition.id)
  if (current) {
    Object.assign(current, { ...entry, tickTimer: current.tickTimer })
  } else if (target.has(Conditions)) {
    list.push(entry)
  } else {
    target.add(Conditions({ list: [entry] }))
  }
  if (source?.isAlive?.()) target.add(conditionSource(condition.id)(source))
  return true
}

function isImmune(target, condition) {
  if (!condition.immuneTypes?.length) return false
  const species = getSpecies(resolveCreatureSpeciesId(target))
  return resolveSpeciesTypes(species).some((type) =>
    condition.immuneTypes.includes(type),
  )
}

/** A entrada da condição `id` em `entity`, ou `null`. */
export function readCondition(entity, id) {
  return entity?.get?.(Conditions)?.list.find((item) => item.id === id) ?? null
}

/** Ids das condições ativas de `entity`, na ordem em que entraram. */
export function listActiveConditions(entity) {
  return entity?.get?.(Conditions)?.list.map((item) => item.id) ?? []
}

/**
 * Multiplicador do atributo `stat` de `entity` pelas condições ativas (o
 * produto dos `modifiers`); `1` sem nenhuma. Ex.: o Ataque de quem está
 * queimado — quem decide onde vale é o `computeDamage`.
 */
export function readConditionModifier(entity, stat) {
  const list = entity?.get?.(Conditions)?.list ?? []
  return list.reduce(
    (product, item) => product * (item.modifiers?.[stat] ?? 1),
    1,
  )
}

/** Alguma condição ativa de `entity` atordoa (`stun`, ex.: a paralisia)? */
export function isConditionStunned(entity) {
  return (entity?.get?.(Conditions)?.list ?? []).some((item) => item.stun)
}

/**
 * Todos os multiplicadores de atributo de `entity` (`{ attack: …, … }`, só
 * os que alguma condição mexe).
 */
export function readConditionModifiers(entity) {
  const modifiers = {}
  for (const item of entity?.get?.(Conditions)?.list ?? []) {
    for (const [stat, value] of Object.entries(item.modifiers ?? {})) {
      modifiers[stat] = (modifiers[stat] ?? 1) * value
    }
  }
  return modifiers
}

/**
 * Tira de `entity` as condições `ids` que ela tiver (e quem aplicou cada
 * uma) — ex.: o Rapid Spin se soltando do Wrap e da semente. Devolve as que
 * saíram.
 */
export function removerCondicoesPorId(entity, ids) {
  const list = entity?.get?.(Conditions)?.list ?? []
  const removed = list
    .filter((item) => ids.includes(item.id))
    .map((item) => item.id)
  if (!removed.length) return removed
  for (const id of removed) entity.remove(conditionSource(id)('*'))
  const rest = list.filter((item) => !removed.includes(item.id))
  if (rest.length) entity.set(Conditions, { list: rest })
  else entity.remove(Conditions)
  return removed
}

/** Tira todas as condições de `entity` (e quem aplicou cada uma). */
export function removerCondicoes(entity) {
  for (const id of listActiveConditions(entity)) {
    entity.remove(conditionSource(id)('*'))
  }
  if (entity?.has?.(Conditions)) entity.remove(Conditions)
}

/**
 * Quanto um tick tira (HP inteiro): `fraction` do HP máximo, nunca menos que
 * 1 nem mais que o HP que sobra — a regra do Pokémon.
 */
export function resolveConditionTick(vitals, fraction) {
  const amount = Math.max(1, Math.floor(vitals.maxHp * fraction))
  return Math.min(amount, vitals.hp)
}

/**
 * Condições dentro da bola (docs/features/043-captura.md): a criatura que
 * entra na bola — recolhida ou capturada — leva pro registro
 * (`StoredConditions`) as condições que ficam na bola (`keepsInBall`), elas
 * continuam correndo lá dentro (`storedConditionSystem`) e voltam pra
 * criatura ao invocar.
 */

/**
 * Copia as condições da `creature` (em campo) que ficam na bola pro registro
 * `pokemon`. Sem nenhuma, o registro fica sem `StoredConditions`.
 */
export function guardarCondicoes(creature, pokemon) {
  if (!pokemon?.isAlive?.()) return
  const list = listStorable(creature?.get?.(Conditions)?.list)
  if (!list.length) {
    if (pokemon.has(StoredConditions)) pokemon.remove(StoredConditions)
    return
  }
  if (pokemon.has(StoredConditions)) pokemon.set(StoredConditions, { list })
  else pokemon.add(StoredConditions({ list }))
}

/**
 * As entradas de `list` que ficam na bola, ainda com tempo, copiadas — a
 * mesma regra do save de quem está em campo.
 */
export function listStorable(list = []) {
  return list
    .filter((item) => item.timeLeft > 0 && getCondition(item.id)?.keepsInBall)
    .map(copyEntry)
}

function copyEntry(item) {
  return { ...item, modifiers: { ...item.modifiers } }
}

/**
 * Devolve as condições guardadas no `pokemon` pra `creature` recém-invocada,
 * com o tempo que falta, e limpa o registro. Quem aplicou não volta (o
 * crédito do XP é só de quem lutou em campo).
 */
export function devolverCondicoes(pokemon, creature) {
  const stored = pokemon?.get?.(StoredConditions)
  if (!stored) return
  pokemon.remove(StoredConditions)
  if (!stored.list.length || !creature?.isAlive?.()) return
  removerCondicoes(creature)
  creature.add(Conditions({ list: stored.list.map(copyEntry) }))
}

/**
 * Avança UMA condição guardada em `delta` segundos sobre a vida guardada
 * `vitals` — mesmas regras do `conditionSystem` (tick a cada `interval`,
 * conta de `resolveConditionTick`; na bola não há pra quem curar). Puro:
 * devolve `{ entry, vitals }` novos (`entry` `null` quando acabou o tempo ou
 * a vida zerou).
 */
export function avancarCondicaoGuardada(entry, vitals, delta) {
  const next = copyEntry(entry)
  let nextVitals = vitals
  next.timeLeft -= delta
  next.tickTimer -= delta
  while (next.tickTimer <= 0 && next.interval > 0 && nextVitals.hp > 0) {
    next.tickTimer += next.interval
    const damage = resolveConditionTick(nextVitals, next.fraction)
    nextVitals = { ...nextVitals, hp: nextVitals.hp - damage }
  }
  const over = next.timeLeft <= 0 || nextVitals.hp <= 0
  return { entry: over ? null : next, vitals: nextVitals }
}
