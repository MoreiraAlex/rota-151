/**
 * Alvo de eventos mínimo (compatível com `element` / `document` / `window`)
 * para testar adapters de input sem precisar de jsdom.
 */
export function fakeEventTarget(extra = {}) {
  const listeners = new Map()
  return {
    ...extra,
    style: {},
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn)
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.forEach((fn) => fn(event))
    },
    count(type) {
      return listeners.get(type)?.size ?? 0
    },
  }
}
