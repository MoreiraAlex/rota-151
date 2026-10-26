import { useTexture } from '@react-three/drei'
import {
  RAZOR_LEAF_HIT_EMITTERS,
  RAZOR_LEAF_TEXTURE_PATHS,
} from '@/view/vfx/razorLeafVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'razor-leaf-hit'` — os cortes e as lascas de folha de CADA
 * tick do Razor Leaf (`visual.channelHitGroup`), na frente de cada alvo dentro
 * do cone. A subida e a rajada de folhas são efeitos de carga e de canal
 * (`'razor-leaf-charge'`/`'razor-leaf'`, `ContinuousAttackEffectsView.jsx`).
 */
export function RazorLeafHitAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: RAZOR_LEAF_HIT_EMITTERS,
    texturePaths: RAZOR_LEAF_TEXTURE_PATHS,
    radius,
    scale,
  })
  return <group ref={groupRef} />
}

useTexture.preload(Object.values(RAZOR_LEAF_TEXTURE_PATHS))
