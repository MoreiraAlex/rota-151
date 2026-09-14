import { describe, it, expect } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { ActionState, Velocity, Rotation, Grounded } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { playerActionSystem } from './playerActionSystem'

const { DURATION, SPEED } = GAME_CONFIG.PLAYER_ACTIONS.dash

function tick(world, input = {}, delta = 1 / 60) {
  playerActionSystem({ world, delta, input })
}

describe('playerActionSystem — dash', () => {
  it('não dispara sem o gatilho de input', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)

    tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('não dispara no ar (sem Grounded)', () => {
    const { world, player } = makeWorld()

    tick(world, { dash: true })

    expect(player.get(ActionState).current).toBe(null)
  })

  it('dispara no chão com o gatilho, e já aplica velocidade de dash no mesmo tick', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })

    const action = player.get(ActionState)
    expect(action.current).toBe('dash')
    expect(action.elapsed).toBeGreaterThan(0)

    const vel = player.get(Velocity)
    expect(Math.hypot(vel.x, vel.z)).toBeCloseTo(SPEED)
  })

  it('ignora um novo gatilho enquanto já está em ação', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })
    const firstDir = { ...player.get(ActionState) }

    // gira e tenta disparar de novo no meio do dash — não deveria trocar
    // a direção travada nem reiniciar o relógio
    player.set(Rotation, { y: Math.PI / 2 })
    tick(world, { dash: true })

    const action = player.get(ActionState)
    expect(action.dirX).toBeCloseTo(firstDir.dirX)
    expect(action.dirZ).toBeCloseTo(firstDir.dirZ)
  })

  it('encerra sozinho depois da duração configurada e devolve o controle', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Rotation, { y: 0 })

    tick(world, { dash: true })

    const steps = Math.ceil(DURATION / (1 / 60)) + 1
    for (let i = 0; i < steps; i++) tick(world, {})

    expect(player.get(ActionState).current).toBe(null)
  })

  it('direção trava no instante do disparo, mesmo que a entidade gire depois', () => {
    const { world, player } = makeWorld()
    player.add(Grounded)
    player.set(Rotation, { y: Math.PI / 2 })

    tick(world, { dash: true })
    const dirAtStart = { ...player.get(ActionState) }

    player.set(Rotation, { y: 0 })
    tick(world, {})

    const action = player.get(ActionState)
    expect(action.dirX).toBeCloseTo(dirAtStart.dirX)
    expect(action.dirZ).toBeCloseTo(dirAtStart.dirZ)
  })
})
