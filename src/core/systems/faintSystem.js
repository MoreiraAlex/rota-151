import { acordar, desmaiar, resolveReviveHp } from '../actions/faint'
import { distribuirExperiencia } from '../actions/experience'
import { creatureFainted } from '../events'
import {
  BeingCaptured,
  Fainted,
  StoredFaint,
  StoredVitals,
  SummonedCreature,
  Vitals,
  WildCreature,
  resolveCreatureSpeciesId,
} from '../traits'

/**
 * Desmaio das criaturas (selvagens e do time em campo) — ver `Fainted`:
 * 1. quem chegou a 0 de HP neste tick (golpe do `creatureAttackSystem.js`)
 *    desmaia (`desmaiar`, evento `creatureFainted`); se é selvagem, quem lutou contra ela ganha XP
 *    (`distribuirExperiencia`, docs/features/037-experiencia-e-nivel.md);
 * 2. a contagem de quem está desmaiado em campo corre, e quem zera acorda
 *    (`acordar`) — pra selvagem, é o caminho normal; a do time costuma ser
 *    recolhida antes (`partySummonSystem.js`, `PARTY_RECALL_DELAY`);
 * 3. a contagem de quem foi recolhido desmaiado corre no registro do Pokémon
 *    (`StoredFaint`), esteja ele no time ou no inventário — zerou, reanima
 *    fora de campo: o trait sai e a vida guardada (`StoredVitals`) vira o HP
 *    de quem acorda, sem o atraso de regeneração (dali, regenera como
 *    qualquer outro).
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
  const { world, delta, events } = context

  const fainting = []
  world.query(Vitals).readEach(([vitals], entity) => {
    if (vitals.hp > 0 || entity.has(Fainted)) return
    if (!entity.has(WildCreature) && !entity.has(SummonedCreature)) return
    fainting.push(entity)
  })
  for (const entity of fainting) {
    desmaiar(world, entity)
    events?.emit(
      creatureFainted({ entity, speciesId: resolveCreatureSpeciesId(entity) }),
    )
    if (entity.has(WildCreature)) distribuirExperiencia(world, events, entity)
  }

  const waking = []
  world.query(Fainted).updateEach(([fainted], entity) => {
    // Dentro de uma Pokébola (docs/features/043-captura.md) não acorda: o
    // escape acorda ele (`selvagemEscapou`).
    if (entity.has(BeingCaptured)) return
    fainted.timeLeft -= delta
    fainted.elapsed += delta
    if (fainted.timeLeft <= 0) waking.push(entity)
  })
  for (const entity of waking) acordar(entity)

  const revived = []
  world.query(StoredFaint).updateEach(([stored], pokemon) => {
    stored.timeLeft -= delta
    if (stored.timeLeft <= 0) revived.push(pokemon)
  })
  for (const pokemon of revived) reviveOutOfField(pokemon)
}

/**
 * Tira o desmaio do registro e põe o HP de quem acorda na vida guardada
 * (`StoredVitals`). Sem nada guardado (não deveria acontecer — `applyRecall`
 * sempre guarda), sai cheio.
 */
function reviveOutOfField(pokemon) {
  pokemon.remove(StoredFaint)
  const stored = pokemon.get(StoredVitals)?.vitals
  if (!stored) return
  pokemon.set(StoredVitals, {
    vitals: {
      ...stored,
      hp: resolveReviveHp(stored.maxHp),
      hpRegenDelay: 0,
    },
  })
}
