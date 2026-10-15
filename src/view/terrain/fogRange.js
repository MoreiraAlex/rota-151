import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Onde a névoa começa e onde fecha (m, a partir da câmera) para esconder a
 * borda do mundo carregado (docs/features/046-sistema-de-chunks.md).
 *
 * Um chunk que acaba de entrar na fila nasce a pelo menos `loadRadius`
 * chunks do jogador (ele precisa atravessar a borda do próprio chunk para o
 * anel seguinte ser pedido); um que descarrega está mais longe ainda. A
 * câmera fica atrás do jogador, até `cameraMaxDistance` — olhando para a
 * frente, ela está esse tanto mais perto do chunk novo. Então a névoa fecha
 * em `loadRadius × chunkSize − cameraMaxDistance` (nunca menos que
 * `minDistance`) e começa em `startFraction` disso.
 */
export function fogRange({
  loadRadius,
  chunkSize,
  cameraMaxDistance,
  startFraction,
  minDistance,
}) {
  const far = Math.max(loadRadius * chunkSize - cameraMaxDistance, minDistance)
  return { near: far * startFraction, far }
}

/**
 * Quanto some na névoa da cena (`{ near, far }`) a esta distância — a mesma
 * conta do shader (linear). Para o que o shader não enevoa (plaquinhas de
 * nome em DOM).
 */
export function fogFactorAt(distance, fog) {
  return Math.min(Math.max((distance - fog.near) / (fog.far - fog.near), 0), 1)
}

/**
 * `fogRange` do mundo carregado agora (`GAME_CONFIG`, lado do chunk
 * `chunkSize`): até onde tudo aparece inteiro (`near`, onde a névoa começa)
 * e onde ela fecha (`far`) — docs/features/058-ajuste-dos-biomas.md.
 */
export function loadedFogRange(chunkSize) {
  const { TERRAIN, CAMERA, FOG } = GAME_CONFIG
  return fogRange({
    loadRadius: TERRAIN.LOAD_RADIUS,
    chunkSize,
    cameraMaxDistance: CAMERA.MAX_DISTANCE,
    startFraction: FOG.START_FRACTION,
    minDistance: FOG.MIN_DISTANCE,
  })
}
