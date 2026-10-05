import { GAME_CONFIG } from '../gameConfig'
import { abrirMenuDeAcoes, isPartyMenuOpen } from '../actions/partyActionMenu'
import { InputControlled, Party, SlotHold } from '../traits'

// Tecla de slot (Q/E/R) → slot do time — mesma correspondência do
// `partySummonSystem.js`.
const SLOT_KEYS = [
  { input: 'secondary1', slot: 'slot1' },
  { input: 'secondary2', slot: 'slot2' },
  { input: 'secondary3', slot: 'slot3' },
]

// Flags de ação bloqueadas com uma tela treinador↔Pokémon aberta (menu de
// ações, "esquecer qual golpe?") — o jogador está escolhendo no menu.
const MENU_BLOCKED_FLAGS = [
  'primary',
  'jump',
  'dash',
  'secondary1',
  'secondary2',
  'secondary3',
  'secondary1Held',
  'secondary2Held',
  'secondary3Held',
]

/**
 * Toque × segurar em Q/E/R no modo treinador (docs/features/038-aprendizado-
 * treino-e-dominio-de-golpes.md):
 * - TOQUE (soltar antes de `MOVES.ACTION_MENU_HOLD_TIME`) → o pulso
 *   `secondaryN` sai no tick em que SOLTA, e o `partySummonSystem` invoca/
 *   recolhe como sempre;
 * - SEGURAR até o tempo → abre o menu de ações da criatura daquele slot
 *   (`abrirMenuDeAcoes`) e o soltar não invoca nada.
 *
 * Reescreve `context.input` antes da simulação (mesmo jeito do bloqueio do
 * Scan, `inputSystem.js`): o pulso de APERTO de `secondaryN` é engolido e
 * reaparece no soltar. Só com o TREINADOR no controle — pilotando uma
 * criatura, Q/E/R continuam sendo golpes no aperto.
 *
 * Com uma tela treinador↔Pokémon aberta (`isPartyMenuOpen`), zera as flags de
 * ação (`MENU_BLOCKED_FLAGS`).
 *
 * Headless. Fase: input, depois do `inputSystem`.
 */
export function partyActionMenuInputSystem(context) {
  const { world, delta } = context
  const input = context.input
  if (!input) return

  const trainer = world.queryFirst(Party, SlotHold)
  if (!trainer) return

  if (isPartyMenuOpen(trainer)) {
    for (const flag of MENU_BLOCKED_FLAGS) input[flag] = false
    trainer.set(SlotHold, {
      secondary1: 0,
      secondary2: 0,
      secondary3: 0,
      secondary1Opened: true,
      secondary2Opened: true,
      secondary3Opened: true,
    })
    return
  }

  if (!trainer.has(InputControlled)) {
    resetHold(trainer)
    return
  }

  const hold = { ...trainer.get(SlotHold) }
  const { ACTION_MENU_HOLD_TIME } = GAME_CONFIG.MOVES
  let menuSlot = null

  for (const { input: key, slot } of SLOT_KEYS) {
    const pressed = !!input[key]
    const held = !!input[`${key}Held`]
    const openedKey = `${key}Opened`
    input[key] = false

    if (held) {
      // Aperto novo: começa a contar do zero.
      if (pressed) {
        hold[key] = 0
        hold[openedKey] = false
      }
      hold[key] += delta
      if (!hold[openedKey] && hold[key] >= ACTION_MENU_HOLD_TIME) {
        hold[openedKey] = true
        menuSlot ??= slot
      }
      continue
    }

    // Soltou (ou apertou e soltou entre dois ticks): toque, se o segurar
    // ainda não tinha aberto o menu.
    const wasHolding = hold[key] > 0 || pressed
    if (wasHolding && !hold[openedKey]) input[key] = true
    hold[key] = 0
    hold[openedKey] = false
  }

  trainer.set(SlotHold, hold)
  if (menuSlot) abrirMenuDeAcoes(trainer, menuSlot)
}

function resetHold(trainer) {
  trainer.set(SlotHold, {
    secondary1: 0,
    secondary2: 0,
    secondary3: 0,
    secondary1Opened: false,
    secondary2Opened: false,
    secondary3Opened: false,
  })
}
