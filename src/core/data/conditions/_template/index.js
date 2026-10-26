/**
 * Molde de uma CONDIÇÃO — o que fica no alvo depois do golpe e dura um
 * tempo (docs/features/061-revisao-das-skills.md, "Condições padronizadas").
 * Copia esta pasta pra `<id>/`, preenche e registra em `../index.js`.
 *
 * Uma condição é montada por COMPORTAMENTOS, não por código próprio: quem
 * conta o tempo, tira HP e remove é o `conditionSystem`, igual pra todas.
 * Comportamento que ainda não existe (bloqueio, atordoar) entra no motor
 * quando a primeira condição precisar dele.
 *
 * O golpe só aponta pra condição (`effects: [{ type: 'condition',
 * condition: '<id>', chance }]`) e pode trocar `duration`, `tick` e
 * `modifiers` (campo a campo) e `immuneTypes` só pra ele.
 *
 * Todas somam: um alvo pode ter qualquer combinação ao mesmo tempo (decisão
 * do usuário). A mesma condição de novo RENOVA o tempo, mantém o ritmo do
 * próximo tick e troca quem aplicou.
 */
export const CONDITION_TEMPLATE = {
  id: 'template',
  // Nome no selo da HUD e na wiki.
  label: 'Condição',
  // O verbo na wiki ("chance de <verbo>").
  verb: 'condicionar',
  // Segundos até acabar (renovado ao aplicar de novo).
  duration: 0,
  // TICK: a cada `interval` segundos tira `fraction` do HP máximo (mínimo
  // 1). `to`: pra onde vai o HP — `null` (some) ou `'source'` (cura quem
  // aplicou, se ainda estiver em campo). `null` = sem tick.
  tick: null,
  // MODIFICADORES: atributo → multiplicador enquanto dura ('attack',
  // 'defense', 'sp_atk', 'sp_def'). O Ataque físico usa `attack`, o
  // especial `sp_atk`. `movement`: o passo de andar, correr e voar
  // (`resolveMoveSpeed`, `flightSystem`); zerado, também não dá dash nem
  // arrancada. `critical`: a chance de crítico dos golpes de quem tem
  // (`rollCriticalMultiplier`).
  modifiers: {},
  // ATORDOAR: enquanto dura, quem tem fica parado sem agir (não anda, ataca,
  // pula nem voa; o que estava fazendo é interrompido), com a animação de
  // atordoado da espécie (`creatureHitStunSystem`, ação `'stunned'`).
  // Omitido = não atordoa.
  // stun: true,
  // INTERROMPER: na hora em que pega, quem tem para o que estava fazendo e
  // fica atordoado como no golpe interrompido (`iniciarAtordoamento`, a
  // animação de hit); não fica na lista (sem tempo nem selo) — ex.: o recuo
  // do Bite. Omitido = não interrompe.
  // interrupt: true,
  // Tipos que não pegam a condição (o golpe acerta, a condição não).
  immuneTypes: [],
  // Condição BOA (pra quem tem): a IA dá valor a ela em si mesma/aliado, não
  // no inimigo (ex.: Focado, do Focus Energy). Omitido = ruim.
  // beneficial: true,
  // Continua correndo dentro da Pokébola (recolhido, capturado) e volta ao
  // invocar.
  keepsInBall: false,
  // Multiplica a chance de captura de quem está com ela (1 = nada).
  captureBonus: 1,
  // Valor pra IA e pro preço do golpe, na escala do `damage.power`
  // (multiplicado pela `chance` do efeito).
  ai: { value: 0 },
  feedback: {
    // Cor do selo e do log; `null` = a cor do lado (debuff ao aplicar, dano
    // no tick).
    color: null,
    // Mostra o selo na HUD.
    badge: false,
    // Linhas do log: `{alvo}` = o nome de quem tem a condição, `{hp}` = o HP
    // do tick. `null` = sem linha.
    applied: null,
    tick: null,
  },
  visual: {
    // Efeito a cada tick (grupo de `attackEffects/registry.js`), nascendo no
    // alvo e virado pra quem aplicou: `group` com quem aplicou em campo,
    // `soloGroup` sem; `duration` = quanto fica na cena. `null` = nada.
    tick: null,
    // Efeito no CORPO enquanto dura (`StatusConditionEffectsView`: 'burn', o
    // fogo; 'string-shot', a teia). Omitido = nada.
    // body: 'burn',
  },
}
