import { GAME_CONFIG } from '../gameConfig'
import { getItem } from '../data/items'
import { resolveAimPoint } from '../aim'
import {
  ActionState,
  Position,
  Rotation,
  Velocity,
  Vitals,
  HeldItem,
  Inventory,
  Grounded,
  InputControlled,
  Projectile,
  ConsumeEffect,
  PhysicsBody,
  AimAnchor,
  applyHeal,
} from '../traits'

/**
 * Velocidade de lançamento do arremesso: reto na direção de `aimPoint`,
 * módulo fixo em `THROW.SPEED` — sem arco/parábola (o projétil não sofre
 * gravidade em voo, ver `projectileSystem.js`).
 *
 * `aimPoint` já vem resolvido por quem chama — com um `AimAnchor` travado
 * (botão direito segurado, ver `aimAnchorSystem.js`), é o ponto travado
 * (o mesmo que a câmera está mostrando, `cameraFollowSystem.js`); sem
 * ancoragem ativa, é o ponto de mira resolvido na hora
 * (`resolveAimPoint`, que por sua vez respeita `AIM_RANGE`: sem nada no
 * caminho dentro desse alcance, mira no ponto mais distante mesmo, em vez
 * de "infinito").
 */
/**
 * Aproxima a posição da MÃO a partir de `Position`/`Rotation.y` do
 * jogador — usada tanto pra origem da trajetória (`resolveThrowLaunch`,
 * no disparo) quanto pro ponto onde o projétil de fato nasce (na
 * liberação, `EFFECT_AT`). O motor headless não tem acesso ao osso de
 * verdade (isso vive na view, ver `view/systems/heldItemViewSystem.js`,
 * que só cuida do visual do item encaixado no osso — não afeta física nem
 * trajetória) — esta é uma aproximação geométrica: à frente do corpo
 * (`HAND_FORWARD_OFFSET`) e à direita dele (`HAND_SIDE_OFFSET`, mesma
 * convenção de forward/right de `computeCameraRight`/`movementSystem.js`),
 * numa altura fixa (`HAND_HEIGHT_OFFSET`) acima de `Position` (que fica
 * na base/pés do personagem).
 */
function resolveHandOrigin(pos, rotY) {
  const { HAND_FORWARD_OFFSET, HAND_SIDE_OFFSET, HAND_HEIGHT_OFFSET } =
    GAME_CONFIG.PLAYER_ACTIONS.throw
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

function resolveThrowLaunch(aimPoint, throwOrigin) {
  const { SPEED } = GAME_CONFIG.PLAYER_ACTIONS.throw

  const dx = aimPoint.x - throwOrigin.x
  const dy = aimPoint.y - throwOrigin.y
  const dz = aimPoint.z - throwOrigin.z
  const distance = Math.hypot(dx, dy, dz)

  if (distance === 0) {
    return { x: 0, y: 0, z: SPEED }
  }

  return {
    x: (dx / distance) * SPEED,
    y: (dy / distance) * SPEED,
    z: (dz / distance) * SPEED,
  }
}

/**
 * Remove uma unidade de `itemId` do inventário da entidade (se houver) e
 * devolve a nova lista. Lê/escreve via `entity.get`/`entity.set` — **não**
 * por destructuring de uma query que inclua `Inventory` (ver nota abaixo).
 *
 * `Inventory` é AoS (schema função, ver core/traits/components/
 * inventory.js). Fica só com `entity.set()` de propósito, não com mutação
 * direta (`.splice()`) no valor de uma query: se `Inventory` estivesse na
 * query deste system, o próprio `updateEach` reescreve o valor antigo por
 * cima no fim de cada iteração (ele guarda o valor de antes de chamar o
 * callback e o grava de volta pra detectar mudança — pego de surpresa
 * testando isolado: um `entity.set()` no meio do callback, pra um trait que
 * está na mesma query, simplesmente desaparece; sobra o valor de antes). Só
 * funciona de verdade — persiste E dispara a notificação que `useTrait`
 * (`PartyHud`/`InventoryPanel`/`EquipmentPanel`) escuta — quando `Inventory`
 * não é um dos traits da query ativa, por isso não está na `world.query(...)`
 * abaixo mesmo sendo lido/escrito aqui dentro.
 */
function removeOneFromInventory(entity, itemId) {
  const { itemIds } = entity.get(Inventory)
  const index = itemIds.indexOf(itemId)
  const newItemIds =
    index === -1
      ? itemIds
      : [...itemIds.slice(0, index), ...itemIds.slice(index + 1)]
  entity.set(Inventory, { itemIds: newItemIds })
  return newItemIds
}

/**
 * Inicia, avança e encerra ações disparadas por input (dash, arremesso,
 * uso de item) — o mecanismo genérico descrito em
 * docs/features/007-sistema-de-acoes-do-jogador.md, estendido em
 * docs/features/014-arremessar-usar-e-invocar.md.
 *
 * Ao contrário da locomoção (idle/walk/run, resolvida a cada frame a partir
 * de velocidade/grounded), uma ação tem começo e fim: só inicia com um
 * gatilho de borda ("apertou agora", não "está segurando").
 *
 * Dash e arremesso custam stamina, descontada uma vez no disparo — sem
 * stamina suficiente, a ação simplesmente não dispara (mesma forma que a
 * precondição de `Grounded` já bloqueia o dash). Uso de consumível não
 * custa stamina. Quem decide se `primary` dispara algo é a categoria do
 * item em `HeldItem` (`throwable` → arremesso, `consumable` → uso, sem
 * item ou `weapon` → nada). `primary` só é considerado enquanto
 * `input.aiming` também está (botão direito segurado, ver
 * `platform/input/pointerInput.js` e docs/features/016-mira-e-arremesso.md)
 * — clicar sem mirar não faz nada.
 *
 * Cada ação com efeito no meio da duração (arremesso spawna o projétil, uso
 * aplica a cura) detecta o instante comparando o `elapsed` antes/depois do
 * `delta` deste tick cruzar `EFFECT_AT` — dispara exatamente uma vez, sem
 * precisar de um campo "já disparei" extra no trait.
 *
 * Headless. Fase: simulation, depois do movementSystem (cuja Rotation.y já
 * reflete a direção do input deste frame — é essa direção que o dash trava)
 * e antes do characterPhysicsSystem (que resolve a Velocity contra o
 * mundo). O arremesso mira pela câmera, não por `Rotation.y` (ver
 * `resolveThrowLaunch`, acima) — mas escreve em `Rotation.y` no disparo,
 * virando o corpo pra encarar a direção arremessada (ver
 * docs/features/016-mira-e-arremesso.md).
 */
export function playerActionSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}
  // Lido a cada tick (não guardado num const no topo do módulo) pra
  // manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  const DASH = GAME_CONFIG.PLAYER_ACTIONS.dash
  const THROW = GAME_CONFIG.PLAYER_ACTIONS.throw
  const CONSUME = GAME_CONFIG.PLAYER_ACTIONS.consume
  const { STAMINA_REGEN_DELAY_AFTER_USE } = GAME_CONFIG.VITALS

  world
    .query(
      InputControlled,
      ActionState,
      Vitals,
      HeldItem,
      Position,
      Velocity,
      Rotation,
      PhysicsBody,
      AimAnchor,
    )
    .updateEach(
      ([action, vitals, heldItem, pos, vel, rot, body, anchor], entity) => {
        if (action.current === null) {
          const canDash =
            input.dash &&
            entity.has(Grounded) &&
            vitals.stamina >= DASH.STAMINA_COST

          if (canDash) {
            action.current = 'dash'
            action.elapsed = 0
            action.dirX = Math.sin(rot.y)
            action.dirZ = Math.cos(rot.y)
            vitals.stamina -= DASH.STAMINA_COST
            vitals.staminaRegenDelay = STAMINA_REGEN_DELAY_AFTER_USE
          } else if (input.primary && input.aiming) {
            const item = heldItem.itemId ? getItem(heldItem.itemId) : null

            if (
              item?.category === 'throwable' &&
              vitals.stamina >= THROW.STAMINA_COST
            ) {
              action.current = 'throw'
              action.elapsed = 0
              const throwOrigin = resolveHandOrigin(pos, rot.y)
              // Com a mira travada (AimAnchor), o arremesso vai pro mesmo
              // ponto que a câmera já está mostrando — não recalcula via
              // raycast de novo no instante do disparo.
              const aimPoint = anchor.active
                ? { x: anchor.x, y: anchor.y, z: anchor.z }
                : resolveAimPoint(world, pos, body.colliderHandle)
              const velocity = resolveThrowLaunch(aimPoint, throwOrigin)
              action.dirX = velocity.x
              action.dirY = velocity.y
              action.dirZ = velocity.z
              // Encara a direção do arremesso (só o componente horizontal —
              // o corpo não inclina pra cima/baixo, só gira em Y) — antes o
              // corpo continuava olhando pra onde já estava andando, mesmo
              // arremessando pra outro lado.
              rot.y = Math.atan2(velocity.x, velocity.z)
              vitals.stamina -= THROW.STAMINA_COST
              vitals.staminaRegenDelay = STAMINA_REGEN_DELAY_AFTER_USE
            } else if (item?.category === 'consumable') {
              action.current = 'consume'
              action.elapsed = 0
            } else {
              return
            }
          } else {
            return
          }
        }

        const previousElapsed = action.elapsed
        action.elapsed += delta

        if (action.current === 'dash') {
          if (action.elapsed >= DASH.DURATION) {
            action.current = null
            return
          }

          vel.x = action.dirX * DASH.SPEED
          vel.z = action.dirZ * DASH.SPEED
          return
        }

        if (action.current === 'throw') {
          if (
            previousElapsed < THROW.EFFECT_AT &&
            action.elapsed >= THROW.EFFECT_AT
          ) {
            world.spawn(
              Position(resolveHandOrigin(pos, rot.y)),
              Rotation, // exigido por syncTransformSystem — sem uso real (esfera)
              // dirX/dirY/dirZ já são a velocidade de lançamento resolvida
              // no disparo (ver resolveThrowLaunch) — não uma direção
              // unitária pra multiplicar por SPEED aqui (SPEED já entrou no
              // cálculo lá).
              Velocity({ x: action.dirX, y: action.dirY, z: action.dirZ }),
              Projectile({ lifetime: THROW.LIFETIME }),
            )
            const newItemIds = removeOneFromInventory(entity, heldItem.itemId)
            if (!newItemIds.includes(heldItem.itemId)) heldItem.itemId = null
          }

          if (action.elapsed >= THROW.DURATION) {
            action.current = null
          }
          return
        }

        if (action.current === 'consume') {
          if (
            previousElapsed < CONSUME.EFFECT_AT &&
            action.elapsed >= CONSUME.EFFECT_AT
          ) {
            const item = heldItem.itemId ? getItem(heldItem.itemId) : null
            if (item?.consumable) {
              vitals.hp = applyHeal(vitals, item.consumable.healAmount).hp
            }
            world.spawn(
              Position({ x: pos.x, y: pos.y + 1, z: pos.z }),
              Rotation, // exigido por syncTransformSystem — sem uso real (partículas)
              ConsumeEffect({ lifetime: CONSUME.EFFECT_VISUAL_DURATION }),
            )
            const newItemIds = removeOneFromInventory(entity, heldItem.itemId)
            if (!newItemIds.includes(heldItem.itemId)) heldItem.itemId = null
          }

          if (action.elapsed >= CONSUME.DURATION) {
            action.current = null
          }
        }
      },
    )
}
