import { SummonedCreature } from './components/summonedCreature'
import { WildCreature } from './components/wildCreature'

/**
 * Id de espécie de uma criatura — selvagem OU do time, as duas únicas
 * fontes (nunca coexistem na mesma entidade). Mesma checagem de duas
 * fontes já duplicada em `view/scene/NameplateView.jsx`
 * (`resolveEntitySpecies`, privada, com um terceiro fallback pro
 * treinador que não se aplica aqui) e em `tools/shared/
 * resolveTargetSpecies.js` — centralizada aqui (`core/`) porque
 * `core/actions/scanning.js` (docs/features/033-*.md) também precisa
 * dela, e `core/` não pode importar de `tools/`.
 *
 * `entity` pode ser `undefined`/`null` (nenhum alvo) — devolve `null`,
 * mesmo fallback gracioso de sempre.
 */
export function resolveCreatureSpeciesId(entity) {
  if (!entity) return null
  return (
    entity.get(SummonedCreature)?.speciesId ??
    entity.get(WildCreature)?.speciesId ??
    null
  )
}
