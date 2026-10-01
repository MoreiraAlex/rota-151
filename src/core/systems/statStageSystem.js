import { Fainted, StatStages } from '../traits'
import { STAT_STAGE_KEYS } from '../battle/statStages'

/**
 * Expira os estágios de atributo: pra cada atributo com estágio diferente de
 * 0, conta o tempo (`<stat>Time`) pra baixo e, ao zerar, o estágio volta a 0
 * (`core/traits/components/statStages.js`). Tempo real, não por turno.
 * Criatura desmaiada (`Fainted`) perde TODOS os estágios na hora — ao
 * acordar/voltar à luta, ela volta sem alteração nenhuma.
 *
 * Headless. Fase: simulation — independente da ordem com os outros systems
 * (só mexe no `StatStages`; a fórmula de dano lê o estágio na hora do golpe).
 */
export function statStageSystem(context) {
  const { world, delta } = context

  world.query(StatStages).updateEach(([stages], entity) => {
    const fainted = entity.has(Fainted)
    for (const key of STAT_STAGE_KEYS) {
      if (stages[`${key}Stage`] === 0) continue
      if (fainted) {
        stages[`${key}Stage`] = 0
        stages[`${key}Time`] = 0
        continue
      }
      stages[`${key}Time`] -= delta
      if (stages[`${key}Time`] <= 0) {
        stages[`${key}Stage`] = 0
        stages[`${key}Time`] = 0
      }
    }
  })
}
