import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '@/core/data/species'
import {
  CharacterController,
  MovementBlocked,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  WanderState,
  WildCreature,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { wildWanderSystem } from './wildWanderSystem'

const { walkSpeed: WALK_SPEED } = getSpecies('fox').movement
const { RADIUS, ARRIVAL_DISTANCE, MAX_CHASE_TIME } = GAME_CONFIG.WILD_WANDER

// Koota limita worlds vivos por processo — mesmo cuidado de
// partySummonSystem.test.js.
const spawnedWorlds = []
function spawnWorld() {
  const world = createWorld()
  spawnedWorlds.push(world)
  return world
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function spawnWild(world, { position, wander }) {
  return world.spawn(
    Position(position),
    Rotation,
    Velocity,
    WildCreature({ speciesId: 'fox' }),
    MovementStats(getSpecies('fox').movement),
    PathState,
    PhysicsBody,
    CharacterController,
    WanderState(wander),
  )
}

function tick(world, delta = 1 / 60) {
  wildWanderSystem({ world, delta })
}

describe('wildWanderSystem', () => {
  it('enquanto pauseTimer > 0, fica parada e só decrementa o timer', () => {
    const world = spawnWorld()
    const creature = spawnWild(world, {
      position: { x: 0, y: 1, z: 0 },
      wander: { homeX: 0, homeZ: 0, targetX: 5, targetZ: 0, pauseTimer: 1 },
    })

    tick(world, 1 / 60)

    expect(creature.get(Velocity).x).toBe(0)
    expect(creature.get(Velocity).z).toBe(0)
    expect(creature.get(WanderState).pauseTimer).toBeCloseTo(1 - 1 / 60)
  })

  it('ao chegar perto do destino, sorteia um novo dentro do RADIUS de home e pausa', () => {
    const world = spawnWorld()
    const creature = spawnWild(world, {
      position: { x: 5, y: 1, z: 0 },
      wander: {
        homeX: 5,
        homeZ: 0,
        targetX: 5 + ARRIVAL_DISTANCE / 2, // dentro de ARRIVAL_DISTANCE
        targetZ: 0,
        pauseTimer: 0,
      },
    })

    tick(world)

    const wander = creature.get(WanderState)
    const distanceFromHome = Math.hypot(
      wander.targetX - wander.homeX,
      wander.targetZ - wander.homeZ,
    )
    expect(distanceFromHome).toBeLessThanOrEqual(RADIUS)
    expect(wander.pauseTimer).toBeGreaterThan(0)
    expect(wander.chaseTimer).toBe(0)
    expect(creature.get(Velocity).x).toBe(0)
    expect(creature.get(Velocity).z).toBe(0)
  })

  it('persegue o destino atual quando não está pausada nem chegou', () => {
    const world = spawnWorld()
    // z=-65 fica longe de todo obstáculo declarado em TEST_LEVEL (trilha,
    // corredor, pedras, muro) — sem nada no meio, a rota é reta de verdade,
    // sem desvio de A* atrapalhando a convergência esperada abaixo. Destino
    // longe o bastante pra nunca ser alcançado nas 120 ticks do teste
    // (WALK_SPEED*2s ainda fica bem aquém) — senão a criatura chega e troca
    // de destino no meio do teste, antes de convergir de vez.
    const creature = spawnWild(world, {
      position: { x: 0, y: 1, z: -65 },
      wander: {
        homeX: 0,
        homeZ: -65,
        targetX: 50,
        targetZ: -65,
        pauseTimer: 0,
      },
    })

    // Velocity segue Rotation suavizada por turnSpeed — roda até convergir,
    // mesmo padrão de creatureFollowSystem.test.js.
    for (let i = 0; i < 120; i++) tick(world)

    // Direção geral (não igualdade exata) — a grade de pathfinding pode
    // quantizar o caminho reto num zigue-zague mínimo entre células mesmo
    // sem obstáculo nenhum no meio, então uma pequena componente em Z é
    // esperada; o que importa é convergir predominantemente pra +X.
    const vel = creature.get(Velocity)
    expect(vel.x).toBeGreaterThan(WALK_SPEED * 0.9)
    expect(Math.abs(vel.z)).toBeLessThan(WALK_SPEED * 0.3)
  })

  it('chaseTimer estourando MAX_CHASE_TIME desiste do destino mesmo sem chegar', () => {
    const world = spawnWorld()
    const creature = spawnWild(world, {
      position: { x: 0, y: 1, z: 0 },
      wander: {
        homeX: 0,
        homeZ: 0,
        targetX: 100, // bem longe, nunca alcançável num tick
        targetZ: 0,
        pauseTimer: 0,
        chaseTimer: MAX_CHASE_TIME,
      },
    })

    tick(world)

    const wander = creature.get(WanderState)
    expect(wander.chaseTimer).toBe(0)
    expect(wander.pauseTimer).toBeGreaterThan(0)
    const distanceFromHome = Math.hypot(
      wander.targetX - wander.homeX,
      wander.targetZ - wander.homeZ,
    )
    expect(distanceFromHome).toBeLessThanOrEqual(RADIUS)
  })

  it('MovementBlocked desvia lateralmente em vez de continuar reto', () => {
    // Mesmo raciocínio de creatureFollowSystem.test.js: sem física real,
    // castRay devolve null pros dois lados, mas o desvio ainda escolhe um
    // lado de forma determinística — o que importa é sair da linha reta.
    const world = spawnWorld()
    const creature = spawnWild(world, {
      position: { x: 0, y: 1, z: 0 },
      wander: { homeX: 0, homeZ: 0, targetX: 10, targetZ: 0, pauseTimer: 0 },
    })
    creature.add(MovementBlocked)

    tick(world)

    expect(creature.get(Velocity).z).not.toBeCloseTo(0)
  })
})
