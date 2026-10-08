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
