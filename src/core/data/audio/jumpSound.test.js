import { describe, it, expect } from 'vitest'
import {
  JUMP_SOUND_GROUPS,
  getJumpSoundGroup,
  resolveJumpSound,
} from './jumpSound'

// A lógica de resolução em si (individual vs grupo vs nenhum) já é
// testada genericamente em actionSoundGroups.test.js — aqui só confere a
// integração de verdade (espécies reais + dados do grupo).
describe('jumpSound', () => {
  it('todo grupo tem pelo menos uma variação', () => {
    for (const [id, group] of Object.entries(JUMP_SOUND_GROUPS)) {
      expect(group.clips.length, id).toBeGreaterThan(0)
    }
  })

  it('boy/charmander (espécies reais do projeto) resolvem o grupo que cada um declara', async () => {
    const { BOY } = await import('../species/boy')
    const { CHARMANDER } = await import('../species/004-charmander')
    expect(resolveJumpSound(BOY)).toBe(getJumpSoundGroup(BOY.sounds.jumpGroup))
    expect(resolveJumpSound(CHARMANDER)).toBe(
      getJumpSoundGroup(CHARMANDER.sounds.jumpGroup),
    )
    expect(resolveJumpSound(BOY)).not.toBe(null)
    expect(resolveJumpSound(CHARMANDER)).not.toBe(null)
  })
})
