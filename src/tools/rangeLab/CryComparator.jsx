'use client'

/**
 * Comparador de gritos do laboratório de alcance (docs/features/062-spawn-
 * estilo-cobblemon.md): dois Pokémon gritam alternados no mesmo ponto
 * (distância e ângulo do lab), cada um com um volume ajustável, para igualar
 * de ouvido. O som passa pelo mesmo caminho da voz no jogo
 * (`createPositionalAudio` com o alcance da voz da espécie), só sem a
 * selvagem: o volume é o do comparador, não o do config.
 *
 * `compareRef.current`: `{ mode, gap, a, b, volumes }` — `mode` como em
 * `stepComparator`, `a`/`b` as espécies, `volumes` os volumes mexidos
 * (por espécie; quem não está lá usa o do config).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { resolveVoiceSound } from '@/core/data/audio/voiceSound'
import { getSpecies } from '@/core/data/species'
import { loadAudioBuffer } from '@/view/audio/audioBufferCache'
import { getAudioListener } from '@/view/audio/audioListener'
import {
  applySpatialAudio,
  createPositionalAudio,
} from '@/view/audio/spatialAudio'
import {
  createComparatorRun,
  createPlayWatcher,
  pointAround,
  stepComparator,
} from './rangeLabData'
import {
  resolveVoiceRange,
  resolveVoiceVolume,
  standingHeight,
} from './rangeLabWorld'

/** O volume do lado no comparador: o mexido ou o do config. */
export function comparatorVolume(species, volumes) {
  return volumes[species.id] ?? resolveVoiceVolume(species)
}

function createSlot(listener, species) {
  return {
    audio: createPositionalAudio(listener, {
      volume: resolveVoiceVolume(species),
      ...resolveVoiceRange(species),
    }),
    clip: 0,
  }
}

export function CryComparator({ compareRef, labRef, liveRef, onLog }) {
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const slots = useMemo(() => {
    const listener = getAudioListener()
    const { a, b } = compareRef.current
    return {
      a: createSlot(listener, getSpecies(a)),
      b: createSlot(listener, getSpecies(b)),
    }
  }, [compareRef])
  const buffers = useRef(new Map())
  const requested = useRef(new Set())
  const run = useRef(createComparatorRun())
  const current = useRef(null)
  const watcher = useMemo(
    () => createPlayWatcher({ maxDistance: Infinity, threshold: Infinity }),
    [],
  )

  useEffect(() => {
    for (const slot of Object.values(slots)) scene.add(slot.audio)
    return () => {
      for (const slot of Object.values(slots)) {
        if (slot.audio.isPlaying) slot.audio.stop()
        scene.remove(slot.audio)
        slot.audio.gain.disconnect()
      }
    }
  }, [scene, slots])

  const clipsOf = (species) => resolveVoiceSound(species)?.clips ?? []

  const load = (species) => {
    for (const path of clipsOf(species)) {
      if (requested.current.has(path)) continue
      requested.current.add(path)
      loadAudioBuffer(path).then((buffer) => {
        if (buffer) buffers.current.set(path, buffer)
      })
    }
  }

  // Toca o lado `name`; devolve se tocou (o som pode não ter carregado).
  const play = (name, settings) => {
    const species = getSpecies(settings[name])
    const loaded = clipsOf(species)
      .map((path) => buffers.current.get(path))
      .filter(Boolean)
    if (!loaded.length) return false
    const slot = slots[name]
    const { audio } = slot
    const buffer = loaded[slot.clip % loaded.length]
    slot.clip += 1

    const volume = comparatorVolume(species, settings.volumes)
    applySpatialAudio(audio, resolveVoiceRange(species))
    const now = audio.context.currentTime
    audio.gain.gain.cancelScheduledValues(now)
    audio.gain.gain.setValueAtTime(volume, now)

    const { distance, angle } = labRef.current
    const { x, z } = pointAround(distance, angle)
    audio.position.set(x, standingHeight(species), z)
    audio.updateMatrixWorld(true)
    audio.setBuffer(buffer)
    audio.play()
    current.current = {
      slot: name,
      speciesId: species.id,
      volume,
      distance: audio
        .getWorldPosition(audio.position.clone())
        .distanceTo(camera.position),
    }
    return true
  }

  useFrame((_, delta) => {
    const settings = compareRef.current
    load(getSpecies(settings.a))
    load(getSpecies(settings.b))

    const audios = Object.values(slots).map((slot) => slot.audio)
    if (settings.mode === 'off') {
      for (const audio of audios) if (audio.isPlaying) audio.stop()
    }
    const playing = audios.some((audio) => audio.isPlaying)

    const step = stepComparator(run.current, settings, playing, delta)
    if (!step.play || play(step.play, settings)) run.current = step.run

    const { peak, left, right } = liveRef.current
    const done = watcher.update({
      playing,
      distance: current.current?.distance ?? 0,
      peak,
      left,
      right,
    })
    if (done && current.current) {
      onLog({ kind: 'compare', ...done, ...current.current })
    }
  })

  return null
}
