import { createActionSoundResolver } from './actionSoundGroups'

/**
 * Sons de dash agrupados por "estilo", mesmo princípio de
 * `footstepGroups.js` — várias espécies compartilham o mesmo som (e as
 * mesmas configs de volume/alcance) sem repetir dado. `clips` é um array
 * de variações (toca uma ao acaso a cada dash, ver
 * `view/systems/dashAudioSystem.js`).
 *
 * Arquivos em `public/assets/audio/dash/<grupo>/dash-0N.wav` — amostra
 * real de `.exemple/dash/`, indicada pelo usuário.
 */
export const DASH_SOUND_GROUPS = {
  default: {
    volume: 0.1,
    refDistance: 6,
    clips: [
      '/assets/audio/dash/default/dash-01.mp3',
      '/assets/audio/dash/default/dash-02.mp3',
    ],
  },
}

const { getGroup: getDashSoundGroup, resolve: resolveDashSound } =
  createActionSoundResolver(DASH_SOUND_GROUPS, {
    individualKey: 'dash',
    groupKey: 'dashGroup',
  })

export { getDashSoundGroup, resolveDashSound }
