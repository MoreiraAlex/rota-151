import { useTexture } from '@react-three/drei'
import { WRAP_TARGET_EMITTERS, WRAP_TEXTURE_PATHS } from '@/view/vfx/wrapVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'wrap-target'` (Enrolar, docs/features/061-revisao-das-
 * skills.md): os anéis apertando em volta de CADA alvo atingido (o
 * `AttackEffect` nasce no corpo do alvo, virado como ele, e `body` é o
 * tamanho dele). Os anéis que ficam enquanto ele está Preso são do
 * `StatusConditionEffectsView`.
 */
export function WrapTargetAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
  body = null,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: WRAP_TARGET_EMITTERS,
    texturePaths: WRAP_TEXTURE_PATHS,
    length,
    radius,
    scale,
    body,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(WRAP_TEXTURE_PATHS))
