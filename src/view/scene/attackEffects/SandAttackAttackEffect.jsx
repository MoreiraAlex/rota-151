import { useTexture } from '@react-three/drei'
import {
  SAND_ATTACK_EMITTERS,
  SAND_ATTACK_TARGET_EMITTERS,
  SAND_ATTACK_TEXTURE_PATHS,
} from '@/view/vfx/sandAttackVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'sand-attack'` (Ataque de Areia, docs/features/061-
 * revisao-das-skills.md): a areia chutada da criatura em arco até o alvo e a
 * poeira junto (config em `view/vfx/sandAttackVfx.js`). O `AttackEffect`
 * nasce no impacto orientado pro golpe; a criatura fica em (0, 0, -`length`).
 */
export function SandAttackAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: SAND_ATTACK_EMITTERS,
    texturePaths: SAND_ATTACK_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

/**
 * Visual do grupo `'sand-attack-target'`: os grãos estourando e a nuvem de
 * poeira no alvo atingido, quando a areia chega (o `AttackEffect` nasce no
 * corpo do alvo, virado como ele, e `body` é o tamanho dele).
 */
export function SandAttackTargetAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
  body = null,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: SAND_ATTACK_TARGET_EMITTERS,
    texturePaths: SAND_ATTACK_TEXTURE_PATHS,
    length,
    radius,
    scale,
    body,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(SAND_ATTACK_TEXTURE_PATHS))
