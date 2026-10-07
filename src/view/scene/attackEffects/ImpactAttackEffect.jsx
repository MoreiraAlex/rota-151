import { useMemo } from 'react'
import {
  buildImpactEmitters,
  impactTexturePaths,
  resolveImpactType,
} from '@/view/vfx/impactVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'impact'` — impacto GENÉRICO por tipo (ver docs/
 * features/033-skills-de-combate-e-vfx.md): clarão + rajada de faíscas
 * cuja cor/forma muda pelo tipo do golpe, em partículas traduzidas do
 * Cobblemon (config dos 18 tipos em `view/vfx/impactVfx.js`). Feito pra ser
 * o visual padrão do ataque básico das criaturas: `visual.effectGroup:
 * 'impact'`.
 *
 * O tipo vem de `attack.visual.impactType` ou, na falta, de
 * `attack.type` (ver `AttackEffect.impactType`); vazio/desconhecido
 * cai em `'normal'`. O `AttackEffect` nasce no ponto de impacto, então o
 * efeito aparece ali no `effectAt` do ataque. `radius`/`length`/
 * `revealDuration` não se aplicam; `scale` (`attack.visual.scale`) cresce
 * clarão, faíscas e alcance.
 *
 * Dura o tempo das camadas do VFX do tipo (`impactVfx.js`; alguns tipos
 * duram mais que outros) — o `effectVisualDuration` do ataque precisa ser ≥ isso.
 */
export function ImpactAttackEffect({ radius, scale = 1, impactType }) {
  const type = resolveImpactType(impactType)
  const emitters = useMemo(() => buildImpactEmitters(type), [type])
  const texturePaths = useMemo(() => impactTexturePaths(type), [type])

  const groupRef = useParticleAttackEffect({
    emitters,
    texturePaths,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}
