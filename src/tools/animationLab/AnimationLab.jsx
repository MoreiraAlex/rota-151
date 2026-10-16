'use client'

/**
 * Laboratório de animação — NÃO faz parte do jogo (página
 * `/tools/lab-animacao`). Escolhe uma espécie e uma animação do `.glb` dela,
 * que fica rodando em loop, e mostra o grito (`species.clips.cry`) por cima,
 * do mesmo jeito que o jogo toca (`mouthSyncSystem.js`: o clipe procedural
 * escreve só nos ossos dele, depois do mixer). O clipe do grito é editável ao
 * vivo (`CryClipEditor.jsx`); o resultado sai por "Copiar JSON" pra colar em
 * `species/<NNN>-<id>/clips/cry.json`.
 *
 * Raiz R3F própria, fora do Canvas/GameLoop do jogo: o `useFrame` daqui não
 * é o do loop do jogo (mesma exceção de `app/tools/teste-animations`).
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import { listSpecies } from '@/core/data/species'
import {
  applyAnimationClip,
  capturePose,
  resolveClipSpeed,
  restorePose,
} from '@/core/animation/applyAnimationClip'
import { useSpeciesModel } from './useSpeciesModel'
import { CryClipEditor } from './CryClipEditor'
import { gameKeysByAnimation } from './nativeAnimationKeys'

const SPECIES = listSpecies().filter((species) => species.model?.path)
const REST_POSE = ''
const EMPTY_CRY = { name: 'creature-cry', bones: {} }

const CRY_MODES = {
  off: 'desligado',
  loop: 'em loop',
  sound: 'com o som',
}

/** Pasta da espécie em `core/data/species/` (`013-weedle`; `boy` sem número). */
function speciesFolder(species) {
  if (!species.dexNumber) return species.id
  return `${String(species.dexNumber).padStart(3, '0')}-${species.id}`
}

function initialCry(species) {
  return structuredClone(species.clips?.cry ?? EMPTY_CRY)
}

function LabModel({
  species,
  animation,
  timeScale,
  cryClip,
  cry,
  onBones,
  onAnimations,
}) {
  const { cloned, animations, mixer, bonesRef } = useSpeciesModel(
    species,
    animation,
  )
  const cryClipRef = useRef(cryClip)
  cryClipRef.current = cryClip

  useEffect(() => {
    onBones(Object.keys(bonesRef.current))
  }, [cloned, bonesRef, onBones])

  useEffect(() => {
    onAnimations(animations.map((clip) => clip.name).sort())
  }, [animations, onAnimations])

  useFrame((_, delta) => {
    mixer.timeScale = timeScale
    mixer.update(delta)

    const state = cry.current
    const playing =
      state.mode === 'loop' ||
      (state.mode === 'sound' && !!state.audio && !state.audio.paused)
    const clip = cryClipRef.current
    const bones = {}
    for (const name of Object.keys(clip.bones ?? {})) {
      if (bonesRef.current[name]) bones[name] = bonesRef.current[name]
    }

    if (!playing) {
      // grito acabou: os ossos dele voltam pra pose da animação de base de
      // quando ele começou (como no jogo, `mouthSyncSystem.js`)
      if (state.wasPlaying && state.basePose) restorePose(state.basePose, bones)
      state.basePose = null
      state.wasPlaying = false
      return
    }
    if (!state.wasPlaying) {
      state.elapsed = 0
      state.basePose = capturePose(bones)
    }
    state.wasPlaying = true
    state.elapsed += delta
    applyAnimationClip(clip, bones, state.elapsed, resolveClipSpeed(clip))
  })

  return <primitive object={cloned} scale={species.model.scale ?? 1} />
}

/** Toca o grito da espécie em loop, com uma pausa entre uma vez e outra. */
function useCrySound(cry, species, clipIndex, pause) {
  const mode = cry.current.mode
  useEffect(() => {
    // o objeto do ref não muda (só os campos dele): lido uma vez, vale na limpeza
    const state = cry.current
    if (state.mode !== 'sound') return
    const path = species.sounds?.voice?.clips?.[clipIndex]
    if (!path) return
    const audio = new Audio(path)
    audio.volume = Math.min(species.sounds.voice.volume ?? 1, 1)
    let timer = null
    const replay = () => {
      timer = setTimeout(() => audio.play(), pause * 1000)
    }
    audio.addEventListener('ended', replay)
    audio.play()
    state.audio = audio
    return () => {
      clearTimeout(timer)
      audio.removeEventListener('ended', replay)
      audio.pause()
      state.audio = null
    }
  }, [cry, species, clipIndex, pause, mode])
}

export function AnimationLab() {
  const [speciesId, setSpeciesId] = useState(SPECIES[0]?.id)
  const species = SPECIES.find((candidate) => candidate.id === speciesId)
  const [animation, setAnimation] = useState('idle')
  const [timeScale, setTimeScale] = useState(1)
  const [cryClip, setCryClip] = useState(() => initialCry(species))
  const [cryMode, setCryMode] = useState('off')
  const [clipIndex, setClipIndex] = useState(0)
  const [pause, setPause] = useState(1)
  const [boneNames, setBoneNames] = useState([])
  const [animationNames, setAnimationNames] = useState([])
  const [copied, setCopied] = useState(false)
  const cry = useRef({
    mode: 'off',
    audio: null,
    elapsed: 0,
    wasPlaying: false,
  })
  cry.current.mode = cryMode

  const keys = gameKeysByAnimation(species.nativeAnimations)
  const voiceClips = species.sounds?.voice?.clips ?? []

  useCrySound(cry, species, clipIndex, pause)

  const chooseSpecies = (id) => {
    const next = SPECIES.find((candidate) => candidate.id === id)
    setSpeciesId(id)
    setCryClip(initialCry(next))
    setClipIndex(0)
  }

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(cryClip, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative h-screen w-screen bg-neutral-900 text-sm text-white">
      <div className="absolute inset-y-0 left-0 right-0 md:right-[30rem]">
        <Canvas camera={{ position: [1.5, 1, 2.5], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} />
          <gridHelper args={[4, 40, '#666', '#333']} />
          <OrbitControls makeDefault />
          <Suspense fallback={null}>
            <Bounds key={species.id} fit clip margin={1.6}>
              <LabModel
                species={species}
                animation={animation}
                timeScale={timeScale}
                cryClip={cryClip}
                cry={cry}
                onBones={setBoneNames}
                onAnimations={setAnimationNames}
              />
            </Bounds>
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute right-0 top-0 h-full w-[30rem] max-w-full space-y-3 overflow-y-auto bg-black/75 p-4">
        <h1 className="text-base font-bold">Laboratório de animação</h1>

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
            <option value={REST_POSE} className="text-black">
              (pose de descanso)
            </option>
            {animationNames.map((name) => (
              <option key={name} value={name} className="text-black">
                {name}
                {keys[name] ? ` — ${keys[name].join(', ')}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
          <span className="text-white/70">velocidade</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={timeScale}
            onChange={(event) => setTimeScale(Number(event.target.value))}
          />
          <span>{timeScale.toFixed(2)}×</span>
        </label>

        <h2 className="pt-2 font-bold">Grito (cry)</h2>
        <div className="flex gap-2">
          {Object.entries(CRY_MODES).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setCryMode(mode)}
              className={`rounded px-2 py-1 ${
                mode === cryMode ? 'bg-white text-black' : 'bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {cryMode === 'sound' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <span className="w-24 text-white/70">som</span>
              <select
                value={clipIndex}
                onChange={(event) => setClipIndex(Number(event.target.value))}
                className="flex-1 rounded bg-white/10"
              >
                {voiceClips.map((path, index) => (
                  <option key={path} value={index} className="text-black">
                    {path.split('/').pop()}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
              <span className="text-white/70">pausa (s)</span>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={pause}
                onChange={(event) => setPause(Number(event.target.value))}
              />
              <span>{pause.toFixed(1)}</span>
            </label>
          </div>
        )}

        <CryClipEditor
          clip={cryClip}
          boneNames={boneNames}
          onChange={setCryClip}
        />

        <div className="flex gap-2 pt-2">
          <button onClick={copyJson} className="rounded bg-white/20 px-3 py-1">
            {copied ? 'copiado!' : 'Copiar JSON'}
          </button>
          <button
            onClick={() => setCryClip(initialCry(species))}
            className="rounded bg-white/20 px-3 py-1"
          >
            Restaurar do arquivo
          </button>
        </div>
        <p className="text-white/50">
          As mudanças não são salvas: copie o JSON e cole em species/
          {speciesFolder(species)}/clips/cry.json (ou me mande).
        </p>
      </div>
    </div>
  )
}
