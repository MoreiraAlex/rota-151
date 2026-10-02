import { describe, expect, it } from 'vitest'
import { listSkills } from '@/core/data/skills'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { resolveAttackWeight } from '@/core/battle/actionCost'
import {
  isBeamAttack,
  isConeAttack,
  isSelfAttack,
} from '@/core/battle/channelAttack'
import {
  findWikiSkill,
  listSkillUsers,
  listWikiSkills,
  resolveAttackArea,
  resolveAttackCategory,
  resolveSkillSummary,
} from './skillEntry'
import { listWikiSpecies } from './speciesEntry'

describe('listWikiSkills', () => {
  it('traz todo golpe do registro', () => {
    const ids = listWikiSkills().map((skill) => skill.id)
    expect(ids).toHaveLength(listSkills().length)
    for (const skill of listSkills()) expect(ids).toContain(skill.id)
  })

  it('findWikiSkill acha pelo id e devolve null pra desconhecido', () => {
    for (const skill of listSkills()) {
      expect(findWikiSkill(skill.id)).toBe(skill)
    }
    expect(findWikiSkill('nao-existe')).toBeNull()
  })
})

describe('resolveAttackArea', () => {
  it('segue as regras de área do jogo', () => {
    for (const skill of listSkills()) {
      const area = resolveAttackArea(skill)
      if (isSelfAttack(skill)) expect(area).toBe('self')
      else if (isBeamAttack(skill)) expect(area).toBe('line')
      else if (isConeAttack(skill)) expect(area).toBe('cone')
      else expect(area).toBe('capsule')
    }
  })
})

describe('resolveSkillSummary', () => {
  it('golpe sem dano é de status; com dano usa a categoria declarada', () => {
    for (const skill of listSkills()) {
      const summary = resolveSkillSummary(skill)
      if (!skill.damage) {
        expect(summary.category).toBe('status')
        expect(summary.power).toBeNull()
      } else {
        expect(summary.category).toBe(resolveAttackCategory(skill))
        expect(summary.power).toBe(skill.damage.power)
      }
      expect(summary.weight).toBe(resolveAttackWeight(skill))
      expect(summary.baseCooldown).toBeGreaterThanOrEqual(0)
    }
  })

  it('canalizado informa os ticks', () => {
    const channel = listSkills().filter((s) => s.damageMode === 'channel')
    for (const skill of channel) {
      expect(resolveSkillSummary(skill).channel.ticks).toBeGreaterThan(0)
    }
  })
})

describe('listSkillUsers', () => {
  it('toda espécie com o golpe num slot aparece como usuária', () => {
    for (const species of listWikiSpecies()) {
      for (const slot of ['secondary1', 'secondary2', 'secondary3']) {
        const attack = resolveCreatureAttack(species, slot)
        if (!attack) continue
        const users = listSkillUsers(attack.id)
        expect(
          users.some((u) => u.species.id === species.id && u.slot === slot),
        ).toBe(true)
      }
    }
  })

  it('golpe conhecido fora dos slots aparece sem slot', () => {
    for (const species of listWikiSpecies()) {
      for (const move of species.moves ?? []) {
        const id = typeof move === 'string' ? move : move.id
        expect(
          listSkillUsers(id).some(
            (u) => u.species.id === species.id && u.slot === null,
          ),
        ).toBe(true)
      }
    }
  })
})
