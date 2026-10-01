import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorld } from 'koota'
import { ActionState, AttackPulse, SummonedCreature } from '@/core/traits'
import { getSpecies } from '@/core/data/species'
import { resolveSkill } from '@/core/data/skills'
import {
  registerAttackAudio,
  unregisterAttackAudio,
} from '@/view/registry/attackAudioRegistry'
import { attackAudioSystem } from './attackAudioSystem'

function fakeAudio() {
  return {
    isPlaying: false,
    plays: 0,
    buffer: null,
    stop() {
      this.isPlaying = false
    },
    disconnect() {},
    setBuffer(buffer) {
      this.buffer = buffer
    },
    play() {
      this.plays += 1
      this.isPlaying = true
    },
    setLoop(loop) {
      this.loop = loop
    },
  }
}

function voice(delay, buffers = ['buf']) {
  return { audio: fakeAudio(), delay, buffers }
}

describe('attackAudioSystem', () => {
  let world
  const entities = []

  afterEach(() => {
    for (const entity of entities) unregisterAttackAudio(entity)
    entities.length = 0
    world?.destroy()
    vi.restoreAllMocks()
  })

  function setup(voices) {
    world = createWorld()
    const entity = world.spawn()
    entities.push(entity)
    registerAttackAudio(entity, voices)
    return entity
  }

  it('o pulso toca as partes do SLOT que disparou e é consumido', () => {
    const basic = voice(0)
    const ember = voice(0)
    const entity = setup({ primary: [basic], secondary2: [ember] })

    entity.add(AttackPulse({ slot: 'secondary2' }))
    attackAudioSystem({ delta: 1 / 60 })

    expect(ember.audio.plays).toBe(1)
    expect(basic.audio.plays).toBe(0)
    expect(entity.has(AttackPulse)).toBe(false)
  })

  it('a parte com atraso só toca depois do tempo (contado pelo delta)', () => {
    const actor = voice(0)
    const target = voice(0.5)
    const entity = setup({ secondary2: [actor, target] })

    // passos de 0.125 s (exatos em ponto flutuante)
    entity.add(AttackPulse({ slot: 'secondary2' }))
    attackAudioSystem({ delta: 0.125 })
    expect(actor.audio.plays).toBe(1)
    expect(target.audio.plays).toBe(0)

    for (let i = 0; i < 2; i++) attackAudioSystem({ delta: 0.125 })
    expect(target.audio.plays).toBe(0) // 0.375 s

    attackAudioSystem({ delta: 0.125 }) // 0.5 s
    expect(target.audio.plays).toBe(1)

    // não repete
    attackAudioSystem({ delta: 1 })
    expect(target.audio.plays).toBe(1)
    expect(actor.audio.plays).toBe(1)
  })

  it('dois golpes seguidos: cada um agenda o seu atraso', () => {
    const target = voice(0.3)
    const entity = setup({ secondary2: [voice(0), target] })

    entity.add(AttackPulse({ slot: 'secondary2' }))
    attackAudioSystem({ delta: 0.2 })
    entity.add(AttackPulse({ slot: 'secondary2' }))
    attackAudioSystem({ delta: 0.2 }) // 1º golpe: 0.4 s → toca

    expect(target.audio.plays).toBe(1)
    attackAudioSystem({ delta: 0.2 }) // 2º golpe: 0.4 s → toca
    expect(target.audio.plays).toBe(2)
  })

  it('sem buffer carregado ainda não toca, mas o pulso é consumido', () => {
    const silent = voice(0, [])
    const entity = setup({ primary: [silent] })

    entity.add(AttackPulse({ slot: 'primary' }))
    attackAudioSystem({ delta: 1 / 60 })

    expect(silent.audio.plays).toBe(0)
    expect(entity.has(AttackPulse)).toBe(false)
  })

  it('slot sem som (ex.: habilidade sem áudio) é ignorado sem quebrar', () => {
    const entity = setup({ primary: [voice(0)] })

    entity.add(AttackPulse({ slot: 'secondary3' }))

    expect(() => attackAudioSystem({ delta: 1 / 60 })).not.toThrow()
    expect(entity.has(AttackPulse)).toBe(false)
  })

  it('toca uma variação sorteada dos buffers e reinicia se já estava tocando', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const v = voice(0, ['a', 'b', 'c'])
    v.audio.isPlaying = true
    const entity = setup({ primary: [v] })

    entity.add(AttackPulse({ slot: 'primary' }))
    attackAudioSystem({ delta: 1 / 60 })

    expect(v.audio.buffer).toBe('c')
    expect(v.audio.plays).toBe(1)
  })

  it('entidade já destruída no ECS (criatura recolhida) não quebra o system', () => {
    const entity = setup({ primary: [voice(0)] })
    entity.destroy()

    expect(() => attackAudioSystem({ delta: 1 / 60 })).not.toThrow()
  })
})

describe('attackAudioSystem — som de CARGA', () => {
  let world
  let entity
  const GROWTH = resolveSkill('growth')

  // Growth no slot 1 do charmander só aqui — restaura no fim.
  const charmander = getSpecies('charmander')
  let original

  afterEach(() => {
    unregisterAttackAudio(entity)
    world?.destroy()
    charmander.skills[1] = original
  })

  function setup() {
    original = charmander.skills[1]
    charmander.skills[1] = 'growth'
    world = createWorld()
    entity = world.spawn(
      ActionState,
      SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
    )
    const charge = voice(0)
    registerAttackAudio(entity, {}, { secondary1: charge })
    return charge
  }

  function charging(elapsed) {
    entity.set(ActionState, {
      current: 'attack',
      pendingSlot: 'secondary1',
      elapsed,
      animationSpeed: 1 / GROWTH.duration,
    })
  }

  it('toca em LOOP enquanto o golpe carrega (antes do effectAt), uma vez só', () => {
    const charge = setup()

    charging(0.1)
    attackAudioSystem({ delta: 1 / 60 })
    attackAudioSystem({ delta: 1 / 60 })

    expect(charge.audio.plays).toBe(1)
    expect(charge.audio.isPlaying).toBe(true)
    expect(charge.audio.loop).toBe(true)
  })

  it('para no effectAt (a carga acabou)', () => {
    const charge = setup()
    charging(0.1)
    attackAudioSystem({ delta: 1 / 60 })

    charging(GROWTH.effectAt + 0.01)
    attackAudioSystem({ delta: 1 / 60 })

    expect(charge.audio.isPlaying).toBe(false)
  })

  it('para se a ação acaba no meio (golpe interrompido)', () => {
    const charge = setup()
    charging(0.1)
    attackAudioSystem({ delta: 1 / 60 })

    entity.set(ActionState, { current: null, pendingSlot: null })
    attackAudioSystem({ delta: 1 / 60 })

    expect(charge.audio.isPlaying).toBe(false)
  })
})
