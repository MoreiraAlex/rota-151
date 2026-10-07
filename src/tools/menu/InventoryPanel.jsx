'use client'

import { useRef, useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity, world } from '@/core/world/world'
import {
  CreatureLevel,
  HeldItem,
  Inventory,
  InventoryCell,
  Pokemon,
} from '@/core/traits'
import {
  colocarNoTime,
  countItem,
  countVisibleItem,
  desequiparMao,
  equiparNaMao,
  listOwnedPokemon,
  moverNoInventario,
  organizarInventario,
  resolveInventoryCells,
  tirarDoTime,
} from '@/core/actions'
import { formatSpeciesName } from '@/view/shared/formatName'
import { useOwnedPokemon, usePartyPokemon } from '@/view/hooks/usePartyPokemon'
import { useTraitVersion } from '@/view/hooks/useTraitVersion'
import { SlotPreview, getSlotColor } from '../shared/SlotPreview'
import { InventoryDetails, formatItemName } from './inventory/InventoryDetails'

// Grade de posição livre (docs/features/041-inventario-de-itens-e-
// pokemon.md): no mínimo `MIN_ROWS` linhas, e sempre uma célula livre
// depois da última ocupada, pra dar onde soltar.
const GRID_COLUMNS = 5
const MIN_ROWS = 5

const PARTY_SLOTS = ['slot1', 'slot2', 'slot3']

// Tipo MIME por tipo de coisa arrastada — durante o `dragover` o browser só
// mostra os TIPOS (não os valores), então o tipo já diz se é item ou
// Pokémon, pra colorir o destino compatível/incompatível. O valor (id do
// item, ou o registro do Pokémon como texto) só é lido no `drop`.
const DRAG_TYPE = {
  item: 'text/x-inventory-item',
  creature: 'text/x-inventory-creature',
}

// De onde o arraste saiu: `'grid'`, `'hand'` ou o slot do time (`'slot1'`…).
// Decide o que soltar faz (mover na grade, desequipar, tirar do time).
const ORIGIN_TYPE = 'text/x-inventory-origin'

/**
 * Imagem de arraste — desenho no mesmo estilo do `SlotPreview` (quadrado
 * pra item, círculo pra Pokémon, cor por categoria/espécie) num canvas fora
 * da tela, em vez do recorte do elemento HTML que o browser faria.
 * `setDragImage` exige o elemento no DOM na hora; removido logo depois.
 */
function createDragImage(kind, colorId) {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 40
  canvas.style.position = 'fixed'
  canvas.style.top = '-1000px'
  canvas.style.left = '-1000px'

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = getSlotColor(kind, colorId)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 2

  if (kind === 'creature') {
    ctx.beginPath()
    ctx.arc(20, 20, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillRect(4, 4, 32, 32)
    ctx.strokeRect(4, 4, 32, 32)
  }

  document.body.appendChild(canvas)
  return canvas
}

/** Chave de uma entrada (item ou Pokémon). */
function entryKey(entry) {
  if (!entry) return null
  return entry.kind === 'item' ? `item:${entry.id}` : `pokemon:${entry.pokemon}`
}

/** Chave do que está sendo arrastado: a origem junto, porque o item da mão
 * pode ter outra unidade na grade ao mesmo tempo. */
function dragKeyOf(origin, entry) {
  return entry ? `${origin}:${entryKey(entry)}` : null
}

/** O registro do jogador com este id (arrastado como texto), ou `null`. */
function resolveDraggedPokemon(value) {
  if (!value) return null
  const id = Number(value)
  return listOwnedPokemon(world, playerEntity).find((p) => p === id) ?? null
}

/** A entrada arrastada, lida do `dataTransfer` no `drop`. */
function readDraggedEntry(dataTransfer) {
  const itemId = dataTransfer.getData(DRAG_TYPE.item)
  if (itemId) return { kind: 'item', id: itemId }
  const pokemon = resolveDraggedPokemon(
    dataTransfer.getData(DRAG_TYPE.creature),
  )
  return pokemon ? { kind: 'creature', pokemon } : null
}

function hasDragType(event, kinds) {
  return kinds.some((kind) =>
    event.dataTransfer.types.includes(DRAG_TYPE[kind]),
  )
}

/** Texto do tooltip de uma entrada. */
function useEntryTitle(entry) {
  const speciesId = useTrait(entry?.pokemon, Pokemon)?.speciesId
  const level = useTrait(entry?.pokemon, CreatureLevel)?.level
  if (!entry) return undefined
  if (entry.kind === 'item') return formatItemName(entry.id)
  const name = formatSpeciesName(speciesId)
  return level != null ? `${name} · Nv. ${level}` : name
}

/**
 * Inventário — único lugar que monta o time e equipa a mão. À esquerda, a
 * grade de posição livre com os itens (com quantidade) e os Pokémon fora do
 * time; à direita, o time (3 slots) e a mão, e embaixo os detalhes do que
 * foi clicado (`InventoryDetails`). Nome só no tooltip.
 *
 * Arrastar e soltar:
 * - dentro da grade: move pra célula; se ocupada, as duas trocam;
 * - grade → slot do time / mão: põe no time (`colocarNoTime`) / equipa
 *   (`equiparNaMao`);
 * - slot → outro slot: os dois trocam;
 * - slot / mão → grade: tira do time / desequipa, na célula onde soltou
 *   (ou na primeira livre, soltando fora das células). Soltar um Pokémon do
 *   time sobre outro da grade troca os dois.
 *
 * Enquanto arrasta, a origem vira uma célula vazia. O que está sendo
 * arrastado vive AQUI (`dragKey`), não em cada célula: o fim do arraste nem
 * sempre chega (a célula de origem pode sumir no `drop`), e todo `drop`
 * também limpa.
 *
 * "Organizar" arruma a grade sem buracos (`organizarInventario`).
 */
export function InventoryPanel() {
  const inventory = useTrait(playerEntity, Inventory)
  const heldItem = useTrait(playerEntity, HeldItem)
  const party = usePartyPokemon(playerEntity)
  // Os dois só pra re-renderizar: Pokémon entrando/saindo do jogador e
  // mudando de célula.
  useOwnedPokemon(playerEntity)
  useTraitVersion(InventoryCell)

  const [dragKey, setDragKey] = useState(null)
  const [selection, setSelection] = useState(null)
  const [gridHover, setGridHover] = useState(false)
  const dragActive = useRef(false)

  if (!inventory || !heldItem) return null

  const cells = resolveInventoryCells(world, playerEntity)
  const lastIndex = Math.max(-1, ...cells.keys())
  const rows = Math.max(MIN_ROWS, Math.ceil((lastIndex + 2) / GRID_COLUMNS))

  const drag = {
    key: dragKey,
    start(event, entry, origin, colorId) {
      const value = entry.kind === 'item' ? entry.id : String(entry.pokemon)
      event.dataTransfer.setData(DRAG_TYPE[entry.kind], value)
      event.dataTransfer.setData(ORIGIN_TYPE, origin)
      event.dataTransfer.effectAllowed = 'move'
      const dragImage = createDragImage(entry.kind, colorId)
      event.dataTransfer.setDragImage(dragImage, 20, 20)
      setTimeout(() => dragImage.remove(), 0)
      // Esconder a origem só no próximo tick: mexer nela no próprio
      // `dragstart` cancela o arraste. Se o arraste já acabou, não esconde.
      dragActive.current = true
      const key = dragKeyOf(origin, entry)
      setTimeout(() => {
        if (dragActive.current) setDragKey(key)
      }, 0)
    },
    end() {
      dragActive.current = false
      setDragKey(null)
      setGridHover(false)
    },
  }

  /** Soltar algo vindo da mão ou do time na `index` (ou na primeira livre). */
  const dropFromEquipment = (origin, index) => {
    if (origin === 'hand') desequiparMao(world, playerEntity, index)
    else if (party[origin]) {
      tirarDoTime(world, playerEntity, party[origin], index)
    }
  }

  const handleCellDrop = (event, index) => {
    event.preventDefault()
    event.stopPropagation()
    const origin = event.dataTransfer.getData(ORIGIN_TYPE)
    const entry = readDraggedEntry(event.dataTransfer)
    if (origin === 'grid' && entry) {
      moverNoInventario(world, playerEntity, entry, index)
    } else {
      dropFromEquipment(origin, index)
    }
    drag.end()
  }

  const handleGridDragOver = (event) => {
    if (!hasDragType(event, ['item', 'creature'])) return
    event.preventDefault()
    setGridHover(true)
  }

  const handleGridDrop = (event) => {
    event.preventDefault()
    dropFromEquipment(event.dataTransfer.getData(ORIGIN_TYPE), null)
    drag.end()
  }

  const selectionKey = entryKey(selection)

  return (
    <div className="flex gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
            onClick={() => organizarInventario(world, playerEntity)}
          >
            Organizar
          </button>
        </div>
        <div
          onDragOver={handleGridDragOver}
          onDragLeave={() => setGridHover(false)}
          onDrop={handleGridDrop}
          className={`grid max-h-80 grid-cols-5 content-start gap-1 overflow-y-auto rounded p-1 transition-colors ${
            gridHover ? 'bg-emerald-900/30' : ''
          }`}
        >
          {Array.from({ length: rows * GRID_COLUMNS }, (_, index) => {
            const entry = cells.get(index) ?? null
            return (
              <GridCell
                key={index}
                entry={entry}
                dragging={entry != null && dragKey === dragKeyOf('grid', entry)}
                selected={
                  selectionKey != null && entryKey(entry) === selectionKey
                }
                drag={drag}
                onSelect={setSelection}
                onDrop={(event) => handleCellDrop(event, index)}
              />
            )
          })}
        </div>
      </div>

      <div className="flex w-56 shrink-0 flex-col gap-2">
        <div className="flex items-end justify-between gap-1">
          {PARTY_SLOTS.map((slot) => (
            <PartySlot
              key={slot}
              slot={slot}
              pokemon={party[slot]}
              drag={drag}
              selectionKey={selectionKey}
              onSelect={setSelection}
            />
          ))}
          <HandSlot
            itemId={heldItem.itemId}
            drag={drag}
            selectionKey={selectionKey}
            onSelect={setSelection}
          />
        </div>
        <InventoryDetails
          selection={selection}
          itemCount={
            selection?.kind === 'item'
              ? countItem(playerEntity, selection.id)
              : 0
          }
          heldItemId={heldItem.itemId}
        />
      </div>
    </div>
  )
}

/** Contorno da célula/slot: alvo compatível/incompatível, selecionado ou normal. */
function frameClass({ selected, dropStatus }) {
  if (dropStatus === 'compatible') return 'border-emerald-400 bg-emerald-900/50'
  if (dropStatus === 'incompatible') return 'border-red-500 bg-red-900/50'
  if (selected) return 'border-amber-300 bg-black/40'
  return 'border-white/20 bg-black/40'
}

/** Uma célula da grade: alvo de `drop` sempre; com conteúdo (e não sendo
 * arrastada), também origem de arraste e clicável. Vazia ou com o conteúdo
 * em arraste, aparece como célula vazia. */
function GridCell({ entry, dragging, selected, drag, onSelect, onDrop }) {
  const [dropStatus, setDropStatus] = useState(null)
  const title = useEntryTitle(entry)
  const speciesId = useTrait(entry?.pokemon, Pokemon)?.speciesId
  const visible = entry != null && !dragging
  const colorId = entry?.kind === 'creature' ? speciesId : entry?.id

  const handleDragOver = (event) => {
    if (!hasDragType(event, ['item', 'creature'])) return
    event.preventDefault()
    event.stopPropagation()
    setDropStatus('compatible')
  }

  return (
    <div
      draggable={visible}
      onDragStart={
        visible
          ? (event) => drag.start(event, entry, 'grid', colorId)
          : undefined
      }
      onDragEnd={drag.end}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropStatus(null)}
      onDrop={(event) => {
        setDropStatus(null)
        onDrop(event)
      }}
      onClick={visible ? () => onSelect(entry) : undefined}
      title={visible ? title : undefined}
      className={`flex aspect-square items-center justify-center rounded border p-1 transition-colors ${frameClass(
        { selected: visible && selected, dropStatus },
      )} ${visible ? 'cursor-grab active:cursor-grabbing' : 'border-dashed'}`}
    >
      {visible && entry.kind === 'item' && (
        <SlotPreview
          kind="item"
          id={entry.id}
          count={countVisibleItem(playerEntity, entry.id)}
        />
      )}
      {visible && entry.kind === 'creature' && (
        <SlotPreview kind="creature" id={speciesId} />
      )}
    </div>
  )
}

/** Slot do time: aceita Pokémon (da grade ou de outro slot); arrasta pra
 * grade (tira do time) ou pra outro slot (troca). */
function PartySlot({ slot, pokemon, drag, selectionKey, onSelect }) {
  const entry = pokemon ? { kind: 'creature', pokemon } : null
  const speciesId = useTrait(pokemon, Pokemon)?.speciesId
  return (
    <EquipmentSlot
      label={slot.replace('slot', '')}
      entry={entry}
      colorId={speciesId}
      origin={slot}
      accepts="creature"
      drag={drag}
      selected={selectionKey != null && entryKey(entry) === selectionKey}
      onSelect={onSelect}
      onDropEntry={(dropped) =>
        colocarNoTime(playerEntity, dropped.pokemon, slot)
      }
    />
  )
}

/** Mão principal: aceita item da grade; arrasta pra grade (desequipa). */
function HandSlot({ itemId, drag, selectionKey, onSelect }) {
  const entry = itemId ? { kind: 'item', id: itemId } : null
  return (
    <EquipmentSlot
      label="mão"
      entry={entry}
      colorId={itemId}
      origin="hand"
      accepts="item"
      drag={drag}
      selected={selectionKey != null && entryKey(entry) === selectionKey}
      onSelect={onSelect}
      onDropEntry={(dropped) => equiparNaMao(world, playerEntity, dropped.id)}
    />
  )
}

/**
 * Um slot de equipamento (time ou mão). Alvo de `drop` do tipo `accepts`
 * (verde se o arrastado é compatível, vermelho se não); com conteúdo,
 * origem de arraste e clicável. Enquanto o próprio conteúdo é arrastado,
 * aparece vazio.
 */
function EquipmentSlot({
  label,
  entry,
  colorId,
  origin,
  accepts,
  drag,
  selected,
  onSelect,
  onDropEntry,
}) {
  const [dropStatus, setDropStatus] = useState(null)
  const title = useEntryTitle(entry)
  const dragging = entry != null && drag.key === dragKeyOf(origin, entry)
  const visible = entry != null && !dragging

  const handleDragOver = (event) => {
    if (hasDragType(event, [accepts])) {
      event.preventDefault()
      setDropStatus('compatible')
    } else {
      setDropStatus('incompatible')
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDropStatus(null)
    const dropped = readDraggedEntry(event.dataTransfer)
    if (dropped?.kind === accepts) onDropEntry(dropped)
    drag.end()
  }

  return (
    <div
      draggable={visible}
      onDragStart={
        visible
          ? (event) => drag.start(event, entry, origin, colorId)
          : undefined
      }
      onDragEnd={drag.end}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropStatus(null)}
      onDrop={handleDrop}
      onClick={visible ? () => onSelect(entry) : undefined}
      title={visible ? title : undefined}
      className={`flex w-12 flex-col items-center gap-0.5 rounded border p-1 transition-colors ${frameClass(
        { selected: visible && selected, dropStatus },
      )} ${visible ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <span className="text-[9px] text-white/50">{label}</span>
      {visible ? (
        <SlotPreview kind={entry.kind} id={colorId} />
      ) : (
        <span className="h-5 w-5 rounded border border-dashed border-white/20" />
      )}
    </div>
  )
}
