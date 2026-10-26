import { relation, trait } from 'koota'

/**
 * Condições ativas nesta criatura (docs/features/061-revisao-das-skills.md,
 * "Condições padronizadas") — uma entrada por condição, todas somando:
 *
 * - `id` — a condição (`core/data/conditions/<id>/`).
 * - `timeLeft` — segundos até acabar (renovado ao aplicar de novo).
 * - `tickTimer` — segundos até o próximo tick (o 1º é `interval` depois de
 *   aplicar, como o fim de turno do Pokémon).
 * - `fraction`/`interval`/`to` — o tick (`to`: `null` ou `'source'`);
 *   `interval` 0 = sem tick.
 * - `modifiers` — atributo → multiplicador enquanto dura.
 *
 * Os valores são copiados da condição (com o que o golpe troca) no momento
 * de aplicar. Quem aplicou é a relação de `conditionSource(id)`, não um
 * campo: se quem aplicou some, o Koota tira a relação sozinho e a condição
 * CONTINUA, só sem crédito nem cura.
 *
 * Trait AoS (a lista é do objeto). Dono de escrita: `aplicarCondicao`
 * (`core/actions/conditions.js`) cria e renova; `conditionSystem.js` conta
 * o tempo e remove.
 */
export const Conditions = trait(() => ({ list: [] }))

const sources = new Map()

/**
 * A relação "quem aplicou a condição `id`" (regra do projeto pra ligação
 * entre entidades, `docs/rules/README.md`). Uma por condição — cada uma com
 * o seu dono —, `exclusive`: aplicar de novo troca quem leva o crédito.
 * Criada na primeira vez que é pedida.
 */
export function conditionSource(id) {
  if (!sources.has(id)) sources.set(id, relation({ exclusive: true }))
  return sources.get(id)
}
