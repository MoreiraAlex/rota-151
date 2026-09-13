'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getRapierWorld, isPhysicsReady } from '@/core/physics/physicsWorld'

/**
 * Desenha os colliders reais do Rapier como linhas, direto do
 * `world.debugRender()` — mostra exatamente o que a física "enxerga",
 * incluindo a cápsula do jogador (que não tem malha visível, já que o
 * PlayerView renderiza o modelo, não o collider).
 *
 * Ferramenta de debug: opcional, montada só quando o toggle na página está
 * ligado (ver src/app/(auth)/page.js), nunca requisito de gameplay.
 *
 * Vive dentro do Canvas do jogo, não é uma raiz R3F separada — o `useFrame`
 * aqui é a exceção documentada da regra de "um único useFrame": só redesenha
 * linhas de debug a cada frame, nunca mexe em estado de jogo.
 */
export function PhysicsDebugView() {
  const geometryRef = useRef()

  useFrame(() => {
    if (!isPhysicsReady() || !geometryRef.current) return

    const { vertices, colors } = getRapierWorld().debugRender()
    geometryRef.current.setAttribute(
      'position',
      new THREE.BufferAttribute(vertices, 3),
    )
    geometryRef.current.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 4),
    )
  })

  return (
    <lineSegments renderOrder={999}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial vertexColors depthTest={false} />
    </lineSegments>
  )
}
