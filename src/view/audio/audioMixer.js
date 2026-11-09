import { SOUND_CHANNELS } from '@/core/data/audio/mixer'
import { getAudioListener } from './audioListener'

/**
 * Canais de volume (docs/features/065-sons-do-mundo.md, Parte 1): um
 * `GainNode` por canal entre os sons e o listener. Todo som do jogo é
 * ligado num canal (`routeToChannel`); o volume geral é o do próprio
 * listener. Quem aplica os volumes do jogador é `audioMixerSystem.js`.
 *
 * Estado de tela, não de jogo (como o listener): um mixer por processo.
 */
const channels = new Map()

// Quanto a troca de volume demora pra assentar (s): sem salto audível.
const VOLUME_SMOOTHING_SECONDS = 0.05

/** A entrada do canal `channel`, criada na primeira vez. */
export function getChannelInput(channel) {
  if (!SOUND_CHANNELS.includes(channel)) {
    throw new Error(`Canal de som desconhecido: ${channel}`)
  }
  let input = channels.get(channel)
  if (!input) {
    const listener = getAudioListener()
    input = listener.context.createGain()
    input.connect(listener.getInput())
    channels.set(channel, input)
  }
  return input
}

/**
 * Liga a saída de `audio` (`THREE.Audio` ou `PositionalAudio`) no canal
 * `channel` em vez de direto no listener. Devolve o próprio `audio`.
 */
export function routeToChannel(audio, channel) {
  audio.gain.disconnect()
  audio.gain.connect(getChannelInput(channel))
  return audio
}

/** Aplica os volumes (`SoundSettings`): o geral e o de cada canal. */
export function applyVolumes(volumes) {
  const listener = getAudioListener()
  listener.setMasterVolume(volumes.master)
  const now = listener.context.currentTime
  for (const channel of SOUND_CHANNELS) {
    getChannelInput(channel).gain.setTargetAtTime(
      volumes[channel],
      now,
      VOLUME_SMOOTHING_SECONDS,
    )
  }
}
