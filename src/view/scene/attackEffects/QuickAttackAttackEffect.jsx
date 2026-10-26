import { useTexture } from '@react-three/drei'
import {
  QUICK_ATTACK_EMITTERS,
  TACKLE_TEXTURE_PATHS,
} from '@/view/vfx/tackleVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'quick-attack'` (docs/features/061-revisao-das-skills.md):
 * o acerto do Quick Attack do Cobblemon — o clarão do Tackle e as faíscas
 * próprias, no ponto de impacto (config em `view/vfx/tackleVfx.js`). As
 * linhas de velocidade da arrancada são o `lungeGroup` (o efeito do dash,
 * `ContinuousAttackEffectsView`).
 */
export function QuickAttackAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: QUICK_ATTACK_EMITTERS,
    texturePaths: TACKLE_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(TACKLE_TEXTURE_PATHS))
