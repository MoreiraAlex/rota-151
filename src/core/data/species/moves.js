import { getSkill } from '../skills'

/**
 * Golpes de uma criatura (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md) — o lado de DADO, puro: learnset da espécie, condições pra ficar
 * apto e o formato do estado por criatura (`CreatureMoves`,
 * `core/traits/components/creatureMoves.js`).
 *
 * - `species.skills` (`{1,2,3}`) é o KIT INICIAL: nasce aprendido e dominado.
 * - `species.moves` é o LEARNSET: `[{ id, requires?, overrides? }]`. Sem
 *   `requires`, o golpe fica apto de imediato.
 * - Os dois juntos formam a lista de golpes que a criatura pode ter (o kit
 *   também entra: um golpe do kit esquecido pode ser treinado de novo).
 *
 * O estado guarda só o id e o domínio de cada slot; a referência completa
 * (com os `overrides` da espécie) sai daqui, por `resolveSpeciesMoveReference`.
 */

/** Números dos slots de golpe (1 = Q, 2 = E, 3 = R — `secondary1-3`). */
export const MOVE_SLOTS = [1, 2, 3]

/** Domínio de um golpe dominado (o teto). */
export const MAX_MASTERY = 1

/** `'tackle'` ou `{ id, overrides }` → `{ id, overrides }` (ou `null`). */
export function normalizeMoveReference(reference) {
  if (!reference) return null
  if (typeof reference === 'string') return { id: reference, overrides: null }
  if (!reference.id) return null
  return { id: reference.id, overrides: reference.overrides ?? null }
}

/**
 * Referência (`{ id, overrides }`) de um golpe NESTA espécie: procura no kit
 * (`skills`) e depois no learnset (`moves`), pra manter os `overrides` da
 * espécie. Golpe que a espécie não declara cai na definição base (sem
 * overrides); id desconhecido no registro, `null`.
 */
export function resolveSpeciesMoveReference(species, moveId) {
  if (!moveId || !getSkill(moveId)) return null

  for (const reference of Object.values(species?.skills ?? {})) {
    const normalized = normalizeMoveReference(reference)
    if (normalized?.id === moveId) return normalized
  }
  for (const entry of species?.moves ?? []) {
    const normalized = normalizeMoveReference(entry)
    if (normalized?.id === moveId) return normalized
  }
  return { id: moveId, overrides: null }
}

/**
 * Todos os golpes que a espécie pode ter: o kit inicial (sem condição) e o
 * learnset, na ordem, sem repetir id e só com golpes que existem no registro.
 * Cada item: `{ id, requires }` (`requires` `null` = sem condição).
 */
export function listLearnset(species) {
  const seen = new Set()
  const learnset = []
  const push = (reference, requires) => {
    const normalized = normalizeMoveReference(reference)
    if (!normalized || seen.has(normalized.id) || !getSkill(normalized.id)) {
      return
    }
    seen.add(normalized.id)
    learnset.push({ id: normalized.id, requires: requires ?? null })
  }

  for (const slot of MOVE_SLOTS) push(species?.skills?.[slot], null)
  for (const entry of species?.moves ?? []) push(entry, entry?.requires)
  return learnset
}

// Condições que o jogo sabe avaliar. Uma condição fora desta lista conta
// como NÃO cumprida — um golpe nunca fica apto por engano antes da condição
// existir de verdade.
const REQUIREMENT_CHECKS = {
  level: (required, context) => (context.level ?? 1) >= required,
}

/**
 * A criatura cumpre as condições do golpe (`entry.requires`)? Sem
 * `requires`, sim. `context`: `{ level }`.
 */
export function meetsMoveRequirements(entry, context = {}) {
  const requires = entry?.requires
  if (!requires) return true
  return Object.entries(requires).every(([key, required]) => {
    const check = REQUIREMENT_CHECKS[key]
    return !!check && check(required, context)
  })
}

/** Slots vazios: `{ 1: null, 2: null, 3: null }`. */
export function createEmptyMoveSlots() {
  return Object.fromEntries(MOVE_SLOTS.map((slot) => [slot, null]))
}

/**
 * Estado inicial de golpes de uma criatura da espécie: o kit nos slots, todo
 * dominado, e nenhum treino. Espécie sem kit (`null`) = slots vazios.
 */
export function createMovesState(species) {
  const slots = createEmptyMoveSlots()
  for (const slot of MOVE_SLOTS) {
    const reference = normalizeMoveReference(species?.skills?.[slot])
    if (reference && getSkill(reference.id)) {
      slots[slot] = { id: reference.id, mastery: MAX_MASTERY }
    }
  }
  return { slots, training: {} }
}

/** Número do slot em que o golpe está (ou `null`, se não está equipado). */
export function findMoveSlot(movesState, moveId) {
  for (const slot of MOVE_SLOTS) {
    if (movesState?.slots?.[slot]?.id === moveId) return slot
  }
  return null
}

/** Primeiro slot vazio (ou `null`, com os 3 ocupados). */
export function findEmptyMoveSlot(movesState) {
  for (const slot of MOVE_SLOTS) {
    if (!movesState?.slots?.[slot]) return slot
  }
  return null
}

/**
 * Em que ponto do ciclo o golpe está pra esta criatura:
 * `'locked'` (não cumpre as condições) → `'apt'` (cumpre, falta treinar) →
 * `'ready'` (treino completo, falta escolher o slot) → `'learned'` (num slot,
 * domínio abaixo do teto) → `'mastered'`. "Em treino" não é estado de dado:
 * é a criatura com o trait `Training` naquele golpe.
 */
export function resolveMoveStatus(movesState, entry, context = {}) {
  const slot = findMoveSlot(movesState, entry.id)
  if (slot != null) {
    const { mastery } = movesState.slots[slot]
    return mastery >= MAX_MASTERY ? 'mastered' : 'learned'
  }
  if (!meetsMoveRequirements(entry, context)) return 'locked'
  return (movesState?.training?.[entry.id] ?? 0) >= 1 ? 'ready' : 'apt'
}

/** Cópia independente de um estado de golpes (slots e treino). */
export function cloneMovesState(movesState) {
  const slots = createEmptyMoveSlots()
  for (const slot of MOVE_SLOTS) {
    const move = movesState?.slots?.[slot]
    slots[slot] = move ? { ...move } : null
  }
  return { slots, training: { ...(movesState?.training ?? {}) } }
}
