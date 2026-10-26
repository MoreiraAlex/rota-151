import { useTexture } from '@react-three/drei'
import { GLARE_TARGET_EMITTERS, GLARE_TEXTURE_PATHS } from '@/view/vfx/glareVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'glare-target'` (Olhar Paralisante, docs/features/061-
 * revisao-das-skills.md): o rosto assustador crescendo na frente de CADA
 * alvo atingido e as faíscas da paralisia pegando (o `AttackEffect` nasce no
 * corpo do alvo, virado como ele, e `body` é o tamanho dele). As faíscas que
 * voltam enquanto ele está paralisado são do `StatusConditionEffectsView`.
 */
export function GlareTargetAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
  body = null,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: GLARE_TARGET_EMITTERS,
    texturePaths: GLARE_TEXTURE_PATHS,
    length,
    radius,
    scale,
    body,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(GLARE_TEXTURE_PATHS))
