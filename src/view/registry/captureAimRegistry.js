/**
 * O arco e o círculo da mira da Pokébola (`CaptureAimView.jsx` →
 * `captureAimViewSystem.js`, docs/features/043-captura.md) — um só na
 * cena (só o jogador desta máquina mira). Estado de tela.
 */
let parts = null

export function registerCaptureAimView(next) {
  parts = next
}

export function unregisterCaptureAimView() {
  parts = null
}

export function getCaptureAimView() {
  return parts
}
