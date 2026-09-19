import { describe, it, expect, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { getPlayerSpecies } from '@/core/data/species'
import { computeAimRay } from '@/core/camera/orbitCamera'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  ActionState,
  AnimationState,
  CharacterController,
  InputControlled,
  MovementStats,
  OrbitCamera,
  Party,
  PathState,
  PhysicsBody,
  Position,
  RecallBeam,
  Rotation,
  SummonBall,
  SummonedCreature,
  Velocity,
  Vitals,
} from '@/core/traits'
import { partySummonSystem } from './partySummonSystem'
import { summonBallSystem } from './summonBallSystem'
import { playerActionSystem } from './playerActionSystem'

const DELTA = 1 / 60
// summon/recall e o offset/velocidade de invocação são exclusivos do
// treinador (`getPlayerSpecies().actions`/`.party`, ver docs/features/018-
// troca-de-controle-treinador-criatura.md) — sempre a espécie `bot` de
// verdade, não a `fox` que este arquivo usa pro player de teste.
const SUMMON = getPlayerSpecies().actions.summon
const RECALL = getPlayerSpecies().actions.recall

// Reproduz `resolveHandOrigin` (core/aim.js) pra validar a fiação de
// forma independente — mesmo padrão já usado em
// playerActionSystem.test.js pro arremesso. `rotY` é a rotação no
// instante da chamada — pra summon (disparo), é a de ANTES do disparo (a
// origem da mão usa a rotação de quando a ação começa, não a nova, só
// conhecida depois de resolver a direção); pra recall (effectAt), já é a
// NOVA (`beginRecall` já girou o treinador pra encarar a criatura antes
// da mão ser calculada).
function resolveHandOrigin(pos, rotY, config) {
  const { handForwardOffset, handSideOffset, handHeightOffset } = config
  const forwardX = Math.sin(rotY)
  const forwardZ = Math.cos(rotY)
  const rightX = Math.cos(rotY)
  const rightZ = -Math.sin(rotY)
  return {
    x: pos.x + forwardX * handForwardOffset + rightX * handSideOffset,
    y: pos.y + handHeightOffset,
    z: pos.z + forwardZ * handForwardOffset + rightZ * handSideOffset,
  }
}

// Sem física carregada no teste, o raycast de mira nunca acerta nada — o
// ponto de mira esperado é sempre o limite de `aimRange` (`actions.throw`,
// reaproveitado por qualquer ação de mira — ver `resolveAimPoint`,
// core/aim.js), mesma fórmula de lá.
function resolveExpectedAimPoint(pos, orbit) {
  const { aimRange } = getPlayerSpecies().actions.throw
  const { origin, direction } = computeAimRay(pos, orbit)
  return {
    x: origin.x + direction.x * aimRange,
    y: origin.y + direction.y * aimRange,
    z: origin.z + direction.z * aimRange,
  }
}

// Direção (vetor unitário 3D) que `beginSummon` resolve no disparo —
// `resolveExpectedAimPoint` menos `resolveHandOrigin`, normalizado.
function resolveExpectedSummonDirection(pos, rotYBeforeDispatch, orbit) {
  const handOrigin = resolveHandOrigin(pos, rotYBeforeDispatch, SUMMON)
  const aimPoint = resolveExpectedAimPoint(pos, orbit)
  const dx = aimPoint.x - handOrigin.x
  const dy = aimPoint.y - handOrigin.y
  const dz = aimPoint.z - handOrigin.z
  const distance = Math.hypot(dx, dy, dz)
  return { x: dx / distance, y: dy / distance, z: dz / distance }
}

/**
 * Reproduz o laço de `summonBallSystem.js` (posição + gravidade, sem
 * raycast) pra prever onde a esfera pousa quando nada está no caminho —
 * com gravidade, isso não é mais um ponto fixo em linha reta na direção
 * do disparo, precisa da mesma integração tick a tick.
 */
function simulateBallLanding(start, dir, speed, maxDistance, delta = DELTA) {
  const pos = { ...start }
  const vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }
  let traveled = 0
  let guard = 0
  while (traveled < maxDistance) {
    vel.y += GAME_CONFIG.PHYSICS.GRAVITY * delta
    const remaining = maxDistance - traveled
    const segX = vel.x * delta
    const segY = vel.y * delta
    const segZ = vel.z * delta
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

// Koota limita a 16 worlds vivos por processo — este arquivo cria um por
// teste e nunca os destruía, o que batia exatamente nesse teto (achado ao
// adicionar mais testes, ver docs/features/018-troca-de-controle-
// treinador-criatura.md). Mesmo padrão já usado em aimAnchorSystem.test.js/
// movementSystem.test.js/playerActionSystem.test.js: acumula os worlds
// criados e destrói todos depois de cada teste.
const spawnedWorlds = []
function spawnWorld(...args) {
  const created = makeWorld(...args)
  spawnedWorlds.push(created.world)
  return created
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

// Roda os dois systems na mesma ordem do loop real (registerSystems.js) —
// summonBallSystem precisa rodar todo tick pra `SummonBall` avançar/pousar
// (sem física carregada no teste, `castRay` sempre volta `null`, então toda
// esfera viaja a distância máxima antes de resolver — mesmo resultado de
// `summonOffset` fixo de antes da esfera existir, só que levando vários
// ticks pra chegar lá).
function tick(world, input = {}) {
  partySummonSystem({ world, delta: DELTA, input })
  summonBallSystem({ world, delta: DELTA })
}

/** Ticka (sem novo input) até a ação do treinador terminar (current volta a null). */
function advanceUntilFree(world, player) {
  let guard = 0
  while (player.get(ActionState).current !== null) {
    tick(world, {})
    guard++
    if (guard > 1000) throw new Error('ação nunca terminou (guard estourado)')
  }
}

/**
 * Ticka até o GESTO terminar E qualquer `SummonBall` em voo já ter
 * pousado — ao contrário de `advanceUntilFree` (só espera `duration`, o
 * gesto), a criatura só nasce de verdade quando a esfera resolve, o que
 * normalmente leva bem mais tempo que o gesto (ver docs/features/024-
 * esfera-de-invocar.md). Usar este helper (não `advanceUntilFree`) sempre
 * que o teste for verificar se uma `SummonedCreature` já nasceu de fato.
 */
function advanceUntilResolved(world, player) {
  let guard = 0
  while (
    player.get(ActionState).current !== null ||
    world.query(SummonBall).length > 0
  ) {
    tick(world, {})
    guard++
    if (guard > 2000) {
      throw new Error('ação/esfera nunca resolveu (guard estourado)')
    }
  }
}

describe('partySummonSystem', () => {
  it('slot vazio: apertar o botão não faz nada — nem invoca, nem inicia ação', () => {
    const { world, player } = spawnWorld()

    tick(world, { secondary1: true })

    expect(world.query(SummonedCreature).length).toBe(0)
    expect(player.get(ActionState).current).toBe(null)
  })

  it('espécie desconhecida no slot não invoca nada, nem inicia ação', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'nao-existe' })

    tick(world, { secondary1: true })

    expect(world.query(SummonedCreature).length).toBe(0)
    expect(player.get(ActionState).current).toBe(null)
  })

  it('apertar com uma espécie equipada dispara a ação "summon" e gira o treinador pra direção da mira (câmera, já com a inclinação) — sem invocar ainda', () => {
    const { world, player, camera } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    camera.set(OrbitCamera, { yaw: 1.1, pitch: 0.3 })
    player.set(Rotation, { y: -2 }) // deve ser sobrescrito

    tick(world, { secondary1: true })

    expect(player.get(ActionState).current).toBe('summon')
    // Encara o componente horizontal de pra onde a MIRA aponta de
    // verdade (câmera, com pitch) — não só o yaw cru.
    const orbit = camera.get(OrbitCamera)
    const dir = resolveExpectedSummonDirection({ x: 0, y: 1, z: 0 }, -2, orbit)
    expect(player.get(Rotation).y).toBeCloseTo(Math.atan2(dir.x, dir.z))
    expect(world.query(SummonBall).length).toBe(0) // ainda não — só no efeito
    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('a esfera nasce no instante de efeito (EFFECT_AT), exatamente uma vez — a criatura só nasce quando ela pousa', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })

    let sawNoBall = false
    let ballSpawnCount = 0
    const totalActionTicks = Math.ceil(SUMMON.duration / DELTA) + 2
    for (let i = 0; i < totalActionTicks; i++) {
      const before = world.query(SummonBall).length
      tick(world, {})
      const after = world.query(SummonBall).length
      if (before === 0) sawNoBall = true
      if (after > before) ballSpawnCount++
    }

    expect(sawNoBall).toBe(true)
    expect(ballSpawnCount).toBe(1)
    // Ainda voando neste ponto (duration já passou, a esfera leva mais
    // tempo — summonOffset/summonBallSpeed).
    expect(world.query(SummonedCreature).length).toBe(0)

    advanceUntilResolved(world, player)
    expect(world.query(SummonedCreature).length).toBe(1)
  })

  it('a ação termina sozinha (current volta a null) depois de DURATION — a esfera continua voando', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    advanceUntilFree(world, player)

    expect(player.get(ActionState).current).toBe(null)
    expect(world.query(SummonBall).length).toBe(1) // esfera ainda em voo
    expect(world.query(SummonedCreature).length).toBe(0) // ainda não pousou
  })

  it('a criatura nasce onde a esfera pousa — direção resolvida da mira no disparo (câmera, com inclinação), respeitando summonOffset e a gravidade (nada no caminho)', () => {
    const { world, player, camera } = spawnWorld({
      playerPosition: { x: 5, y: 1, z: 5 },
    })
    player.set(Party, { slot1: 'fox-red' })
    camera.set(OrbitCamera, { yaw: Math.PI / 2, pitch: 0.2 })

    tick(world, { secondary1: true })
    advanceUntilResolved(world, player)

    const [creature] = world.query(SummonedCreature, Position)
    const pos = creature.get(Position)

    const startPos = { x: 5, y: 1, z: 5 }
    const orbit = camera.get(OrbitCamera)
    const dir = resolveExpectedSummonDirection(startPos, 0, orbit) // Rotation.y default (não setada antes do disparo)
    // A esfera nasce (em `spawnSummonBall`, no `effectAt`) com a MÃO já na
    // rotação NOVA (`beginSummon` já girou o treinador pra encarar `dir`)
    // — não a rotação de antes do disparo, usada só pra resolver `dir`.
    const newRotY = Math.atan2(dir.x, dir.z)
    const handOrigin = resolveHandOrigin(startPos, newRotY, SUMMON)
    const { summonOffset, summonBallSpeed } = getPlayerSpecies().party
    // Sem física carregada no teste, a esfera nunca "toca" em nada — pousa
    // exatamente ao esgotar `summonOffset`, já curva pela gravidade.
    const expected = simulateBallLanding(
      handOrigin,
      dir,
      summonBallSpeed,
      summonOffset,
    )

    expect(pos.x).toBeCloseTo(expected.x)
    expect(pos.y).toBeCloseTo(expected.y)
    expect(pos.z).toBeCloseTo(expected.z)
  })

  it('a criatura invocada guarda a espécie e nasce com física/animação de verdade', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    advanceUntilResolved(world, player)

    const [creature] = world.query(SummonedCreature, Position, Rotation)
    expect(creature.get(SummonedCreature).speciesId).toBe('fox-red')
    expect(creature.has(AnimationState)).toBe(true)
    expect(creature.get(AnimationState).id).toBe('idle')
    expect(creature.has(Velocity)).toBe(true)
    expect(creature.has(CharacterController)).toBe(true)
    expect(creature.has(MovementStats)).toBe(true)
    expect(creature.has(Vitals)).toBe(true)
    expect(creature.has(PhysicsBody)).toBe(true)
    expect(creature.get(PhysicsBody).bodyHandle).toBe(-1) // sem física real no teste
    expect(creature.has(ActionState)).toBe(true)
    expect(creature.get(ActionState).current).toBe(null)
    expect(creature.has(PathState)).toBe(true)
    expect(creature.get(PathState).waypoints).toEqual([])
  })

  it('enquanto invoca, apertar outro secondaryN não inicia nada', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red', slot2: 'fox-green' })

    tick(world, { secondary1: true })
    expect(player.get(ActionState).current).toBe('summon')

    tick(world, { secondary2: true }) // ignorado — ocupado
    expect(world.query(SummonedCreature).length).toBe(0)

    advanceUntilResolved(world, player)
    expect(world.query(SummonedCreature).length).toBe(1) // só slot1 nasceu
  })

  it('recolher pelo secondaryN dispara a ação "recall", gira o treinador pra encarar a criatura (não a câmera), e só destrói no efeito', () => {
    const { world, player } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    tick(world, { secondary1: true })
    advanceUntilResolved(world, player) // esfera precisa pousar — só aí a criatura existe pra recolher
    const [creature] = world.query(SummonedCreature, Position)
    const creaturePos = { ...creature.get(Position) }

    player.set(Rotation, { y: 3 }) // deve ser sobrescrito

    tick(world, { secondary1: true })

    expect(player.get(ActionState).current).toBe('recall')
    expect(player.get(Rotation).y).toBeCloseTo(
      Math.atan2(creaturePos.x, creaturePos.z),
    )
    expect(world.query(SummonedCreature).length).toBe(1) // ainda não recolheu

    // Recolher não usa esfera — o efeito acontece dentro da própria ação,
    // resolve junto com o gesto (advanceUntilFree basta).
    advanceUntilFree(world, player)
    expect(world.query(SummonedCreature).length).toBe(0)
    // Feixe de retorno (RecallBeam) nasceu bem onde a criatura estava
    // (ponta de chegada) e carrega a posição da MÃO do treinador (ponta
    // de saída, `resolveHandOrigin` — não a `Position` crua, centro do
    // corpo) — o feixe vai de um até o outro, não é um ponto único.
    const [beam] = world.query(RecallBeam, Position)
    expect(beam).toBeDefined()
    expect(beam.get(Position).x).toBeCloseTo(creaturePos.x)
    expect(beam.get(Position).z).toBeCloseTo(creaturePos.z)
    const trainerPos = player.get(Position)
    // rot.y já é a NOVA (beginRecall girou o treinador pra encarar a
    // criatura antes de applyRecall calcular a mão).
    const expectedHandOrigin = resolveHandOrigin(
      trainerPos,
      player.get(Rotation).y,
      RECALL,
    )
    expect(beam.get(RecallBeam).fromX).toBeCloseTo(expectedHandOrigin.x)
    expect(beam.get(RecallBeam).fromY).toBeCloseTo(expectedHandOrigin.y)
    expect(beam.get(RecallBeam).fromZ).toBeCloseTo(expectedHandOrigin.z)
    // Espécie recolhida — RecallBeamView.jsx usa isso pra dimensionar o
    // envelope que cobre a criatura (getSpecies(speciesId).body).
    expect(beam.get(RecallBeam).speciesId).toBe('fox-red')
  })

  it('desequipar uma criatura já invocada (Party[slot] = null) dispara o recolhimento como ação — não é instantâneo', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })
    tick(world, { secondary1: true })
    advanceUntilResolved(world, player)
    expect(world.query(SummonedCreature).length).toBe(1)

    player.set(Party, { slot1: null }) // desequipa (ex.: InventoryPanel)
    tick(world, {}) // sem secondaryN nenhum

    expect(player.get(ActionState).current).toBe('recall') // iniciou a ação...
    expect(world.query(SummonedCreature).length).toBe(1) // ...mas ainda não recolheu

    advanceUntilFree(world, player)
    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('recolhimento automático dispara mesmo com o treinador fora do controle (troca de controle pra outra criatura, ver controlSwitchSystem.js)', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })
    tick(world, { secondary1: true })
    advanceUntilResolved(world, player)
    expect(world.query(SummonedCreature).length).toBe(1)

    // Simula o treinador tendo perdido o controle pra outra criatura
    // (docs/features/018-troca-de-controle-treinador-criatura.md) — o
    // desequipar ainda tem que recolher, não importa quem está pilotando.
    player.remove(InputControlled)
    player.set(Party, { slot1: null })
    tick(world, {})

    expect(player.get(ActionState).current).toBe('recall')
    advanceUntilFree(world, player)
    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('secondaryN não invoca/recolhe enquanto o treinador está fora do controle (reservado pras skills da criatura, ver docs/features/018-troca-de-controle-treinador-criatura.md)', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })
    player.remove(InputControlled)

    tick(world, { secondary1: true })

    expect(world.query(SummonedCreature).length).toBe(0)
    expect(player.get(ActionState).current).toBe(null)
  })

  it('desequipar também gira o treinador pra encarar a criatura recolhida automaticamente', () => {
    const { world, player } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    tick(world, { secondary1: true })
    advanceUntilResolved(world, player)
    const [creature] = world.query(SummonedCreature, Position)
    const creaturePos = { ...creature.get(Position) }

    player.set(Party, { slot1: null })
    tick(world, {})

    expect(player.get(Rotation).y).toBeCloseTo(
      Math.atan2(creaturePos.x, creaturePos.z),
    )
  })

  it('desequipar durante outra ação em andamento espera ela terminar antes de recolher', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red', slot2: 'fox-green' })
    tick(world, { secondary1: true })
    advanceUntilResolved(world, player)

    tick(world, { secondary2: true }) // começa a invocar o slot2
    expect(player.get(ActionState).current).toBe('summon')

    player.set(Party, { slot1: null }) // desequipa o slot1 (já invocado) no meio da ação do slot2
    tick(world, {})
    expect(player.get(ActionState).current).toBe('summon') // não foi interrompida
    expect(world.query(SummonedCreature).length).toBe(1) // slot1 continua invocado por enquanto

    // Avança até tudo se resolver — a esfera do slot2 pousa e, depois, o
    // recolhimento automático do slot1 órfão dispara sozinho assim que o
    // treinador fica livre de novo (advanceUntilResolved cobre os DOIS
    // ciclos de ação, um atrás do outro — só sai do loop quando `current`
    // estiver `null` E não houver mais esfera nenhuma em voo, o que só
    // acontece depois do recall do slot1 também já ter terminado).
    advanceUntilResolved(world, player)
    const summoned = world.query(SummonedCreature)
    expect(summoned).toHaveLength(1)
    expect(summoned[0].get(SummonedCreature).slot).toBe('slot2')
  })

  it('invocar sequencialmente as 3 criaturas — uma ação de cada vez, mas dá pra ter as 3 de fora ao final', () => {
    const { world, player } = spawnWorld()
    player.set(Party, {
      slot1: 'fox-red',
      slot2: 'fox-green',
      slot3: 'fox-blue',
    })

    // Apertar os 3 no mesmo tick só inicia UM — mutual exclusion.
    tick(world, { secondary1: true, secondary2: true, secondary3: true })
    expect(player.get(ActionState).current).toBe('summon')
    advanceUntilResolved(world, player)
    expect(world.query(SummonedCreature).length).toBe(1)

    tick(world, { secondary2: true })
    advanceUntilResolved(world, player)
    tick(world, { secondary3: true })
    advanceUntilResolved(world, player)

    expect(world.query(SummonedCreature).length).toBe(3)
  })

  it('enquanto uma ação do jogador (dash) está em andamento, invocar não começa', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })
    player.set(ActionState, { current: 'dash', elapsed: 0 })

    tick(world, { secondary1: true })

    expect(player.get(ActionState).current).toBe('dash')
    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('enquanto invoca/recolhe, nenhuma outra ação do jogador (dash) pode começar', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    expect(player.get(ActionState).current).toBe('summon')

    playerActionSystem({ world, delta: DELTA, input: { dash: true } })

    expect(player.get(ActionState).current).toBe('summon') // não virou dash
  })

  it('lê getPlayerSpecies().party a cada tick — mudar summonOffset em tempo real já vale no disparo da esfera', () => {
    const { world, player, camera } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    const partyConfig = getPlayerSpecies().party
    const original = partyConfig.summonOffset
    partyConfig.summonOffset = original * 3

    try {
      tick(world, { secondary1: true })
      advanceUntilResolved(world, player)
      const [creature] = world.query(SummonedCreature)
      const pos = creature.get(Position)

      const startPos = { x: 0, y: 1, z: 0 }
      const orbit = camera.get(OrbitCamera)
      const dir = resolveExpectedSummonDirection(startPos, 0, orbit)
      // Ver comentário equivalente no teste de direção acima — a esfera
      // nasce já com a rotação NOVA (pós-giro), não a de antes do disparo.
      const newRotY = Math.atan2(dir.x, dir.z)
      const handOrigin = resolveHandOrigin(startPos, newRotY, SUMMON)
      const expected = simulateBallLanding(
        handOrigin,
        dir,
        partyConfig.summonBallSpeed,
        original * 3,
      )

      expect(pos.x).toBeCloseTo(expected.x)
      expect(pos.y).toBeCloseTo(expected.y)
      expect(pos.z).toBeCloseTo(expected.z)
    } finally {
      partyConfig.summonOffset = original
    }
  })

  it('esfera duplicada: apertar secondaryN de novo assim que o gesto destrava (mas a esfera anterior ainda em voo) não lança uma segunda esfera pro mesmo slot', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    advanceUntilFree(world, player) // gesto livre, esfera ainda voando
    expect(world.query(SummonBall).length).toBe(1)

    tick(world, { secondary1: true }) // tentaria invocar de novo o mesmo slot
    expect(world.query(SummonBall).length).toBe(1) // continua só uma

    advanceUntilResolved(world, player)
    expect(world.query(SummonedCreature).length).toBe(1) // só uma criatura nasceu
  })
})
