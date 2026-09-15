import { describe, it, expect, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import {
  ActionState,
  Velocity,
  Rotation,
  Vitals,
  HeldItem,
  Projectile,
  Grounded,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem } from '@/core/data/items'
import { playerActionSystem } from './playerActionSystem'

const { DURATION, SPEED, STAMINA_COST } = GAME_CONFIG.PLAYER_ACTIONS.dash
const THROW = GAME_CONFIG.PLAYER_ACTIONS.throw
const CONSUME = GAME_CONFIG.PLAYER_ACTIONS.consume

function tick(world, input = {}, delta = 1 / 60) {
  playerActionSystem({ world, delta, input })
}

// koota limita a 16 worlds vivos por vez — este arquivo sozinho já passa
// disso (muitos testes, cada um com seu próprio makeWorld()). Rastreia e
// destrói ao final de cada teste pra liberar o id pro próximo.
const spawnedWorlds = []
function spawnWorld(...args) {
  const created = makeWorld(...args)
  spawnedWorlds.push(created.world)
  return created
}

afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

describe('playerActionSystem — dash', () => {
  it('não dispara sem o gatilho de input', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)

    tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('não dispara no ar (sem Grounded)', () => {
    const { world, player } = spawnWorld()

    tick(world, { dash: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara no chão com o gatilho, e já aplica velocidade de dash no mesmo tick', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })

    const action = player.get(ActionState)
    expect(action.current).toBe('dash')
    expect(action.elapsed).toBeGreaterThan(0)

    const vel = player.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(SPEED)
  })

  it('desconta o custo de stamina uma única vez, no disparo', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(100 - STAMINA_COST)

    // continuar no meio do dash não desconta de novo
    tick(world, {})
    expect(player.get(Vitals).stamina).toBeCloseTo(100 - STAMINA_COST)
  })

  it('reseta o delay de regeneração de stamina ao disparar', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })

    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      GAME_CONFIG.VITALS.STAMINA_REGEN_DELAY_AFTER_USE,
    )
  })

  it('não dispara sem stamina suficiente', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Vitals, { stamina: STAMINA_COST - 1 })

    tick(world, { dash: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(player.get(Vitals).stamina).toBe(STAMINA_COST - 1) // não descontou
  })

  it('ignora um novo gatilho enquanto já está em ação', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })
    const firstDir = { ...player.get(ActionState) }

    // gira e tenta disparar de novo no meio do dash — não deveria trocar
    // a direção travada nem reiniciar o relógio
    player.set(Rotation, { y: Math.PI / 2 })
    tick(world, { dash: true })

    const action = player.get(ActionState)
    expect(action.dirX).toBeCloseTo(firstDir.dirX)
    expect(action.dirZ).toBeCloseTo(firstDir.dirZ)
  })

  it('encerra sozinho depois da duração configurada e devolve o controle', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })

    const steps = Math.ceil(DURATION / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('direção trava no instante do disparo, mesmo que a entidade gire depois', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: Math.PI / 2 })

    tick(world, { dash: true })
    const dirAtStart = { ...player.get(ActionState) }

    player.set(Rotation, { y: 0 })
    tick(world, {})

    const action = player.get(ActionState)
    expect(action.dirX).toBeCloseTo(dirAtStart.dirX)
    expect(action.dirZ).toBeCloseTo(dirAtStart.dirZ)
  })
})

describe('playerActionSystem — arremesso (item throwable)', () => {
  it('não dispara sem item em mãos', () => {
    const { world, player } = spawnWorld()

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara com item throwable equipado, trava a direção no instante do disparo', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Rotation, { y: Math.PI / 2 })

    tick(world, { primary: true })

    const action = player.get(ActionState)
    expect(action.current).toBe('throw')
    expect(action.dirX).toBeCloseTo(Math.sin(Math.PI / 2))
    expect(action.dirZ).toBeCloseTo(Math.cos(Math.PI / 2))
  })

  it('só spawna o projétil ao cruzar o instante de liberação, uma vez só', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Rotation, { y: 0 })

    tick(world, { primary: true })

    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease - 1; i++) {
      tick(world, {})
      expect(world.query(Projectile).length).toBe(0)
    }

    tick(world, {}) // cruza o instante de liberação
    expect(world.query(Projectile).length).toBe(1)

    // continuar a ação não spawna um segundo projétil
    const remainingTicks = Math.ceil(
      (THROW.DURATION - THROW.EFFECT_AT) / (1 / 60),
    )
    for (let i = 0; i < remainingTicks + 1; i++) tick(world, {})
    expect(world.query(Projectile).length).toBe(1)
  })

  it('o projétil nasce com a velocidade/lifetime configurados, na direção travada', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Rotation, { y: 0 })

    tick(world, { primary: true })
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    const [projectileEntity] = world.query(Projectile)
    expect(projectileEntity.get(Velocity).z).toBeCloseTo(THROW.SPEED)
    expect(projectileEntity.get(Projectile).lifetime).toBeCloseTo(
      THROW.LIFETIME,
    )
  })

  it('limpa o item da mão ao arremessar', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })

    tick(world, { primary: true })
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('encerra sozinho depois da duração e devolve o controle', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })

    tick(world, { primary: true })
    const steps = Math.ceil(THROW.DURATION / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })
})

describe('playerActionSystem — uso (item consumable)', () => {
  it('não dispara sem item em mãos', () => {
    const { world, player } = spawnWorld()

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara com item consumable equipado', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe('consume')
  })

  it('cura no instante de efeito, uma vez só', () => {
    const { world, player } = spawnWorld()
    player.set(Vitals, { hp: 50, maxHp: 100 })
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true })

    const ticksUntilEffect = Math.ceil(CONSUME.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilEffect - 1; i++) {
      tick(world, {})
      expect(player.get(Vitals).hp).toBe(50)
    }

    tick(world, {}) // cruza o instante de efeito
    const healed = 50 + getItem('potion').consumable.healAmount
    expect(player.get(Vitals).hp).toBeCloseTo(healed)

    // continuar a ação não cura de novo
    tick(world, {})
    expect(player.get(Vitals).hp).toBeCloseTo(healed)
  })

  it('limpa o item da mão ao usar', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true })
    const ticksUntilEffect = Math.ceil(CONSUME.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilEffect; i++) tick(world, {})

    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('encerra sozinho depois da duração e devolve o controle', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true })
    const steps = Math.ceil(CONSUME.DURATION / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })
})
