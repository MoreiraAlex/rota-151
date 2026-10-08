/**
 * Como o relevo é colorido (docs/features/047-biomas.md): `natural` (as
 * cores de cada bioma) ou `biome` (debug, F2 — uma cor chapada por bioma,
 * para ver as fronteiras). Estado só de exibição: quem troca é o painel de
 * ajuste (`tools/debug/TerrainTuningPanel.jsx`), quem lê é o `TerrainView`.
 */
export const TERRAIN_COLOR_MODES = {
  natural: 'natural',
  biome: 'biome',
}

let mode = TERRAIN_COLOR_MODES.natural
const listeners = new Set()

export const getTerrainColorMode = () => mode

export function setTerrainColorMode(next) {
  if (next === mode) return
  mode = next
  for (const listener of listeners) listener()
}

export function subscribeTerrainColorMode(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
