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

  it('bot/fox (espécies reais do projeto) resolvem o grupo que cada um declara', async () => {
    const { BOT } = await import('../species/bot')
    const { FOX } = await import('../species/fox')
    expect(resolveDashSound(BOT)).toBe(getDashSoundGroup(BOT.sounds.dashGroup))
    expect(resolveDashSound(FOX)).toBe(getDashSoundGroup(FOX.sounds.dashGroup))
    expect(resolveDashSound(BOT)).not.toBe(null)
    expect(resolveDashSound(FOX)).not.toBe(null)
  })
})
