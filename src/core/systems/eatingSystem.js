import { derrubarComida, terminarDeComer } from '../actions/eating'
import { ActionState, Eating, Vitals, applyHeal } from '../traits'

/**
 * Avança quem está comendo (docs/features/042-itens-da-beta.md): a cada
 * tick cura a fração `healTotal × delta / duration` (sem passar da vida
 * máxima nem do `healTotal`) e, ao chegar na `duration`, termina.
 *
 * Quem tem `Eating` mas não está mais na ação `'eat'` (algo de fora trocou a
 * ação — ex.: o desmaio zera o `ActionState`) foi interrompido: derruba a
 * comida. O dano em si é tratado na fase de eventos
 * (`eatingInterruptSystem`).
 *
 * Headless. Fase: simulation, depois de quem causa dano (ataque, Leech Seed,
 * queimadura) e antes do desmaio.
 */
export function eatingSystem(context) {
  const { world, delta } = context
  const finished = []
  const interrupted = []

  world
    .query(Eating, ActionState, Vitals)
    .updateEach(([eating, action, vitals], entity) => {
      if (action.current !== 'eat') {
        interrupted.push(entity)
        return
      }

      const step = Math.min(
        delta,
        Math.max(0, eating.duration - action.elapsed),
      )
      action.elapsed += delta
      const share =
        eating.duration > 0 ? (eating.healTotal * step) / eating.duration : 0
      const heal = Math.min(share, eating.healTotal - eating.healed)
      if (heal > 0) {
        vitals.hp = applyHeal(vitals, heal).hp
        eating.healed += heal
      }

      if (action.elapsed >= eating.duration) {
        action.current = null
        finished.push(entity)
      }
    })

  // Fora do `updateEach`: as actions gravam `ActionState`/tiram `Eating`.
  for (const entity of finished) terminarDeComer(entity)
  for (const entity of interrupted) derrubarComida(world, entity)
}
