'use client'

/**
 * Laboratório de luz de fogo — NÃO faz parte do jogo (página `/tools/lab-
 * luz`). Mostra o modelo de uma espécie em pé num chão iluminado, com a luz
 * de fogo (`species.vfx.fireLight`, docs/features/060-ajustes-por-
 * especie.md) presa no osso escolhido e a luz do dia da hora escolhida
 * (`lightingAt`, a mesma do jogo, sem o clima). Cor, brilho, alcance,
 * queda, deslocamento e tremor são ajustáveis ao vivo; "Copiar" leva o
 * bloco pro `index.js`.
 *
 * A luz anda pela mesma conta do jogo (`applyFireLight`, de
 * `fireLightSystem.js`): o tremor e o enfraquecer ao desmaiar são os de
 * verdade.
 *
 * Raiz R3F própria, fora do Canvas/GameLoop do jogo: o `useFrame` daqui não
 * é o do loop do jogo (mesma exceção de `app/tools/teste-animations`).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { listSpecies } from '@/core/data/species'
import { lightingAt } from '@/core/time/dayCycle'
import {
  applyFireLight,
  resolveFireLight,
} from '@/view/systems/fireLightSystem'
import { useSpeciesModel } from '../animationLab/useSpeciesModel'
import { resolveCapsuleCenterHeight } from '../bodyLab/bodyLabMath'
import { Slider } from '../shared/Slider'
import { formatFireLightSnippet } from './fireLightLabMath'

const SPECIES = listSpecies().filter((species) => species.model?.path)
const FIRST_WITH_LIGHT =
  SPECIES.find((species) => species.vfx?.fireLight) ?? SPECIES[0]
const DEG_TO_RAD = Math.PI / 180
const HOURS_PER_DAY = 24
// chão parecido com a grama do jogo, só pra ver a poça de luz
const GROUND_COLOR = '#6f9a4c'
const GROUND_SIZE = 12
// distância do sol/lua até o centro (só a direção importa)
const SUN_DISTANCE = 10
const AXES = ['x', 'y', 'z']
const FLICKER_FIELDS = [
  { field: 'speed', label: 'tremor: rapidez', max: 60, step: 0.5 },
  { field: 'amount', label: 'tremor: seno', max: 1, step: 0.01 },
  { field: 'noise', label: 'tremor: ruído', max: 1, step: 0.01 },
]

function initialConfig(species) {
  return resolveFireLight(species.vfx?.fireLight ?? {})
}

/** A luz do dia na hora escolhida, igual à do jogo (sem o clima). */
function DayLight({ hour }) {
  const ambientRef = useRef()
  const sunRef = useRef()
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const look = lightingAt(hour / HOURS_PER_DAY)
    ambientRef.current.color.setRGB(...look.ambient)
    ambientRef.current.intensity = look.ambientIntensity
    sunRef.current.color.setRGB(...look.light)
    sunRef.current.intensity = look.lightIntensity
    const { x, y, z } = look.lightDirection
    sunRef.current.position.set(x, y, z).multiplyScalar(SUN_DISTANCE)
    scene.background = new THREE.Color().setRGB(...look.horizon)
  }, [hour, scene])

  return (
    <>
      <ambientLight ref={ambientRef} />
      <directionalLight ref={sunRef} />
    </>
  )
}

/**
 * O modelo, com a luz de fogo presa no osso `config.bone`. `onBones` recebe
 * os nomes dos ossos do rig (pra lista de escolha).
 */
function LitModel({
  species,
  animation,
  timeScale,
  config,
  fainted,
  showHelper,
  onBones,
}) {
  const { cloned, mixer, bonesRef } = useSpeciesModel(species, animation)
  const entryRef = useRef(null)
  const helperRef = useRef()
  const bone = bonesRef.current[config.bone]?.bone

  useEffect(() => {
    onBones(Object.keys(bonesRef.current).sort())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned])

  useEffect(() => {
    if (!bone) return
    const light = new THREE.PointLight()
    bone.add(light)
    entryRef.current = { light, bone, config, fade: 1, elapsed: 0 }
    return () => {
      bone.remove(light)
      light.dispose()
      entryRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bone])

  useEffect(() => {
    const entry = entryRef.current
    if (!entry) return
    entry.config = config
    entry.light.color.set(config.color)
    entry.light.distance = config.distance
    entry.light.decay = config.decay
  }, [config, bone])

  useFrame((_, delta) => {
    mixer.timeScale = timeScale
    mixer.update(delta)
    const entry = entryRef.current
    if (!entry) return
    applyFireLight(entry, fainted, delta)
    const helper = helperRef.current
    if (helper?.parent) {
      entry.light.getWorldPosition(helper.position)
      helper.parent.worldToLocal(helper.position)
    }
  })

  return (
    <>
      <primitive object={cloned} scale={species.model.scale ?? 1} />
      {showHelper && bone && (
        // fora do osso: filho dele herdaria a escala do rig
        <mesh ref={helperRef}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshBasicMaterial color={config.color} depthTest={false} />
        </mesh>
      )}
    </>
  )
}

export function FireLightLab() {
  const [speciesId, setSpeciesId] = useState(FIRST_WITH_LIGHT?.id)
  const species = SPECIES.find((candidate) => candidate.id === speciesId)
  const [config, setConfig] = useState(() => initialConfig(species))
  const [boneNames, setBoneNames] = useState([])
  const [animation, setAnimation] = useState('idle')
  const [timeScale, setTimeScale] = useState(1)
  const [yaw, setYaw] = useState(0)
  const [hour, setHour] = useState(20)
  const [fainted, setFainted] = useState(false)
  const [showHelper, setShowHelper] = useState(true)
  const [copied, setCopied] = useState(false)

  const centerHeight = resolveCapsuleCenterHeight(species.body)
  const modelOffset = species.body.modelOffset ?? [0, 0, 0]
  const animationNames = useMemo(
    () => Object.keys(species.nativeAnimations ?? {}).sort(),
    [species],
  )

  const chooseSpecies = (id) => {
    const next = SPECIES.find((candidate) => candidate.id === id)
    setSpeciesId(id)
    setConfig(initialConfig(next))
    setBoneNames([])
  }
  const setField = (field, value) =>
    setConfig((current) => ({ ...current, [field]: value }))
  const setPosition = (axis, value) =>
    setConfig((current) => ({
      ...current,
      position: { ...current.position, [axis]: value },
    }))
  const setFlicker = (field, value) =>
    setConfig((current) => ({
      ...current,
      flicker: { ...current.flicker, [field]: value },
    }))
  const copy = async () => {
    await navigator.clipboard.writeText(formatFireLightSnippet(config))
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
          <DayLight hour={hour} />
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
            <meshStandardMaterial color={GROUND_COLOR} />
          </mesh>
          <OrbitControls makeDefault />
          <Suspense fallback={null}>
            <Bounds key={species.id} fit clip margin={1.8}>
              <group rotation-y={yaw * DEG_TO_RAD}>
                <group position={[0, centerHeight, 0]}>
                  <group position={modelOffset}>
                    <LitModel
                      species={species}
                      animation={glbAnimation}
                      timeScale={timeScale}
                      config={config}
                      fainted={fainted}
                      showHelper={showHelper}
                      onBones={setBoneNames}
                    />
                  </group>
                </group>
              </group>
            </Bounds>
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute right-0 top-0 h-full w-[30rem] max-w-full space-y-3 overflow-y-auto bg-black/75 p-4">
        <h1 className="text-base font-bold">Laboratório de luz de fogo</h1>

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
                {candidate.vfx?.fireLight ? ' (tem luz)' : ''}
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
        <Slider
          label="hora do dia"
          value={hour}
          min={0}
          max={24}
          step={0.25}
          onChange={setHour}
          unit="h"
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fainted}
            onChange={(event) => setFainted(event.target.checked)}
          />
          desmaiado (a luz enfraquece)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showHelper}
            onChange={(event) => setShowHelper(event.target.checked)}
          />
          mostrar o ponto da luz
        </label>

        <h2 className="pt-2 font-bold">Luz de fogo (vfx.fireLight)</h2>
        <label className="flex items-center gap-2">
          <span className="w-32 text-white/70">osso</span>
          <select
            value={config.bone ?? ''}
            onChange={(event) => setField('bone', event.target.value)}
            className="flex-1 rounded bg-white/10"
          >
            <option value="" className="text-black">
              (nenhum — sem luz)
            </option>
            {boneNames.map((name) => (
              <option key={name} value={name} className="text-black">
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="w-32 text-white/70">cor</span>
          <input
            type="color"
            value={config.color}
            onChange={(event) => setField('color', event.target.value)}
          />
          <span className="text-white/50">{config.color}</span>
        </label>
        <Slider
          label="brilho"
          value={config.intensity}
          min={0}
          max={20}
          step={0.1}
          onChange={(value) => setField('intensity', value)}
        />
        <Slider
          label="alcance"
          value={config.distance}
          min={0}
          max={15}
          step={0.1}
          onChange={(value) => setField('distance', value)}
          unit="m"
        />
        <Slider
          label="queda"
          value={config.decay}
          min={0}
          max={4}
          step={0.05}
          onChange={(value) => setField('decay', value)}
        />
        <Slider
          label="brilho desmaiado"
          value={config.faintedIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => setField('faintedIntensity', value)}
          unit="×"
        />
        {AXES.map((axis) => (
          <Slider
            key={axis}
            label={`deslocamento ${axis}`}
            value={config.position[axis]}
            min={-0.5}
            max={0.5}
            step={0.005}
            onChange={(value) => setPosition(axis, value)}
            unit="m"
          />
        ))}
        {FLICKER_FIELDS.map(({ field, label, max, step }) => (
          <Slider
            key={field}
            label={label}
            value={config.flicker[field]}
            min={0}
            max={max}
            step={step}
            onChange={(value) => setFlicker(field, value)}
          />
        ))}
        <p className="text-white/50">
          O deslocamento é nos eixos do osso, a partir dele. Alcance 0 é sem
          limite; a queda diz o quanto a luz enfraquece com a distância.
        </p>

        <div className="flex gap-2 pt-2">
          <button
            onClick={copy}
            disabled={!config.bone}
            className="rounded bg-white/20 px-3 py-1"
          >
            {copied ? 'copiado!' : 'Copiar fireLight'}
          </button>
          <button
            onClick={() => chooseSpecies(speciesId)}
            className="rounded bg-white/20 px-3 py-1"
          >
            Restaurar do arquivo
          </button>
        </div>
        <p className="text-white/50">
          As mudanças não são salvas: copie e cole dentro de vfx no index.js da
          espécie, ou me mande.
        </p>
      </div>
    </div>
  )
}
