import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Linhas do log de batalha (docs/features/039-tipos-e-combate-classico.md) —
 * estado só da view, derivado dos eventos de combate. Quem escreve:
 * `view/systems/battleLogSystem.js` (`pushLines` + `advance`); quem lê:
 * `tools/hud/BattleLogHud.jsx` (`subscribe`/`getSnapshot`, pro
 * `useSyncExternalStore`).
 *
 * O snapshot só muda quando entra linha nova ou quando o log apaga por
 * inatividade — nunca a cada frame, então o HUD não re-renderiza à toa.
 */
const EMPTY = { lines: [], visible: false }

function createBattleLogStore() {
  let snapshot = EMPTY
  let idleTime = 0
  let nextId = 1
  const listeners = new Set()

  function publish(next) {
    snapshot = next
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    /** Acrescenta linhas `{ text, color }` (as mais antigas saem do topo). */
    pushLines(lines) {
      if (lines.length === 0) return
      const { MAX_LINES } = GAME_CONFIG.FEEDBACK.BATTLE_LOG
      const added = lines.map((entry) => ({ ...entry, id: nextId++ }))
      idleTime = 0
      publish({
        lines: [...snapshot.lines, ...added].slice(-MAX_LINES),
        visible: true,
      })
    },
    /** Conta o tempo sem mensagem; passou de `IDLE_FADE_TIME`, apaga. */
    advance(delta) {
      if (!snapshot.visible) return
      idleTime += delta
      if (idleTime >= GAME_CONFIG.FEEDBACK.BATTLE_LOG.IDLE_FADE_TIME) {
        publish({ ...snapshot, visible: false })
      }
    },
    /** Esvazia (testes). */
    clear() {
      idleTime = 0
      publish(EMPTY)
    },
  }
}

export const battleLogStore = createBattleLogStore()
