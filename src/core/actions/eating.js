import { GAME_CONFIG } from '../gameConfig'
import { PLAYER_SPECIES_ID, getSpecies } from '../data/species'
import { cosmeticRng } from '../rng'
import { verticalClearance } from '../physics/colliders'
import {
  ActionState,
  CharacterController,
  DroppedFood,
  Eating,
  Fainted,
  Party,
  Position,
  Rotation,
  Velocity,
  Vitals,
  resolveCreatureSpeciesId,
} from '../traits'

/**
 * Comer uma fruta (docs/features/042-itens-da-beta.md) — o treinador (fruta
 * da mão) ou a criatura invocada (pelo menu de ações). Quem come fica na
 * ação `'eat'` (`ActionState`) pela `berry.duration` e cura aos poucos
 * (`eatingSystem`). Enquanto come, não faz mais nada: quem iniciaria outra
 * ação já respeita `ActionState.current !== null`, o pulo e a troca de
 * controle olham `isEating`.
 *
 * Só o que vem de fora interrompe — dano e desmaio — e, do lado de quem
 * come, invocar/recolher. Interromper derruba a comida no chão
 * (`derrubarComida`) e o resto da cura se perde.
 *
 * As actions que mexem no `ActionState` recebem o objeto opcionalmente
 * (`action`), pra quem chama de dentro de um `updateEach` que já itera
 * `ActionState` (um `entity.set` ali seria sobrescrito no fim da iteração).
 * Sem ele, leem e gravam sozinhas.
 */

/** Quanto da fruta já foi comido (0–1), pelo que já curou do total. */
export function resolveEatenFraction(eating) {
  if (!eating || !(eating.healTotal > 0)) return 0
  return Math.min(1, eating.healed / eating.healTotal)
}

/** Quem come está comendo agora? */
export function isEating(entity) {
  return entity?.get?.(ActionState)?.current === 'eat'
}

/**
 * `entity` pode começar a comer agora: livre (sem ação), não desmaiada e com
 * a vida abaixo do máximo (fruta com a vida cheia seria gasta à toa).
 */
export function podeComer(entity, action = entity?.get?.(ActionState)) {
  if (!entity || entity.has(Eating)) return false
  if (!action || action.current !== null) return false
  if (entity.has(Fainted)) return false
  const vitals = entity.get(Vitals)
  return !!vitals && vitals.hp < vitals.maxHp
}

/**
 * Começa a comer a fruta `item` (já gasta por quem chama). Devolve se
 * começou. Ver `podeComer`.
 */
export function comecarAComer(entity, item, action = null) {
  if (!item?.berry) return false
  return withAction(entity, action, (current) => {
    if (!podeComer(entity, current)) return false
    current.current = 'eat'
    current.elapsed = 0
    current.animationSpeed = 1
    current.pendingSlot = null
    entity.add(
      Eating({
        itemId: item.id,
        duration: item.berry.duration,
        healTotal: item.berry.healAmount,
        healed: 0,
      }),
    )
    return true
  })
}

/** Terminou de comer: sai da ação `'eat'` e tira o `Eating`. */
export function terminarDeComer(entity, action = null) {
  if (!entity.has(Eating)) return
  withAction(entity, action, (current) => {
    if (current?.current === 'eat') current.current = null
  })
  entity.remove(Eating)
}

/**
 * Interrompe quem está comendo: a fruta cai (`DroppedFood`, só visual —
 * ninguém pega) e o resto da cura se perde. Ela sai de onde estava — da
 * altura das mãos pra quem leva a comida à boca (`species.vfx.eatFood.
 * hands`), do chão pra quem come do chão — com um impulso pra frente e pra
 * cima, espalhado pelo `cosmeticRng`; o `droppedFoodSystem` faz cair, quicar
 * e rolar (`GAME_CONFIG.ITEMS.DROPPED_FOOD_PHYSICS`). Devolve se havia
 * comida pra derrubar.
 */
export function derrubarComida(world, entity, action = null) {
  if (!entity?.isAlive?.() || !entity.has(Eating)) return false
  const { itemId, healed, healTotal } = entity.get(Eating)
  const pos = entity.get(Position)
  if (pos) {
    const { DROPPED_FOOD_LIFETIME, DROPPED_FOOD_FORWARD_OFFSET } =
      GAME_CONFIG.ITEMS
    const { TOSS_FORWARD, TOSS_UP, TOSS_SPREAD } =
      GAME_CONFIG.ITEMS.DROPPED_FOOD_PHYSICS
    const yaw = entity.get(Rotation)?.y ?? 0
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    // `Position` é o centro da cápsula: o chão fica `verticalClearance` abaixo.
    const body = entity.get(CharacterController)
    const floorY = body ? pos.y - verticalClearance(body) : pos.y
    const side = (cosmeticRng() * 2 - 1) * TOSS_SPREAD
    const forward = TOSS_FORWARD * (0.6 + cosmeticRng() * 0.8)
    world.spawn(
      Position({
        x: pos.x + sin * DROPPED_FOOD_FORWARD_OFFSET,
        y: eatsFromHands(entity) ? pos.y : floorY,
        z: pos.z + cos * DROPPED_FOOD_FORWARD_OFFSET,
      }),
      Rotation({ y: cosmeticRng() * Math.PI * 2 }),
      Velocity({
        x: sin * forward + cos * side,
        y: TOSS_UP * (0.7 + cosmeticRng() * 0.6),
        z: cos * forward - sin * side,
      }),
      DroppedFood({
        itemId,
        lifetime: DROPPED_FOOD_LIFETIME,
        eaten: resolveEatenFraction({ healed, healTotal }),
        floorY,
      }),
    )
  }
  terminarDeComer(entity, action)
  return true
}

/** Quem come leva a comida à boca (`species.vfx.eatFood.hands`)? */
function eatsFromHands(entity) {
  const speciesId =
    resolveCreatureSpeciesId(entity) ??
    (entity.has(Party) ? PLAYER_SPECIES_ID : null)
  return !!getSpecies(speciesId)?.vfx?.eatFood?.hands?.length
}

function withAction(entity, action, mutate) {
  if (action) return mutate(action)
  if (!entity.has(ActionState)) return mutate(null)
  const current = entity.get(ActionState)
  const result = mutate(current)
  entity.set(ActionState, current)
  return result
}
