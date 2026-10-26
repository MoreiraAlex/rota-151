import { avancarCondicaoGuardada } from '../actions/conditions'
import { creatureFainted } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { Pokemon, StoredConditions, StoredFaint, StoredVitals } from '../traits'

/**
 * Condições dentro da bola (docs/features/043-captura.md): as condições de
 * um Pokémon recolhido ou capturado continuam tirando da vida guardada
 * (`StoredVitals`), com as mesmas regras do `conditionSystem`
 * (`avancarCondicaoGuardada`). Acabou o tempo, sai. Zerou a vida, ele
 * desmaia ali dentro (`StoredFaint`, o mesmo desmaio fora de campo, que
 * reanima com o tempo no `faintSystem`) e emite `creatureFainted` (o log).
 *
 * Desmaiado não perde mais nada; sem vida guardada (cheia, nunca saiu), não
 * há de onde tirar — a condição só conta o tempo.
 *
 * Dono de escrita: `StoredConditions` (conta e tira), `StoredVitals.hp` e
 * `StoredFaint` (põe). Fase: simulation, junto do `conditionSystem`.
 */
export function storedConditionSystem(context) {
  const { world, delta, events } = context

  const fainted = []
  const cleared = []
  world
    .query(Pokemon, StoredConditions, StoredVitals)
    .updateEach(([pokemon, conditions, stored], entity) => {
      if (entity.has(StoredFaint) || !conditions.list.length) {
        cleared.push(entity)
        return
      }

      const next = []
      let vitals = stored.vitals
      for (const entry of conditions.list) {
        if (!vitals) {
          const timeLeft = entry.timeLeft - delta
          if (timeLeft > 0) next.push({ ...entry, timeLeft })
          continue
        }
        const advanced = avancarCondicaoGuardada(entry, vitals, delta)
        vitals = advanced.vitals
        if (advanced.entry) next.push(advanced.entry)
      }
      conditions.list = next
      // Objeto novo só quando a vida mudou: a HUD percebe a troca.
      if (vitals !== stored.vitals) stored.vitals = vitals
      if (vitals && vitals.hp <= 0) {
        fainted.push({ entity, speciesId: pokemon.speciesId })
      } else if (!next.length) {
        cleared.push(entity)
      }
    })

  // Fora do `updateEach`: tirar/pôr trait muda a query iterada.
  for (const entity of cleared) entity.remove(StoredConditions)
  for (const { entity, speciesId } of fainted) {
    entity.remove(StoredConditions)
    entity.add(
      StoredFaint({ timeLeft: GAME_CONFIG.FAINT.DURATION_MINUTES * 60 }),
    )
    events?.emit(creatureFainted({ entity, speciesId }))
  }
}
