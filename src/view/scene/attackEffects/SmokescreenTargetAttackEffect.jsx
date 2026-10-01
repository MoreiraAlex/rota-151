import { useTexture } from '@react-three/drei'
import {
  SMOKESCREEN_TARGET_EMITTERS,
  SMOKESCREEN_TEXTURE_PATHS,
} from '@/view/vfx/smokescreenVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'smokescreen-target'` (skill de status Smokescreen —
 * ver docs/features/033-skills-de-combate-e-vfx.md): a nuvem de fumaça que engole CADA alvo atingido (o `AttackEffect` nasce no corpo do alvo).
 * Config das partículas em `view/vfx/smokescreenVfx.js`.
 */
export function SmokescreenTargetAttackEffect({
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    emitters: SMOKESCREEN_TARGET_EMITTERS,
    texturePaths: SMOKESCREEN_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(SMOKESCREEN_TEXTURE_PATHS))
