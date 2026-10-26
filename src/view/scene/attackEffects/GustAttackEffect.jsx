import { useTexture } from '@react-three/drei'
import { GUST_EMITTERS, GUST_TEXTURE_PATHS } from '@/view/vfx/gustVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'gust'` (Lufada de Vento, docs/features/061-revisao-das-
 * skills.md): as lufadas correndo da criatura até o alvo e, quando chegam, o
 * sopro e o redemoinho nele (config em `view/vfx/gustVfx.js`). O
 * `AttackEffect` nasce no ponto de impacto; a criatura fica em
 * (0, 0, -`length`). `scale` (`attack.visual.scale`) multiplica o tamanho.
 */
export function GustAttackEffect({ rise, radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: GUST_EMITTERS,
    texturePaths: GUST_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(GUST_TEXTURE_PATHS))
