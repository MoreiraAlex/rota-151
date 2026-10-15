import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { loadedFogRange } from '@/view/terrain/fogRange'
import { GroundItem, Position } from '@/core/traits'
import { ItemModel, hasItemModel } from './ItemModel'
import { FoodSphere } from './EatingFoodView'

/**
 * Itens no chão (`GroundItem`, docs/features/055-itens-no-mundo.md), cada
 * um no modelo dele, com a base no chão. A fruta da vegetação não aparece:
 * nada mostra qual arbusto ou árvore tem.
 *
 * Só os de antes de a névoa fechar são desenhados (`loadedFogRange`,
 * docs/features/058-ajuste-dos-biomas.md): até onde ela começa, tudo
 * aparece inteiro; além dela, os dos chunks carregados só custariam
 * desenhos e sombra. Só desenha: tudo o que acontece é do core.
 */
export function WorldItemsView() {
  const items = useQuery(GroundItem, Position)
  const groupRef = useRef()

  // Exceção da regra do `useFrame` (só visual, não toca o estado do jogo):
  // liga e desliga cada item pela distância da câmera.
  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return
    const limit = loadedFogRange(TEST_LEVEL.terrain.chunkSize()).far
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
