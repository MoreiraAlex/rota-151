/**
 * Registro de CONDIÇÕES — o que um golpe deixa no alvo e dura um tempo
 * (docs/features/061-revisao-das-skills.md, "Condições padronizadas"). Mesma
 * forma de `../skills/index.js`.
 *
 * Pra adicionar uma condição:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no CONDITION_REGISTRY
 */
import { BURN_CONDITION } from './burn'
import { LEECH_SEED_CONDITION } from './leech-seed'
import { TANGLED_CONDITION } from './tangled'
import { BOUND_CONDITION } from './bound'
import { PARALYSIS_CONDITION } from './paralysis'
import { FLINCH_CONDITION } from './flinch'
import { POISON_CONDITION } from './poison'
import { FOCUSED_CONDITION } from './focused'

export const CONDITION_REGISTRY = {
  [BURN_CONDITION.id]: BURN_CONDITION,
  [LEECH_SEED_CONDITION.id]: LEECH_SEED_CONDITION,
  [TANGLED_CONDITION.id]: TANGLED_CONDITION,
  [BOUND_CONDITION.id]: BOUND_CONDITION,
  [PARALYSIS_CONDITION.id]: PARALYSIS_CONDITION,
  [FLINCH_CONDITION.id]: FLINCH_CONDITION,
  [POISON_CONDITION.id]: POISON_CONDITION,
  [FOCUSED_CONDITION.id]: FOCUSED_CONDITION,
}

export function getCondition(id, registry = CONDITION_REGISTRY) {
  return registry[id] ?? null
}

export function listConditions(registry = CONDITION_REGISTRY) {
  return Object.values(registry)
}

/**
 * A condição que um efeito `{ type: 'condition', condition, chance, ... }`
 * aplica, já com o que o golpe troca por cima: `duration` e `immuneTypes`
 * inteiros, `tick` e `modifiers` campo a campo. Devolve `{ ...condição,
 * chance }`, ou `null` se o efeito não for de condição ou o id não existir.
 */
export function resolveConditionEffect(effect, registry = CONDITION_REGISTRY) {
  if (effect?.type !== 'condition') return null
  const base = getCondition(effect.condition, registry)
  if (!base) return null
  return {
    ...base,
    duration: effect.duration ?? base.duration,
    tick: base.tick || effect.tick ? { ...base.tick, ...effect.tick } : null,
    modifiers: { ...base.modifiers, ...effect.modifiers },
    immuneTypes: effect.immuneTypes ?? base.immuneTypes,
    chance: effect.chance ?? 1,
  }
}
