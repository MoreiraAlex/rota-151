import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { PLAYER_SPECIES_ID, getSpecies } from '@/core/data/species'
import { RecallBeam, Position, Rotation } from '@/core/traits'
import { playerEntity } from '@/core/world/world'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { HAND_BONE_BY_SPECIES } from '@/view/handBoneBySpecies'
import { loadTexture } from '../textures/textureCache'
import { resolveBeamColor, resolveBeamPhase } from '../phaseBeam'
import { registerView, unregisterView } from '../registry/viewRegistry'

const HAND_BONE_NAME = HAND_BONE_BY_SPECIES[PLAYER_SPECIES_ID]
// A textura do feixe do Cobblemon (quase branca — a cor vem da bola).
const BEAM_TEXTURE_PATH = '/assets/effects/pokeball/phase_beam.png'
// Comprimento (m) de uma repetição da textura ao longo do feixe.
const TEXTURE_TILE_LENGTH = 0.5
// Lados do cilindro do feixe.
const BEAM_SIDES = 12

// Raio de envelope quando a espécie não é conhecida (m).
const DEFAULT_ENVELOPE_RADIUS = 0.4
// Envelope: icosaedro deformado (o "cristal" de luz no lugar da criatura).
const ENVELOPE_DETAIL = 1
const ENVELOPE_JITTER = 0.35
// O envelope é refeito a cada REFRESH_INTERVAL (s) — tremeluz.
const REFRESH_INTERVAL = 0.05

const UP = new THREE.Vector3(0, 1, 0)

// Pseudoaleatório estável por direção (sem `Math.random` por vértice).
function hashDirection(x, y, z, seed) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453
  return s - Math.floor(s)
}

/** Raio de uma esfera do volume aproximado da cápsula da espécie. */
function resolveEnvelopeRadius(body) {
  const radius = body?.capsuleRadius ?? DEFAULT_ENVELOPE_RADIUS
  const halfHeight = body?.capsuleHalfHeight ?? 0
  return Math.cbrt(radius ** 3 + 1.5 * halfHeight * radius ** 2)
}

function buildEnvelopeGeometry(radius, seed) {
  const geometry = new THREE.IcosahedronGeometry(radius, ENVELOPE_DETAIL)
  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    const direction = vertex.clone().normalize()
    const noise =
      hashDirection(direction.x, direction.y, direction.z, seed) * 2 - 1
    vertex.multiplyScalar(1 + noise * ENVELOPE_JITTER)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * O feixe de luz da Pokébola (docs/features/024-esfera-de-invocar.md,
 * refeito no estilo do Cobblemon em docs/features/043-captura.md): um
 * cilindro com a textura `phase_beam.png` correndo ao longo dele, miolo e
 * brilho em volta (`FEEDBACK.PHASE_BEAM`), tingido com a cor da bola, da
 * bola até a criatura. No lugar da criatura, um "envelope" de luz da mesma
 * cor: encolhendo e indo pra bola ao recolher/capturar, crescendo ao
 * invocar (`resolveBeamPhase`).
 *
 * A ponta da bola: no recolher, a mão do treinador (onde a bola está, ver
 * `handBallViewSystem.js`) a cada frame; nos outros, o ponto guardado no
 * `RecallBeam` (`fromX/Y/Z`). A ponta da criatura é a `Position` da
 * entidade (a origem do grupo).
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual
 * (regra 3.4): o tempo de vida de verdade é do `summonEffectsSystem`.
 */
export function RecallBeamView({ entity }) {
  const groupRef = useRef()
  const coreRef = useRef()
  const glowRef = useRef()
  const envelopeRef = useRef()
  const state = useRef({
    elapsed: 0,
    duration: 1,
    mode: 'recall',
    refresh: 0,
    envelopeRadius: DEFAULT_ENVELOPE_RADIUS,
    from: new THREE.Vector3(),
  })

  useLayoutEffect(() => {
    const beam = entity.get(RecallBeam)
    const current = state.current
    current.duration = Math.max(beam.lifetime, 1e-3)
    current.mode = beam.mode ?? 'recall'
    current.from.set(beam.fromX, beam.fromY, beam.fromZ)
    current.envelopeRadius = resolveEnvelopeRadius(
      getSpecies(beam.speciesId)?.body,
    )

    const color = new THREE.Color(resolveBeamColor(beam.itemId))
    const { OPACITY, GLOW_OPACITY, ENVELOPE_OPACITY } =
      GAME_CONFIG.FEEDBACK.PHASE_BEAM
    const meshes = [
      [coreRef.current, OPACITY],
      [glowRef.current, GLOW_OPACITY],
      [envelopeRef.current, ENVELOPE_OPACITY],
    ]
    for (const [mesh, opacity] of meshes) {
      mesh.material.color.copy(color)
      mesh.userData.baseOpacity = opacity
    }
    envelopeRef.current.geometry = buildEnvelopeGeometry(
      current.envelopeRadius,
      Math.random() * 1000,
    )

    let cancelled = false
    const textures = []
    loadTexture(BEAM_TEXTURE_PATH).then((loaded) => {
      if (!loaded || cancelled) return
      for (const mesh of [coreRef.current, glowRef.current]) {
        const texture = loaded.clone()
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.needsUpdate = true
        mesh.material.map = texture
        mesh.material.needsUpdate = true
        textures.push(texture)
      }
    })

    registerView(entity, groupRef.current)
    const envelope = envelopeRef.current
    return () => {
      cancelled = true
      unregisterView(entity)
      envelope.geometry?.dispose()
      for (const texture of textures) texture.dispose()
    }
  }, [entity])

  useFrame((_frame, delta) => {
    const group = groupRef.current
    if (!group) return
    const current = state.current
    current.elapsed += delta
    const t = Math.min(current.elapsed / current.duration, 1)
    const phase = resolveBeamPhase(current.mode, t)

    // A ponta da bola, em coordenadas do grupo (a criatura é a origem).
    if (current.mode === 'recall') followHand(current.from)
    const from = group.worldToLocal(current.from.clone())

    const { RADIUS, GLOW_RADIUS, SCROLL_SPEED } =
      GAME_CONFIG.FEEDBACK.PHASE_BEAM
    placeBeam(coreRef.current, from, RADIUS, phase.fade)
    placeBeam(glowRef.current, from, GLOW_RADIUS, phase.fade)
    for (const mesh of [coreRef.current, glowRef.current]) {
      const map = mesh.material.map
      if (map) map.offset.y -= SCROLL_SPEED * delta
    }

    const envelope = envelopeRef.current
    envelope.position.copy(from).multiplyScalar(phase.envelopeTravel)
    envelope.scale.setScalar(Math.max(phase.envelopeScale, 1e-4))
    envelope.material.opacity =
      (envelope.userData.baseOpacity ?? 1) * phase.fade

    current.refresh -= delta
    if (current.refresh > 0) return
    current.refresh = REFRESH_INTERVAL
    envelope.geometry.dispose()
    envelope.geometry = buildEnvelopeGeometry(
      current.envelopeRadius,
      Math.random() * 1000,
    )
  })

  const beamMaterial = (
    <meshBasicMaterial
      transparent
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      side={THREE.DoubleSide}
      toneMapped={false}
    />
  )
  return (
    <group ref={groupRef}>
      <mesh ref={coreRef} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, BEAM_SIDES, 1, true]} />
        {beamMaterial}
      </mesh>
      <mesh ref={glowRef} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, BEAM_SIDES, 1, true]} />
        {beamMaterial}
      </mesh>
      <mesh ref={envelopeRef}>
        <meshBasicMaterial
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** Põe o cilindro do feixe da origem do grupo até `from`, com raio `radius`. */
function placeBeam(mesh, from, radius, fade) {
  const length = from.length()
  mesh.visible = length > 1e-3
  if (!mesh.visible) return
  mesh.position.copy(from).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(UP, from.clone().normalize())
  mesh.scale.set(radius, length, radius)
  mesh.material.opacity = (mesh.userData.baseOpacity ?? 1) * fade
  if (mesh.material.map) {
    mesh.material.map.repeat.set(1, length / TEXTURE_TILE_LENGTH)
  }
}

/** A mão do treinador no mundo (onde a bola está no recolher). */
function followHand(target) {
  const bone = HAND_BONE_NAME
    ? getAnimatedBonesEntry(playerEntity)?.bones[HAND_BONE_NAME]?.bone
    : null
  if (!bone) return
  bone.updateWorldMatrix(true, false)
  bone.getWorldPosition(target)
}

export function RecallBeamsView() {
  const beams = useQuery(RecallBeam, Position, Rotation)

  return (
    <>
      {beams.map((entity) => (
        <RecallBeamView key={entity} entity={entity} />
      ))}
    </>
  )
}
