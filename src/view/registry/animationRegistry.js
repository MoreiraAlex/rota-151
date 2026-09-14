/**
 * Registro entidade → ossos resolvidos + clipes de animação procedural.
 * Mesmo padrão do viewRegistry: o componente registra no useEffect, o
 * animationSystem lê e aplica o clipe.
 *
 * `clips` mapeia o id de AnimationState (core/data/animationStates.js) para o
 * clipe JSON daquela espécie (core/data/species). `elapsed` é o relógio de
 * animação da entidade, avançado pelo animationSystem a cada frame — cada
 * entidade tem o seu, independente das outras.
 *
 * `stateId` guarda o último AnimationState.id visto, pra o animationSystem
 * detectar troca de estado. `blend`, quando não nulo, é o crossfade em
 * andamento (`{ fromPose, elapsed }` — ver applyBlendedAnimationClip em
 * core/animation).
 */
const entries = new Map()

export function registerAnimatedBones(entity, { bones, clips }) {
  entries.set(entity, { bones, clips, elapsed: 0, stateId: null, blend: null })
}

export function unregisterAnimatedBones(entity) {
  entries.delete(entity)
}

export function getAnimatedBonesEntry(entity) {
  return entries.get(entity)
}
