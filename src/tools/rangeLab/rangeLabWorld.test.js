import { afterEach, describe, expect, it } from 'vitest'
import { getSpecies, listSpecies } from '@/core/data/species'
import { CryPulse, Position, Velocity, WildCreature } from '@/core/traits'
import {
  getVoiceAudioEntry,
  registerVoiceAudio,
  unregisterVoiceAudio,
} from '@/view/registry/voiceAudioRegistry'
import { makeWorld } from '@/test/makeWorld'
import { bearingFrom } from './rangeLabData'
import {
  createRangeLabState,
  rangeLabSystem,
  resolveVoiceRange,
} from './rangeLabWorld'

// Quem põe a selvagem no lugar no laboratório de alcance (docs/features/062-
// spawn-estilo-cobblemon.md). Números só de teste; a voz sai da espécie.

const [SPECIES, OTHER] = listSpecies().filter((species) => species.spawn)
const STEP = 0.1
// Vista do lab ao abrir: frente em +z, direita em −x.
const FORWARD = { x: 0, z: 1 }
const RIGHT = { x: -1, z: 0 }

function lab(changes = {}) {
  return {
    speciesId: SPECIES.id,
    mode: 'still',
    distance: 20,
    angle: 0,
    orbitSpeed: 30,
    from: 10,
    to: 30,
    speed: 2,
    respawnEvery: 1,
    cryEvery: 0,
    ...changes,
  }
}

const worlds = []
const voices = []
afterEach(() => {
  while (voices.length) unregisterVoiceAudio(voices.pop())
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world } = makeWorld()
  worlds.push(world)
  return { world, state: createRangeLabState() }
}

// A voz já carregada, como o `useAnimatedModel` deixa.
function loadVoice(entity) {
  const audio = { isPlaying: false, stop() {}, disconnect() {} }
  registerVoiceAudio(entity, audio, { minInterval: 1, maxInterval: 1 })
  getVoiceAudioEntry(entity).buffers.push('som')
  voices.push(entity)
  return audio
}

// O pulso vira som; enquanto toca, `during`; depois, o som acaba.
function playCry(entity, audio, during) {
  entity.remove(CryPulse)
  audio.isPlaying = true
  during()
  audio.isPlaying = false
}

function run(world, state, labValue, steps = 1) {
  for (let i = 0; i < steps; i += 1) {
    rangeLabSystem({ world, delta: STEP, lab: labValue, state })
  }
}

function wilds(world) {
  return [...world.query(WildCreature)]
}

describe('rangeLabSystem', () => {
  it('nasce uma selvagem da espécie escolhida, na distância pedida', () => {
    const { world, state } = setup()
    const value = lab()
    run(world, state, value)
    expect(wilds(world)).toHaveLength(1)
    expect(state.entity.get(WildCreature).speciesId).toBe(SPECIES.id)
    expect(state.entity.get(Position).z).toBe(value.distance)
  })

  it('parada, acompanha a distância e não tem velocidade', () => {
    const { world, state } = setup()
    run(world, state, lab())
    const moved = lab({ distance: 35 })
    run(world, state, moved)
    expect(state.entity.get(Position).z).toBe(moved.distance)
    expect(state.entity.get(Velocity).z).toBe(0)
  })

  it('no ir e voltar, anda com velocidade e fica entre as pontas', () => {
    const { world, state } = setup()
    const value = lab({ mode: 'shuttle', distance: 12 })
    run(world, state, value)
    const first = state.entity.get(Position).z
    run(world, state, value)
    expect(state.entity.get(Position).z).not.toBe(first)
    expect(Math.abs(state.entity.get(Velocity).z)).toBe(value.speed)

    run(world, state, value, 500)
    const z = state.entity.get(Position).z
    expect(z).toBeGreaterThanOrEqual(value.from)
    expect(z).toBeLessThanOrEqual(value.to)
  })

  it('no ângulo pedido, fica do lado pedido, na mesma distância', () => {
    const { world, state } = setup()
    const value = lab({ angle: -90 })
    run(world, state, value)
    const { x, z } = state.entity.get(Position)
    expect(Math.hypot(x, z)).toBeCloseTo(value.distance)
    expect(bearingFrom(FORWARD, RIGHT, { x, z })).toBeCloseTo(value.angle)
  })

  it('dando a volta, gira em volta da câmera sem mudar a distância', () => {
    const { world, state } = setup()
    const value = lab({ mode: 'orbit' })
    run(world, state, value)
    const before = state.entity.get(Position)
    const bearingBefore = bearingFrom(FORWARD, RIGHT, before)
    run(world, state, value, 5)
    const after = state.entity.get(Position)
    expect(Math.hypot(after.x, after.z)).toBeCloseTo(value.distance)
    expect(bearingFrom(FORWARD, RIGHT, after)).toBeGreaterThan(bearingBefore)
    const { x, z } = state.entity.get(Velocity)
    expect(Math.hypot(x, z)).toBeGreaterThan(0)
  })

  it('trocar a espécie troca a selvagem, sem sobrar a anterior', () => {
    const { world, state } = setup()
    run(world, state, lab())
    run(world, state, lab({ speciesId: OTHER.id }))
    expect(wilds(world)).toHaveLength(1)
    expect(state.entity.get(WildCreature).speciesId).toBe(OTHER.id)
  })

  it('nascer em loop troca a entidade no intervalo', () => {
    const { world, state } = setup()
    const value = lab({ mode: 'respawn' })
    run(world, state, value)
    const first = state.entity
    run(world, state, value, Math.ceil(value.respawnEvery / STEP) + 1)
    expect(state.entity).not.toBe(first)
    expect(wilds(world)).toHaveLength(1)
  })

  it('tirar deixa sem ninguém até pedir para nascer', () => {
    const { world, state } = setup()
    run(world, state, lab())
    state.commands.push('remove')
    run(world, state, lab(), 3)
    expect(wilds(world)).toHaveLength(0)

    state.commands.push('respawn')
    run(world, state, lab())
    expect(wilds(world)).toHaveLength(1)
  })

  it('só grita com a voz carregada', () => {
    const { world, state } = setup()
    run(world, state, lab())
    state.commands.push('cry')
    run(world, state, lab())
    expect(state.entity.has(CryPulse)).toBe(false)
  })
})

describe('teste do estalo', () => {
  it('nasce de novo fora do alcance, grita e fica lá até o som acabar', () => {
    const { world, state } = setup()
    const value = lab()
    run(world, state, value)
    const previous = state.entity
    const range = resolveVoiceRange(getSpecies(value.speciesId))

    state.commands.push('clickTest')
    run(world, state, value)
    const { entity } = state
    expect(entity).not.toBe(previous)
    const far = entity.get(Position).z
    expect(far).toBeGreaterThan(range.maxDistance)
    const audio = loadVoice(entity)

    run(world, state, value, 10)
    expect(entity.has(CryPulse)).toBe(true)

    playCry(entity, audio, () => run(world, state, value, 2))
    expect(entity.get(Position).z).toBe(far)
    run(world, state, value)
    expect(state.clickTest).toBeNull()
  })
})
