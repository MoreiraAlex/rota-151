import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import {
  ActionState,
  Velocity,
  Rotation,
  Position,
  OrbitCamera,
  Vitals,
  HeldItem,
  Inventory,
  Projectile,
  ConsumeEffect,
  Eating,
  Grounded,
  InputState,
  MovementStats,
  DashCooldown,
  resolveMovementCosts,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { ITEM_REGISTRY, getItem, listItems } from '@/core/data/items'
import { getSpecies, getPlayerSpecies } from '@/core/data/species'
import { computeAimRay } from '@/core/camera/orbitCamera'
import { resolveDashCost } from '../actions/stamina'
import { playerActionSystem, resolveDashSpeed } from './playerActionSystem'
import { dashCooldownSystem } from './dashCooldownSystem'

// DASH continua global (GAME_CONFIG) — THROW/CONSUME são exclusivos do
// treinador (`getPlayerSpecies().actions`, ver docs/features/018-troca-
// de-controle-treinador-criatura.md), sempre a espécie do treinador de
// verdade, não a que este arquivo usa pro player de teste (ver
// `test/makeWorld.js`).
const { DURATION, SPEED, COOLDOWN } = GAME_CONFIG.PLAYER_ACTIONS.dash
const { throw: THROW, consume: CONSUME } = getPlayerSpecies().actions
// Custo do dash do player de teste — por entidade desde a 035
// (`Vitals.dashStaminaCost`, `resolveMovementCosts`).
const DASH_COST = resolveMovementCosts(getSpecies('boy')).dashStaminaCost

function tick(world, input = {}, delta = 1 / 60) {
  playerActionSystem({ world, delta, input })
}

// Reproduz `resolveHandOrigin` (playerActionSystem.js, não exportada) pra
// validar a fiação — mesmo padrão já usado aqui pra `resolveThrowLaunch`.
function resolveHandOrigin(pos, rotY) {
  const { handForwardOffset, handSideOffset, handHeightOffset } = THROW
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

// Nenhum item da beta é `throwable` (a Pokébola só ganha função na 043,
// docs/features/042-itens-da-beta.md): o arremesso é testado com um item de
// teste injetado no registro.
const TEST_THROWABLE = {
  id: 'test-throwable',
  name: 'Item de teste',
  category: 'throwable',
}
const THROWABLE = TEST_THROWABLE.id
beforeAll(() => {
  ITEM_REGISTRY[THROWABLE] = TEST_THROWABLE
})
afterAll(() => {
  delete ITEM_REGISTRY[THROWABLE]
})

// Itens do catálogo, pela categoria (sem fixar id).
const POTION = listItems().find((item) => item.category === 'consumable').id
const BERRY = listItems().find((item) => item.category === 'berry')
const POKEBALL = listItems().find((item) => item.category === 'pokeball').id

// Poção e fruta não são usadas com a vida cheia: deixa o player ferido.
function hurt(player) {
  const vitals = player.get(Vitals)
  player.set(Vitals, { ...vitals, hp: vitals.maxHp / 2 })
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

  it('ferido, o dash custa mais (o custo da entidade × o multiplicador da vida)', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    const { maxHp } = player.get(Vitals)
    player.set(Vitals, { hp: maxHp * 0.25, stamina: 100 })
    const cost = resolveDashCost(player.get(Vitals))
    expect(cost).toBeGreaterThan(DASH_COST)

    tick(world, { dash: true })

    expect(player.get(Vitals).stamina).toBeCloseTo(100 - cost)
  })

  it('desconta o custo de stamina uma única vez, no disparo', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })
    const { maxStamina } = player.get(Vitals)

    tick(world, { dash: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(maxStamina - DASH_COST)

    // continuar no meio do dash não desconta de novo
    tick(world, {})
    expect(player.get(Vitals).stamina).toBeCloseTo(maxStamina - DASH_COST)
  })

  it('reseta o delay de regeneração de stamina ao disparar', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })

    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      player.get(Vitals).staminaRegenDelayAfterUse,
    )
  })

  it('não dispara sem stamina suficiente', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Vitals, { stamina: DASH_COST / 2 })

    tick(world, { dash: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(player.get(Vitals).stamina).toBe(DASH_COST / 2) // não descontou
  })

  it('recarga: depois de um dash, outro só depois de COOLDOWN (mesma regra da IA)', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    const run = (input) => {
      dashCooldownSystem({ world, delta: 1 / 60 })
      tick(world, input)
    }

    run({ dash: true })
    expect(player.get(DashCooldown).timeLeft).toBeCloseTo(COOLDOWN)
    // Termina o dash e tenta de novo antes da recarga: não sai.
    for (let t = 0; t < DURATION + 0.1; t += 1 / 60) run({})
    run({ dash: true })
    expect(player.get(ActionState).current).toBe(null)

    for (let t = 0; t < COOLDOWN; t += 1 / 60) run({})
    run({ dash: true })
    expect(player.get(ActionState).current).toBe('dash')
  })

  it('lê GAME_CONFIG.PLAYER_ACTIONS.dash a cada tick — mudar SPEED em tempo real já vale no próximo disparo', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })
    const original = GAME_CONFIG.PLAYER_ACTIONS.dash.SPEED
    GAME_CONFIG.PLAYER_ACTIONS.dash.SPEED = original * 2

    try {
      tick(world, { dash: true })
      const vel = player.get(Velocity)
      expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(original * 2)
    } finally {
      GAME_CONFIG.PLAYER_ACTIONS.dash.SPEED = original
    }
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

describe('dash — frenagem no fim', () => {
  const DASH = { SPEED: 12, DURATION: 1, EASE_OUT_TIME: 0.25 }

  it('resolveDashSpeed: velocidade cheia até o início da frenagem, chega exata na de saída no fim', () => {
    expect(resolveDashSpeed(DASH, 0.1, 4)).toBe(12)
    expect(resolveDashSpeed(DASH, 0.75, 4)).toBe(12)
    expect(resolveDashSpeed(DASH, 0.875, 4)).toBeCloseTo(8) // metade, smoothstep
    expect(resolveDashSpeed(DASH, 1, 4)).toBeCloseTo(4)
  })

  it('resolveDashSpeed: EASE_OUT_TIME 0 desliga; nunca passa de metade da duração', () => {
    expect(resolveDashSpeed({ ...DASH, EASE_OUT_TIME: 0 }, 0.99, 0)).toBe(12)
    const short = { SPEED: 12, DURATION: 0.2, EASE_OUT_TIME: 0.25 }
    expect(resolveDashSpeed(short, 1 / 60, 0)).toBe(12) // 1º tick ainda cheio
  })

  function dashAndRecord(world, player, input) {
    player.add(Grounded)
    player.set(Rotation, { y: 0 })
    player.set(InputState, input)
    tick(world, { dash: true })
    const speeds = []
    while (player.get(ActionState).current === 'dash') {
      tick(world, {})
      const vel = player.get(Velocity)
      speeds.push(Math.hypot(vel.x, vel.z))
      if (speeds.length > 1000) throw new Error('dash nunca terminou')
    }
    return speeds
  }

  it('sem input: desce suave até 0 — sem degrau maior que a frenagem permite', () => {
    const { world, player } = spawnWorld()
    const speeds = dashAndRecord(world, player, { x: 0, z: 0, run: false })

    expect(speeds.at(-1)).toBeCloseTo(0)
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1] + 1e-9)
    }
    const biggestDrop = Math.max(
      ...speeds.slice(1).map((v, i) => speeds[i] - v),
    )
    expect(biggestDrop).toBeLessThan(SPEED / 4) // antes: SPEED inteiro num tick
  })

  it('segurando correr: termina exatamente no runSpeed, não em 0 (sem tick parado no fim)', () => {
    const { world, player } = spawnWorld()
    const { runSpeed } = player.get(MovementStats)
    const speeds = dashAndRecord(world, player, { x: 0, z: 1, run: true })

    expect(speeds.at(-1)).toBeCloseTo(runSpeed)
  })
})

describe('playerActionSystem — arremesso (item throwable)', () => {
  it('reduzir o estoque dispara notificação de mudança em Inventory (reatividade do useTrait)', () => {
    // Regressão: consumir via mutação direta (`.splice()`) num valor lido
    // pela query mudava o dado real, mas nunca disparava `world.onChange` —
    // a UI (PartyHud/InventoryPanel/EquipmentPanel, via useTrait) só
    // atualizava quando outra coisa forçava um re-render (trocar de tela).
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Inventory, { counts: { [THROWABLE]: 2 } })

    let changed = false
    world.onChange(Inventory, (entity) => {
      if (entity === player) changed = true
    })

    tick(world, { primary: true })
    const ticksUntilRelease = Math.ceil(THROW.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(changed).toBe(true)
    expect(player.get(Inventory).counts).toEqual({ [THROWABLE]: 1 })
  })

  it('não dispara sem item em mãos', () => {
    const { world, player } = spawnWorld()

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara com item throwable equipado, trava a velocidade de lançamento (reta até o ponto de mira, sem arco) no instante do disparo, e vira o corpo pra encarar o arremesso', () => {
    const { world, player, camera } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Rotation, { y: Math.PI / 2 }) // deve ser sobrescrito
    camera.set(OrbitCamera, { yaw: Math.PI / 3, pitch: 0.4, distance: 8 })

    tick(world, { primary: true })

    const action = player.get(ActionState)
    expect(action.current).toBe('throw')

    // Sem física inicializada no teste, o raycast de mira nunca acerta
    // nada — o ponto de mira esperado é sempre o limite de AIM_RANGE,
    // mesma fórmula de `resolveAimPoint` (playerActionSystem.js). Daí a
    // velocidade é só a direção até esse ponto (reta, sem arco) vezes
    // SPEED — mesma conta de `resolveThrowLaunch`, reproduzida aqui pra
    // validar a fiação (a geometria em si já é testada isolada em
    // core/camera/orbitCamera.test.js).
    const pos = player.get(Position)
    // rot.y ainda é o valor de ANTES do disparo sobrescrever (π/2, setado
    // acima) — a origem da mão usa a rotação de quando o arremesso
    // começa, não a nova (que só é conhecida depois de resolver a
    // velocidade).
    const throwOrigin = resolveHandOrigin(pos, Math.PI / 2)
    const orbit = camera.get(OrbitCamera)
    // Mesma altura/desvio de ombro que `resolveAimPoint` de verdade usa
    // (docs/features/026-preparo-do-treinador-boy.md — `getPlayerSpecies().
    // camera`, com fallback pro default global) — não mais os globais
    // hardcoded, que divergem sempre que a espécie configurar os
    // próprios valores (ex.: `boy` tem `targetHeight` próprio).
    const { origin, direction } = computeAimRay(
      pos,
      orbit,
      undefined,
      getPlayerSpecies().camera?.targetHeight,
      getPlayerSpecies().camera?.shoulderOffset,
    )
    const { aimRange, speed: SPEED } = THROW
    const aimPoint = {
      x: origin.x + direction.x * aimRange,
      y: origin.y + direction.y * aimRange,
      z: origin.z + direction.z * aimRange,
    }
    const dx = aimPoint.x - throwOrigin.x
    const dy = aimPoint.y - throwOrigin.y
    const dz = aimPoint.z - throwOrigin.z
    const distance = Math.hypot(dx, dy, dz)
    const expectedVelocity = {
      x: (dx / distance) * SPEED,
      y: (dy / distance) * SPEED,
      z: (dz / distance) * SPEED,
    }

    expect(action.dirX).toBeCloseTo(expectedVelocity.x)
    expect(action.dirY).toBeCloseTo(expectedVelocity.y)
    expect(action.dirZ).toBeCloseTo(expectedVelocity.z)
    expect(Math.hypot(action.dirX, action.dirY, action.dirZ)).toBeCloseTo(SPEED)
    expect(player.get(Rotation).y).toBeCloseTo(
      Math.atan2(expectedVelocity.x, expectedVelocity.z),
    )
  })

  it('desconta o custo de stamina do arremesso uma única vez, no disparo, e reseta o delay de regeneração', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    const { maxStamina } = player.get(Vitals)

    tick(world, { primary: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(
      maxStamina - THROW.staminaCost,
    )
    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      player.get(Vitals).staminaRegenDelayAfterUse,
    )

    // continuar no meio do arremesso não desconta de novo
    tick(world, {})
    expect(player.get(Vitals).stamina).toBeCloseTo(
      maxStamina - THROW.staminaCost,
    )
  })

  it('sem stamina suficiente, o arremesso não dispara', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Vitals, { stamina: THROW.staminaCost - 1 })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(player.get(Vitals).stamina).toBe(THROW.staminaCost - 1) // não descontou
  })

  it('mudar AIM_RANGE muda de verdade a direção resolvida do arremesso — não fica preso a um alcance fixo', () => {
    const { world, player, camera } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0.3, distance: 10 })
    const throwConfig = getPlayerSpecies().actions.throw
    const originalRange = throwConfig.aimRange

    try {
      throwConfig.aimRange = 5
      tick(world, { primary: true })
      const shortRangeAction = { ...player.get(ActionState) }

      for (let i = 0; i < Math.ceil(THROW.duration / (1 / 60)) + 1; i++) {
        tick(world, {})
      }
      player.set(HeldItem, { itemId: THROWABLE })

      throwConfig.aimRange = 300
      tick(world, { primary: true })
      const longRangeAction = player.get(ActionState)

      // Módulo sempre SPEED (reto, sem arco) nos dois casos...
      expect(
        Math.hypot(
          shortRangeAction.dirX,
          shortRangeAction.dirY,
          shortRangeAction.dirZ,
        ),
      ).toBeCloseTo(THROW.speed)
      expect(
        Math.hypot(
          longRangeAction.dirX,
          longRangeAction.dirY,
          longRangeAction.dirZ,
        ),
      ).toBeCloseTo(THROW.speed)
      // ...mas a direção em si muda — alcance curto mira num ponto mais
      // perto do jogador (mais paralaxe), alcance longo converge quase
      // paralelo à câmera.
      expect(longRangeAction.dirY).not.toBeCloseTo(shortRangeAction.dirY, 2)
    } finally {
      throwConfig.aimRange = originalRange
    }
  })

  it('só spawna o projétil ao cruzar o instante de liberação, uma vez só', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Rotation, { y: 0 })

    tick(world, { primary: true })

    // Tickar até bem depois do fim da ação, contando transições de "sem
    // projétil" pra "com projétil" — em vez de calcular o tick exato de
    // cruzamento na mão (frágil: soma repetida de 1/60 acumula erro de
    // ponto flutuante, então o mesmo cálculo pode "sortear" um tick a mais
    // ou a menos dependendo do valor exato de EFFECT_AT, sem relação
    // nenhuma com o comportamento de verdade sendo testado).
    let sawEmpty = false
    let spawnCount = 0
    const totalTicks = Math.ceil(THROW.duration / (1 / 60)) + 5
    for (let i = 0; i < totalTicks; i++) {
      const before = world.query(Projectile).length
      tick(world, {})
      const after = world.query(Projectile).length
      if (before === 0) sawEmpty = true
      if (after > before) spawnCount++
    }

    expect(sawEmpty).toBe(true) // houve tempo sem projétil antes de soltar
    expect(spawnCount).toBe(1) // spawnou exatamente uma vez
    expect(world.query(Projectile).length).toBe(1) // continuar a ação depois não spawna outro
  })

  it('o projétil nasce com a velocidade/lifetime resolvidos no disparo (reto até o ponto de mira, sem arco)', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })

    tick(world, { primary: true })
    const action = { ...player.get(ActionState) }
    const ticksUntilRelease = Math.ceil(THROW.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    const [projectileEntity] = world.query(Projectile)
    const vel = projectileEntity.get(Velocity)
    // dirX/dirY/dirZ já É a velocidade de lançamento resolvida no disparo
    // (ver resolveThrowLaunch) — o projétil nasce exatamente com ela, sem
    // multiplicar por SPEED de novo.
    expect(vel.x).toBeCloseTo(action.dirX)
    expect(vel.y).toBeCloseTo(action.dirY)
    expect(vel.z).toBeCloseTo(action.dirZ)
    // Reto (sem arco) — o módulo total é sempre SPEED.
    expect(Math.hypot(vel.x, vel.y, vel.z)).toBeCloseTo(THROW.speed)
    // lifetime é sempre THROW.lifetime direto da config — sem cálculo
    // dinâmico (revisado: o lifetime conta desde o lançamento, não desde
    // o impacto, e não deve variar com a distância até o ponto de mira).
    expect(projectileEntity.get(Projectile).lifetime).toBeCloseTo(
      THROW.lifetime,
    )
  })

  it('encerra sozinho depois da duração e devolve o controle', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })

    tick(world, { primary: true })
    const steps = Math.ceil(THROW.duration / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('remove uma unidade do item do inventário ao arremessar, e desequipa (estoque zerou)', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Inventory, { counts: { [THROWABLE]: 1 } })

    tick(world, { primary: true })
    const ticksUntilRelease = Math.ceil(THROW.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(Inventory).counts).toEqual({})
    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('tendo mais de uma unidade, arremessar consome só uma (a pilha continua) e não desequipa', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Inventory, { counts: { [THROWABLE]: 2 } })

    tick(world, { primary: true })
    const ticksUntilRelease = Math.ceil(THROW.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(Inventory).counts).toEqual({ [THROWABLE]: 1 })
    expect(player.get(HeldItem).itemId).toBe(THROWABLE)
  })

  it('com estoque restante, dá pra arremessar de novo sem reequipar', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: THROWABLE })
    player.set(Inventory, { counts: { [THROWABLE]: 2 } })

    tick(world, { primary: true })
    const ticksUntilRelease = Math.ceil(THROW.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})
    const remainingTicks = Math.ceil(
      (THROW.duration - THROW.effectAt) / (1 / 60),
    )
    for (let i = 0; i < remainingTicks + 1; i++) tick(world, {})

    // segundo arremesso, sem reequipar — a mão já continuava com o item
    tick(world, { primary: true })
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(Inventory).counts).toEqual({})
    expect(player.get(HeldItem).itemId).toBe(null)
    expect(world.query(Projectile).length).toBe(2)
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
    hurt(player)
    player.set(HeldItem, { itemId: POTION })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe('consume')
  })

  it('cura no instante de efeito, uma vez só', () => {
    const { world, player } = spawnWorld()
    player.set(Vitals, { hp: 50, maxHp: 100 })
    hurt(player)
    player.set(HeldItem, { itemId: POTION })

    tick(world, { primary: true })

    const ticksUntilEffect = Math.ceil(CONSUME.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilEffect - 1; i++) {
      tick(world, {})
      expect(player.get(Vitals).hp).toBe(50)
    }

    tick(world, {}) // cruza o instante de efeito
    const healed = 50 + getItem(POTION).consumable.healAmount
    expect(player.get(Vitals).hp).toBeCloseTo(healed)

    // continuar a ação não cura de novo
    tick(world, {})
    expect(player.get(Vitals).hp).toBeCloseTo(healed)
  })

  it('encerra sozinho depois da duração e devolve o controle', () => {
    const { world, player } = spawnWorld()
    hurt(player)
    player.set(HeldItem, { itemId: POTION })

    tick(world, { primary: true })
    const steps = Math.ceil(CONSUME.duration / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('remove uma unidade do item do inventário ao usar, e desequipa (estoque zerou)', () => {
    const { world, player } = spawnWorld()
    hurt(player)
    player.set(HeldItem, { itemId: POTION })
    player.set(Inventory, { counts: { [POTION]: 1 } })

    tick(world, { primary: true })
    const ticksUntilEffect = Math.ceil(CONSUME.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilEffect; i++) tick(world, {})

    expect(player.get(Inventory).counts).toEqual({})
    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('spawna um ConsumeEffect no instante de efeito, na posição do jogador', () => {
    const { world, player } = spawnWorld()
    hurt(player)
    player.set(HeldItem, { itemId: POTION })

    tick(world, { primary: true })
    const ticksUntilEffect = Math.ceil(CONSUME.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilEffect - 1; i++) {
      tick(world, {})
      expect(world.query(ConsumeEffect).length).toBe(0)
    }

    tick(world, {}) // cruza o instante de efeito
    expect(world.query(ConsumeEffect).length).toBe(1)
  })

  it('tendo mais de uma unidade, usar consome só uma (a pilha continua) e não desequipa', () => {
    const { world, player } = spawnWorld()
    hurt(player)
    player.set(HeldItem, { itemId: POTION })
    player.set(Inventory, { counts: { [POTION]: 2 } })

    tick(world, { primary: true })
    const ticksUntilEffect = Math.ceil(CONSUME.effectAt / (1 / 60))
    for (let i = 0; i < ticksUntilEffect; i++) tick(world, {})

    expect(player.get(Inventory).counts).toEqual({ [POTION]: 1 })
    expect(player.get(HeldItem).itemId).toBe(POTION)
  })
})

describe('playerActionSystem — itens da beta (042)', () => {
  it('poção com a vida cheia não é usada nem gasta', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: POTION })
    player.set(Inventory, { counts: { [POTION]: 1 } })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(player.get(Inventory).counts).toEqual({ [POTION]: 1 })
  })

  it('fruta na mão: começa a comer e gasta a unidade na hora', () => {
    const { world, player } = spawnWorld()
    hurt(player)
    player.set(HeldItem, { itemId: BERRY.id })
    player.set(Inventory, { counts: { [BERRY.id]: 2 } })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe('eat')
    expect(player.get(Eating).itemId).toBe(BERRY.id)
    expect(player.get(Inventory).counts).toEqual({ [BERRY.id]: 1 })
    expect(player.get(HeldItem).itemId).toBe(BERRY.id)
  })

  it('fruta com a vida cheia não começa a comer', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: BERRY.id })
    player.set(Inventory, { counts: { [BERRY.id]: 1 } })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(player.has(Eating)).toBe(false)
  })

  it('comendo, clicar de novo não começa outra fruta nem gasta', () => {
    const { world, player } = spawnWorld()
    hurt(player)
    player.set(HeldItem, { itemId: BERRY.id })
    player.set(Inventory, { counts: { [BERRY.id]: 2 } })

    tick(world, { primary: true })
    tick(world, { primary: true })

    expect(player.get(Inventory).counts).toEqual({ [BERRY.id]: 1 })
  })

  it('comendo, o dash não dispara', () => {
    const { world, player } = spawnWorld()
    player.add(Grounded)
    hurt(player)
    player.set(HeldItem, { itemId: BERRY.id })
    player.set(Inventory, { counts: { [BERRY.id]: 1 } })

    tick(world, { primary: true })
    tick(world, { dash: true })

    expect(player.get(ActionState).current).toBe('eat')
  })

  it('Pokébola na mão não faz nada', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: POKEBALL })
    player.set(Inventory, { counts: { [POKEBALL]: 1 } })

    tick(world, { primary: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(world.query(Projectile).length).toBe(0)
    expect(player.get(Inventory).counts).toEqual({ [POKEBALL]: 1 })
  })
})
