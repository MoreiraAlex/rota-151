'use client'

/**
 * Cena do laboratório de alcance (docs/features/062-spawn-estilo-
 * cobblemon.md): raiz R3F própria, fora do `GameLoop` do jogo, com a selvagem,
 * o som e a etiqueta de verdade. A câmera fica parada na origem e só gira (é
 * dela que som e etiqueta medem a distância); os anéis no chão mostram os
 * limites.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Html, OrbitControls } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createEventQueue } from '@/core/events'
import { Position } from '@/core/traits'
import { world } from '@/core/world/world'
import { getAudioListener } from '@/view/audio/audioListener'
import {
  captureRenderTransforms,
  setRenderAlpha,
} from '@/view/registry/renderInterpolation'
import { getFootstepAudioEntry } from '@/view/registry/footstepAudioRegistry'
import { getVoiceAudioEntry } from '@/view/registry/voiceAudioRegistry'
import { WildCreaturesView } from '@/view/scene/CreatureView'
import { NameplatesView } from '@/view/scene/NameplateView'
import { animationSystem } from '@/view/systems/animationSystem'
import { audioListenerSystem } from '@/view/systems/audioListenerSystem'
import { eyeBlinkSystem } from '@/view/systems/eyeBlinkSystem'
import { footstepAudioSystem } from '@/view/systems/footstepAudioSystem'
import { hitStopSystem } from '@/view/systems/hitStopSystem'
import { mouthSyncSystem } from '@/view/systems/mouthSyncSystem'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { voiceAudioSystem } from '@/view/systems/voiceAudioSystem'
import { CryComparator } from './CryComparator'
import { createLevelMeter } from './levelMeter'
import { bearingFrom, createPlayWatcher } from './rangeLabData'
import { desmontarRangeLab, runRangeLabStep } from './rangeLabWorld'

const { FIXED_TIMESTEP, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } = GAME_CONFIG.LOOP

// Altura da câmera, como a do jogo atrás do personagem.
export const RANGE_LAB_CAMERA_HEIGHT = 5.6
// Para onde a câmera olha ao abrir (e em "olhar para a frente"): a frente do
// lab, quase na horizontal.
const CAMERA_LOOK = [0, RANGE_LAB_CAMERA_HEIGHT - 0.002, 0.01]
export const RANGE_LAB_FOV = 60
const GROUND_SIZE = 500
const GRID_SPACING = 10
const GROUND_COLOR = '#6f9a4c'
const SKY_COLOR = '#a9cfe8'
const RING_WIDTH = 0.18
const RING_LIFT = 0.03
const RING_SEGMENTS = 128
// Para onde o texto do anel fica: um pouco de lado, fora da linha da selvagem.
const RING_LABEL_ANGLE = 0.08
// Som abaixo disto é silêncio (ruído de conta do áudio).
export const SILENCE_THRESHOLD = 0.002
// Quanto (s) o fim de um som ainda aparece no medidor (`levelMeter.js`).
const VOICE_TAIL_SECONDS = 0.1

const RENDER_SYSTEMS = [
  syncTransformSystem,
  hitStopSystem,
  animationSystem,
  audioListenerSystem,
  footstepAudioSystem,
  voiceAudioSystem,
  eyeBlinkSystem,
  mouthSyncSystem,
]

const cameraForward = new THREE.Vector3()
const cameraRight = new THREE.Vector3()

/**
 * Distância até a câmera e de onde a selvagem vem, vista dela (`bearingFrom`,
 * no chão: o pan do som só olha esquerda/direita).
 */
function whereFromCamera(entity, camera) {
  const position = entity?.isAlive?.() ? entity.get(Position) : null
  if (!position) return { distance: null, bearing: null }
  const toSource = {
    x: position.x - camera.position.x,
    y: position.y - camera.position.y,
    z: position.z - camera.position.z,
  }
  camera.getWorldDirection(cameraForward)
  cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
  return {
    distance: Math.hypot(toSource.x, toSource.y, toSource.z),
    bearing: bearingFrom(cameraForward, cameraRight, toSource),
  }
}

// A câmera volta a olhar para a frente do lab.
function lookAhead(camera, controls) {
  camera.position.set(0, RANGE_LAB_CAMERA_HEIGHT, 0)
  if (!controls) return
  controls.target.set(...CAMERA_LOOK)
  controls.update()
}

/**
 * O passo fixo + apresentação do `GameLoop`, com os systems que o som e a
 * animação usam. Mede o que sai no som: `liveRef` recebe a leitura de agora e
 * `onLog`, cada grito e cada estalo.
 */
function RangeLabLoop({ labRef, stateRef, liveRef, ranges, onLog }) {
  const accumulator = useRef(0)
  const events = useMemo(() => createEventQueue(), [])
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const meter = useRef(null)
  const voiceEndedAt = useRef(-Infinity)
  const voiceWatcher = useMemo(
    () =>
      createPlayWatcher({
        maxDistance: ranges.voice.maxDistance,
        threshold: SILENCE_THRESHOLD,
      }),
    [ranges.voice.maxDistance],
  )
  const footstepWatcher = useMemo(
    () =>
      createPlayWatcher({
        maxDistance: ranges.footstep.maxDistance,
        threshold: SILENCE_THRESHOLD,
      }),
    [ranges.footstep.maxDistance],
  )

  useEffect(() => {
    const created = createLevelMeter(getAudioListener())
    meter.current = created
    const state = stateRef.current
    return () => {
      desmontarRangeLab(state)
      created.dispose()
      meter.current = null
    }
  }, [stateRef])

  useFrame(({ clock }, delta) => {
    accumulator.current += Math.min(delta, MAX_FRAME_TIME)
    let steps = 0
    while (
      accumulator.current >= FIXED_TIMESTEP &&
      steps < MAX_STEPS_PER_FRAME
    ) {
      events.beginStep()
      captureRenderTransforms(world)
      runRangeLabStep({
        world,
        delta: FIXED_TIMESTEP,
        lab: labRef.current,
        state: stateRef.current,
      })
      accumulator.current -= FIXED_TIMESTEP
      steps += 1
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator.current = 0
    setRenderAlpha(
      steps === MAX_STEPS_PER_FRAME ? 1 : accumulator.current / FIXED_TIMESTEP,
    )

    const context = { world, delta, camera, frameEvents: events.drain() }
    for (const system of RENDER_SYSTEMS) system(context)

    const { entity, viewCommands } = stateRef.current
    if (viewCommands.length) {
      viewCommands.length = 0
      lookAhead(camera, controls)
    }
    const { distance, bearing } = whereFromCamera(entity, camera)
    const { peak, left, right } = meter.current?.readPeaks() ?? {
      peak: 0,
      left: 0,
      right: 0,
    }
    liveRef.current = { distance, bearing, peak, left, right }

    const voicePlaying = !!getVoiceAudioEntry(entity)?.audio.isPlaying
    const voice = voiceWatcher.update({
      playing: voicePlaying,
      distance: distance ?? Infinity,
      bearing: bearing ?? 0,
      peak,
      left,
      right,
    })
    if (voice) onLog({ kind: 'voice', ...voice })

    // Com a voz tocando, o medidor não separa os dois: passo só conta sozinho,
    // e depois de a cauda da voz sair do trecho que o medidor lê.
    if (voicePlaying) voiceEndedAt.current = clock.elapsedTime
    const voiceInMeter =
      clock.elapsedTime - voiceEndedAt.current < VOICE_TAIL_SECONDS
    const footstep = footstepWatcher.update({
      playing: !!getFootstepAudioEntry(entity)?.audio.isPlaying,
      distance: distance ?? Infinity,
      peak: voiceInMeter ? 0 : peak,
    })
    if (footstep?.clicked) onLog({ kind: 'footstep', ...footstep })
  })

  return null
}

function Ring({ ring }) {
  const label = `${ring.radius} m · ${ring.labels.join(' · ')}`
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, RING_LIFT, 0]}>
        <ringGeometry
          args={[
            ring.radius - RING_WIDTH,
            ring.radius + RING_WIDTH,
            RING_SEGMENTS,
          ]}
        />
        <meshBasicMaterial color={ring.color} />
      </mesh>
      <Html
        center
        zIndexRange={[0, 0]}
        className="pointer-events-none"
        position={[
          Math.sin(RING_LABEL_ANGLE) * ring.radius,
          RING_LIFT,
          Math.cos(RING_LABEL_ANGLE) * ring.radius,
        ]}
      >
        <span
          className="whitespace-nowrap rounded bg-black/70 px-1 text-[10px]"
          style={{ color: ring.color }}
        >
          {label}
        </span>
      </Html>
    </group>
  )
}

// Zoom de lente: aproxima a imagem sem mover a câmera (a distância até o som
// e a etiqueta não muda).
function CameraZoom({ zoom }) {
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }, [camera, zoom])
  return null
}

export function RangeLabScene({
  labRef,
  stateRef,
  liveRef,
  compareRef,
  ranges,
  rings,
  zoom,
  onLog,
}) {
  return (
    <>
      <color attach="background" args={[SKY_COLOR]} />
      <CameraZoom zoom={zoom} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 5]} intensity={2} />
      {/* Só gira no lugar: a distância até a câmera não muda. */}
      <OrbitControls
        makeDefault
        target={CAMERA_LOOK}
        enablePan={false}
        enableZoom={false}
        rotateSpeed={-0.4}
      />
      <RangeLabLoop
        labRef={labRef}
        stateRef={stateRef}
        liveRef={liveRef}
        ranges={ranges}
        onLog={onLog}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={GROUND_COLOR} />
      </mesh>
      <gridHelper
        args={[GROUND_SIZE, GROUND_SIZE / GRID_SPACING, '#3f6a2a', '#5d8640']}
        position={[0, RING_LIFT / 2, 0]}
      />
      {rings.map((ring) => (
        <Ring key={ring.radius} ring={ring} />
      ))}
      <CryComparator
        compareRef={compareRef}
        labRef={labRef}
        liveRef={liveRef}
        onLog={onLog}
      />
      <Suspense fallback={null}>
        <WildCreaturesView />
      </Suspense>
      <NameplatesView />
    </>
  )
}
