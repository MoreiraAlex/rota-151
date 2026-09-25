'use client'

import { useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { getItem } from '@/core/data/items'
import { listSpecies, resolveSpeciesKind } from '@/core/data/species'
import { HeldItem, Inventory, Party } from '@/core/traits'
import { equiparCriatura } from '@/core/actions'
import { SlotPreview, getSlotColor } from '../shared/SlotPreview'
import { PlayerPreview } from './PlayerPreview'

const GRID_SIZE = 25 // 5x5

const PARTY_SLOTS = ['slot1', 'slot2', 'slot3']

const CREATURE_SPECIES = listSpecies().filter(
  (species) => resolveSpeciesKind(species) === 'pokemon',
)

// Tipo MIME custom por categoria de slot — arrastar de verdade (não só ler
// o valor) exige saber ANTES do drop se o que está sendo arrastado é
// compatível com o slot embaixo do cursor, pra colorir o destino
// (compatível/incompatível) durante o arraste. `dataTransfer.getData()` só
// devolve valor no `drop`; durante `dragover` só dá pra ver quais tipos
// existem (`dataTransfer.types`) — por isso o tipo em si já carrega a
// categoria, o valor (id) só é lido no drop de verdade.
const DRAG_TYPE = {
  item: 'text/x-equip-item',
  creature: 'text/x-equip-creature',
}

// Tipo MIME que só existe quando o arraste começou num slot de equipamento
// já ocupado (ver `EquippedSlot`) — o valor é o id de origem (`'hand'` pra
// mão, ou o nome do slot de time, ex. `'slot1'`). A grade do inventário
// (`InventoryPanel`, área de fundo) escuta só esse tipo pra saber que
// soltar ali significa "desequipar", sem precisar saber o item/criatura em
// si (já sai do próprio trait, não precisa ir e voltar pelo dataTransfer).
const UNEQUIP_TYPE = 'text/x-unequip-slot'

/**
 * Imagem de arraste custom — em vez do fantasma nativo do browser (um
 * recorte do próprio elemento HTML), desenha num canvas fora da tela o
 * mesmo desenho do `SlotPreview` (quadrado pra item, círculo pra criatura,
 * mesma cor por categoria via `getSlotColor`), pra ficar visualmente
 * coerente com o resto do HUD/inventário em vez de parecer arrastar um
 * pedaço de UI de navegador. `setDragImage` exige que o elemento esteja no
 * DOM no instante da chamada (mesmo invisível) — por isso o canvas é
 * anexado, usado, e removido logo em seguida (`setTimeout` 0: depois que o
 * browser já tirou o snapshot pro arraste).
 */
function createDragImage(kind, id) {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 40
  canvas.style.position = 'fixed'
  canvas.style.top = '-1000px'
  canvas.style.left = '-1000px'

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = getSlotColor(kind, id)
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

/** Uma entrada por id único de item (com a contagem da pilha, descontada a
 * unidade equipada — ver abaixo) + uma por criatura disponível e não
 * ocupando slot de time nenhum, preenchendo uma grade fixa de `GRID_SIZE`
 * — o resto fica vazio. Mesma simplificação já usada no `Party`: toda
 * espécie `kind: 'pokemon'` conta como "disponível", sem rastrear posse de
 * criatura de verdade ainda (sem sistema de captura).
 *
 * O que está equipado (mão ou time) some da grade — não fica em dois
 * lugares ao mesmo tempo. Pra item, isso é só a contagem visível caindo
 * uma unidade (o resto da pilha continua ali); pra criatura, é a entrada
 * inteira sumindo (não há pilha, é presença/ausência). `heldItemId`/
 * `equippedSpeciesIds` são lidos de `HeldItem`/`Party` no momento da
 * renderização — a grade recalcula sozinha a cada equipar/desequipar. */
function buildSlots(inventory, heldItemId, equippedSpeciesIds) {
  const uniqueItemIds = [...new Set(inventory.itemIds)]
  const itemEntries = uniqueItemIds
    .map((itemId) => {
      const total = inventory.itemIds.filter(
        (candidate) => candidate === itemId,
      ).length
      const count = itemId === heldItemId ? total - 1 : total
      return { kind: 'item', id: itemId, count }
    })
    .filter((entry) => entry.count > 0)

  const creatureEntries = CREATURE_SPECIES.filter(
    (species) => !equippedSpeciesIds.includes(species.id),
  ).map((species) => ({
    kind: 'creature',
    id: species.id,
  }))

  const entries = [...itemEntries, ...creatureEntries]
  return Array.from({ length: GRID_SIZE }, (_, index) => entries[index] ?? null)
}

/**
 * Inventário — único lugar que equipa mão principal/time (ver
 * docs/features/018-preview-de-equipamento-no-inventario.md, revisado em
 * docs/features/019-drag-and-drop-no-inventario.md: equipar agora é por
 * arrastar, não clicar). Grade 5x5 à esquerda com tudo que o jogador tem:
 * itens (`Inventory`) e criaturas disponíveis (mesma lista do `Party`).
 * Sem ícone/modelo de verdade ainda: item vira um quadrado colorido por
 * categoria (com a quantidade, sempre visível); criatura vira uma esfera
 * na cor dela (`CREATURE_TINTS`, compartilhado com a renderização 3D em
 * `view/scene/CreatureView.jsx`).
 *
 * À direita, um preview do jogador com os slots de equipamento ao redor
 * (`EquipmentPreview`) — arrastar um item/criatura da grade até um slot
 * equipa ali, com o slot mudando de cor durante o arraste conforme é
 * compatível (item só na mão, criatura só no time) ou não. E o inverso
 * também funciona: arrastar de um slot de equipamento já ocupado de volta
 * pra grade desequipa (a grade inteira vira alvo de "soltar aqui pra
 * desequipar" nesse caso, mesmo sinal visual verde/vermelho — aqui sempre
 * verde, já que qualquer slot ocupado pode ser desequipado).
 *
 * O que está equipado não continua listado na grade (ver `buildSlots`) —
 * só existe em um lugar de cada vez, igual peguei/larguei de verdade.
 */
export function InventoryPanel() {
  const inventory = useTrait(playerEntity, Inventory)
  const party = useTrait(playerEntity, Party)
  const heldItem = useTrait(playerEntity, HeldItem)
  const [unequipHover, setUnequipHover] = useState(false)

  if (!inventory || !party || !heldItem) return null

  const equippedSpeciesIds = PARTY_SLOTS.map((slot) => party[slot]).filter(
    Boolean,
  )
  const slots = buildSlots(inventory, heldItem.itemId, equippedSpeciesIds)

  const handleGridDragOver = (event) => {
    if (!event.dataTransfer.types.includes(UNEQUIP_TYPE)) return
    event.preventDefault()
    setUnequipHover(true)
  }

  const handleGridDrop = (event) => {
    if (!event.dataTransfer.types.includes(UNEQUIP_TYPE)) return
    event.preventDefault()
    setUnequipHover(false)
    const originId = event.dataTransfer.getData(UNEQUIP_TYPE)
    if (!originId) return
    if (originId === 'hand') {
      playerEntity.set(HeldItem, { itemId: null })
    } else {
      equiparCriatura(playerEntity, originId, null)
    }
  }

  return (
    <div className="flex gap-3">
      <div
        onDragOver={handleGridDragOver}
        onDragLeave={() => setUnequipHover(false)}
        onDrop={handleGridDrop}
        className={`grid grid-cols-5 gap-1 rounded p-1 transition-colors ${
          unequipHover ? 'bg-emerald-900/40' : ''
        }`}
      >
        {slots.map((entry, index) => (
          <InventorySlot key={index} entry={entry} />
        ))}
      </div>

      <EquipmentPreview heldItem={heldItem} party={party} />
    </div>
  )
}

/** Uma célula da grade — fonte de arraste (pra equipar). Enquanto o
 * próprio arraste dela está em andamento, fica `invisible` (some do lugar
 * de origem, mas mantém o espaço reservado na grade — sem isso a grade
 * "pularia" célula durante o arraste): o único lugar em que o item
 * continua visível nesse instante é a imagem de arraste sob o cursor
 * (`createDragImage`). Some pra valer (não volta a ficar visível) se o
 * drop terminar em equipar — `buildSlots` já não vai incluir mais essa
 * entrada na próxima renderização. */
function InventorySlot({ entry }) {
  const [dragging, setDragging] = useState(false)

  if (!entry) {
    return (
      <div className="aspect-square rounded border border-dashed border-white/10" />
    )
  }

  const handleDragStart = (event) => {
    event.dataTransfer.setData(DRAG_TYPE[entry.kind], entry.id)
    event.dataTransfer.effectAllowed = 'copy'
    const dragImage = createDragImage(entry.kind, entry.id)
    event.dataTransfer.setDragImage(dragImage, 20, 20)
    setTimeout(() => dragImage.remove(), 0)
    // Esconder a origem só no próximo tick, não aqui dentro: o browser
    // cancela o arraste na hora se o elemento de origem some (mesmo só
    // `visibility: hidden`) antes do drag terminar de "pegar o instantâneo"
    // — sumir cedo demais é o que fazia o próprio arraste nem começar.
    setTimeout(() => setDragging(true), 0)
  }

  const handleDragEnd = () => setDragging(false)

  const visibilityClass = dragging ? 'invisible' : ''

  if (entry.kind === 'creature') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title={entry.id}
        className={`flex aspect-square cursor-grab flex-col items-center justify-center gap-0.5 rounded border border-white/20 bg-black/40 p-1 hover:border-white/50 active:cursor-grabbing ${visibilityClass}`}
      >
        <SlotPreview kind="creature" id={entry.id} />
        <span className="w-full truncate text-center text-[8px] text-white/70">
          {entry.id}
        </span>
      </div>
    )
  }

  const item = getItem(entry.id)

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={`${entry.id} (${item?.category}) x${entry.count}`}
      className={`flex aspect-square cursor-grab flex-col items-center justify-center gap-0.5 rounded border border-white/20 bg-black/40 p-1 hover:border-white/50 active:cursor-grabbing ${visibilityClass}`}
    >
      <SlotPreview kind="item" id={entry.id} count={entry.count} />
      <span className="w-full truncate text-center text-[8px] text-white/70">
        {entry.id}
      </span>
    </div>
  )
}

/** Preview do jogador com os slots de equipamento ao redor: time (3) em
 * cima, mão principal embaixo. Cada slot é um alvo de "soltar" — arrastar
 * um item/criatura da grade até aqui equipa ali. Atualiza ao vivo junto
 * com `HeldItem`/`Party` (mesmos traits que o drop escreve). */
function EquipmentPreview({ heldItem, party }) {
  return (
    <div className="flex w-44 shrink-0 flex-col items-center gap-2">
      <div className="flex gap-1">
        {PARTY_SLOTS.map((slot) => (
          <EquippedSlot
            key={slot}
            kind="creature"
            id={party[slot]}
            originId={slot}
            label={slot.replace('slot', '')}
            onEquip={(speciesId) =>
              equiparCriatura(playerEntity, slot, speciesId)
            }
          />
        ))}
      </div>
      <PlayerPreview />
      <EquippedSlot
        kind="item"
        id={heldItem.itemId}
        originId="hand"
        label="mão"
        onEquip={(itemId) => playerEntity.set(HeldItem, { itemId })}
      />
    </div>
  )
}

/** Um slot de equipamento — alvo de drop, e (quando ocupado) também fonte
 * de arraste, pra permitir desequipar (arrastar pra fora, soltar na grade
 * do inventário — ver `InventoryPanel`). `kind` decide o tipo aceito como
 * alvo (`item` só na mão, `creature` só no time); durante o arraste, o
 * slot fica verde se o que está sendo arrastado é compatível, vermelho se
 * não (`dragover` só enxerga o *tipo* MIME, não o valor — dá pra saber a
 * categoria sem saber ainda qual item/criatura é). Só aceita o drop de
 * verdade (`preventDefault`) quando compatível — senão o browser já mostra
 * o cursor de "não pode soltar aqui" sozinho.
 *
 * `originId` (`'hand'` ou o nome do slot de time) só é usado como fonte —
 * é o valor gravado em `UNEQUIP_TYPE`, pra grade saber qual slot limpar ao
 * soltar ali. Igual à célula da grade (`InventorySlot`), enquanto o
 * próprio arraste pra fora está em andamento o preview some daqui —
 * continua só na imagem de arraste sob o cursor. */
function EquippedSlot({ kind, id, originId, label, onEquip }) {
  const [dragStatus, setDragStatus] = useState(null)
  const [dragging, setDragging] = useState(false)
  const expectedType = DRAG_TYPE[kind]

  const handleDragOver = (event) => {
    if (event.dataTransfer.types.includes(expectedType)) {
      event.preventDefault()
      setDragStatus('compatible')
    } else {
      setDragStatus('incompatible')
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragStatus(null)
    const droppedId = event.dataTransfer.getData(expectedType)
    if (droppedId) onEquip(droppedId)
  }

  const handleDragStart = (event) => {
    event.dataTransfer.setData(expectedType, id)
    event.dataTransfer.setData(UNEQUIP_TYPE, originId)
    event.dataTransfer.effectAllowed = 'move'
    const dragImage = createDragImage(kind, id)
    event.dataTransfer.setDragImage(dragImage, 20, 20)
    setTimeout(() => dragImage.remove(), 0)
    // Mesmo motivo do InventorySlot: esconder de imediato cancela o
    // próprio arraste em vez de só disfarçar a origem.
    setTimeout(() => setDragging(true), 0)
  }

  const handleDragEnd = () => setDragging(false)

  const statusClass =
    dragStatus === 'compatible'
      ? 'border-emerald-400 bg-emerald-900/50'
      : dragStatus === 'incompatible'
        ? 'border-red-500 bg-red-900/50'
        : 'border-white/20 bg-black/40'

  return (
    <div
      draggable={Boolean(id)}
      onDragStart={id ? handleDragStart : undefined}
      onDragEnd={id ? handleDragEnd : undefined}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragStatus(null)}
      onDrop={handleDrop}
      className={`flex w-14 flex-col items-center gap-0.5 rounded border p-1 transition-colors ${statusClass} ${id ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <span className="text-[9px] text-white/50">{label}</span>
      {id && !dragging ? (
        <SlotPreview kind={kind} id={id} />
      ) : (
        <span className="h-5 w-5 rounded border border-dashed border-white/20" />
      )}
    </div>
  )
}
