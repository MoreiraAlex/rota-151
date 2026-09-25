import { trait } from 'koota'

/**
 * Criatura em MODO COMBATE — presença do trait = em combate. Entra ao
 * lançar qualquer ataque (`entrarEmCombate`, `core/actions/combat.js`);
 * `timeLeft` (s) conta até sair sozinha (`combatModeSystem.js`) e volta
 * pro máximo (`GAME_CONFIG.BATTLE.COMBAT_MODE_TIMEOUT`) a cada novo
 * ataque. Hoje o único efeito é o olho (`Mood` `'angry'`); é o ponto de
 * encaixe pra outros comportamentos de combate.
 *
 * Donos de escrita: `entrarEmCombate`/`sairDeCombate` (entrar/sair) e
 * `combatModeSystem.js` (contagem).
 */
export const CombatMode = trait({
  timeLeft: 0,
})
