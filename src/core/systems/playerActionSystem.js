import { GAME_CONFIG } from '../gameConfig'
import { getItem } from '../data/items'
import {
  ActionState,
  Position,
  Rotation,
  Velocity,
  Vitals,
  HeldItem,
  Grounded,
  InputControlled,
  Projectile,
  applyHeal,
} from '../traits'

const DASH = GAME_CONFIG.PLAYER_ACTIONS.dash
const THROW = GAME_CONFIG.PLAYER_ACTIONS.throw
const CONSUME = GAME_CONFIG.PLAYER_ACTIONS.consume
const { STAMINA_REGEN_DELAY_AFTER_USE } = GAME_CONFIG.VITALS

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
          heldItem.itemId = null
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
          heldItem.itemId = null
        }

        if (action.elapsed >= CONSUME.DURATION) {
          action.current = null
        }
      }
    })
}
