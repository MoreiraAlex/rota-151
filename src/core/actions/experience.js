import { getSpecies } from '../data/species'
import {
  calculateExperienceGain,
  experienceForLevel,
  levelForExperience,
  resolveBaseXp,
  resolveGrowthRate,
} from '../data/species/experience'
import { experienceGained, leveledUp } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import { anunciarGolpesAptos } from './moves'
import {
  CreatureLevel,
  Fainted,
  FoughtBy,
  Party,
  PartyFaint,
  PartyIndividualValues,
  PartyProgress,
  PartyVitals,
  SummonedCreature,
  Vitals,
  WildCreature,
  resolveEntityLevel,
  resolveMaxHp,
  resolveMaxStamina,
  resolveMovementCosts,
} from '../traits'

/**
 * Experiência e nível (docs/features/037-experiencia-e-nivel.md):
 * 1. `registrarParticipante` — no dano, marca na selvagem (`FoughtBy`) qual
 *    slot do time a acertou;
 * 2. `distribuirExperiencia` — no desmaio dela, divide o XP entre os
 *    participantes ainda de pé;
 * 3. `ganharExperiencia` — soma o XP no slot (e na criatura em campo) e,
 *    se o nível mudou, `subirDeNivel`.
 */

const PARTY_SLOTS = ['slot1', 'slot2', 'slot3']

/**
 * A criatura do time `attacker` causou dano na selvagem `target` — guarda o
 * slot dela em `FoughtBy` (relação pro treinador). Qualquer outra dupla
 * (selvagem batendo no time, treinador) não faz nada.
 */
export function registrarParticipante(world, attacker, target) {
  if (!target?.isAlive?.() || !target.has(WildCreature)) return
  if (!attacker?.isAlive?.() || !attacker.has(SummonedCreature)) return
  const trainer = world.queryFirst(Party)
  if (!trainer) return

  const { slot } = attacker.get(SummonedCreature)
  if (target.has(FoughtBy(trainer))) {
    target.set(FoughtBy(trainer), { [slot]: true })
  } else {
    target.add(FoughtBy(trainer, { [slot]: true }))
  }
}

/**
 * A selvagem `defeated` desmaiou: cada treinador que lutou contra ela
 * (`FoughtBy`) dá XP aos slots que causaram dano — só os que ainda têm
 * criatura e não estão desmaiados. O XP é dividido igualmente entre eles
 * (`participants` na fórmula), e cada um escala pelo próprio nível.
 */
export function distribuirExperiencia(world, events, defeated) {
  const defeatedSpecies = getSpecies(defeated.get(WildCreature)?.speciesId)
  const defeatedLevel = resolveEntityLevel(defeated, defeatedSpecies)
  const baseXp = resolveBaseXp(defeatedSpecies)

  for (const trainer of defeated.targetsFor(FoughtBy)) {
    if (!trainer.isAlive()) continue
    const fought = defeated.get(FoughtBy(trainer))
    const winners = PARTY_SLOTS.filter(
      (slot) => fought[slot] && canReceiveExperience(world, trainer, slot),
    )
    for (const slot of winners) {
      const amount = calculateExperienceGain({
        baseXp,
        defeatedLevel,
        winnerLevel: trainer.get(PartyProgress)[slot].level,
        participants: winners.length,
      })
      ganharExperiencia(world, events, trainer, slot, amount)
    }
  }
  defeated.remove(FoughtBy('*'))
}

/** O slot tem criatura, com progresso, e ela não está desmaiada. */
function canReceiveExperience(world, trainer, slot) {
  if (!trainer.get(Party)?.[slot]) return false
  if (!trainer.get(PartyProgress)?.[slot]) return false
  if ((trainer.get(PartyFaint)?.[slot]?.timeLeft ?? 0) > 0) return false
  const creature = findSummonedCreature(world, slot)
  return !creature?.has(Fainted)
}

/** A criatura em campo do `slot`, ou `null` se está na bola. */
/** A criatura em campo do slot do time (ou `null`, se está na bola). */
export function findSummonedCreature(world, slot) {
  let found = null
  world.query(SummonedCreature).readEach(([summoned], entity) => {
    if (summoned.slot === slot) found = entity
  })
  return found
}

/**
 * Soma `amount` de XP na criatura do `slot` (teto: o XP do nível máximo) —
 * no `PartyProgress` e, se ela está em campo, no `CreatureLevel` dela. Se o
 * nível mudou, `subirDeNivel`. Emite `experienceGained` (e `leveledUp`).
 */
export function ganharExperiencia(world, events, trainer, slot, amount) {
  const progress = trainer.get(PartyProgress)?.[slot]
  const species = getSpecies(trainer.get(Party)?.[slot])
  if (!progress || !species || !(amount > 0)) return

  const growthRate = resolveGrowthRate(species)
  const maxXp = experienceForLevel(growthRate, GAME_CONFIG.EXPERIENCE.MAX_LEVEL)
  const xp = Math.min(maxXp, progress.xp + amount)
  const level = levelForExperience(growthRate, xp)
  const fromLevel = progress.level

  trainer.set(PartyProgress, { [slot]: { level, xp } })
  const creature = findSummonedCreature(world, slot)
  if (creature) creature.set(CreatureLevel, { level, xp })

  events?.emit(experienceGained({ trainer, slot, creature, amount }))
  if (level === fromLevel) return

  subirDeNivel(trainer, slot, creature, species, fromLevel, level)
  events?.emit(leveledUp({ trainer, slot, creature, fromLevel, level }))
  anunciarGolpesAptos(events, trainer, slot, creature, fromLevel, level)
}

/**
 * Subiu de `fromLevel` pra `level`: o HP e a energia MÁXIMOS saem da conta
 * nova, e os atuais sobem o mesmo tanto que o máximo subiu (decisão do
 * usuário, como no Pokémon) — na criatura em campo (`Vitals`) e na vida
 * guardada na bola (`PartyVitals`; `null` = cheia, continua cheia). Os
 * custos de movimento também acompanham o nível. Os demais status não são
 * guardados — saem do nível na hora em que são lidos.
 */
export function subirDeNivel(
  trainer,
  slot,
  creature,
  species,
  fromLevel,
  level,
) {
  const individualValues = trainer.get(PartyIndividualValues)?.[slot] ?? null
  const growth = {
    hp:
      resolveMaxHp(species, individualValues, level) -
      resolveMaxHp(species, individualValues, fromLevel),
    stamina:
      resolveMaxStamina(species, individualValues, level) -
      resolveMaxStamina(species, individualValues, fromLevel),
    costs: resolveMovementCosts(species, level),
  }

  if (creature?.has(Vitals)) {
    creature.set(Vitals, growVitals(creature.get(Vitals), growth))
  }
  const stored = trainer.get(PartyVitals)?.[slot]
  if (stored) {
    trainer.set(PartyVitals, { [slot]: growVitals(stored, growth) })
  }
}

// Desmaiada (0 de HP) não acorda por subir de nível.
function growVitals(vitals, { hp, stamina, costs }) {
  return {
    ...vitals,
    maxHp: vitals.maxHp + hp,
    hp: vitals.hp > 0 ? vitals.hp + hp : vitals.hp,
    maxStamina: vitals.maxStamina + stamina,
    stamina: vitals.stamina + stamina,
    ...costs,
  }
}
