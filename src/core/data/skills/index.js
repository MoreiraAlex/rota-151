/**
 * Registro de GOLPES (skills) de criatura — os ataques compartilhados entre
 * espécies, nos slots `secondary1-3` (Q/E/R). São os ÚNICOS ataques da
 * criatura: não existe ataque básico (docs/features/039-tipos-e-combate-classico.md, Parte 5). Quem resolve "qual golpe este slot dispara" é
 * `resolveCreatureAttack(species, slot)`, `core/battle/creatureAttack.js`.
 *
 * Mesma forma de `core/data/species/index.js`/`core/data/items/index.js`:
 * este arquivo é o mecanismo (`getSkill`/`listSkills`/`resolveSkill`,
 * `_template/`). Histórico da camada: docs/features/025-ataque-comum-de-
 * criatura.md ("reorganização da config") e docs/features/033-skills-de-
 * combate-e-vfx.md.
 *
 * Pra adicionar uma habilidade:
 * 1) copia `_template/` pra `<id>/`
 * 2) preenche `index.js`
 * 3) importa aqui embaixo e adiciona uma linha no SKILL_REGISTRY
 */
import { TACKLE_SKILL } from './tackle'
import { PUNCH_SKILL } from './punch'
import { VINE_WHIP_SKILL } from './vine-whip'
import { EMBER_SKILL } from './ember'
import { WHIRLPOOL_SKILL } from './whirlpool'
import { RAZOR_LEAF_SKILL } from './razor-leaf'
import { FLAMETHROWER_SKILL } from './flamethrower'
import { GROWL_SKILL } from './growl'
import { SMOKESCREEN_SKILL } from './smokescreen'
import { GROWTH_SKILL } from './growth'
import { LEECH_SEED_SKILL } from './leech-seed'
import { WATER_GUN_SKILL } from './water-gun'
import { TAIL_WHIP_SKILL } from './tail-whip'

export const SKILL_REGISTRY = {
  [TACKLE_SKILL.id]: TACKLE_SKILL,
  [PUNCH_SKILL.id]: PUNCH_SKILL,
  [VINE_WHIP_SKILL.id]: VINE_WHIP_SKILL,
  [EMBER_SKILL.id]: EMBER_SKILL,
  [FLAMETHROWER_SKILL.id]: FLAMETHROWER_SKILL,
  [GROWL_SKILL.id]: GROWL_SKILL,
  [SMOKESCREEN_SKILL.id]: SMOKESCREEN_SKILL,
  [GROWTH_SKILL.id]: GROWTH_SKILL,
  [LEECH_SEED_SKILL.id]: LEECH_SEED_SKILL,
  [WATER_GUN_SKILL.id]: WATER_GUN_SKILL,
  [WHIRLPOOL_SKILL.id]: WHIRLPOOL_SKILL,
  [RAZOR_LEAF_SKILL.id]: RAZOR_LEAF_SKILL,
  [TAIL_WHIP_SKILL.id]: TAIL_WHIP_SKILL,
}

export function getSkill(id, registry = SKILL_REGISTRY) {
  return registry[id] ?? null
}

export function listSkills(registry = SKILL_REGISTRY) {
  return Object.values(registry)
}

// Seções da definição de ataque que aceitam override CAMPO A CAMPO (não
// substituição inteira) — ver docstring de `resolveSkill`
// abaixo. `duration`/`effectAt`/`range`/`radius`/`staminaCost`/`cooldown`
// (fora de seção nenhuma) já são sobrescritos direto pelo spread, não
// precisam entrar aqui.
const OVERRIDABLE_SECTIONS = ['visual', 'audio', 'animation']

/**
 * Resolve a definição de VERDADE de uma habilidade a partir da referência
 * da espécie (`species.skills[N]`, ver `core/data/species/<id>/index.js`)
 * — aceita duas formas:
 * - string (`'tackle'`) — usa a definição BASE (`getSkill`) sem
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
 * ou id desconhecido, devolve `null` — quem chama trata
 * isso como "esta criatura não tem esse ataque", sem quebrar (mesmo
 * fallback gracioso de sempre).
 */
export function resolveSkill(reference) {
  if (!reference) return null

  const id = typeof reference === 'string' ? reference : reference.id
  const base = getSkill(id)
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
