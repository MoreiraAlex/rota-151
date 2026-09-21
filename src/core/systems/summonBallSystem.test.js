import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  ActionState,
  AttackCooldowns,
  SummonBall,
  SummonedCreature,
  SummonFlash,
  SummonPulse,
  Party,
  Position,
  Velocity,
  PhysicsBody,
} from '@/core/traits'
import {
  initPhysics,
  disposePhysics,
  stepPhysics,
} from '@/core/physics/physicsWorld'
import {
  createStaticLevel,
  createCharacterBody,
} from '@/core/physics/colliders'
import { summonBallSystem } from './summonBallSystem'

const spawnedWorlds = []
function spawnWorld() {
  const world = createWorld()
  spawnedWorlds.push(world)
  return world
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function tick(world, delta = 1 / 60) {
  summonBallSystem({ world, delta })
}

/**
 * Reproduz o laço de `summonBallSystem.js` (posição + gravidade, sem
 * raycast — só usado em cenários sem física carregada) pra validar a
 * fiação de forma independente, mesmo padrão já usado em
 * `playerActionSystem.test.js` pra `resolveHandOrigin`/`resolveAimPoint`.
 * Com gravidade, o pouso "sem tocar em nada" não é mais um ponto fixo em
 * linha reta — precisa da mesma integração tick a tick pra saber onde a
 * esfera de fato para.
 */
function simulateBallLanding(start, vel, maxDistance, delta = 1 / 60) {
  const pos = { ...start }
  const v = { ...vel }
  let traveled = 0
  let guard = 0
  while (traveled < maxDistance) {
    v.y += GAME_CONFIG.PHYSICS.GRAVITY * delta
    const remaining = maxDistance - traveled
    const segX = v.x * delta
    const segY = v.y * delta
    const segZ = v.z * delta
    const fullSegLength = Math.hypot(segX, segY, segZ)
    if (fullSegLength === 0) break
    const segLength = Math.min(fullSegLength, remaining)
    pos.x += (segX / fullSegLength) * segLength
    pos.y += (segY / fullSegLength) * segLength
    pos.z += (segZ / fullSegLength) * segLength
    traveled += segLength
    guard++
    if (guard > 5000)
      throw new Error('simulação nunca convergiu (guard estourado)')
  }
  return pos
}

describe('summonBallSystem', () => {
  it('integra a posição pela velocidade, com gravidade puxando vel.y a cada tick', () => {
    const world = spawnWorld()
    const ball = world.spawn(
      Position({ x: 0, y: 0, z: 0 }),
      Velocity({ x: 10, y: 0, z: 0 }),
      SummonBall({ slot: 'slot1', speciesId: 'fox', maxDistance: 1000 }),
    )

    tick(world, 1 / 60)

    // Horizontal segue reto — gravidade só afeta vel.y.
    expect(ball.get(Position).x).toBeCloseTo(10 / 60)
    // Vertical já caiu — gravidade aplicada ANTES da integração deste tick
    // (mesma ordem de characterPhysicsSystem.js).
    expect(ball.get(Position).y).toBeCloseTo(
      GAME_CONFIG.PHYSICS.GRAVITY * (1 / 60) ** 2,
    )
  })

  it('sem física carregada (castRay sempre null), pousa exatamente ao esgotar maxDistance (percorrido ao longo do caminho, já curvo pela gravidade) e spawna a criatura ali', () => {
    const { world, player } = makeWorld()
    spawnedWorlds.push(world)
    player.set(Party, { slot1: 'fox-red' })

    const start = { x: 0, y: 1, z: 0 }
    const vel = { x: 10, y: 0, z: 0 } // 10 m/s, horizontal no lançamento
    const maxDistance = 5

    world.spawn(
      Position(start),
      Velocity(vel),
      SummonBall({
        slot: 'slot1',
        speciesId: 'fox-red',
        maxDistance,
        traveled: 0,
      }),
    )

    for (let i = 0; i < 60; i++) tick(world, 1 / 60)

    expect(world.query(SummonBall).length).toBe(0) // esfera resolvida, destruída
    const [creature] = world.query(SummonedCreature, Position)
    expect(creature).toBeDefined()

    const expected = simulateBallLanding(start, vel, maxDistance)
    expect(creature.get(Position).x).toBeCloseTo(expected.x)
    expect(creature.get(Position).y).toBeCloseTo(expected.y)
    expect(creature.get(Position).z).toBeCloseTo(expected.z)

    // Regressão real, relatada jogando (docs/features/025-ataque-comum-
    // de-criatura.md, "9ª rodada"): `creatureAttackSystem.js` passou a
    // exigir `AttackCooldowns` na query, mas `spawnCreature` (aqui em
    // `summonBallSystem.js`) não tinha sido atualizado — a criatura de
    // VERDADE nunca tinha o trait, então nem o ataque comum (mouse) nem
    // as skills (Q/E/R) disparavam pra ninguém, mesmo com tudo
    // configurado certo em `species.attacks`. `creatureAttackSystem.
    // test.js` não pegava isso porque usa um helper de spawn PRÓPRIO,
    // desacoplado deste system de verdade.
    expect(creature.has(ActionState)).toBe(true)
    expect(creature.has(AttackCooldowns)).toBe(true)
    expect(player.has(SummonPulse)).toBe(true)

    // Clarão de abertura (SummonFlash) nasce exatamente onde a criatura pousou.
    const [flash] = world.query(SummonFlash, Position)
    expect(flash).toBeDefined()
    expect(flash.get(Position).x).toBeCloseTo(expected.x)
  })

  it('sem hasSpecies válido (removido/trocado enquanto a esfera voava), pousa sem spawnar nada — some silenciosamente', () => {
    const { world, player } = makeWorld()
    spawnedWorlds.push(world)
    player.set(Party, { slot1: 'fox-red' })

    world.spawn(
      Position({ x: 0, y: 1, z: 0 }),
      Velocity({ x: 10, y: 0, z: 0 }),
      SummonBall({
        slot: 'slot1',
        speciesId: 'fox-red',
        maxDistance: 5,
        traveled: 0,
      }),
    )

    // Time do treinador muda de espécie no slot1 ENQUANTO a esfera está
    // voando (ex.: InventoryPanel) — a esfera não deve mais spawnar a
    // espécie antiga.
    player.set(Party, { slot1: 'fox-green' })

    for (let i = 0; i < 60; i++) tick(world, 1 / 60)

    expect(world.query(SummonBall).length).toBe(0)
    expect(world.query(SummonedCreature).length).toBe(0)
    expect(player.has(SummonPulse)).toBe(false)
    expect(world.query(SummonFlash).length).toBe(0) // sem criatura, sem clarão
  })
})

describe('summonBallSystem — colisão com o mundo', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('para no ponto de impacto ao atingir o chão, mais perto que maxDistance, e spawna a criatura ali', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics() // broad-phase só existe depois de um step (ver raycast.js)

    const { world, player } = makeWorld()
    spawnedWorlds.push(world)
    player.set(Party, { slot1: 'fox-red' })

    // Velocidade já aponta pro chão (a gravidade também ajudaria a
    // descer sozinha, mas -20 garante que bate rápido, sem depender de
    // quantos ticks a gravidade levaria).
    world.spawn(
      Position({ x: 20, y: 3, z: 20 }), // longe de qualquer obstáculo do nível de teste
      Velocity({ x: 0, y: -20, z: 0 }),
      SummonBall({
        slot: 'slot1',
        speciesId: 'fox-red',
        maxDistance: 100, // bem maior que a distância real até o chão
        traveled: 0,
      }),
    )

    for (let i = 0; i < 30; i++) tick(world, 1 / 30)

    expect(world.query(SummonBall).length).toBe(0)
    const [creature] = world.query(SummonedCreature, Position)
    expect(creature).toBeDefined()
    // Não em y=0 (a superfície tocada) — a cápsula de 'fox-red' é deitada
    // (`capsuleAxis: 'z'`), então a base fica `capsuleRadius` (0.4) abaixo
    // do centro; nasce deslocada pra cima disso, senão ficaria metade
    // afundada no chão (bug real, relatado jogando — ver
    // `verticalClearance`/docstring de `resolveBall`).
    expect(creature.get(Position).y).toBeCloseTo(0.4, 1)
  })

  it('pousando por toque (chão/obstáculo), desloca a criatura pra cima em verticalClearance — não nasce com a cápsula afundada na superfície', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics()

    const { world, player } = makeWorld()
    spawnedWorlds.push(world)
    // Bulbasaur: capsuleAxis 'z' (deitada), capsuleRadius 0.4 — mesmo
    // raciocínio do teste acima, com uma espécie diferente pra não
    // depender só de 'fox-red'.
    player.set(Party, { slot1: 'bulbasaur' })

    world.spawn(
      Position({ x: -20, y: 3, z: -20 }), // longe de qualquer obstáculo do nível de teste
      Velocity({ x: 0, y: -20, z: 0 }),
      SummonBall({
        slot: 'slot1',
        speciesId: 'bulbasaur',
        maxDistance: 100,
        traveled: 0,
      }),
    )

    for (let i = 0; i < 30; i++) tick(world, 1 / 30)

    const [creature] = world.query(SummonedCreature, Position)
    expect(creature).toBeDefined()
    // capsuleRadius do bulbasaur (0.4) acima do chão (y=0), não em y≈0.
    expect(creature.get(Position).y).toBeCloseTo(0.4, 1)
  })

  it('exclui a cápsula do treinador — não se autoacerta logo ao nascer perto do próprio corpo', async () => {
    await initPhysics()
    createStaticLevel()

    const { world, player } = makeWorld({
      playerPosition: { x: 0, y: 2, z: 0 },
    })
    spawnedWorlds.push(world)
    player.set(Party, { slot1: 'fox-red' })
    const { bodyHandle, colliderHandle } = createCharacterBody(
      player.get(Position),
      { radius: 0.5, halfHeight: 0.5, axis: 'y' },
    )
    player.set(PhysicsBody, { bodyHandle, colliderHandle })
    stepPhysics()

    // Nasce a 1 unidade acima do centro do treinador — dentro/bem perto da
    // própria cápsula (raio 0.5 + meia-altura 0.5 = topo em y=3).
    const ball = world.spawn(
      Position({ x: 0, y: 3, z: 0 }),
      Velocity({ x: 5, y: 0, z: 0 }),
      SummonBall({
        slot: 'slot1',
        speciesId: 'fox-red',
        maxDistance: 100,
        traveled: 0,
      }),
    )

    tick(world, 1 / 60)

    // Ainda voando — não resolveu no primeiro tick contra o próprio corpo.
    expect(world.query(SummonBall).length).toBe(1)
    expect(ball.get(Position).x).toBeGreaterThan(0)
  })
})
