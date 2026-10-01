import { useTexture } from '@react-three/drei'
import { GROWL_EMITTERS, GROWL_TEXTURE_PATHS } from '@/view/vfx/growlVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'growl'` (skill de status Growl — ver docs/features/
 * 033-skills-de-combate-e-vfx.md): ondas sonoras em arco que saem da boca e se
 * alargam até a ponta do cone (config em `view/vfx/growlVfx.js`). O
 * `AttackEffect` nasce na ponta do cone orientado pro golpe; a criatura fica em
 * (0, 0, -`length`).
 */
export function GrowlAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: GROWL_EMITTERS,
    texturePaths: GROWL_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(GROWL_TEXTURE_PATHS))
