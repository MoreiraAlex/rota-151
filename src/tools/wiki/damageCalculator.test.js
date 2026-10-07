import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { computeDamage } from '@/core/battle/calculateDamage'
import { resolveSkillType } from '@/core/data/types'
import {
  ATTACK_SLOTS,
  resolveAttackForEntity,
} from '@/core/battle/attackCasting'
import { resolveDamagePreview, withLevel } from './damageCalculator'
import { listWikiSpecies, uniformIndividualValues } from './speciesEntry'

const IVS = uniformIndividualValues(GAME_CONFIG.BATTLE.IV_MAX)

function side(species, stages = {}) {
  return { species, individualValues: IVS, stages }
}

function everyAttack(callback) {
  const species = listWikiSpecies()
  for (const attacker of species) {
    for (const { slot } of ATTACK_SLOTS) {
      const attack = resolveAttackForEntity(attacker, slot, IVS)
      if (attack) callback({ attacker, defender: species[0], slot, attack })
    }
  }
}

describe('resolveDamagePreview', () => {
  it('faixa sem crítico e com crítico, pela mesma conta do jogo', () => {
    const { DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX } = GAME_CONFIG.BATTLE
    everyAttack(({ attacker, defender, slot, attack }) => {
      if (!attack.damage || attack.damageMode === 'channel') return
      const preview = resolveDamagePreview({
        attacker: side(attacker),
        defender: side(defender),
        slot,
      })
      const context = {
        attackerSpecies: attacker,
        attackerIndividualValues: IVS,
        defenderSpecies: defender,
        defenderIndividualValues: IVS,
        damage: attack.damage,
        attackType: resolveSkillType(attack),
      }
      expect(preview.damage.min).toBeCloseTo(
        computeDamage(context, { critical: 1, random: DAMAGE_RANDOM_MIN }),
      )
      expect(preview.damage.max).toBeCloseTo(
        computeDamage(context, { critical: 1, random: DAMAGE_RANDOM_MAX }),
      )
      expect(preview.damage.min).toBeLessThanOrEqual(preview.damage.max)
      expect(preview.damage.criticalMin).toBeGreaterThan(preview.damage.min)
      expect(preview.damage.hitsToFaint.best).toBeLessThanOrEqual(
        preview.damage.hitsToFaint.worst,
      )
    })
  })

  it('canalizado: total = dano médio de um golpe, repartido nos ticks', () => {
    const { DAMAGE_RANDOM_MIN, DAMAGE_RANDOM_MAX } = GAME_CONFIG.BATTLE
    everyAttack(({ attacker, defender, slot, attack }) => {
      if (attack.damageMode !== 'channel' || !attack.damage) return
      const preview = resolveDamagePreview({
        attacker: side(attacker),
        defender: side(defender),
        slot,
      })
      const total = computeDamage(
        {
          attackerSpecies: attacker,
          attackerIndividualValues: IVS,
          defenderSpecies: defender,
          defenderIndividualValues: IVS,
          damage: attack.damage,
          attackType: resolveSkillType(attack),
        },
        { critical: 1, random: (DAMAGE_RANDOM_MIN + DAMAGE_RANDOM_MAX) / 2 },
      )
      expect(preview.damage.channel).toBe(true)
      expect(preview.damage.total).toBeCloseTo(total)
      expect(preview.damage.perTick * preview.damage.ticks).toBeCloseTo(total)
    })
  })

  it('golpe de status não tem dano, mas tem custo e acerto', () => {
    everyAttack(({ attacker, defender, slot, attack }) => {
      if (attack.damage) return
      const preview = resolveDamagePreview({
        attacker: side(attacker),
        defender: side(defender),
        slot,
      })
      expect(preview.damage).toBeNull()
      expect(preview.staminaCost).toBe(attack.staminaCost)
      expect(preview.hitChance).toBeGreaterThan(0)
    })
  })

  it('estágio de ataque positivo aumenta o dano; precisão negativa baixa o acerto', () => {
    everyAttack(({ attacker, defender, slot, attack }) => {
      if (!attack.damage || attack.damageMode === 'channel') return
      const key = attack.damage.category === 'special' ? 'sp_atk' : 'attack'
      const neutral = resolveDamagePreview({
        attacker: side(attacker),
        defender: side(defender),
        slot,
      })
      const boosted = resolveDamagePreview({
        attacker: side(attacker, { [key]: 2, accuracy: -2 }),
        defender: side(defender),
        slot,
      })
      expect(boosted.damage.max).toBeGreaterThan(neutral.damage.max)
      if (attack.accuracy !== null) {
        expect(boosted.hitChance).toBeLessThan(neutral.hitChance)
      }
    })
  })

  it('slot vazio devolve null', () => {
    const [species] = listWikiSpecies()
    expect(
      resolveDamagePreview({
        attacker: side({ ...species, basicAttack: null, skills: {} }),
        defender: side(species),
        slot: 'primary',
      }),
    ).toBeNull()
  })
})

describe('withLevel', () => {
  it('troca só o nível, sem mexer na espécie original', () => {
    const [species] = listWikiSpecies()
    const leveled = withLevel(species, species.level + 1)
    expect(leveled.level).toBe(species.level + 1)
    expect(leveled.id).toBe(species.id)
    expect(withLevel(species, 0)).toBe(species)
  })
})
