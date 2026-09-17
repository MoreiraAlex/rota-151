import { describe, it, expect } from 'vitest'
import { createActionSoundResolver } from './actionSoundGroups'

const GROUPS = {
  groupA: { clips: ['a1.wav', 'a2.wav'], volume: 0.5 },
  groupB: { clips: ['b1.wav'] },
}

const { getGroup, resolve } = createActionSoundResolver(GROUPS, {
  individualKey: 'thing',
  groupKey: 'thingGroup',
})

describe('createActionSoundResolver', () => {
  describe('getGroup', () => {
    it('devolve o grupo pelo id', () => {
      expect(getGroup('groupA')).toBe(GROUPS.groupA)
    })

    it('id desconhecido devolve null', () => {
      expect(getGroup('nao-existe')).toBe(null)
    })
  })

  describe('resolve', () => {
    it('espécie sem `sounds` não tem esse som', () => {
      expect(resolve({})).toBe(null)
    })

    it('sem a chave individual nem a de grupo, não tem esse som', () => {
      expect(resolve({ sounds: {} })).toBe(null)
    })

    it('a chave de grupo resolve pro grupo compartilhado', () => {
      const species = { sounds: { thingGroup: 'groupB' } }
      expect(resolve(species)).toBe(GROUPS.groupB)
    })

    it('grupo desconhecido resolve pra null, não quebra', () => {
      const species = { sounds: { thingGroup: 'nao-existe' } }
      expect(resolve(species)).toBe(null)
    })

    it('a chave individual vence a de grupo, mesmo as duas declaradas', () => {
      const individual = { clips: ['custom.wav'] }
      const species = {
        sounds: { thing: individual, thingGroup: 'groupA' },
      }
      expect(resolve(species)).toBe(individual)
    })

    it('a chave individual sozinha (sem grupo nenhum) funciona', () => {
      const individual = { clips: ['custom.wav'], volume: 0.9 }
      const species = { sounds: { thing: individual } }
      expect(resolve(species)).toBe(individual)
    })
  })

  it('duas instâncias da fábrica não compartilham chaves entre si', () => {
    const other = createActionSoundResolver(
      { groupA: { clips: ['outro.wav'] } },
      { individualKey: 'outraCoisa', groupKey: 'outraCoisaGroup' },
    )
    // Mesma chave 'thingGroup' não significa nada pra outra instância —
    // ela só entende 'outraCoisaGroup'.
    const species = { sounds: { thingGroup: 'groupA' } }
    expect(other.resolve(species)).toBe(null)
  })
})
