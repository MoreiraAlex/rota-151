import { useTexture } from '@react-three/drei'
import { BITE_EMITTERS, BITE_TEXTURE_PATHS } from '@/view/vfx/biteVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'bite'` (Mordida): as presas fechando na frente do alvo e
 * as faíscas que estouram dela, em partículas traduzidas do Cobblemon (config
 * em `view/vfx/biteVfx.js`). Pra usar num ataque: `visual.effectGroup:
 * 'bite'`.
 *
 * O `AttackEffect` nasce no ponto de impacto (o contato com o alvo), então o
 * efeito aparece ali no `effectAt` do ataque. `scale` (`attack.visual.scale`)
 * multiplica o tamanho de tudo. Dura o tempo das camadas do VFX — o
 * `effectVisualDuration` do ataque precisa cobrir as faíscas.
 */
export function BiteAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: BITE_EMITTERS,
    texturePaths: BITE_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(BITE_TEXTURE_PATHS))
