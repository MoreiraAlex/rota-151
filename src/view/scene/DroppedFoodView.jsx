import { Suspense, useCallback, useEffect, useRef } from 'react'
import { useQuery } from 'koota/react'
import { DroppedFood, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerDroppedFood,
  setDroppedFoodModel,
  unregisterDroppedFood,
} from '../registry/droppedFoodRegistry'
import { FoodSphere } from './EatingFoodView'
import { ItemModel, hasItemModel } from './ItemModel'

/**
 * Fruta derrubada por quem foi interrompido comendo (`DroppedFood`,
 * docs/features/042-itens-da-beta.md) — o modelo do item no pedaço em que
 * estava (`eaten`) ou, sem modelo, a esfera na cor da fruta. A `Position` é
 * a base dela (`align: 'bottom'`); ela rola girando em volta do pivô, o
 * centro do corpo (`droppedFoodViewSystem.js`). Some quando o
 * `droppedFoodSystem` destrói a entidade.
 */
export function DroppedFoodView({ entity }) {
  const groupRef = useRef()
  const spherePivotRef = useRef()
  const { itemId, eaten, landings } = entity.get(DroppedFood) ?? {}
  const onModel = useCallback(
    (model) => setDroppedFoodModel(entity, model),
    [entity],
  )

  useEffect(() => {
    registerView(entity, groupRef.current)
    registerDroppedFood(entity, spherePivotRef, landings)
    return () => {
      unregisterView(entity)
      unregisterDroppedFood(entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity])

  const sphere = (
    <FoodSphere itemId={itemId} align="bottom" pivotRef={spherePivotRef} />
  )

  return (
    <group ref={groupRef}>
      {hasItemModel(itemId) ? (
        <Suspense fallback={sphere}>
          <ItemModel
            itemId={itemId}
            align="bottom"
            eaten={eaten}
            onModel={onModel}
          />
        </Suspense>
      ) : (
        sphere
      )}
    </group>
  )
}

/** Uma `DroppedFoodView` por `DroppedFood` na cena. */
export function DroppedFoodsView() {
  const foods = useQuery(DroppedFood, Position, Rotation)

  return (
    <>
      {foods.map((entity) => (
        <DroppedFoodView key={entity} entity={entity} />
      ))}
    </>
  )
}
