import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { AnimationState, Position } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WATER_SOUNDS } from '@/core/data/audio/waterSounds'
import {
  getFootstepAudioEntry,
  registerFootstepAudio,
  unregisterFootstepAudio,
} from '@/view/registry/footstepAudioRegistry'
import {
  getAnimatedBonesEntry,
  registerAnimatedBones,
  unregisterAnimatedBones,
} from '@/view/registry/animationRegistry'
import { getFootRipples } from '@/view/water/footRipples'
import { withDeepWater } from '@/test/deepWater'
import { footstepAudioSystem } from './footstepAudioSystem'

function fakeAudio() {
  const audio = {
    isPlaying: false,
    played: [],
    volume: null,
    buffer: null,
    stop: () => {},
    disconnect: () => {},
    setVolume: (volume) => (audio.volume = volume),
    setBuffer: (buffer) => (audio.buffer = buffer),
    play: () => audio.played.push(audio.buffer),
  }
  return audio
}

describe('footstepAudioSystem', () => {
  let world

  afterEach(() => {
    world?.destroy()
  })

  it('entidade já destruída no ECS (ex.: criatura recolhida) não quebra o system', () => {
    // Regressão: `applyRecall` (partySummonSystem.js) destrói a entidade
    // na fase simulation, SÍNCRONA e ANTES da presentation no mesmo
    // frame — o registry de áudio só é limpo quando `CreatureView`
    // desmonta, no próximo commit do React (depois deste mesmo useFrame
    // já ter rodado tudo). Por um frame, o registry pode apontar pra uma
    // entidade que o koota já não tem mais dado nenhum — `entity.get()`
    // devolve `undefined`, não deveria derrubar o system inteiro (bug
    // real, relatado jogando: "Cannot read properties of undefined
    // (reading 'id')").
    world = createWorld()
    const entity = world.spawn(AnimationState({ id: 'walk' }))
    registerFootstepAudio(entity, fakeAudio())

    entity.destroy()

    expect(() => footstepAudioSystem()).not.toThrow()

    unregisterFootstepAudio(entity)
  })

  it('entidade viva sem estar andando/correndo não toca nada (regressão de comportamento normal)', () => {
    world = createWorld()
    const entity = world.spawn(AnimationState({ id: 'idle' }))
    const audio = fakeAudio()
    registerFootstepAudio(entity, audio)

    expect(() => footstepAudioSystem()).not.toThrow()

    unregisterFootstepAudio(entity)
  })

  // docs/features/057-lagos-e-rios.md
  it('na água toca o passo da água e acende uma marolinha; em terra, o da espécie', () => {
    world = createWorld()
    const entity = world.spawn(
      AnimationState({ id: 'walk' }),
      Position({ x: 0, y: 0, z: 0 }),
    )
    const audio = fakeAudio()
    const speciesVolume = 0.123
    registerFootstepAudio(entity, audio, speciesVolume)
    const entry = getFootstepAudioEntry(entity)
    entry.buffers.walk.push('terra')
    entry.waterBuffers.walk.push('agua')
    registerAnimatedBones(entity, { bones: [], clips: {} })
    const animated = getAnimatedBonesEntry(entity)
    animated.stateId = 'walk'

    animated.cyclePhase = 0.1
    footstepAudioSystem()
    expect(audio.played.at(-1)).toBe('terra')
    expect(audio.volume).toBe(speciesVolume)

    withDeepWater(() => {
      animated.cyclePhase = 0.6
      footstepAudioSystem()
    })
    expect(audio.played.at(-1)).toBe('agua')
    expect(audio.volume).toBe(WATER_SOUNDS.step.volume)
    const ripple = getFootRipples().find(({ age }) => age === 0)
    expect(ripple.y).toBe(GAME_CONFIG.TERRAIN.WATER_LEVEL)

    unregisterAnimatedBones(entity)
    unregisterFootstepAudio(entity)
  })
})
