import { useTexture } from '@react-three/drei'
import {
  THUNDER_WAVE_EMITTERS,
  THUNDER_WAVE_TEXTURE_PATHS,
} from '@/view/vfx/thunderWaveVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'thunder-wave'` (Onda de Trovão, docs/features/061-
 * revisao-das-skills.md): os anéis saindo de quem usa, correndo até o alvo
 * e, quando chegam, o anel enorme, os anéis girando e as faíscas da
 * paralisia (config em `view/vfx/thunderWaveVfx.js`). O `AttackEffect` nasce
 * no contato orientado pro golpe; a criatura fica em (0, 0, -`length`).
 */
export function ThunderWaveAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: THUNDER_WAVE_EMITTERS,
    texturePaths: THUNDER_WAVE_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(THUNDER_WAVE_TEXTURE_PATHS))
