/**
 * Registro de ataques/skills de criatura. Mesma forma de
 * `core/data/species/index.js`/`core/data/items/index.js`: este arquivo
 * é o mecanismo (`getAttack`/`listAttacks`/`resolveCreatureAttack`,
 * `_template/`); conteúdo de ataque de verdade (golpe elemental, chicote
 * etc.) é livre pra adicionar quando quiser — ver docs/features/025-
 * ataque-comum-de-criatura.md, seção "reorganização da config", pro
 * porquê desta camada existir (antes, cada espécie inlinava sua própria
 * cópia de `actions.attack`).
 *
 * Pra adicionar um ataque:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no ATTACK_REGISTRY
 */
import { SCRATCH_ATTACK } from './scratch'
import { PUNCH_ATTACK } from './punch'
import { VINE_WHIP_ATTACK } from './vine-whip'
import { EMBER_ATTACK } from './ember'
import { WHIRLPOOL_ATTACK } from './whirlpool'
import { RAZOR_LEAF_ATTACK } from './razor-leaf'

export const ATTACK_REGISTRY = {
  [SCRATCH_ATTACK.id]: SCRATCH_ATTACK,
  [PUNCH_ATTACK.id]: PUNCH_ATTACK,
  [VINE_WHIP_ATTACK.id]: VINE_WHIP_ATTACK,
  [EMBER_ATTACK.id]: EMBER_ATTACK,
  [WHIRLPOOL_ATTACK.id]: WHIRLPOOL_ATTACK,
  [RAZOR_LEAF_ATTACK.id]: RAZOR_LEAF_ATTACK,
}

export function getAttack(id, registry = ATTACK_REGISTRY) {
  return registry[id] ?? null
}

export function listAttacks(registry = ATTACK_REGISTRY) {
  return Object.values(registry)
}

// Seções da definição de ataque que aceitam override CAMPO A CAMPO (não
// substituição inteira) — ver docstring de `resolveCreatureAttack`
// abaixo. `duration`/`effectAt`/`range`/`radius`/`staminaCost`/`cooldown`
// (fora de seção nenhuma) já são sobrescritos direto pelo spread, não
// precisam entrar aqui.
const OVERRIDABLE_SECTIONS = ['visual', 'audio', 'animation']

/**
 * Resolve a definição de ataque de VERDADE a partir de uma referência de
 * espécie (`species.attacks.<slot>`, ver `core/data/species/<id>/index.js`)
 * — aceita duas formas:
 * - string (`'scratch'`) — usa a definição BASE (`getAttack`) sem
 *   nenhuma alteração; a forma mais comum, "esta criatura usa o ataque X
 *   do jeito que ele já é".
 * - `{ id, overrides }` — mesma base, mas com `overrides` mesclado por
 *   cima. Pedido explícito do usuário: "caso uma criatura precise de um
 *   parâmetro diferente do padrão... ela deve poder sobrescrever
 *   especificamente esse parâmetro sem precisar duplicar toda a
 *   configuração do ataque". `overrides` pode conter qualquer campo de
 *   topo (`staminaCost`, `range`, ...) OU qualquer uma das seções em
 *   `OVERRIDABLE_SECTIONS` (`visual`/`audio`/`animation`) — dentro de uma
 *   seção, a mescla é CAMPO A CAMPO (`{ visual: { rotationOffset: {...} } }`
 *   não apaga `visual.effectGroup`/`.revealDuration` da base, só troca
 *   `rotationOffset`).
 *
 * Sem referência (`null`/`undefined`, espécie sem esse slot configurado)
 * ou id desconhecido, devolve `null` — `creatureAttackSystem.js` trata
 * isso como "esta criatura não tem esse ataque", sem quebrar (mesmo
 * fallback gracioso de sempre).
 */
export function resolveCreatureAttack(reference) {
  if (!reference) return null

  const id = typeof reference === 'string' ? reference : reference.id
  const base = getAttack(id)
  if (!base) return null

  const overrides = typeof reference === 'string' ? null : reference.overrides
  if (!overrides) return base

  const resolved = { ...base, ...overrides }
  for (const section of OVERRIDABLE_SECTIONS) {
    if (overrides[section]) {
      resolved[section] = { ...base[section], ...overrides[section] }
    }
  }
  return resolved
}
