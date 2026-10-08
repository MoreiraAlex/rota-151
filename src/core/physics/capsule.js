/**
 * Distância vertical do CENTRO da cápsula (`Position`) até o TOPO dela —
 * pra cápsula em pé (`axis: 'y'`), o topo fica `radius + halfHeight` acima
 * do centro; deitada (`'x'`/`'z'`), só o `radius` conta na vertical (o
 * `halfHeight` é horizontal, ao longo do eixo deitado). `body` é
 * `species.body` (ou o trait `CharacterController`, mesmo formato) —
 * qualquer objeto com `capsuleRadius`/`capsuleHalfHeight`/`capsuleAxis`.
 *
 * Extraída de `summonBallSystem.js` (onde morava sozinha, calculando a
 * distância até a BASE pra pousar a `SummonBall` em cima de uma
 * superfície) quando um segundo consumidor (`NameplateView.jsx`,
 * posicionar a etiqueta acima da cabeça) precisou da mesma conta, só que
 * pro lado de CIMA em vez de baixo — mesma distância, sentido oposto a
 * partir do centro (a cápsula é simétrica).
 *
 * Fica fora de `colliders.js` (que puxa o Rapier) pra quem só precisa da
 * conta — o nível de teste põe os selvagens em cima do relevo com ela
 * (docs/features/045-terreno-de-um-chunk.md).
 */
export function verticalClearance(body) {
  return body.capsuleAxis === 'y'
    ? body.capsuleRadius + body.capsuleHalfHeight
    : body.capsuleRadius
}
