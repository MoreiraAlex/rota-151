import { Suspense, useCallback, useEffect, useRef } from 'react'
import { useQuery } from 'koota/react'
import { Eating } from '@/core/traits'
import { resolveItemTint } from '../itemTint'
import { resolveEatFoodAlign } from '../eatFoodConfig'
import {
  registerEatingFood,
  setEatingFoodModel,
  unregisterEatingFood,
} from '../registry/eatingFoodRegistry'
import { ItemModel, hasItemModel } from './ItemModel'

// Raio (m) da esfera de quem não tem modelo — o mesmo da fruta caída.
export const EATING_FOOD_RADIUS = 0.1

/**
 * A fruta que alguém está comendo (`Eating`, docs/features/042-itens-da-
 * beta.md): o modelo do item (`ItemModel`, trocando de pedaço conforme é
 * comida) ou, sem modelo, uma esfera na cor da fruta. Onde ela fica (mão,
 * boca, chão) e o quanto já foi comida é do `eatingFoodViewSystem.js`; aqui
 * só renderiza e registra. Some sozinha quando o `Eating` sai (terminou ou
 * foi interrompido — aí aparece a `DroppedFoodView`).
 */
export function EatingFoodView({ eater }) {
  const groupRef = useRef()
  const spherePivotRef = useRef()
  const itemId = eater.get(Eating)?.itemId
  const align = resolveEatFoodAlign(eater)
  const onModel = useCallback(
    (model) => setEatingFoodModel(eater, model),
    [eater],
  )

  useEffect(() => {
    registerEatingFood(eater, groupRef.current, spherePivotRef)
    return () => unregisterEatingFood(eater)
  }, [eater])

  const sphere = (
    <FoodSphere itemId={itemId} align={align} pivotRef={spherePivotRef} />
  )

  return (
    // Começa escondida: só aparece quando o system achar a âncora.
    <group ref={groupRef} visible={false}>
      {hasItemModel(itemId) ? (
        <Suspense fallback={sphere}>
          <ItemModel itemId={itemId} align={align} onModel={onModel} />
        </Suspense>
      ) : (
        sphere
      )}
    </group>
  )
}

/**
 * Esfera na cor da fruta — quem não tem modelo (ou enquanto ele carrega).
 * `align: 'bottom'` põe a base na origem (fruta no chão); o pivô (`pivotRef`,
 * onde ela gira e aperta) fica sempre no centro dela.
 */
export function FoodSphere({ itemId, align = 'center', pivotRef }) {
  const color = resolveItemTint(itemId)
  const y = align === 'bottom' ? EATING_FOOD_RADIUS : 0
  return (
    <group ref={pivotRef} position={[0, y, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[EATING_FOOD_RADIUS, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

/** Uma `EatingFoodView` por quem está comendo. */
export function EatingFoodsView() {
  const eaters = useQuery(Eating)

  return (
    <>
      {eaters.map((eater) => (
        <EatingFoodView key={eater} eater={eater} />
      ))}
    </>
  )
}
