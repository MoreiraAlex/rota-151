import { useEffect, useRef } from 'react'
import { useQuery } from 'koota/react'
import { SummonBall, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { SUMMON_BALL_RADIUS, SUMMON_BALL_COLOR } from './summonBallVisual'

/**
 * Visual de uma `SummonBall` em voo (ver docs/features/024-esfera-de-
 * invocar.md) — sem esqueleto, então não usa `useAnimatedModel`, mesmo
 * padrão de `ProjectileView.jsx`: uma esfera simples que só existe na
 * cena e se move com `syncTransformSystem`. Some sozinha quando a esfera
 * resolve (`summonBallSystem` destrói a entidade) — `useQuery` reativo
 * desmonta este componente junto, sem cleanup manual extra.
 */
export function SummonBallView({ entity }) {
  const groupRef = useRef()

  useEffect(() => {
    registerView(entity, groupRef.current)
    return () => unregisterView(entity)
  }, [entity])

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <sphereGeometry args={[SUMMON_BALL_RADIUS, 16, 16]} />
        <meshStandardMaterial color={SUMMON_BALL_COLOR} />
      </mesh>
    </group>
  )
}

/**
 * Renderiza uma `SummonBallView` por `SummonBall` ativa — mesmo padrão de
 * `ProjectilesView`.
 */
export function SummonBallsView() {
  const balls = useQuery(SummonBall, Position, Rotation)

  return (
    <>
      {balls.map((entity) => (
        <SummonBallView key={entity} entity={entity} />
      ))}
    </>
  )
}
