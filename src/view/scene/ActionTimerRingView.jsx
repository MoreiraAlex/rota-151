'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolveGroundPoint } from '@/core/battle/attackGeometry'
import { resolveAttackTimeRemaining } from '@/core/battle/actionTimer'
import {
  ActionState,
  CharacterController,
  InputControlled,
  Position,
  Rotation,
} from '@/core/traits'

const {
  COLOR,
  OPACITY,
  TRACK_COLOR,
  TRACK_OPACITY,
  PADDING,
  THICKNESS,
  SEGMENTS,
} = GAME_CONFIG.FEEDBACK.ACTION_TIMER_RING
const { GROUND_LIFT } = GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR

// `RingGeometry` fica no plano XY; deitado (rotação -90° em X), o ângulo
// -90° do anel cai no +Z local — a FRENTE da criatura (o grupo gira com
// `Rotation.y`). A geometria começa e termina na frente, então as COSTAS
// ficam no meio dos índices — é em volta delas que o arco restante fica
// centrado (ver `remainingArcRange`).
const FLAT = -Math.PI / 2
const THETA_START = -Math.PI / 2
// Índices por segmento do anel (2 triângulos) — `setDrawRange` desenha só
// a fração restante sem recriar a geometria a cada frame.
const INDICES_PER_SEGMENT = 6

function createRing(innerRadius) {
  return new THREE.RingGeometry(
    innerRadius,
    innerRadius + THICKNESS,
    SEGMENTS,
    1,
    THETA_START,
    Math.PI * 2,
  )
}

/**
 * Anel de tempo em volta da criatura CONTROLADA enquanto ela executa um
 * ataque (básico ou habilidade) — estilo barra de stamina do Valheim: no
 * chão, começa cheio e esvazia até o fim da `duration` real da ação
 * (`resolveAttackTimeRemaining`), quando ela fica livre de novo. Fora de
 * ataque, some.
 *
 * O arco restante fica centrado nas COSTAS da criatura e encolhe pelos
 * dois lados, da frente pra trás — o último pedaço some atrás dela
 * (pedido do usuário). Respeita profundidade (diferente dos leques de
 * ataque): corpo e obstáculos tampam o anel normalmente.
 *
 * Raio acompanha o corpo (`capsuleRadius + PADDING`); as duas geometrias
 * (fundo inteiro + preenchimento cortado por `setDrawRange`) são
 * recriadas só quando esse raio muda (troca de criatura controlada) —
 * este componente é o dono delas e chama `dispose()` ao trocar/desmontar.
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual:
 * só LÊ estado do ECS e reposiciona os próprios meshes.
 */
export function ActionTimerRingView() {
  const groupRef = useRef()
  const trackRef = useRef()
  const fillRef = useRef()
  const ringRef = useRef({ radius: null, track: null, fill: null })

  useEffect(() => {
    const ring = ringRef.current
    return () => disposeRing(ring)
  }, [])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const controlled = world.queryFirst(
      InputControlled,
      ActionState,
      CharacterController,
      Position,
      Rotation,
    )
    const remaining = resolveAttackTimeRemaining(controlled?.get(ActionState))
    group.visible = remaining !== null
    if (remaining === null) return

    const body = controlled.get(CharacterController)
    const ring = resolveRing(ringRef.current, body.capsuleRadius + PADDING)
    trackRef.current.geometry = ring.track
    fillRef.current.geometry = ring.fill
    const arc = remainingArcRange(remaining)
    ring.fill.setDrawRange(
      arc.start * INDICES_PER_SEGMENT,
      arc.count * INDICES_PER_SEGMENT,
    )

    const ground = resolveGroundPoint(controlled.get(Position), body)
    group.position.set(ground.x, ground.y + GROUND_LIFT, ground.z)
    group.rotation.y = controlled.get(Rotation).y
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={trackRef} rotation-x={FLAT} renderOrder={14}>
        <meshBasicMaterial
          color={TRACK_COLOR}
          transparent
          opacity={TRACK_OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={fillRef} rotation-x={FLAT} renderOrder={15}>
        <meshBasicMaterial
          color={COLOR}
          transparent
          opacity={OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Segmentos do arco restante, centrado nas costas: a geometria vai da
 * frente (segmento 0) até a frente de novo (`SEGMENTS`), com as costas em
 * `SEGMENTS / 2` — o gasto sai igual das duas pontas.
 */
function remainingArcRange(remaining) {
  const count = Math.round(SEGMENTS * remaining)
  return { start: Math.round((SEGMENTS - count) / 2), count }
}

function resolveRing(ring, radius) {
  if (ring.track && Math.abs(ring.radius - radius) < 1e-4) return ring
  disposeRing(ring)
  ring.track = createRing(radius)
  ring.fill = createRing(radius)
  ring.radius = radius
  return ring
}

function disposeRing(ring) {
  ring.track?.dispose()
  ring.fill?.dispose()
  ring.track = null
  ring.fill = null
}
