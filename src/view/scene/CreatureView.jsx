import { useEffect } from 'react'
import { useQuery } from 'koota/react'
import { getSpecies } from '@/core/data/species'
import { SummonedCreature, WildCreature, Position, Rotation } from '@/core/traits'
import { useAnimatedModel } from '../hooks/useAnimatedModel'
import { CREATURE_TINTS } from '../creatureTints'

/**
 * Visual de uma criatura não-jogador (`SummonedCreature` OU `WildCreature`,
 * ver `CreaturesView`/`WildCreaturesView` abaixo — `speciesId` já vem
 * resolvido de qualquer um dos dois traits, este componente não sabe nem
 * precisa saber qual) — modelo da espécie via `useAnimatedModel` (mesmo
 * hook do `PlayerView`), tingido pela cor do mapa acima quando houver. As 4
 * espécies fox compartilham o mesmo `.glb`/material via cache do
 * `useGLTF`; **clona o material antes de colorir**, senão a mudança
 * vazaria pra qualquer outra instância que carregue o mesmo asset
 * (`SkeletonUtils.clone` reusa materiais por referência).
 */
export function CreatureView({ entity, speciesId }) {
  const species = getSpecies(speciesId)
  const { groupRef, cloned } = useAnimatedModel(entity, species)

  useEffect(() => {
    const tint = CREATURE_TINTS[speciesId]
    if (!tint) return

    cloned.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.color.set(tint)
      }
    })
  }, [cloned, speciesId])

  return (
    <group ref={groupRef}>
      <primitive
        object={cloned}
        scale={species.model.scale}
        position={species.body.modelOffset}
      />
    </group>
  )
}

/**
 * Renderiza uma `CreatureView` por `SummonedCreature` ativa — `useQuery` é
 * reativo, monta/desmonta sozinho ao invocar/recolher.
 */
export function CreaturesView() {
  const creatures = useQuery(SummonedCreature, Position, Rotation)

  return (
    <>
      {creatures.map((entity) => (
        <CreatureView
          key={entity}
          entity={entity}
          speciesId={entity.get(SummonedCreature).speciesId}
        />
      ))}
    </>
  )
}

/**
 * Mesma ideia de `CreaturesView`, pra `WildCreature` (ver docs/features/020-
 * fox-selvagens-cena-e-texturas.md) — reusa o MESMO componente visual
 * (`CreatureView`), tint/textura por espécie incluídos de graça, sem
 * duplicar nada. `WildCreature` nunca é destruída em runtime hoje
 * (`wildCreatureSpawnSystem` só cria), mas `useQuery` continua reativo do
 * mesmo jeito se isso mudar no futuro.
 */
export function WildCreaturesView() {
  const creatures = useQuery(WildCreature, Position, Rotation)

  return (
    <>
      {creatures.map((entity) => (
        <CreatureView
          key={entity}
          entity={entity}
          speciesId={entity.get(WildCreature).speciesId}
        />
      ))}
    </>
  )
}
