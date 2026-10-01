import { useTexture } from '@react-three/drei'
import {
  SMOKESCREEN_EMITTERS,
  SMOKESCREEN_TEXTURE_PATHS,
} from '@/view/vfx/smokescreenVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'smokescreen'` (skill de status Smokescreen —
 * ver docs/features/033-skills-de-combate-e-vfx.md): o sopro e a nuvem de fumaça ao longo do cone, saindo da boca (o `AttackEffect` nasce na ponta do cone; a criatura fica em (0, 0, -`length`)).
 * Config das partículas em `view/vfx/smokescreenVfx.js`.
 */
export function SmokescreenAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: SMOKESCREEN_EMITTERS,
    texturePaths: SMOKESCREEN_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(SMOKESCREEN_TEXTURE_PATHS))
