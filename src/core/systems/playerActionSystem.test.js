import { describe, it, expect, afterEach } from 'vitest'
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
  AimAnchor,
  Grounded,
} from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem } from '@/core/data/items'
import { computeAimRay } from '@/core/camera/orbitCamera'
import { playerActionSystem } from './playerActionSystem'

const { DURATION, SPEED, STAMINA_COST } = GAME_CONFIG.PLAYER_ACTIONS.dash
const THROW = GAME_CONFIG.PLAYER_ACTIONS.throw
const CONSUME = GAME_CONFIG.PLAYER_ACTIONS.consume

function tick(world, input = {}, delta = 1 / 60) {
  playerActionSystem({ world, delta, input })
}

// Reproduz `resolveHandOrigin` (playerActionSystem.js, não exportada) pra
// validar a fiação — mesmo padrão já usado aqui pra `resolveThrowLaunch`.
function resolveHandOrigin(pos, rotY) {
  const { HAND_FORWARD_OFFSET, HAND_SIDE_OFFSET, HAND_HEIGHT_OFFSET } = THROW
  const forwardX = Math.sin(rotY)
  const forwardZ = Math.cos(rotY)
  const rightX = Math.cos(rotY)
  const rightZ = -Math.sin(rotY)

  return {
    x: pos.x + forwardX * HAND_FORWARD_OFFSET + rightX * HAND_SIDE_OFFSET,
    y: pos.y + HAND_HEIGHT_OFFSET,
    z: pos.z + forwardZ * HAND_FORWARD_OFFSET + rightZ * HAND_SIDE_OFFSET,
  }
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

describe('playerActionSystem — arremesso (item throwable)', () => {
  it('reduzir o estoque dispara notificação de mudança em Inventory (reatividade do useTrait)', () => {
    // Regressão: consumir via mutação direta (`.splice()`) num valor lido
    // pela query mudava o dado real, mas nunca disparava `world.onChange` —
    // a UI (PartyHud/InventoryPanel/EquipmentPanel, via useTrait) só
    // atualizava quando outra coisa forçava um re-render (trocar de tela).
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Inventory, { itemIds: ['pebble', 'pebble'] })

    let changed = false
    world.onChange(Inventory, (entity) => {
      if (entity === player) changed = true
    })

    tick(world, { primary: true, aiming: true })
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(changed).toBe(true)
    expect(player.get(Inventory).itemIds).toEqual(['pebble'])
  })

  it('não dispara sem item em mãos', () => {
    const { world, player } = spawnWorld()

    tick(world, { primary: true, aiming: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara com item throwable equipado E mirando, trava a velocidade de lançamento (reta até o ponto de mira, sem arco) no instante do disparo, e vira o corpo pra encarar o arremesso', () => {
    const { world, player, camera } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Rotation, { y: Math.PI / 2 }) // deve ser sobrescrito
    camera.set(OrbitCamera, { yaw: Math.PI / 3, pitch: 0.4, distance: 8 })

    tick(world, { primary: true, aiming: true })

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
    const { origin, direction } = computeAimRay(pos, orbit)
    const { AIM_RANGE, SPEED } = THROW
    const aimPoint = {
      x: origin.x + direction.x * AIM_RANGE,
      y: origin.y + direction.y * AIM_RANGE,
      z: origin.z + direction.z * AIM_RANGE,
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

  it('sem segurar o botão direito (mirar), clicar não dispara nada — botão esquerdo só funciona enquanto o direito está ativo', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })

    tick(world, { primary: true, aiming: false })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('desconta o custo de stamina do arremesso uma única vez, no disparo, e reseta o delay de regeneração', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })

    tick(world, { primary: true, aiming: true })
    expect(player.get(Vitals).stamina).toBeCloseTo(100 - THROW.STAMINA_COST)
    expect(player.get(Vitals).staminaRegenDelay).toBeCloseTo(
      GAME_CONFIG.VITALS.STAMINA_REGEN_DELAY_AFTER_USE,
    )

    // continuar no meio do arremesso não desconta de novo
    tick(world, {})
    expect(player.get(Vitals).stamina).toBeCloseTo(100 - THROW.STAMINA_COST)
  })

  it('sem stamina suficiente, o arremesso não dispara', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Vitals, { stamina: THROW.STAMINA_COST - 1 })

    tick(world, { primary: true, aiming: true })

    expect(player.get(ActionState).current).toBe(null)
    expect(player.get(Vitals).stamina).toBe(THROW.STAMINA_COST - 1) // não descontou
  })

  it('mudar AIM_RANGE muda de verdade a direção resolvida do arremesso — não fica preso a um alcance fixo', () => {
    const { world, player, camera } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0.3, distance: 10 })
    const originalRange = GAME_CONFIG.PLAYER_ACTIONS.throw.AIM_RANGE

    try {
      GAME_CONFIG.PLAYER_ACTIONS.throw.AIM_RANGE = 5
      tick(world, { primary: true, aiming: true })
      const shortRangeAction = { ...player.get(ActionState) }

      for (let i = 0; i < Math.ceil(THROW.DURATION / (1 / 60)) + 1; i++) {
        tick(world, {})
      }
      player.set(HeldItem, { itemId: 'pebble' })

      GAME_CONFIG.PLAYER_ACTIONS.throw.AIM_RANGE = 300
      tick(world, { primary: true, aiming: true })
      const longRangeAction = player.get(ActionState)

      // Módulo sempre SPEED (reto, sem arco) nos dois casos...
      expect(
        Math.hypot(
          shortRangeAction.dirX,
          shortRangeAction.dirY,
          shortRangeAction.dirZ,
        ),
      ).toBeCloseTo(THROW.SPEED)
      expect(
        Math.hypot(
          longRangeAction.dirX,
          longRangeAction.dirY,
          longRangeAction.dirZ,
        ),
      ).toBeCloseTo(THROW.SPEED)
      // ...mas a direção em si muda — alcance curto mira num ponto mais
      // perto do jogador (mais paralaxe), alcance longo converge quase
      // paralelo à câmera.
      expect(longRangeAction.dirY).not.toBeCloseTo(shortRangeAction.dirY, 2)
    } finally {
      GAME_CONFIG.PLAYER_ACTIONS.throw.AIM_RANGE = originalRange
    }
  })

  it('com AimAnchor travado, o arremesso mira direto no ponto travado — ignora a câmera/AIM_RANGE atuais', () => {
    const { world, player, camera } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    // Câmera/AIM_RANGE deliberadamente "erradas" — se o disparo as
    // usasse, a direção resolvida não bateria com o ponto travado abaixo.
    camera.set(OrbitCamera, { yaw: 1.9, pitch: -0.3, distance: 25 })
    player.set(AimAnchor, { active: true, x: 3, y: 2, z: -4 })

    tick(world, { primary: true, aiming: true })

    const pos = player.get(Position)
    const throwOrigin = resolveHandOrigin(pos, 0) // Rotation.y default (não setada aqui)
    const dx = 3 - throwOrigin.x
    const dy = 2 - throwOrigin.y
    const dz = -4 - throwOrigin.z
    const distance = Math.hypot(dx, dy, dz)

    const action = player.get(ActionState)
    expect(action.dirX).toBeCloseTo((dx / distance) * THROW.SPEED)
    expect(action.dirY).toBeCloseTo((dy / distance) * THROW.SPEED)
    expect(action.dirZ).toBeCloseTo((dz / distance) * THROW.SPEED)
  })

  it('só spawna o projétil ao cruzar o instante de liberação, uma vez só', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Rotation, { y: 0 })

    tick(world, { primary: true, aiming: true })

    // Tickar até bem depois do fim da ação, contando transições de "sem
    // projétil" pra "com projétil" — em vez de calcular o tick exato de
    // cruzamento na mão (frágil: soma repetida de 1/60 acumula erro de
    // ponto flutuante, então o mesmo cálculo pode "sortear" um tick a mais
    // ou a menos dependendo do valor exato de EFFECT_AT, sem relação
    // nenhuma com o comportamento de verdade sendo testado).
    let sawEmpty = false
    let spawnCount = 0
    const totalTicks = Math.ceil(THROW.DURATION / (1 / 60)) + 5
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
    player.set(HeldItem, { itemId: 'pebble' })

    tick(world, { primary: true, aiming: true })
    const action = { ...player.get(ActionState) }
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
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
    expect(Math.hypot(vel.x, vel.y, vel.z)).toBeCloseTo(THROW.SPEED)
    // lifetime é sempre THROW.LIFETIME direto da config — sem cálculo
    // dinâmico (revisado: o lifetime conta desde o lançamento, não desde
    // o impacto, e não deve variar com a distância até o ponto de mira).
    expect(projectileEntity.get(Projectile).lifetime).toBeCloseTo(
      THROW.LIFETIME,
    )
  })

  it('encerra sozinho depois da duração e devolve o controle', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })

    tick(world, { primary: true, aiming: true })
    const steps = Math.ceil(THROW.DURATION / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('remove uma unidade do item do inventário ao arremessar, e desequipa (estoque zerou)', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Inventory, { itemIds: ['pebble'] })

    tick(world, { primary: true, aiming: true })
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(Inventory).itemIds).toEqual([])
    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('tendo mais de uma unidade, arremessar consome só uma (a pilha continua) e não desequipa', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Inventory, { itemIds: ['pebble', 'pebble'] })

    tick(world, { primary: true, aiming: true })
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(Inventory).itemIds).toEqual(['pebble'])
    expect(player.get(HeldItem).itemId).toBe('pebble')
  })

  it('com estoque restante, dá pra arremessar de novo sem reequipar', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'pebble' })
    player.set(Inventory, { itemIds: ['pebble', 'pebble'] })

    tick(world, { primary: true, aiming: true })
    const ticksUntilRelease = Math.ceil(THROW.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})
    const remainingTicks = Math.ceil(
      (THROW.DURATION - THROW.EFFECT_AT) / (1 / 60),
    )
    for (let i = 0; i < remainingTicks + 1; i++) tick(world, {})

    // segundo arremesso, sem reequipar — a mão já continuava com o item
    tick(world, { primary: true, aiming: true })
    for (let i = 0; i < ticksUntilRelease; i++) tick(world, {})

    expect(player.get(Inventory).itemIds).toEqual([])
    expect(player.get(HeldItem).itemId).toBe(null)
    expect(world.query(Projectile).length).toBe(2)
  })
})

describe('playerActionSystem — uso (item consumable)', () => {
  it('não dispara sem item em mãos', () => {
    const { world, player } = spawnWorld()

    tick(world, { primary: true, aiming: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara com item consumable equipado', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true, aiming: true })

    expect(player.get(ActionState).current).toBe('consume')
  })

  it('cura no instante de efeito, uma vez só', () => {
    const { world, player } = spawnWorld()
    player.set(Vitals, { hp: 50, maxHp: 100 })
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true, aiming: true })

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

  it('encerra sozinho depois da duração e devolve o controle', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true, aiming: true })
    const steps = Math.ceil(CONSUME.DURATION / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('remove uma unidade do item do inventário ao usar, e desequipa (estoque zerou)', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })
    player.set(Inventory, { itemIds: ['potion'] })

    tick(world, { primary: true, aiming: true })
    const ticksUntilEffect = Math.ceil(CONSUME.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilEffect; i++) tick(world, {})

    expect(player.get(Inventory).itemIds).toEqual([])
    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('spawna um ConsumeEffect no instante de efeito, na posição do jogador', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })

    tick(world, { primary: true, aiming: true })
    const ticksUntilEffect = Math.ceil(CONSUME.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilEffect - 1; i++) {
      tick(world, {})
      expect(world.query(ConsumeEffect).length).toBe(0)
    }

    tick(world, {}) // cruza o instante de efeito
    expect(world.query(ConsumeEffect).length).toBe(1)
  })

  it('tendo mais de uma unidade, usar consome só uma (a pilha continua) e não desequipa', () => {
    const { world, player } = spawnWorld()
    player.set(HeldItem, { itemId: 'potion' })
    player.set(Inventory, { itemIds: ['potion', 'potion'] })

    tick(world, { primary: true, aiming: true })
    const ticksUntilEffect = Math.ceil(CONSUME.EFFECT_AT / (1 / 60))
    for (let i = 0; i < ticksUntilEffect; i++) tick(world, {})

    expect(player.get(Inventory).itemIds).toEqual(['potion'])
    expect(player.get(HeldItem).itemId).toBe('potion')
  })
})
