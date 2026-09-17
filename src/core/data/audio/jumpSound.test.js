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

  it('bot/fox (espécies reais do projeto) resolvem o grupo que cada um declara', async () => {
    const { BOT } = await import('../species/bot')
    const { FOX } = await import('../species/fox')
    expect(resolveJumpSound(BOT)).toBe(getJumpSoundGroup(BOT.sounds.jumpGroup))
    expect(resolveJumpSound(FOX)).toBe(getJumpSoundGroup(FOX.sounds.jumpGroup))
    expect(resolveJumpSound(BOT)).not.toBe(null)
    expect(resolveJumpSound(FOX)).not.toBe(null)
  })
})
