/**
 * Que chaves do jogo (`species.nativeAnimations`) tocam cada animação do
 * `.glb` — só pra legenda do laboratório de animação. Uma entrada pode ser o
 * nome solto, `{ animation }`, `{ sequence: [...] }` ou `{ start, loop, end }`.
 * Devolve nomeDaAnimação → lista de chaves.
 */
export function gameKeysByAnimation(nativeAnimations = {}) {
  const keys = {}
  const add = (animation, key) => {
    if (!animation) return
    keys[animation] ??= []
    if (!keys[animation].includes(key)) keys[animation].push(key)
  }

  for (const [key, entry] of Object.entries(nativeAnimations)) {
    for (const animation of animationsOf(entry)) add(animation, key)
  }
  return keys
}

function animationsOf(entry) {
  if (typeof entry === 'string') return [entry]
  if (!entry) return []
  if (entry.sequence) return entry.sequence.flatMap(animationsOf)
  if (entry.animation) return [entry.animation]
  return [entry.start, entry.loop, entry.end].filter(Boolean)
}
