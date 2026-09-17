import { createActionSoundResolver } from './actionSoundGroups'

/**
 * Sons de pulo agrupados por "estilo", mesmo princípio de
 * `footstepGroups.js` — várias espécies compartilham o mesmo som (e as
 * mesmas configs de volume/alcance) sem repetir dado. `clips` é um array
 * de variações (toca uma ao acaso a cada pulo, ver
 * `view/systems/jumpAudioSystem.js`).
 *
 * Arquivos em `public/assets/audio/jump/<grupo>/jump-0N.wav` — amostra
 * real de `.exemple/jump/`, indicada pelo usuário.
 */
export const JUMP_SOUND_GROUPS = {
  default: {
    volume: 0.15,
    refDistance: 6,
    clips: [
      '/assets/audio/jump/default/jump-01.wav',
      '/assets/audio/jump/default/jump-02.wav',
      '/assets/audio/jump/default/jump-03.wav',
    ],
  },
}

const { getGroup: getJumpSoundGroup, resolve: resolveJumpSound } =
  createActionSoundResolver(JUMP_SOUND_GROUPS, {
    individualKey: 'jump',
    groupKey: 'jumpGroup',
  })

export { getJumpSoundGroup, resolveJumpSound }
