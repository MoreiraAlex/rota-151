'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/data/attacks'
import {
  AttackCooldowns,
  HeldItem,
  InputControlled,
  Inventory,
  SummonedCreature,
} from '@/core/traits'
import { SlotPreview } from '../shared/SlotPreview'
import { SkillSlot } from './SkillsHud'
import { MouseLeft } from 'lucide-react'

/**
 * HUD real (não-debug) do botão de CLIQUE (esquerdo) — canto inferior
 * direito. Extraído de `PartyHud.jsx` nesta rodada (5ª, docs/features/
 * 027-hud-de-status-e-habilidades.md) — pedido do usuário: "preciso que o
 * slot de clique saia do slotParty, quero ele no canto inferior direito".
 *
 * Dinâmico por QUEM está no controle (`useQueryFirst(InputControlled,
 * SummonedCreature)`, mesma técnica reativa de `SkillsHud.jsx`/
 * `NameplateView.jsx` — comparar por entidade resolvida pelo PRÓPRIO
 * hook, nunca `entity.has(...)` solto):
 * - Treinador no controle (`SummonedCreature` não resolve): clique
 *   continua sendo o ITEM NA MÃO (`HeldItem`/`Inventory`, mesmo conteúdo
 *   que `PartyHud.jsx` mostrava antes desta rodada).
 * - Criatura no controle: clique vira o ATAQUE BÁSICO dela
 *   (`species.attacks.primary`, ver docs/features/025-ataque-comum-de-
 *   criatura.md) — pedido explícito: "quando o controle for de criatura,
 *   o clique para de ser o item na mao e passar ser o ataque basico da
 *   criatura, que vai ter seu proprio sprite tb". Reaproveita
 *   `SkillSlot` (exportado de `SkillsHud.jsx` nesta mesma rodada) — MESMO
 *   visual/lógica de cooldown que Q/E/R, incluindo o ícone com sprite
 *   (`AttackIcon`, `view/shared/statusDisplay.jsx`), só outro slot/tecla
 *   (`primary`, `AttackCooldowns.primary`) — em vez de duplicar o
 *   componente.
 */
export function ActionSlotHud() {
  const controlled = useQueryFirst(InputControlled, SummonedCreature)
  const creature = useTrait(controlled, SummonedCreature)
  const cooldowns = useTrait(controlled, AttackCooldowns)
  const heldItem = useTrait(playerEntity, HeldItem)
  const inventory = useTrait(playerEntity, Inventory)

  return (
    <>
    {creature && cooldowns ? (
        <div className="pointer-events-none absolute bottom-4 left-[40%] font-mono text-xs text-white">
          <ActionSlotAttack speciesId={creature.speciesId} remaining={cooldowns.primary} />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-xs text-white">
          <ActionSlotItem heldItem={heldItem} inventory={inventory} />
        </div>
      )}
      </>
  )
}

function ActionSlotAttack({ speciesId, remaining }) {
  const species = getSpecies(speciesId)
  const attack = resolveCreatureAttack(species?.attacks?.primary)

  return <SkillSlot label={<MouseLeft size={16}/>} attack={attack} remaining={remaining} />
}

function ActionSlotItem({ heldItem, inventory }) {
  if (!heldItem || !inventory) return null

  const heldItemCount = heldItem.itemId
    ? inventory.itemIds.filter((id) => id === heldItem.itemId).length
    : null

  return (
    <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded border border-white/20 bg-black/70 p-1.5">
      <span className="absolute left-1 top-1 z-20 text-sm text-white"><MouseLeft size={16}/></span>
      {heldItem.itemId && (
        <SlotPreview kind="item" id={heldItem.itemId} count={heldItemCount} />
      )}
      <span className="w-full truncate text-center">
        {heldItem.itemId ?? 'vazia'}
      </span>
    </div>
  )
}
