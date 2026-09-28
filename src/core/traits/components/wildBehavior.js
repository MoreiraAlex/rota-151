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
 * o ataque básico agora em `target` (alvo ao alcance, intervalo entre
 * golpes vencido). Posto pelo `wildBehaviorSystem.js`/
 * `partyBehaviorSystem.js`; consumido (e removido) pelo
 * `creatureAttackSystem.js`, que lança pelo mesmo caminho do golpe do
 * jogador — só que mirando no alvo, não pela câmera. Mesmo padrão de
 * `AttackPulse`/`Jumped`.
 */
export const WantsToAttack = trait({ target: null })
