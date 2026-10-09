/**
 * Monitor de desempenho (o `<Stats/>` do drei: FPS, MS e MB, no canto da
 * tela) — ligado e desligado no F2 (painel "Vegetação" → Render). Ligado,
 * ele fica na tela mesmo com o F2 fechado, para medir jogando; a escolha
 * fica guardada no navegador (conveniência de quem testa — sem o storage,
 * começa desligado). Quem escreve é o painel; quem lê, a página do jogo.
 */
const STORAGE_KEY = 'rota151.debug.stats'

function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

let isVisible = null
const listeners = new Set()

export function isStatsVisible() {
  if (isVisible === null) {
    isVisible = typeof window === 'undefined' ? false : readStored()
  }
  return isVisible
}

export function setStatsVisible(next) {
  isVisible = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {}
  for (const listener of listeners) listener()
}

export function subscribeStatsVisible(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
