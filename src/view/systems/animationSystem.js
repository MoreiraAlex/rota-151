import { AnimationState } from '@/core/traits'
import { applyAnimationClip } from '@/core/animation/applyAnimationClip'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'

/**
 * Avança o relógio de animação de cada entidade registrada e aplica o clipe
 * procedural correspondente ao AnimationState atual (decidido no core, por
 * animationStateSystem). Troca de estado é instantânea — sem crossfade.
 *
 * Vive na view porque mexe direto nos ossos do objeto Three carregado.
 * Fase: presentation (passo variável).
 */
export function animationSystem(context) {
  const { world, delta } = context

  world.query(AnimationState).forEach((entity) => {
    const entry = getAnimatedBonesEntry(entity)
    if (!entry) return

    const anim = entity.get(AnimationState)
    const clip = entry.clips[anim.id]
    if (!clip) return

    entry.elapsed += delta
    applyAnimationClip(clip, entry.bones, entry.elapsed, clip.speed || 1)
  })
}
