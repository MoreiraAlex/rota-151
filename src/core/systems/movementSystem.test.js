import { describe, it, expect, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { getSpecies } from '@/core/data/species'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  Vitals,
  OrbitCamera,
  ActionState,
  AimAnchor,
} from '@/core/traits'
import { movementSystem } from './movementSystem'

const { walkSpeed: WALK_SPEED, runSpeed: RUN_SPEED } =
  getSpecies('fox').movement
// Vitals do player de teste também vem de 'fox' (ver test/makeWorld.js) —
// RUN_STAMINA_DRAIN_PER_SECOND/STAMINA_REGEN_DELAY_AFTER_USE deixaram de
// ser globais (GAME_CONFIG.VITALS) e viraram parte de `vitals` por espécie
// (docs/features/018-troca-de-controle-treinador-criatura.md).
const { runStaminaDrainPerSecond: RUN_STAMINA_DRAIN_PER_SECOND } =
  getSpecies('fox').vitals

// koota limita a 16 worlds vivos por vez — este arquivo sozinho já passa
// disso (um setup() novo por teste). Rastreia e destrói ao final de cada
// teste pra liberar o id pro próximo.
const spawnedWorlds = []
afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function setup(yaw = 0, delta = 1 / 60) {
  const { world, player, camera } = makeWorld()
  spawnedWorlds.push(world)
  camera.set(OrbitCamera, { yaw })
  const tick = (intent, input = {}) => {
    player.set(InputState, intent)
    movementSystem({ world, delta, input })
  }
  return { player, tick }
}

describe('movementSystem', () => {
  it('com yaw = 0, "frente" (z = -1) vira velocidade -z', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1 })
    const vel = player.get(Velocity)
    expect(vel.z).toBeCloseTo(-WALK_SPEED)
    expect(vel.x).toBeCloseTo(0)
  })

  it('com yaw = 0, "direita" (x = 1) vira velocidade +x — sem inversão', () => {
    const { player, tick } = setup(0)
    tick({ x: 1, z: 0 })
    const vel = player.get(Velocity)
    expect(vel.x).toBeCloseTo(WALK_SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('com yaw = π/2, "frente" é relativo à câmera (vira -x)', () => {
    const { player, tick } = setup(Math.PI / 2)
    tick({ x: 0, z: -1 })
    const vel = player.get(Velocity)
    expect(vel.x).toBeCloseTo(-WALK_SPEED)
    expect(vel.z).toBeCloseTo(0)
  })

  it('com run = true, usa RUN_SPEED em vez de WALK_SPEED', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Velocity).z).toBeCloseTo(-RUN_SPEED)
  })

  it('correr drena stamina proporcionalmente ao delta, só enquanto em movimento', () => {
    const { player, tick } = setup(0, 1)
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(
      100 - RUN_STAMINA_DRAIN_PER_SECOND,
    )
  })

  it('segurar corrida parado (sem intenção de movimento) não drena stamina', () => {
    const { player, tick } = setup(0, 1)
    tick({ x: 0, z: 0, run: true })
    expect(player.get(Vitals).stamina).toBe(100)
  })

  it('sem stamina, corrida cai pra WALK_SPEED em vez de travar', () => {
    const { player, tick } = setup(0)
    player.set(Vitals, { stamina: 0 })
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
    expect(player.get(Vitals).stamina).toBe(0) // não fica negativa
  })

  it('correr até quase zerar não deixa continuar correndo com sobra insuficiente pro próximo tick', () => {
    // Regressão: exigir só `stamina > 0` permitia continuar correndo com uma
    // sobra menor que o custo do próprio tick (ex.: regenerada entre ticks),
    // nunca de fato "cansando" o jogador. O gate precisa ser >= custo do
    // tick, igual dash/pulo já exigem >= custo da ação.
    const { player, tick } = setup(0, 1)
    player.set(Vitals, { stamina: RUN_STAMINA_DRAIN_PER_SECOND - 0.01 })
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
    expect(player.get(Vitals).stamina).toBeCloseTo(
      RUN_STAMINA_DRAIN_PER_SECOND - 0.01,
    ) // não drenou — a ação não "meio aconteceu"
  })

  it('lê Vitals.runStaminaDrainPerSecond da própria entidade a cada tick — mudar já vale no próximo tick', () => {
    // RUN_STAMINA_DRAIN_PER_SECOND deixou de ser global (GAME_CONFIG) —
    // agora é copiado da espécie pro trait Vitals no spawn (ver
    // docs/features/018-troca-de-controle-treinador-criatura.md), então
    // mudar a espécie DEPOIS do spawn não afeta quem já existe (mesmo
    // motivo de MovementStats/outros dados por espécie). O que continua
    // valendo "ao vivo" é mudar o campo direto na própria entidade —
    // prova que o system lê `vitals.runStaminaDrainPerSecond` fresco a
    // cada tick, não um valor cacheado no topo da função.
    const { player, tick } = setup(0, 1)
    const doubled = RUN_STAMINA_DRAIN_PER_SECOND * 2
    player.set(Vitals, { runStaminaDrainPerSecond: doubled })

    tick({ x: 0, z: -1, run: true })

    expect(player.get(Vitals).stamina).toBeCloseTo(100 - doubled)
  })

  it('correr reseta o delay de regeneração de stamina', () => {
    const { player, tick } = setup(0, 1)
    const { staminaRegenDelayAfterUse } = getSpecies('fox').vitals
    tick({ x: 0, z: -1, run: true })
    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      staminaRegenDelayAfterUse,
    )
  })

  it('gira Rotation.y em direção ao movimento', () => {
    const { player, tick } = setup(0)
    for (let i = 0; i < 120; i++) tick({ x: 1, z: 0 })
    // movendo em +x, facing = atan2(1, 0) = π/2
    expect(player.get(Rotation).y).toBeCloseTo(Math.PI / 2, 1)
  })

  it('não escreve em Position (quem move é a física)', () => {
    const { player, tick } = setup(0)
    const before = { ...player.get(Position) }
    for (let i = 0; i < 60; i++) tick({ x: 1, z: 1 })
    expect(player.get(Position)).toMatchObject(before)
  })

  it('com uma ação em andamento (ex.: arremesso), ignora a intenção de movimento — não dá pra andar enquanto ocupado', () => {
    const { player, tick } = setup(0)
    player.set(ActionState, { current: 'throw' })
    const rotBefore = player.get(Rotation).y

    tick({ x: 1, z: -1, run: true })

    const vel = player.get(Velocity)
    expect(vel.x).toBe(0)
    expect(vel.z).toBe(0)
    expect(player.get(Rotation).y).toBe(rotBefore) // também não gira
  })

  it('mirando (input.aiming), corrida não vale — cai pra WALK_SPEED mesmo com run: true e stamina de sobra', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1, run: true }, { aiming: true })
    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
  })

  it('mirando, não drena stamina (não chega nem a tentar correr)', () => {
    const { player, tick } = setup(0, 1)
    tick({ x: 0, z: -1, run: true }, { aiming: true })
    expect(player.get(Vitals).stamina).toBe(100)
  })

  it('parar de mirar (aiming: false) volta a permitir correr', () => {
    const { player, tick } = setup(0)
    tick({ x: 0, z: -1, run: true }, { aiming: true })
    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)

    tick({ x: 0, z: -1, run: true }, { aiming: false })
    expect(player.get(Velocity).z).toBeCloseTo(-RUN_SPEED)
  })

  it('sem ação em andamento (current: null), volta a mover normalmente', () => {
    const { player, tick } = setup(0)
    player.set(ActionState, { current: null })

    tick({ x: 0, z: -1 })

    expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
  })

  describe('com AimAnchor travado (lock-on estilo Zelda)', () => {
    // Jogador em (0,2,0) (default do makeWorld), ponto travado 5 unidades
    // à frente (-Z) dele.
    const ANCHOR = { active: true, x: 0, y: 2, z: -5 }

    it('"frente" anda em direção ao ponto travado (radial), não na direção da câmera', () => {
      const { player, tick } = setup(Math.PI / 2) // câmera olhando pra outro lado
      player.set(AimAnchor, ANCHOR)

      tick({ x: 0, z: -1 })

      const vel = player.get(Velocity)
      expect(vel.z).toBeCloseTo(-WALK_SPEED)
      expect(vel.x).toBeCloseTo(0)
    })

    it('"direita"/"esquerda" viram tangencial — circula ao redor do ponto travado', () => {
      const { player, tick } = setup(0)
      player.set(AimAnchor, ANCHOR)

      tick({ x: 1, z: 0 })

      const vel = player.get(Velocity)
      expect(vel.x).toBeCloseTo(WALK_SPEED)
      expect(vel.z).toBeCloseTo(0)
    })

    it('gira na direção do próprio movimento (WASD), não do ponto travado — parado não gira', () => {
      const { player, tick } = setup(0)
      player.set(AimAnchor, ANCHOR)
      const before = player.get(Rotation).y

      // Parado (sem intenção de movimento): não gira, mesmo travado.
      for (let i = 0; i < 120; i++) tick({ x: 0, z: 0 })
      expect(player.get(Rotation).y).toBe(before)
    })

    it('andando de lado (tangencial) gira pra encarar o próprio movimento, não o ponto travado', () => {
      const { player, tick } = setup(0)
      player.set(AimAnchor, ANCHOR)

      // Tangencial puro (x=1,z=0) vira velocidade mundo +x — facing
      // esperado é atan2(worldX, worldZ) = atan2(+, 0) = π/2, não o ponto
      // travado (que ficaria em π, atrás do jogador na direção -Z).
      for (let i = 0; i < 120; i++) tick({ x: 1, z: 0 })
      expect(player.get(Rotation).y).toBeCloseTo(Math.PI / 2, 1)
    })

    it('sem AimAnchor ativo, ignora o campo (mesmo com x/y/z preenchidos) — comportamento normal', () => {
      const { player, tick } = setup(0)
      player.set(AimAnchor, { active: false, x: 0, y: 2, z: -5 })

      tick({ x: 0, z: -1 })

      expect(player.get(Velocity).z).toBeCloseTo(-WALK_SPEED)
    })
  })
})
