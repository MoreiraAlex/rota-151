import { useEffect, useRef } from 'react'
import { useQuery } from 'koota/react'
import { Projectile, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { THROWABLE_RADIUS, THROWABLE_COLOR } from './throwableVisual'

/**
 * Visual de um `Projectile` (ver docs/features/014-arremessar-usar-e-
 * invocar.md) — sem esqueleto, então não usa `useAnimatedModel`: uma esfera
 * simples só pra existir na cena e se mover com `syncTransformSystem`.
 * Mesma esfera do item na mão antes de arremessar — ver `throwableVisual.js`.
 */
export function ProjectileView({ entity }) {
  const groupRef = useRef()

  useEffect(() => {
    registerView(entity, groupRef.current)
    return () => unregisterView(entity)
  }, [entity])

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <sphereGeometry args={[THROWABLE_RADIUS, 12, 12]} />
        <meshStandardMaterial color={THROWABLE_COLOR} />
      </mesh>
    </group>
  )
}

/**
 * Renderiza uma `ProjectileView` por `Projectile` ativo — `useQuery` é
 * reativo (koota/react), então monta/desmonta sozinho ao entrar/sair do
 * resultado, sem infraestrutura de ciclo de vida extra.
 */
export function ProjectilesView() {
  const projectiles = useQuery(Projectile, Position, Rotation)

  return (
    <>
      {projectiles.map((entity) => (
        <ProjectileView key={entity} entity={entity} />
      ))}
    </>
  )
}
