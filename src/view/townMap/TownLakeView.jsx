'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { reflectedSky } from '@/view/water/WaterView'
import { SHORE_REACH } from '@/view/water/shoreWave'
import {
  applyWaterLook,
  createWaterMaterial,
  updateWater,
} from '@/view/water/waterMaterial'
import { buildTownLakeWaterGeometry } from './townLakeWater'

/**
 * A água do lago da cidade montada à mão (docs/features/069-revisao-do-
 * bioma-cidade.md — o laguinho de Viridian), no material dos lagos e rios
 * do mundo (`buildTownLakeWaterGeometry`) — `useFrame` só visual (as
 * ondinhas e o céu refletido), como no `WaterView`.
 *
 * @param {{ fixedTown: import('@/core/town/fixedTown').FixedTown }} props
 */
export function TownLakeView({ fixedTown }) {
  const [material] = useState(createWaterMaterial)
  useEffect(() => () => material.dispose(), [material])
  const geometry = useMemo(
    () =>
      buildTownLakeWaterGeometry(
        fixedTown.lake,
        TEST_LEVEL.terrain.heightAt,
        SHORE_REACH,
      ),
    [fixedTown],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])
  useFrame((_, delta) => {
    applyWaterLook(material)
    updateWater(material, delta, reflectedSky())
  })
  if (!geometry) return null
  return <mesh geometry={geometry} material={material} receiveShadow />
}
