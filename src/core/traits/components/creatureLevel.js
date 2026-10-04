import { relation, trait } from 'koota'

/**
 * Nível e XP total DESTA criatura (docs/features/037-experiencia-e-nivel.md)
 * — o nível deixou de ser da espécie (`species.level`, agora só o nível
 * inicial de quem entra no time): duas criaturas da mesma espécie podem ter
 * níveis diferentes. `xp` é o total acumulado (curva de
 * `core/data/species/experience.js`), não o do nível atual.
 *
 * Donos de escrita: `wildCreatureSpawnSystem.js` (sorteia no spawn),
 * `summonBallSystem.js` (copia de `PartyProgress` ao invocar) e
 * `ganharExperiencia` (`core/actions/experience.js`).
 */
export const CreatureLevel = trait({
  level: 1,
  xp: 0,
})

/**
 * Nível e XP de cada criatura do TIME, por slot, no treinador — fonte de
 * verdade da do time (a `SummonedCreature` é destruída/recriada a cada
 * recolher/invocar). Mesmo formato de `PartyIndividualValues` (um valor por
 * slot): `null` (slot vazio) ou `{ level, xp }`.
 *
 * Donos de escrita: `equiparCriatura` (cria com o nível inicial da espécie
 * ao trocar a criatura do slot) e `ganharExperiencia`.
 */
export const PartyProgress = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})

/**
 * Quem lutou contra esta criatura (selvagem): relação pro TREINADOR, com os
 * slots do time que causaram dano nela. Pro treinador (e não pra criatura
 * invocada) porque a do time pode ser recolhida no meio da luta e continua
 * tendo direito ao XP — a relação com a entidade dela sumiria junto.
 *
 * Vale até ela desmaiar — não limpa ao sair do modo combate (a selvagem
 * pacífica que só foge nem entra nele).
 *
 * Donos de escrita: `registrarParticipante` (`core/actions/experience.js`,
 * no dano) adiciona; `distribuirExperiencia` (no desmaio) limpa.
 */
export const FoughtBy = relation({
  store: { slot1: false, slot2: false, slot3: false },
})

/**
 * Nível de uma entidade: o `CreatureLevel` dela; sem ele (treinador, testes
 * antigos), o `species.level`; sem nenhum dos dois, `1`. Todo leitor de
 * nível de batalha passa por aqui, nunca pelo `species.level` direto.
 */
export function resolveEntityLevel(entity, species) {
  if (entity?.has?.(CreatureLevel)) return entity.get(CreatureLevel).level
  return species?.level ?? 1
}
