import { useTexture } from '@react-three/drei'
import {
  WATER_GUN_EMITTERS,
  WATER_GUN_HIT_EMITTERS,
  WATER_GUN_TEXTURE_PATHS,
} from '@/view/vfx/waterGunVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'water-gun'` (o Water Gun — ver
 * docs/features/033-skills-de-combate-e-vfx.md, Parte 10): borrifo na boca,
 * jato até o alvo, respingo e espuma no alvo (config em
 * `view/vfx/waterGunVfx.js`). O `AttackEffect` nasce no impacto; quem atacou
 * fica em (0, 0, -`length`).
 */
export function WaterGunAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: WATER_GUN_EMITTERS,
    texturePaths: WATER_GUN_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })
  return <group ref={groupRef} />
}

/**
 * Visual do grupo `'water-gun-hit'` — o respingo e a espuma de CADA tick do
 * Water Gun canalizado em feixe (`visual.channelHitGroup`), onde o jato bate
 * agora. O jato em si é o efeito de canal (`'water-jet'`,
 * `ContinuousAttackEffectsView.jsx`).
 */
export function WaterGunHitAttackEffect({ radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: WATER_GUN_HIT_EMITTERS,
    texturePaths: WATER_GUN_TEXTURE_PATHS,
    radius,
    scale,
  })
  return <group ref={groupRef} />
}

useTexture.preload(Object.values(WATER_GUN_TEXTURE_PATHS))
