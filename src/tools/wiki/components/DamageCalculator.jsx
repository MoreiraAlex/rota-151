'use client'

import { useMemo, useState } from 'react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { STAT_STAGE_LIMIT } from '@/core/battle/statStages'
import { ATTACK_SLOTS } from '@/core/battle/attackCasting'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { resolveDamagePreview, withLevel } from '../damageCalculator'
import { listWikiSpecies, uniformIndividualValues } from '../speciesEntry'
import {
  SLOT_LABELS,
  STAT_LABELS,
  formatName,
  formatNumber,
  formatPercent,
  formatSeconds,
} from '../wikiFormat'

const SPECIES = listWikiSpecies()

const STAGE_OPTIONS = Array.from(
  { length: STAT_STAGE_LIMIT * 2 + 1 },
  (_, index) => index - STAT_STAGE_LIMIT,
)

const inputClass =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

function Field({ label, children }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function SpeciesSelect({ value, onChange }) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {SPECIES.map((species) => (
        <option key={species.id} value={species.id}>
          {formatName(species.id)}
        </option>
      ))}
    </select>
  )
}

function StageSelect({ value, onChange }) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {STAGE_OPTIONS.map((stage) => (
        <option key={stage} value={stage}>
          {stage > 0 ? `+${stage}` : stage}
        </option>
      ))}
    </select>
  )
}

function NumberInput({ value, onChange, min, max }) {
  return (
    <input
      type="number"
      className={inputClass}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )
}

function Panel({ title, children }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="font-semibold text-primary">{title}</p>
      {children}
    </div>
  )
}

/** Barra da vida do alvo com a faixa de dano (mínimo sólido, máximo claro). */
function HpBar({ minPercent, maxPercent }) {
  const min = Math.min(1, minPercent) * 100
  const max = Math.min(1, maxPercent) * 100
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="absolute inset-y-0 left-0 bg-primary/35"
        style={{ width: `${max}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 bg-primary"
        style={{ width: `${min}%` }}
      />
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function formatHits(hits) {
  return hits === Infinity ? '∞' : String(hits)
}

function Result({ preview }) {
  if (!preview) {
    return (
      <p className="text-sm text-muted-foreground">Sem golpe nesse slot.</p>
    )
  }
  const { damage } = preview
  const uses =
    preview.staminaCost > 0
      ? Math.floor(preview.attackerMaxEnergy / preview.staminaCost)
      : Infinity

  return (
    <div className="space-y-4">
      {damage === null ? (
        <p className="text-sm">Golpe de status: não causa dano.</p>
      ) : damage.channel ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Dano do canal inteiro"
              value={formatNumber(damage.total, 1)}
              hint="variação média, sem crítico"
            />
            <Stat
              label="Por parte (média)"
              value={formatNumber(damage.perTick, 2)}
              hint={`${damage.ticks} partes · parte crítica vale ×${damage.criticalMultiplier}`}
            />
            <Stat
              label="Usos pra desmaiar"
              value={formatHits(damage.hitsToFaint)}
            />
          </div>
          <HpBar
            minPercent={damage.totalPercent}
            maxPercent={damage.totalPercent}
          />
          <p className="text-sm text-muted-foreground">
            {formatPercent(damage.totalPercent)} da vida do alvo (
            {formatNumber(preview.defenderMaxHp, 0)}).
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Dano"
              value={`${formatNumber(damage.min, 1)} – ${formatNumber(damage.max, 1)}`}
            />
            <Stat
              label="Com crítico"
              value={`${formatNumber(damage.criticalMin, 1)} – ${formatNumber(damage.criticalMax, 1)}`}
              hint={`chance ${formatPercent(preview.criticalChance, 2)}`}
            />
            <Stat
              label="Golpes pra desmaiar"
              value={
                damage.hitsToFaint.best === damage.hitsToFaint.worst
                  ? formatHits(damage.hitsToFaint.best)
                  : `${formatHits(damage.hitsToFaint.best)} – ${formatHits(damage.hitsToFaint.worst)}`
              }
              hint="sem crítico"
            />
          </div>
          <HpBar
            minPercent={damage.minPercent}
            maxPercent={damage.maxPercent}
          />
          <p className="text-sm text-muted-foreground">
            {formatPercent(damage.minPercent)} –{' '}
            {formatPercent(damage.maxPercent)} da vida do alvo (
            {formatNumber(preview.defenderMaxHp, 0)}).
          </p>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Chance de acerto"
          value={formatPercent(preview.hitChance)}
        />
        <Stat
          label="Custo de energia"
          value={formatNumber(preview.staminaCost)}
          hint={`${uses === Infinity ? '∞' : uses} usos com a barra cheia (${formatNumber(preview.attackerMaxEnergy, 0)})`}
        />
        <Stat
          label="Recarga"
          value={preview.cooldown > 0 ? formatSeconds(preview.cooldown) : '—'}
          hint={
            preview.cooldown > 0
              ? 'depois do fim do golpe'
              : 'básico: sem recarga'
          }
        />
      </div>
    </div>
  )
}

/**
 * Calculadora de dano da wiki (`/wiki/calculadora`) — escolhe os dois lados e
 * o golpe; a conta é a do jogo (`resolveDamagePreview`). IV igual em todos os
 * status de cada lado, pra caber num campo só.
 */
export function DamageCalculator() {
  const { IV_MIN, IV_MAX } = GAME_CONFIG.BATTLE
  const [attackerId, setAttackerId] = useState(SPECIES[0]?.id)
  const [defenderId, setDefenderId] = useState(SPECIES[1]?.id ?? SPECIES[0]?.id)
  const [slot, setSlot] = useState('primary')
  const [attackerLevel, setAttackerLevel] = useState(SPECIES[0]?.level ?? 1)
  const [defenderLevel, setDefenderLevel] = useState(
    (SPECIES[1] ?? SPECIES[0])?.level ?? 1,
  )
  const [attackerIv, setAttackerIv] = useState(IV_MAX)
  const [defenderIv, setDefenderIv] = useState(IV_MAX)
  const [attackerStages, setAttackerStages] = useState({
    attack: 0,
    sp_atk: 0,
    accuracy: 0,
  })
  const [defenderStages, setDefenderStages] = useState({
    defense: 0,
    sp_def: 0,
  })

  const attackerSpecies = SPECIES.find((species) => species.id === attackerId)
  const defenderSpecies = SPECIES.find((species) => species.id === defenderId)

  const slots = ATTACK_SLOTS.map(({ slot: key }) => ({
    key,
    attack: resolveCreatureAttack(attackerSpecies, key),
  })).filter((entry) => entry.attack)

  const activeSlot = slots.some((entry) => entry.key === slot)
    ? slot
    : slots[0]?.key

  const preview = useMemo(() => {
    if (!attackerSpecies || !defenderSpecies || !activeSlot) return null
    return resolveDamagePreview({
      attacker: {
        species: withLevel(attackerSpecies, attackerLevel),
        individualValues: uniformIndividualValues(attackerIv),
        stages: attackerStages,
      },
      defender: {
        species: withLevel(defenderSpecies, defenderLevel),
        individualValues: uniformIndividualValues(defenderIv),
        stages: defenderStages,
      },
      slot: activeSlot,
    })
  }, [
    attackerSpecies,
    defenderSpecies,
    activeSlot,
    attackerLevel,
    defenderLevel,
    attackerIv,
    defenderIv,
    attackerStages,
    defenderStages,
  ])

  function selectAttacker(id) {
    setAttackerId(id)
    setAttackerLevel(SPECIES.find((species) => species.id === id)?.level ?? 1)
  }

  function selectDefender(id) {
    setDefenderId(id)
    setDefenderLevel(SPECIES.find((species) => species.id === id)?.level ?? 1)
  }

  const clampIv = (value) => Math.min(IV_MAX, Math.max(IV_MIN, value || 0))
  const clampLevel = (value) => Math.max(1, value || 1)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Atacante">
          <Field label="Criatura">
            <SpeciesSelect value={attackerId} onChange={selectAttacker} />
          </Field>
          <Field label="Golpe">
            <select
              className={inputClass}
              value={activeSlot}
              onChange={(event) => setSlot(event.target.value)}
            >
              {slots.map(({ key, attack }) => (
                <option key={key} value={key}>
                  {key === 'primary'
                    ? SLOT_LABELS[key]
                    : `${SLOT_LABELS[key]} — ${formatName(attack.id)}`}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nível">
              <NumberInput
                value={attackerLevel}
                min={1}
                onChange={(value) => setAttackerLevel(clampLevel(value))}
              />
            </Field>
            <Field label={`IV (${IV_MIN}–${IV_MAX})`}>
              <NumberInput
                value={attackerIv}
                min={IV_MIN}
                max={IV_MAX}
                onChange={(value) => setAttackerIv(clampIv(value))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.keys(attackerStages).map((key) => (
              <Field key={key} label={`Efeito em ${STAT_LABELS[key]}`}>
                <StageSelect
                  value={attackerStages[key]}
                  onChange={(value) =>
                    setAttackerStages((stages) => ({ ...stages, [key]: value }))
                  }
                />
              </Field>
            ))}
          </div>
        </Panel>

        <Panel title="Alvo">
          <Field label="Criatura">
            <SpeciesSelect value={defenderId} onChange={selectDefender} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nível">
              <NumberInput
                value={defenderLevel}
                min={1}
                onChange={(value) => setDefenderLevel(clampLevel(value))}
              />
            </Field>
            <Field label={`IV (${IV_MIN}–${IV_MAX})`}>
              <NumberInput
                value={defenderIv}
                min={IV_MIN}
                max={IV_MAX}
                onChange={(value) => setDefenderIv(clampIv(value))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(defenderStages).map((key) => (
              <Field key={key} label={`Efeito em ${STAT_LABELS[key]}`}>
                <StageSelect
                  value={defenderStages[key]}
                  onChange={(value) =>
                    setDefenderStages((stages) => ({ ...stages, [key]: value }))
                  }
                />
              </Field>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Resultado">
        <Result preview={preview} />
      </Panel>
    </div>
  )
}
