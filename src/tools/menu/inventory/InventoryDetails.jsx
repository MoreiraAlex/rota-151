'use client'

import { useQueryFirst, useTrait } from 'koota/react'
import { getItem } from '@/core/data/items'
import { getSpecies } from '@/core/data/species'
import {
  CreatureLevel,
  CreatureMoves,
  IndividualValues,
  Pokemon,
  StoredFaint,
  StoredVitals,
  SummonedCreature,
  SummonedFrom,
  Vitals,
  resolveMaxHp,
  resolveMaxStamina,
} from '@/core/traits'
import {
  formatSpeciesName,
  resolveDisplayLevel,
  resolveXpPercent,
  SpritePortrait,
  TypeBadges,
  VitalBar,
} from '@/view/shared/statusDisplay'
import { SlotPreview } from '../../shared/SlotPreview'
import { MoveList } from '../pokedex/TeamTab'

// Nome da categoria pro jogador (o dado guarda o id da categoria).
const CATEGORY_LABELS = {
  throwable: 'Arremessável',
  consumable: 'Poção',
  berry: 'Fruta',
  pokeball: 'Pokébola',
  scanner: 'Scanner',
}

/** Nome do item pro jogador: `name` do dado, ou o id formatado. */
export function formatItemName(itemId) {
  return getItem(itemId)?.name ?? formatSpeciesName(itemId)
}

/**
 * Detalhes do que foi clicado no Inventário (docs/features/041-inventario-
 * de-itens-e-pokemon.md) — item da grade ou da mão, ou Pokémon da grade ou
 * do time. `selection` é `{ kind: 'item', id }` ou `{ kind: 'creature',
 * pokemon }`; sem nada (ou o que estava selecionado sumiu), um aviso.
 */
export function InventoryDetails({ selection, itemCount, heldItemId }) {
  if (selection?.kind === 'item' && itemCount > 0) {
    return (
      <ItemDetails
        itemId={selection.id}
        count={itemCount}
        inHand={heldItemId === selection.id}
      />
    )
  }
  if (selection?.kind === 'creature' && selection.pokemon?.isAlive?.()) {
    return <PokemonDetails pokemon={selection.pokemon} />
  }
  return (
    <p className="rounded bg-white/5 p-3 text-[11px] text-white/50">
      Clique num item ou Pokémon pra ver os detalhes.
    </p>
  )
}

function ItemDetails({ itemId, count, inHand }) {
  const item = getItem(itemId)
  const effects = [
    item?.consumable?.healAmount != null &&
      `Cura ${item.consumable.healAmount} de vida na hora`,
    item?.berry &&
      `Cura ${item.berry.healAmount} de vida enquanto é comida (${item.berry.duration} s)`,
    item?.pokeball?.captureMultiplier != null &&
      `Chance de captura ×${item.pokeball.captureMultiplier}`,
    item?.scanner?.range != null && `Alcance de ${item.scanner.range} m`,
  ].filter(Boolean)

  return (
    <div className="space-y-2 rounded bg-white/5 p-3 text-[11px]">
      <div className="flex items-center gap-2">
        <SlotPreview kind="item" id={itemId} count={count} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">
            {formatItemName(itemId)}
          </span>
          <span className="text-white/50">
            {CATEGORY_LABELS[item?.category] ?? item?.category ?? '—'}
          </span>
        </div>
      </div>
      <p className="text-white/70">
        Quantidade: {count}
        {inHand ? ' (1 na mão)' : ''}
      </p>
      {item?.description && <p className="text-white/80">{item.description}</p>}
      {effects.map((effect) => (
        <p key={effect} className="text-emerald-300/80">
          {effect}
        </p>
      ))}
    </div>
  )
}

function PokemonDetails({ pokemon }) {
  const speciesId = useTrait(pokemon, Pokemon)?.speciesId
  const progress = useTrait(pokemon, CreatureLevel) ?? null
  const individualValues = useTrait(pokemon, IndividualValues)
  const stored = useTrait(pokemon, StoredVitals)?.vitals ?? null
  const fainted = useTrait(pokemon, StoredFaint)
  const moves = useTrait(pokemon, CreatureMoves)
  // Invocado, a vida de verdade é a da criatura em campo.
  const creature = useQueryFirst(SummonedCreature, SummonedFrom(pokemon))
  const live = useTrait(creature, Vitals)
  const vitals = live ?? stored
  const species = getSpecies(speciesId)
  if (!species) return null

  const level = progress?.level
  const maxHp = resolveMaxHp(species, individualValues, level)
  const maxStamina = resolveMaxStamina(species, individualValues, level)

  return (
    <div className="space-y-2 rounded bg-white/5 p-3 text-[11px]">
      <div className="flex items-center gap-2">
        <SpritePortrait
          species={species}
          size={36}
          xpPercent={resolveXpPercent(species, progress)}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">
            {formatSpeciesName(species.id)} · Nv.{' '}
            {resolveDisplayLevel(species, progress)}
          </span>
          <TypeBadges types={species.types} compact align="start" />
        </div>
      </div>
      {fainted && <p className="text-red-400">Desmaiado</p>}
      <VitalBar
        height={1}
        value={vitals?.hp ?? maxHp}
        max={maxHp}
        colorClass="bg-emerald-500"
      />
      <VitalBar
        height={1}
        value={vitals?.stamina ?? maxStamina}
        max={maxStamina}
        colorClass="bg-sky-400"
      />
      <MoveList moves={moves} />
    </div>
  )
}
