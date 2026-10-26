import { registrarParticipante } from '../actions/experience'
import { readConditionModifiers } from '../actions/conditions'
import { applySecondaryEffects, applySelfEffects } from './attackStatusEffects'
import { applySpeedPower } from './speedPower'
import {
  applyPowerMultiplier,
  resolveRecentDamageMultiplier,
} from './recentDamageBoost'
import { resolveChannelTickDamage } from './calculateDamage'
import { combatWeatherAt } from '../weather/combatWeather'
import { resolveSkillType } from '../data/types'
import { isBeamAttack } from './channelAttack'
import {
  resolveAttackAreaStart,
  resolveAttackOrigin,
  resolveAttackReach,
  resolveFootElevation,
} from './attackGeometry'
import { readStatStages } from './statStages'
import { resolveAttackImpactPoint } from './attackTrajectory'
import {
  resolveAttackTarget,
  resolveAreaTargets,
  resolveEntityTriggerEdge,
} from './attackTargets'
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
 * A geometria do canal agora, a mesma pro dano e pro visual: origem
 * (`positionOffset`), a borda do trigger (`edge`), alcance (`reach`), fim da trajetória (`impactPoint` — só estrutura e
 * terreno encurtam; criatura no caminho NÃO: o cone pega todo mundo dentro,
 * o feixe o primeiro trigger) e o começo da área (a borda do trigger de
 * quem ataca). `body`: `{ pos, controller, physicsBody }` de quem canaliza.
 */
export function resolveChannelGeometry(entity, body, attack, direction) {
  const { pos, controller, physicsBody } = body
  const origin = resolveAttackOrigin(pos, direction, attack)
  const edge = resolveEntityTriggerEdge(entity, direction)
  const reach = resolveAttackReach(attack, edge)
  const impactPoint = resolveAttackImpactPoint(
    origin,
    direction,
    reach,
    physicsBody.colliderHandle,
    { terrainOnly: true },
  )
  return {
    origin,
    edge,
    reach,
    impactPoint,
    areaStart: resolveAttackAreaStart(
      pos,
      direction,
      edge,
      origin,
      impactPoint,
      attack,
    ),
    attackerElevation: resolveFootElevation(pos, controller),
  }
}

/**
 * O primeiro alvo do FEIXE (canalizado na cápsula) agora, com o
 * `contactPoint` — onde o dano do tick cai e o visual do canal para.
 * `null` sem ninguém na trajetória.
 */
export function resolveBeamTarget(world, geometry, attack, targetSide) {
  return resolveAttackTarget(
    world,
    geometry.areaStart,
    geometry.impactPoint,
    attack.radius,
    geometry.attackerElevation,
    targetSide,
  )
}

/**
 * Um tick de dano do ataque canalizado: todos os alvos dentro da área (cone
 * ou círculo, `resolveAreaTargets`; na trajetória de agora — para em parede) levam a
 * FRAÇÃO deste tick do dano de um golpe (`resolveChannelTickDamage` —
 * segurando até o fim, o total é o dano de um golpe; crítico por tick), e
 * cada acerto emite `attackResolved`. Sem alvo, não
 * emite nada (um "errou" por tick seria ruído). Alvo imune ao tipo do golpe
 * não leva nada (nem conta como participante do XP), mas o tick é emitido
 * com `effectiveness: 'immune'` pro "Não afeta…".
 */
export function applyChannelTick(world, events, context) {
  const { entity, action, species, individualValues, attack } = context
  const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
  const { origin, edge, impactPoint, areaStart, attackerElevation } =
    resolveChannelGeometry(entity, context, attack, direction)
  const beam = isBeamAttack(attack)
  let targets
  if (beam) {
    const target = resolveBeamTarget(
      world,
      { areaStart, impactPoint, attackerElevation },
      attack,
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
    targets = resolveAreaTargets(world, attack, {
      areaStart,
      direction,
      impactPoint,
      edge,
      attackerElevation,
      targetSide: context.targetSide,
    })
    // a área (cone, círculo) pega todo mundo dentro: o visual do tick nasce na
    // frente de cada um
    for (const target of targets) {
      spawnChannelHitEffect(world, attack, direction, target.contactPoint)
    }
  }
  // Fração deste tick do dano total (sorteada no disparo); o índice avança
  // uma vez por tick, não por alvo — todos os alvos do mesmo instante levam
  // a mesma fração (cada um sobre o PRÓPRIO orçamento, com a própria defesa).
  const channelTick = action.channelTick
  // Clima onde está quem ataca (docs/features/048-dia-noite-e-clima.md).
  const weather = combatWeatherAt(world, context.pos)
  const weight = action.channelWeights?.[channelTick] ?? 0
  action.channelTick += 1
  for (const target of targets) {
    // O bônus de quem apanhou há pouco (Assurance) é medido ANTES do primeiro
    // tick em cada alvo — senão o próprio canal contaria — e vale o canal
    // inteiro (`ActionState.channelMultipliers`).
    const multipliers = action.channelMultipliers ?? {}
    if (multipliers[target.entity] === undefined) {
      multipliers[target.entity] = resolveRecentDamageMultiplier(
        attack.damage,
        target.vitals,
      )
      action.channelMultipliers = multipliers
    }
    // e o poder pela Velocidade de cada um (Electro Ball)
    const damage = applySpeedPower(
      applyPowerMultiplier(attack.damage, multipliers[target.entity]),
      { entity, species, individualValues, level: context.level },
      target,
    )
    const { amount, critical, effectiveness } = resolveChannelTickDamage({
      attackerSpecies: species,
      attackerIndividualValues: individualValues,
      attackerLevel: context.level,
      defenderSpecies: target.species,
      defenderIndividualValues: target.individualValues,
      defenderLevel: target.level,
      damage,
      attackType: resolveSkillType(attack),
      attackerStages: readStatStages(entity),
      defenderStages: readStatStages(target.entity),
      attackerModifiers: readConditionModifiers(entity),
      weather,
      weight,
      rng: gameplayRng,
    })
    const immune = effectiveness === 'immune'
    if (!immune) {
      target.entity.set(
        Vitals,
        applyDamage(
          target.vitals,
          amount,
          target.vitals.hpRegenDelayAfterDamage,
        ),
      )
      context.damaged?.add(target.entity)
      registrarParticipante(world, entity, target.entity)
      // efeito secundário (ex.: a chance de queimar): o canal inteiro vale UM
      // golpe, então cada alvo sorteia uma vez só por lançamento — no
      // primeiro tick que acerta ele (`ActionState.channelEffectTargets`)
      if (!action.channelEffectTargets?.includes(target.entity)) {
        // o primeiro alvo pego no lançamento: o que o golpe dá a quem usa
        // (`selfEffects`), uma vez por canal
        if (action.channelEffectTargets?.length === 0) {
          applySelfEffects(events, {
            entity,
            attack,
            slot: action.pendingSlot,
            effects: attack.selfEffects ?? [],
          })
        }
        action.channelEffectTargets?.push(target.entity)
        applySecondaryEffects(events, {
          entity,
          attack,
          target,
          slot: action.pendingSlot,
        })
      }
    }
    events.emit(
      attackResolved({
        attacker: entity,
        target: target.entity,
        attackId: attack.id,
        slot: action.pendingSlot,
        origin,
        impactPoint,
        contactPoint: target.contactPoint,
        damage: immune ? 0 : amount,
        critical,
        channel: true,
        channelTick,
        effectiveness,
        power: damage.power,
      }),
    )
  }
}

/**
 * O visual de cada tick do canalizado (`visual.channelHitGroup`), onde o golpe
 * bateu AGORA: no feixe (o respingo do Water Gun), no corpo atingido ou no fim
 * da trajetória (parede, alcance); no cone (os cortes do Razor Leaf), na
 * frente de cada alvo dentro dele — sem alvo, nada. Sem o grupo, nada. Nasce
 * no ponto (já na altura do terreno ali), virado na direção do golpe.
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
