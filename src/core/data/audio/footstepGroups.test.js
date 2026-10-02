import { describe, it, expect } from 'vitest'
import {
  FOOTSTEP_GROUPS,
  getFootstepGroup,
  resolveFootstepSound,
} from './footstepGroups'

describe('getFootstepGroup', () => {
  it('devolve o grupo pelo id', () => {
    // Não fixa um id específico ('heavy'/'medium'/...) — já quebrou uma
    // vez com uma renomeação de grupo durante ajuste ao vivo. Qualquer
    // id de verdade em FOOTSTEP_GROUPS serve pra provar o lookup.
    const [someId] = Object.keys(FOOTSTEP_GROUPS)
    expect(getFootstepGroup(someId)).toBe(FOOTSTEP_GROUPS[someId])
  })

  it('id desconhecido devolve null', () => {
    expect(getFootstepGroup('nao-existe')).toBe(null)
  })
})

describe('resolveFootstepSound', () => {
  it('espécie sem `sounds` não tem som de passo', () => {
    expect(resolveFootstepSound({})).toBe(null)
  })

  it('sem `footstep` nem `footstepGroup` declarados, não tem som de passo', () => {
    expect(resolveFootstepSound({ sounds: {} })).toBe(null)
  })

  it('`footstepGroup` resolve pro grupo compartilhado', () => {
    const species = { sounds: { footstepGroup: 'light' } }
    expect(resolveFootstepSound(species)).toBe(FOOTSTEP_GROUPS.light)
  })

  it('`footstepGroup` desconhecido resolve pra null, não quebra', () => {
    const species = { sounds: { footstepGroup: 'nao-existe' } }
    expect(resolveFootstepSound(species)).toBe(null)
  })

  it('`footstep` individual vence `footstepGroup`, mesmo os dois declarados', () => {
    const individual = { walk: ['a.ogg'], run: ['b.ogg'] }
    const species = {
      sounds: { footstep: individual, footstepGroup: 'nao-importa-qual' },
    }
    expect(resolveFootstepSound(species)).toBe(individual)
  })

  it('`footstep` individual sozinho (sem grupo nenhum) funciona', () => {
    const individual = { walk: ['a.ogg'], run: ['b.ogg'], volume: 0.9 }
    const species = { sounds: { footstep: individual } }
    expect(resolveFootstepSound(species)).toBe(individual)
  })

  it('boy e charmander (espécies reais do projeto) resolvem o grupo que cada um declara', async () => {
    // Compara contra o grupo que a PRÓPRIA espécie aponta (`sounds.
    // footstepGroup`), não um id fixo — as espécies podem compartilhar o
    // mesmo grupo ou não, isso é decisão de conteúdo/ajuste ao vivo, não
    // algo que este teste deva travar.
    const { BOY } = await import('../species/boy')
    const { CHARMANDER } = await import('../species/004-charmander')
    expect(resolveFootstepSound(BOY)).toBe(
      getFootstepGroup(BOY.sounds.footstepGroup),
    )
    expect(resolveFootstepSound(CHARMANDER)).toBe(
      getFootstepGroup(CHARMANDER.sounds.footstepGroup),
    )
  })
})

describe('FOOTSTEP_GROUPS', () => {
  it('todo grupo tem pelo menos uma variação de walk e run', () => {
    for (const [id, group] of Object.entries(FOOTSTEP_GROUPS)) {
      expect(group.walk.length, `${id}.walk`).toBeGreaterThan(0)
      expect(group.run.length, `${id}.run`).toBeGreaterThan(0)
    }
  })
})
