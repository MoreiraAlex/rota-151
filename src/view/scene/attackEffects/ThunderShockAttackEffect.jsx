import { useTexture } from '@react-three/drei'
import {
  THUNDER_SHOCK_EMITTERS,
  THUNDER_SHOCK_TEXTURE_PATHS,
} from '@/view/vfx/thunderShockVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'thunder-shock'` (Choque do Trovão, docs/features/061-
 * revisao-das-skills.md): o raio de quem usa até o alvo e, no contato, as
 * faíscas, o choque e os estilhaços elétricos (config em `view/vfx/
 * thunderShockVfx.js`). O `AttackEffect` nasce no contato orientado pro
 * golpe; a criatura fica em (0, 0, -`length`), de onde o raio sai. As
 * faíscas no corpo durante a carga são do `ContinuousAttackEffectsView`.
 */
export function ThunderShockAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: THUNDER_SHOCK_EMITTERS,
    texturePaths: THUNDER_SHOCK_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(THUNDER_SHOCK_TEXTURE_PATHS))
