import * as THREE from 'three'
import { distanceGain } from './soundRanges'
import { routeToChannel } from './audioMixer'

/**
 * Som posicional no mundo (docs/features/062-spawn-estilo-cobblemon.md).
 *
 * - **Alcance**: volume cheio até `refDistance`, caindo até sumir de vez em
 *   `maxDistance`, pela curva de `distanceGain` (`soundRanges.js`). O padrão
 *   do Three (inverso) nunca zera: com o mundo povoado, dava para ouvir todas
 *   as selvagens, mesmo as bem longe. E a reta do modelo `linear` do panner
 *   soava quase igual por boa parte do alcance e então cortava. Por isso o
 *   panner só faz o pan (não atenua), e a queda é um ganho nosso antes dele
 *   (`distanceFade`, no lugar dos filtros do Three: ninguém mais usa filtro).
 * - **Esquerda/direita**: pan `equalpower` — o som sai mais de um lado
 *   conforme a fonte está à esquerda ou à direita da câmera (o listener
 *   segue a câmera, `audioListenerSystem`). Mais nítido que o `HRTF`
 *   padrão do Three, que espalha e colore o som. O panner recebe tudo em
 *   mono: com arquivo estéreo, ele somava os dois canais no ouvido do lado
 *   da fonte, e o som ficava mais alto dos lados que de frente (medido no
 *   laboratório de alcance). Em mono, o volume é o mesmo em qualquer
 *   direção.
 * - **Começa no lugar certo**: o Three só atualiza a posição do panner com o
 *   som tocando, e em rampa. Parado, ele guarda onde tocou da última vez (ou
 *   a origem do mundo, se nunca tocou), e o som começa lá. O caso que se
 *   ouve é o primeiro som de cada fonte com o jogador perto da origem: o
 *   começo vazava mesmo com a fonte fora do alcance, como um estalo. Por isso
 *   o panner vai para o lugar antes de cada `play` (`WorldPositionalAudio`).
 *
 * Todo `THREE.PositionalAudio` do jogo nasce por aqui.
 */
const worldPosition = new THREE.Vector3()
const listenerPosition = new THREE.Vector3()
// Quanto o volume leva para seguir a distância com o som tocando: suaviza o
// salto de um quadro para o outro.
const FADE_SMOOTHING_SECONDS = 0.03

/** Põe o panner de `audio` onde ele está no mundo agora, sem rampa. */
export function placePannerNow(audio) {
  const { x, y, z } = audio.getWorldPosition(worldPosition)
  const { panner, context } = audio
  if (!panner.positionX) {
    panner.setPosition(x, y, z)
    return
  }
  const now = context.currentTime
  const place = (param, value) => {
    param.cancelScheduledValues(now)
    param.setValueAtTime(value, now)
  }
  place(panner.positionX, x)
  place(panner.positionY, y)
  place(panner.positionZ, z)
}

/**
 * Põe o ganho de distância de `audio` no valor da distância até o ouvinte:
 * na hora (`smooth` falso, antes de tocar) ou deslizando (com o som tocando).
 */
export function fadeToDistance(audio, { smooth }) {
  audio.getWorldPosition(worldPosition)
  audio.listener.getWorldPosition(listenerPosition)
  const gain = distanceGain(worldPosition.distanceTo(listenerPosition), {
    refDistance: audio.panner.refDistance,
    maxDistance: audio.panner.maxDistance,
  })
  const param = audio.distanceFade.gain
  const now = audio.context.currentTime
  if (smooth) {
    param.setTargetAtTime(gain, now, FADE_SMOOTHING_SECONDS)
    return
  }
  param.cancelScheduledValues(now)
  param.setValueAtTime(gain, now)
}

class WorldPositionalAudio extends THREE.PositionalAudio {
  constructor(listener) {
    super(listener)
    this.distanceFade = this.context.createGain()
    this.filters = [this.distanceFade]
  }

  play(delay) {
    placePannerNow(this)
    fadeToDistance(this, { smooth: false })
    return super.play(delay)
  }

  updateMatrixWorld(force) {
    super.updateMatrixWorld(force)
    if (this.isPlaying) fadeToDistance(this, { smooth: true })
  }
}

/** Ajusta o alcance e o pan de um `PositionalAudio` já criado. */
export function applySpatialAudio(audio, { refDistance, maxDistance }) {
  audio.panner.panningModel = 'equalpower'
  audio.panner.channelCount = 1
  audio.panner.channelCountMode = 'explicit'
  audio.setDistanceModel('linear')
  // O panner guarda o alcance (lido por `fadeToDistance`), mas não atenua.
  audio.setRolloffFactor(0)
  audio.setRefDistance(refDistance)
  audio.setMaxDistance(Math.max(maxDistance, refDistance))
}

/**
 * Um `PositionalAudio` novo, com volume, alcance e pan, ligado no canal
 * `channel` (`core/data/audio/mixer.js`; sem ele, efeitos).
 */
export function createPositionalAudio(
  listener,
  { volume, refDistance, maxDistance, channel = 'effects' },
) {
  const audio = routeToChannel(new WorldPositionalAudio(listener), channel)
  audio.setVolume(volume)
  applySpatialAudio(audio, { refDistance, maxDistance })
  return audio
}
