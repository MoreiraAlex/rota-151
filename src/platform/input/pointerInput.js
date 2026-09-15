/**
 * Adapter de input de mouse para a câmera e a ação primária, via Pointer Lock.
 *
 * Ao clicar no jogo o ponteiro é travado: o mouse passa a controlar a câmera
 * sem cursor visível. `Esc` (tratado pelo browser) solta; clicar de novo volta
 * a travar. Enquanto solto, nenhum movimento de câmera é capturado.
 *
 * O clique esquerdo também é a ação `primary` (ver
 * docs/features/011-slots-de-acao.md) — só conta depois que o ponteiro já
 * está travado, pra não disparar a ação no mesmo clique que só pede o lock.
 * O clique direito solta o mouse (mesmo efeito do Esc) — o menu de pausa
 * (`src/app/(auth)/page.js`) abre sozinho junto, via `pointerlockchange`,
 * do mesmo jeito que já reage ao Esc. O menu de contexto nativo do botão
 * direito é suprimido no elemento — sem isso apareceria por cima do jogo.
 *
 * Acumula os deltas entre chamadas de `snapshot()`, que os drena — o game loop
 * consome cada movimento exatamente uma vez, mesmo com vários passos fixos por
 * frame. Único ponto, junto com keyboardInput, que fala com o DOM.
 */
export function createPointerInput() {
  let element = null
  let locked = false
  let yawDelta = 0
  let pitchDelta = 0
  let zoomDelta = 0
  let primaryPressed = false

  const resetDeltas = () => {
    yawDelta = 0
    pitchDelta = 0
    zoomDelta = 0
    primaryPressed = false
  }

  const requestLock = () => {
    if (locked || !element?.requestPointerLock) return
    // Browsers recentes retornam Promise e rejeitam se chamado logo após o Esc.
    Promise.resolve(element.requestPointerLock()).catch(() => {})
  }

  const onPointerLockChange = () => {
    locked = !!element && document.pointerLockElement === element
    if (!locked) resetDeltas()
  }

  const onPointerMove = (event) => {
    if (!locked) return
    yawDelta += event.movementX
    pitchDelta += event.movementY
  }

  const onWheel = (event) => {
    if (!locked) return
    zoomDelta += Math.sign(event.deltaY)
  }

  const onMouseDown = (event) => {
    if (!locked) return
    if (event.button === 0) primaryPressed = true
    else if (event.button === 2 && document.exitPointerLock) {
      document.exitPointerLock()
    }
  }

  const onContextMenu = (event) => event.preventDefault()

  return {
    start(domElement) {
      element = domElement ?? null
      if (!element) return
      element.addEventListener('click', requestLock)
      element.addEventListener('mousedown', onMouseDown)
      element.addEventListener('contextmenu', onContextMenu)
      element.addEventListener('wheel', onWheel, { passive: true })
      document.addEventListener('pointerlockchange', onPointerLockChange)
      document.addEventListener('mousemove', onPointerMove)
      window.addEventListener('blur', resetDeltas)
    },
    stop() {
      if (element) {
        element.removeEventListener('click', requestLock)
        element.removeEventListener('mousedown', onMouseDown)
        element.removeEventListener('contextmenu', onContextMenu)
        element.removeEventListener('wheel', onWheel)
      }
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('blur', resetDeltas)
      if (locked && document.exitPointerLock) document.exitPointerLock()
      element = null
      locked = false
      resetDeltas()
    },
    snapshot() {
      const snapshot = {
        cameraYaw: yawDelta,
        cameraPitch: pitchDelta,
        zoom: zoomDelta,
        primary: primaryPressed,
      }
      resetDeltas()
      return snapshot
    },
  }
}
