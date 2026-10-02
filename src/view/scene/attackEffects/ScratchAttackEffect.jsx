import { useTexture } from '@react-three/drei'
import { SCRATCH_EMITTERS, SCRATCH_TEXTURE_PATHS } from '@/view/vfx/scratchVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'scratch'` (arranhão — ver docs/features/
 * 033-skills-de-combate-e-vfx.md, Parte 2): o IMPACTO do Scratch do Cobblemon em
 * partículas — uma marca de arranhão amarela de 7 quadros e 7 faíscas que
 * saltam e caem (config em `view/vfx/scratchVfx.js`). Pra usar num ataque:
 * `visual.effectGroup: 'scratch'`.
 *
 * O `AttackEffect` nasce no ponto de impacto, então o efeito aparece ali no
 * `effectAt` do ataque. `radius` empurra a marca golpe adentro (metade do
 * raio, até 1 m); `scale` (`attack.visual.scale`) multiplica o tamanho de
 * tudo. `revealDuration` e `length` não se aplicam.
 *
 * Dura o tempo das camadas do VFX (`scratchVfx.js`) — o
 * `effectVisualDuration` do ataque precisa ser ≥ isso,
 * senão as faíscas somem no meio.
 */
export function ScratchAttackEffect({ radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: SCRATCH_EMITTERS,
    texturePaths: SCRATCH_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(SCRATCH_TEXTURE_PATHS))
