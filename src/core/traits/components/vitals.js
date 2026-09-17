import { trait } from 'koota'

/**
 * Vida (HP) e fôlego (stamina) da entidade — vem de `core/data/species/<id>/
 * index.js` (`vitals`), copiado no spawn via `vitalsFromSpecies` (ver
 * abaixo); cada entidade pode ter seus próprios máximos/taxas/custos.
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
  jumpStaminaCost: 10,
})

/**
 * Monta o valor inicial de `Vitals` a partir do bloco `vitals` de uma
 * espécie (`core/data/species/<id>/index.js`) — usado no spawn do
 * treinador (`core/world/world.js`/`test/makeWorld.js`) e de toda
 * `SummonedCreature` (`partySummonSystem.js`), centraliza uma lógica que
 * estava duplicada nos dois primeiros e nem existia no terceiro (a
 * criatura invocada usava `Vitals` cru, sempre default, nunca copiava da
 * espécie de verdade). `vitals` é opcional na espécie (ver
 * `_template/index.js`) — sem ele, usa os defaults do próprio trait.
 */
export function vitalsFromSpecies(speciesVitals) {
  if (!speciesVitals) return Vitals

  return Vitals({
    hp: speciesVitals.maxHp,
    maxHp: speciesVitals.maxHp,
    hpRegenPercent: speciesVitals.hpRegenPercent,
    hpRegenDelayAfterDamage: speciesVitals.hpRegenDelayAfterDamage,
    stamina: speciesVitals.maxStamina,
    maxStamina: speciesVitals.maxStamina,
    staminaRegenPercent: speciesVitals.staminaRegenPercent,
    staminaRegenDelayAfterUse: speciesVitals.staminaRegenDelayAfterUse,
    runStaminaDrainPerSecond: speciesVitals.runStaminaDrainPerSecond,
    jumpStaminaCost: speciesVitals.jumpStaminaCost,
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
