import { Suspense, useEffect, useRef } from 'react'
import { useQueryFirst, useTrait } from 'koota/react'
import { getItem } from '@/core/data/items'
import { HeldItem, InputControlled } from '@/core/traits'
import {
  registerHeldItemView,
  unregisterHeldItemView,
} from '../registry/heldItemRegistry'
import { ItemModel, hasItemModel } from './ItemModel'
import { THROWABLE_COLOR, THROWABLE_RADIUS } from './throwableVisual'

const DEG = Math.PI / 180
// Categorias que aparecem na mão (quando, decide o `heldItemViewSystem`).
const SHOWN_CATEGORIES = new Set(['throwable', 'pokeball'])

/**
 * O item na mão do jogador: o modelo do próprio item (`item.model`, o mesmo
 * da bola em voo — docs/features/043-captura.md) ou, sem modelo, a esfera
 * genérica do arremesso. Fica solto na cena; o `heldItemViewSystem.js` põe
 * ele no osso da mão a cada frame e decide quando aparece. Começa escondido.
 */
export function HeldItemView() {
  const holder = useQueryFirst(InputControlled, HeldItem)
  const heldItem = useTrait(holder, HeldItem)
  const item = heldItem?.itemId ? getItem(heldItem.itemId) : null
  const groupRef = useRef()

  const itemId = SHOWN_CATEGORIES.has(item?.category) ? item.id : null

  useEffect(() => {
    if (!itemId) return
    const group = groupRef.current
    registerHeldItemView(group, itemId)
    return () => unregisterHeldItemView(group)
  }, [itemId])

  if (!itemId) return null

  const sphere = (
    <mesh castShadow>
      <sphereGeometry args={[THROWABLE_RADIUS, 12, 12]} />
      <meshStandardMaterial color={THROWABLE_COLOR} />
    </mesh>
  )
  // Ajuste do item no osso da mão (`item.model.hand`, ver `_template/`).
  const hand = item.model?.hand ?? {}
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
        {hasItemModel(itemId) ? (
          <Suspense fallback={null}>
            <ItemModel itemId={itemId} />
          </Suspense>
        ) : (
          sphere
        )}
      </group>
    </group>
  )
}
