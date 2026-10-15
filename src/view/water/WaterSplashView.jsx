'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import * as THREE from 'three'
import { WATER_SOUNDS } from '@/core/data/audio/waterSounds'
import { GAME_CONFIG } from '@/core/gameConfig'
import { Position, Rotation, WaterSplash } from '@/core/traits'
import { playWorldSound, preloadWorldSounds } from '@/view/audio/worldSounds'
import { registerView, unregisterView } from '../registry/viewRegistry'

// Gotas do respingo: quantas, a velocidade (m/s) de subida e de lado e o
// tamanho (m) de cada uma.
const DROPS = 14
const DROP_UP = 3.2
const DROP_OUT = 1.4
const DROP_SIZE = 0.07
// O anel na água: até que raio (m) cresce.
const RING_RADIUS = 0.9
const SPLASH_COLOR = '#eaf6ff'

const dropGeometry = new THREE.SphereGeometry(1, 6, 4)
const ringGeometry = new THREE.RingGeometry(0.8, 1, 28)

/**
 * Um respingo (`WaterSplash`, docs/features/057-lagos-e-rios.md): gotas
 * saltando e caindo com a gravidade do jogo e um anel crescendo na
 * superfície, sumindo até a `duration` do respingo. Toca o som ao aparecer.
 * Anima no relógio do R3F (cosmético, como o `SummonFlashView`).
 */
function WaterSplashView({ entity }) {
  const groupRef = useRef()
  const dropsRef = useRef()
  const ringRef = useRef()
  const elapsedRef = useRef(0)
  const { size, duration } = entity.get(WaterSplash)
  // Direção de cada gota, sorteada uma vez (cosmético, fora do RNG do jogo).
  const drops = useMemo(
    () =>
      Array.from({ length: DROPS }, () => {
        const angle = Math.random() * Math.PI * 2
        const out = DROP_OUT * (0.4 + Math.random() * 0.6)
        return {
          x: Math.cos(angle) * out,
          z: Math.sin(angle) * out,
          y: DROP_UP * (0.6 + Math.random() * 0.4),
        }
      }),
    [],
  )
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SPLASH_COLOR,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useLayoutEffect(() => {
    registerView(entity, groupRef.current)
    const { x, y, z } = entity.get(Position)
    playWorldSound(WATER_SOUNDS.splash, { x, y, z })
    return () => unregisterView(entity)
  }, [entity])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const time = elapsedRef.current
    const t = Math.min(time / duration, 1)
    material.opacity = 1 - t
    const gravity = GAME_CONFIG.PHYSICS.GRAVITY
    const mesh = dropsRef.current
    if (mesh) {
      for (let i = 0; i < DROPS; i++) {
        const drop = drops[i]
        const height = Math.max(drop.y * time + 0.5 * gravity * time * time, 0)
        matrix.compose(
          position.set(
            drop.x * time * size,
            height * size,
            drop.z * time * size,
          ),
          identity,
          scale.setScalar(height > 0 ? DROP_SIZE * size : 0),
        )
        mesh.setMatrixAt(i, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(RING_RADIUS * size * (0.2 + 0.8 * t))
    }
  })

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={dropsRef}
        args={[dropGeometry, material, DROPS]}
        frustumCulled={false}
      />
      <mesh
        ref={ringRef}
        geometry={ringGeometry}
        material={material}
        rotation-x={-Math.PI / 2}
        position-y={0.02}
      />
    </group>
  )
}

const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const scale = new THREE.Vector3()
const identity = new THREE.Quaternion()

/** Uma `WaterSplashView` por `WaterSplash` ativo. */
export function WaterSplashesView() {
  const splashes = useQuery(WaterSplash, Position, Rotation)
  useEffect(() => preloadWorldSounds({ splash: WATER_SOUNDS.splash }), [])
  return (
    <>
      {splashes.map((entity) => (
        <WaterSplashView key={entity} entity={entity} />
      ))}
    </>
  )
}
