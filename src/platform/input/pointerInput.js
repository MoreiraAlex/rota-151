/**
 * Adapter de input de mouse para a câmera e a ação primária, via Pointer
 * Lock.
 *
 * Ao clicar no jogo o ponteiro é travado: o mouse passa a controlar a câmera
 * sem cursor visível. `Esc` (tratado pelo browser) solta; clicar de novo volta
 * a travar. Enquanto solto, nenhum movimento de câmera é capturado.
 *
 * O clique esquerdo é a ação `primary` (ver docs/features/011-slots-de-
 * acao.md) — mesmo mecanismo de PULSO (borda de subida do `mousedown`,
 * drenado no próximo `snapshot()`), só conta depois que o ponteiro já está
 * travado, pra não disparar a ação no mesmo clique que só pede o lock.
 *
 * **Botão direito — SEGURAR, não clicar (docs/features/033-*.md)** — bug
 * relatado pelo usuário, com log próprio confirmando a causa: "esse
 * input.secondary só fica como true quando eu clico com mouse e logo
 * depois volta a false, daí ele nunca entra nesse if [confirmação de
 * scan], a não ser quando eu saio do modo... o que podemos fazer, ao
 * invés do modo scan ser por clique, ele seja por holding". O mecanismo
 * de PULSO antigo (`secondaryPressed`, borda de subida só) não dava pra
 * distinguir "primeiro clique" de "segundo clique" de forma confiável na
 * prática (o pedido original, docs/features/033-*.md seção 1, imaginava
 * dois cliques distintos — abrir, depois confirmar — mas o pulso sozinho
 * não sustenta esse mecanismo tão bem quanto SEGURAR sustenta).
 *
 * Agora `secondaryHeld` é ESTADO CONTÍNUO (true do `mousedown` até o
 * `mouseup`, não dreno no `snapshot()` — o modo scanner fica ligado
 * enquanto está sendo segurado, ver `scannerModeSystem.js`) e
 * `secondaryReleased` é um PULSO na borda de DESCIDA (true só no
 * `snapshot()` seguinte ao `mouseup` — dispara a confirmação do scan
 * com o que estava mirado no instante de soltar).
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
  let secondaryHeld = false
  let secondaryReleased = false

  // Drenado a cada `snapshot()` — pulsos de UM tick (`primary`,
  // `secondaryReleased`) e os deltas de câmera/zoom. `secondaryHeld` NÃO
  // é um pulso — reflete o estado de VERDADE do botão, dura vários
  // snapshots (vários ticks fixos) até soltar de verdade.
  const resetPulses = () => {
    yawDelta = 0
    pitchDelta = 0
    zoomDelta = 0
    primaryPressed = false
    secondaryReleased = false
  }

  // Chamado quando o pointer lock se perde (Esc, alt-tab, `stop()`) —
  // diferente de `resetPulses`, também derruba `secondaryHeld`: sem isso,
  // soltar o botão direito FORA da janela (perde o `mouseup`) deixaria o
  // modo scanner preso ligado pra sempre, sem jeito de sair.
  const resetHeldState = () => {
    secondaryHeld = false
    secondaryReleased = false
  }

  const requestLock = () => {
    if (locked || !element?.requestPointerLock) return
    // Browsers recentes retornam Promise e rejeitam se chamado logo após o Esc.
    Promise.resolve(element.requestPointerLock()).catch(() => {})
  }

  const onPointerLockChange = () => {
    locked = !!element && document.pointerLockElement === element
    if (!locked) {
      resetPulses()
      resetHeldState()
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
    // `preventDefault` no botão direito TAMBÉM aqui (não só no
    // `contextmenu` abaixo) — pedido do usuário: "devido à manipulação
    // dos cliques, o próprio menu do botão direito do Chrome aparece".
    // Suprimir só no evento `contextmenu` não é sempre suficiente com o
    // botão SEGURADO (em vez de um clique rápido, ver docstring do
    // arquivo) — alguns browsers decidem mostrar o menu a partir do
    // `mousedown` do botão direito, não esperam o `contextmenu`.
    if (event.button === 2) event.preventDefault?.()
    if (!locked) return
    if (event.button === 0) primaryPressed = true
    else if (event.button === 2) secondaryHeld = true
  }

  const onMouseUp = (event) => {
    if (event.button === 2 && secondaryHeld) {
      secondaryHeld = false
      secondaryReleased = true
    }
  }

  const onBlur = () => {
    resetPulses()
    resetHeldState()
  }

  const onContextMenu = (event) => event.preventDefault()

  return {
    start(domElement) {
      element = domElement ?? null
      if (!element) return
      element.addEventListener('click', requestLock)
      element.addEventListener('mousedown', onMouseDown)
      element.addEventListener('mouseup', onMouseUp)
      element.addEventListener('contextmenu', onContextMenu)
      element.addEventListener('wheel', onWheel, { passive: true })
      // TAMBÉM no document (não só no canvas) — rede de segurança pro
      // mesmo bug ("o próprio menu do botão direito do Chrome aparece",
      // ver docstring do arquivo): se o evento nascer/borbulhar de um
      // jeito que não passe pelo listener do canvas (ex.: overlay de
      // HUD por cima, mesmo com `pointer-events-none`), este ainda
      // suprime.
      document.addEventListener('contextmenu', onContextMenu)
      document.addEventListener('pointerlockchange', onPointerLockChange)
      document.addEventListener('mousemove', onPointerMove)
      window.addEventListener('blur', onBlur)
    },
    stop() {
      if (element) {
        element.removeEventListener('click', requestLock)
        element.removeEventListener('mousedown', onMouseDown)
        element.removeEventListener('mouseup', onMouseUp)
        element.removeEventListener('contextmenu', onContextMenu)
        element.removeEventListener('wheel', onWheel)
      }
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('blur', onBlur)
      if (locked && document.exitPointerLock) document.exitPointerLock()
      element = null
      locked = false
      resetPulses()
      resetHeldState()
    },
    snapshot() {
      const snapshot = {
        cameraYaw: yawDelta,
        cameraPitch: pitchDelta,
        zoom: zoomDelta,
        primary: primaryPressed,
        secondaryHeld,
        secondaryReleased,
      }
      resetPulses()
      return snapshot
    },
  }
}
