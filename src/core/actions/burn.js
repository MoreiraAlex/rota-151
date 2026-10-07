import { getSpecies } from '../data/species'
import { resolveSpeciesTypes } from '../data/types'
import { Burn, BurnedBy, resolveCreatureSpeciesId } from '../traits'

/**
 * Queima `target` com o efeito `{ type: 'burn', chance, fraction, interval,
 * duration, attackMultiplier, immuneTypes }` de um golpe de `source`
 * (docs/features/039-tipos-e-combate-classico.md, Parte 4). Sorteia `chance`
 * (`rng`, sempre de fora — regra 3.5); alvo de um tipo em `immuneTypes` (ex.:
 * Fogo) não queima. Já queimado: RENOVA o tempo e os valores, mantém o ritmo
 * do próximo dano — mesma regra da semente.
 *
 * Devolve `null` se o efeito não for de queimadura; senão `true`/`false`
 * (queimou ou não).
 */
export function queimar(target, source, effect, rng) {
  if (effect?.type !== 'burn') return null
  if (isImmuneToBurn(target, effect)) return false
  if (rng() >= (effect.chance ?? 1)) return false

  const {
    fraction = 0,
    interval = 0,
    duration = 0,
    attackMultiplier = 1,
  } = effect
  if (target.has(Burn)) {
    target.set(Burn, {
      timeLeft: duration,
      fraction,
      interval,
      attackMultiplier,
    })
  } else {
    target.add(
      Burn({
        timeLeft: duration,
        tickTimer: interval,
        fraction,
        interval,
        attackMultiplier,
      }),
    )
  }
  if (source?.isAlive?.()) target.add(BurnedBy(source))
  return true
}

function isImmuneToBurn(target, effect) {
  if (!effect.immuneTypes?.length) return false
  const species = getSpecies(resolveCreatureSpeciesId(target))
  return resolveSpeciesTypes(species).some((type) =>
    effect.immuneTypes.includes(type),
  )
}

/**
 * Multiplicador do Ataque de quem está queimado (`Burn.attackMultiplier`);
 * `1` sem queimadura. Só vale pra golpe físico — quem decide é
 * `computeDamage`.
 */
export function readBurnAttackMultiplier(entity) {
  return entity?.get?.(Burn)?.attackMultiplier ?? 1
}

/**
 * Quanto um tick tira (HP inteiro): `fraction` do HP máximo, nunca menos que
 * 1 nem mais que o HP que sobra — mesma conta da semente.
 */
export function resolveBurnDamage(vitals, fraction) {
  const amount = Math.max(1, Math.floor(vitals.maxHp * fraction))
  return Math.min(amount, vitals.hp)
}
