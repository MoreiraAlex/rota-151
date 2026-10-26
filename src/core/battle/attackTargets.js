import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/colliders'
import { getPlayerSpecies, getSpecies } from '../data/species'
import { isAreaAttack, isCircleAttack } from './channelAttack'
import {
  closestPointsOnGroundPlane,
  isWithinCombatHeight,
  isWithinFlyingTargetHeight,
  resolveAttackCone,
  resolveCircleRadius,
  resolveContactPoint,
  resolveFootElevation,
  resolveGroundY,
  resolveTriggerEntry,
} from './attackGeometry'
import {
  CONTACT_EPSILON,
  isTriggerInsideCircle,
  isTriggerInsideCone,
  resolveCapsuleAreaEnd,
  resolveHitTrigger,
  resolveTriggerEdge,
  resolveTriggerSegment,
} from './hitTrigger'
import {
  BeingCaptured,
  CharacterController,
  Fainted,
  Flying,
  IndividualValues,
  Party,
  Position,
  Rotation,
  SummonedCreature,
  Vitals,
  WildCreature,
  resolveCreatureSpeciesId,
  resolveEntityLevel,
} from '../traits'

/**
 * Percorre quem pode ser atingido, por lado: `'wild'` = selvagens (alvo
 * do golpe das criaturas do time); `'player'` = lado do jogador —
 * criaturas do time e o treinador (quem tem `Party`), alvo do golpe das
 * selvagens. Nunca o próprio lado: sem fogo amigo.
 */
function forEachTargetCandidate(world, targetSide, visit) {
  const sides =
    targetSide === 'wild' ? [WildCreature] : [SummonedCreature, Party]
  for (const side of sides) {
    world
      // O lado por último: `Party` é tag (sem dados) e não entra no array
      // do `readEach` — no fim, não desalinha os outros.
      .query(Position, Rotation, CharacterController, Vitals, side)
      .readEach(([pos, rot, controller, vitals], entity) => {
        // Dentro de uma Pokébola ninguém acerta (docs/features/043-captura.md).
        if (entity.has(BeingCaptured)) return
        visit(entity, pos, rot, controller, vitals)
      })
  }
}

/**
 * O trigger de acerto de quem luta, no mundo (`hitTrigger.js`) — a cápsula
 * que o golpe precisa tocar.
 */
export function resolveEntityTriggerSegment(entity, pos, rot) {
  const trigger = resolveHitTrigger(resolveCombatantSpecies(entity)?.body)
  return resolveTriggerSegment(pos, rot?.y ?? 0, trigger)
}

/** O trigger de acerto de quem luta, sem posição (só as medidas). */
export function resolveEntityHitTrigger(entity) {
  return resolveHitTrigger(resolveCombatantSpecies(entity)?.body)
}

/**
 * A borda do trigger de quem ataca na `direction` do golpe
 * (`resolveTriggerEdge`) — de onde o `range` dele conta.
 */
export function resolveEntityTriggerEdge(entity, direction) {
  return resolveTriggerEdge(
    resolveEntityHitTrigger(entity),
    entity.get(Rotation)?.y ?? 0,
    direction,
  )
}

/** Espécie de quem luta: a da criatura, ou a do treinador. */
export function resolveCombatantSpecies(entity) {
  const speciesId = resolveCreatureSpeciesId(entity)
  return speciesId ? getSpecies(speciesId) : getPlayerSpecies()
}

/**
 * Quanto a origem do golpe fica acima do chão embaixo dela — a altura que a
 * trajetória mantém sobre o terreno (`resolveAttackImpactPoint`). `null` sem
 * chão (ou sem física).
 */
function resolveOriginHeight(origin) {
  const ground = resolveGroundY(
    origin.x,
    origin.y,
    origin.z,
    GAME_CONFIG.BATTLE.GROUND_PROBE_DISTANCE,
  )
  return ground === null ? null : origin.y - ground
}

/**
 * Altura do contato com um alvo NO CHÃO: o chão dele + a altura que o golpe
 * mantém sobre o terreno (`originHeight`) — numa rampa, o golpe chega no alvo
 * lá em cima, na diagonal, e não na altura de quem atacou. Sem chão na
 * origem, `fallbackY`.
 */
function resolveGroundedContactY(pos, controller, originHeight, fallbackY) {
  if (originHeight === null) return fallbackY
  const ground =
    pos.y -
    verticalClearance(controller) -
    resolveFootElevation(pos, controller)
  return ground + originHeight
}

/**
 * Onde o golpe encosta no trigger, na altura da trajetória (`pathY`): se ela
 * atravessa o trigger, o ponto em que ENTRA nele (a frente do alvo, virada
 * pra quem ataca — não o eixo dele); se só a área encosta de lado, o ponto da
 * borda do trigger na direção da trajetória.
 */
function resolveTriggerContact(origin, areaEnd, trigger, closest, pathY) {
  const entry = resolveTriggerEntry(
    origin,
    areaEnd,
    trigger.a,
    trigger.b,
    trigger.radius,
    closest.s,
  )
  if (entry !== null) {
    return {
      x: origin.x + (areaEnd.x - origin.x) * entry,
      y: pathY,
      z: origin.z + (areaEnd.z - origin.z) * entry,
    }
  }
  return resolveContactPoint(
    { ...closest.pointOnSecond, y: pathY },
    { ...closest.pointOnFirst, y: pathY },
    trigger.radius,
  )
}

/**
 * Detecção de acerto ao longo da TRAJETÓRIA inteira do golpe (pedido do
 * usuário: "trajetória inteira"), não só na esfera da ponta — a área
 * efetiva vai de `origin` até `impactPoint` com raio `radius`.
 *
 * **Combate 2.5D**: dois testes separados.
 * 1. Mesmo plano de combate — elevação dos pés de cada um relativa ao
 *    próprio terreno (`resolveFootElevation`), diferença até
 *    `MAX_COMBAT_HEIGHT_DIFF` (`isWithinCombatHeight`). Rampa, degrau ou
 *    terraço não importam; só quem está no ar (pulo) sai do plano. Quem
 *    VOA (`Flying`) não tem plano: vale a altura da trajetória cruzando o
 *    corpo dele (`isWithinFlyingTargetHeight`, com o raio do golpe).
 * 2. Alcance no plano HORIZONTAL — a área do golpe (cápsula de raio
 *    `radius` com a PONTA no fim da trajetória: o `range` é a distância
 *    máxima, `resolveCapsuleAreaEnd`) toca o TRIGGER do alvo (`hitTrigger.js`,
 *    `body.trigger` da espécie — sem ele, a cápsula da física), com Y zerado
 *    (`closestPointsOnGroundPlane`). O trigger gira com `Rotation.y`.
 *
 * Paredes e desníveis já cortaram a trajetória antes daqui
 * (`resolveAttackImpactPoint`) — alvo atrás deles fica fora do alcance.
 *
 * **Um alvo por golpe**: o PRIMEIRO ao longo da trajetória (menor `s`,
 * mais perto da origem); empate desempata pela menor distância. Acertar
 * todos no caminho seria mudança de gameplay à parte.
 *
 * **Só `WildCreature` é alvo** (decisão consciente): hoje só a criatura
 * controlada pelo jogador ataca, sem PvP nem conceito de time/dono no
 * ECS — `SummonedCreature` nunca é candidata, sem fogo amigo.
 *
 * Retorna também `contactPoint` (superfície da cápsula do alvo, na
 * direção da trajetória) — onde VFX/reação de acerto devem nascer.
 */
export function resolveAttackTarget(
  world,
  origin,
  impactPoint,
  radius,
  attackerElevation,
  targetSide,
) {
  let best = null
  const areaEnd = resolveCapsuleAreaEnd(origin, impactPoint, radius)
  const originHeight = resolveOriginHeight(origin)

  forEachTargetCandidate(
    world,
    targetSide,
    (entity, pos, rot, controller, vitals) => {
      // Sem HP ou desmaiada (`Fainted`): não é mais alvo.
      if (vitals.hp <= 0 || entity.has(Fainted)) return
      const flying = entity.has(Flying)
      if (
        !flying &&
        !isWithinCombatHeight(
          attackerElevation,
          resolveFootElevation(pos, controller),
        )
      )
        return

      const trigger = resolveEntityTriggerSegment(entity, pos, rot)
      const closest = closestPointsOnGroundPlane(
        origin,
        areaEnd,
        trigger.a,
        trigger.b,
      )
      if (closest.distance > radius + trigger.radius + CONTACT_EPSILON) return
      // Contato na altura da trajetória naquele ponto (não no Y zerado da
      // conta no plano) — é onde um VFX de acerto deve nascer.
      const pathY = origin.y + (areaEnd.y - origin.y) * closest.s
      if (flying && !isWithinFlyingTargetHeight(pathY, pos, controller, radius))
        return

      const isEarlier =
        !best ||
        closest.s < best.s ||
        (closest.s === best.s && closest.distance < best.distance)
      if (!isEarlier) return
      const species = resolveCombatantSpecies(entity)
      best = {
        s: closest.s,
        distance: closest.distance,
        entity,
        species,
        level: resolveEntityLevel(entity, species),
        vitals,
        individualValues: entity.has(IndividualValues)
          ? entity.get(IndividualValues)
          : null,
        contactPoint: resolveTriggerContact(
          origin,
          areaEnd,
          trigger,
          closest,
          flying
            ? pathY
            : resolveGroundedContactY(pos, controller, originHeight, pathY),
        ),
      }
    },
  )

  if (!best) return null
  const { entity, species, level, vitals, individualValues, contactPoint } =
    best
  return { entity, species, level, vitals, individualValues, contactPoint }
}

/**
 * Onde o cone encosta num alvo: a borda do trigger virada pra origem do golpe
 * (a frente dele, não o centro), na altura `y`.
 */
function resolveConeContact(origin, trigger, y) {
  const closest = closestPointsOnGroundPlane(
    origin,
    origin,
    trigger.a,
    trigger.b,
  )
  const contact = resolveContactPoint(
    { ...closest.pointOnSecond, y: origin.y },
    origin,
    trigger.radius,
  )
  return { ...contact, y }
}

/**
 * Todos os alvos dentro do CONE de um golpe (`area: 'cone'`) — mesmo leque
 * do indicador (`isInsideAttackCone`), mesmos filtros do golpe normal (lado
 * certo, com HP, não desmaiado, mesmo plano de combate 2.5D). No golpe único
 * e a cada tick do canal.
 */
export function resolveConeTargets(
  world,
  origin,
  direction,
  cone,
  attackerElevation,
  targetSide,
) {
  return collectAreaTargets(
    world,
    origin,
    attackerElevation,
    targetSide,
    (segment) => isTriggerInsideCone(origin, direction, cone, segment),
  )
}

/**
 * Todos os alvos dentro do CÍRCULO de um golpe (`area: 'circle'`): centro
 * `center` (o corpo de quem ataca), raio `radius` (`resolveCircleRadius`),
 * mesmos filtros do cone. O contato é a borda do trigger virada pro centro.
 */
export function resolveCircleTargets(
  world,
  center,
  radius,
  attackerElevation,
  targetSide,
) {
  return collectAreaTargets(
    world,
    center,
    attackerElevation,
    targetSide,
    (segment) => isTriggerInsideCircle(center, radius, segment),
  )
}

/**
 * Os alvos da ÁREA do golpe (cone ou círculo, `isAreaAttack`): `areaStart`
 * (o ápice do cone, ou o centro do círculo — `resolveAttackAreaStart`), a
 * direção, o fim da trajetória (`impactPoint`, o comprimento do cone) e a
 * borda do trigger de quem ataca (`edge`, o raio do círculo conta dela).
 */
export function resolveAreaTargets(world, attack, context) {
  const {
    areaStart,
    direction,
    impactPoint,
    edge,
    attackerElevation,
    targetSide,
  } = context
  if (isCircleAttack(attack)) {
    return resolveCircleTargets(
      world,
      areaStart,
      resolveCircleRadius(attack, edge),
      attackerElevation,
      targetSide,
    )
  }
  return resolveConeTargets(
    world,
    areaStart,
    direction,
    resolveAttackCone(attack, areaStart, impactPoint),
    attackerElevation,
    targetSide,
  )
}

// O laço comum das áreas: cada candidato que passa nos filtros e cujo trigger
// toca a área (`isInside(segment)`), com o contato visto de `origin`.
function collectAreaTargets(
  world,
  origin,
  attackerElevation,
  targetSide,
  isInside,
) {
  const targets = []
  const originHeight = resolveOriginHeight(origin)
  forEachTargetCandidate(
    world,
    targetSide,
    (entity, pos, rot, controller, vitals) => {
      if (vitals.hp <= 0 || entity.has(Fainted)) return
      if (entity.has(Flying)) {
        if (
          !isWithinFlyingTargetHeight(
            origin.y,
            pos,
            controller,
            GAME_CONFIG.BATTLE.MAX_COMBAT_HEIGHT_DIFF,
          )
        )
          return
      } else {
        const elevation = resolveFootElevation(pos, controller)
        if (!isWithinCombatHeight(attackerElevation, elevation)) return
      }
      const segment = resolveEntityTriggerSegment(entity, pos, rot)
      if (!isInside(segment)) return

      const species = resolveCombatantSpecies(entity)
      const contactY = entity.has(Flying)
        ? origin.y
        : resolveGroundedContactY(pos, controller, originHeight, origin.y)
      targets.push({
        entity,
        species,
        level: resolveEntityLevel(entity, species),
        vitals,
        individualValues: entity.has(IndividualValues)
          ? entity.get(IndividualValues)
          : null,
        contactPoint: resolveConeContact(origin, segment, contactY),
      })
    },
  )
  return targets
}

/**
 * Quem um golpe SÓ de efeito (sem dano — ex.: Growl) atinge no `effectAt`:
 * num golpe de área (cone ou círculo), TODOS os inimigos dentro dela
 * (`resolveAreaTargets`, a mesma forma e os mesmos filtros do canalizado — só
 * estrutura/terreno encurta o cone, criatura no caminho não); senão, o
 * primeiro corpo no caminho (`resolveAttackTarget`). Lista vazia = errou.
 * A área vai de `areaStart` (a borda do trigger de quem ataca,
 * `resolveAttackAreaStart`) até `impactPoint` (o fim da trajetória).
 */
export function resolveEffectTargets(world, context) {
  const { attack, areaStart, impactPoint, pos, controller } = context
  const attackerElevation = resolveFootElevation(pos, controller)
  if (isAreaAttack(attack)) {
    return resolveAreaTargets(world, attack, { ...context, attackerElevation })
  }

  const target = resolveAttackTarget(
    world,
    areaStart,
    impactPoint,
    attack.radius,
    attackerElevation,
    context.targetSide,
  )
  return target ? [target] : []
}
