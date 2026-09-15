import { useEffect, useRef } from 'react'
import { useQuery } from 'koota/react'
import { Sparkles } from '@react-three/drei'
import { ConsumeEffect, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'

/**
 * Visual de um `ConsumeEffect` (usar um consumível, ver
 * docs/features/014-arremessar-usar-e-invocar.md) — uma explosão simples de
 * partículas (`Sparkles` do drei) parada no lugar em que nasceu; some
 * sozinha quando `consumeEffectSystem` destrói a entidade ao `lifetime`
 * zerar (o desmonte do componente é automático, via `useQuery`).
 */
export function ConsumeEffectView({ entity }) {
  const groupRef = useRef()

  useEffect(() => {
    registerView(entity, groupRef.current)
    return () => unregisterView(entity)
  }, [entity])

  return (
    <group ref={groupRef}>
      <Sparkles
        count={16}
        scale={1}
        size={3}
        speed={0.6}
        noise={0.4}
        color="#8be08b"
      />
    </group>
  )
}

/**
 * Renderiza uma `ConsumeEffectView` por `ConsumeEffect` ativo — `useQuery` é
 * reativo (koota/react), então monta/desmonta sozinho ao entrar/sair do
 * resultado, sem infraestrutura de ciclo de vida extra.
 */
export function ConsumeEffectsView() {
  const effects = useQuery(ConsumeEffect, Position, Rotation)

  return (
    <>
      {effects.map((entity) => (
        <ConsumeEffectView key={entity} entity={entity} />
      ))}
    </>
  )
}
