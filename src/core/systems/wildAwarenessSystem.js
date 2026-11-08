import {
  esquecerJogador,
  ficarTranquila,
  perceberJogador,
  perderInteresse,
  perseguirJogador,
  sairDoMapa,
} from '../actions/wildBehavior'
import { resolveAwarenessStep } from '../battle/wildAwareness'
import { isActiveCombatant, listPlayerSide } from '../battle/combatTargets'
import { getSpecies } from '../data/species'
import { lerpAngle } from '../math'
import { gameplayRng } from '../rng'
import {
  BeingCaptured,
  ChunkFrozen,
  Fainted,
  MovementStats,
  Position,
  Rotation,
  Velocity,
  WildAwareness,
  WildBehavior,
  WildCreature,
} from '../traits'

/**
 * Percepção das selvagens (docs/features/063-revisao-da-ia-selvagem.md):
 * cada uma que vaga percebe quem chega do lado do jogador (cone de visão +
 * raio, `core/battle/perception.js`), para encarando com a exclamação e,
 * no fim do alerta, decide pelo temperamento — a hostil parte para cima
 * (antes, se chegarem perto demais), a pacífica sorteia se foge (some do
 * mapa) ou fica. A regra de cada tick é `resolveAwarenessStep`
 * (`core/battle/wildAwareness.js`); aqui só aplica.
 *
 * Também conta o tempo do emote de brava (`emoteTimer`) e, enquanto ela
 * encara (`'noticed'`), segura ela parada e virada para quem viu (o
 * `wildWanderSystem.js` pula quem está encarando).
 *
 * Duas passadas: decide lendo (`readEach`) e aplica depois (as actions
 * escrevem nos traits percorridos).
 *
 * Headless. Fase: simulation, logo antes do `wildBehaviorSystem` (quem
 * partiu para cima ou começou a sair já se move no mesmo tick).
 */
export function wildAwarenessSystem(context) {
  const { world, delta } = context
  const candidates = listPlayerSide(world)

  const steps = []
  world
    .query(WildCreature, WildAwareness, WildBehavior, Position, Rotation)
    .readEach(([creature, awareness, behavior, pos, rot], entity) => {
      if (entity.has(Fainted) || entity.has(BeingCaptured)) return
      if (entity.has(ChunkFrozen)) return
      const step = resolveAwarenessStep({
        awareness,
        behavior,
        pos,
        yaw: rot.y,
        candidates,
        delta,
        species: getSpecies(creature.speciesId),
        rng: gameplayRng,
        isActive: isActiveCombatant,
      })
      if (step) steps.push({ entity, step, pos: { ...pos } })
    })

  for (const { entity, step, pos } of steps) {
    if (step.type === 'notice') perceberJogador(entity, step.target)
    else if (step.type === 'lose') perderInteresse(entity)
    else if (step.type === 'wait') {
      entity.set(WildAwareness, { timer: step.timer })
    } else if (step.type === 'chase') {
      perseguirJogador(entity, { provoked: false })
    } else if (step.type === 'leave') sairDoMapa(entity, pos, step.fromPos)
    else if (step.type === 'stay') ficarTranquila(entity)
    else if (step.type === 'forget') esquecerJogador(entity)
  }

  world
    .query(WildAwareness, Position, Rotation, Velocity, MovementStats)
    .updateEach(([awareness, pos, rot, vel, stats], entity) => {
      if (awareness.emote === 'angry') {
        awareness.emoteTimer -= delta
        if (awareness.emoteTimer <= 0) {
          awareness.emote = null
          awareness.emoteTimer = 0
        }
      }
      if (awareness.state !== 'noticed') return
      if (entity.has(Fainted) || entity.has(BeingCaptured)) return
      vel.x = 0
      vel.z = 0
      const targetPos = awareness.target?.isAlive?.()
        ? awareness.target.get(Position)
        : null
      if (!targetPos) return
      const yaw = Math.atan2(targetPos.x - pos.x, targetPos.z - pos.z)
      rot.y = lerpAngle(rot.y, yaw, stats.turnSpeed * delta)
    })
}
