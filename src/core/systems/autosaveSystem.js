import { pedirSave } from '../actions/save'
import { EVENT_TYPES } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { SaveClock, TrainerReady } from '../traits'

/**
 * Save automático (docs/features/044-salvar-o-jogo.md), fase `events`: pede
 * um save (`pedirSave`) a cada `GAME_CONFIG.SAVE.AUTOSAVE_INTERVAL` segundos
 * e logo depois de uma captura (`pokemonCaptured` neste passo). Só pede — a
 * plataforma decide se grava (só se mudou).
 *
 * Lê os eventos do passo; escreve `SaveClock`.
 */
export function autosaveSystem(context) {
  const { world, delta, events } = context
  const captured = new Set(
    (events?.stepEvents() ?? [])
      .filter((event) => event.type === EVENT_TYPES.POKEMON_CAPTURED)
      .map((event) => event.trainer),
  )

  world.query(SaveClock, TrainerReady).updateEach(([clock], trainer) => {
    clock.elapsed += delta
    const due = clock.elapsed >= GAME_CONFIG.SAVE.AUTOSAVE_INTERVAL
    if (due) clock.elapsed = 0
    if (due || captured.has(trainer)) pedirSave(trainer)
  })
}
