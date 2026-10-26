'use client'

/**
 * Cena do laboratório de golpes (docs/features/061-revisao-das-skills.md,
 * Parte 1): o chão com o relevo, a luz do meio-dia e as views do jogo que
 * desenham o golpe — criaturas, VFX, aviso no chão, anel do tempo da ação,
 * efeitos contínuos e de status, números de dano —, tocadas pelo loop do
 * laboratório.
 *
 * Raiz R3F própria, fora do Canvas/GameLoop do jogo: os `useFrame` daqui
 * não são o do loop do jogo (mesma exceção de `app/tools/teste-animations`).
 *
 * O relógio do Canvas é do laboratório (`frameloop="never"` + `LabClock`):
 * câmera lenta e pausa valem pra tudo — simulação, animação e os VFX, que
 * andam pelo `delta` do R3F.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { createEventQueue } from '@/core/events'
import { initPhysics, disposePhysics } from '@/core/physics/physicsWorld'
import { lightingAt } from '@/core/time/dayCycle'
import {
  captureRenderTransforms,
  setRenderAlpha,
} from '@/view/registry/renderInterpolation'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { hitStopSystem } from '@/view/systems/hitStopSystem'
import { animationSystem } from '@/view/systems/animationSystem'
import { fireLightSystem } from '@/view/systems/fireLightSystem'
import { audioListenerSystem } from '@/view/systems/audioListenerSystem'
import { attackAudioSystem } from '@/view/systems/attackAudioSystem'
import { hitFlashSystem } from '@/view/systems/hitFlashSystem'
import { damageNumberSystem } from '@/view/systems/damageNumberSystem'
import { afterimageSystem } from '@/view/systems/afterimageSystem'
import { eyeBlinkSystem } from '@/view/systems/eyeBlinkSystem'
import { mouthSyncSystem } from '@/view/systems/mouthSyncSystem'
import { AttackEffectsView } from '@/view/scene/AttackEffectView'
import { AttackTelegraphView } from '@/view/scene/AttackTelegraphView'
import { ContinuousAttackEffectsView } from '@/view/scene/ContinuousAttackEffectsView'
import { StatusConditionEffectsView } from '@/view/scene/StatusConditionEffectsView'
import { CreaturesView, WildCreaturesView } from '@/view/scene/CreatureView'
import { DamageNumbersView } from '@/view/scene/DamageNumbersView'
import { ActionTimerRingView } from '@/view/scene/ActionTimerRingView'
import { AttackShape, placeGroundPill } from '@/view/scene/AttackShape'
import { verticalClearance } from '@/core/physics/capsule'
import { buildReliefGrid, buildReliefMesh } from './labRelief'
import {
  resolveHitTrigger,
  resolveTriggerSegment,
} from '@/core/battle/hitTrigger'
import { CharacterController, Position, Rotation } from '@/core/traits'
import {
  LAB_GROUND,
  LAB_MAX_TARGETS,
  LabAttacker,
  findLabActor,
  resolveLabActorSpecies,
  desmontarLab,
  montarLab,
  runLabFixedStep,
} from './skillLabWorld'

const { FIXED_TIMESTEP, MAX_FRAME_TIME, MAX_STEPS_PER_FRAME } = GAME_CONFIG.LOOP

// Meio-dia (fração do dia) — luz do jogo sem clima.
const NOON = 0.5
const SUN_DISTANCE = 10
const GROUND_COLOR = '#6f9a4c'
// Grade no chão pra medir distância: uma linha a cada meio metro e, mais
// escura, uma a cada metro — um pouco acima do chão.
const GRID_MINOR = { spacing: 0.5, color: '#5d8640', lift: 0.008 }
const GRID_MAJOR = { spacing: 1, color: '#2f4d1d', lift: 0.012 }

/**
 * Systems de apresentação, na ordem do `registerSystems.js` do jogo — só os
 * que o golpe usa.
 */
const LAB_RENDER_SYSTEMS = [
  syncTransformSystem,
  hitStopSystem,
  animationSystem,
  fireLightSystem,
  audioListenerSystem,
  attackAudioSystem,
  hitFlashSystem,
  damageNumberSystem,
  afterimageSystem,
  eyeBlinkSystem,
  mouthSyncSystem,
]

/**
 * Relógio do Canvas: avança o tempo na velocidade escolhida
 * (`clock.speed`, 0 = pausado) e um passo fixo quando pedem
 * (`clock.step`). O R3F com `frameloop="never"` usa a diferença entre os
 * instantes passados ao `advance` como o `delta` de todo `useFrame`.
 */
function LabClock({ clockRef }) {
  const advance = useThree((state) => state.advance)

  useEffect(() => {
    let request = 0
    let last = null
    let virtual = 0
    const tick = (now) => {
      request = requestAnimationFrame(tick)
      const real = last === null ? 0 : (now - last) / 1000
      last = now
      const clock = clockRef.current
      virtual += Math.min(real, MAX_FRAME_TIME) * clock.speed
      if (clock.step) {
        virtual += FIXED_TIMESTEP
        clock.step = false
      }
      advance(virtual)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [advance, clockRef])

  return null
}

/**
 * O loop do laboratório: o mesmo passo fixo + apresentação do `GameLoop`
 * do jogo, com os systems do laboratório. `labRef.current` são as escolhas
 * da página; `onEvents` recebe os eventos de cada quadro.
 *
 * É o dono da cena: monta quando `sceneKey` muda (quem está nela) e
 * desmonta ao sair — uma remontagem (recarga a quente) refaz tudo.
 */
function LabLoop({ labRef, sceneKey, onEvents }) {
  const accumulator = useRef(0)
  const events = useMemo(() => createEventQueue(), [])
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    initPhysics()
    return () => {
      desmontarLab(world)
      disposePhysics()
    }
  }, [])

  useEffect(() => {
    montarLab(world, labRef.current)
  }, [sceneKey, labRef])

  useFrame((_, delta) => {
    accumulator.current += Math.min(delta, MAX_FRAME_TIME)
    let steps = 0
    while (
      accumulator.current >= FIXED_TIMESTEP &&
      steps < MAX_STEPS_PER_FRAME
    ) {
      events.beginStep()
      captureRenderTransforms(world)
      runLabFixedStep({
        world,
        delta: FIXED_TIMESTEP,
        input: {},
        events,
        settings: { castModeOverride: null },
        lab: labRef.current,
      })
      accumulator.current -= FIXED_TIMESTEP
      steps += 1
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator.current = 0
    setRenderAlpha(
      steps === MAX_STEPS_PER_FRAME ? 1 : accumulator.current / FIXED_TIMESTEP,
    )

    const frameEvents = events.drain()
    const context = { world, delta, camera, frameEvents }
    for (const system of LAB_RENDER_SYSTEMS) system(context)
    if (frameEvents.length > 0) onEvents(frameEvents)
  })

  return null
}

function NoonLight() {
  const ambientRef = useRef()
  const sunRef = useRef()
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const look = lightingAt(NOON)
    ambientRef.current.color.setRGB(...look.ambient)
    ambientRef.current.intensity = look.ambientIntensity
    sunRef.current.color.setRGB(...look.light)
    sunRef.current.intensity = look.lightIntensity
    const { x, y, z } = look.lightDirection
    sunRef.current.position.set(x, y, z).multiplyScalar(SUN_DISTANCE)
    scene.background = new THREE.Color().setRGB(...look.horizon)
  }, [scene])

  return (
    <>
      <ambientLight ref={ambientRef} />
      <directionalLight ref={sunRef} />
    </>
  )
}

function gridGeometry(relief, { spacing, lift }) {
  const lines = new THREE.BufferGeometry()
  lines.setAttribute(
    'position',
    new THREE.BufferAttribute(
      buildReliefGrid(relief, LAB_GROUND.size, lift, spacing),
      3,
    ),
  )
  return lines
}

/** O chão com o relevo da cena e a grade (meio metro e metro) por cima dele. */
function Ground({ relief }) {
  const key = JSON.stringify(relief)
  const { geometry, minor, major } = useMemo(() => {
    const { vertices, indices } = buildReliefMesh(relief, LAB_GROUND.size)
    const mesh = new THREE.BufferGeometry()
    mesh.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    mesh.setIndex(new THREE.BufferAttribute(indices, 1))
    mesh.computeVertexNormals()
    return {
      geometry: mesh,
      minor: gridGeometry(relief, GRID_MINOR),
      major: gridGeometry(relief, GRID_MAJOR),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(
    () => () => {
      geometry.dispose()
      minor.dispose()
      major.dispose()
    },
    [geometry, minor, major],
  )

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={GROUND_COLOR} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={minor}>
        <lineBasicMaterial color={GRID_MINOR.color} />
      </lineSegments>
      <lineSegments geometry={major}>
        <lineBasicMaterial color={GRID_MAJOR.color} />
      </lineSegments>
    </>
  )
}

// Cápsula da física exibida (arame, por cima de tudo).
const CAPSULE_KINDS = {
  physics: { color: '#29b6f6' },
}
// Trigger de acerto exibido: pílula pintada no chão.
const TRIGGER_FILL = { color: '#ff4081', opacity: 0.25 }
const TRIGGER_EDGE = { color: '#ff80ab', opacity: 0.95 }
// Acima da marcação do golpe (`AttackTelegraphView`, ordem 16).
const TRIGGER_RENDER_ORDER = 20
// Um lugar por quem pode estar na cena: o atacante e cada alvo.
const ACTOR_SLOTS = [
  { role: 'attacker', index: 0 },
  ...Array.from({ length: LAB_MAX_TARGETS }, (_, index) => ({
    role: 'target',
    index,
  })),
]
const CAPSULE_OPACITY = 0.8
const CAPSULE_RENDER_ORDER = 30
// Malha da cápsula: segmentos das tampas e da volta.
const CAPSULE_CAP_SEGMENTS = 4
const CAPSULE_RADIAL_SEGMENTS = 12
// A `CapsuleGeometry` do Three fica em pé (eixo Y); deitar é girar.
const CAPSULE_TILT = {
  y: new THREE.Quaternion(),
  x: new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 2,
  ),
  z: new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2,
  ),
}
const UP = new THREE.Vector3(0, 1, 0)

// A cápsula da física no mundo: centro, raio, meio-comprimento e eixo.
function resolveCapsule(entity) {
  const body = entity.get(CharacterController)
  return {
    center: entity.get(Position),
    radius: body.capsuleRadius,
    halfHeight: body.capsuleHalfHeight,
    axis: body.capsuleAxis,
    yaw: entity.get(Rotation).y,
  }
}

/**
 * A cápsula da física do atacante e dos alvos, em arame, quando a página pede
 * (`showRef.current[role].physics`). Lê o ECS a cada frame; a geometria só é
 * refeita quando as medidas mudam.
 */
function CapsuleGizmos({ showRef }) {
  const groupRef = useRef()
  const gizmos = useMemo(
    () =>
      ACTOR_SLOTS.flatMap(({ role, index }) =>
        Object.entries(CAPSULE_KINDS).map(([kind, { color }]) => {
          const mesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
              color,
              wireframe: true,
              transparent: true,
              opacity: CAPSULE_OPACITY,
              depthTest: false,
            }),
          )
          mesh.renderOrder = CAPSULE_RENDER_ORDER
          mesh.visible = false
          return { role, index, kind, mesh, key: null }
        }),
      ),
    [],
  )
  const yaw = useMemo(() => new THREE.Quaternion(), [])

  useEffect(() => {
    const group = groupRef.current
    for (const { mesh } of gizmos) group.add(mesh)
    return () => {
      for (const { mesh } of gizmos) {
        group.remove(mesh)
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
    }
  }, [gizmos])

  useFrame(() => {
    for (const gizmo of gizmos) {
      const { mesh } = gizmo
      const entity = findLabActor(world, gizmo.role, gizmo.index)
      if (!showRef.current[gizmo.role]?.[gizmo.kind] || !entity) {
        mesh.visible = false
        continue
      }
      const capsule = resolveCapsule(entity)
      const key = `${capsule.radius}|${capsule.halfHeight}`
      if (gizmo.key !== key) {
        mesh.geometry.dispose()
        mesh.geometry = new THREE.CapsuleGeometry(
          capsule.radius,
          capsule.halfHeight * 2,
          CAPSULE_CAP_SEGMENTS,
          CAPSULE_RADIAL_SEGMENTS,
        )
        gizmo.key = key
      }
      mesh.position.set(capsule.center.x, capsule.center.y, capsule.center.z)
      yaw.setFromAxisAngle(UP, capsule.yaw)
      mesh.quaternion
        .copy(yaw)
        .multiply(CAPSULE_TILT[capsule.axis] ?? CAPSULE_TILT.y)
      mesh.visible = true
    }
  })

  return <group ref={groupRef} />
}

/**
 * O trigger de acerto do atacante e dos alvos (`hitTrigger.js`), pintado no
 * chão como a marcação do golpe, quando a página pede
 * (`showRef.current[role].trigger`).
 */
function TriggerGizmos({ showRef }) {
  const shapeRefs = useRef({})

  useFrame(() => {
    ACTOR_SLOTS.forEach(({ role, index }, slot) => {
      const shape = shapeRefs.current[slot]
      if (!shape?.root) return
      const entity = findLabActor(world, role, index)
      const visible = !!showRef.current[role]?.trigger && !!entity
      shape.root.visible = visible
      if (!visible) return

      const pos = entity.get(Position)
      const body = entity.get(CharacterController)
      const segment = resolveTriggerSegment(
        pos,
        entity.get(Rotation).y,
        resolveHitTrigger(resolveLabActorSpecies(entity).body),
      )
      placeGroundPill(shape, {
        a: segment.a,
        b: segment.b,
        radius: segment.radius,
        topY: pos.y,
        fallbackY: pos.y - verticalClearance(body),
      })
    })
  })

  return ACTOR_SLOTS.map((_, slot) => (
    <AttackShape
      key={slot}
      ref={(handle) => (shapeRefs.current[slot] = handle)}
      fillColor={TRIGGER_FILL.color}
      fillOpacity={TRIGGER_FILL.opacity}
      edgeColor={TRIGGER_EDGE.color}
      edgeOpacity={TRIGGER_EDGE.opacity}
      depthTest={false}
      renderOrder={TRIGGER_RENDER_ORDER}
    />
  ))
}

/**
 * Atalhos de câmera, em volta do meio entre o atacante e o primeiro alvo
 * (`distance`, em Z).
 * `request` muda (`{ view, id }`) → a câmera vai pro atalho.
 */
const CAMERA_VIEWS = {
  side: (d) => ({ position: [4 + d / 2, 1.5, d / 2], target: [0, 0.4, d / 2] }),
  front: (d) => ({ position: [1.2, 1.2, d + 2], target: [0, 0.4, 0] }),
  top: (d) => ({ position: [0, 6 + d, d / 2 + 0.01], target: [0, 0, d / 2] }),
  behind: (d) => ({ position: [0, 2.5, -4], target: [0, 0.4, d / 2] }),
}

function CameraRig({ request, distance }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)

  useEffect(() => {
    if (!controls) return
    const view = CAMERA_VIEWS[request.view](distance)
    camera.position.set(...view.position)
    controls.target.set(...view.target)
    controls.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, controls])

  return <OrbitControls makeDefault />
}

export function SkillLabScene({
  labRef,
  clockRef,
  cameraRequest,
  distance,
  sceneKey,
  relief,
  capsulesRef,
  onEvents,
}) {
  return (
    <>
      <LabClock clockRef={clockRef} />
      <LabLoop labRef={labRef} sceneKey={sceneKey} onEvents={onEvents} />
      <CameraRig request={cameraRequest} distance={distance} />
      <NoonLight />
      <Ground relief={relief} />
      <ActionTimerRingView follow={LabAttacker} />
      <CapsuleGizmos showRef={capsulesRef} />
      <TriggerGizmos showRef={capsulesRef} />
      {/* Cada grupo no seu Suspense: um modelo carregando não esconde o resto. */}
      <Suspense fallback={null}>
        <CreaturesView />
      </Suspense>
      <Suspense fallback={null}>
        <WildCreaturesView />
      </Suspense>
      <Suspense fallback={null}>
        <AttackEffectsView />
        <AttackTelegraphView />
        <ContinuousAttackEffectsView />
        <StatusConditionEffectsView />
        <DamageNumbersView />
      </Suspense>
    </>
  )
}

export { CAMERA_VIEWS }
