import { useTexture } from '@react-three/drei'
import {
  ELECTRO_BALL_EMITTERS,
  ELECTRO_BALL_TEXTURE_PATHS,
} from '@/view/vfx/electroBallVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'electro-ball'` (Bola Elétrica, docs/features/061-revisao-
 * das-skills.md): o anel do lançamento, a bola voando de quem usa até o alvo
 * com o rastro de fagulhas e, quando chega, o impacto elétrico (config em
 * `view/vfx/electroBallVfx.js`). O `AttackEffect` nasce no contato orientado
 * pro golpe; a criatura fica em (0, 0, -`length`). A bola se formando
 * durante a carga é do `ContinuousAttackEffectsView`.
 */
export function ElectroBallAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: ELECTRO_BALL_EMITTERS,
    texturePaths: ELECTRO_BALL_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(ELECTRO_BALL_TEXTURE_PATHS))
