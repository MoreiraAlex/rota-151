import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { Fainted, Mood } from '@/core/traits'
import {
  registerEyeBlink,
  unregisterEyeBlink,
} from '@/view/registry/eyeBlinkRegistry'
import { eyeBlinkSystem } from './eyeBlinkSystem'

const REPEAT = { x: 0.25, y: 0.25 }
const STATES = {
  awake: { open: { x: -0.5, y: 0 }, closed: { x: -0.5, y: 0.5 } },
  angry: { open: { x: 0, y: 0 }, closed: { x: 0.5, y: 0.75 } },
  // Aberto ≠ fechado de propósito: piscar mudaria o offset.
  faint: { open: { x: 0.25, y: 0.25 }, closed: { x: -0.25, y: 0.5 } },
}
// Offset esperado da célula "aberto" de cada humor (mesma conta do system).
const openOffsetX = (mood) => (1 - REPEAT.x) / 2 + STATES[mood].open.x

const worlds = []
const registered = []

function spawnCreature(mood, texture, blinkTimer) {
  const world = createWorld()
  worlds.push(world)
  const entity = world.spawn(Mood({ state: mood }))
  registerEyeBlink(entity, [
    {
      texture,
      repeat: REPEAT,
      states: STATES,
      blink: { minInterval: 1, maxInterval: 1, closedDuration: 0.1 },
      phase: 'open',
      timer: blinkTimer,
      lastMood: mood,
    },
  ])
  registered.push(entity)
  return entity
}

function run(seconds, step = 0.05) {
  for (let t = 0; t < seconds; t += step) eyeBlinkSystem({ delta: step })
}

afterEach(() => {
  while (registered.length) unregisterEyeBlink(registered.pop())
  while (worlds.length) worlds.pop().destroy()
})

describe('eyeBlinkSystem — criaturas da mesma espécie com humores diferentes', () => {
  it('com textura própria por criatura, cada olho mostra o próprio humor', () => {
    const base = new THREE.Texture()
    const angryTexture = base.clone()
    const awakeTexture = base.clone()
    // Piscadas em momentos diferentes, como no jogo.
    spawnCreature('angry', angryTexture, 0.3)
    spawnCreature('awake', awakeTexture, 0.7)

    // Em 1.2s: a brava piscou (0.3–0.4s) e a normal também (0.7–0.8s);
    // as duas estão de olho aberto de novo.
    run(1.2)

    // Depois de piscar, as duas voltaram pro "aberto" do PRÓPRIO humor.
    expect(angryTexture.offset.x).toBeCloseTo(openOffsetX('angry'))
    expect(awakeTexture.offset.x).toBeCloseTo(openOffsetX('awake'))
  })

  it('(o bug) com a MESMA textura, a piscada de uma sobrescreve o olho da outra', () => {
    const shared = new THREE.Texture()
    spawnCreature('angry', shared, 0.3)
    spawnCreature('awake', shared, 0.7)

    run(1.2)

    // A awake piscou por último: o olho da criatura BRAVA ficou normal.
    expect(shared.offset.x).toBeCloseTo(openOffsetX('awake'))
  })
})

describe('eyeBlinkSystem — desmaiada', () => {
  // Registra o offset X de cada frame (piscar = passar pelo "fechado").
  function sampleOffsets(texture, seconds, step = 0.05) {
    const seen = new Set()
    for (let t = 0; t < seconds; t += step) {
      eyeBlinkSystem({ delta: step })
      seen.add(texture.offset.x.toFixed(4))
    }
    return seen
  }

  it('não pisca: olho parado no "aberto" do humor faint', () => {
    const texture = new THREE.Texture()
    const entity = spawnCreature('awake', texture, 0.3)
    // Mesmo caminho de `desmaiar`: humor faint + `Fainted`.
    entity.set(Mood, { state: 'faint' })
    entity.add(Fainted)

    const seen = sampleOffsets(texture, 5)

    expect([...seen]).toEqual([openOffsetX('faint').toFixed(4)])
  })

  it('desmaiou de olho fechado (no meio da piscada): abre na hora no olho de desmaio', () => {
    const texture = new THREE.Texture()
    const entity = spawnCreature('awake', texture, 0.3)
    run(0.35) // no meio da piscada, fechado
    entity.set(Mood, { state: 'faint' })
    entity.add(Fainted)

    eyeBlinkSystem({ delta: 0.01 })

    expect(texture.offset.x).toBeCloseTo(openOffsetX('faint'))
  })

  it('controle: sem `Fainted`, o mesmo humor pisca', () => {
    const texture = new THREE.Texture()
    spawnCreature('faint', texture, 0.3)

    expect(sampleOffsets(texture, 5).size).toBeGreaterThan(1)
  })
})

describe('eyeBlinkSystem — um relógio por entidade', () => {
  // Treinador: uma textura por olho, na MESMA entidade.
  function spawnTwoEyes(timers) {
    const world = createWorld()
    worlds.push(world)
    const entity = world.spawn(Mood({ state: 'awake' }))
    const textures = timers.map(() => new THREE.Texture())
    registerEyeBlink(
      entity,
      textures.map((texture, i) => ({
        texture,
        repeat: REPEAT,
        states: STATES,
        blink: { minInterval: 1, maxInterval: 1, closedDuration: 0.1 },
        phase: 'open',
        timer: timers[i],
        lastMood: 'awake',
      })),
    )
    registered.push(entity)
    return textures
  }

  it('os dois olhos piscam juntos (mesmo com relógios iniciais diferentes)', () => {
    const [left, right] = spawnTwoEyes([0.3, 0.7])
    const closedX = (1 - REPEAT.x) / 2 + STATES.awake.closed.x

    run(0.35) // no meio da piscada do relógio da entidade

    expect(left.offset.x).toBeCloseTo(closedX)
    expect(right.offset.x).toBeCloseTo(closedX)

    run(0.1) // abriu de novo: os dois
    expect(left.offset.x).toBeCloseTo(openOffsetX('awake'))
    expect(right.offset.x).toBeCloseTo(openOffsetX('awake'))
  })

  it('piscar só mexe no recorte (offset) — não reenvia a imagem pra GPU', () => {
    const [eye] = spawnTwoEyes([0.3])
    const versionBefore = eye.version

    run(2) // várias piscadas

    expect(eye.version).toBe(versionBefore)
  })
})
