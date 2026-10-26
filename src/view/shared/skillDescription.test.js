import { describe, expect, it } from 'vitest'
import { getSpecies } from '@/core/data/species'
import { resolveSkill } from '@/core/data/skills'
import { formatSkillDescription } from './skillDescription'

// As espécies cujos golpes já têm descrição (docs/features/061-revisao-das-
// skills.md: uma por vez, na ordem da revisão).
const DESCRIBED_SPECIES = [
  'bulbasaur',
  'charmander',
  'squirtle',
  'caterpie',
  'weedle',
  'pidgey',
  'rattata',
  'spearow',
  'ekans',
  'pikachu',
]

function speciesReferences(species) {
  return [
    ...Object.values(species.skills ?? {}),
    ...(species.moves ?? []),
  ].filter(Boolean)
}

describe('formatSkillDescription', () => {
  it('preenche os marcadores com os valores do golpe e dos efeitos', () => {
    const skill = {
      description:
        '{power} · {range:m} · {effects.0.duration:s} · {effects.0.stages:abs} · {effects.1.tick.fraction:%}',
      damage: { power: 40 },
      range: 1.5,
      effects: [
        { type: 'statStage', stages: -1, duration: 15 },
        {
          type: 'condition',
          condition: 'leech-seed',
          tick: { fraction: 0.25 },
        },
      ],
    }
    expect(formatSkillDescription(skill)).toBe('40 · 1,5 m · 15 s · 1 · 25%')
  })

  it('marcador sem valor vira "?"; golpe sem descrição, vazio', () => {
    expect(formatSkillDescription({ description: '{nada}' })).toBe('?')
    expect(formatSkillDescription({})).toBe('')
    expect(formatSkillDescription(null)).toBe('')
  })

  it.each(DESCRIBED_SPECIES)(
    'todo golpe de %s tem descrição, com todos os marcadores preenchidos',
    (speciesId) => {
      for (const reference of speciesReferences(getSpecies(speciesId))) {
        const skill = resolveSkill(reference)
        const text = formatSkillDescription(skill)
        expect(text, skill.id).not.toBe('')
        expect(text, skill.id).not.toMatch(/[{}?]/)
      }
    },
  )
})
