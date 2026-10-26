import { readConditionModifier } from '../actions/conditions'
import { getSpecies } from '../data/species'
import { resolveAttackForEntity } from '../battle/attackCasting'
import { resolveEntityMoveSet } from '../battle/creatureAttack'
import { readSpeedStage } from '../battle/statStages'
import {
  isAttackLunging,
  resolveAttackHitTime,
} from '../battle/attackTelegraph'
import {
  planLungeDistance,
  resolveImpactAt,
  resolveLungeDistance,
  resolveLungeStep,
  resolveLungeTime,
} from '../battle/attackLunge'
import {
  ActionState,
  AttackLunge,
  CharacterController,
  IndividualValues,
  Position,
  Velocity,
  WildCreature,
  resolveCreatureSpeciesId,
  resolveEntityLevel,
} from '../traits'

/**
 * Arrancada dos golpes com `lunge` (docs/features/061-revisao-das-skills.md
 * — o Quick Attack): parada até o `effectAt` (a direção ainda pode ser
 * reapontada); ali planeja quanto andar (`planLungeDistance`: a distância
 * toda ou até encostar no primeiro alvo no caminho) e, até o acerto
 * (`isAttackLunging`), empurra quem ataca na direção já travada do golpe. O
 * acerto (`creatureAttackSystem`, no `resolveImpactAt`) sai de onde ela
 * chegou.
 *
 * Escreve a `Velocity` — depois de quem move as criaturas (seguir, IA,
 * selvagem: todos param quem está golpeando) e antes da física, que resolve a
 * colisão (não atravessa ninguém). Golpe acabado ou trocado: tira o
 * `AttackLunge`.
 *
 * Headless. Fase: simulation, depois dos movimentos e antes do
 * `characterPhysicsSystem`.
 */
export function attackLungeSystem({ world, delta }) {
  world
    .query(
      ActionState,
      Velocity,
      Position,
      CharacterController,
      IndividualValues,
    )
    .updateEach(([action, vel, pos, controller, ivs], entity) => {
      if (action.current !== 'attack') {
        if (entity.has(AttackLunge)) entity.remove(AttackLunge)
        return
      }
      const speciesId = resolveCreatureSpeciesId(entity)
      if (!speciesId) return
      const species = getSpecies(speciesId)
      const attack = resolveAttackForEntity(
        species,
        action.pendingSlot,
        ivs,
        resolveEntityLevel(entity, species),
        resolveEntityMoveSet(entity, species),
        readSpeedStage(entity),
      )
      if (resolveLungeDistance(attack) <= 0) return

      // Golpe novo (o relógio voltou): o plano do anterior não vale.
      const previous = entity.has(AttackLunge) ? entity.get(AttackLunge) : null
      if (previous && action.elapsed < previous.lastElapsed) {
        entity.remove(AttackLunge)
      }

      // Fora da janela (antes do `effectAt` ou depois do acerto): parada — a
      // velocidade é da arrancada até o golpe acabar.
      if (!isAttackLunging(action, attack)) {
        vel.x = 0
        vel.z = 0
        if (entity.has(AttackLunge)) {
          entity.set(AttackLunge, { lastElapsed: action.elapsed })
        }
        return
      }

      // Começou: planeja de onde está, na direção já travada.
      const direction = { x: action.dirX, z: action.dirZ }
      if (!entity.has(AttackLunge)) {
        // passo zerado por condição (Preso, o Wrap): não sai do lugar
        const distance =
          readConditionModifier(entity, 'movement') > 0
            ? planLungeDistance(world, {
                entity,
                attack,
                pos,
                controller,
                direction,
                targetSide: entity.has(WildCreature) ? 'player' : 'wild',
              })
            : 0
        entity.add(AttackLunge)
        entity.set(AttackLunge, { distance, travelled: 0 })
      }
      const lunge = entity.get(AttackLunge)
      entity.set(AttackLunge, { lastElapsed: action.elapsed })

      // o tempo da arrancada em segundos reais (a ação estica junto)
      const hitTime = resolveAttackHitTime(action, attack)
      const lungeTime =
        (hitTime * resolveLungeTime(attack)) / resolveImpactAt(attack)
      const { speed, step } = resolveLungeStep(lunge, lungeTime, delta)
      if (step <= 0) {
        vel.x = 0
        vel.z = 0
        return
      }
      const length = Math.hypot(direction.x, direction.z) || 1
      vel.x = (direction.x / length) * speed
      vel.z = (direction.z / length) * speed
      entity.set(AttackLunge, { travelled: lunge.travelled + step })
    })
}
