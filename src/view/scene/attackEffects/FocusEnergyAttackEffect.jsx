import { useTexture } from '@react-three/drei'
import { FOCUS_ENERGY_EMITTERS, FOCUS_TEXTURE_PATHS } from '@/view/vfx/focusVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'focus-energy'` (docs/features/061-revisao-das-skills.md):
 * o "atributo subiu" avermelhado nos pés de quem usa o Focus Energy (config
 * em `view/vfx/focusVfx.js`). As faíscas que ficam no corpo enquanto ele está
 * Focado são da condição (`StatusConditionEffectsView`).
 */
export function FocusEnergyAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: FOCUS_ENERGY_EMITTERS,
    texturePaths: FOCUS_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(FOCUS_TEXTURE_PATHS))
