import { GAME_CONFIG } from '@/core/gameConfig'
import {
  computeDamage,
  resolveStab,
  rollCriticalMultiplier,
} from '@/core/battle/calculateDamage'
import { resolveAttackForEntity } from '@/core/battle/attackCasting'
import { resolveHitChance } from '@/core/battle/accuracy'
import {
  isChannelAttack,
  resolveChannelTickCount,
} from '@/core/battle/channelAttack'
import {
  resolveMaxHp,
  resolveMaxStamina,
} from '@/core/traits/components/vitals'
import {
  resolveSkillType,
  resolveSpeciesTypes,
  resolveTypeEffectiveness,
} from '@/core/data/types'

// Multiplicador do crítico tirado da própria regra do jogo: um sorteio que
// sempre cai dentro da chance devolve o multiplicador de crítico.
const CRITICAL_MULTIPLIER = rollCriticalMultiplier(() => 0)

/**
 * A espécie no nível escolhido na calculadora — o nível vive na espécie
 * (`species.level`), e status, custo e dano saem dele.
 */
export function withLevel(species, level) {
  if (!species || !(level > 0)) return species
  return { ...species, level }
}

function hitsToFaint(maxHp, damage) {
  return damage > 0 ? Math.ceil(maxHp / damage) : Infinity
}

/**
 * Prévia de UM golpe de `attacker` em `defender` (calculadora da wiki,
 * `/wiki/calculadora`) — sem sorteio: os extremos da faixa pela mesma conta
 * do jogo (`computeDamage`), com o fator aleatório no mínimo e no máximo, e
 * os mesmos com crítico. Canalizado: o canal inteiro vale o dano médio de um
 * golpe repartido em ticks (`resolveChannelTickDamage`), então sai o total
 * e a média por tick.
 *
 * `attacker`/`defender`: `{ species, individualValues, stages }` (`stages`:
 * `{ attack, defense, sp_atk, sp_def, accuracy }`, ausente = 0).
 *
 * Também o tipo do golpe, o bônus de mesmo tipo (`stab`) e a efetividade
 * contra os tipos do alvo (`typeMultiplier`: `{ multiplier, effectiveness }`)
 * — já dentro dos números de dano.
 */
export function resolveDamagePreview({ attacker, defender, slot }) {
  const attack = resolveAttackForEntity(
    attacker.species,
    slot,
    attacker.individualValues,
  )
  if (!attack) return null

  const defenderMaxHp = resolveMaxHp(
    defender.species,
    defender.individualValues,
  )
  const summary = {
    attack,
    hitChance: resolveHitChance(attack, attacker.stages?.accuracy ?? 0),
    staminaCost: attack.staminaCost,
    cooldown: attack.cooldown,
    attackerMaxEnergy: resolveMaxStamina(
      attacker.species,
      attacker.individualValues,
    ),
    defenderMaxHp,
    criticalChance: GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE,
    type: resolveSkillType(attack),
    stab: resolveStab(
      resolveSkillType(attack),
      resolveSpeciesTypes(attacker.species),
    ),
    typeMultiplier: resolveTypeEffectiveness(
      resolveSkillType(attack),
      resolveSpeciesTypes(defender.species),
    ),
  }
  if (!attack.damage) return { ...summary, damage: null }

  const context = {
    attackerSpecies: attacker.species,
    attackerIndividualValues: attacker.individualValues,
    defenderSpecies: defender.species,
    defenderIndividualValues: defender.individualValues,
    damage: attack.damage,
    attackType: resolveSkillType(attack),
    attackerStages: attacker.stages,
    defenderStages: defender.stages,
  }
  const { DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX } = GAME_CONFIG.BATTLE

  if (isChannelAttack(attack)) {
    const total = computeDamage(context, {
      critical: 1,
      random: (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2,
    })
    const ticks = resolveChannelTickCount(attack)
    return {
      ...summary,
      damage: {
        channel: true,
        total,
        ticks,
        perTick: ticks > 0 ? total / ticks : total,
        criticalMultiplier: CRITICAL_MULTIPLIER,
        totalPercent: total / defenderMaxHp,
        hitsToFaint: hitsToFaint(defenderMaxHp, total),
      },
    }
  }

  const at = (critical, random) => computeDamage(context, { critical, random })
  const min = at(1, DAMAGE_RANDOM_MIN)
  const max = at(1, DAMAGE_RANDOM_MAX)
  return {
    ...summary,
    damage: {
      channel: false,
      min,
      max,
      criticalMin: at(CRITICAL_MULTIPLIER, DAMAGE_RANDOM_MIN),
      criticalMax: at(CRITICAL_MULTIPLIER, DAMAGE_RANDOM_MAX),
      minPercent: min / defenderMaxHp,
      maxPercent: max / defenderMaxHp,
      // sem crítico: no melhor caso (dano máximo) e no pior (mínimo)
      hitsToFaint: {
        best: hitsToFaint(defenderMaxHp, max),
        worst: hitsToFaint(defenderMaxHp, min),
      },
    },
  }
}
