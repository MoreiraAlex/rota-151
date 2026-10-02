import { describe, it, expect } from 'vitest'
import {
  DASH_SOUND_GROUPS,
  getDashSoundGroup,
  resolveDashSound,
} from './dashSound'

// A lógica de resolução em si (individual vs grupo vs nenhum) já é
// testada genericamente em actionSoundGroups.test.js — aqui só confere a
// integração de verdade (espécies reais + dados do grupo).
describe('dashSound', () => {
  it('todo grupo tem pelo menos uma variação', () => {
    for (const [id, group] of Object.entries(DASH_SOUND_GROUPS)) {
      expect(group.clips.length, id).toBeGreaterThan(0)
    }
  })

  it('boy/charmander (espécies reais do projeto) resolvem o grupo que cada um declara', async () => {
    const { BOY } = await import('../species/boy')
    const { CHARMANDER } = await import('../species/004-charmander')
    expect(resolveDashSound(BOY)).toBe(getDashSoundGroup(BOY.sounds.dashGroup))
    expect(resolveDashSound(CHARMANDER)).toBe(
      getDashSoundGroup(CHARMANDER.sounds.dashGroup),
    )
    expect(resolveDashSound(BOY)).not.toBe(null)
    expect(resolveDashSound(CHARMANDER)).not.toBe(null)
  })
})
