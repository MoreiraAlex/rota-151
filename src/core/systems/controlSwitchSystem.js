import { InputControlled, CameraTarget, Party } from '../traits'
import { findSummoned } from './partySummonSystem'

// Correspondência de slot pro pulso de input de troca (ver
// docs/features/018-troca-de-controle-treinador-criatura.md — 1/2/3, não
// Q/E/R: essas continuam sendo invocar/recolher, ver keyboardInput.js).
const SLOT_SWITCH = [
  { input: 'switchSlot1', slot: 'slot1' },
  { input: 'switchSlot2', slot: 'slot2' },
  { input: 'switchSlot3', slot: 'slot3' },
]

/**
 * Move `InputControlled`/`CameraTarget` de quem está no controle agora pra
 * `target` — as duas tags sempre viajam juntas (controlar E ver pela
 * mesma entidade). Nunca destrói/cria nada, nem mexe em `Party`: é só uma
 * troca de QUEM está sendo pilotado, não invoca/recolhe (isso continua
 * sendo `partySummonSystem.js`, por Q/E/R). No-op se `target` já é quem
 * está no controle.
 */
function switchControlTo(world, target) {
  const current = world.queryFirst(InputControlled)
  if (!current || current === target) return
  current.remove(InputControlled, CameraTarget)
  target.add(InputControlled, CameraTarget)
}

/**
 * Troca de controle entre o treinador e uma `SummonedCreature` (ver
 * docs/features/018-troca-de-controle-treinador-criatura.md) — o resto do
 * motor já é genérico por trait, não por identidade fixa
 * (`characterPhysicsSystem`/`movementSystem`/`playerActionSystem`/
 * `aimAnchorSystem`/`creatureFollowSystem` todos agem sobre quem tem
 * `InputControlled` agora, seja quem for), então este system só precisa
 * decidir QUANDO mover a tag.
 *
 * Acha "o treinador" por `Party` (trait exclusivo dele, nenhuma criatura
 * tem) — não importa `playerEntity` de `core/world/world.js` de propósito,
 * isso quebraria os testes headless (`makeWorld()` cria sua própria
 * entidade, sem relação com o singleton do jogo real).
 *
 * `1/2/3` (`switchSlot1-3`) trocam pro slot correspondente SE já houver
 * uma criatura invocada nele (slot vazio ou sem criatura fora: no-op) —
 * funciona tanto do treinador pra uma criatura quanto direto de uma
 * criatura pra outra, sem precisar passar pelo treinador no meio. `4`
 * (`returnToBot`) sempre devolve o controle pro treinador; sem estar numa
 * criatura, é no-op (`switchControlTo` já filtra `current === target`).
 *
 * Headless. Fase: simulation, ANTES de todo o resto (cameraControlSystem,
 * movementSystem, aimAnchorSystem, partySummonSystem, playerActionSystem,
 * creatureFollowSystem, characterPhysicsSystem) — todos precisam ver a
 * troca já aplicada no mesmo tick em que ela acontece.
 */
export function controlSwitchSystem(context) {
  const { world } = context
  const input = context.input ?? {}
  const trainer = world.queryFirst(Party)
  if (!trainer) return

  if (input.returnToBot) {
    switchControlTo(world, trainer)
    return
  }

  for (const { input: key, slot } of SLOT_SWITCH) {
    if (!input[key]) continue
    const creature = findSummoned(world, slot)
    if (creature) switchControlTo(world, creature)
    break // só um switchSlotN processado por tick
  }
}
