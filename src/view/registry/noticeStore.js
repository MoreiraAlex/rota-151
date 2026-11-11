import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Avisos no canto da tela (docs/features/067-campo-de-treino-e-avisos-de-
 * nivel.md) — estado só da view, derivado de eventos. Quem escreve:
 * `view/systems/noticeSystem.js` (`push` + `advance`); quem lê:
 * `tools/hud/NoticeHud.jsx` (`subscribe`/`getSnapshot`, pro
 * `useSyncExternalStore`).
 *
 * Aviso: `{ id, kind, title, detail?, color, duration? }` (`duration`, s:
 * sem ele, `FEEDBACK.NOTICES.DURATION`). O snapshot só muda quando
 * entra ou sai um aviso — nunca a cada frame.
 */
const EMPTY = []

function createNoticeStore() {
  let snapshot = EMPTY
  // id → segundos que ainda faltam (fora do snapshot: muda todo frame).
  const timeLeft = new Map()
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
    /** Acrescenta um aviso (o mais antigo sai, passando de `MAX_VISIBLE`). */
    push(notice) {
      const { DURATION, MAX_VISIBLE } = GAME_CONFIG.FEEDBACK.NOTICES
      const id = nextId++
      timeLeft.set(id, notice.duration ?? DURATION)
      const next = [...snapshot, { ...notice, id }]
      const dropped = next.slice(0, Math.max(0, next.length - MAX_VISIBLE))
      for (const old of dropped) timeLeft.delete(old.id)
      publish(next.slice(dropped.length))
    },
    /** Conta o tempo de cada aviso; os que acabaram saem. */
    advance(delta) {
      if (snapshot.length === 0) return
      let expired = false
      for (const [id, left] of timeLeft) {
        const next = left - delta
        timeLeft.set(id, next)
        if (next <= 0) expired = true
      }
      if (!expired) return
      const alive = snapshot.filter((notice) => timeLeft.get(notice.id) > 0)
      for (const notice of snapshot) {
        if (!(timeLeft.get(notice.id) > 0)) timeLeft.delete(notice.id)
      }
      publish(alive)
    },
    /** Esvazia (testes). */
    clear() {
      timeLeft.clear()
      publish(EMPTY)
    },
  }
}

export const noticeStore = createNoticeStore()
