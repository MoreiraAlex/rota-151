import { useTexture } from '@react-three/drei'
import {
  BUG_BITE_EMITTERS,
  BUG_BITE_TEXTURE_PATHS,
} from '@/view/vfx/bugBiteVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'bug-bite'` (Picada, docs/features/061-revisao-das-
 * skills.md): as presas de inseto fechando na frente do alvo e as faíscas que
 * estouram dela (config em `view/vfx/bugBiteVfx.js`). Nasce no ponto de
 * impacto; `scale` (`attack.visual.scale`) multiplica o tamanho de tudo, e o
 * `effectVisualDuration` do ataque precisa cobrir as faíscas.
 */
export function BugBiteAttackEffect({ rise, radius, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: BUG_BITE_EMITTERS,
    texturePaths: BUG_BITE_TEXTURE_PATHS,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(BUG_BITE_TEXTURE_PATHS))
