import { trait } from 'koota'

/**
 * Comportamento de uma `WildCreature` em relação ao jogador.
 *
 * - `temperament`: `'hostile'` (te percebendo, parte para cima) ou
 *   `'peaceful'` (te percebendo, pode fugir; apanhando, revida). Sorteado uma
 *   vez no spawn (`rollTemperament`, chance por espécie) e fixo dali em
 *   diante. A percepção é do `WildAwareness`.
 * - `state`: o que está fazendo agora — `'wander'` (vagando,
 *   `wildWanderSystem.js`), `'chase'` (perseguindo `target`) ou `'leave'`
 *   (fugindo para sumir do mapa — a fuga clássica,
 *   docs/features/063-revisao-da-ia-selvagem.md). Um campo só: nunca dois
 *   estados juntos.
 * - `target`: a entidade do lado do jogador (treinador ou criatura do
 *   time) que ela persegue agora — reescolhida todo tick por ameaça (quem
 *   mais causou dano nela, `Threat`) ou, sem ameaça, por proximidade
 *   (`resolveWildTarget`, `core/battle/combatTargets.js`). `null` vagando
 *   ou saindo.
 * - `provoked`: perseguindo porque APANHOU — usa o limite de perseguição
 *   maior (`RETALIATE_LEASH_RADIUS`).
 * - `attackTimer` (s): quanto falta pra poder pedir o próximo golpe
 *   perseguindo (o `ATTACK_INTERVAL` da dificuldade entre pedidos) — sem
 *   isso, com ataque de cooldown 0 ela emendaria golpe atrás de golpe.
 * - `attackSlot`: o golpe que ela PLANEJA lançar no alvo
 *   (`'secondary1-3'`), escolhido por `planAiAttack`
 *   (`core/battle/aiAttackChoice.js`) e mantido enquanto continuar pronto;
 *   `null` = escolher de novo (depois de cada pedido, ou ao trocar de alvo).
 * - `lastAttackSlot`: o último golpe pedido — só pro debug (F2).
 * - `resting`: descansando com a energia baixa — sem golpe e sem correr até
 *   recuperar (`resolveResting`, `core/battle/aiEnergy.js`).
 * - `leaveDirX` / `leaveDirZ` / `leaveTimer`: saindo, a direção (para longe
 *   de quem estava mais perto, escolhida uma vez) e quanto falta para sumir
 *   (`LEAVE_RUN_TIME`).
 *
 * Dono de escrita: as actions de `core/actions/wildBehavior.js`, chamadas
 * por `wildBehaviorSystem.js`/`wildAwarenessSystem.js` (que também gravam
 * `target`).
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
  leaveDirX: 0,
  leaveDirZ: 1,
  leaveTimer: 0,
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
 * o golpe do `slot` (`'secondary1-3'`, escolhido por `planAiAttack`) agora em `target` (alvo ao alcance,
 * intervalo entre golpes vencido). Posto pelo `wildBehaviorSystem.js`/
 * `partyBehaviorSystem.js`; consumido (e removido) pelo
 * `creatureAttackSystem.js`, que lança pelo mesmo caminho do golpe do
 * jogador — só que mirando no alvo, não pela câmera. Mesmo padrão de
 * `AttackPulse`/`Jumped`.
 */
export const WantsToAttack = trait({ target: null, slot: null })
