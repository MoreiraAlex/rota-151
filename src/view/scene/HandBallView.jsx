import { Suspense, useCallback, useEffect, useRef } from 'react'
import { getItem, listItems } from '@/core/data/items'
import {
  registerHandBall,
  setHandBallModel,
  unregisterHandBall,
} from '../registry/handBallRegistry'
import { ItemModel, hasItemModel } from './ItemModel'

const DEG = Math.PI / 180
const BALL_IDS = listItems()
  .filter((item) => item.category === 'pokeball' && hasItemModel(item.id))
  .map((item) => item.id)

/** Uma bola na mão, escondida até o `handBallViewSystem` mostrar. */
function HandBall({ itemId }) {
  const groupRef = useRef()
  const onModel = useCallback(
    (model) => setHandBallModel(itemId, model),
    [itemId],
  )

  useEffect(() => {
    registerHandBall(itemId, groupRef.current)
    return () => unregisterHandBall(itemId)
  }, [itemId])

  // Mesmo ajuste na mão do item segurado (`item.model.hand`).
  const hand = getItem(itemId).model.hand ?? {}
  const position = hand.position ?? {}
  const rotation = hand.rotation ?? {}
  return (
    <group ref={groupRef} visible={false}>
      <group
        position={[position.x ?? 0, position.y ?? 0, position.z ?? 0]}
        rotation={[
          (rotation.x ?? 0) * DEG,
          (rotation.y ?? 0) * DEG,
          (rotation.z ?? 0) * DEG,
        ]}
        scale={hand.scale ?? 1}
      >
        <Suspense fallback={null}>
          <ItemModel itemId={itemId} onModel={onModel} />
        </Suspense>
      </group>
    </group>
  )
}

/**
 * A Pokébola do Pokémon na mão do treinador ao invocar e recolher
 * (docs/features/043-captura.md): uma de cada tipo, montadas uma vez e
 * escondidas — quem mostra, põe no osso e toca o clipe é o
 * `handBallViewSystem.js`.
 */
export function HandBallView() {
  return (
    <>
      {BALL_IDS.map((itemId) => (
        <HandBall key={itemId} itemId={itemId} />
      ))}
    </>
  )
}
