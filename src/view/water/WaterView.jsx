'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { lightingAt } from '@/core/time/dayCycle'
import { LocalWeather, WorldClock } from '@/core/traits'
import { world } from '@/core/world/world'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { resolveSkyLook } from '@/view/weather/skyLook'
import { buildWaterChunkGeometry } from './waterGeometry'
import {
  applyWaterLook,
  createWaterMaterial,
  updateWater,
} from './waterMaterial'

const skyColor = new THREE.Color()
const skyTop = new THREE.Color()

/**
 * A cor do céu que a água reflete: entre o alto do céu e o horizonte (só o
 * horizonte, no fim de tarde, deixava a água da cor do barro).
 */
function reflectedSky() {
  const clock = world.get(WorldClock)
  const weather = world.get(LocalWeather)
  if (!clock || !weather) return null
  const look = resolveSkyLook(lightingAt(clock.time), weather)
  skyTop.setRGB(...look.skyTop, THREE.SRGBColorSpace)
  return skyColor
    .setRGB(...look.horizon, THREE.SRGBColorSpace)
    .lerp(skyTop, GAME_CONFIG.WATER.SKY_TOP_SHARE)
}

/** A água de um chunk; a geometria sai ao desmontar (regra 5.3). */
function WaterChunkView({ chunk, material }) {
  const geometry = useMemo(
    () => buildWaterChunkGeometry(chunk, GAME_CONFIG.TERRAIN.WATER_LEVEL),
    [chunk],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return <mesh geometry={geometry} material={material} receiveShadow />
}

/**
 * A água (docs/features/049-vegetacao-e-floresta.md): uma superfície por
 * chunk carregado onde o chão fica abaixo do nível da água — só visual, sem
 * nadar nem colidir (a água de verdade é da 056). Um material para todos.
 *
 * `useFrame` aqui é a exceção das regras (3.4): só visual (as ondinhas e o
 * céu refletido), que só LÊ o ECS (a hora e o clima).
 */
export function WaterView() {
  useTerrainChunks()
  const [material] = useState(createWaterMaterial)
  useEffect(() => () => material.dispose(), [material])

  useFrame((_, delta) => {
    applyWaterLook(material)
    updateWater(material, delta, reflectedSky())
  })

  return TEST_LEVEL.terrain
    .loadedChunks()
    .map((chunk) => (
      <WaterChunkView
        key={`${chunk.chunkX},${chunk.chunkZ}`}
        chunk={chunk}
        material={material}
      />
    ))
}
