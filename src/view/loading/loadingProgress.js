/**
 * Progresso da tela de carregamento (docs/features/044-salvar-o-jogo.md):
 * conta as etapas que o jogo controla (save, física, cada sprite), cada uma
 * com um rótulo pro jogador ("Carregando o save…"). Os modelos e texturas 3D
 * são contados à parte pelo three.js (`useProgress` do drei) e somados em
 * `resolveLoadingFraction`.
 */
export function createLoadingProgress() {
  let snapshot = { done: 0, total: 0, pending: [] }
  const remaining = new Map()
  const listeners = new Set()

  function publish(done, total) {
    const pending = [...remaining]
      .filter(([, count]) => count > 0)
      .map(([label]) => label)
    snapshot = { done, total, pending }
    for (const listener of listeners) listener()
  }

  return {
    /** Mais `amount` unidades a fazer na etapa `label`. */
    add(label, amount = 1) {
      remaining.set(label, (remaining.get(label) ?? 0) + amount)
      publish(snapshot.done, snapshot.total + amount)
    },
    /** Uma unidade da etapa `label` terminou. */
    complete(label) {
      const count = remaining.get(label) ?? 0
      if (count <= 0) return
      remaining.set(label, count - 1)
      publish(snapshot.done + 1, snapshot.total)
    },
    /** Conta a `promise` como uma unidade de `label`; devolve a mesma promise. */
    track(label, promise) {
      this.add(label)
      const finish = () => this.complete(label)
      promise.then(finish, finish)
      return promise
    },
    reset() {
      remaining.clear()
      publish(0, 0)
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** O progresso da entrada no jogo (um só por página). */
export const loadingProgress = createLoadingProgress()

/**
 * Fração (0 a 1) do carregamento: etapas do jogo + arquivos do three.js
 * (`assets`: `{ loaded, total }` do `useProgress`). Nada a fazer ainda: 0.
 */
export function resolveLoadingFraction(steps, assets) {
  const total = steps.total + (assets?.total ?? 0)
  if (total <= 0) return 0
  return Math.min(1, (steps.done + (assets?.loaded ?? 0)) / total)
}
