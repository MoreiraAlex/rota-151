import { relation, trait } from 'koota'

/**
 * Pokébola de captura arremessada pelo treinador (docs/features/043-
 * captura.md) — `Position`/`Velocity` cuidam de onde está; aqui o que só a
 * captura precisa.
 *
 * - `itemId` — a bola (`core/data/items/`), pro multiplicador e pro modelo.
 * - `state` — a fase da bola, uma só por vez:
 *   - `'flying'`: em voo, em arco;
 *   - `'absorbing'`: acertou um selvagem, parada no ar, puxando ele pra
 *     dentro (`CaptureTarget`);
 *   - `'falling'`: caindo até o chão com ele dentro;
 *   - `'shaking'`: no chão, balançando (`shakes` já feitas);
 *   - `'caught'` / `'escaped'`: resultado — fica um instante pros efeitos
 *     da view e some;
 *   - `'missed'`: errou — rola no chão e quebra.
 * - `timer` — segundos na fase atual (cada fase conta o seu).
 * - `flightTime` — segundos em voo (bola que voa demais é dada como
 *   perdida).
 * - `shakes` — balançadas já feitas; `shakeChance` — chance de cada uma
 *   passar, calculada no acerto.
 * - `backStrike` — acertou pelas costas.
 * - `hitY` — altura em que acertou o selvagem (a base do pulinho da
 *   absorção).
 * - `floorY` — altura do chão embaixo da bola; `resting`, `landings` —
 *   física da bola que errou, mesma ideia da `DroppedFood`. `Position` é
 *   sempre o CENTRO da bola (no chão, um `BALL_RADIUS` acima de `floorY`).
 *
 * Quem arremessou é o `OwnedBy` da bola.
 *
 * Dono de escrita: `playerActionSystem` (spawna) e `captureBallSystem` (o
 * resto, e destrói).
 */
export const CaptureBall = trait({
  itemId: null,
  state: 'flying',
  timer: 0,
  flightTime: 0,
  shakes: 0,
  shakeChance: 0,
  backStrike: false,
  hitY: 0,
  floorY: 0,
  resting: false,
  landings: 0,
})

/**
 * O selvagem que está dentro da bola (relação da bola pro selvagem).
 *
 * Dono de escrita: `comecarCaptura` (`core/actions/capture.js`).
 */
export const CaptureTarget = relation({ exclusive: true })

/**
 * O selvagem está DENTRO de uma Pokébola sendo capturado: não aparece na
 * cena, não tem colisão, não age, não é alvo de ninguém e não regenera — mas
 * as condições continuam (a queimadura queima e pode fazê-lo desmaiar ali
 * dentro). Sai no escape; capturado, a entidade some.
 *
 * Dono de escrita: `comecarCaptura` (põe) e `selvagemEscapou` (tira).
 */
export const BeingCaptured = trait()

/**
 * Condições guardadas no registro do Pokémon (`Pokemon`) enquanto ele está
 * na bola — recolhido ou capturado. Continuam correndo lá dentro
 * (`storedConditionSystem`) e voltam pra criatura ao invocar.
 *
 * - `burn` — `{ timeLeft, tickTimer, fraction, interval, attackMultiplier }`
 *   (mesma forma do `Burn`), ou `null`.
 *
 * Trait AoS (objeto por campo). Dono de escrita: `guardarCondicoes`
 * (`core/actions/conditions.js`, no recolher e na captura),
 * `storedConditionSystem` (conta e tira) e `devolverCondicoes` (no invocar).
 */
export const StoredConditions = trait(() => ({
  burn: null,
}))

/**
 * Pokémon capturado sem lugar no time nem no inventário: a bola fechada
 * ficou no chão, em `{ x, y, z }`. Ninguém pega ainda (pegar do chão é
 * futuro). Registro com isto não está no time nem no inventário.
 *
 * Dono de escrita: `capturarSelvagem` (`core/actions/capture.js`).
 */
export const BallOnGround = trait({
  x: 0,
  y: 0,
  z: 0,
})

/**
 * Mira da Pokébola do treinador (docs/features/043-captura.md): segurando o
 * botão direito com uma Pokébola na mão. Recalculada todo tick enquanto
 * mira, com o mesmo voo da bola de verdade (`traceCaptureFlight`):
 *
 * - `active` — mirando agora;
 * - `origin`/`velocity` — de onde e com que velocidade a bola sairia (o
 *   arremesso usa exatamente esta velocidade);
 * - `impact`/`impactTime` — onde ela bate e em quanto tempo;
 * - `landed` — bate em algo dentro do tempo de voo (senão está longe demais).
 *
 * O selvagem que ela pegaria é a relação `CaptureAimTarget`. O que a HUD
 * precisa (e só muda de vez em quando) fica em `CaptureAimStatus`.
 *
 * Trait AoS. Dono de escrita: `captureAimSystem`.
 */
export const CaptureAim = trait(() => ({
  active: false,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  impact: { x: 0, y: 0, z: 0 },
  impactTime: 0,
  landed: false,
}))

/**
 * O resumo da mira pra HUD — só é escrito quando muda, pra não redesenhar o
 * retículo a cada tick: `active` (mirando), `onWild` (a bola pegaria um
 * selvagem) e `inRange` (ela bate em algo dentro do tempo de voo).
 *
 * Dono de escrita: `captureAimSystem`.
 */
export const CaptureAimStatus = trait({
  active: false,
  onWild: false,
  inRange: false,
})

/**
 * O selvagem que a bola pegaria se fosse arremessada agora (relação do
 * treinador pro selvagem). Dono de escrita: `captureAimSystem`.
 */
export const CaptureAimTarget = relation({ exclusive: true })
