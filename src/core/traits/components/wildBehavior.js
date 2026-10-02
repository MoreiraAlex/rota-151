import { trait } from 'koota'

/**
 * Comportamento de uma `WildCreature` em relação ao jogador.
 *
 * - `temperament`: `'hostile'` (persegue quem entrar no raio de aggro) ou
 *   `'peaceful'` (só vaga; apanhando, revida ou foge). Sorteado uma vez no
 *   spawn (`rollTemperament`, chance por espécie) e fixo dali em diante.
 * - `state`: o que está fazendo agora — `'wander'` (vagando,
 *   `wildWanderSystem.js`), `'chase'` (perseguindo `target`) ou `'flee'`
 *   (fugindo de `target`). Um campo só: nunca dois estados juntos.
 * - `target`: a entidade do lado do jogador (treinador ou criatura do
 *   time) que ela persegue/de quem foge agora — reescolhida todo tick por
 *   ameaça (quem mais causou dano nela, `Threat`) ou, sem ameaça, por
 *   proximidade (`resolveWildTarget`, `core/battle/combatTargets.js`).
 *   `null` vagando.
 * - `provoked`: perseguindo porque APANHOU (pacífica revidando) — usa o
 *   limite de perseguição maior (`RETALIATE_LEASH_RADIUS`) e, ao perder o
 *   alvo, volta a ser só pacífica.
 * - `attackTimer` (s): quanto falta pra poder pedir o próximo golpe
 *   perseguindo (`WILD_BEHAVIOR.ATTACK_INTERVAL` entre pedidos) — sem
 *   isso, com ataque de cooldown 0 ela emendaria golpe atrás de golpe.
 * - `attackSlot`: o golpe que ela PLANEJA lançar no alvo (`'primary'`,
 *   `'secondary1-3'`), escolhido por `planAiAttack`
 *   (`core/battle/aiAttackChoice.js`) e mantido enquanto continuar pronto;
 *   `null` = escolher de novo (depois de cada pedido, ou ao trocar de alvo).
 * - `lastAttackSlot`: o último golpe pedido — só pro debug (F2).
 * - `shaken`: fugiu com a vida baixa (`LOW_HP_FLEE_FRACTION`) — não persegue
 *   ninguém (nem hostil no raio, nem apanhando: continua fugindo) até a vida
 *   voltar a `LOW_HP_RECOVER_FRACTION`.
 * - `lowHpRolled`: já sorteou a fuga nesta queda de vida (sorteio UMA vez;
 *   volta a `false` quando se recupera).
 * - `hasFleePoint` / `fleeX` / `fleeZ` / `fleeTimer`: destino da fuga
 *   escolhido (`resolveFleeDestination`, `core/battle/flee.js`) e quanto
 *   falta pra escolher de novo — guardado pra não mudar de ideia todo tick.
 * - `resting`: descansando com a energia baixa — sem golpe e sem correr até
 *   recuperar (`resolveResting`, `core/battle/aiEnergy.js`).
 *
 * Dono de escrita: as actions de `core/actions/wildBehavior.js`, chamadas
 * por `wildBehaviorSystem.js` (que também grava `target`).
 */
export const WildBehavior = trait({
  temperament: 'peaceful',
  state: 'wander',
  target: null,
  provoked: false,
  attackTimer: 0,
  attackSlot: null,
  lastAttackSlot: null,
  resting: false,
  shaken: false,
  lowHpRolled: false,
  hasFleePoint: false,
  fleeX: 0,
  fleeZ: 0,
  fleeTimer: 0,
})

/**
 * Tabela de ameaça de uma selvagem: quanto dano cada atacante já causou
 * nela (`entries: [{ entity, amount }]`) — ela persegue quem está no topo
 * (`resolveWildTarget`). Somada a cada golpe que ela leva
 * (`registrarAmeaca`, pelo `wildReactionSystem.js`) e zerada quando ela
 * volta a vagar (`voltarAVagar` — a luta acabou). Sem decaimento com o
 * tempo por enquanto.
 *
 * Trait AoS (`entries` é um array): mutação sempre por objeto novo +
 * `set`, mesma convenção de `PathState`/`Inventory`.
 */
export const Threat = trait(() => ({ entries: [] }))

/**
 * Pedido de um tick: a criatura (selvagem OU do time, pela IA) quer lançar
 * o golpe do `slot` (básico `'primary'` ou habilidade `'secondary1-3'`,
 * escolhido por `planAiAttack`) agora em `target` (alvo ao alcance,
 * intervalo entre golpes vencido). Posto pelo `wildBehaviorSystem.js`/
 * `partyBehaviorSystem.js`; consumido (e removido) pelo
 * `creatureAttackSystem.js`, que lança pelo mesmo caminho do golpe do
 * jogador — só que mirando no alvo, não pela câmera. Mesmo padrão de
 * `AttackPulse`/`Jumped`.
 */
export const WantsToAttack = trait({ target: null, slot: 'primary' })
