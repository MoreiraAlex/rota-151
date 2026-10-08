import { Suspense, useCallback, useRef, useLayoutEffect } from 'react'
import { useQuery } from 'koota/react'
import { resolvePokemonBallId } from '@/core/actions/pokemon'
import {
  Position,
  Rotation,
  SummonBall,
  SummonBallOpen,
  SummonedFrom,
} from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerBallView,
  setBallViewModel,
  unregisterBallView,
} from '../registry/ballViewRegistry'
import { ItemModel, hasItemModel } from './ItemModel'
import { SUMMON_BALL_COLOR, SUMMON_BALL_RADIUS } from './summonBallVisual'

/**
 * Uma Pokébola do invocar (docs/features/024-esfera-de-invocar.md,
 * docs/features/043-captura.md): o modelo da bola `itemId` num grupo que o
 * `summonBallViewSystem.js` anima (clipes do `.glb`). Sem modelo, a esfera
 * de antes. Some quando a entidade some (`useQuery` reativo).
 */
function BallView({ entity, itemId }) {
  const groupRef = useRef()
  const spinRef = useRef()
  const onModel = useCallback(
    (model) => setBallViewModel(entity, model),
    [entity],
  )

  useLayoutEffect(() => {
    registerView(entity, groupRef.current)
    registerBallView(entity, spinRef, itemId)
    return () => {
      unregisterView(entity)
      unregisterBallView(entity)
    }
  }, [entity, itemId])

  const sphere = (
    <mesh castShadow>
      <sphereGeometry args={[SUMMON_BALL_RADIUS, 16, 16]} />
      <meshStandardMaterial color={SUMMON_BALL_COLOR} />
    </mesh>
  )
  return (
    <group ref={groupRef}>
      <group ref={spinRef}>
        {hasItemModel(itemId) ? (
          <Suspense fallback={sphere}>
            <ItemModel itemId={itemId} onModel={onModel} />
          </Suspense>
        ) : (
          sphere
        )}
      </group>
    </group>
  )
}

/** A bola em voo: a Pokébola em que o Pokémon foi capturado. */
export function SummonBallsView() {
  const balls = useQuery(SummonBall, Position, Rotation)

  return (
    <>
      {balls.map((entity) => (
        <BallView
          key={entity}
          entity={entity}
          itemId={resolvePokemonBallId(entity.targetFor(SummonedFrom))}
        />
      ))}
    </>
  )
}

/** A bola abrindo em cima de onde a criatura nasceu (`SummonBallOpen`). */
export function SummonBallOpensView() {
  const opens = useQuery(SummonBallOpen, Position, Rotation)

  return (
    <>
      {opens.map((entity) => (
        <BallView
          key={entity}
          entity={entity}
          itemId={entity.get(SummonBallOpen).itemId}
        />
      ))}
    </>
  )
}
