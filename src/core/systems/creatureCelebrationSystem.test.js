import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import {
  isCelebrating,
  isPlayerActing,
  pedirComemoracao,
} from '../actions/celebration'
import { getSpecies, listSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { attackResolved, createEventQueue } from '../events'
import {
  ActionState,
  Fainted,
  InputControlled,
  OwnedBy,
  Party,
  PendingCelebration,
  SummonedCreature,
  Velocity,
} from '../traits'
import {
  celebrationDamageSystem,
  celebrationInputSystem,
  creatureCelebrationSystem,
} from './creatureCelebrationSystem'

const DELTA = 1 / 60
const SPECIES_ID = listSpecies().find(
  (species) => species.actions?.happy?.duration > 0,
).id
const DURATION = getSpecies(SPECIES_ID).actions.happy.duration

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup({ action = null } = {}) {
  const world = createWorld()
  worlds.push(world)
  const trainer = world.spawn(Party, InputControlled)
  const creature = world.spawn(
    SummonedCreature({ slot: 'slot1', speciesId: SPECIES_ID }),
    ActionState({ current: action }),
    Velocity({ x: 3, y: 0, z: 3 }),
    OwnedBy(trainer),
  )
  return { world, trainer, creature }
}

function run(world, seconds) {
  for (let t = 0; t < seconds; t += DELTA) {
    creatureCelebrationSystem({ world, delta: DELTA })
  }
}

describe('comemoração ao subir de nível', () => {
  it('livre, começa na hora, fica parada e libera no fim do clipe', () => {
    const { world, creature } = setup()
    pedirComemoracao(creature)

    run(world, DELTA)
    expect(isCelebrating(creature)).toBe(true)
    expect(creature.get(ActionState).animationSpeed).toBeCloseTo(1 / DURATION)
    expect(creature.has(PendingCelebration)).toBe(false)

    run(world, DURATION / 2)
    expect(creature.get(Velocity).x).toBe(0)
    expect(isCelebrating(creature)).toBe(true)

    run(world, DURATION)
    expect(creature.get(ActionState).current).toBe(null)
  })

  it('ocupada (golpe do nocaute), espera ficar livre pra começar', () => {
    const { world, creature } = setup({ action: 'attack' })
    pedirComemoracao(creature)

    run(world, DELTA * 3)
    expect(isCelebrating(creature)).toBe(false)

    creature.set(ActionState, { current: null })
    run(world, DELTA)
    expect(isCelebrating(creature)).toBe(true)
  })

  it('desiste se não ficar livre a tempo', () => {
    const { world, creature } = setup({ action: 'attack' })
    pedirComemoracao(creature)

    run(world, GAME_CONFIG.EXPERIENCE.CELEBRATION_WAIT + DELTA * 2)
    expect(creature.has(PendingCelebration)).toBe(false)

    creature.set(ActionState, { current: null })
    run(world, DELTA)
    expect(isCelebrating(creature)).toBe(false)
  })

  it('desmaiada não comemora', () => {
    const { world, creature } = setup()
    pedirComemoracao(creature)
    creature.add(Fainted)

    run(world, DELTA)
    expect(isCelebrating(creature)).toBe(false)
    expect(creature.has(PendingCelebration)).toBe(false)
  })

  it('qualquer ação do jogador corta, a em andamento e a que esperava', () => {
    const { world, creature } = setup()
    pedirComemoracao(creature)
    run(world, DELTA)
    expect(isCelebrating(creature)).toBe(true)

    celebrationInputSystem({ world, input: { jump: true } })
    expect(isCelebrating(creature)).toBe(false)

    creature.set(ActionState, { current: 'attack' })
    pedirComemoracao(creature)
    celebrationInputSystem({ world, input: { forward: true } })
    expect(creature.has(PendingCelebration)).toBe(false)
  })

  it('mexer a câmera não é ação', () => {
    expect(isPlayerActing({ cameraYaw: 0.3, cameraPitch: 0.1, zoom: 1 })).toBe(
      false,
    )
    expect(isPlayerActing({ secondary2: true })).toBe(true)
    expect(isPlayerActing({ returnToBot: true })).toBe(true)
  })

  it('tomar dano corta', () => {
    const { world, creature } = setup()
    pedirComemoracao(creature)
    run(world, DELTA)
    const events = createEventQueue()
    events.emit(
      attackResolved({
        attacker: null,
        target: creature,
        attackId: 'tackle',
        slot: 'primary',
        origin: { x: 0, y: 0, z: 0 },
        impactPoint: { x: 0, y: 0, z: 1 },
        contactPoint: { x: 0, y: 0, z: 0.8 },
        damage: 5,
      }),
    )

    celebrationDamageSystem({ world, events })
    expect(isCelebrating(creature)).toBe(false)
  })

  it('toda espécie com animação happy declara quanto ela dura', () => {
    for (const species of listSpecies()) {
      if (!species.nativeAnimations?.happy) continue
      expect(species.actions?.happy?.duration, species.id).toBeGreaterThan(0)
    }
  })
})
