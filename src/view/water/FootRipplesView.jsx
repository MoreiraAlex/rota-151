'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { FOOT_RIPPLE_COUNT, getFootRipples } from './footRipples'

// Um pouco acima da água, para não brigar com ela.
const RIPPLE_LIFT = 0.02

const matrix = new THREE.Matrix4()
const position = new THREE.Vector3()
const scale = new THREE.Vector3()
const fade = new THREE.Color()
const flat = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
)

/**
 * As marolinhas dos passos na água (`footRipples.js`,
 * docs/features/057-lagos-e-rios.md): um anel fino instanciado por
 * marolinha, que cresce desacelerando e some aos poucos — discreto, só um
 * clarão leve na água (aditivo, a cor apaga junto). Tamanho, opacidade e
 * duração em `GAME_CONFIG.WATER.RIPPLE` (F2, na hora).
 */
export function FootRipplesView() {
  const meshRef = useRef()
  const geometry = useMemo(() => new THREE.RingGeometry(0.9, 1, 32), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#e6f4ff',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const { SIZE, OPACITY, DURATION } = GAME_CONFIG.WATER.RIPPLE
    material.opacity = OPACITY
    const ripples = getFootRipples()
    for (let i = 0; i < FOOT_RIPPLE_COUNT; i++) {
      const ripple = ripples[i]
      ripple.age += delta
      const t = ripple.age / DURATION
      // Cresce rápido no começo e desacelera (ease-out).
      const grow = 1 - (1 - Math.min(t, 1)) ** 3
      const radius = t < 1 ? SIZE * ripple.size * (0.15 + 0.85 * grow) : 0
      position.set(ripple.x, ripple.y + RIPPLE_LIFT, ripple.z)
      scale.set(radius, radius, radius)
      matrix.compose(position, flat, scale)
      mesh.setMatrixAt(i, matrix)
      mesh.setColorAt(i, fade.setScalar(t < 1 ? (1 - t) ** 2 : 0))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, FOOT_RIPPLE_COUNT]}
      frustumCulled={false}
    />
  )
}
