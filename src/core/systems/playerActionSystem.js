import { GAME_CONFIG } from '../gameConfig'
import { getItem } from '../data/items'
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
  applyHeal,
} from '../traits'

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
 * Dash custa stamina, descontada uma vez no disparo — sem stamina
 * suficiente, o dash simplesmente não dispara, mesma forma que a
 * precondição de `Grounded` já bloqueia hoje. Arremesso/uso não custam
 * stamina — quem decide se `primary` dispara algo é a categoria do item em
 * `HeldItem` (`throwable` → arremesso, `consumable` → uso, sem item ou
 * `weapon` → nada).
 *
 * Cada ação com efeito no meio da duração (arremesso spawna o projétil, uso
 * aplica a cura) detecta o instante comparando o `elapsed` antes/depois do
 * `delta` deste tick cruzar `EFFECT_AT` — dispara exatamente uma vez, sem
 * precisar de um campo "já disparei" extra no trait.
 *
 * Headless. Fase: simulation, depois do movementSystem (cuja Rotation.y já
 * reflete a direção do input deste frame — é essa direção que dash/arremesso
 * travam) e antes do characterPhysicsSystem (que resolve a Velocity contra
 * o mundo).
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
    )
    .updateEach(([action, vitals, heldItem, pos, vel, rot], entity) => {
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
        } else if (input.primary) {
          const item = heldItem.itemId ? getItem(heldItem.itemId) : null

          if (item?.category === 'throwable') {
            action.current = 'throw'
            action.elapsed = 0
            action.dirX = Math.sin(rot.y)
            action.dirZ = Math.cos(rot.y)
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
            Position({ x: pos.x, y: pos.y + 1, z: pos.z }),
            Rotation, // exigido por syncTransformSystem — sem uso real (esfera)
            Velocity({
              x: action.dirX * THROW.SPEED,
              y: 0,
              z: action.dirZ * THROW.SPEED,
            }),
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
    })
}
