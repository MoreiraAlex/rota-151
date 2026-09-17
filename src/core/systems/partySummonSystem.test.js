import { describe, it, expect, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { wrapAngle } from '@/core/math'
import { getPlayerSpecies } from '@/core/data/species'
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
  Rotation,
  SummonedCreature,
  Velocity,
  Vitals,
} from '@/core/traits'
import { partySummonSystem } from './partySummonSystem'
import { playerActionSystem } from './playerActionSystem'

const DELTA = 1 / 60
// summon/recall e o offset de invocação são exclusivos do treinador
// (`getPlayerSpecies().actions`/`.party`, ver docs/features/018-troca-
// de-controle-treinador-criatura.md) — sempre a espécie `bot` de
// verdade, não a `fox` que este arquivo usa pro player de teste.
const SUMMON = getPlayerSpecies().actions.summon

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

function tick(world, input = {}) {
  partySummonSystem({ world, delta: DELTA, input })
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

  it('apertar com uma espécie equipada dispara a ação "summon" e gira o treinador pra direção da câmera — sem invocar ainda', () => {
    const { world, player, camera } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    camera.set(OrbitCamera, { yaw: 1.1 })
    player.set(Rotation, { y: -2 }) // deve ser sobrescrito

    tick(world, { secondary1: true })

    expect(player.get(ActionState).current).toBe('summon')
    // Encara pra ONDE a câmera aponta — o oposto de `orbit.yaw` (ângulo
    // do alvo até a câmera, atrás dele — ver `resolveCameraYaw`).
    expect(player.get(Rotation).y).toBeCloseTo(wrapAngle(1.1 + Math.PI))
    expect(world.query(SummonedCreature).length).toBe(0) // ainda não — só no efeito
  })

  it('a criatura só nasce no instante de efeito (EFFECT_AT), exatamente uma vez', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })

    let sawEmpty = false
    let spawnCount = 0
    const totalTicks = Math.ceil(SUMMON.duration / DELTA) + 5
    for (let i = 0; i < totalTicks; i++) {
      const before = world.query(SummonedCreature).length
      tick(world, {})
      const after = world.query(SummonedCreature).length
      if (before === 0) sawEmpty = true
      if (after > before) spawnCount++
    }

    expect(sawEmpty).toBe(true)
    expect(spawnCount).toBe(1)
    expect(world.query(SummonedCreature).length).toBe(1)
  })

  it('a ação termina sozinha (current volta a null) depois de DURATION', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    advanceUntilFree(world, player)

    expect(player.get(ActionState).current).toBe(null)
    expect(world.query(SummonedCreature).length).toBe(1) // já tinha nascido antes de liberar
  })

  it('a criatura nasce na direção que a câmera apontava no disparo, perto do treinador', () => {
    const { world, player, camera } = spawnWorld({
      playerPosition: { x: 5, y: 1, z: 5 },
    })
    player.set(Party, { slot1: 'fox-red' })
    camera.set(OrbitCamera, { yaw: Math.PI / 2 })

    tick(world, { secondary1: true })
    advanceUntilFree(world, player)

    const [creature] = world.query(SummonedCreature, Position)
    const pos = creature.get(Position)
    const { summonOffset: SUMMON_OFFSET } = getPlayerSpecies().party
    // Direção de nascimento = pra ONDE a câmera aponta (yaw + π), não
    // `orbit.yaw` cru.
    const facing = Math.PI / 2 + Math.PI
    expect(pos.x).toBeCloseTo(5 + Math.sin(facing) * SUMMON_OFFSET)
    expect(pos.z).toBeCloseTo(5 + Math.cos(facing) * SUMMON_OFFSET)
  })

  it('a criatura invocada guarda a espécie e nasce com física/animação de verdade', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })

    tick(world, { secondary1: true })
    advanceUntilFree(world, player)

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

    advanceUntilFree(world, player)
    expect(world.query(SummonedCreature).length).toBe(1) // só slot1 nasceu
  })

  it('recolher pelo secondaryN dispara a ação "recall", gira o treinador pra encarar a criatura (não a câmera), e só destrói no efeito', () => {
    const { world, player } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    tick(world, { secondary1: true })
    advanceUntilFree(world, player)
    const [creature] = world.query(SummonedCreature, Position)
    const creaturePos = { ...creature.get(Position) }

    player.set(Rotation, { y: 3 }) // deve ser sobrescrito

    tick(world, { secondary1: true })

    expect(player.get(ActionState).current).toBe('recall')
    expect(player.get(Rotation).y).toBeCloseTo(
      Math.atan2(creaturePos.x, creaturePos.z),
    )
    expect(world.query(SummonedCreature).length).toBe(1) // ainda não recolheu

    advanceUntilFree(world, player)
    expect(world.query(SummonedCreature).length).toBe(0)
  })

  it('desequipar uma criatura já invocada (Party[slot] = null) dispara o recolhimento como ação — não é instantâneo', () => {
    const { world, player } = spawnWorld()
    player.set(Party, { slot1: 'fox-red' })
    tick(world, { secondary1: true })
    advanceUntilFree(world, player)
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
    advanceUntilFree(world, player)
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
    advanceUntilFree(world, player)
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
    advanceUntilFree(world, player)

    tick(world, { secondary2: true }) // começa a invocar o slot2
    expect(player.get(ActionState).current).toBe('summon')

    player.set(Party, { slot1: null }) // desequipa o slot1 (já invocado) no meio da ação do slot2
    tick(world, {})
    expect(player.get(ActionState).current).toBe('summon') // não foi interrompida
    expect(world.query(SummonedCreature).length).toBe(1) // slot1 continua invocado por enquanto

    advanceUntilFree(world, player) // termina de invocar o slot2
    expect(world.query(SummonedCreature).length).toBe(2) // slot1 (órfão) + slot2 novo

    // advanceUntilFree não tickou de novo (já estava livre) — o
    // recolhimento automático do órfão só é detectado num tick seguinte.
    tick(world, {})
    expect(player.get(ActionState).current).toBe('recall')
    advanceUntilFree(world, player) // agora sim recolhe o slot1 órfão
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
    advanceUntilFree(world, player)
    expect(world.query(SummonedCreature).length).toBe(1)

    tick(world, { secondary2: true })
    advanceUntilFree(world, player)
    tick(world, { secondary3: true })
    advanceUntilFree(world, player)

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

  it('lê getPlayerSpecies().party a cada tick — mudar summonOffset em tempo real já vale no efeito', () => {
    const { world, player } = spawnWorld({
      playerPosition: { x: 0, y: 1, z: 0 },
    })
    player.set(Party, { slot1: 'fox-red' })
    const partyConfig = getPlayerSpecies().party
    const original = partyConfig.summonOffset
    partyConfig.summonOffset = original * 3

    try {
      tick(world, { secondary1: true })
      advanceUntilFree(world, player)
      const [creature] = world.query(SummonedCreature)
      const pos = creature.get(Position)
      expect(Math.hypot(pos.x, pos.z)).toBeCloseTo(original * 3)
    } finally {
      partyConfig.summonOffset = original
    }
  })
})
