import { resolveSkill } from '../data/skills'

/**
 * Qual ataque o `slot` de uma espécie dispara — o ponto único que HUDs,
 * mira, som, alvos, IA e `creatureAttackSystem` consultam:
 * - `'primary'` (mouse) → o ataque BÁSICO, único da espécie
 *   (`species.basicAttack`, definição completa em
 *   `core/data/species/<id>/basicAttack.js`);
 * - `'secondary1-3'` (Q/E/R) → a HABILIDADE de número 1-3 em
 *   `species.skills` (`skills: { 1: 'ember', 2: {...} }` — só a
 *   numeração, sem o prefixo do slot): referência ao registro
 *   compartilhado (`core/data/skills/`), com `{ id, overrides }` opcional
 *   — ver `resolveSkill`.
 *
 * `null` quando a espécie não tem nada nesse slot (ou não existe) — quem
 * chama trata como "sem ataque aqui", sem quebrar.
 */
export function resolveCreatureAttack(species, slot) {
  if (!species) return null
  if (slot === 'primary') return species.basicAttack ?? null
  return resolveSkill(species.skills?.[skillNumber(slot)])
}

const SKILL_SLOT_PREFIX = 'secondary'

/** `'secondary2'` → `2` (chave em `species.skills`); outro slot → `null`. */
function skillNumber(slot) {
  if (typeof slot !== 'string' || !slot.startsWith(SKILL_SLOT_PREFIX)) {
    return null
  }
  return Number(slot.slice(SKILL_SLOT_PREFIX.length))
}
