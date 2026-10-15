import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { GroundItem, Position } from '@/core/traits'
import { ItemModel, hasItemModel } from './ItemModel'
import { FoodSphere } from './EatingFoodView'

/**
 * Itens no chão (`GroundItem`, docs/features/055-itens-no-mundo.md), cada
 * um no modelo dele, com a base no chão. A fruta da vegetação não aparece:
 * nada mostra qual arbusto ou árvore tem.
 *
 * Só os de perto da câmera são desenhados (`WORLD_ITEMS.DRAW_DISTANCE`): o
 * item é pequeno, e os dos chunks carregados lá longe só custariam desenhos
 * e sombra. Só desenha: tudo o que acontece é do core.
 */
export function WorldItemsView() {
  const items = useQuery(GroundItem, Position)
  const groupRef = useRef()

  // Exceção da regra do `useFrame` (só visual, não toca o estado do jogo):
  // liga e desliga cada item pela distância da câmera.
  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return
    const limit = GAME_CONFIG.WORLD_ITEMS.DRAW_DISTANCE
    for (const child of group.children) {
      const dx = child.position.x - camera.position.x
      const dz = child.position.z - camera.position.z
      child.visible = dx * dx + dz * dz < limit * limit
    }
  })

  return (
    <group ref={groupRef}>
      {items.map((entity) => (
        <GroundItemView key={entity} entity={entity} />
      ))}
    </group>
  )
}

function GroundItemView({ entity }) {
  const ground = entity.get(GroundItem)
  const position = entity.get(Position)
  if (!ground || !position) return null
  const { itemId } = ground
  const sphere = <FoodSphere itemId={itemId} align="bottom" />

  return (
    <group position={[position.x, position.y, position.z]} visible={false}>
      {hasItemModel(itemId) ? (
        <Suspense fallback={sphere}>
          <ItemModel itemId={itemId} align="bottom" />
        </Suspense>
      ) : (
        sphere
      )}
    </group>
  )
}
