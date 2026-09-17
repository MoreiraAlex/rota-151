'use client'

import { useTrait, useTag, useQuery } from 'koota/react'
import { playerEntity, cameraEntity } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem, listItems } from '@/core/data/items'
import { listSpecies, resolveSpeciesKind } from '@/core/data/species'
import {
  Position,
  Velocity,
  AnimationState,
  Grounded,
  OrbitCamera,
  CharacterController,
  MovementStats,
  PathState,
  Vitals,
  HeldItem,
  Party,
  Projectile,
  SummonedCreature,
  applyDamage,
} from '@/core/traits'

const CREATURE_SPECIES = listSpecies().filter(
  (species) => resolveSpeciesKind(species) === 'pokemon',
)

const DEBUG_DAMAGE_AMOUNT = 20

/**
 * Painel de texto com estado ao vivo do jogador/câmera + config relevante
 * pra tunar. Lê via hooks do koota (fora do Canvas — o WorldProvider cobre a
 * página inteira). Ferramenta de debug: só monta quando o toggle está ligado
 * (ver src/app/(auth)/page.js), nunca requisito de gameplay.
 */
export function DebugPanel() {
  const position = useTrait(playerEntity, Position)
  const velocity = useTrait(playerEntity, Velocity)
  const anim = useTrait(playerEntity, AnimationState)
  const grounded = useTag(playerEntity, Grounded)
  const orbit = useTrait(cameraEntity, OrbitCamera)
  const body = useTrait(playerEntity, CharacterController)
  const movement = useTrait(playerEntity, MovementStats)
  const vitals = useTrait(playerEntity, Vitals)
  const heldItem = useTrait(playerEntity, HeldItem)
  const party = useTrait(playerEntity, Party)
  const projectiles = useQuery(Projectile, Position)
  const summoned = useQuery(SummonedCreature, Position)

  if (
    !position ||
    !velocity ||
    !anim ||
    !orbit ||
    !body ||
    !movement ||
    !vitals ||
    !heldItem ||
    !party
  ) {
    return null
  }

  const item = heldItem.itemId ? getItem(heldItem.itemId) : null

  const speed = Math.hypot(velocity.x, velocity.z)
  const capsuleHeight = 2 * (body.capsuleRadius + body.capsuleHalfHeight)

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 space-y-1 rounded bg-black/70 p-3 font-mono text-xs text-white">
      <p>
        pos: {position.x.toFixed(2)}, {position.y.toFixed(2)},{' '}
        {position.z.toFixed(2)}
      </p>
      <p>
        speed: {speed.toFixed(2)} u/s · {grounded ? 'no chão' : 'no ar'}
      </p>
      <p>anim: {anim.id}</p>
      <p>
        câmera: yaw {orbit.yaw.toFixed(2)} · pitch {orbit.pitch.toFixed(2)} ·
        dist {orbit.distance.toFixed(1)}
      </p>
      <hr className="border-white/20" />
      <p>
        cápsula: r={body.capsuleRadius} h={body.capsuleHalfHeight} (altura total{' '}
        {capsuleHeight.toFixed(2)})
      </p>
      <p>
        walk/run: {movement.walkSpeed}/{movement.runSpeed} u/s
      </p>
      <hr className="border-white/20" />
      <VitalsBar
        label="hp"
        value={vitals.hp}
        max={vitals.maxHp}
        color="bg-red-500"
      />
      <p className="text-[10px] text-white/60">
        {vitals.hp.toFixed(0)}/{vitals.maxHp} · regen{' '}
        {vitals.hpRegenDelay > 0
          ? `pausado (${vitals.hpRegenDelay.toFixed(1)}s)`
          : `${vitals.hpRegenPercent}%/s`}
      </p>
      <VitalsBar
        label="stamina"
        value={vitals.stamina}
        max={vitals.maxStamina}
        color="bg-yellow-400"
      />
      <p className="text-[10px] text-white/60">
        {vitals.stamina.toFixed(0)}/{vitals.maxStamina} · regen{' '}
        {vitals.staminaRegenDelay > 0
          ? `pausado (${vitals.staminaRegenDelay.toFixed(1)}s)`
          : `${vitals.staminaRegenPercent}%/s`}
      </p>
      <button
        type="button"
        className="pointer-events-auto mt-1 rounded bg-red-900 px-2 py-1 text-[10px] hover:bg-red-800"
        onClick={() => {
          const current = playerEntity.get(Vitals)
          playerEntity.set(
            Vitals,
            applyDamage(
              current,
              DEBUG_DAMAGE_AMOUNT,
              GAME_CONFIG.VITALS.HP_REGEN_DELAY_AFTER_DAMAGE,
            ),
          )
        }}
      >
        tomar {DEBUG_DAMAGE_AMOUNT} de dano (debug)
      </button>
      <hr className="border-white/20" />
      <p>item em mãos: {item ? `${item.id} (${item.category})` : 'nenhum'}</p>
      <select
        className="pointer-events-auto rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
        value={heldItem.itemId ?? ''}
        onChange={(event) => {
          playerEntity.set(HeldItem, { itemId: event.target.value || null })
        }}
      >
        <option value="">nenhum</option>
        {listItems().map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.id} ({candidate.category})
          </option>
        ))}
      </select>
      <hr className="border-white/20" />
      <p>
        time: {party.slot1 ?? '—'} · {party.slot2 ?? '—'} · {party.slot3 ?? '—'}
      </p>
      <PartySlotSelect slot="slot1" value={party.slot1} />
      <PartySlotSelect slot="slot2" value={party.slot2} />
      <PartySlotSelect slot="slot3" value={party.slot3} />
      <hr className="border-white/20" />
      <p>projéteis ativos: {projectiles.length}</p>
      {projectiles.map((entity) => {
        const p = entity.get(Position)
        const hit = entity.get(Projectile).hit
        return (
          <p key={entity} className="text-[10px] text-white/60">
            {hit ? 'atingiu em' : 'voando'}: {p.x.toFixed(1)}, {p.y.toFixed(1)},{' '}
            {p.z.toFixed(1)}
          </p>
        )
      })}
      <p>
        criaturas de fora:{' '}
        {summoned.length === 0
          ? 'nenhuma'
          : summoned
              .map((entity) => entity.get(SummonedCreature).slot)
              .join(', ')}
      </p>
      {summoned.map((entity) => {
        const { slot } = entity.get(SummonedCreature)
        const { waypoints, waypointIndex, repathTimer } = entity.get(PathState)
        const remaining = waypoints.length - waypointIndex
        return (
          <p key={entity} className="text-[10px] text-white/60">
            {slot} · path:{' '}
            {remaining > 0 ? `${remaining} waypoint(s)` : 'direto (sem desvio)'}
            {' · '}
            recalc em {Math.max(0, repathTimer).toFixed(2)}s
          </p>
        )
      })}
    </div>
  )
}

/** Seletor de uma criatura (id de espécie `kind: 'pokemon'`) pra um slot do
 * time — escreve em `Party`, mesmo padrão do seletor de item acima. */
function PartySlotSelect({ slot, value }) {
  return (
    <select
      className="pointer-events-auto rounded bg-black/60 px-1 py-0.5 text-[10px] text-white"
      value={value ?? ''}
      onChange={(event) => {
        playerEntity.set(Party, { [slot]: event.target.value || null })
      }}
    >
      <option value="">{slot}: nenhuma</option>
      {CREATURE_SPECIES.map((species) => (
        <option key={species.id} value={species.id}>
          {slot}: {species.id}
        </option>
      ))}
    </select>
  )
}

/** Barra fininha de progresso, sem dependência nenhuma — só pra visualizar
 * HP/stamina no `DebugPanel` de relance. */
function VitalsBar({ label, value, max, color }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-white/15">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
