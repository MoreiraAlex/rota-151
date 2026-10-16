'use client'

import { useState } from 'react'
import {
  AXES,
  PROPERTIES,
  TERM_TYPES,
  addTerm,
  addTrack,
  listTracks,
  peakOf,
  removeTerm,
  removeTrack,
  setTermField,
  setTermType,
  termFields,
} from './cryClipEdit'

const RAD_TO_DEG = 180 / Math.PI

const FIELD_LABELS = {
  value: 'valor',
  amplitude: 'amplitude',
  frequencyScale: 'frequência (×)',
  phaseTurns: 'fase (voltas)',
  min: 'mínimo',
  max: 'máximo',
}

// Faixa do slider de cada campo. Os de tamanho (valor, amplitude, mínimo,
// máximo) dependem da propriedade: rotação em radianos, posição em metros,
// escala como fator somado ao de descanso.
const SIZE_RANGE = {
  rotation: { min: -1, max: 1, step: 0.001 },
  position: { min: -0.2, max: 0.2, step: 0.001 },
  scale: { min: -0.5, max: 0.5, step: 0.001 },
}
const FIELD_RANGE = {
  frequencyScale: { min: 0, max: 10, step: 0.05 },
  phaseTurns: { min: 0, max: 1, step: 0.01 },
}

const TYPE_LABELS = {
  constant: 'constante',
  sine: 'seno',
  clampedSine: 'seno limitado',
  absSine: 'seno absoluto',
}

/** Desvio máximo da trilha, na unidade de quem olha (graus, cm ou fator). */
function formatPeak(property, curve) {
  const peak = peakOf(curve)
  if (property === 'rotation') return `${(peak * RAD_TO_DEG).toFixed(1)}°`
  if (property === 'position') return `${(peak * 100).toFixed(1)} cm`
  return `×${peak.toFixed(3)}`
}

function NumberField({ label, value, range, onChange }) {
  return (
    <label className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2">
      <span className="text-white/70">{label}</span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded bg-white/10 px-1 text-right"
      />
    </label>
  )
}

function TrackEditor({ clip, track, onChange }) {
  const terms = track.curve.type === 'sum' ? track.curve.curves : [track.curve]
  const [newType, setNewType] = useState('sine')

  return (
    <div className="space-y-2 rounded border border-white/15 p-2">
      <div className="flex items-center justify-between">
        <strong>
          {track.bone} · {track.property}.{track.axis}
        </strong>
        <span className="text-white/70">
          pico ≈ {formatPeak(track.property, track.curve)}
        </span>
        <button
          onClick={() => onChange(removeTrack(clip, track))}
          className="rounded bg-red-500/40 px-2"
        >
          tirar
        </button>
      </div>

      {terms.map((term, index) => (
        <div key={index} className="space-y-1 rounded bg-white/5 p-2">
          <div className="flex items-center gap-2">
            <select
              value={term.type}
              onChange={(event) =>
                onChange(setTermType(clip, track, index, event.target.value))
              }
              className="rounded bg-white/10"
            >
              {TERM_TYPES.map((type) => (
                <option key={type} value={type} className="text-black">
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <button
              onClick={() => onChange(removeTerm(clip, track, index))}
              className="ml-auto rounded bg-white/10 px-2"
            >
              tirar termo
            </button>
          </div>
          {termFields(term).map((field) => (
            <NumberField
              key={field}
              label={FIELD_LABELS[field] ?? field}
              value={term[field] ?? 0}
              range={FIELD_RANGE[field] ?? SIZE_RANGE[track.property]}
              onChange={(value) =>
                onChange(setTermField(clip, track, index, field, value))
              }
            />
          ))}
        </div>
      ))}

      <div className="flex gap-2">
        <select
          value={newType}
          onChange={(event) => setNewType(event.target.value)}
          className="rounded bg-white/10"
        >
          {TERM_TYPES.map((type) => (
            <option key={type} value={type} className="text-black">
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <button
          onClick={() => onChange(addTerm(clip, track, newType))}
          className="rounded bg-white/20 px-2"
        >
          + termo
        </button>
      </div>
    </div>
  )
}

/**
 * Editor do clipe do grito: uma trilha por osso/propriedade/eixo, cada uma
 * com os termos da curva (constante, senos). Mostra o desvio máximo de cada
 * trilha pra conferir o efeito do ajuste na tela.
 */
export function CryClipEditor({ clip, boneNames, onChange }) {
  const [bone, setBone] = useState('')
  // osso escolhido pra trilha nova: o que o usuário pegou, senão a cabeça
  const selectedBone = boneNames.includes(bone)
    ? bone
    : (boneNames.find((name) => name === 'head') ?? boneNames[0] ?? '')
  const [property, setProperty] = useState('rotation')
  const [axis, setAxis] = useState('x')
  const tracks = listTracks(clip)
  const speed = clip.speed ?? 1

  return (
    <div className="space-y-3">
      <NumberField
        label="ciclos por s"
        value={speed}
        range={{ min: 0.1, max: 6, step: 0.05 }}
        onChange={(value) => onChange({ ...clip, speed: value })}
      />

      {tracks.map((track) => (
        <TrackEditor
          key={`${track.bone}.${track.property}.${track.axis}`}
          clip={clip}
          track={track}
          onChange={onChange}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedBone}
          onChange={(event) => setBone(event.target.value)}
          className="max-w-[12rem] rounded bg-white/10"
        >
          {boneNames.map((name) => (
            <option key={name} value={name} className="text-black">
              {name}
            </option>
          ))}
        </select>
        <select
          value={property}
          onChange={(event) => setProperty(event.target.value)}
          className="rounded bg-white/10"
        >
          {PROPERTIES.map((name) => (
            <option key={name} value={name} className="text-black">
              {name}
            </option>
          ))}
        </select>
        <select
          value={axis}
          onChange={(event) => setAxis(event.target.value)}
          className="rounded bg-white/10"
        >
          {AXES.map((name) => (
            <option key={name} value={name} className="text-black">
              {name}
            </option>
          ))}
        </select>
        <button
          disabled={!selectedBone}
          onClick={() =>
            onChange(addTrack(clip, { bone: selectedBone, property, axis }))
          }
          className="rounded bg-white/20 px-2"
        >
          + trilha
        </button>
      </div>
    </div>
  )
}
