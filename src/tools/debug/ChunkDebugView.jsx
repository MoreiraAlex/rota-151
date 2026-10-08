'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'

// Cor da borda por estado do chunk.
const STATE_COLORS = {
  loaded: '#3ddc84',
  kept: '#ff9f1c',
  pending: '#ffe14d',
}
// Quanto (m) a linha fica acima do chão, e de quantos em quantos metros ela
// acompanha o relevo.
const LINE_LIFT = 0.3
const LINE_STEP = 2

// A borda do chunk, seguindo o relevo.
function borderPoints(chunkX, chunkZ, size) {
  const { terrain } = TEST_LEVEL
  const minX = (chunkX - 0.5) * size
  const minZ = (chunkZ - 0.5) * size
  const maxX = minX + size
  const maxZ = minZ + size
  const corners = [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ]

  const points = []
  corners.forEach(([fromX, fromZ], side) => {
    const [toX, toZ] = corners[(side + 1) % corners.length]
    const steps = Math.ceil(size / LINE_STEP)
    for (let step = 0; step < steps; step++) {
      const t = step / steps
      const x = fromX + (toX - fromX) * t
      const z = fromZ + (toZ - fromZ) * t
      points.push(new THREE.Vector3(x, terrain.heightAt(x, z) + LINE_LIFT, z))
    }
  })
  return points
}

function ChunkBorder({ chunkX, chunkZ, size, state }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      borderPoints(chunkX, chunkZ, size),
    )
    const material = new THREE.LineBasicMaterial({
      color: STATE_COLORS[state],
      depthTest: false,
      // Visível através da névoa — é ela que esconde a borda do jogador.
      fog: false,
    })
    return new THREE.LineLoop(geometry, material)
  }, [chunkX, chunkZ, size, state])

  useEffect(
    () => () => {
      line.geometry.dispose()
      line.material.dispose()
    },
    [line],
  )

  return <primitive object={line} />
}

const parseKey = (key) => key.split(',').map(Number)

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): a borda de cada chunk
 * no chão, pela cor do estado — carregado, carregado só pela folga entre
 * os raios (descarrega se o jogador se afastar mais) e na fila para
 * carregar. Ver docs/features/046-sistema-de-chunks.md.
 */
export function ChunkDebugView() {
  useTerrainChunks()
  const { terrain } = TEST_LEVEL
  const size = terrain.chunkSize()
  const { pending, kept } = terrain.streamingStatus()
  const keptKeys = new Set(kept)

  const borders = [
    ...terrain.loadedChunks().map(({ chunkX, chunkZ }) => ({
      chunkX,
      chunkZ,
      state: keptKeys.has(`${chunkX},${chunkZ}`) ? 'kept' : 'loaded',
    })),
    ...pending.map((key) => {
      const [chunkX, chunkZ] = parseKey(key)
      return { chunkX, chunkZ, state: 'pending' }
    }),
  ]

  return borders.map(({ chunkX, chunkZ, state }) => (
    <ChunkBorder
      key={`${chunkX},${chunkZ}`}
      chunkX={chunkX}
      chunkZ={chunkZ}
      size={size}
      state={state}
    />
  ))
}

/**
 * Debug (F2): quantos chunks estão carregados e quantos na fila — linha do
 * `DebugPanel`.
 */
export function ChunkDebugCounter() {
  useTerrainChunks()
  const { terrain } = TEST_LEVEL
  const loaded = terrain.loadedChunks().length
  const { pending } = terrain.streamingStatus()
  return (
    <p>
      chunks: {loaded} carregados · {pending.length} na fila
    </p>
  )
}
