import { POKEBALL_SOUNDS } from '@/core/data/audio/pokeballSounds'
import {
  CaptureBall,
  Position,
  RecallBeam,
  SummonBall,
  SummonBallOpen,
} from '@/core/traits'
import { playWorldSound } from '../audio/worldSounds'
import { requestPokeballVfx } from '../vfx/pokeballVfxQueue'
import {
  resolveBallGoneMoments,
  resolveBallSoundMoments,
} from '../audio/pokeballSoundMoments'

// O que a view já viu de cada bola (estado de tela): a fase e os contadores
// da bola de captura, e quais bolas/feixes do invocar/recolher já tocaram.
const seenCapture = new Map()
const seenOnce = new Set()

/**
 * Sons e partículas da Pokébola (docs/features/043-captura.md): os sons
 * (`POKEBALL_SOUNDS`, `playWorldSound`) e as partículas do Cobblemon
 * (`requestPokeballVfx` — a bola abrindo no invocar e no escape, e o
 * "Capturado!"), no ponto em que acontecem:
 *
 * - bola de captura: pelas mudanças de fase e contadores
 *   (`resolveBallSoundMoments`) — sair da mão, acertar e abrir, fechar,
 *   bater no chão, cada balançada, capturado, escapou; a que errou, ao
 *   quicar e ao quebrar (quando some);
 * - invocar: a bola sair da mão (`SummonBall` nova) e abrir em cima da
 *   criatura (`SummonBallOpen` nova);
 * - recolher: o feixe (`RecallBeam` novo), na mão do treinador.
 *
 * Fase: presentation.
 */
export function pokeballFeedbackSystem(context) {
  const { world } = context
  const alive = new Set()

  world.query(CaptureBall, Position).readEach(([ball, pos], entity) => {
    alive.add(entity)
    const seen = seenCapture.get(entity) ?? null
    for (const moment of resolveBallSoundMoments(seen, ball)) {
      playWorldSound(POKEBALL_SOUNDS[moment], pos)
      requestMomentVfx(moment, ball.itemId, pos)
    }
    seenCapture.set(entity, {
      state: ball.state,
      shakes: ball.shakes,
      landings: ball.landings,
      position: { x: pos.x, y: pos.y, z: pos.z },
    })
  })
  for (const [entity, seen] of seenCapture) {
    if (alive.has(entity)) continue
    for (const moment of resolveBallGoneMoments(seen)) {
      playWorldSound(POKEBALL_SOUNDS[moment], seen.position)
    }
    seenCapture.delete(entity)
  }

  const current = new Set()
  playOnce(world, SummonBall, current, (entity) => [
    POKEBALL_SOUNDS.throw,
    entity.get(Position),
  ])
  playOnce(world, SummonBallOpen, current, (entity) => {
    const position = entity.get(Position)
    requestPokeballVfx({
      kind: 'sendOut',
      itemId: entity.get(SummonBallOpen).itemId,
      position: { ...position },
    })
    return [POKEBALL_SOUNDS.sendOut, position]
  })
  playOnce(world, RecallBeam, current, (entity) => {
    const beam = entity.get(RecallBeam)
    // Só o recolher: o invocar já toca o `sendOut`, e a captura o `open`.
    return [
      beam.mode === 'recall' ? POKEBALL_SOUNDS.recall : null,
      { x: beam.fromX, y: beam.fromY, z: beam.fromZ },
    ]
  })
  for (const entity of seenOnce) {
    if (!current.has(entity)) seenOnce.delete(entity)
  }
}

// Partículas de um momento da bola de captura: capturado → o "Capturado!";
// escapou → a bola abrindo (envio).
function requestMomentVfx(moment, itemId, pos) {
  const position = { x: pos.x, y: pos.y, z: pos.z }
  if (moment === 'caught') {
    requestPokeballVfx({ kind: 'capture', itemId, position })
  } else if (moment === 'break') {
    requestPokeballVfx({ kind: 'sendOut', itemId, position })
  }
}

// Toca uma vez por entidade nova de `trait`.
function playOnce(world, trait, current, resolve) {
  world.query(trait, Position).forEach((entity) => {
    current.add(entity)
    if (seenOnce.has(entity)) return
    seenOnce.add(entity)
    const [sound, position] = resolve(entity)
    playWorldSound(sound, position)
  })
}
