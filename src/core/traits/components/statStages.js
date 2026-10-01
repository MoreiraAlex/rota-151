import { trait } from 'koota'

/**
 * Estágios de atributo de uma criatura — o que golpes de STATUS (ex.: Growl
 * baixa o ataque do alvo) fazem. Segue a convenção do Pokémon: cada estágio
 * vai de -6 a +6 e multiplica o atributo (`core/battle/statStages.js`,
 * `stageMultiplier`). Diferente do jogo de turnos, aqui o jogo é em tempo
 * real: cada estágio DURA — `<stat>Time` conta, em segundos, até o estágio
 * daquele atributo voltar a 0 (`statStageSystem`); usar o golpe de novo
 * acumula o estágio (até o limite) e RENOVA o tempo.
 *
 * Campos planos (`attackStage`/`attackTime`, `defenseStage`/`defenseTime`,
 * `sp_atkStage`/`sp_atkTime`, `sp_defStage`/`sp_defTime`,
 * `accuracyStage`/`accuracyTime` — a precisão, ver `core/battle/accuracy.js`) por causa do
 * armazenamento do koota. A criatura não nasce com o trait: ele é
 * adicionado no primeiro efeito (`applyStatStageEffect`).
 *
 * Dono de escrita: `applyStatStageEffect` (chamado por `creatureAttackSystem`
 * ao aplicar os `effects` de uma skill) e `statStageSystem` (expira o tempo).
 * Lê: a fórmula de dano (`resolveDamageAmount`).
 */
export const StatStages = trait({
  attackStage: 0,
  attackTime: 0,
  defenseStage: 0,
  defenseTime: 0,
  sp_atkStage: 0,
  sp_atkTime: 0,
  sp_defStage: 0,
  sp_defTime: 0,
  accuracyStage: 0,
  accuracyTime: 0,
})
