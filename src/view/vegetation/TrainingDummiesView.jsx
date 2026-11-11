import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useTrait } from 'koota/react'
import { Position, TrainingObject } from '@/core/traits'
import {
  registerTrainingDummy,
  unregisterTrainingDummy,
} from '@/view/registry/trainingDummyRegistry'
import {
  buildModelMeshes,
  disposeVegetationMesh,
  setReceivesShadow,
} from './instancing'

/**
 * Um boneco de treino (docs/features/067-campo-de-treino-e-avisos-de-
 * nivel.md), desenhado sozinho — fora da malha dos prédios do chunk — pra
 * poder balançar ao levar o golpe do treino: o grupo de dentro (`tilt`,
 * pivô na base, alinhado ao mundo) é o que o `trainingDummyWobbleSystem`
 * inclina; o giro e o tamanho do boneco vão na malha.
 */
function TrainingDummy({ entity, models, receiveShadows }) {
  const object = useTrait(entity, TrainingObject)
  const pos = useTrait(entity, Position)
  const tiltRef = useRef(null)
  const model = object ? models.lgpe[object.model] : null
  const yaw = object?.yaw ?? 0
  const scale = object?.scale ?? 1

  const meshes = useMemo(
    () =>
      model ? buildModelMeshes(model, [{ x: 0, y: 0, z: 0, yaw, scale }]) : [],
    [model, yaw, scale],
  )
  useEffect(
    () => () => {
      for (const mesh of meshes) disposeVegetationMesh(mesh)
    },
    [meshes],
  )
  useEffect(() => {
    for (const mesh of meshes) setReceivesShadow(mesh, receiveShadows)
  }, [meshes, receiveShadows])
  useEffect(() => {
    if (!tiltRef.current) return undefined
    registerTrainingDummy(entity, tiltRef.current)
    return () => unregisterTrainingDummy(entity)
  }, [entity, meshes])

  if (!pos || meshes.length === 0) return null
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <group ref={tiltRef}>
        {meshes.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} />
        ))}
      </group>
    </group>
  )
}

/**
 * Os bonecos de treino dos chunks carregados (as entidades `TrainingObject`,
 * que nascem e saem com o chunk). Só renderiza; o balanço é do
 * `trainingDummyWobbleSystem`.
 */
export function TrainingDummiesView({ models, receiveShadows = true }) {
  const dummies = useQuery(TrainingObject, Position)
  return dummies.map((entity) => (
    <TrainingDummy
      key={entity}
      entity={entity}
      models={models}
      receiveShadows={receiveShadows}
    />
  ))
}
