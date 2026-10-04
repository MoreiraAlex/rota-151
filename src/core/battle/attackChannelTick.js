import { registrarParticipante } from '../actions/experience'
import { resolveChannelTickDamage } from './calculateDamage'
import { isBeamAttack } from './channelAttack'
import { resolveAttackOrigin, resolveFootElevation } from './attackGeometry'
import { readStatStages } from './statStages'
import { resolveAttackImpactPoint } from './attackTrajectory'
import { resolveAttackTarget, resolveConeTargets } from './attackTargets'
import { resolveEffectRotation } from './attackEffectPlacement'
import { attackResolved } from '../events'
import { gameplayRng } from '../rng'
import {
  AttackEffect,
  Position,
  Rotation,
  Vitals,
  applyDamage,
} from '../traits'

/**
 * Um tick de dano do ataque canalizado: todos os alvos dentro do cone
 * (`resolveConeTargets`, na trajetória de agora — para em parede) levam a
 * FRAÇÃO deste tick do dano de um golpe (`resolveChannelTickDamage` —
 * segurando até o fim, o total é o dano de um golpe; crítico por tick), e
 * cada acerto emite `attackResolved`. Sem alvo, não
 * emite nada (um "errou" por tick seria ruído).
 */
export function applyChannelTick(world, events, context) {
  const { entity, action, species, individualValues, attack } = context
  const origin = resolveAttackOrigin(
    context.pos,
    species?.body?.attackOriginHeight,
  )
  const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
  const beam = isBeamAttack(attack)
  // Cone: só estrutura/terreno encurta o canal — criatura no caminho NÃO (o
  // ember pega todo mundo dentro do leque, inclusive quem está atrás). Feixe:
  // a trajetória do golpe normal, que para no primeiro corpo.
  const impactPoint = resolveAttackImpactPoint(
    origin,
    direction,
    attack.range,
    context.physicsBody.colliderHandle,
    { terrainOnly: !beam },
  )
  const attackerElevation = resolveFootElevation(
    context.pos,
    context.controller,
  )
  let targets
  if (beam) {
    const target = resolveAttackTarget(
      world,
      origin,
      impactPoint,
      attack.radius,
      attackerElevation,
      context.targetSide,
    )
    targets = target ? [target] : []
    spawnChannelHitEffect(
      world,
      attack,
      direction,
      target?.contactPoint ?? impactPoint,
    )
  } else {
    const cone = {
      length: Math.hypot(impactPoint.x - origin.x, impactPoint.z - origin.z),
      range: attack.range,
      radius: attack.radius,
    }
    targets = resolveConeTargets(
      world,
      origin,
      direction,
      cone,
      attackerElevation,
      context.targetSide,
    )
  }
  // Fração deste tick do dano total (sorteada no disparo); o índice avança
  // uma vez por tick, não por alvo — todos os alvos do mesmo instante levam
  // a mesma fração (cada um sobre o PRÓPRIO orçamento, com a própria defesa).
  const weight = action.channelWeights?.[action.channelTick] ?? 0
  action.channelTick += 1
  for (const target of targets) {
    const { amount, critical } = resolveChannelTickDamage({
      attackerSpecies: species,
      attackerIndividualValues: individualValues,
      attackerLevel: context.level,
      defenderSpecies: target.species,
      defenderIndividualValues: target.individualValues,
      defenderLevel: target.level,
      damage: attack.damage,
      attackerStages: readStatStages(entity),
      defenderStages: readStatStages(target.entity),
      weight,
      rng: gameplayRng,
    })
    target.entity.set(
      Vitals,
      applyDamage(target.vitals, amount, target.vitals.hpRegenDelayAfterDamage),
    )
    context.damaged?.add(target.entity)
    registrarParticipante(world, entity, target.entity)
    events.emit(
      attackResolved({
        attacker: entity,
        target: target.entity,
        attackId: attack.id,
        slot: action.pendingSlot,
        origin,
        impactPoint,
        contactPoint: target.contactPoint,
        damage: amount,
        critical,
        channel: true,
      }),
    )
  }
}

/**
 * O visual de cada tick do canalizado em feixe (`visual.channelHitGroup` —
 * ex.: o respingo do Water Gun), onde o feixe bateu AGORA: no corpo atingido
 * ou no fim da trajetória (parede, alcance). Sem o grupo, nada.
 */
function spawnChannelHitEffect(world, attack, direction, point) {
  const group = attack.visual?.channelHitGroup
  if (!group) return
  world.spawn(
    Position({ x: point.x, y: point.y, z: point.z }),
    Rotation(resolveEffectRotation(direction, attack.visual.rotationOffset)),
    AttackEffect({
      lifetime: attack.visual.channelHitVisualDuration ?? 0.5,
      radius: attack.radius,
      effectGroup: group,
      impactType: '',
      visualScale: attack.visual.scale ?? 1,
      length: 0,
    }),
  )
}
