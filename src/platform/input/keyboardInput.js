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
  Space: 'jump',
}

export function createKeyboardInput() {
  const pressed = new Set()

  const onKeyDown = (event) => {
    const action = KEY_MAP[event.code]
    if (!action) return
    // Evita que Espaço/setas rolem a página.
    event.preventDefault()
    pressed.add(action)
  }

  const onKeyUp = (event) => {
    const action = KEY_MAP[event.code]
    if (action) pressed.delete(action)
  }

  const clear = () => pressed.clear()

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
    },
    snapshot() {
      return {
        forward: pressed.has('forward'),
        back: pressed.has('back'),
        left: pressed.has('left'),
        right: pressed.has('right'),
        jump: pressed.has('jump'),
      }
    },
  }
}
