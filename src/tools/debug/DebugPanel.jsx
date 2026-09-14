'use client'

import { useTrait, useTag } from 'koota/react'
import { playerEntity, cameraEntity } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem, listItems } from '@/core/data/items'
import {
  Position,
  Velocity,
  AnimationState,
  Grounded,
  OrbitCamera,
  CharacterController,
  MovementStats,
  Vitals,
  HeldItem,
  applyDamage,
} from '@/core/traits'

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

  if (
    !position ||
    !velocity ||
    !anim ||
    !orbit ||
    !body ||
    !movement ||
    !vitals ||
    !heldItem
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
    </div>
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
