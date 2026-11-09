import { VOLUME_KEYS } from '@/core/data/audio/mixer'
import { Party, SoundSettings } from '@/core/traits'
import { applyVolumes } from '@/view/audio/audioMixer'

/**
 * Volumes do jogador no áudio (docs/features/065-sons-do-mundo.md, Parte
 * 1), fase `presentation`: lê o `SoundSettings` do treinador e passa pro
 * mixer só quando muda (o menu e o save escrevem no trait).
 */
let applied = null

export function audioMixerSystem({ world }) {
  const settings = world.queryFirst(Party, SoundSettings)?.get(SoundSettings)
  if (!settings) return
  const key = VOLUME_KEYS.map((name) => settings[name]).join('|')
  if (key === applied) return
  applyVolumes(settings)
  applied = key
}
