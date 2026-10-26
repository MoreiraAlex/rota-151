import { useEffect, useState } from 'react'
import { Slider } from '../shared/Slider'
import {
  hasPath,
  mergeLayers,
  overrideKeyOf,
  readPath,
  resolveOrigin,
} from './skillLabData'
import {
  EFFECT_FIELDS,
  createEffect,
  listTypeIds,
  resolveEffectField,
  writeEffectField,
} from './skillLabFields'

/**
 * Painel dos campos do golpe no laboratório de golpes. Mostra o valor que o
 * jogo vê (base + espécie) e de onde ele vem; a edição vai pra camada
 * escolhida (`layer`). `onEdit(path, value)` / `onClear(path)`.
 */

const NULL_OPTION = '__null'
const DEFAULT_OPTION = ''
const AXES = ['x', 'y', 'z']

const ORIGIN_STYLE = {
  species: {
    mark: 'E',
    className: 'bg-emerald-600',
    title: 'override da espécie',
  },
  base: { mark: 'B', className: 'bg-sky-700', title: 'base do golpe' },
  default: { mark: '·', className: 'bg-white/10', title: 'padrão (ausente)' },
}

function OriginMark({ origin }) {
  const style = ORIGIN_STYLE[origin]
  return (
    <span
      title={style.title}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] ${style.className}`}
    >
      {style.mark}
    </span>
  )
}

function ClearButton({ visible, onClick }) {
  return (
    <button
      onClick={onClick}
      title="tirar desta camada"
      className={`w-4 shrink-0 text-white/50 hover:text-white ${visible ? '' : 'invisible'}`}
    >
      ×
    </button>
  )
}

function SelectControl({ field, value, onChange }) {
  const selected =
    value === null ? NULL_OPTION : value === undefined ? DEFAULT_OPTION : value
  return (
    <select
      value={selected}
      onChange={(event) => {
        const next = event.target.value
        if (next === NULL_OPTION) onChange(null)
        else if (next !== DEFAULT_OPTION) onChange(next)
      }}
      className="flex-1 rounded bg-white/10"
    >
      {(field.optional || value === undefined) && (
        <option value={DEFAULT_OPTION} className="text-black">
          (padrão)
        </option>
      )}
      {field.nullable && (
        <option value={NULL_OPTION} className="text-black">
          (nenhum)
        </option>
      )}
      {field.options.map((option) => (
        <option key={option.value} value={option.value} className="text-black">
          {option.label}
        </option>
      ))}
    </select>
  )
}

function TypesControl({ value, onChange }) {
  const selected = value ?? []
  return (
    <div className="flex flex-1 flex-wrap gap-x-2">
      {listTypeIds().map((type) => (
        <label key={type} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={selected.includes(type)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, type]
                  : selected.filter((item) => item !== type),
              )
            }
          />
          {type}
        </label>
      ))}
    </div>
  )
}

function EffectsControl({ value, onChange }) {
  const effects = value ?? []
  const update = (index, effect) =>
    onChange(effects.map((item, i) => (i === index ? effect : item)))

  return (
    <div className="flex-1 space-y-2">
      {effects.map((effect, index) => (
        <div key={index} className="space-y-1 rounded bg-white/5 p-2">
          <div className="flex items-center gap-2">
            <select
              value={effect.type}
              onChange={(event) =>
                update(index, createEffect(event.target.value))
              }
              className="flex-1 rounded bg-white/10"
            >
              {Object.keys(EFFECT_FIELDS).map((type) => (
                <option key={type} value={type} className="text-black">
                  {type}
                </option>
              ))}
            </select>
            <button
              onClick={() => onChange(effects.filter((_, i) => i !== index))}
              className="text-white/50 hover:text-white"
            >
              remover
            </button>
          </div>
          {(EFFECT_FIELDS[effect.type] ?? []).map((field) => {
            const set = (next) =>
              update(index, writeEffectField(effect, field.key, next))
            const current = resolveEffectField(effect, field.key)
            if (field.kind === 'select') {
              return (
                <label key={field.key} className="flex items-center gap-2">
                  <span className="w-32 text-white/70">{field.key}</span>
                  <SelectControl field={field} value={current} onChange={set} />
                </label>
              )
            }
            if (field.kind === 'types') {
              return (
                <div key={field.key} className="flex gap-2">
                  <span className="w-32 shrink-0 text-white/70">
                    {field.key}
                  </span>
                  <TypesControl value={current ?? []} onChange={set} />
                </div>
              )
            }
            return (
              <Slider
                key={field.key}
                label={field.key}
                value={current ?? field.min}
                min={field.min}
                max={field.max}
                step={field.step}
                unit={field.unit}
                onChange={set}
              />
            )
          })}
        </div>
      ))}
      <button
        onClick={() => onChange([...effects, createEffect('statStage')])}
        className="rounded bg-white/20 px-2"
      >
        + efeito
      </button>
    </div>
  )
}

function FieldControl({ field, value, onChange }) {
  switch (field.kind) {
    case 'select':
      return <SelectControl field={field} value={value} onChange={onChange} />
    case 'bool':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange(event.target.checked)}
        />
      )
    case 'section':
      return (
        <input
          type="checkbox"
          checked={value != null}
          onChange={(event) =>
            onChange(event.target.checked ? { ...field.empty } : null)
          }
        />
      )
    case 'list':
      return (
        <textarea
          rows={Math.max(2, (value ?? []).length)}
          value={(value ?? []).join('\n')}
          onChange={(event) =>
            onChange(
              event.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
          className="flex-1 rounded bg-white/10 px-1 font-mono text-xs"
        />
      )
    case 'numbers':
      return <NumbersControl value={value} onChange={onChange} />
    case 'tiers':
      return <TiersControl field={field} value={value} onChange={onChange} />
    case 'types':
      return <TypesControl value={value} onChange={onChange} />
    case 'effects':
      return <EffectsControl value={value} onChange={onChange} />
    default:
      return null
  }
}

// Lista de números numa linha ("2, 3, 4, 5"); o texto fica livre enquanto
// digita e o valor só muda quando a linha inteira é número.
function NumbersControl({ value, onChange }) {
  const format = (list) => (list ?? []).join(', ')
  const parse = (line) =>
    line
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number)
  const [text, setText] = useState(format(value))
  // o valor mudou por fora (outro golpe, restaurar): o texto acompanha
  useEffect(() => {
    if (format(parse(text)) !== format(value)) setText(format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        const parts = parse(event.target.value)
        if (parts.length && parts.every(Number.isFinite)) onChange(parts)
      }}
      className="flex-1 rounded bg-white/10 px-1 font-mono text-xs"
    />
  )
}

// Degraus: uma linha por degrau, os campos de `field.keys` separados por
// espaço ("2 80" → `{ ratio: 2, power: 80 }`).
function TiersControl({ field, value, onChange }) {
  const keys = field.keys
  const format = (tiers) =>
    (tiers ?? [])
      .map((tier) => keys.map((key) => tier[key]).join(' '))
      .join('\n')
  const parse = (block) =>
    block
      .split('\n')
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter((parts) => parts.length === keys.length)
      .map((parts) => Object.fromEntries(keys.map((key, i) => [key, parts[i]])))
  const [text, setText] = useState(format(value))
  // o valor mudou por fora (outro golpe, restaurar): o texto acompanha
  useEffect(() => {
    if (format(parse(text)) !== format(value)) setText(format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-xs text-white/50">{keys.join(' · ')}</span>
      <textarea
        rows={Math.max(2, (value ?? []).length)}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          const tiers = parse(event.target.value)
          const valid = tiers.every((tier) =>
            keys.every((key) => Number.isFinite(tier[key])),
          )
          if (tiers.length && valid) onChange(tiers)
        }}
        className="rounded bg-white/10 px-1 font-mono text-xs"
      />
    </div>
  )
}

// Campo ausente: o controle fica apagado no mínimo, até alguém mexer.
const absentLabel = (field, value) =>
  value === undefined ? `${field.label} (padrão)` : field.label
const absentClass = (value) => (value === undefined ? 'opacity-50' : '')

function NumberField({ field, value, onChange }) {
  return (
    <div className={`flex-1 ${absentClass(value)}`}>
      <Slider
        label={absentLabel(field, value)}
        value={value ?? field.min}
        min={field.min}
        max={field.max}
        step={field.step}
        unit={field.unit}
        onChange={onChange}
      />
      {field.nullable && (
        <label className="ml-[8.5rem] flex items-center gap-1 text-xs text-white/60">
          <input
            type="checkbox"
            checked={value === null}
            onChange={(event) =>
              onChange(event.target.checked ? null : field.max)
            }
          />
          nunca erra (null)
        </label>
      )}
    </div>
  )
}

function Vec3Field({ field, value, onChange }) {
  const vector = value ?? { x: 0, y: 0, z: 0 }
  return (
    <div className={`flex-1 ${absentClass(value)}`}>
      {AXES.map((axis) => (
        <Slider
          key={axis}
          label={`${absentLabel(field, value)} ${axis}`}
          value={vector[axis] ?? 0}
          min={field.min}
          max={field.max}
          step={field.step}
          unit={field.unit}
          onChange={(next) => onChange({ ...vector, [axis]: next })}
        />
      ))}
    </div>
  )
}

function FieldRow({ field, layers, layer, onEdit, onClear }) {
  const merged = mergeLayers(layers.base, layers.overrides)
  const value = readPath(merged, field.path)
  const origin = resolveOrigin(layers.base, layers.overrides, field.path)
  const inLayer =
    layer === 'species'
      ? hasPath(layers.overrides, overrideKeyOf(field.path))
      : hasPath(layers.base, field.path)
  const edit = (next) => onEdit(field.path, next)

  const inline = field.kind === 'number' || field.kind === 'vec3'
  return (
    <div className="flex items-start gap-2" title={field.path}>
      <OriginMark origin={origin} />
      {field.kind === 'number' && (
        <NumberField field={field} value={value} onChange={edit} />
      )}
      {field.kind === 'vec3' && (
        <Vec3Field field={field} value={value} onChange={edit} />
      )}
      {!inline && (
        <>
          <span className="w-[7.5rem] shrink-0 text-white/70">
            {field.label}
          </span>
          <FieldControl field={field} value={value} onChange={edit} />
        </>
      )}
      <ClearButton visible={inLayer} onClick={() => onClear(field.path)} />
    </div>
  )
}

// Campos de `damage.*` só aparecem com o golpe tendo dano.
function isHidden(field, merged) {
  return field.path.startsWith('damage.') && merged.damage == null
}

export function SkillParamsPanel({ sections, layers, layer, onEdit, onClear }) {
  const merged = mergeLayers(layers.base, layers.overrides)
  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <section key={section.title} className="space-y-1">
          <h3 className="font-bold text-white/90">{section.title}</h3>
          {section.fields
            .filter((field) => !isHidden(field, merged))
            .map((field) => (
              <FieldRow
                key={field.path}
                field={field}
                layers={layers}
                layer={layer}
                onEdit={onEdit}
                onClear={onClear}
              />
            ))}
        </section>
      ))}
    </div>
  )
}
