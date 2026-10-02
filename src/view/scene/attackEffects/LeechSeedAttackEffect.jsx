import { useTexture } from '@react-three/drei'
import {
  LEECH_DRAIN_EMITTERS,
  LEECH_DRAIN_SOLO_EMITTERS,
  LEECH_SEED_EMITTERS,
  LEECH_SEED_TEXTURE_PATHS,
} from '@/view/vfx/leechSeedVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'leech-seed'` (o lançamento do Leech Seed — ver
 * docs/features/033-skills-de-combate-e-vfx.md, Parte 9): sementes voando em
 * arco de quem lançou até o alvo, e no pouso um estouro de orbes, um broto e
 * brilhos (config em `view/vfx/leechSeedVfx.js`). O `AttackEffect` nasce no
 * alvo; quem lançou fica em (0, 0, -`length`).
 */
export function LeechSeedAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: LEECH_SEED_EMITTERS,
    texturePaths: LEECH_SEED_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })
  return <group ref={groupRef} />
}

/**
 * Visual do grupo `'leech-drain'` (cada drenagem da semente, solto pelo
 * `leechSeedSystem.js`): estouro de orbes e brotos no alvo, e orbes em espiral
 * indo dele até quem plantou, que fica em (0, 0, -`length`).
 */
export function LeechDrainAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: LEECH_DRAIN_EMITTERS,
    texturePaths: LEECH_SEED_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })
  return <group ref={groupRef} />
}

/**
 * Visual do grupo `'leech-drain-solo'`: a drenagem quando quem plantou já não
 * existe (recolhido) — só o estouro e os brotos no alvo.
 */
export function LeechDrainSoloAttackEffect({ radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: LEECH_DRAIN_SOLO_EMITTERS,
    texturePaths: LEECH_SEED_TEXTURE_PATHS,
    radius,
    scale,
  })
  return <group ref={groupRef} />
}

useTexture.preload(Object.values(LEECH_SEED_TEXTURE_PATHS))
