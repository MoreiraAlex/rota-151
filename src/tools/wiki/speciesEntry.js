import { GAME_CONFIG } from '@/core/gameConfig'
import { listSpecies, resolveSpeciesKind } from '@/core/data/species'
import { resolveCreatureStats } from '@/core/data/species/stats'
import { resolveSkill } from '@/core/data/skills'
import {
  ATTACK_SLOTS,
  resolveAttackForEntity,
} from '@/core/battle/attackCasting'
import { resolveMovementCosts } from '@/core/traits/components/vitals'

/**
 * Dados de espécie prontos pra wiki (Pokédex, `/wiki/pokedex`) — tudo
 * derivado do registro e das funções do jogo, nada digitado aqui. Onde o
 * valor depende do IV sorteado de cada indivíduo, a wiki mostra a FAIXA: o
 * indivíduo com todo IV no mínimo (`BATTLE.IV_MIN`) até o com todo IV no
 * máximo (`BATTLE.IV_MAX`).
 */

export const COMBAT_STAT_KEYS = [
  'hp',
  'attack',
  'defense',
  'sp_atk',
  'sp_def',
  'speed',
]

/** IV igual em todos os status — os dois extremos da faixa. */
export function uniformIndividualValues(value) {
  return Object.fromEntries(COMBAT_STAT_KEYS.map((key) => [key, value]))
}

function extremeIndividualValues() {
  const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
  return {
    low: uniformIndividualValues(IV_MIN),
    high: uniformIndividualValues(IV_MAX),
  }
}

/** Espécie com status de batalha de verdade (`stats.hp.base`)? */
function hasBattleStats(species) {
  return species?.stats?.hp?.base != null
}

/** As criaturas da Pokédex: `kind: 'pokemon'` com status, por número da dex. */
export function listWikiSpecies(registry) {
  return listSpecies(registry)
    .filter(
      (species) =>
        resolveSpeciesKind(species) === 'pokemon' && hasBattleStats(species),
    )
    .sort((a, b) => (a.dexNumber ?? Infinity) - (b.dexNumber ?? Infinity))
}

export function findWikiSpecies(id, registry) {
  return listWikiSpecies(registry).find((species) => species.id === id) ?? null
}

/**
 * Status da espécie no nível dela: `base`/`ev` e a faixa calculada (IV
 * mínimo → máximo) de cada status, energia e CP. `null` sem status.
 */
export function resolveStatRange(species) {
  const { low, high } = extremeIndividualValues()
  const min = resolveCreatureStats(species, low)
  const max = resolveCreatureStats(species, high)
  if (!min || !max) return null

  const stats = {}
  for (const key of COMBAT_STAT_KEYS) {
    if (!min[key]) continue
    stats[key] = {
      base: min[key].base,
      ev: min[key].ev,
      min: min[key].stat,
      max: max[key].stat,
    }
  }

  return {
    level: species.level ?? 1,
    stats,
    energy: min.energy
      ? {
          min: min.energy.stat,
          max: max.energy.stat,
          regenPercent: species.stats.energy?.regenPercent ?? null,
          regenDelay: species.stats.energy?.regenDelay ?? null,
        }
      : null,
    hpRegen: {
      regenPercent: species.stats.hp?.regenPercent ?? null,
      regenDelay: species.stats.hp?.regenDelay ?? null,
    },
    cp: min.cp !== undefined ? { min: min.cp, max: max.cp } : null,
  }
}

function rangeOf(a, b) {
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

/**
 * Golpes nos slots da espécie (Q/E/R), resolvidos como o jogo resolve
 * (`resolveAttackForEntity`: override da espécie, custo e recarga pela
 * fórmula, duração e recarga pela velocidade). Recarga e duração dependem do
 * IV de velocidade, então saem como faixa.
 */
export function resolveSpeciesAttacks(species) {
  const { low, high } = extremeIndividualValues()
  return ATTACK_SLOTS.map(({ slot }) => {
    const slow = resolveAttackForEntity(species, slot, low)
    const fast = resolveAttackForEntity(species, slot, high)
    if (!slow || !fast) return null
    return {
      slot,
      attack: slow,
      staminaCost: slow.staminaCost,
      cooldown: rangeOf(slow.cooldown, fast.cooldown),
      duration: rangeOf(slow.duration, fast.duration),
    }
  }).filter(Boolean)
}

/** Golpes que a espécie conhece fora dos slots (`species.moves`). */
export function resolveSpeciesMoves(species) {
  return (species.moves ?? []).map(resolveSkill).filter(Boolean)
}

/** Velocidades e custo de energia do movimento (corrida, dash, pulo). */
export function resolveSpeciesMovement(species) {
  return {
    walkSpeed: species.movement?.walkSpeed ?? null,
    runSpeed: species.movement?.runSpeed ?? null,
    jumpSpeed: species.movement?.jumpSpeed ?? null,
    ...resolveMovementCosts(species),
  }
}
