import { afterEach, describe, expect, it } from 'vitest'
import { givePartyPokemon, makeWorld } from '@/test/makeWorld'
import { createEventQueue, EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { getPlayerSpecies, listSpecies } from '../data/species'
import { listBiomes } from '../data/biomes'
import LGPE_COLLIDERS from '../data/lgpeColliders.json'
import { resolveBodyFront } from '../actions/training'
import {
  ActionState,
  CameraTarget,
  ChunkFrozen,
  InputControlled,
  PartyBehavior,
  PathState,
  Position,
  StrayRecall,
  StrayWarning,
  SummonBall,
  SummonedCreature,
  Training,
} from '../traits'
import { followLimitSystem } from './followLimitSystem'
import { partySummonSystem } from './partySummonSystem'
import { summonBallSystem } from './summonBallSystem'

const DELTA = 1 / 60
const { FOLLOW_LIMIT } = GAME_CONFIG.PARTY_BEHAVIOR
const COUNTDOWN_TICKS = Math.ceil(FOLLOW_LIMIT.WARNING_TIME / DELTA) + 1
// +2: o primeiro tick depois de mover só traz a âncora pra onde ela está.
const STUCK_TICKS = Math.ceil(FOLLOW_LIMIT.STUCK_TIME / DELTA) + 2
const NEAR = FOLLOW_LIMIT.WARN_RESET_DISTANCE / 2
const FAR = FOLLOW_LIMIT.RECALL_DISTANCE + 1
// No meio do caminho até o limite: nem longe, nem perto demais pra andar.
const MID = FOLLOW_LIMIT.RECALL_DISTANCE / 2

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

/**
 * O treinador com uma criatura de verdade em campo (invocada pela esfera) que
 * já chegou perto do grupo uma vez.
 */
function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  const events = createEventQueue()
  givePartyPokemon(world, player, { slot1: 'bulbasaur' })
  partySummonSystem({ world, delta: DELTA, input: { secondary1: true } })
  let guard = 0
  while (
    player.get(ActionState).current !== null ||
    world.query(SummonBall).length > 0
  ) {
    partySummonSystem({ world, delta: DELTA, input: {} })
    summonBallSystem({ world, delta: DELTA })
    if (++guard > 2000) throw new Error('a esfera nunca pousou')
  }
  const creature = world.queryFirst(SummonedCreature)
  // Terminou a apresentação: pronta pra seguir.
  creature.set(ActionState, { current: null, elapsed: 0 })
  const ctx = { world, player, creature, events }
  placeAway(creature, player, NEAR)
  tick(ctx)
  return ctx
}

function tick({ world, events }) {
  events.beginStep()
  followLimitSystem({ world, events, delta: DELTA })
  partySummonSystem({ world, delta: DELTA, input: {} })
}

function tickTimes(ctx, count) {
  for (let i = 0; i < count; i++) tick(ctx)
}

/** Ticka até o treinador terminar o recolher (ou não começar nenhum). */
function tickUntilFree(ctx) {
  tick(ctx)
  let guard = 0
  while (ctx.player.get(ActionState).current !== null) {
    tick(ctx)
    if (++guard > 1000) throw new Error('o recolher nunca terminou')
  }
}

function placeAway(entity, from, distance) {
  const pos = from.get(Position)
  entity.set(Position, { x: pos.x + distance, y: pos.y, z: pos.z })
}

function setGait(entity, gait) {
  entity.set(PathState, { ...entity.get(PathState), gait })
}

function strayedReasons(events) {
  return events
    .drain()
    .filter((event) => event.type === EVENT_TYPES.PARTY_STRAYED)
    .map((event) => event.reason)
}

function giveControlTo(player, creature) {
  player.remove(InputControlled, CameraTarget)
  creature.add(InputControlled, CameraTarget)
}

describe('followLimitSystem — criatura que ficou pra trás', () => {
  it('longe demais: avisa com a contagem e, no fim, volta pra bola', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, FAR)

    tick(ctx)
    const warning = ctx.creature.get(StrayWarning)
    expect(warning.stage).toBe('recall')
    expect(warning.reason).toBe('far')
    expect(ctx.creature.has(StrayRecall)).toBe(false)

    tickTimes(ctx, COUNTDOWN_TICKS)
    tickUntilFree(ctx)

    expect(ctx.world.query(SummonedCreature).length).toBe(0)
    expect(strayedReasons(ctx.events)).toEqual(['far'])
  })

  it('a contagem desce enquanto continua longe', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, FAR)
    tick(ctx)
    const first = ctx.creature.get(StrayWarning).timeLeft
    tickTimes(ctx, Math.floor(COUNTDOWN_TICKS / 2))
    expect(ctx.creature.get(StrayWarning).timeLeft).toBeLessThan(first)
  })

  it('voltou pra perto no meio da contagem: cancela e fica', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, FAR)
    tickTimes(ctx, Math.floor(COUNTDOWN_TICKS / 2))

    placeAway(ctx.creature, ctx.player, MID)
    tick(ctx)
    expect(ctx.creature.has(StrayWarning)).toBe(false)

    tickTimes(ctx, COUNTDOWN_TICKS)
    expect(ctx.creature.isAlive()).toBe(true)
    expect(strayedReasons(ctx.events)).toEqual([])
  })

  it('logo abaixo do limite (dentro da folga), a contagem continua', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, FAR)
    tick(ctx)
    placeAway(
      ctx.creature,
      ctx.player,
      FOLLOW_LIMIT.RECALL_DISTANCE - FOLLOW_LIMIT.CANCEL_MARGIN / 2,
    )
    tick(ctx)
    expect(ctx.creature.get(StrayWarning)?.stage).toBe('recall')
  })

  it('recém-invocada longe (sem ter chegado perto) não conta como longe', () => {
    const { world, player } = makeWorld()
    worlds.push(world)
    const events = createEventQueue()
    givePartyPokemon(world, player, { slot1: 'bulbasaur' })
    partySummonSystem({ world, delta: DELTA, input: { secondary1: true } })
    let guard = 0
    while (world.query(SummonedCreature).length === 0) {
      partySummonSystem({ world, delta: DELTA, input: {} })
      summonBallSystem({ world, delta: DELTA })
      if (++guard > 2000) throw new Error('a esfera nunca pousou')
    }
    const creature = world.queryFirst(SummonedCreature)
    creature.set(ActionState, { current: null, elapsed: 0 })
    placeAway(creature, player, FAR)
    setGait(creature, 'stop')

    tickTimes({ world, events }, COUNTDOWN_TICKS)
    expect(creature.has(StrayWarning)).toBe(false)
  })

  it('longe num chunk congelado também volta', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, FAR)
    ctx.creature.add(ChunkFrozen)

    tickTimes(ctx, COUNTDOWN_TICKS)
    tickUntilFree(ctx)

    expect(ctx.world.query(SummonedCreature).length).toBe(0)
  })

  it('tentando seguir sem sair do lugar: conta como presa e volta', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, MID)
    setGait(ctx.creature, 'run')

    tickTimes(ctx, STUCK_TICKS)
    expect(ctx.creature.get(StrayWarning)?.reason).toBe('stuck')
    tickTimes(ctx, COUNTDOWN_TICKS)
    tickUntilFree(ctx)

    expect(ctx.world.query(SummonedCreature).length).toBe(0)
    expect(strayedReasons(ctx.events)).toEqual(['stuck'])
  })

  it('desprendeu no meio da contagem de presa: cancela', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, MID)
    setGait(ctx.creature, 'run')
    tickTimes(ctx, STUCK_TICKS)

    placeAway(ctx.creature, ctx.player, MID + FOLLOW_LIMIT.STUCK_RADIUS * 2)
    tick(ctx)
    expect(ctx.creature.has(StrayWarning)).toBe(false)
  })

  it('andando de verdade não conta como presa', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, MID)
    setGait(ctx.creature, 'run')

    const step =
      (FOLLOW_LIMIT.STUCK_RADIUS * 2) / (FOLLOW_LIMIT.STUCK_TIME / DELTA)
    for (let i = 0; i < STUCK_TICKS * 2; i++) {
      const pos = ctx.creature.get(Position)
      ctx.creature.set(Position, { ...pos, z: pos.z + step })
      tick(ctx)
    }

    expect(ctx.creature.has(StrayWarning)).toBe(false)
  })

  it('lutando parada não conta como presa', () => {
    const ctx = setup()
    placeAway(ctx.creature, ctx.player, MID)
    setGait(ctx.creature, 'run')
    ctx.creature.set(PartyBehavior, { state: 'fight' })

    tickTimes(ctx, STUCK_TICKS * 2)

    expect(ctx.creature.has(StrayWarning)).toBe(false)
  })

  it('parada perto de quem segue não conta como presa', () => {
    const ctx = setup()
    setGait(ctx.creature, 'stop')

    tickTimes(ctx, STUCK_TICKS * 2)

    expect(ctx.creature.has(StrayWarning)).toBe(false)
  })
})

describe('followLimitSystem — o treinador ficou pra trás', () => {
  it('a controlada longe demais: aviso nela, contagem e volta pra bola com o controle indo pro treinador', () => {
    const ctx = setup()
    giveControlTo(ctx.player, ctx.creature)
    tick(ctx)
    placeAway(ctx.creature, ctx.player, FAR)

    tick(ctx)
    expect(ctx.creature.get(StrayWarning)).toMatchObject({
      stage: 'recall',
      reason: 'trainerFar',
    })
    tickTimes(ctx, COUNTDOWN_TICKS)
    tickUntilFree(ctx)

    expect(ctx.world.query(SummonedCreature).length).toBe(0)
    expect(ctx.player.has(InputControlled)).toBe(true)
    expect(ctx.player.has(CameraTarget)).toBe(true)
    expect(strayedReasons(ctx.events)).toEqual(['trainerFar'])
  })

  it('treinador preso seguindo: a controlada conta e volta', () => {
    const ctx = setup()
    giveControlTo(ctx.player, ctx.creature)
    placeAway(ctx.creature, ctx.player, MID)
    setGait(ctx.player, 'run')

    tickTimes(ctx, STUCK_TICKS)
    expect(ctx.creature.get(StrayWarning)?.reason).toBe('trainerStuck')
    tickTimes(ctx, COUNTDOWN_TICKS)
    tickUntilFree(ctx)

    expect(ctx.world.query(SummonedCreature).length).toBe(0)
    expect(ctx.player.has(InputControlled)).toBe(true)
    expect(strayedReasons(ctx.events)).toEqual(['trainerStuck'])
  })

  it('passou do aviso: aviso sem contagem, que apaga só ao voltar abaixo da folga', () => {
    const ctx = setup()
    giveControlTo(ctx.player, ctx.creature)
    tick(ctx)
    setGait(ctx.player, 'stop')
    const between =
      (FOLLOW_LIMIT.WARN_DISTANCE + FOLLOW_LIMIT.RECALL_DISTANCE) / 2

    placeAway(ctx.creature, ctx.player, between)
    tick(ctx)
    expect(ctx.creature.get(StrayWarning)?.stage).toBe('warn')

    placeAway(
      ctx.creature,
      ctx.player,
      (FOLLOW_LIMIT.WARN_DISTANCE + FOLLOW_LIMIT.WARN_RESET_DISTANCE) / 2,
    )
    tick(ctx)
    expect(ctx.creature.get(StrayWarning)?.stage).toBe('warn')

    placeAway(ctx.creature, ctx.player, NEAR)
    tick(ctx)
    expect(ctx.creature.has(StrayWarning)).toBe(false)
    expect(ctx.creature.isAlive()).toBe(true)
  })

  it('voltou pro treinador: o controle de volta nele apaga o aviso da criatura', () => {
    const ctx = setup()
    giveControlTo(ctx.player, ctx.creature)
    tick(ctx)
    placeAway(ctx.creature, ctx.player, FAR)
    tick(ctx)
    expect(ctx.creature.has(StrayWarning)).toBe(true)

    giveControlTo(ctx.creature, ctx.player)
    tick(ctx)
    // Agora quem segue é ela, e ela ainda não chegou perto deste líder.
    expect(ctx.creature.get(StrayWarning)?.reason).not.toBe('trainerFar')
  })
})

// Quem treina num boneco (docs/features/067-campo-de-treino-e-avisos-de-
// nivel.md): limite maior, com aviso antes da contagem.
describe('followLimitSystem — criatura treinando', () => {
  function setupTraining() {
    const ctx = setup()
    ctx.creature.add(Training({ moveId: 'tackle' }))
    return ctx
  }

  it('além do limite normal, mas aquém do de treino: nada', () => {
    const ctx = setupTraining()
    placeAway(
      ctx.creature,
      ctx.player,
      Math.min(FAR, FOLLOW_LIMIT.TRAINING_WARN_DISTANCE - 1),
    )
    tickTimes(ctx, COUNTDOWN_TICKS)
    expect(ctx.creature.has(StrayWarning)).toBe(false)
    expect(ctx.creature.has(StrayRecall)).toBe(false)
  })

  it('passou do aviso: aviso sem contagem', () => {
    const ctx = setupTraining()
    placeAway(ctx.creature, ctx.player, FOLLOW_LIMIT.TRAINING_WARN_DISTANCE + 1)
    tick(ctx)
    const warning = ctx.creature.get(StrayWarning)
    expect(warning.stage).toBe('warn')
    expect(warning.reason).toBe('trainingFar')
  })

  it('passou do limite de treino: contagem e volta pra bola', () => {
    const ctx = setupTraining()
    placeAway(
      ctx.creature,
      ctx.player,
      FOLLOW_LIMIT.TRAINING_RECALL_DISTANCE + 1,
    )
    tick(ctx)
    expect(ctx.creature.get(StrayWarning).stage).toBe('recall')

    tickTimes(ctx, COUNTDOWN_TICKS)
    tickUntilFree(ctx)

    expect(ctx.world.query(SummonedCreature).length).toBe(0)
    expect(strayedReasons(ctx.events)).toEqual(['trainingFar'])
  })
})

describe('followLimitSystem — o campo não some antes do recolher', () => {
  it('na menor distância de visão, quem treina volta pra bola antes de o chunk do boneco descarregar', () => {
    const { CHUNK_SIZE, UNLOAD_MARGIN } = GAME_CONFIG.TERRAIN
    const { MIN } = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE
    // Descarrega a mais de MIN + UNLOAD_MARGIN chunks (em cada eixo) de
    // todo centro: a menor separação em que isso acontece.
    const unloadDistance = (MIN + UNLOAD_MARGIN) * CHUNK_SIZE
    // O mais rápido que alguém do jogo anda (correndo ou voando).
    const fastest = Math.max(
      ...listSpecies().flatMap((species) => [
        species.movement?.runSpeed ?? 0,
        species.flight?.fastSpeed ?? 0,
      ]),
    )
    // Do começo da contagem até o recolher acontecer.
    const recallTime =
      FOLLOW_LIMIT.WARNING_TIME + getPlayerSpecies().actions.recall.effectAt
    // Do lugar do treino até o centro do boneco (o maior possível).
    const field = listBiomes().find(({ town }) => town).town.trainingField
    const spotDistance =
      LGPE_COLLIDERS[field.dummy].reach * field.scale +
      GAME_CONFIG.MOVES.TRAINING.SPOT_GAP +
      Math.max(...listSpecies().map(resolveBodyFront))
    expect(
      FOLLOW_LIMIT.TRAINING_RECALL_DISTANCE +
        recallTime * fastest +
        spotDistance,
    ).toBeLessThan(unloadDistance)
  })
})
