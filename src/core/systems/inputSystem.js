import { InputState, InputControlled } from '../traits'

/**
 * Converte o snapshot de input bruto (context.input) em um vetor de intenção
 * no plano do mundo, escrito no trait InputState das entidades controladas.
 *
 * Headless: lê apenas context.input; nunca acessa o teclado ou o DOM.
 * Fase: input.
 *
 * Eixos: forward = -z, back = +z, left = -x, right = +x.
 */
export function inputSystem(context) {
  const { world } = context
  const input = context.input ?? {}

  let x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  let z = (input.back ? 1 : 0) - (input.forward ? 1 : 0)

  const magnitude = Math.hypot(x, z)
  if (magnitude > 1) {
    x /= magnitude
    z /= magnitude
  }

  world.query(InputControlled, InputState).updateEach(([state]) => {
    state.x = x
    state.z = z
  })
}
