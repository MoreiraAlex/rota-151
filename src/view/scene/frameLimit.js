// Folga (ms) para um quadro da tela que chega um pouco antes da hora não
// ser pulado (o `requestAnimationFrame` não cai no milissegundo exato).
const EARLY_TOLERANCE = 1

/**
 * Se o quadro da tela em `now` (ms) deve ser desenhado, com no máximo
 * `maxFps` quadros por segundo (0 = sem limite, um por quadro da tela).
 * Devolve o novo "último quadro desenhado" ou `null` para pular. O resto do
 * intervalo fica guardado, então a média bate com o limite mesmo quando ele
 * não divide a taxa da tela (ex.: 40 numa tela de 60 alterna 1 e 2
 * quadros da tela).
 *
 * @param {number} now - tempo do quadro da tela (ms)
 * @param {number | null} last - o retorno da última vez que desenhou
 * @param {number} maxFps
 * @returns {number | null}
 */
export function nextDrawnFrame(now, last, maxFps) {
  if (!maxFps || last === null) return now
  const interval = 1000 / maxFps
  const elapsed = now - last
  if (elapsed < interval - EARLY_TOLERANCE) return null
  // Atrasou mais de um intervalo (aba parada, travada): recomeça daqui.
  if (elapsed >= interval * 2) return now
  return last + interval
}
