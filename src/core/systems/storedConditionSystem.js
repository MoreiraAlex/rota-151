import { avancarQueimaduraGuardada } from '../actions/conditions'
import { creatureFainted } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { Pokemon, StoredConditions, StoredFaint, StoredVitals } from '../traits'

/**
 * Condições dentro da bola (docs/features/043-captura.md): a queimadura de
 * um Pokémon recolhido ou capturado continua tirando da vida guardada
 * (`StoredVitals`), com as mesmas regras do `burnSystem`
 * (`avancarQueimaduraGuardada`). Acabou o tempo, sai. Zerou a vida, ele
 * desmaia ali dentro (`StoredFaint`, o mesmo desmaio fora de campo, que
 * reanima com o tempo no `faintSystem`) e emite `creatureFainted` (o log).
 *
 * Desmaiado não queima mais; sem vida guardada (cheia, nunca saiu), não há
 * de onde tirar — a condição só conta o tempo.
 *
 * Dono de escrita: `StoredConditions` (conta e tira), `StoredVitals.hp` e
 * `StoredFaint` (põe). Fase: simulation, junto do `burnSystem`.
 */
export function storedConditionSystem(context) {
  const { world, delta, events } = context

  const fainted = []
  const cleared = []
  world
    .query(Pokemon, StoredConditions, StoredVitals)
    .updateEach(([pokemon, conditions, stored], entity) => {
      if (entity.has(StoredFaint)) {
        cleared.push(entity)
        return
      }
      if (!conditions.burn) {
        cleared.push(entity)
        return
      }
      if (!stored.vitals) {
        const timeLeft = conditions.burn.timeLeft - delta
        conditions.burn = timeLeft > 0 ? { ...conditions.burn, timeLeft } : null
        if (!conditions.burn) cleared.push(entity)
        return
      }

      const next = avancarQueimaduraGuardada(
        conditions.burn,
        stored.vitals,
        delta,
      )
      conditions.burn = next.burn
      // Objeto novo só quando a vida mudou: a HUD percebe a troca.
      if (next.vitals !== stored.vitals) stored.vitals = next.vitals
      if (next.vitals.hp <= 0) {
        fainted.push({ entity, speciesId: pokemon.speciesId })
      } else if (!next.burn) {
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
