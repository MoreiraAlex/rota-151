import { trait } from 'koota'
import { resolveCreatureStats } from '../../data/species/stats'

/**
 * Vida (HP) e fôlego (stamina) da entidade — vem de `core/data/species/<id>/
 * index.js` (`vitals`, ou `stats.hp`/`.energy` nas espécies já migradas
 * — ver docstring de `vitalsFromSpecies` abaixo), copiado no spawn via
 * `vitalsFromSpecies`; cada entidade pode ter seus próprios
 * máximos/taxas/custos.
 * Current e máximo ficam juntos no mesmo trait (diferente de
 * `MovementStats`, que é só config): toda operação que mexe num lê o
 * outro (regenerar, drenar, exibir), então separar só adicionaria
 * indireção.
 *
 * `hpRegenDelay` conta em segundos quanto falta pra HP voltar a regenerar
 * depois de tomar dano — zero quando pode regenerar normalmente;
 * `hpRegenDelayAfterDamage` é o valor (por espécie) que o reseta pra
 * cada vez que dano é aplicado (`applyDamage`). `staminaRegenDelay` é o
 * mesmo princípio pro fôlego: quanto falta pra stamina voltar a
 * regenerar depois do último uso (correr, dash ou pulo) — cada dreno
 * reseta o delay pra `staminaRegenDelayAfterUse` (por espécie), igual
 * dano reseta o de HP. `runStaminaDrainPerSecond`/`jumpStaminaCost` são
 * os custos (por espécie) de correr/pular — até a rodada de
 * docs/features/018-troca-de-controle-treinador-criatura.md esses 4
 * campos eram globais em `GAME_CONFIG.VITALS` ("comportamento do motor,
 * não atributo de criatura"); decisão revertida — agora variam por
 * espécie como o resto de `vitals`, já que treinador e criatura correm/
 * pulam com o mesmo motor mas podem querer números diferentes.
 *
 * Dono de escrita: vitalsRegenSystem (regeneração + contagem dos delays);
 * movementSystem/playerActionSystem/characterPhysicsSystem (dreno de
 * stamina, cada um resetando `staminaRegenDelay` ao drenar); qualquer fonte
 * de dano, via `applyDamage` (só o botão de debug por enquanto).
 */
export const Vitals = trait({
  hp: 100,
  maxHp: 100,
  hpRegenPercent: 2,
  hpRegenDelay: 0,
  hpRegenDelayAfterDamage: 5,
  stamina: 100,
  maxStamina: 100,
  staminaRegenPercent: 10,
  staminaRegenDelay: 0,
  staminaRegenDelayAfterUse: 3,
  runStaminaDrainPerSecond: 2,
  jumpStaminaCost: 3,
})

/**
 * **Duas fontes possíveis pro máximo/regen de HP e stamina** — pedido
 * do usuário: "agora tenho energy no stats tb que vai substituir a
 * stamina... adeque o sistema de hp e stamina para ler esse stats".
 * Espécies migradas (`boy`/`001-bulbasaur`/`004-charmander`/
 * `007-squirtle`) guardam isso em `species.stats.hp`/`.energy`; as que
 * ainda NÃO migraram (`fox`/`wolf`) continuam com o formato antigo,
 * `species.vitals.maxHp`/`.maxStamina`/etc. `stats.hp`/`.energy` GANHA
 * quando os dois existem; sem NENHUM dos dois, cai nos defaults do
 * trait `Vitals` (`100`/`100`, ver acima).
 *
 * Exportadas (não só usadas dentro de `vitalsFromSpecies`) porque
 * `tools/hud/PartyHud.jsx` precisa do MESMO cálculo pra mostrar o
 * máximo de uma criatura equipada mas não invocada (sem `Vitals` ao
 * vivo pra ler) — duplicar esta conta em dois lugares arriscava os
 * dois discordarem entre si.
 *
 * `individualValues` (opcional, `IndividualValues`/
 * `PartyIndividualValues` — ver docstring dos traits, `core/traits/
 * components/individualValues.js`/`partyIndividualValues.js`)
 * recalcula o `hp`/`energy` de verdade DESTA criatura via
 * `resolveCreatureStats`. Desde que IV virou sempre sorteado por
 * indivíduo — inclusive pro time do jogador, não só selvagem (ver
 * docs/features/029-*.md) — `species.stats.<key>` de `boy`/
 * `bulbasaur`/`charmander`/`squirtle` NÃO guarda mais `iv`/`stat`
 * nenhum (só `base`/`ev`); passar `individualValues` deixou de ser
 * opcional NA PRÁTICA pra essas espécies — sem ele, `resolved` fica
 * `null` e a conta cai pro próximo elo da cadeia
 * (`species?.stats?.hp?.stat`), que pra elas também é `undefined`
 * agora (campo removido) — só continua certo pro trainer `boy`
 * (`species.stats.hp.stat` fixo, sem IV — trainer não é Pokémon),
 * chamado sem segundo argumento.
 */
export function resolveMaxHp(species, individualValues = null) {
  const resolved =
    individualValues && resolveCreatureStats(species, individualValues)
  return (
    resolved?.hp?.stat ??
    species?.stats?.hp?.stat ??
    species?.vitals?.maxHp ??
    100
  )
}

export function resolveMaxStamina(species, individualValues = null) {
  const resolved =
    individualValues && resolveCreatureStats(species, individualValues)
  return (
    resolved?.energy?.stat ??
    species?.stats?.energy?.stat ??
    species?.vitals?.maxStamina ??
    100
  )
}

/**
 * Monta o valor inicial de `Vitals` a partir de uma espécie
 * (`core/data/species/<id>/index.js`) — usado no spawn do treinador
 * (`core/world/world.js`/`test/makeWorld.js`) e de toda
 * `SummonedCreature` (`partySummonSystem.js`)/`WildCreature`
 * (`wildCreatureSpawnSystem.js`), centraliza uma lógica que estava
 * duplicada nos dois primeiros e nem existia no terceiro (a criatura
 * invocada usava `Vitals` cru, sempre default, nunca copiava da
 * espécie de verdade).
 *
 * Um campo ausente aqui NUNCA deve virar `undefined` dentro do
 * `Vitals({...})` (o `set` do koota escreve o valor exatamente como
 * vier — um `undefined` explícito sobrescreveria o default do trait
 * com `undefined` de verdade, não "usa o default") — por isso todo
 * campo abaixo tem um `?? <default literal do trait>` no final da
 * cadeia, nunca fica em aberto.
 *
 * `runStaminaDrainPerSecond`/`jumpStaminaCost` (custo, não
 * máximo/regen) continuam SEMPRE em `species.vitals` — não fazem parte
 * do conceito de "status de batalha" que migrou pra `stats`.
 *
 * `individualValues` (opcional) — mesmo parâmetro de `resolveMaxHp`/
 * `resolveMaxStamina` acima, repassado adiante. `regenPercent`/
 * `regenDelay` não dependem de IV (só `base`/`ev`/`level` fariam, e
 * hoje nem isso — são taxas fixas por espécie), por isso continuam
 * lidos direto de `species.stats.hp`/`.energy`, sem passar por
 * `resolveCreatureStats`.
 */
export function vitalsFromSpecies(species, individualValues = null) {
  const vitals = species?.vitals
  const hpStat = species?.stats?.hp
  const energyStat = species?.stats?.energy
  const maxHp = resolveMaxHp(species, individualValues)
  const maxStamina = resolveMaxStamina(species, individualValues)

  return Vitals({
    hp: maxHp,
    maxHp,
    hpRegenPercent: hpStat?.regenPercent ?? vitals?.hpRegenPercent ?? 2,
    hpRegenDelayAfterDamage:
      hpStat?.regenDelay ?? vitals?.hpRegenDelayAfterDamage ?? 5,
    stamina: maxStamina,
    maxStamina,
    staminaRegenPercent:
      energyStat?.regenPercent ?? vitals?.staminaRegenPercent ?? 10,
    staminaRegenDelayAfterUse:
      energyStat?.regenDelay ?? vitals?.staminaRegenDelayAfterUse ?? 3,
    runStaminaDrainPerSecond: vitals?.runStaminaDrainPerSecond ?? 2,
    jumpStaminaCost: vitals?.jumpStaminaCost ?? 10,
  })
}

/**
 * Desconta HP (nunca abaixo de zero) e reseta o delay de regeneração —
 * contrato único pra qualquer fonte de dano (hoje só o botão de debug do
 * `DebugPanel`; uma fonte de dano de jogo de verdade, quando existir, usa
 * a mesma função em vez de escrever em `hp` direto e arriscar esquecer o
 * delay).
 */
export function applyDamage(vitals, amount, delayAfterDamage) {
  return {
    hp: Math.max(0, vitals.hp - amount),
    hpRegenDelay: delayAfterDamage,
  }
}

/**
 * Soma HP (nunca acima do máximo) — usado por consumíveis (ver
 * docs/features/014-arremessar-usar-e-invocar.md). Simétrico a
 * `applyDamage`, mas **não** mexe em `hpRegenDelay`: curar não é o inverso
 * de tomar dano pausar a regeneração.
 */
export function applyHeal(vitals, amount) {
  return {
    hp: Math.min(vitals.maxHp, vitals.hp + amount),
  }
}
