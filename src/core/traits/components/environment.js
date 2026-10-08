import { trait } from 'koota'
import { GAME_CONFIG } from '../../gameConfig'

/**
 * Relógio do mundo (docs/features/048-dia-noite-e-clima.md) — trait do
 * MUNDO (`world.add`, `world.get`), não de entidade. `time` é o horário em
 * dias de jogo: a fração é a hora do dia (`core/time/dayCycle.js`) e a
 * parte inteira, quantos dias já passaram — ele nunca volta a zero, porque
 * o período do clima conta pelo tempo total. `speed` multiplica o andar do
 * relógio (`0` = parado; só o debug muda).
 *
 * Donos de escrita: `worldClockSystem.js` (anda) e `definirHorario`/
 * `definirVelocidadeDoRelogio` (`core/actions/environment.js` — save e
 * debug).
 */
export const WorldClock = trait({
  time: GAME_CONFIG.DAY_CYCLE.START_TIME,
  speed: 1,
})

/**
 * Clima onde está quem o jogador controla — trait do MUNDO. Cada tipo tem a
 * própria força atual (0 a 1): quando o clima muda, a do tipo que sai desce
 * e a do que entra sobe aos poucos (`WEATHER.TRANSITION`), então dá para
 * ter um pouco de dois ao mesmo tempo na troca. `type` é o de maior força
 * agora; `target`/`targetIntensity`, o sorteado para o lugar e a hora.
 * `forced`: tipo fixado pelo debug (`null` = o do mapa). `lightningTimer`:
 * segundos até o próximo relâmpago (só conta na tempestade).
 *
 * Dono de escrita: `weatherSystem.js` (e `forcarClima`, o `forced`).
 */
// `sun` é o sol forte.
export const LocalWeather = trait({
  type: 'clear',
  target: 'clear',
  targetIntensity: 0,
  forced: null,
  clear: 1,
  sun: 0,
  rain: 0,
  storm: 0,
  snow: 0,
  lightningTimer: GAME_CONFIG.WEATHER.LIGHTNING_INTERVAL[0],
})
