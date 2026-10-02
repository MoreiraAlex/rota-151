import { useTexture } from '@react-three/drei'
import { TACKLE_EMITTERS, TACKLE_TEXTURE_PATHS } from '@/view/vfx/tackleVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'tackle'` (ataque básico de Charmander e Squirtle — ver docs/features/033-skills-de-combate-e-vfx.md): o
 * IMPACTO do Tackle do Cobblemon em partículas — um clarão amarelo e 7
 * faíscas que saltam e caem (config em `view/vfx/tackleVfx.js`). Substitui a
 * malha de arranhão revelada progressivamente (`EffCommontackle`).
 *
 * O `AttackEffect` nasce no ponto de impacto, então o efeito aparece ali
 * no `effectAt` do ataque. `radius`/`revealDuration`/`length` não se
 * aplicam (o clarão tem tamanho fixo); `scale` (`attack.visual.scale`)
 * multiplica o tamanho de tudo.
 *
 * Dura o tempo das camadas do VFX (`tackleVfx.js`) — o
 * `effectVisualDuration` do ataque precisa ser ≥ isso, senão
 * as faíscas somem no meio.
 */
export function TackleAttackEffect({ radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: TACKLE_EMITTERS,
    texturePaths: TACKLE_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(TACKLE_TEXTURE_PATHS))
