'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getItem } from '@/core/data/items'
import { world } from '@/core/world/world'
import { resolveScanRay } from '@/core/systems/scannerModeSystem'
import {
  HeldItem,
  InputControlled,
  OrbitCamera,
  Party,
  Position,
  ScanMode,
} from '@/core/traits'

// Pequeno, fixo — só marca visualmente ONDE o alcance termina, não
// escala com `range` (o comprimento da linha já é o alcance em si) —
// mesma ideia de `RING_INNER/OUTER_RADIUS` em `AttackRangeDebugView.jsx`,
// só que aqui o anel não precisa mudar de tamanho.
const MARKER_RADIUS = 0.15
const MARKER_SEGMENTS = 16

/**
 * Visualização de debug (F2, ver `src/app/(auth)/page.js`) do alcance
 * do Scan — pedido do usuário: "quando o modo Debug estiver ativo e o
 * jogador entrar no modo Scan, quero visualizar... o alcance máximo do
 * Scan" (ver docs/features/033-*.md). Mesmo padrão de
 * `AttackRangeDebugView.jsx`/`PathfindingDebugView.jsx` — só montada
 * quando `showDebug` está ligado (`src/app/(auth)/page.js`), e mesmo
 * assim só VISÍVEL enquanto `ScanMode.active` for `true` (o group fica
 * `visible=false` o resto do tempo) — as duas condições do pedido
 * ("só com debug ativo" e "só durante o Scan") ficam cobertas pela
 * combinação dessas duas camadas, sem precisar ler `showDebug` aqui
 * dentro.
 *
 * **Linha reta, não círculo/esfera** — o Scan detecta por um RAIO pra
 * frente na direção da mira da câmera (`scannerModeSystem.js`,
 * `castRay`), não numa área ao redor do jogador; um círculo no chão ou
 * uma esfera sugeriria "detecta em qualquer direção dentro desse
 * raio", que não é como o mecanismo funciona de verdade. Uma linha do
 * olho até `eye + direction * range`, com um pequeno anel no PONTO
 * FINAL marcando onde o alcance acaba, é a representação mais fiel.
 *
 * **Mesmo valor da lógica real, garantido pelo código, não só pela
 * fórmula** — pedido do usuário: "quero que o valor usado pela
 * visualização seja exatamente o mesmo valor utilizado pela lógica
 * real de alcance do Scan". `resolveScanRay` (`scannerModeSystem.js`)
 * é a MESMA função que o system de verdade chama pra montar o raio do
 * `castRay` — reaproveitada aqui, não recalculada, mesmo princípio de
 * `resolveAttackImpactPoint`/`AttackRangeDebugView.jsx`.
 */
export function ScanRangeDebugView() {
  const lineGeometryRef = useRef()
  const markerRef = useRef()

  useFrame(() => {
    const geometry = lineGeometryRef.current
    const marker = markerRef.current
    if (!geometry || !marker) return

    const trainer = world.queryFirst(
      InputControlled,
      Party,
      HeldItem,
      Position,
      ScanMode,
    )
    const rig = world.queryFirst(OrbitCamera)
    const scanning = !!trainer?.get(ScanMode).active && !!rig

    marker.visible = scanning
    if (!scanning) {
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(0), 3),
      )
      return
    }

    const heldItem = trainer.get(HeldItem)
    const item = heldItem.itemId ? getItem(heldItem.itemId) : null
    const pos = trainer.get(Position)
    const { eye, direction, range } = resolveScanRay(pos, rig, item)
    const end = {
      x: eye.x + direction.x * range,
      y: eye.y + direction.y * range,
      z: eye.z + direction.z * range,
    }

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([eye.x, eye.y, eye.z, end.x, end.y, end.z]),
        3,
      ),
    )
    marker.position.set(end.x, end.y, end.z)
  })

  return (
    <>
      <lineSegments renderOrder={999}>
        <bufferGeometry ref={lineGeometryRef} />
        <lineBasicMaterial color="lime" depthTest={false} linewidth={2} />
      </lineSegments>
      <mesh ref={markerRef} visible={false} renderOrder={999}>
        <sphereGeometry
          args={[MARKER_RADIUS, MARKER_SEGMENTS, MARKER_SEGMENTS]}
        />
        <meshBasicMaterial color="lime" wireframe depthTest={false} />
      </mesh>
    </>
  )
}
