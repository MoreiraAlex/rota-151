/**
 * Tipos do impacto GENÉRICO de golpe — partilhados pelo visual (grupo
 * `'impact'`, `view/vfx/impactVfx.js`) e pelo som (grupo `'impact'`,
 * `core/data/audio/attackSound.js`), pra os dois escolherem sempre o mesmo
 * tipo. Mesma lista dos 18 tipos do Cobblemon (partículas `impact_<tipo>`,
 * eventos de som `impact.<tipo>`).
 */
export const IMPACT_TYPES = [
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'fairy',
  'steel',
]

/** Tipo válido (`'fire'`...) ou `'normal'` pra desconhecido/vazio/`null`. */
export function resolveImpactType(type) {
  return IMPACT_TYPES.includes(type) ? type : 'normal'
}

/**
 * Tipo de impacto de um ataque resolvido: `visual.impactType`, senão
 * `damage.type` (reservado pro STAB, hoje `null`), senão `'normal'`.
 */
export function resolveAttackImpactType(attack) {
  return resolveImpactType(attack?.visual?.impactType ?? attack?.damage?.type)
}
