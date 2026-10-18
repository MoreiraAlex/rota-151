import { GAME_CONFIG } from '../gameConfig'
import { resolveLevelCost } from '../battle/levelCost'
import { resolveMovementCostMultiplier } from './stamina'
import { TEST_LEVEL } from '../data/testLevel'
import { verticalClearance } from '../physics/colliders'

/**
 * Regras do voo livre (docs/features/060-ajustes-por-especie.md, Parte 2):
 * contas sem ECS (o chão vem do relevo do nível). Quem aplica é o
 * `core/systems/flightSystem.js`.
 */

/**
 * Direção do voo (vetor de mundo, comprimento até 1) pela intenção do
 * `InputState` (x = direita, z = frente negativa) e pela câmera: a frente é
 * pra onde a câmera olha, inclusive na vertical — o `pitch` acima do
 * `neutralPitch` desce, abaixo sobe; os lados ficam na horizontal. Mesma
 * rotação pelo yaw do `movementSystem`. `vertical` (-1 a 1: Espaço sobe, C
 * desce) soma por cima da câmera — W com Espaço vai pra frente subindo.
 * Com `pitchControl` desligado (`FLIGHT.CAMERA_PITCH_CONTROL`), a câmera
 * não mexe na altura: a frente fica no plano e só o `vertical` sobe/desce.
 */
export function resolveFlightDirection(
  input,
  yaw,
  pitch,
  {
    vertical = 0,
    neutralPitch = GAME_CONFIG.FLIGHT.NEUTRAL_PITCH,
    pitchControl = GAME_CONFIG.FLIGHT.CAMERA_PITCH_CONTROL,
  } = {},
) {
  const forward = -input.z
  const side = input.x
  const tilt = pitchControl ? pitch - neutralPitch : 0
  const ahead = forward * Math.cos(tilt)
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)
  const x = side * cosYaw - ahead * sinYaw
  const z = -side * sinYaw - ahead * cosYaw
  const y = -forward * Math.sin(tilt) + vertical
  const length = Math.hypot(x, y, z)
  if (length <= 1) return { x, y, z }
  return { x: x / length, y: y / length, z: z / length }
}

/**
 * Intenção de voo do jogador agora: a direção (`resolveFlightDirection`,
 * com o Espaço/C do input bruto) e se há alguma (`active`). `intent` é o
 * `InputState`; `camera`, o `OrbitCamera`.
 */
export function resolveFlightIntent(intent, input, camera) {
  const vertical = (input.ascend ? 1 : 0) - (input.descend ? 1 : 0)
  const active = intent.x !== 0 || intent.z !== 0 || vertical !== 0
  if (!active) return { active, dir: { x: 0, y: 0, z: 0 } }
  return {
    active,
    dir: resolveFlightDirection(intent, camera.yaw, camera.pitch, {
      vertical,
    }),
  }
}

/**
 * Direção (unitária) do dash no ar: a da intenção de voo, ou, sem nenhuma,
 * a frente do corpo (`yaw`) na horizontal.
 */
export function resolveFlightDashDirection(intent, input, camera, yaw) {
  const flight =
    intent && camera ? resolveFlightIntent(intent, input, camera) : null
  if (!flight?.active) return { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }
  const { x, y, z } = flight.dir
  const length = Math.hypot(x, y, z)
  return { x: x / length, y: y / length, z: z / length }
}

/** Y do chão do nível em `(x, z)` (o relevo, sem prédio nem pedra). */
export function flightGroundY(x, z) {
  return TEST_LEVEL.terrain.heightAt(x, z)
}

/** Altura (m) dos pés acima do chão logo abaixo, pra quem voa. */
export function resolveFlightElevation(pos, body) {
  return pos.y - verticalClearance(body) - flightGroundY(pos.x, pos.z)
}

/**
 * Quem voa está alto demais pra quem está no chão lutar com ele (mais que
 * `MAX_COMBAT_HEIGHT_DIFF` acima do chão)? A IA dos selvagens o ignora.
 */
export function isOutOfGroundReach(pos, body) {
  return (
    resolveFlightElevation(pos, body) >
    GAME_CONFIG.BATTLE.MAX_COMBAT_HEIGHT_DIFF
  )
}

/**
 * Embalo do voo: aproxima `vel` (o `Velocity` vivo, as três direções) da
 * velocidade pedida `target`, sem pular pra ela — pela `ACCELERATION` com
 * alguma tecla (`accelerating`) e pelo `BRAKE` sem nenhuma (o deslize até
 * parar). Exponencial: rápido no começo, assentando no fim, igual em
 * qualquer `delta`.
 */
export function approachFlightVelocity(
  vel,
  target,
  accelerating,
  delta,
  { ACCELERATION, BRAKE } = GAME_CONFIG.FLIGHT,
) {
  const rate = accelerating ? ACCELERATION : BRAKE
  const k = 1 - Math.exp(-rate * delta)
  vel.x += (target.x - vel.x) * k
  vel.y += (target.y - vel.y) * k
  vel.z += (target.z - vel.z) * k
}

/** Teto do voo (m acima do chão logo abaixo): fração de stamina × máximo. */
export function resolveFlightCeiling(
  vitals,
  maxHeight = GAME_CONFIG.FLIGHT.MAX_HEIGHT,
) {
  if (!(vitals.maxStamina > 0)) return 0
  return Math.max(0, vitals.stamina / vitals.maxStamina) * maxHeight
}

/** Tem stamina pra decolar (`MIN_TAKEOFF_STAMINA`, fração da máxima)? */
export function canTakeOff(
  vitals,
  minFraction = GAME_CONFIG.FLIGHT.MIN_TAKEOFF_STAMINA,
) {
  return (
    vitals.maxStamina > 0 && vitals.stamina >= vitals.maxStamina * minFraction
  )
}

/**
 * Velocidade vertical (m/s) depois dos limites. O teto é MACIO: a velocidade
 * vertical máxima é a distância até ele × `response` (por segundo) — abaixo,
 * a subida freia chegando perto; acima, desce tanto mais rápido quanto mais
 * longe, até `descentSpeed`. Assim a queda pela stamina entra e sai suave e
 * nunca passa do teto. Sem stamina (teto zero), desce pelo menos em
 * `touchdownSpeed`, pra de fato chegar ao chão (devagar). `floorY` (pés, Y do
 * mundo — a superfície da água funda) não deixa descer abaixo dela, e vence o
 * teto.
 */
export function limitFlightVerticalSpeed({
  vy,
  feetY,
  groundY,
  ceiling,
  floorY = null,
  delta,
  ...tuning
}) {
  let next = Math.min(
    vy,
    resolveCeilingSpeed({ feetY, groundY, ceiling, ...tuning }),
  )
  if (floorY !== null && delta > 0) {
    next = Math.max(next, (floorY - feetY) / delta)
  }
  return next
}

/**
 * A velocidade vertical máxima (m/s) que o teto macio deixa agora (ver
 * `limitFlightVerticalSpeed`). Separada pra quem voa com embalo usar como
 * ALVO (`flightSystem`): um teto que cai de uma vez (o dash gasta um pedaço
 * da stamina) também vira descida aos poucos, não um corte seco.
 */
export function resolveCeilingSpeed({
  feetY,
  groundY,
  ceiling,
  descentSpeed = GAME_CONFIG.FLIGHT.CEILING_DESCENT_SPEED,
  response = GAME_CONFIG.FLIGHT.CEILING_RESPONSE,
  touchdownSpeed = GAME_CONFIG.FLIGHT.TOUCHDOWN_SPEED,
}) {
  const excess = feetY - (groundY + ceiling)
  const cap = Math.max(-excess * response, -descentSpeed)
  return ceiling <= 0 && excess > 0 ? Math.min(cap, -touchdownSpeed) : cap
}

/**
 * Gasta a stamina de um tick de voo (no `Vitals` vivo de quem chama):
 * pairando ou devagar pelo `FLY_WEIGHT_PER_SECOND`, rápido pelo
 * `FLY_FAST_WEIGHT_PER_SECOND` — pelo nível e com o custo extra da vida
 * baixa, como a corrida. Rápido sem stamina pra isso não vale (devolve
 * `false`, quem chama voa devagar). A stamina para em zero (aí o teto zera e
 * ele desce); no ar ela não regenera.
 */
export function gastarStaminaDeVoo(vitals, level, delta, fast) {
  const { FLY_WEIGHT_PER_SECOND, FLY_FAST_WEIGHT_PER_SECOND } =
    GAME_CONFIG.ACTION_COST
  const multiplier = resolveMovementCostMultiplier(vitals) * delta
  const fastCost =
    resolveLevelCost(level, FLY_FAST_WEIGHT_PER_SECOND) * multiplier
  const isFast = fast && vitals.stamina >= fastCost
  const cost = isFast
    ? fastCost
    : resolveLevelCost(level, FLY_WEIGHT_PER_SECOND) * multiplier
  vitals.stamina = Math.max(0, vitals.stamina - cost)
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
  return isFast
}
