import { useTexture } from '@react-three/drei'
import {
  ASSURANCE_EMITTERS,
  ASSURANCE_TEXTURE_PATHS,
} from '@/view/vfx/assuranceVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'assurance'` (Garantia, docs/features/061-revisao-das-
 * skills.md): a marca escura, o golpe e os pontos estourando do acerto do
 * Pursuit na frente do alvo (config em `view/vfx/assuranceVfx.js`). Nasce no
 * ponto de impacto; `scale` (`attack.visual.scale`, vezes o
 * `visual.boostedScale` no acerto com o poder maior) multiplica o tamanho de
 * tudo, e o `effectVisualDuration` do ataque precisa cobrir os pontos.
 */
export function AssuranceAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: ASSURANCE_EMITTERS,
    texturePaths: ASSURANCE_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(ASSURANCE_TEXTURE_PATHS))
