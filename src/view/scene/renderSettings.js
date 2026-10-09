/**
 * Curva de cor e SMAA (`GAME_CONFIG.RENDER.TONE_MAPPING`/`SMAA`,
 * docs/features/049-vegetacao-e-floresta.md): o painel do debug muda o
 * config e avisa por `notifyRenderSettingsChanged`; quem aplica é o
 * `RenderSettingsView`.
 */
let revision = 0
const listeners = new Set()

export const getRenderSettingsRevision = () => revision

export function notifyRenderSettingsChanged() {
  revision += 1
  for (const listener of listeners) listener()
}

export function subscribeRenderSettings(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
