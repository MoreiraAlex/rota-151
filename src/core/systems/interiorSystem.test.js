import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { disposePhysics, initPhysics } from '../physics/physicsWorld'
import { hasRigidBody } from '../physics/colliders'
import { givePokemon, makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { listInteriors } from '../data/interiors'
import { listItems } from '../data/items'
import { listSpecies } from '../data/species'
import { BUILDING_KIND } from '../town/townPlan'
import { createEventQueue, EVENT_TYPES } from '../events'
import { abrirPorta, isPassingDoor, pedirSaida } from '../actions/interior'
import { isActiveCombatant } from '../battle/combatTargets'
import { restoreTrainer, serializeTrainer } from '../save/trainerSave'
import { trainerSaveSchema } from '../save/saveFormat'
import { cameraControlSystem } from './cameraControlSystem'
import {
  INTERIOR_FRONT_YAW,
  doorOf,
  interiorExitPoint,
  outsideSpot,
} from '../interior/interiorPlacement'
import {
  ActionState,
  CameraSnap,
  GroundItem,
  Indoors,
  InputState,
  InteractionTarget,
  InteriorTransition,
  OrbitCamera,
  OwnedBy,
  Position,
  SaveRequested,
  StoredVitals,
  SummonedCreature,
  SummonedFrom,
  Vitals,
} from '../traits'
import { interiorSystem } from './interiorSystem'
import { inputSystem } from './inputSystem'
import { interactionSystem } from './interactionSystem'
import { partySummonSystem } from './partySummonSystem'

// Entrar e sair dos prédios (docs/features/068-interior-dos-predios.md),
// sem física (headless): a transição, a troca de lugar e o que muda com o
// treinador lá dentro.
const { FADE_OUT, FADE_IN, ALTITUDE } = GAME_CONFIG.INTERIOR
const [interior] = listInteriors()
// Longe de qualquer chunk carregado.
const FAR = { x: 5000, y: 3, z: 5000 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const made = makeWorld({ playerPosition: FAR })
  worlds.push(made.world)
  const door = doorOf({
    kind: BUILDING_KIND,
    model: interior.building,
    x: FAR.x,
    y: FAR.y,
    z: FAR.z - 4,
    yaw: 0,
    scale: 1.5,
  })
  return { ...made, door }
}

// Passa `seconds` de transição em passos pequenos.
function run(world, seconds, step = 1 / 60) {
  for (let left = seconds; left > -step; left -= step) {
    interiorSystem({ world, delta: step })
  }
}

function enter(world, player, door) {
  expect(abrirPorta(world, player, door)).toBe(true)
  run(world, FADE_OUT)
}

describe('interiorSystem — entrar', () => {
  it('escurece, troca de lugar no escuro e clareia', () => {
    const { world, player, door } = setup()
    expect(abrirPorta(world, player, door)).toBe(true)
    expect(world.get(InteriorTransition).phase).toBe('out')
    expect(player.has(Indoors)).toBe(false)

    run(world, FADE_OUT)
    expect(world.get(InteriorTransition).phase).toBe('in')
    expect(player.get(Indoors)).toMatchObject({ interiorId: interior.id })

    run(world, FADE_IN)
    expect(isPassingDoor(world)).toBe(false)
  })

  it('aparece no tapete da entrada, acima da porta, com a câmera no lugar', () => {
    const { world, player, camera, door } = setup()
    enter(world, player, door)

    const indoors = player.get(Indoors)
    const exit = interiorExitPoint(interior, indoors)
    const pos = player.get(Position)
    expect(pos.x).toBeCloseTo(exit.x, 6)
    expect(pos.z).toBeCloseTo(exit.z, 6)
    expect(pos.y).toBeGreaterThan(exit.y)
    expect(indoors.y - door.y).toBe(ALTITUDE)
    expect(indoors.scale).toBe(door.scale)
    expect(camera.has(CameraSnap)).toBe(true)
    expect(player.has(SaveRequested)).toBe(true)
    expect(camera.get(OrbitCamera).pitch).toBe(
      GAME_CONFIG.INTERIOR.CAMERA.PITCH,
    )
  })

  it('o time em campo volta para a bola na hora, com a vida que tinha', () => {
    const { world, player, door } = setup()
    const [species] = listSpecies().filter((entry) => entry.kind === 'pokemon')
    const pokemon = givePokemon(world, player, species.id, 'slot1')
    const vitals = { hp: 7, maxHp: 20, stamina: 3, maxStamina: 10 }
    world.spawn(
      SummonedCreature({ speciesId: species.id, slot: 'slot1' }),
      SummonedFrom(pokemon),
      OwnedBy(player),
      Position(FAR),
      Vitals(vitals),
    )

    enter(world, player, door)

    expect(world.query(SummonedCreature).length).toBe(0)
    expect(pokemon.get(StoredVitals).vitals).toMatchObject({ hp: vitals.hp })
  })

  it('não começa duas vezes nem entra de novo estando dentro', () => {
    const { world, player, door } = setup()
    abrirPorta(world, player, door)
    expect(abrirPorta(world, player, door)).toBe(false)
    run(world, FADE_OUT + FADE_IN)
    expect(abrirPorta(world, player, door)).toBe(false)
  })
})

describe('interiorSystem — sair', () => {
  it('volta para a frente da porta, sem a sala', () => {
    const { world, player, door } = setup()
    enter(world, player, door)
    run(world, FADE_IN)

    expect(pedirSaida(world, player)).toBe(true)
    run(world, FADE_OUT)

    expect(player.has(Indoors)).toBe(false)
    const spot = outsideSpot(door)
    const pos = player.get(Position)
    expect(pos.x).toBeCloseTo(spot.x, 6)
    expect(pos.z).toBeCloseTo(spot.z, 6)
  })

  it('fora de um prédio não há o que sair', () => {
    const { world, player } = setup()
    expect(pedirSaida(world, player)).toBe(false)
    expect(isPassingDoor(world)).toBe(false)
  })
})

describe('com o treinador dentro', () => {
  it('as selvagens não o alcançam', () => {
    const { world, player, door } = setup()
    expect(isActiveCombatant(player)).toBe(true)
    enter(world, player, door)
    expect(isActiveCombatant(player)).toBe(false)
  })

  it('o save guarda a sala; carregando, volta para dentro dela', () => {
    const { world, player, door } = setup()
    enter(world, player, door)
    const saved = serializeTrainer(player)
    expect(trainerSaveSchema.parse(saved).indoors).toMatchObject({
      interiorId: interior.id,
    })

    const other = setup()
    restoreTrainer(other.player, trainerSaveSchema.parse(saved))
    expect(other.player.get(Indoors)).toMatchObject({
      interiorId: interior.id,
      x: player.get(Indoors).x,
      y: player.get(Indoors).y,
      z: player.get(Indoors).z,
    })
    expect(other.player.get(Position)).toEqual(player.get(Position))

    // Sair pela porta de lá leva para a frente da porta salva.
    pedirSaida(other.world, other.player)
    run(other.world, FADE_OUT)
    const spot = outsideSpot(door)
    expect(other.player.get(Position).x).toBeCloseTo(spot.x, 6)
  })

  it('carregando com a posição fora do piso, aparece no tapete', () => {
    const { world, player, door } = setup()
    enter(world, player, door)
    const saved = serializeTrainer(player)
    const lost = { ...saved, position: { ...saved.position, y: door.y } }

    const other = setup()
    restoreTrainer(other.player, lost)
    const exit = interiorExitPoint(interior, other.player.get(Indoors))
    expect(other.player.get(Position).x).toBeCloseTo(exit.x, 6)
    expect(other.player.get(Position).z).toBeCloseTo(exit.z, 6)
  })

  it('salvo do lado de fora, nada de sala', () => {
    const { player } = setup()
    const saved = serializeTrainer(player)
    expect(saved.indoors).toBeNull()
    const other = setup()
    restoreTrainer(other.player, saved)
    expect(other.player.has(Indoors)).toBe(false)
  })

  it('a câmera fica de frente para a sala, na folga da config', () => {
    const { world, player, camera, door } = setup()
    enter(world, player, door)
    const { YAW_RANGE, PITCH, PITCH_RANGE, MIN_DISTANCE, DISTANCE } =
      GAME_CONFIG.INTERIOR.CAMERA
    cameraControlSystem({
      world,
      input: { cameraYaw: 1e6, cameraPitch: 1e6, zoom: 1e6 },
    })
    const orbit = camera.get(OrbitCamera)
    expect(Math.abs(orbit.yaw - INTERIOR_FRONT_YAW)).toBeLessThanOrEqual(
      YAW_RANGE + 1e-9,
    )
    expect(orbit.pitch).toBeLessThanOrEqual(PITCH + PITCH_RANGE + 1e-9)
    expect(orbit.distance).toBeLessThanOrEqual(DISTANCE)
    cameraControlSystem({ world, input: { zoom: -1e6 } })
    expect(camera.get(OrbitCamera).distance).toBe(MIN_DISTANCE)
  })

  it('no tapete, o F sai — o item no chão lá embaixo não conta', () => {
    const { world, player, door } = setup()
    enter(world, player, door)
    run(world, FADE_IN)
    const pos = player.get(Position)
    const [item] = listItems()
    world.spawn(
      GroundItem({ worldId: 'embaixo', itemId: item.id, chunkKey: 'teste' }),
      Position({ x: pos.x, y: door.y, z: pos.z }),
    )

    const events = createEventQueue()
    interactionSystem({ world, events, input: {}, delta: 1 / 60 })
    expect(world.get(InteractionTarget)).toMatchObject({
      kind: 'exit',
      itemId: interior.id,
    })

    interactionSystem({ world, events, input: { interact: true }, delta: 0 })
    expect(world.get(InteriorTransition)).toMatchObject({
      phase: 'out',
      action: 'exit',
    })
  })

  it('soltar um Pokémon só avisa', () => {
    const { world, player, door } = setup()
    const [species] = listSpecies().filter((entry) => entry.kind === 'pokemon')
    givePokemon(world, player, species.id, 'slot1')
    enter(world, player, door)
    run(world, FADE_IN)

    const events = createEventQueue()
    partySummonSystem({
      world,
      events,
      input: { secondary1: true },
      delta: 1 / 60,
    })
    expect(player.get(ActionState).current).toBeNull()
    expect(events.drain().map(({ type }) => type)).toContain(
      EVENT_TYPES.SUMMON_BLOCKED_INDOORS,
    )
  })
})

describe('inputSystem dentro de um prédio', () => {
  it('só andar, correr e o F; nada de pulo, item, Pokébola, Pokémon ou mira', () => {
    const { world, player, door } = setup()
    enter(world, player, door)
    run(world, FADE_IN)
    const input = {
      forward: true,
      run: true,
      interact: true,
      jump: true,
      dash: true,
      fly: true,
      primary: true,
      secondary1: true,
      secondary2Held: true,
      secondaryHeld: true,
      switchSlot1: true,
      cameraYaw: 0.2,
    }
    inputSystem({ world, input, delta: 1 / 60 })
    expect(input).toMatchObject({
      forward: true,
      run: true,
      interact: true,
      jump: false,
      dash: false,
      fly: false,
      primary: false,
      secondary1: false,
      secondary2Held: false,
      secondaryHeld: false,
      switchSlot1: false,
      cameraYaw: 0.2,
    })
    expect(player.get(InputState)).toMatchObject({ run: true })
  })
})

describe('inputSystem passando pela porta', () => {
  it('o treinador fica parado e nada sai; a câmera continua', () => {
    const { world, player, door } = setup()
    abrirPorta(world, player, door)
    const input = { forward: true, jump: true, interact: true, cameraYaw: 0.2 }
    inputSystem({ world, input, delta: 1 / 60 })
    expect(player.get(InputState)).toMatchObject({ x: 0, z: 0, run: false })
    expect(input).toMatchObject({
      jump: false,
      interact: false,
      cameraYaw: 0.2,
    })
  })
})

describe('carregando dentro de um prédio, com a física', () => {
  beforeEach(async () => {
    await initPhysics()
  })
  afterEach(() => {
    disposePhysics()
  })

  it('a sala ganha colisão no primeiro passo', () => {
    const { world, player, door } = setup()
    enter(world, player, door)
    const saved = serializeTrainer(player)
    const other = setup()
    restoreTrainer(other.player, saved)
    expect(hasRigidBody(other.player.get(Indoors).bodyHandle)).toBe(false)

    interiorSystem({ world: other.world, delta: 1 / 60 })
    expect(hasRigidBody(other.player.get(Indoors).bodyHandle)).toBe(true)
  })
})
