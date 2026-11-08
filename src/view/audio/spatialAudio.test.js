import { describe, expect, it } from 'vitest'
import { distanceGain } from './soundRanges'
import {
  applySpatialAudio,
  fadeToDistance,
  placePannerNow,
} from './spatialAudio'

// Som posicional (docs/features/062-spawn-estilo-cobblemon.md): alcance que
// zera e pan esquerda/direita.

function fakeAudio() {
  const state = { panner: {} }
  return Object.assign(state, {
    setDistanceModel: (value) => (state.distanceModel = value),
    setRolloffFactor: (value) => (state.rolloff = value),
    setRefDistance: (value) => (state.ref = value),
    setMaxDistance: (value) => (state.max = value),
  })
}

function fakeParam() {
  const param = {
    value: 0,
    cancelledAt: null,
    cancelScheduledValues: (time) => (param.cancelledAt = time),
    setValueAtTime: (value, time) => {
      param.value = value
      param.at = time
    },
  }
  return param
}

describe('placePannerNow', () => {
  const at = { x: 3, y: 4, z: 5 }
  const placed = (panner) => ({
    panner,
    context: { currentTime: 7 },
    getWorldPosition: (target) => Object.assign(target, at),
  })

  it('leva o panner para onde o som está agora, na hora, sem rampa pendente', () => {
    const panner = {
      positionX: fakeParam(),
      positionY: fakeParam(),
      positionZ: fakeParam(),
    }
    const audio = placed(panner)

    placePannerNow(audio)

    for (const [param, value] of [
      [panner.positionX, at.x],
      [panner.positionY, at.y],
      [panner.positionZ, at.z],
    ]) {
      expect(param.value).toBe(value)
      expect(param.at).toBe(audio.context.currentTime)
      expect(param.cancelledAt).toBe(audio.context.currentTime)
    }
  })

  it('em navegador sem os parâmetros de posição, usa o método antigo', () => {
    const calls = []
    const panner = { setPosition: (...args) => calls.push(args) }

    placePannerNow(placed(panner))

    expect(calls).toEqual([[at.x, at.y, at.z]])
  })
})

describe('applySpatialAudio', () => {
  it('guarda o alcance e o pan esquerda/direita, sem o panner atenuar', () => {
    const audio = fakeAudio()
    applySpatialAudio(audio, { refDistance: 2, maxDistance: 10 })
    expect(audio.rolloff).toBe(0)
    expect(audio.panner.panningModel).toBe('equalpower')
    expect(audio.panner.channelCount).toBe(1)
    expect(audio.panner.channelCountMode).toBe('explicit')
    expect(audio.ref).toBe(2)
    expect(audio.max).toBe(10)
  })

  it('o alcance nunca fica antes do volume cheio', () => {
    const audio = fakeAudio()
    applySpatialAudio(audio, { refDistance: 10, maxDistance: 2 })
    expect(audio.max).toBeGreaterThanOrEqual(audio.ref)
  })
})

describe('fadeToDistance', () => {
  const range = { refDistance: 2, maxDistance: 10 }
  const fadedAt = (distance) => {
    const gain = fakeParam()
    gain.target = null
    gain.setTargetAtTime = (value, time) => (gain.target = { value, time })
    return {
      gain,
      audio: {
        panner: range,
        distanceFade: { gain },
        context: { currentTime: 7 },
        getWorldPosition: (target) => target.set(distance, 0, 0),
        listener: { getWorldPosition: (target) => target.set(0, 0, 0) },
      },
    }
  }

  it('antes de tocar, já põe o volume da distância, na hora', () => {
    const distance = (range.refDistance + range.maxDistance) / 2
    const { audio, gain } = fadedAt(distance)

    fadeToDistance(audio, { smooth: false })

    expect(gain.value).toBeCloseTo(distanceGain(distance, range))
    expect(gain.at).toBe(audio.context.currentTime)
    expect(gain.cancelledAt).toBe(audio.context.currentTime)
  })

  it('fora do alcance, sai mudo desde o começo', () => {
    const { audio, gain } = fadedAt(range.maxDistance + 1)
    gain.value = 1

    fadeToDistance(audio, { smooth: false })

    expect(gain.value).toBe(0)
  })

  it('com o som tocando, desliza até o volume da distância', () => {
    const distance = range.refDistance + 1
    const { audio, gain } = fadedAt(distance)

    fadeToDistance(audio, { smooth: true })

    expect(gain.target.value).toBeCloseTo(distanceGain(distance, range))
    expect(gain.cancelledAt).toBeNull()
  })
})
