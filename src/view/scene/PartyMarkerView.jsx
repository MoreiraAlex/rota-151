'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSpecies } from '@/core/data/species'
import { castRayWithNormal } from '@/core/physics/raycast'
import { resolveBodyExtent, verticalClearance } from '@/core/physics/capsule'
import { playerEntity } from '@/core/world/world'
import { OwnedBy, Position, SummonedCreature } from '@/core/traits'
import { resolveRenderPosition } from '../registry/renderInterpolation'

const DOWN = { x: 0, y: -1, z: 0 }
// A `RingGeometry` nasce no plano XY, de frente para +Z.
const RING_NORMAL = new THREE.Vector3(0, 0, 1)
const SEGMENTS = 48
const renderPos = {}
const groundNormal = new THREE.Vector3()

/** Raio do anel: o corpo no plano (a cápsula), vezes `RADIUS_FACTOR`. */
function resolveRingRadius(body) {
  const { width, length } = resolveBodyExtent(body)
  return (
    (Math.max(width, length) / 2) *
    GAME_CONFIG.FEEDBACK.PARTY_MARKER.RADIUS_FACTOR
  )
}

function PartyMarker({ entity }) {
  const meshRef = useRef()
  const speciesId = entity.get(SummonedCreature)?.speciesId
  const body = getSpecies(speciesId)?.body
  const { COLOR, OPACITY, WIDTH, LIFT, MAX_GROUND_GAP } =
    GAME_CONFIG.FEEDBACK.PARTY_MARKER

  const geometry = useMemo(() => {
    if (!body) return null
    const outer = resolveRingRadius(body)
    return new THREE.RingGeometry(Math.max(0, outer - WIDTH), outer, SEGMENTS)
  }, [body, WIDTH])
  useEffect(() => () => geometry?.dispose(), [geometry])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || !body) return
    const pos = resolveRenderPosition(entity, renderPos)
    if (!pos) {
      mesh.visible = false
      return
    }
    // O chão embaixo dela: só o nível (sem bater nela nem em outra
    // criatura). No ar, longe demais do chão, some.
    const hit = castRayWithNormal(
      pos,
      DOWN,
      verticalClearance(body) + MAX_GROUND_GAP,
      { terrainOnly: true },
    )
    if (!hit) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z)
    mesh.quaternion.setFromUnitVectors(RING_NORMAL, groundNormal)
    mesh.position.set(
      hit.point.x + groundNormal.x * LIFT,
      hit.point.y + groundNormal.y * LIFT,
      hit.point.z + groundNormal.z * LIFT,
    )
  })

  if (!geometry) return null
  return (
    <mesh ref={meshRef} geometry={geometry} visible={false} renderOrder={2}>
      <meshBasicMaterial
        color={COLOR}
        transparent
        opacity={OPACITY}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  )
}

/**
 * Anel no chão embaixo de cada criatura do SEU time (docs/features/064-
 * revisao-da-ia-do-parceiro.md, Parte 4) — numa briga de Pidgey contra
 * Pidgey, é o que diz qual é o seu, mesmo de longe, quando a plaquinha já
 * sumiu. Sempre ligado, inclusive na que você controla. Só as do jogador
 * local (`OwnedBy(playerEntity)`); selvagem e criatura de outro treinador
 * não ganham.
 *
 * Deitado no chão pela normal do relevo (um raio para baixo por criatura
 * por frame, `castRayWithNormal` só no nível), acompanhando a posição
 * interpolada como o modelo. Cor, tamanho e folga em
 * `FEEDBACK.PARTY_MARKER`.
 *
 * `useFrame` é a exceção documentada de efeito visual: só lê a posição e
 * mexe na própria malha, nunca escreve estado de jogo.
 */
export function PartyMarkersView() {
  const entities = useQuery(SummonedCreature, Position, OwnedBy(playerEntity))

  return (
    <>
      {entities.map((entity) => (
        <PartyMarker key={entity} entity={entity} />
      ))}
    </>
  )
}
