import { useTexture } from '@react-three/drei'
import { STATUP_EMITTERS, STATUP_TEXTURE_PATHS } from '@/view/vfx/statupVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'statup'` (atributo subiu em quem usou o golpe — o Growth,
 * ver docs/features/033-skills-de-combate-e-vfx.md): orbes subindo em espiral em
 * volta do corpo e riscos disparando do chão, o boost genérico do Cobblemon
 * (config em `view/vfx/statupVfx.js`). O `AttackEffect` nasce nos pés da
 * criatura (`area: 'self'`); `radius` é o raio da espiral.
 */
export function StatupAttackEffect({ radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: STATUP_EMITTERS,
    texturePaths: STATUP_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(STATUP_TEXTURE_PATHS))
