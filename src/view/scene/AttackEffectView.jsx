import { useEffect, useRef } from 'react'
import { useQuery } from 'koota/react'
import { AttackEffect, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { resolveAttackEffectComponent } from './attackEffects/registry'

/**
 * Visual de um `AttackEffect` (ataque comum de criatura, ver
 * docs/features/025-ataque-comum-de-criatura.md) — parado no CENTRO da
 * área efetiva (não na criatura — ver `creatureAttackSystem.js`); some
 * sozinha quando `attackEffectSystem` destrói a entidade ao `lifetime`
 * zerar. Este componente é só o WRAPPER (registro de ref + posição) — o
 * visual de verdade é escolhido por `effectGroup` (congelado no spawn,
 * `attack.visual.effectGroup` — ver `core/data/attacks/`) via
 * `resolveAttackEffectComponent` (`attackEffects/registry.js`): "muitas
 * criaturas vão compartilhar o ataque básico de arranhar, outras vão ser
 * específicas como um chicote" (pedido do usuário) — cada grupo é um
 * componente próprio, sem inchar este arquivo por golpe novo.
 *
 * `revealDuration` (de `attack.visual.revealDuration`) só é usado por
 * componentes que suportam revelação progressiva (`ScratchAttackEffect.jsx`
 * hoje) — repassado pra todos igual, componentes que não usam (ex.:
 * `PunchAttackEffect.jsx`) simplesmente ignoram o prop. `visualScale` (de
 * `attack.visual.scale`) é o multiplicador de TAMANHO do VFX — pedido do
 * usuário: "uma criatura grande vai ter o efeito maior do que o de uma
 * criatura pequena, mesmo os 2 usando o mesmo efeito" — cada componente
 * usa isso junto de `radius` e da própria constante de normalização do
 * rip (ver `ScratchAttackEffect.jsx`/`PunchAttackEffect.jsx`).
 */
export function AttackEffectView({
  entity,
  radius,
  effectGroup,
  revealDuration,
  visualScale,
}) {
  const groupRef = useRef()

  useEffect(() => {
    registerView(entity, groupRef.current)
    return () => unregisterView(entity)
  }, [entity])

  const EffectComponent = resolveAttackEffectComponent(effectGroup)

  return (
    <group ref={groupRef}>
      <EffectComponent
        radius={radius}
        revealDuration={revealDuration}
        scale={visualScale}
      />
    </group>
  )
}

/**
 * Renderiza uma `AttackEffectView` por `AttackEffect` ativo — `useQuery` é
 * reativo (koota/react), monta/desmonta sozinho ao entrar/sair do
 * resultado, mesmo padrão de `ConsumeEffectsView`.
 */
export function AttackEffectsView() {
  const effects = useQuery(AttackEffect, Position, Rotation)

  return (
    <>
      {effects.map((entity) => {
        const effect = entity.get(AttackEffect)
        return (
          <AttackEffectView
            key={entity}
            entity={entity}
            radius={effect.radius}
            effectGroup={effect.effectGroup}
            revealDuration={effect.revealDuration}
            visualScale={effect.visualScale}
          />
        )
      })}
    </>
  )
}
