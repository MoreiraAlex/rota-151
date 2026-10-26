import { useTexture } from '@react-three/drei'
import { PECK_EMITTERS, PECK_TEXTURE_PATHS } from '@/view/vfx/peckVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'peck'` (Bicada, docs/features/061-revisao-das-
 * skills.md): os dois cortes cruzados e o estouro de faíscas do acerto do
 * Aerial Ace na frente do alvo (config em `view/vfx/peckVfx.js`). Nasce no
 * ponto de impacto; `scale` (`attack.visual.scale`) multiplica o tamanho de
 * tudo, e o `effectVisualDuration` do ataque precisa cobrir o estouro.
 */
export function PeckAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: PECK_EMITTERS,
    texturePaths: PECK_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(PECK_TEXTURE_PATHS))
