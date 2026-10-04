import { getPlayerSpecies, getSpecies } from '../data/species'
import { isConeAttack } from './channelAttack'
import {
  closestPointsOnGroundPlane,
  isInsideAttackCone,
  isWithinCombatHeight,
  resolveCapsuleSegment,
  resolveContactPoint,
  resolveFootElevation,
} from './attackGeometry'
import { resolveAttackImpactPoint } from './attackTrajectory'
import {
  CharacterController,
  Fainted,
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
      .query(side, Position, Rotation, CharacterController, Vitals)
      .readEach(([, pos, rot, controller, vitals], entity) =>
        visit(entity, pos, rot, controller, vitals),
      )
  }
}

/** Espécie de quem luta: a da criatura, ou a do treinador. */
function resolveCombatantSpecies(entity) {
  const speciesId = resolveCreatureSpeciesId(entity)
  return speciesId ? getSpecies(speciesId) : getPlayerSpecies()
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
 *    terraço não importam; só quem está no ar (pulo) sai do plano.
 * 2. Alcance no plano HORIZONTAL — distância entre a trajetória e a
 *    pegada do corpo do alvo, com Y zerado (`closestPointsOnGroundPlane`)
 *    ≤ `radius + capsuleRadius`. Usa as medidas do corpo físico
 *    (`CharacterController` + `Rotation.y`, que gira cápsulas deitadas).
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

  forEachTargetCandidate(
    world,
    targetSide,
    (entity, pos, rot, controller, vitals) => {
      // Sem HP ou desmaiada (`Fainted`): não é mais alvo.
      if (vitals.hp <= 0 || entity.has(Fainted)) return
      if (
        !isWithinCombatHeight(
          attackerElevation,
          resolveFootElevation(pos, controller),
        )
      )
        return

      const capsule = resolveCapsuleSegment(pos, rot.y, controller)
      const closest = closestPointsOnGroundPlane(
        origin,
        impactPoint,
        capsule.a,
        capsule.b,
      )
      if (closest.distance > radius + controller.capsuleRadius) return

      const isEarlier =
        !best ||
        closest.s < best.s ||
        (closest.s === best.s && closest.distance < best.distance)
      if (!isEarlier) return

      // Contato na altura da trajetória naquele ponto (não no Y zerado da
      // conta no plano) — é onde um VFX de acerto deve nascer.
      const pathY = origin.y + (impactPoint.y - origin.y) * closest.s
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
        contactPoint: resolveContactPoint(
          { ...closest.pointOnSecond, y: pathY },
          { ...closest.pointOnFirst, y: pathY },
          controller.capsuleRadius,
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
 * Todos os alvos dentro do CONE de um ataque canalizado (`damageMode:
 * 'channel'`) — mesmo leque do indicador (`isInsideAttackCone`), mesmos
 * filtros do golpe normal (lado certo, com HP, não desmaiado, mesmo plano
 * de combate 2.5D). Chamado a cada tick de dano do canal.
 */
export function resolveConeTargets(
  world,
  origin,
  direction,
  cone,
  attackerElevation,
  targetSide,
) {
  const targets = []
  forEachTargetCandidate(
    world,
    targetSide,
    (entity, pos, rot, controller, vitals) => {
      if (vitals.hp <= 0 || entity.has(Fainted)) return
      const elevation = resolveFootElevation(pos, controller)
      if (!isWithinCombatHeight(attackerElevation, elevation)) return
      if (
        !isInsideAttackCone(
          origin,
          direction,
          cone,
          pos,
          controller.capsuleRadius,
        )
      )
        return

      const species = resolveCombatantSpecies(entity)
      targets.push({
        entity,
        species,
        level: resolveEntityLevel(entity, species),
        vitals,
        individualValues: entity.has(IndividualValues)
          ? entity.get(IndividualValues)
          : null,
        contactPoint: { x: pos.x, y: origin.y, z: pos.z },
      })
    },
  )
  return targets
}

/**
 * Quem um golpe SÓ de efeito (sem dano — ex.: Growl) atinge no `effectAt`:
 * num golpe de cone (`area: 'cone'`), TODOS os inimigos dentro dele
 * (`resolveConeTargets`, a mesma forma e os mesmos filtros do canalizado — só
 * estrutura/terreno encurta o cone, criatura no caminho não); senão, o
 * primeiro corpo no caminho (`resolveAttackTarget`). Lista vazia = errou.
 */
export function resolveEffectTargets(world, context) {
  const { attack, origin, direction, impactPoint, pos, controller } = context
  const attackerElevation = resolveFootElevation(pos, controller)

  if (isConeAttack(attack)) {
    const coneEnd = resolveAttackImpactPoint(
      origin,
      direction,
      attack.range,
      context.physicsBody.colliderHandle,
      { terrainOnly: true },
    )
    const cone = {
      length: Math.hypot(coneEnd.x - origin.x, coneEnd.z - origin.z),
      range: attack.range,
      radius: attack.radius,
    }
    return resolveConeTargets(
      world,
      origin,
      direction,
      cone,
      attackerElevation,
      context.targetSide,
    )
  }

  const target = resolveAttackTarget(
    world,
    origin,
    impactPoint,
    attack.radius,
    attackerElevation,
    context.targetSide,
  )
  return target ? [target] : []
}
