import { GAME_CONFIG } from '../gameConfig'

const { WALK_MIN_SPEED, RUN_MIN_SPEED } = GAME_CONFIG.ANIMATION

/**
 * Tabela de resolução de estado de animação — uma lista ordenada de
 * `{ id, when, oneShot? }`; a primeira cuja condição bate, vence. `ctx` é
 * `{ speed, grounded, action }` — `action` é o `ActionState.current` da
 * entidade (`null` quando livre).
 *
 * Cresce depois (mais estados, condições novas) sem trocar o formato. Ações
 * disparadas (dash, arremesso, e no futuro uso/invocar/recolher/morrer) vêm
 * antes da locomoção — enquanto uma ação está em andamento, ela decide a
 * animação, não a velocidade/grounded do momento.
 *
 * `oneShot: true` marca um clipe de AÇÃO (não cíclico, ver a skill
 * procedural-rig-animation) — `animationSystem.js` (view) usa isso pra
 * reiniciar o relógio do clipe (`entry.elapsed = 0`) sempre que entra
 * nesse estado, em vez de continuar de onde o relógio compartilhado
 * estava. Sem isso, disparar a ação de novo antes do relógio ter dado uma
 * volta completa faz o clipe recomeçar NO MEIO (a curva é periódica, então
 * amostrar num `elapsed` alto qualquer cai numa fase qualquer do ciclo) —
 * visualmente, "termina o resto do gesto anterior antes de começar o
 * novo". Estados cíclicos (walk/run/idle) não marcam `oneShot`: continuar
 * a mesma fase entre entradas é inofensivo (não existe "fase certa" de
 * início pra um ciclo de passada) e mantém a passada mais orgânica.
 */
export const ANIMATION_STATES = [
  { id: 'dash', oneShot: true, when: (ctx) => ctx.action === 'dash' },
  { id: 'throw', oneShot: true, when: (ctx) => ctx.action === 'throw' },
  { id: 'run', when: (ctx) => ctx.grounded && ctx.speed > RUN_MIN_SPEED },
  { id: 'walk', when: (ctx) => ctx.grounded && ctx.speed > WALK_MIN_SPEED },
  // Fallback: parado ou no ar (sem clipe de queda ainda).
  { id: 'idle', when: () => true },
]

const ONE_SHOT_ANIMATION_IDS = new Set(
  ANIMATION_STATES.filter((state) => state.oneShot).map((state) => state.id),
)

export function resolveAnimationState(ctx) {
  return ANIMATION_STATES.find((state) => state.when(ctx)).id
}

export function isOneShotAnimationState(id) {
  return ONE_SHOT_ANIMATION_IDS.has(id)
}
