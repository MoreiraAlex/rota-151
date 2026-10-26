import { useTexture } from '@react-three/drei'
import {
  FURY_ATTACK_EMITTERS,
  FURY_ATTACK_TEXTURE_PATHS,
} from '@/view/vfx/furyAttackVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'fury-attack'` (Ataque de Fúria, docs/features/061-
 * revisao-das-skills.md): UMA bicada da rajada — um corte num ângulo e num
 * ponto sorteados e as faíscas dele (config em `view/vfx/furyAttackVfx.js`).
 * Cada acerto do golpe nasce um destes no contato; `scale`
 * (`attack.visual.scale`) multiplica o tamanho de tudo.
 */
export function FuryAttackAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: FURY_ATTACK_EMITTERS,
    texturePaths: FURY_ATTACK_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(FURY_ATTACK_TEXTURE_PATHS))
