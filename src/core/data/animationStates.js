import { GAME_CONFIG } from '../gameConfig'

const { WALK_MIN_SPEED, RUN_MIN_SPEED } = GAME_CONFIG.ANIMATION

/**
 * Tabela de resolução de estado de animação — uma lista ordenada de
 * `{ id, when, oneShot? }`; a primeira cuja condição bate, vence. `ctx` é
 * `{ speed, grounded, action }` — `action` é o `ActionState.current` da
 * entidade (`null` quando livre).
 *
 * Cresce depois (mais estados, condições novas) sem trocar o formato. Ações
 * disparadas (dash, arremesso, invocar/recolher criatura, e no futuro uso/
 * morrer) vêm antes da locomoção — enquanto uma ação está em andamento,
 * ela decide a animação, não a velocidade/grounded do momento.
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
  // 'summon' (invocar criatura, ver docs/features/017-locomocao-e-
  // recolhimento-de-criaturas.md) reusa o MESMO clipe/id do arremesso —
  // pedido explícito do usuário ("usar a animação de arremesso" pra
  // invocar), não um clipe novo. Por isso não é uma entrada própria: o
  // `when` do 'throw' bate pras duas ações, e `AnimationState.id` acaba
  // sendo 'throw' também ao invocar — `animationSystem.js` busca
  // `entry.clips['throw']` normalmente, sem saber que a ação de verdade
  // foi outra.
  {
    id: 'throw',
    oneShot: true,
    when: (ctx) => ctx.action === 'throw' || ctx.action === 'summon',
  },
  // 'recall' (recolher criatura) ainda não tem clipe próprio autorado —
  // fica com o id dela mesma (não reusa 'throw'), então
  // `animationSystem.js` cai no fallback de "clipe ausente" (pose de
  // descanso) até o clipe chegar em `core/data/species/<id>/clips/
  // recall.json` — o mecanismo (oneShot, resolução por ActionState.current)
  // já fica pronto, só falta o conteúdo.
  { id: 'recall', oneShot: true, when: (ctx) => ctx.action === 'recall' },
  // Ataque comum de criatura (ver docs/features/025-ataque-comum-de-
  // criatura.md) — mesmo mecanismo de 'recall': o `id` já existe e já é
  // resolvido por `ActionState.current === 'attack'`, mas nenhuma espécie
  // tem `clips.attack` autorado ainda (animação específica de cada
  // criatura é trabalho separado, em andamento por fora desta feature).
  // Até lá, `animationSystem.js` cai no fallback de "clipe ausente" (pose
  // de descanso) — a arquitetura já fica pronta pra tocar o clipe de
  // verdade assim que `clips.attack` existir, sem mudar nada aqui.
  { id: 'attack', oneShot: true, when: (ctx) => ctx.action === 'attack' },
  { id: 'run', when: (ctx) => ctx.grounded && ctx.speed > RUN_MIN_SPEED },
  { id: 'walk', when: (ctx) => ctx.grounded && ctx.speed > WALK_MIN_SPEED },
  // No ar (subindo OU descendo — pulo inteiro, um clipe só, sem separar
  // "início do pulo" de "caindo") — pedido do usuário ("vou implementar
  // as animações de dash e falling no boy"). CÍCLICO, não `oneShot`
  // (mesmo grupo de walk/run/idle): fica no ar por tempo variável
  // (depende da altura/física, não uma duração fixa como um gesto de
  // ação), então não existe "fase certa" de início — sample contínuo do
  // relógio compartilhado, sem reiniciar ao entrar no estado. `grounded`
  // já vem certo de `characterPhysicsSystem.js` (trait `Grounded`, tag de
  // presença) — nenhum dado novo precisou ser calculado aqui, só faltava
  // esta entrada na tabela.
  { id: 'fall', when: (ctx) => !ctx.grounded },
  // Fallback: parado no chão.
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
