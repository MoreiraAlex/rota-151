/**
 * Adapter de input de mouse para a câmera e as ações primária/de mira, via
 * Pointer Lock.
 *
 * Ao clicar no jogo o ponteiro é travado: o mouse passa a controlar a câmera
 * sem cursor visível. `Esc` (tratado pelo browser) solta; clicar de novo volta
 * a travar. Enquanto solto, nenhum movimento de câmera é capturado.
 *
 * O clique direito é a ação `aiming` (mirar, ver
 * docs/features/016-mira-e-arremesso.md) — um estado contínuo (segurado),
 * não um pulso: fica `true` do `mousedown` até o `mouseup` do botão
 * direito, refletido tanto na `Velocity` do arremesso (o corpo/câmera só
 * assume o enquadramento "sobre o ombro" enquanto mirando —
 * `view/systems/cameraFollowSystem.js`) quanto no retículo
 * (`tools/hud/Crosshair.jsx`, que rastreia o mesmo par de eventos
 * independentemente). Diferente da v0.0.15/16 original, o botão direito
 * **não solta mais o Pointer Lock** — essa era a função antiga (liberar o
 * cursor pra clicar em UI sem abrir o menu); virou mirar. O clique esquerdo
 * continua sendo a ação `primary` (ver docs/features/011-slots-de-acao.md)
 * — só conta depois que o ponteiro já está travado, pra não disparar a
 * ação no mesmo clique que só pede o lock; `playerActionSystem` também só
 * considera `primary` enquanto `aiming` está junto (botão esquerdo só
 * funciona enquanto o direito está segurado). O menu de contexto nativo do
 * botão direito é suprimido no elemento — sem isso apareceria por cima do
 * jogo.
 *
 * Acumula os deltas entre chamadas de `snapshot()`, que os drena — o game loop
 * consome cada movimento exatamente uma vez, mesmo com vários passos fixos por
 * frame. `aiming` (e `locked`) não são "deltas" — são estado contínuo, não
 * dreando por `snapshot()`. Único ponto, junto com keyboardInput, que fala
 * com o DOM.
 */
export function createPointerInput() {
  let element = null
  let locked = false
  let aiming = false
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

  const stopAiming = () => {
    aiming = false
  }

  const requestLock = () => {
    if (locked || !element?.requestPointerLock) return
    // Browsers recentes retornam Promise e rejeitam se chamado logo após o Esc.
    Promise.resolve(element.requestPointerLock()).catch(() => {})
  }

  const onPointerLockChange = () => {
    locked = !!element && document.pointerLockElement === element
    if (!locked) {
      resetDeltas()
      stopAiming()
    }
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
    else if (event.button === 2) aiming = true
  }

  const onMouseUp = (event) => {
    if (event.button === 2) stopAiming()
  }

  const onBlur = () => {
    resetDeltas()
    stopAiming()
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
      // mouseup no window, não no elemento — soltar o botão fora do canvas
      // (ex.: o cursor "escapou" antes de travar) ainda precisa parar de
      // mirar, senão fica preso em `aiming: true`.
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('blur', onBlur)
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
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
      if (locked && document.exitPointerLock) document.exitPointerLock()
      element = null
      locked = false
      resetDeltas()
      stopAiming()
    },
    // Estado contínuo (não drenado) — pra fases do loop que não recebem
    // `input` (presentation, ver `view/loop/GameLoop.jsx`/
    // `cameraFollowSystem.js`), que precisam saber se está mirando agora
    // sem consumir/duplicar o snapshot da fase de simulação.
    isAiming() {
      return aiming
    },
    snapshot() {
      const snapshot = {
        cameraYaw: yawDelta,
        cameraPitch: pitchDelta,
        zoom: zoomDelta,
        primary: primaryPressed,
        aiming,
      }
      resetDeltas()
      return snapshot
    },
  }
}
