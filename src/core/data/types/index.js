/**
 * Tipos elementais de criaturas e golpes — a tabela da Gen 1 (15 tipos, com
 * as esquisitices dela: Fantasma não afeta Psíquico, Gelo neutro contra Fogo,
 * Inseto e Veneno super efetivos um no outro). Decisão do usuário
 * (docs/features/039-tipos-e-combate-classico.md): multiplicadores clássicos
 * escritos na própria tabela.
 *
 * Não confundir com `IMPACT_TYPES` (`../impactTypes.js`): aquela lista (18
 * tipos, do Cobblemon) só escolhe partícula/som do impacto genérico.
 *
 * `name`/`color` são pra HUD, menus e wiki.
 */
export const TYPES = {
  normal: { id: 'normal', name: 'Normal', color: '#a8a878' },
  fire: { id: 'fire', name: 'Fogo', color: '#f08030' },
  water: { id: 'water', name: 'Água', color: '#6890f0' },
  electric: { id: 'electric', name: 'Elétrico', color: '#f8d030' },
  grass: { id: 'grass', name: 'Planta', color: '#78c850' },
  ice: { id: 'ice', name: 'Gelo', color: '#98d8d8' },
  fighting: { id: 'fighting', name: 'Lutador', color: '#c03028' },
  poison: { id: 'poison', name: 'Veneno', color: '#a040a0' },
  ground: { id: 'ground', name: 'Terra', color: '#e0c068' },
  flying: { id: 'flying', name: 'Voador', color: '#a890f0' },
  psychic: { id: 'psychic', name: 'Psíquico', color: '#f85888' },
  bug: { id: 'bug', name: 'Inseto', color: '#a8b820' },
  rock: { id: 'rock', name: 'Pedra', color: '#b8a038' },
  ghost: { id: 'ghost', name: 'Fantasma', color: '#705898' },
  dragon: { id: 'dragon', name: 'Dragão', color: '#7038f8' },
}

/** Tipo de quem não declara nenhum (golpe sem `type`). */
export const DEFAULT_TYPE = 'normal'

/**
 * Efetividade: tipo do GOLPE → tipo do DEFENSOR → multiplicador. Par ausente
 * = neutro.
 */
export const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0 },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
  },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
  },
  ice: { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2 },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
  },
  poison: { grass: 2, poison: 0.5, ground: 0.5, bug: 2, rock: 0.5, ghost: 0.5 },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
  },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5 },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 2,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
  },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2 },
  ghost: { normal: 0, psychic: 0, ghost: 2 },
  dragon: { dragon: 2 },
}

export function getType(id) {
  return TYPES[id] ?? null
}

export function listTypes() {
  return Object.values(TYPES)
}

/** Tipo do golpe (`skill.type`); sem tipo, `DEFAULT_TYPE`. */
export function resolveSkillType(skill) {
  return skill?.type ?? DEFAULT_TYPE
}

/** Tipos da espécie (`species.types`, 1 ou 2); sem, `[]` (neutra). */
export function resolveSpeciesTypes(species) {
  return species?.types ?? []
}

/** Multiplicador de UM tipo de golpe contra UM tipo de defensor. */
export function resolveTypeMultiplier(attackType, defenderType) {
  if (!attackType || !defenderType) return 1
  return TYPE_CHART[attackType]?.[defenderType] ?? 1
}

/**
 * Categoria de um multiplicador já combinado — pro feedback ("Super
 * efetivo!") e pra quem só precisa saber o "lado" do resultado.
 */
export function classifyEffectiveness(multiplier) {
  if (multiplier === 0) return 'immune'
  if (multiplier > 1) return 'super'
  if (multiplier < 1) return 'weak'
  return 'neutral'
}

/**
 * Efetividade de um tipo de golpe contra TODOS os tipos do defensor (produto
 * de cada um — Planta contra Fogo/Voador fica a fração das duas resistências).
 */
export function resolveTypeEffectiveness(attackType, defenderTypes) {
  const multiplier = (defenderTypes ?? []).reduce(
    (total, defenderType) =>
      total * resolveTypeMultiplier(attackType, defenderType),
    1,
  )
  return { multiplier, effectiveness: classifyEffectiveness(multiplier) }
}

/**
 * Golpe de STATUS: ignora a tabela (regra clássica), só a imunidade pontual
 * declarada na skill (`immuneTypes` — ex.: Leech Seed não pega em Planta).
 */
export function isImmuneToStatusSkill(skill, defenderTypes) {
  const immune = skill?.immuneTypes
  if (!immune?.length) return false
  return (defenderTypes ?? []).some((type) => immune.includes(type))
}
