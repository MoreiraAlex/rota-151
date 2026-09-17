import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { ActionState } from '@/core/traits'
import {
  registerDashAudio,
  unregisterDashAudio,
} from '@/view/registry/dashAudioRegistry'
import { dashAudioSystem } from './dashAudioSystem'

function fakeAudio() {
  return { isPlaying: false, stop: () => {}, disconnect: () => {} }
}

describe('dashAudioSystem', () => {
  let world

  afterEach(() => {
    world?.destroy()
  })

  it('entidade já destruída no ECS (ex.: criatura recolhida) não quebra o system', () => {
    // Mesma regressão de footstepAudioSystem.test.js — `entity.get()`
    // devolve `undefined` pra uma entidade destruída antes do registry
    // ser limpo (React desmonta um commit depois).
    world = createWorld()
    const entity = world.spawn(ActionState({ current: 'dash' }))
    registerDashAudio(entity, fakeAudio())

    entity.destroy()

    expect(() => dashAudioSystem()).not.toThrow()

    unregisterDashAudio(entity)
  })

  it('entidade viva sem dash em andamento não toca nada (regressão de comportamento normal)', () => {
    world = createWorld()
    const entity = world.spawn(ActionState({ current: null }))
    registerDashAudio(entity, fakeAudio())

    expect(() => dashAudioSystem()).not.toThrow()

    unregisterDashAudio(entity)
  })
})
