'use client'

import { useTrait, useQuery } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { HeldItem, Inventory, Party, SummonedCreature } from '@/core/traits'
import { SlotPreview } from '../shared/SlotPreview'

const PARTY_SLOTS = [
  { key: 'slot1', label: '1' },
  { key: 'slot2', label: '2' },
  { key: 'slot3', label: '3' },
]

/**
 * HUD real (não-debug, ver `docs/backlog.md` — "HUD real (não-debug)") —
 * mostra a mão principal (clique esquerdo, `HeldItem`) e os 3 slots do
 * time (mesma tecla física que já invoca/recolhe, `secondary1-3` — ver
 * docs/features/011-slots-de-acao.md), lado a lado. Destaca o(s) slot(s)
 * de time que estão de fora (`SummonedCreature`, ao vivo via `useQuery`).
 *
 * Só exibe — não deixa trocar o que está equipado (ver
 * docs/features/018-preview-de-equipamento-no-inventario.md). Equipar é
 * responsabilidade só do Inventário (menu de pausa), que mostra em tempo
 * real pra onde vai; o HUD existia clicável até essa versão, mas ter dois
 * lugares fazendo a mesma coisa é confuso, então essa responsabilidade
 * saiu daqui.
 *
 * Sempre montado (ver `src/app/(auth)/page.js`) — ver time/item equipado é
 * jogo, não ferramenta de dev.
 */
export function PartyHud() {
  const heldItem = useTrait(playerEntity, HeldItem)
  const inventory = useTrait(playerEntity, Inventory)
  const party = useTrait(playerEntity, Party)
  const summoned = useQuery(SummonedCreature)

  if (!heldItem || !inventory || !party) return null

  const activeSlots = new Set(
    summoned.map((entity) => entity.get(SummonedCreature).slot),
  )
  const heldItemCount = heldItem.itemId
    ? inventory.itemIds.filter((id) => id === heldItem.itemId).length
    : null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 font-mono text-xs text-white">
      <HudSlot
        label="clique"
        value={heldItem.itemId}
        emptyLabel="vazia"
        preview={
          heldItem.itemId && (
            <SlotPreview
              kind="item"
              id={heldItem.itemId}
              count={heldItemCount}
            />
          )
        }
      />

      {PARTY_SLOTS.map(({ key, label }) => {
        const speciesId = party[key]
        const species = speciesId ? getSpecies(speciesId) : null
        const isActive = activeSlots.has(key)

        return (
          <HudSlot
            key={key}
            label={label}
            value={species?.id ?? null}
            preview={species && <SlotPreview kind="creature" id={species.id} />}
            active={isActive}
            activeLabel="fora"
          />
        )
      })}
    </div>
  )
}

/** Um slot da barra — só leitura, sem clique/seletor (ver Decisões da
 * v0.0.18). */
function HudSlot({
  label,
  value,
  emptyLabel = 'vazio',
  preview,
  active,
  activeLabel,
}) {
  return (
    <div
      className={`flex w-20 flex-col items-center gap-0.5 rounded border p-1.5 ${
        active
          ? 'border-emerald-400 bg-emerald-900/60'
          : 'border-white/20 bg-black/70'
      }`}
    >
      <span className="text-[10px] text-white/50">{label}</span>
      {preview}
      <span className="w-full truncate text-center">{value ?? emptyLabel}</span>
      {active && (
        <span className="text-[10px] text-emerald-300">{activeLabel}</span>
      )}
    </div>
  )
}
