'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import * as THREE from 'three'
import { world } from '@/core/world/world'
import { TEST_LEVEL } from '@/core/data/testLevel'
import {
  CameraTarget,
  OrbitCamera,
  Position,
  WildCreature,
  WildSpawnState,
} from '@/core/traits'
import { spawnParams } from '@/core/wildSpawn/wildSpawn'
import { formatSpeciesName } from '@/view/shared/statusDisplay'

// Cor de cada marca no chão: o anel do spawn (os dois raios), as faixas do
// despawn (perto e longe) e o cone da câmera.
const COLORS = {
  spawn: '#4dabf7',
  near: '#3ddc84',
  far: '#ff5a5a',
  view: '#ffe14d',
}
const RING_SEGMENTS = 96
// Quanto (m) as linhas ficam acima de quem a câmera segue.
const LINE_LIFT = 0.3

const REASON_LABELS = { far: 'longe', aged: 'velha' }

function lineMaterial(color) {
  // Visível através da névoa e do chão.
  return new THREE.LineBasicMaterial({ color, depthTest: false, fog: false })
}

function circle(radius, color) {
  const points = []
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2
    points.push(
      new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius),
    )
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    lineMaterial(color),
  )
}

// As duas bordas do cone da câmera, olhando para -z (o `yaw` gira o grupo).
function viewCone(halfAngle, length, color) {
  const edge = (side) =>
    new THREE.Vector3(
      -Math.sin(halfAngle * side) * length,
      0,
      -Math.cos(halfAngle * side) * length,
    )
  const origin = new THREE.Vector3()
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([
      origin,
      edge(1),
      origin,
      edge(-1),
    ]),
    lineMaterial(color),
  )
}

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): em volta de quem a
 * câmera segue, o anel onde as selvagens nascem, as faixas perto e longe do
 * despawn e o cone da câmera até a distância de visão
 * (docs/features/062-spawn-estilo-cobblemon.md). Lidos da config ao montar.
 *
 * `useFrame` é a exceção documentada de debug: só acompanha a posição e o
 * `yaw`, sem tocar no estado do jogo.
 */
export function WildSpawnDebugView() {
  const groupRef = useRef()
  const coneRef = useRef()

  const lines = useMemo(() => {
    const params = spawnParams(TEST_LEVEL.terrain.loadRadius())
    return {
      rings: [
        circle(params.MIN_RADIUS, COLORS.spawn),
        circle(params.MAX_RADIUS, COLORS.spawn),
        circle(params.NEAR_RADIUS, COLORS.near),
        circle(params.FAR_RADIUS, COLORS.far),
      ],
      cone: viewCone(params.VIEW_HALF_ANGLE, params.VIEW_DISTANCE, COLORS.view),
    }
  }, [])

  useEffect(
    () => () => {
      for (const line of [...lines.rings, lines.cone]) {
        line.geometry.dispose()
        line.material.dispose()
      }
    },
    [lines],
  )

  useFrame(() => {
    const target = world.queryFirst(CameraTarget, Position)
    const rig = world.queryFirst(OrbitCamera)
    if (!groupRef.current || !target) return
    const { x, y, z } = target.get(Position)
    groupRef.current.position.set(x, y + LINE_LIFT, z)
    if (coneRef.current && rig) {
      coneRef.current.rotation.y = rig.get(OrbitCamera).yaw
    }
  })

  return (
    <group ref={groupRef}>
      {lines.rings.map((ring) => (
        <primitive key={ring.uuid} object={ring} />
      ))}
      <group ref={coneRef}>
        <primitive object={lines.cone} />
      </group>
    </group>
  )
}

/**
 * Debug (F2): quantas selvagens há no mundo, o teto por jogador e os
 * últimos spawns e despawns, com o motivo — linhas do `DebugPanel`.
 * Atualiza quando a lista de selvagens muda.
 */
export function WildSpawnDebugCounter() {
  const wilds = useQuery(WildCreature)
  const params = spawnParams(TEST_LEVEL.terrain.loadRadius())
  const log = world.has(WildSpawnState) ? world.get(WildSpawnState).log : []

  return (
    <>
      <p>
        selvagens: {wilds.length} · teto por jogador {params.MAX_PER_PLAYER}
      </p>
      {log
        .slice()
        .reverse()
        .map((entry, index) => (
          <p key={index} className="text-white/60">
            {entry.kind === 'spawn' ? '+' : '−'}{' '}
            {formatSpeciesName(entry.speciesId)}
            {entry.reason ? ` (${REASON_LABELS[entry.reason]})` : ''} em{' '}
            {entry.x.toFixed(0)}, {entry.z.toFixed(0)}
          </p>
        ))}
    </>
  )
}
