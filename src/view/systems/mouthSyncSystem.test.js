import { afterEach, describe, expect, it } from 'vitest'
import { mouthSyncSystem } from './mouthSyncSystem'
import {
  registerVoiceAudio,
  unregisterVoiceAudio,
} from '@/view/registry/voiceAudioRegistry'
import {
  registerMouthSync,
  unregisterMouthSync,
} from '@/view/registry/mouthSyncRegistry'
import { quaternionFromAxisAngle } from '@/core/math'

const entity = {}

function makeJaw() {
  const quaternion = {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    set(x, y, z, w) {
      Object.assign(this, { x, y, z, w })
    },
  }
  return {
    bone: {
      quaternion,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    rest: {
      rotation: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    restQuaternion: { x: 0, y: 0, z: 0, w: 1 },
  }
}

function setup() {
  const audio = { isPlaying: false, stop() {}, disconnect() {} }
  registerVoiceAudio(entity, audio, { minInterval: 1, maxInterval: 1 })

  const jaw = makeJaw()
  // pose da animação de base: diferente da de descanso e da do grito
  const base = quaternionFromAxisAngle('y', 0.3)
  jaw.bone.quaternion.set(base.x, base.y, base.z, base.w)

  const clip = {
    bones: { jaw: { rotation: { y: { type: 'constant', value: -0.5 } } } },
  }
  registerMouthSync(entity, {
    bones: { jaw },
    clip,
    elapsed: 0,
    wasPlaying: false,
  })
  return { audio, jaw, base }
}

afterEach(() => {
  unregisterVoiceAudio(entity)
  unregisterMouthSync(entity)
})

describe('mouthSyncSystem', () => {
  it('enquanto o grito toca, mexe no osso', () => {
    const { audio, jaw, base } = setup()
    audio.isPlaying = true
    mouthSyncSystem({ delta: 0.1 })
    expect(jaw.bone.quaternion.y).not.toBeCloseTo(base.y)
  })

  it('quando o grito acaba, o osso volta pra pose da animação de base', () => {
    const { audio, jaw, base } = setup()
    audio.isPlaying = true
    mouthSyncSystem({ delta: 0.1 })
    audio.isPlaying = false
    mouthSyncSystem({ delta: 0.1 })

    // a animação de base não reescreve o osso (trilha parada): quem devolve
    // a pose é o próprio system
    expect(jaw.bone.quaternion.y).toBeCloseTo(base.y)
    expect(jaw.bone.quaternion.w).toBeCloseTo(base.w)
  })
})
