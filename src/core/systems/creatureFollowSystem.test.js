import { describe, it, expect } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { getSpecies } from '@/core/data/species'
import {
  MovementBlocked,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { creatureFollowSystem } from './creatureFollowSystem'

const { FOLLOW_MIN_DISTANCE, RUN_DISTANCE } = GAME_CONFIG.PARTY
const { walkSpeed: WALK_SPEED, runSpeed: RUN_SPEED } =
  getSpecies('fox').movement

function spawnCreature(world, position) {
  return world.spawn(
    Position(position),
    Rotation,
    Velocity,
    SummonedCreature({ slot: 'slot1' }),
    MovementStats(getSpecies('fox').movement),
    PathState,
    PhysicsBody, // toda SummonedCreature real também tem (ver partySummonSystem.js)
  )
}

function tick(world, delta = 1 / 60) {
  creatureFollowSystem({ world, delta })
}

describe('creatureFollowSystem', () => {
  it('dentro de FOLLOW_MIN_DISTANCE, fica parada', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: FOLLOW_MIN_DISTANCE - 0.5,
      y: 1,
      z: 0,
    })

    tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
  })

  it('entre FOLLOW_MIN_DISTANCE e RUN_DISTANCE, anda (walkSpeed) em direção ao treinador', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const midDistance = (FOLLOW_MIN_DISTANCE + RUN_DISTANCE) / 2
    const creature = spawnCreature(world, { x: midDistance, y: 1, z: 0 })

    tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBeCloseTo(-WALK_SPEED) // treinador está em -X daqui
    expect(vel.z).toBeCloseTo(0)
  })

  it('além de RUN_DISTANCE, corre (runSpeed) em direção ao treinador', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: RUN_DISTANCE + 1,
      y: 1,
      z: 0,
    })

    tick(world)

    const vel = creature.get(Velocity)
    expect(vel.x).toBeCloseTo(-RUN_SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('gira em direção ao próprio movimento (suavizado por turnSpeed)', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })

    for (let i = 0; i < 120; i++) tick(world)

    // movendo em -X, facing = atan2(-1, 0) = -π/2
    expect(creature.get(Rotation).y).toBeCloseTo(-Math.PI / 2, 1)
  })

  it('parada (dentro de FOLLOW_MIN_DISTANCE) não gira', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, {
      x: FOLLOW_MIN_DISTANCE - 0.5,
      y: 1,
      z: 0,
    })
    creature.set(Rotation, { y: 1.7 })

    for (let i = 0; i < 60; i++) tick(world)

    expect(creature.get(Rotation).y).toBeCloseTo(1.7)
  })

  it('lê GAME_CONFIG.PARTY a cada tick — mudar RUN_DISTANCE em tempo real já vale no próximo tick', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })
    const original = GAME_CONFIG.PARTY.RUN_DISTANCE
    GAME_CONFIG.PARTY.RUN_DISTANCE = 0 // qualquer distância > 0 já corre

    try {
      tick(world)
      expect(creature.get(Velocity).x).toBeCloseTo(-RUN_SPEED)
    } finally {
      GAME_CONFIG.PARTY.RUN_DISTANCE = original
    }
  })

  it('contorna a "wall" do TEST_LEVEL em vez de ir em linha reta', () => {
    // wall: position [0, 1, -7], size [10, 2, 0.5] — bloqueia ir direto de
    // z=-15 até o treinador em z=5, ambos em x=0.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 5 } })
    const creature = spawnCreature(world, { x: 0, y: 1, z: -15 })

    tick(world)

    // linha reta seria vel.x = 0 — o desvio exige um componente em x.
    expect(creature.get(Velocity).x).not.toBeCloseTo(0)
  })

  it('repathTimer conta regressivo e só reseta quando recalcula (throttle)', () => {
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    const creature = spawnCreature(world, { x: RUN_DISTANCE + 1, y: 1, z: 0 })
    const { REPATH_INTERVAL } = GAME_CONFIG.PATHFINDING

    tick(world) // 1º tick sempre recalcula — repathTimer começa em 0
    expect(creature.get(PathState).repathTimer).toBeCloseTo(REPATH_INTERVAL)

    tick(world) // ainda dentro do intervalo — só decrementa, não recalcula
    expect(creature.get(PathState).repathTimer).toBeLessThan(REPATH_INTERVAL)
    expect(creature.get(PathState).repathTimer).toBeGreaterThan(0)
  })

  it('MovementBlocked desvia lateralmente em vez de continuar reto — e força recálculo imediato', () => {
    // Sem física real inicializada, castRay (core/physics/raycast.js)
    // devolve null pros dois lados (nada no caminho pra "acertar") — o
    // desvio ainda assim escolhe um lado de forma determinística (empate
    // vira esquerda), então dá pra testar sem subir o Rapier: o que importa
    // aqui é que a direção deixa de apontar reto pro treinador.
    const { world } = makeWorld({ playerPosition: { x: 0, y: 1, z: 0 } })
    // Treinador em +X daqui — sem MovementBlocked, a criatura iria reto em
    // +X (vel.z ficaria em 0).
    const creature = spawnCreature(world, {
      x: -(RUN_DISTANCE + 1),
      y: 1,
      z: 0,
    })
    creature.add(MovementBlocked)

    tick(world)

    const vel = creature.get(Velocity)
    expect(vel.z).not.toBeCloseTo(0) // desviou lateralmente, não foi reto
    expect(creature.get(PathState).repathTimer).toBe(0) // recalcula já no próximo tick
  })

  it('sem jogador no world (nenhum InputControlled), não quebra', () => {
    const world = createWorld()
    spawnCreature(world, { x: 10, y: 1, z: 0 })

    expect(() => tick(world)).not.toThrow()

    world.destroy()
  })
})
