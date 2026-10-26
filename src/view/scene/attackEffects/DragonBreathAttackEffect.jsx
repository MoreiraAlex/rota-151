import { useTexture } from '@react-three/drei'
import {
  DRAGON_BREATH_EMITTERS,
  DRAGON_BREATH_TEXTURE_PATHS,
} from '@/view/vfx/dragonBreathVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'dragon-breath'`: o sopro verde-azulado saindo da boca
 * até o alvo e a explosão de energia nele, em partículas traduzidas do Cobblemon
 * (config em `view/vfx/dragonBreathVfx.js`). Pra usar num ataque:
 * `visual.effectGroup: 'dragon-breath'`.
 *
 * O `AttackEffect` nasce no ponto de impacto, orientado pela trajetória
 * (+Z local = direção do golpe); a criatura fica em (0, 0, -`length`).
 * `scale` (`attack.visual.scale`) multiplica o tamanho de tudo. Dura o
 * sopro mais a vida das últimas partículas — o `effectVisualDuration` do
 * golpe precisa cobrir isso.
 */
export function DragonBreathAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: DRAGON_BREATH_EMITTERS,
    texturePaths: DRAGON_BREATH_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(DRAGON_BREATH_TEXTURE_PATHS))
