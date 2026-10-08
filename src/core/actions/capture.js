import { getItem } from '../data/items'
import { getPlayerSpecies, getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  destroyCharacterBody,
  setCharacterColliderEnabled,
  teleportCharacterBody,
  verticalClearance,
} from '../physics/colliders'
import {
  isBackStrike,
  resolveBallMultiplier,
  resolveCaptureValue,
  resolveConditionBonus,
  resolveShakeChance,
  resolveSpeciesCaptureRate,
} from '../battle/capture'
import { captureEscaped, captureStarted, pokemonCaptured } from '../events'
import {
  ActionState,
  AttackAim,
  BallOnGround,
  BeingCaptured,
  Burn,
  CaptureAim,
  CaptureBall,
  CaptureTarget,
  CombatMode,
  CreatureLevel,
  CreatureMoves,
  Fainted,
  IndividualValues,
  InventoryCell,
  PhysicsBody,
  Position,
  RecallBeam,
  Rotation,
  StoredFaint,
  StoredVitals,
  SummonFlash,
  Threat,
  Velocity,
  Vitals,
  WantsToAttack,
  WildBehavior,
  WildCreature,
} from '../traits'
import { guardarCondicoes } from './conditions'
import { distribuirExperiencia } from './experience'
import { acordar } from './faint'
import { hasFreeCell } from './inventory'
import { resolveOwner } from './owner'
import { colocarNoTime, criarPokemon, findFreePartySlot } from './pokemon'
import { fugirDoJogador, perseguirJogador } from './wildBehavior'

/**
 * Captura (docs/features/043-captura.md): a Pokébola acerta um selvagem
 * (`comecarCaptura`), balança (`captureBallSystem.js`) e termina em
 * `capturarSelvagem` ou `selvagemEscapou`.
 */

/** O selvagem dentro da `ball` (`CaptureTarget`), ou `null`. */
export function resolveCaptureTarget(ball) {
  const wild = ball?.targetFor?.(CaptureTarget)
  return wild?.isAlive() ? wild : null
}

/** O treinador está mirando a Pokébola agora (`captureAimSystem`)? */
export function isAimingCapture(entity) {
  return !!entity?.get?.(CaptureAim)?.active
}

/** O selvagem está dentro de uma Pokébola agora? */
export function isBeingCaptured(entity) {
  return !!entity?.has?.(BeingCaptured)
}

/** Ids das condições ativas da criatura (pro bônus da fórmula). */
function listConditions(entity) {
  return entity.has(Burn) ? ['burn'] : []
}

/**
 * O selvagem não percebeu o treinador: vagando, fora do modo combate e sem
 * ninguém na tabela de ameaça. Desmaiado não conta (não "olha" pra lado
 * nenhum).
 */
function isUnaware(wild) {
  if (wild.has(Fainted) || wild.has(CombatMode)) return false
  if (wild.get(WildBehavior)?.state !== 'wander') return false
  return !(wild.get(Threat)?.entries?.length > 0)
}

/**
 * Chance de cada balançada passar, com o estado do `wild` agora, a bola
 * `item` e o bônus de costas. Desmaiado conta como HP 0.
 */
export function resolveWildShakeChance(wild, item, backStrike) {
  const species = getSpecies(wild.get(WildCreature)?.speciesId)
  const vitals = wild.get(Vitals)
  const value = resolveCaptureValue({
    hp: wild.has(Fainted) ? 0 : (vitals?.hp ?? 0),
    maxHp: vitals?.maxHp ?? 0,
    rate: resolveSpeciesCaptureRate(species),
    ballMultiplier: resolveBallMultiplier(item),
    conditionBonus: resolveConditionBonus(listConditions(wild)),
    backStrikeBonus: backStrike ? GAME_CONFIG.CAPTURE.BACK_STRIKE_BONUS : 1,
  })
  return resolveShakeChance(value)
}

/**
 * A bola `ball` acertou o selvagem `wild`: ele entra nela (`BeingCaptured`
 * — sem colisão, sem agir; a view esconde), larga o que fazia, e a bola
 * para no ar puxando ele (`'absorbing'`). A chance de cada balançada é
 * calculada aqui, no acerto. `ballVelocity` é a velocidade da bola no
 * instante do acerto (pro "pelas costas").
 */
export function comecarCaptura(world, events, ball, wild, ballVelocity) {
  if (!ball?.isAlive?.() || !wild?.isAlive?.() || isBeingCaptured(wild)) {
    return false
  }
  const item = getItem(ball.get(CaptureBall).itemId)
  const backStrike = isBackStrike({
    unaware: isUnaware(wild),
    facingY: wild.get(Rotation)?.y ?? 0,
    ballVelocity,
  })

  ball.set(CaptureBall, {
    state: 'absorbing',
    timer: 0,
    shakes: 0,
    shakeChance: resolveWildShakeChance(wild, item, backStrike),
    backStrike,
  })
  ball.set(Velocity, { x: 0, y: 0, z: 0 })
  ball.add(CaptureTarget(wild))

  wild.add(BeingCaptured)
  // O feixe vermelho do recolher (024), da bola até ele: a luz puxando ele
  // pra dentro.
  const ballPos = ball.get(Position)
  const wildPos = wild.get(Position)
  world.spawn(
    Position({ x: wildPos.x, y: wildPos.y, z: wildPos.z }),
    Rotation,
    RecallBeam({
      lifetime: GAME_CONFIG.CAPTURE.ABSORB_DURATION,
      fromX: ballPos.x,
      fromY: ballPos.y,
      fromZ: ballPos.z,
      speciesId: wild.get(WildCreature)?.speciesId,
      mode: 'capture',
      itemId: ball.get(CaptureBall).itemId,
    }),
  )
  if (wild.has(ActionState)) {
    wild.set(ActionState, {
      current: null,
      elapsed: 0,
      animationSpeed: 1,
      pendingSlot: null,
    })
  }
  if (wild.has(AttackAim)) wild.set(AttackAim, { slot: null })
  if (wild.has(WantsToAttack)) wild.remove(WantsToAttack)
  if (wild.has(CombatMode)) wild.remove(CombatMode)
  if (wild.has(Velocity)) wild.set(Velocity, { x: 0, z: 0 })
  if (wild.has(PhysicsBody)) {
    setCharacterColliderEnabled(wild.get(PhysicsBody).colliderHandle, false)
  }

  events?.emit(
    captureStarted({ ball, wild, trainer: resolveOwner(ball), backStrike }),
  )
  return true
}

/**
 * Pra onde vai o capturado: o primeiro slot vazio do time; senão o
 * inventário; sem lugar no inventário, a bola fica no chão.
 */
function resolveDestination(world, trainer) {
  const slot = findFreePartySlot(trainer)
  if (slot) return { kind: 'party', slot }
  if (hasFreeCell(world, trainer)) return { kind: 'inventory' }
  return { kind: 'ground' }
}

/**
 * Capturou: o registro do Pokémon nasce do selvagem como ele estava — mesma
 * espécie, nível e XP, IV, golpes, vida, condições (continuam na bola) e,
 * se desmaiado, o desmaio — com a bola usada gravada. Vai pro destino
 * (`resolveDestination`), o selvagem some, e quem lutou contra ele ganha
 * `CAPTURE.XP_FRACTION` do XP de derrotá-lo (desmaiado, esse XP já saiu no
 * desmaio). Devolve o registro, ou `null`.
 */
export function capturarSelvagem(world, events, ball) {
  const wild = resolveCaptureTarget(ball)
  const trainer = resolveOwner(ball)
  if (!wild || !trainer) return null

  if (!wild.has(Fainted)) {
    distribuirExperiencia(world, events, wild, GAME_CONFIG.CAPTURE.XP_FRACTION)
  }

  const { speciesId } = wild.get(WildCreature)
  const { itemId } = ball.get(CaptureBall)
  const destination = resolveDestination(world, trainer)
  const pokemon = criarPokemon(world, trainer, speciesId, {
    ballId: itemId,
    individualValues: wild.get(IndividualValues),
    levelState: wild.get(CreatureLevel),
    moves: wild.get(CreatureMoves),
  })
  if (!pokemon) return null

  const vitals = wild.get(Vitals)
  if (vitals) pokemon.set(StoredVitals, { vitals: { ...vitals } })
  const fainted = wild.get(Fainted)
  if (fainted) {
    pokemon.add(StoredFaint({ timeLeft: Math.max(0, fainted.timeLeft) }))
  } else {
    guardarCondicoes(wild, pokemon)
  }

  const ballPos = { ...ball.get(Position) }
  if (destination.kind === 'party') {
    colocarNoTime(trainer, pokemon, destination.slot)
  } else if (destination.kind === 'ground') {
    pokemon.remove(InventoryCell)
    pokemon.add(BallOnGround(ballPos))
  }

  ball.remove(CaptureTarget('*'))
  if (wild.has(PhysicsBody)) {
    destroyCharacterBody(wild.get(PhysicsBody).bodyHandle)
  }
  wild.destroy()

  events?.emit(
    pokemonCaptured({
      trainer,
      pokemon,
      speciesId,
      destination: destination.kind,
      position: ballPos,
    }),
  )
  return pokemon
}

/**
 * Escapou: o selvagem sai da bola onde ela está, de pé (sem o
 * `BeingCaptured`, com colisão de novo). Desmaiado, acorda com
 * `CAPTURE.ESCAPE_WAKE_HP_FRACTION` da vida. Depois sorteia (`rng`) entre
 * partir pra briga contra quem arremessou ou fugir — a chance de brigar é
 * do temperamento dele (`CAPTURE.ESCAPE_FIGHT_CHANCE`).
 */
export function selvagemEscapou(world, events, ball, rng) {
  const wild = resolveCaptureTarget(ball)
  if (!wild) return null

  ball.remove(CaptureTarget('*'))
  wild.remove(BeingCaptured)
  placeAtBall(wild, ball)
  // O clarão do invocar (024) no ponto em que ele reaparece.
  world.spawn(
    Position({ ...wild.get(Position) }),
    Rotation,
    SummonFlash({ lifetime: getPlayerSpecies().actions.summon.flashDuration }),
  )

  if (wild.has(Fainted)) {
    acordar(wild)
    const { maxHp } = wild.get(Vitals)
    const hp = Math.max(
      1,
      Math.ceil(maxHp * GAME_CONFIG.CAPTURE.ESCAPE_WAKE_HP_FRACTION),
    )
    wild.set(Vitals, { hp })
  } else if (wild.has(PhysicsBody)) {
    setCharacterColliderEnabled(wild.get(PhysicsBody).colliderHandle, true)
  }

  const { temperament } = wild.get(WildBehavior)
  const fightChance = GAME_CONFIG.CAPTURE.ESCAPE_FIGHT_CHANCE[temperament] ?? 0
  const reaction = rng() < fightChance ? 'fight' : 'flee'
  if (reaction === 'fight') {
    // Provocada: o alvo é escolhido como em qualquer luta (ameaça, senão o
    // mais perto do lado do jogador).
    perseguirJogador(wild, { provoked: true })
  } else {
    fugirDoJogador(wild)
  }

  events?.emit(
    captureEscaped({
      wild,
      speciesId: wild.get(WildCreature)?.speciesId,
      reaction,
    }),
  )
  return reaction
}

/**
 * Põe o selvagem de pé no ponto da bola: a base da cápsula no chão embaixo
 * dela (`CaptureBall.floorY`).
 */
function placeAtBall(wild, ball) {
  const ballPos = ball.get(Position)
  const { floorY } = ball.get(CaptureBall)
  const species = getSpecies(wild.get(WildCreature)?.speciesId)
  const lift = species?.body ? verticalClearance(species.body) : 0
  const position = { x: ballPos.x, y: floorY + lift, z: ballPos.z }
  wild.set(Position, position)
  if (wild.has(PhysicsBody)) {
    teleportCharacterBody(wild.get(PhysicsBody).bodyHandle, position)
  }
}
