import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { Mood } from '@/core/traits'
import {
  registerEyeBlink,
  unregisterEyeBlink,
} from '@/view/registry/eyeBlinkRegistry'
import { eyeBlinkSystem } from './eyeBlinkSystem'

const REPEAT = { x: 0.25, y: 0.25 }
const STATES = {
  awake: { open: { x: -0.5, y: 0 }, closed: { x: -0.5, y: 0.5 } },
  angry: { open: { x: 0, y: 0 }, closed: { x: 0.5, y: 0.75 } },
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
