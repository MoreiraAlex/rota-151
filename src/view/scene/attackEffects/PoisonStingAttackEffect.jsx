import { useTexture } from '@react-three/drei'
import {
  POISON_STING_EMITTERS,
  POISON_TEXTURE_PATHS,
} from '@/view/vfx/poisonVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'poison-sting'` (Ferrão Venenoso, docs/features/061-
 * revisao-das-skills.md): o ferrão roxo que sai da criatura até o alvo, com
 * rastro, e no acerto o respingo e as bolhas de veneno (config em
 * `view/vfx/poisonVfx.js`). O `AttackEffect` nasce no ponto de impacto; a
 * criatura fica em (0, 0, -`length`). `scale` (`attack.visual.scale`)
 * multiplica o tamanho de tudo.
 */
export function PoisonStingAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: POISON_STING_EMITTERS,
    texturePaths: POISON_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(POISON_TEXTURE_PATHS))
