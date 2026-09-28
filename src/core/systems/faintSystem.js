import { acordar, desmaiar, resolveReviveHp } from '../actions/faint'
import {
  Fainted,
  PartyFaint,
  PartyVitals,
  SummonedCreature,
  Vitals,
  WildCreature,
} from '../traits'

const PARTY_SLOTS = ['slot1', 'slot2', 'slot3']

/**
 * Desmaio das criaturas (selvagens e do time em campo) — ver `Fainted`:
 * 1. quem chegou a 0 de HP neste tick (golpe do `creatureAttackSystem.js`)
 *    desmaia (`desmaiar`);
 * 2. a contagem de quem está desmaiado em campo corre, e quem zera acorda
 *    (`acordar`) — pra selvagem, é o caminho normal; a do time costuma ser
 *    recolhida antes (`partySummonSystem.js`, `PARTY_RECALL_DELAY`);
 * 3. a contagem da do time já recolhida corre no treinador (`PartyFaint`)
 *    — zerou, reanima dentro da bola: o slot volta a `null` e a vida
 *    guardada (`PartyVitals`) vira o HP de quem acorda, sem o atraso de
 *    regeneração (dali, regenera na bola como qualquer outra).
 *
 * O treinador não desmaia (fora do escopo por enquanto).
 *
 * Trocas de trait fora das queries (mudam as próprias queries iteradas).
 *
 * Headless. Fase: simulation, logo depois do `creatureAttackSystem` (quem
 * zerou já desmaia no mesmo tick do golpe) e antes do `partySummonSystem`
 * (que recolhe a do time desmaiada).
 */
export function faintSystem(context) {
  const { world, delta } = context

  const fainting = []
  world.query(Vitals).readEach(([vitals], entity) => {
    if (vitals.hp > 0 || entity.has(Fainted)) return
    if (!entity.has(WildCreature) && !entity.has(SummonedCreature)) return
    fainting.push(entity)
  })
  for (const entity of fainting) desmaiar(world, entity)

  const waking = []
  world.query(Fainted).updateEach(([fainted], entity) => {
    fainted.timeLeft -= delta
    fainted.elapsed += delta
    if (fainted.timeLeft <= 0) waking.push(entity)
  })
  for (const entity of waking) acordar(entity)

  const revived = []
  world.query(PartyFaint).updateEach(([partyFaint], trainer) => {
    for (const slot of PARTY_SLOTS) {
      const state = partyFaint[slot]
      if (!state) continue
      const timeLeft = state.timeLeft - delta
      if (timeLeft > 0) {
        partyFaint[slot] = { timeLeft }
      } else {
        partyFaint[slot] = null
        revived.push({ trainer, slot })
      }
    }
  })
  for (const { trainer, slot } of revived) reviveInBall(trainer, slot)
}

/**
 * HP de quem acorda na vida guardada do slot (`PartyVitals`). Sem nada
 * guardado (não deveria acontecer — `applyRecall` sempre guarda), não faz
 * nada: sai cheia.
 */
function reviveInBall(trainer, slot) {
  const stored = trainer.get(PartyVitals)?.[slot]
  if (!stored) return
  trainer.set(PartyVitals, {
    [slot]: { ...stored, hp: resolveReviveHp(stored.maxHp), hpRegenDelay: 0 },
  })
}

/**
 * Se a criatura do time daquele slot está desmaiada (recolhida, contando
 * pra reanimar) — não pode ser invocada. `trainer` sem `PartyFaint`
 * (testes antigos) conta como ninguém desmaiado.
 */
export function isPartySlotFainted(trainer, slot) {
  return (trainer?.get(PartyFaint)?.[slot]?.timeLeft ?? 0) > 0
}
