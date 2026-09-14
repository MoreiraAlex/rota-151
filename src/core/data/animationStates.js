import { GAME_CONFIG } from '../gameConfig'

const { WALK_MIN_SPEED, RUN_MIN_SPEED } = GAME_CONFIG.ANIMATION

/**
 * Tabela de resolução de estado de animação — uma lista ordenada de
 * `{ id, when }`; a primeira cuja condição bate, vence. `ctx` é
 * `{ speed, grounded, action }` — `action` é o `ActionState.current` da
 * entidade (`null` quando livre).
 *
 * Cresce depois (mais estados, condições novas) sem trocar o formato. Ações
 * disparadas (dash, e no futuro arremesso/uso/invocar/recolher/morrer) vêm
 * antes da locomoção — enquanto uma ação está em andamento, ela decide a
 * animação, não a velocidade/grounded do momento.
 */
export const ANIMATION_STATES = [
  { id: 'dash', when: (ctx) => ctx.action === 'dash' },
  { id: 'run', when: (ctx) => ctx.grounded && ctx.speed > RUN_MIN_SPEED },
  { id: 'walk', when: (ctx) => ctx.grounded && ctx.speed > WALK_MIN_SPEED },
  // Fallback: parado ou no ar (sem clipe de queda ainda).
  { id: 'idle', when: () => true },
]

export function resolveAnimationState(ctx) {
  return ANIMATION_STATES.find((state) => state.when(ctx)).id
}
