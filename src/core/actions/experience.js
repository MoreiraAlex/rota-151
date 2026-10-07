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
import { resolveOwner } from './owner'
import {
  findSummonedCreature,
  isPokemonFainted,
  resolvePokemonOf,
  resolvePokemonSpeciesId,
} from './pokemon'
import {
  CreatureLevel,
  Fainted,
  FoughtBy,
  IndividualValues,
  StoredVitals,
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
 *    Pokémon do time a acertou (o registro, `Pokemon`);
 * 2. `distribuirExperiencia` — no desmaio dela, divide o XP entre os
 *    participantes ainda de pé;
 * 3. `ganharExperiencia` — soma o XP no registro (e na criatura em campo)
 *    e, se o nível mudou, `subirDeNivel`.
 */

/**
 * A criatura do time `attacker` causou dano na selvagem `target` — guarda o
 * registro dela em `FoughtBy`. Qualquer outra dupla (selvagem batendo no
 * time, treinador) não faz nada.
 */
export function registrarParticipante(world, attacker, target) {
  if (!target?.isAlive?.() || !target.has(WildCreature)) return
  if (!attacker?.isAlive?.() || !attacker.has(SummonedCreature)) return
  const pokemon = resolvePokemonOf(attacker)
  if (!pokemon || target.has(FoughtBy(pokemon))) return
  target.add(FoughtBy(pokemon))
}

/**
 * A selvagem `defeated` desmaiou: os Pokémon que lutaram contra ela
 * (`FoughtBy`) ganham XP — só os que não estão desmaiados. O XP é dividido
 * igualmente entre eles (`participants` na fórmula), e cada um escala pelo
 * próprio nível.
 */
export function distribuirExperiencia(world, events, defeated) {
  const defeatedSpecies = getSpecies(defeated.get(WildCreature)?.speciesId)
  const defeatedLevel = resolveEntityLevel(defeated, defeatedSpecies)
  const baseXp = resolveBaseXp(defeatedSpecies)

  const winners = defeated
    .targetsFor(FoughtBy)
    .filter((pokemon) => canReceiveExperience(world, pokemon))
  for (const pokemon of winners) {
    const amount = calculateExperienceGain({
      baseXp,
      defeatedLevel,
      winnerLevel: pokemon.get(CreatureLevel).level,
      participants: winners.length,
    })
    ganharExperiencia(world, events, pokemon, amount)
  }
  defeated.remove(FoughtBy('*'))
}

/** O registro existe, tem nível, e não está desmaiado (na bola nem em campo). */
function canReceiveExperience(world, pokemon) {
  if (!pokemon?.isAlive() || !pokemon.has(CreatureLevel)) return false
  if (isPokemonFainted(pokemon)) return false
  return !findSummonedCreature(world, pokemon)?.has(Fainted)
}

/**
 * Soma `amount` de XP no `pokemon` (teto: o XP do nível máximo) — no
 * registro e, se ele está em campo, no `CreatureLevel` da criatura. Se o
 * nível mudou, `subirDeNivel`. Emite `experienceGained` (e `leveledUp`).
 */
export function ganharExperiencia(world, events, pokemon, amount) {
  const progress = pokemon?.get?.(CreatureLevel)
  const species = getSpecies(resolvePokemonSpeciesId(pokemon))
  if (!progress || !species || !(amount > 0)) return

  const growthRate = resolveGrowthRate(species)
  const maxXp = experienceForLevel(growthRate, GAME_CONFIG.EXPERIENCE.MAX_LEVEL)
  const xp = Math.min(maxXp, progress.xp + amount)
  const level = levelForExperience(growthRate, xp)
  const fromLevel = progress.level

  pokemon.set(CreatureLevel, { level, xp })
  const creature = findSummonedCreature(world, pokemon)
  if (creature) creature.set(CreatureLevel, { level, xp })

  const trainer = resolveOwner(pokemon)
  events?.emit(experienceGained({ trainer, pokemon, creature, amount }))
  if (level === fromLevel) return

  subirDeNivel(pokemon, creature, species, fromLevel, level)
  events?.emit(leveledUp({ trainer, pokemon, creature, fromLevel, level }))
  anunciarGolpesAptos(events, pokemon, creature, fromLevel, level)
}

/**
 * Subiu de `fromLevel` pra `level`: o HP e a energia MÁXIMOS saem da conta
 * nova, e os atuais sobem o mesmo tanto que o máximo subiu (decisão do
 * usuário, como no Pokémon) — na criatura em campo (`Vitals`) e na vida
 * guardada fora de campo (`StoredVitals`; `null` = cheia, continua cheia). Os
 * custos de movimento também acompanham o nível. Os demais status não são
 * guardados — saem do nível na hora em que são lidos.
 */
export function subirDeNivel(pokemon, creature, species, fromLevel, level) {
  const individualValues = pokemon.get(IndividualValues) ?? null
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
  const stored = pokemon.get(StoredVitals)?.vitals
  if (stored) {
    pokemon.set(StoredVitals, { vitals: growVitals(stored, growth) })
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
