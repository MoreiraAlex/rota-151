import { AnimationState } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  applyAnimationClip,
  applyBlendedAnimationClip,
  capturePose,
} from '@/core/animation/applyAnimationClip'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'

const { BLEND_DURATION } = GAME_CONFIG.ANIMATION

// Estado sem clipe ainda autorado (ex.: uma ação nova, antes do JSON existir
// em core/data/species/<id>/clips/) não deveria congelar no que sobrou do
// clipe anterior — vira "sem override nenhum", que sampleAnimationClip
// resolve como a pose de descanso pura. Mesmo raciocínio do reset-to-rest de
// applyAnimationClip.js, só que pro clipe inteiro faltar, não só um osso.
const EMPTY_CLIP = { bones: {} }

/**
 * Avança o relógio de animação de cada entidade registrada e aplica o clipe
 * procedural correspondente ao AnimationState atual (decidido no core, por
 * animationStateSystem).
 *
 * Troca de estado dispara um crossfade em vez de corte seco: a pose exibida
 * no frame da troca vira uma fotografia estática (`capturePose`), e o clipe
 * novo entra por cima dela ao longo de `BLEND_DURATION` segundos
 * (`applyBlendedAnimationClip`). Uma troca no meio de outra troca só atualiza
 * o alvo — a fotografia de partida continua sendo a mesma da troca anterior,
 * então nunca há um salto visível, só uma curva de mistura mais curta.
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
    const clip = entry.clips[anim.id] ?? EMPTY_CLIP

    entry.elapsed += delta

    if (entry.stateId === null) {
      entry.stateId = anim.id
    } else if (anim.id !== entry.stateId) {
      entry.blend = { fromPose: capturePose(entry.bones), elapsed: 0 }
      entry.stateId = anim.id
    }

    if (!entry.blend) {
      applyAnimationClip(clip, entry.bones, entry.elapsed, clip.speed || 1)
      return
    }

    entry.blend.elapsed += delta
    if (entry.blend.elapsed >= BLEND_DURATION) {
      entry.blend = null
      applyAnimationClip(clip, entry.bones, entry.elapsed, clip.speed || 1)
      return
    }

    const alpha = entry.blend.elapsed / BLEND_DURATION
    applyBlendedAnimationClip(
      entry.blend.fromPose,
      clip,
      entry.bones,
      entry.elapsed,
      alpha,
      clip.speed || 1,
    )
  })
}
