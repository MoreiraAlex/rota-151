import { SKILL_REGISTRY, getSkill } from '@/core/data/skills'
import { listSpecies } from '@/core/data/species'
import { normalizeMoveReference } from '@/core/data/species/moves'

/**
 * O laboratório de golpes (docs/features/061-revisao-das-skills.md, Parte 1)
 * ajusta os golpes AO VIVO mexendo nos mesmos objetos que o jogo lê — a base
 * no `SKILL_REGISTRY`, a entrada do golpe na espécie (`moves`) e o
 * trigger de acerto dela (`body.trigger`) —, sem
 * gravar nada em arquivo. Ao sair do laboratório tudo volta ao que veio dos
 * arquivos (`restoreSkillData`).
 */

/** Cópia do que vai ser mexido: todas as bases e as referências das espécies. */
export function captureSkillData() {
  return {
    skills: structuredClone(SKILL_REGISTRY),
    species: Object.fromEntries(
      listSpecies().map((species) => [
        species.id,
        {
          skills: structuredClone(species.skills ?? null),
          moves: structuredClone(species.moves ?? null),
          trigger: structuredClone(species.body?.trigger ?? null),
        },
      ]),
    ),
  }
}

// Troca o CONTEÚDO do objeto, mantendo a referência (quem já guardou o
// objeto continua vendo o valor novo).
function replaceContents(target, source) {
  for (const key of Object.keys(target)) delete target[key]
  Object.assign(target, structuredClone(source))
}

/** Desfaz tudo o que o laboratório mexeu (`captureSkillData`). */
export function restoreSkillData(snapshot) {
  for (const [id, skill] of Object.entries(snapshot.skills)) {
    const current = getSkill(id)
    if (current) replaceContents(current, skill)
  }
  for (const species of listSpecies()) {
    const saved = snapshot.species[species.id]
    if (!saved) continue
    if (saved.skills) species.skills = structuredClone(saved.skills)
    if (saved.moves) species.moves = structuredClone(saved.moves)
    restoreTrigger(snapshot, species)
  }
}

/**
 * Põe `trigger` (o `body.trigger` inteiro, `core/battle/hitTrigger.js`) na
 * espécie, no lugar; `null` tira (o trigger volta a ser a cápsula da física).
 */
export function applyLiveTrigger(species, trigger) {
  if (!species?.body) return
  if (trigger) species.body.trigger = structuredClone(trigger)
  else delete species.body.trigger
}

/** Volta o trigger da espécie ao que veio do arquivo. */
export function restoreTrigger(snapshot, species) {
  applyLiveTrigger(species, snapshot.species[species.id]?.trigger ?? null)
}

/** Põe `base` como a definição do golpe `id` (no lugar). */
export function applyLiveBase(id, base) {
  const current = getSkill(id)
  if (current) replaceContents(current, base)
}

/**
 * Onde o golpe está na espécie: `{ where: 'moves', index, reference }` — a
 * entrada dele em `moves`, onde ficam os overrides (o kit, `skills`, só
 * aponta o id); `null` se não está. `reference` é `{ id, overrides,
 * requires }`.
 */
export function findSpeciesMove(species, moveId) {
  const moves = species?.moves ?? []
  for (let index = 0; index < moves.length; index++) {
    const reference = normalizeMoveReference(moves[index])
    if (reference?.id === moveId) {
      return {
        where: 'moves',
        index,
        reference: { ...reference, requires: moves[index].requires ?? null },
      }
    }
  }
  return null
}

/**
 * Põe `overrides` na entrada do golpe em `moves` (no lugar). Sem overrides,
 * a entrada volta à forma curta (`{ id, requires? }`).
 */
export function applyLiveOverrides(species, moveId, overrides) {
  const found = findSpeciesMove(species, moveId)
  if (!found) return
  const hasOverrides = overrides && Object.keys(overrides).length > 0
  const copy = hasOverrides ? structuredClone(overrides) : null

  const entry = { id: moveId }
  if (found.reference.requires) entry.requires = found.reference.requires
  if (copy) entry.overrides = copy
  species.moves[found.index] = entry
}

/**
 * Volta UM golpe ao que veio dos arquivos (`captureSkillData`): a base dele e
 * a entrada dele na espécie.
 */
export function restoreMove(snapshot, species, moveId) {
  const base = snapshot.skills[moveId]
  if (base) applyLiveBase(moveId, base)
  const saved = snapshot.species[species.id]
  const original = findSpeciesMove({ moves: saved?.moves }, moveId)
  applyLiveOverrides(species, moveId, original?.reference.overrides ?? null)
}
