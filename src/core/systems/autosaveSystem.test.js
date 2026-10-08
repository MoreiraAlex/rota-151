import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { createEventQueue, EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { SaveRequested, TrainerReady } from '../traits'
import { autosaveSystem } from './autosaveSystem'

// Save automático (docs/features/044-salvar-o-jogo.md): só pede.
const { AUTOSAVE_INTERVAL } = GAME_CONFIG.SAVE

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ ready = true } = {}) {
  const { world, player } = makeWorld()
  worlds.push(world)
  if (ready) player.add(TrainerReady)
  const events = createEventQueue()
  const step = (delta) => {
    autosaveSystem({ world, delta, events })
    events.beginStep()
  }
  return { world, player, events, step }
}

describe('autosaveSystem', () => {
  it('pede um save ao completar o intervalo, e não antes', () => {
    const { player, step } = setup()

    step(AUTOSAVE_INTERVAL / 2)
    expect(player.has(SaveRequested)).toBe(false)

    step(AUTOSAVE_INTERVAL / 2)
    expect(player.has(SaveRequested)).toBe(true)
  })

  it('o relógio volta a zero depois de pedir', () => {
    const { player, step } = setup()
    step(AUTOSAVE_INTERVAL)
    player.remove(SaveRequested)

    step(AUTOSAVE_INTERVAL / 2)
    expect(player.has(SaveRequested)).toBe(false)
  })

  it('pede na hora depois de uma captura do treinador', () => {
    const { player, events, step } = setup()
    events.emit({ type: EVENT_TYPES.POKEMON_CAPTURED, trainer: player })

    step(0)
    expect(player.has(SaveRequested)).toBe(true)
  })

  it('treinador ainda não preparado não pede', () => {
    const { player, step } = setup({ ready: false })
    step(AUTOSAVE_INTERVAL)
    expect(player.has(SaveRequested)).toBe(false)
  })
})
