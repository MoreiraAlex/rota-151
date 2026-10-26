import { registrarParticipante } from '../actions/experience'
import { attackResolved } from '../events'
import { combatWeatherAt } from '../weather/combatWeather'
import {
  Fainted,
  IndividualValues,
  Position,
  Vitals,
  resolveEntityLevel,
} from '../traits'
import { resolveEffectRotation } from './attackEffectPlacement'
import { resolveAttackOrigin } from './attackGeometry'
import {
  damageTarget,
  markAttackPulse,
  spawnImpactEffect,
} from './attackImpact'
import { resolveCombatantSpecies } from './attackTargets'
import { readStatStages } from './statStages'
import { applySecondaryEffects } from './attackStatusEffects'

/**
 * Um acerto SEGUINTE do golpe de vários acertos (`multiHit.js`), no alvo do
 * primeiro: sem sorteio de precisão, com o próprio dano e crítico, o
 * `attackResolved` dele (`hitIndex`), o VFX no contato (que acompanha o
 * alvo) e o som. O efeito secundário (ex.: uma chance de envenenar) sorteia
 * de novo a cada acerto, como na série. Alvo que sumiu, desmaiou ou zerou a
 * vida encerra os acertos.
 * Devolve se acertou.
 */
export function applyExtraHit(world, events, context) {
  const { entity, action, attack, pos, damaged } = context
  const state = action.multiHit
  const target = state.target
  const origin = resolveAttackOrigin(
    pos,
    { x: action.dirX, y: action.dirY, z: action.dirZ },
    attack,
  )
  if (
    !target.isAlive() ||
    target.has(Fainted) ||
    !target.has(Vitals) ||
    target.get(Vitals).hp <= 0
  ) {
    action.multiHit = null
    return false
  }

  const targetPos = target.get(Position)
  const contactPoint = {
    x: targetPos.x + state.offset.x,
    y: targetPos.y + state.offset.y,
    z: targetPos.z + state.offset.z,
  }
  const species = resolveCombatantSpecies(target)
  const descriptor = {
    entity: target,
    species,
    level: resolveEntityLevel(target, species),
    vitals: target.get(Vitals),
    individualValues: target.has(IndividualValues)
      ? target.get(IndividualValues)
      : null,
    contactPoint,
  }
  const { amount, critical, effectiveness, power } = damageTarget(
    attack,
    context,
    descriptor,
    readStatStages(entity),
    combatWeatherAt(world, pos),
    1,
  )
  state.done += 1
  if (effectiveness !== 'immune') {
    damaged?.add(target)
    registrarParticipante(world, entity, target)
    applySecondaryEffects(events, {
      entity,
      attack,
      target: descriptor,
      slot: action.pendingSlot,
    })
  }
  events.emit(
    attackResolved({
      attacker: entity,
      target,
      attackId: attack.id,
      slot: action.pendingSlot,
      origin,
      impactPoint: contactPoint,
      contactPoint,
      damage: amount,
      critical,
      effectiveness,
      hitIndex: state.done - 1,
      hitCount: state.count,
      power,
    }),
  )

  if (attack.visual.effectGroup !== 'none') {
    const direction = { x: action.dirX, y: 0, z: action.dirZ }
    spawnImpactEffect(world, attack, {
      point: contactPoint,
      rotation: resolveEffectRotation(direction, attack.visual.rotationOffset),
      origin,
    })
  }
  markAttackPulse(entity, action, attack)
  if (state.done >= state.count) action.multiHit = null
  return true
}
