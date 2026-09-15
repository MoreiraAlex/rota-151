/**
 * Adapter de input de teclado.
 *
 * É o único módulo que fala com o DOM para captura de input. Mantém o conjunto
 * de teclas pressionadas e expõe um snapshot semântico que o game loop injeta
 * no contexto da simulação. Nenhuma regra de jogo mora aqui.
 */
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
}

// Ações de disparo único ("apertou agora", não "está segurando") — ao
// contrário de KEY_MAP, viram um pulso que o snapshot() drena, igual ao
// pointerInput.js faz com os deltas de mouse. Segurar a tecla não repete: o
// SO dispara `keydown` de novo em auto-repeat, mas `event.repeat` filtra isso.
// `jump` estava em KEY_MAP (estado contínuo) até virar pulso aqui: segurar
// Espaço fazia pular de novo assim que aterrissava, sem soltar a tecla.
const EDGE_KEY_MAP = {
  Space: 'jump',
  KeyQ: 'dash',
  KeyE: 'dash',
  // Botões de ação secundários (ver docs/features/011-slots-de-acao.md) — o
  // primário é o clique esquerdo do mouse, tratado em pointerInput.js.
  Digit1: 'secondary1',
  Digit2: 'secondary2',
  Digit3: 'secondary3',
}

export function createKeyboardInput() {
  const pressed = new Set()
  const justPressed = new Set()

  const onKeyDown = (event) => {
    const action = KEY_MAP[event.code]
    const edgeAction = EDGE_KEY_MAP[event.code]
    if (!action && !edgeAction) return
    // Evita que Espaço/setas rolem a página.
    event.preventDefault()
    if (action) pressed.add(action)
    if (edgeAction && !event.repeat) justPressed.add(edgeAction)
  }

  const onKeyUp = (event) => {
    const action = KEY_MAP[event.code]
    if (action) pressed.delete(action)
  }

  const clear = () => {
    pressed.clear()
    justPressed.clear()
  }

  return {
    start() {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      // Ao perder o foco da janela não recebemos o keyup — zera para não "grudar".
      window.addEventListener('blur', clear)
    },
    stop() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
      pressed.clear()
      justPressed.clear()
    },
    snapshot() {
      const snapshot = {
        forward: pressed.has('forward'),
        back: pressed.has('back'),
        left: pressed.has('left'),
        right: pressed.has('right'),
        run: pressed.has('run'),
        jump: justPressed.has('jump'),
        dash: justPressed.has('dash'),
        secondary1: justPressed.has('secondary1'),
        secondary2: justPressed.has('secondary2'),
        secondary3: justPressed.has('secondary3'),
      }
      justPressed.clear()
      return snapshot
    },
  }
}
