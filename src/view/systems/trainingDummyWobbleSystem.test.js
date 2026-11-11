import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { TRAINING_SLOT } from '@/core/battle/creatureAttack'
import { listSkills, resolveSkill } from '@/core/data/skills'
import { attackFailed, attackUsed } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { Position, Training, TrainingObject } from '@/core/traits'
import {
  registerTrainingDummy,
  trainingDummyWobbles,
  unregisterTrainingDummy,
} from '../registry/trainingDummyRegistry'
import {
  trainingDummyWobbleSystem,
  wobbleAngleAt,
  wobbleAxisOf,
} from './trainingDummyWobbleSystem'

// O balanço do boneco de treino (docs/features/067-campo-de-treino-e-
// avisos-de-nivel.md).
const WOBBLE = GAME_CONFIG.FEEDBACK.TRAINING_DUMMY_WOBBLE
const SKILLS = listSkills().map(({ id }) => id)
const HIT = SKILLS.find((id) => resolveSkill(id)?.area !== 'self')
const SELF = SKILLS.find((id) => resolveSkill(id)?.area === 'self')

const worlds = []
afterEach(() => {
  while (worlds.length) {
    const world = worlds.pop()
    for (const entity of world.query(TrainingObject)) {
      unregisterTrainingDummy(entity)
    }
    world.destroy()
  }
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  const dummy = world.spawn(Position({ x: 2, y: 0, z: 0 }), TrainingObject)
  const tilt = new THREE.Group()
  registerTrainingDummy(dummy, tilt)
  const trainee = world.spawn(
    Position({ x: 0, y: 0, z: 0 }),
    Training({ moveId: HIT, object: dummy }),
  )
  const run = (events, delta = 1 / 60) =>
    trainingDummyWobbleSystem({ world, delta, frameEvents: events })
  return { dummy, tilt, trainee, run }
}

// O topo do boneco (1 m acima da base) depois da inclinação.
const topOf = (tilt) =>
  new THREE.Vector3(0, 1, 0).applyQuaternion(tilt.quaternion)

describe('balanço do boneco de treino', () => {
  it('a curva começa parada, vai e volta e morre', () => {
    expect(wobbleAngleAt(0, WOBBLE)).toBe(0)
    const peak = wobbleAngleAt(1 / (4 * WOBBLE.FREQUENCY), WOBBLE)
    expect(peak).toBeGreaterThan(0)
    const later = wobbleAngleAt(1 / (4 * WOBBLE.FREQUENCY) + 1, WOBBLE)
    expect(Math.abs(later)).toBeLessThan(peak)
  })

  it('o golpe do treino inclina o boneco para longe de quem bateu', () => {
    const { tilt, trainee, run } = setup()
    run([attackUsed({ entity: trainee, attackId: HIT, slot: TRAINING_SLOT })])
    run([], 1 / (4 * WOBBLE.FREQUENCY))
    expect(topOf(tilt).x).toBeGreaterThan(0)
  })

  it('para no fim e volta a ficar reto', () => {
    const { dummy, tilt, trainee, run } = setup()
    run([attackUsed({ entity: trainee, attackId: HIT, slot: TRAINING_SLOT })])
    run([], WOBBLE.DURATION + 0.1)
    expect(tilt.quaternion.equals(new THREE.Quaternion())).toBe(true)
    expect(trainingDummyWobbles().has(dummy)).toBe(false)
  })

  it.runIf(SELF)('golpe em si mesmo não mexe no boneco', () => {
    const { dummy, trainee, run } = setup()
    run([attackUsed({ entity: trainee, attackId: SELF, slot: TRAINING_SLOT })])
    expect(trainingDummyWobbles().has(dummy)).toBe(false)
  })

  it('golpe que falhou não mexe no boneco', () => {
    const { dummy, trainee, run } = setup()
    const move = { entity: trainee, attackId: HIT, slot: TRAINING_SLOT }
    run([attackUsed(move), attackFailed(move)])
    expect(trainingDummyWobbles().has(dummy)).toBe(false)
  })

  it('golpe fora do treino não mexe no boneco', () => {
    const { dummy, trainee, run } = setup()
    run([attackUsed({ entity: trainee, attackId: HIT, slot: 'secondary1' })])
    expect(trainingDummyWobbles().has(dummy)).toBe(false)
  })

  it('o eixo deixa o topo do lado oposto a quem bateu', () => {
    const axis = wobbleAxisOf({ x: 0, z: 0 }, { x: 0, z: 3 })
    const top = new THREE.Vector3(0, 1, 0).applyAxisAngle(axis, 0.3)
    expect(top.z).toBeGreaterThan(0)
  })
})
