import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { AnimationState } from '@/core/traits'
import {
  registerFootstepAudio,
  unregisterFootstepAudio,
} from '@/view/registry/footstepAudioRegistry'
import { footstepAudioSystem } from './footstepAudioSystem'

function fakeAudio() {
  return { isPlaying: false, stop: () => {}, disconnect: () => {} }
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
})
