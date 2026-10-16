import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/capsule'

/**
 * Contas do laboratório de corpo (`BodyLab.jsx`), as mesmas do jogo: o
 * centro da cápsula (`Position`) fica acima do chão o quanto a cápsula desce
 * (`verticalClearance`) mais a folga do character controller
 * (`CONTROLLER_OFFSET`), e o modelo fica no centro + `body.modelOffset`.
 */
export function resolveCapsuleCenterHeight(body) {
  return (
    verticalClearance(body) + GAME_CONFIG.PHYSICS.CHARACTER.CONTROLLER_OFFSET
  )
}

/** Tamanho da cápsula: comprimento no eixo dela e altura total no mundo. */
export function resolveCapsuleSize(body) {
  const length = 2 * (body.capsuleRadius + body.capsuleHalfHeight)
  const height = body.capsuleAxis === 'y' ? length : 2 * body.capsuleRadius
  return { length, height }
}

/**
 * `modelOffset.y` que encosta o ponto mais baixo do modelo no chão, dado
 * onde ele está agora (`modelBottom`, metros acima do chão).
 */
export function resolveGroundedOffsetY(modelOffset, modelBottom) {
  return modelOffset[1] - modelBottom
}

const round = (value) => Number(value.toFixed(3))

/**
 * Trecho pra colar no `index.js` da espécie: a linha do `scale` (vai dentro
 * de `model`) e o bloco `body`.
 */
export function formatBodySnippet(body, scale) {
  const offset = body.modelOffset.map(round).join(', ')
  return [
    `    scale: ${round(scale)},`,
    '',
    '  body: {',
    `    capsuleRadius: ${round(body.capsuleRadius)},`,
    `    capsuleHalfHeight: ${round(body.capsuleHalfHeight)},`,
    `    capsuleAxis: '${body.capsuleAxis}',`,
    `    modelOffset: [${offset}],`,
    // não é ajustado aqui, mas faz parte do bloco: colar sem ele o apagaria
    ...(body.flightHeight === undefined
      ? []
      : [`    flightHeight: ${round(body.flightHeight)},`]),
    '  },',
  ].join('\n')
}
