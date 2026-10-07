import { ganharDominio } from '../actions/moves'
import { resolvePokemonOf } from '../actions/pokemon'
import { MAX_MASTERY } from '../data/species/moves'
import { EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { CombatMode, Position, SummonedCreature, WildCreature } from '../traits'
import { TRAINING_SLOT } from './creatureAttack'

/**
 * Há uma selvagem EM COMBATE perto (`MASTERY.OPPONENT_RADIUS`)? É o que faz
 * um uso contar como "em combate" pro domínio — usar o golpe no vazio, sem
 * luta de verdade, não ensina nada.
 */
export function hasNearbyOpponent(world, pos) {
  const radius = GAME_CONFIG.MOVES.MASTERY.OPPONENT_RADIUS
  let found = false
  world.query(WildCreature, CombatMode, Position).readEach(([, , other]) => {
    if (found) return
    if (Math.hypot(other.x - pos.x, other.z - pos.z) <= radius) found = true
  })
  return found
}

/** O golpe desta entidade acertou alguém neste passo? (`attackResolved`) */
function landedThisStep(events, entity) {
  return (events?.stepEvents?.() ?? []).some(
    (event) =>
      event.type === EVENT_TYPES.ATTACK_RESOLVED &&
      event.attacker === entity &&
      !!event.target &&
      !event.missed &&
      event.effectiveness !== 'immune',
  )
}

/**
 * O instante do golpe de uma criatura do TIME (docs/features/038-
 * aprendizado-treino-e-dominio-de-golpes.md): se é um golpe Q/E/R ainda não
 * dominado, usado em combate (`hasNearbyOpponent`), o domínio sobe
 * (`ganharDominio`; acerto rende mais — golpe em si mesmo que saiu conta
 * como acerto). Básico, treino e selvagem não mexem em nada.
 */
export function registrarUsoDeGolpe(world, events, context) {
  const { entity, attack, slot, pos } = context
  if (!entity.has(SummonedCreature)) return
  if (slot === TRAINING_SLOT || !slot?.startsWith('secondary')) return
  if (attack?.mastery == null || attack.mastery >= MAX_MASTERY) return
  if (!hasNearbyOpponent(world, pos)) return

  const pokemon = resolvePokemonOf(entity)
  if (!pokemon) return

  const hit = attack.area === 'self' || landedThisStep(events, entity)
  ganharDominio(world, pokemon, attack.id, hit)
}
