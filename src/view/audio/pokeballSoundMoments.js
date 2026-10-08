/**
 * Quais sons da Pokébola tocar (docs/features/043-captura.md), comparando o
 * que a view viu da bola de captura no frame anterior (`seen`, ou `null` se
 * ela acabou de aparecer) com o estado dela agora (`CaptureBall`). Devolve as
 * chaves de `POKEBALL_SOUNDS`, na ordem em que aconteceram. Puro.
 */
export function resolveBallSoundMoments(seen, ball) {
  if (!seen) {
    // Apareceu: saiu da mão. (Se já apareceu em outra fase, só segue.)
    return ball.state === 'flying' ? ['throw'] : []
  }
  const moments = []
  if (seen.state !== ball.state) {
    if (ball.state === 'absorbing') moments.push('hit', 'open')
    if (ball.state === 'falling') moments.push('shut')
    if (ball.state === 'shaking') moments.push('bounce')
    if (ball.state === 'caught') moments.push('caught')
    if (ball.state === 'escaped') moments.push('break')
  }
  if (ball.shakes > seen.shakes) moments.push('shake')
  if (ball.landings > seen.landings) moments.push('bounce')
  return moments
}

/** A bola sumiu: a que errou quebra; as outras já tocaram o fim delas. */
export function resolveBallGoneMoments(seen) {
  return seen?.state === 'missed' ? ['break'] : []
}
