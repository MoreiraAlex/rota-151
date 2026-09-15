import { GAME_CONFIG } from '../gameConfig'
import { getSpecies } from '../data/species'
import {
  AnimationState,
  InputControlled,
  Party,
  Position,
  Rotation,
  SummonedCreature,
} from '../traits'

// Mapeia o pulso de input (`secondaryN`, ver docs/features/011-slots-de-
// acao.md) pro slot correspondente do time (`Party.slotN`).
const SLOTS = [
  { input: 'secondary1', slot: 'slot1' },
  { input: 'secondary2', slot: 'slot2' },
  { input: 'secondary3', slot: 'slot3' },
]
const { SUMMON_OFFSET } = GAME_CONFIG.PARTY

function findSummoned(world, slot) {
  return world
    .query(SummonedCreature)
    .find((entity) => entity.get(SummonedCreature).slot === slot)
}

/**
 * Invoca/recolhe a criatura de cada slot do time (`secondary1-3`, ver
 * docs/features/011-slots-de-acao.md e docs/features/014-arremessar-usar-e-
 * invocar.md) — não é uma ação do próprio corpo do treinador (sem duração,
 * sem travar `ActionState`/`Velocity`): cria ou destrói outra entidade.
 *
 * Por slot apertado: se já existe uma `SummonedCreature` daquele slot,
 * recolhe (destrói). Senão, lê `Party[slotN]`; vazio não faz nada; com uma
 * espécie, invoca (spawna a entidade, à frente do treinador). Cada
 * `secondaryN` é independente — até 3 criaturas de fora ao mesmo tempo.
 *
 * A criatura invocada ganha `Position`/`Rotation` (`syncTransformSystem`
 * exige as duas pra sincronizar a view), `SummonedCreature` (com
 * `speciesId`, pra `CreatureView` saber o modelo) e `AnimationState({ id:
 * 'idle' })` fixo — sem `animationStateSystem` (não tem
 * `CharacterController`/`Velocity` de verdade, só desliza via
 * `creatureFollowSystem`). Seguir o treinador é o `creatureFollowSystem`;
 * renderizar é `CreatureView` (view).
 *
 * Headless. Fase: simulation — independente de movimento/física do
 * treinador, só lê a posição/rotação dele pra saber onde invocar.
 */
export function partySummonSystem(context) {
  const { world } = context
  const input = context.input ?? {}

  world
    .query(InputControlled, Party, Position, Rotation)
    .updateEach(([party, pos, rot]) => {
      for (const { input: inputKey, slot } of SLOTS) {
        if (!input[inputKey]) continue

        const existing = findSummoned(world, slot)
        if (existing) {
          existing.destroy()
          continue
        }

        const speciesId = party[slot]
        if (!speciesId) continue

        const species = getSpecies(speciesId)
        if (!species) continue

        world.spawn(
          Position({
            x: pos.x + Math.sin(rot.y) * SUMMON_OFFSET,
            y: pos.y,
            z: pos.z + Math.cos(rot.y) * SUMMON_OFFSET,
          }),
          Rotation,
          SummonedCreature({ slot, speciesId }),
          AnimationState, // default { id: 'idle' } — sem system que troque isso ainda
        )
      }
    })
}
