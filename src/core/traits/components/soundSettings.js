import { trait } from 'koota'
import { DEFAULT_VOLUMES } from '../../data/audio/mixer'
import { DEFAULT_MUSIC_FREQUENCY } from '../../data/audio/musicTracks'

/**
 * Ajustes de som do jogador (docs/features/065-sons-do-mundo.md): o volume
 * geral e um por canal (`core/data/audio/mixer.js`), de 0 a 1, e a
 * frequência da música (`musicFrequency`, uma de `MUSIC_FREQUENCIES`). Vive no treinador
 * porque é da conta (vai no save dele), não do mundo. O core só guarda os
 * números; quem aplica no áudio é a view (`audioMixerSystem.js`).
 *
 * Donos de escrita: `definirVolume` / `definirFrequenciaDaMusica`
 * (`core/actions/soundSettings.js`, o menu) e `restoreTrainer` (save).
 */
export const SoundSettings = trait(() => ({
  ...DEFAULT_VOLUMES,
  musicFrequency: DEFAULT_MUSIC_FREQUENCY,
}))
