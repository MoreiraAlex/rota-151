import { listSkills } from '@/core/data/skills'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { ATTACK_SLOTS } from '@/core/battle/attackCasting'
import { resolveMoveAccuracy } from '@/core/battle/accuracy'
import {
  resolveAttackCooldown,
  resolveAttackWeight,
} from '@/core/battle/actionCost'
import {
  isBeamAttack,
  isChannelAttack,
  isConeAttack,
  isSelfAttack,
  resolveChannelTickCount,
} from '@/core/battle/channelAttack'
import { formatName } from './wikiFormat'
import { listWikiSpecies, resolveSpeciesAttacks } from './speciesEntry'
import { resolveSkillType } from '@/core/data/types'

/**
 * Dados de golpe prontos pra wiki (`/wiki/golpes`) — lidos da definição e
 * passados pelas mesmas funções do jogo (precisão, área, peso, recarga).
 */

export function listWikiSkills(registry) {
  return [...listSkills(registry)].sort((a, b) =>
    formatName(a.id).localeCompare(formatName(b.id)),
  )
}

export function findWikiSkill(id, registry) {
  return listWikiSkills(registry).find((skill) => skill.id === id) ?? null
}

/** Forma da área: `'self'` | `'cone'` | `'line'` | `'capsule'`. */
export function resolveAttackArea(attack) {
  if (isSelfAttack(attack)) return 'self'
  if (isBeamAttack(attack)) return 'line'
  if (isConeAttack(attack)) return 'cone'
  return 'capsule'
}

/** `'physical'` | `'special'` | `'status'` (golpe sem dano). */
export function resolveAttackCategory(attack) {
  if (!attack?.damage) return 'status'
  return attack.damage.category ?? 'physical'
}

/**
 * Resumo de um golpe como o jogo o enxerga. `baseCooldown` é a recarga com
 * fator de velocidade neutro — a de cada criatura muda com o status
 * `speed` dela (ver página da espécie).
 */
export function resolveSkillSummary(attack) {
  const weight = resolveAttackWeight(attack)
  const channel = isChannelAttack(attack)
  return {
    power: attack.damage?.power ?? null,
    category: resolveAttackCategory(attack),
    type: resolveSkillType(attack),
    accuracy: resolveMoveAccuracy(attack),
    area: resolveAttackArea(attack),
    range: attack.range,
    radius: attack.radius,
    duration: attack.duration,
    effectAt: attack.effectAt,
    channel: channel
      ? {
          ticks: resolveChannelTickCount(attack),
          interval: attack.damageInterval ?? null,
        }
      : null,
    effects: attack.effects ?? [],
    weight,
    baseCooldown: attack.cooldown ?? resolveAttackCooldown(weight),
    fixedCost: attack.staminaCost ?? null,
    fixedCooldown: attack.cooldown ?? null,
  }
}

/**
 * Quem usa o golpe: espécies com ele num slot (com a versão resolvida da
 * espécie — override, custo pelo nível dela, recarga pela velocidade) e
 * espécies que o conhecem fora dos slots (`species.moves`).
 */
export function listSkillUsers(skillId, registry) {
  const users = []
  for (const species of listWikiSpecies(registry)) {
    const slots = ATTACK_SLOTS.filter(
      ({ slot }) => resolveCreatureAttack(species, slot)?.id === skillId,
    ).map(({ slot }) => slot)

    for (const entry of resolveSpeciesAttacks(species)) {
      if (slots.includes(entry.slot)) users.push({ species, ...entry })
    }

    const knowsAsMove = (species.moves ?? []).some(
      (move) => (typeof move === 'string' ? move : move.id) === skillId,
    )
    if (knowsAsMove) users.push({ species, slot: null })
  }
  return users
}
