'use client'

/**
 * Laboratório de corpo — NÃO faz parte do jogo (página `/tools/lab-corpo`).
 * Mostra o modelo de uma espécie com a cápsula de colisão por cima, no chão,
 * do jeito que o jogo monta (`bodyLabMath.js`), com uma animação do `.glb`
 * em loop. A cápsula (`body`), o `modelOffset` e o `model.scale` são
 * ajustáveis ao vivo, com as medidas do modelo na tela (pé em relação ao
 * chão, altura, comprimento); "Copiar" leva o trecho pro `index.js`.
 *
 * Raiz R3F própria, fora do Canvas/GameLoop do jogo: o `useFrame` daqui não
 * é o do loop do jogo (mesma exceção de `app/tools/teste-animations`).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { listSpecies } from '@/core/data/species'
import { isOutline } from '@/view/materials/toonMaterial'
import { useSpeciesModel } from '../animationLab/useSpeciesModel'
import { Slider } from '../shared/Slider'
import {
  formatBodySnippet,
  resolveCapsuleCenterHeight,
  resolveCapsuleSize,
  resolveGroundedOffsetY,
} from './bodyLabMath'

const SPECIES = listSpecies().filter((species) => species.model?.path)
const DEG_TO_RAD = Math.PI / 180
// de quanto em quanto tempo (s) as medidas do modelo são refeitas
const MEASURE_INTERVAL = 0.2
const AXES = ['y', 'x', 'z']
// a cápsula do Three nasce em pé (eixo Y); deitar igual ao `CAPSULE_TILT`
// do jogo (`core/physics/colliders.js`)
const CAPSULE_TILT = {
  y: [0, 0, 0],
  x: [0, 0, Math.PI / 2],
  z: [Math.PI / 2, 0, 0],
}

function initialBody(species) {
  return {
    capsuleRadius: species.body.capsuleRadius,
    capsuleHalfHeight: species.body.capsuleHalfHeight,
    capsuleAxis: species.body.capsuleAxis ?? 'y',
    modelOffset: [...(species.body.modelOffset ?? [0, 0, 0])],
  }
}

const cm = (meters) => `${(meters * 100).toFixed(1)} cm`

function Capsule({ body }) {
  const geometry = useMemo(
    () =>
      new THREE.CapsuleGeometry(
        body.capsuleRadius,
        2 * body.capsuleHalfHeight,
        8,
        16,
      ),
    [body.capsuleRadius, body.capsuleHalfHeight],
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} rotation={CAPSULE_TILT[body.capsuleAxis]}>
      <meshBasicMaterial
        color="#38bdf8"
        wireframe
        transparent
        opacity={0.6}
        depthTest={false}
      />
    </mesh>
  )
}

/** Mede o modelo (pose atual da animação) no referencial do corpo. */
function measureModel(cloned, root) {
  const box = new THREE.Box3()
  const meshBox = new THREE.Box3()
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  cloned.traverse((child) => {
    // o contorno do toon é uma casca um pouco maior: fica fora da medida
    if (!child.isMesh || isOutline(child)) return
    if (child.isSkinnedMesh) child.computeBoundingBox()
    else child.geometry.computeBoundingBox()
    meshBox.copy(
      child.isSkinnedMesh ? child.boundingBox : child.geometry.boundingBox,
    )
    meshBox.applyMatrix4(child.matrixWorld).applyMatrix4(toRoot)
    box.union(meshBox)
  })
  if (box.isEmpty()) return null
  const size = box.getSize(new THREE.Vector3())
  return { bottom: box.min.y, height: size.y, length: size.z, width: size.x }
}

function BodyModel({
  species,
  animation,
  timeScale,
  scale,
  rootRef,
  onMeasure,
}) {
  const { cloned, mixer } = useSpeciesModel(species, animation)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    mixer.timeScale = timeScale
    mixer.update(delta)
    elapsed.current += delta
    if (elapsed.current < MEASURE_INTERVAL || !rootRef.current) return
    elapsed.current = 0
    cloned.updateMatrixWorld(true)
    onMeasure(measureModel(cloned, rootRef.current))
  })

  return <primitive object={cloned} scale={scale} />
}

export function BodyLab() {
  const [speciesId, setSpeciesId] = useState(SPECIES[0]?.id)
  const species = SPECIES.find((candidate) => candidate.id === speciesId)
  const [body, setBody] = useState(() => initialBody(species))
  const [scale, setScale] = useState(species.model.scale ?? 1)
  const [animation, setAnimation] = useState('idle')
  const [timeScale, setTimeScale] = useState(1)
  const [yaw, setYaw] = useState(0)
  const [showCapsule, setShowCapsule] = useState(true)
  const [measure, setMeasure] = useState(null)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef()

  const centerHeight = resolveCapsuleCenterHeight(body)
  const capsule = resolveCapsuleSize(body)
  const animationNames = useMemo(
    () => Object.keys(species.nativeAnimations ?? {}).sort(),
    [species],
  )

  const chooseSpecies = (id) => {
    const next = SPECIES.find((candidate) => candidate.id === id)
    setSpeciesId(id)
    setBody(initialBody(next))
    setScale(next.model.scale ?? 1)
    setMeasure(null)
  }
  const setBodyField = (field, value) =>
    setBody((current) => ({ ...current, [field]: value }))
  const setOffset = (index, value) =>
    setBody((current) => {
      const modelOffset = [...current.modelOffset]
      modelOffset[index] = value
      return { ...current, modelOffset }
    })
  const touchGround = () => {
    if (!measure) return
    setOffset(1, resolveGroundedOffsetY(body.modelOffset, measure.bottom))
  }
  const copy = async () => {
    await navigator.clipboard.writeText(formatBodySnippet(body, scale))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // a chave do jogo (`nativeAnimations`) → o nome da animação no `.glb`
  const entry = species.nativeAnimations?.[animation]
  const glbAnimation =
    typeof entry === 'string'
      ? entry
      : (entry?.animation ?? entry?.loop ?? entry?.start ?? '')

  return (
    <div className="relative h-screen w-screen bg-neutral-900 text-sm text-white">
      <div className="absolute inset-y-0 left-0 right-0 md:right-[30rem]">
        <Canvas camera={{ position: [1.5, 1, 2.5], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} />
          <gridHelper args={[4, 40, '#888', '#444']} />
          <OrbitControls makeDefault />
          <Suspense fallback={null}>
            <Bounds key={species.id} fit clip margin={1.8}>
              <group ref={rootRef} rotation-y={yaw * DEG_TO_RAD}>
                <group position={[0, centerHeight, 0]}>
                  {showCapsule && <Capsule body={body} />}
                  <group position={body.modelOffset}>
                    <BodyModel
                      species={species}
                      animation={glbAnimation}
                      timeScale={timeScale}
                      scale={scale}
                      rootRef={rootRef}
                      onMeasure={setMeasure}
                    />
                  </group>
                </group>
              </group>
            </Bounds>
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute right-0 top-0 h-full w-[30rem] max-w-full space-y-3 overflow-y-auto bg-black/75 p-4">
        <h1 className="text-base font-bold">Laboratório de corpo</h1>

        <label className="flex items-center gap-2">
          <span className="w-24 text-white/70">espécie</span>
          <select
            value={speciesId}
            onChange={(event) => chooseSpecies(event.target.value)}
            className="flex-1 rounded bg-white/10"
          >
            {SPECIES.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
                className="text-black"
              >
                {candidate.dexNumber ? `#${candidate.dexNumber} ` : ''}
                {candidate.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="w-24 text-white/70">animação</span>
          <select
            value={animation}
            onChange={(event) => setAnimation(event.target.value)}
            className="flex-1 rounded bg-white/10"
          >
            <option value="" className="text-black">
              (pose de descanso)
            </option>
            {animationNames.map((name) => (
              <option key={name} value={name} className="text-black">
                {name}
              </option>
            ))}
          </select>
        </label>

        <Slider
          label="velocidade"
          value={timeScale}
          min={0}
          max={3}
          step={0.05}
          onChange={setTimeScale}
          unit="×"
        />
        <Slider
          label="giro"
          value={yaw}
          min={-180}
          max={180}
          step={1}
          onChange={setYaw}
          unit="°"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCapsule}
            onChange={(event) => setShowCapsule(event.target.checked)}
          />
          mostrar a cápsula
        </label>

        <h2 className="pt-2 font-bold">Cápsula (body)</h2>
        <div className="flex items-center gap-2">
          <span className="w-32 text-white/70">eixo</span>
          {AXES.map((axis) => (
            <button
              key={axis}
              onClick={() => setBodyField('capsuleAxis', axis)}
              className={`rounded px-2 py-1 ${
                axis === body.capsuleAxis
                  ? 'bg-white text-black'
                  : 'bg-white/20'
              }`}
            >
              {axis === 'y' ? 'y (em pé)' : `${axis} (deitada)`}
            </button>
          ))}
        </div>
        <Slider
          label="raio"
          value={body.capsuleRadius}
          min={0.02}
          max={1.5}
          step={0.005}
          onChange={(value) => setBodyField('capsuleRadius', value)}
          unit="m"
        />
        <Slider
          label="meia altura"
          value={body.capsuleHalfHeight}
          min={0}
          max={1.5}
          step={0.005}
          onChange={(value) => setBodyField('capsuleHalfHeight', value)}
          unit="m"
        />

        <h2 className="pt-2 font-bold">Modelo</h2>
        <Slider
          label="escala"
          value={scale}
          min={0.1}
          max={3}
          step={0.01}
          onChange={setScale}
        />
        {['x (lado)', 'y (altura)', 'z (frente)'].map((label, index) => (
          <Slider
            key={label}
            label={`offset ${label}`}
            value={body.modelOffset[index]}
            min={-1.5}
            max={1.5}
            step={0.005}
            onChange={(value) => setOffset(index, value)}
            unit="m"
          />
        ))}
        <button
          onClick={touchGround}
          disabled={!measure}
          className="rounded bg-white/20 px-3 py-1"
        >
          Encostar o modelo no chão
        </button>

        <h2 className="pt-2 font-bold">Medidas</h2>
        <ul className="space-y-1 text-white/80">
          <li>
            cápsula: {cm(capsule.length)} de comprimento, {cm(capsule.height)}{' '}
            de altura; centro a {cm(centerHeight)} do chão
          </li>
          {measure && (
            <>
              <li>
                pé do modelo: {measure.bottom >= 0 ? '+' : ''}
                {cm(measure.bottom)} do chão
                {Math.abs(measure.bottom) > 0.01 &&
                  (measure.bottom > 0 ? ' (flutuando)' : ' (afundado)')}
              </li>
              <li>
                modelo: {cm(measure.height)} de altura, {cm(measure.length)} de
                comprimento, {cm(measure.width)} de largura
              </li>
            </>
          )}
        </ul>
        <p className="text-white/50">
          O pé é medido na pose atual da animação: confira com a idle e com a
          walk.
        </p>

        <div className="flex gap-2 pt-2">
          <button onClick={copy} className="rounded bg-white/20 px-3 py-1">
            {copied ? 'copiado!' : 'Copiar body'}
          </button>
          <button
            onClick={() => chooseSpecies(speciesId)}
            className="rounded bg-white/20 px-3 py-1"
          >
            Restaurar do arquivo
          </button>
        </div>
        <p className="text-white/50">
          As mudanças não são salvas: copie e cole no index.js da espécie (o
          scale vai dentro de model), ou me mande.
        </p>
      </div>
    </div>
  )
}
