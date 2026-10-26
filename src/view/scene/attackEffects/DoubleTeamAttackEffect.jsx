import { useTexture } from '@react-three/drei'
import {
  DOUBLE_TEAM_EMITTERS,
  DOUBLE_TEAM_TEXTURE_PATHS,
} from '@/view/vfx/doubleTeamVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'double-team'` (Bando Duplo, docs/features/061-revisao-
 * das-skills.md): as linhas de velocidade pros lados, nos pés de quem usa
 * (config em `view/vfx/doubleTeamVfx.js`). Os vultos são do
 * `afterimageSystem`.
 */
export function DoubleTeamAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: DOUBLE_TEAM_EMITTERS,
    texturePaths: DOUBLE_TEAM_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(DOUBLE_TEAM_TEXTURE_PATHS))
