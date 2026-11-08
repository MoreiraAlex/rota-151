import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { resolveAwarenessStep } from './wildAwareness'

const { AGGRO_RADIUS, PERCEPTION } = GAME_CONFIG.WILD_BEHAVIOR
const { VIEW_DISTANCE, NEAR_RADIUS, FORGET_RADIUS, ALERT_TIME } = PERCEPTION
const POS = { x: 0, z: 0 }
// À frente (yaw 0 → +Z), fora do raio de aggro mas dentro da visão.
const SEEN_DISTANCE = Math.min(AGGRO_RADIUS + 1, VIEW_DISTANCE - 0.5)
const front = (distance) => ({ x: 0, z: distance })
const behind = (distance) => ({ x: 0, z: -distance })

function step(overrides = {}) {
  return resolveAwarenessStep({
    awareness: { state: 'unaware', target: null, timer: 0 },
    behavior: { temperament: 'hostile', state: 'wander' },
    pos: POS,
    yaw: 0,
    candidates: [{ entity: 'jogador', pos: front(SEEN_DISTANCE) }],
    delta: 0.1,
    species: {},
    rng: () => 0.5,
    isActive: () => true,
    ...overrides,
  })
}

const noticed = (timer = ALERT_TIME) => ({
  state: 'noticed',
  target: 'jogador',
  timer,
})

describe('resolveAwarenessStep — perceber', () => {
  it('sem ter visto ninguém, percebe quem está no cone', () => {
    expect(step()).toEqual({ type: 'notice', target: 'jogador' })
  })

  it('quem está atrás e longe não é percebido', () => {
    expect(
      step({
        candidates: [{ entity: 'jogador', pos: behind(NEAR_RADIUS + 2) }],
      }),
    ).toBeNull()
  })

  it('perseguindo ou saindo, a percepção não decide nada', () => {
    for (const state of ['chase', 'leave']) {
      expect(step({ behavior: { temperament: 'hostile', state } })).toBeNull()
    }
  })
})

describe('resolveAwarenessStep — encarando', () => {
  it('continua encarando enquanto o alerta corre', () => {
    const result = step({ awareness: noticed() })
    expect(result.type).toBe('wait')
    expect(result.timer).toBeLessThan(ALERT_TIME)
  })

  it('quem ela via saiu da percepção: perde o interesse', () => {
    expect(
      step({
        awareness: noticed(),
        candidates: [{ entity: 'jogador', pos: front(VIEW_DISTANCE + 2) }],
      }),
    ).toEqual({ type: 'lose' })
    expect(step({ awareness: noticed(), isActive: () => false })).toEqual({
      type: 'lose',
    })
  })

  it('hostil: parte pra cima no fim do alerta', () => {
    expect(step({ awareness: noticed(0.05) })).toEqual({ type: 'chase' })
  })

  it('hostil: chegar perto demais adianta o ataque', () => {
    expect(
      step({
        awareness: noticed(),
        candidates: [{ entity: 'jogador', pos: front(AGGRO_RADIUS * 0.5) }],
      }),
    ).toEqual({ type: 'chase' })
  })

  it('pacífica: perto demais não adianta nada', () => {
    const result = step({
      awareness: noticed(),
      behavior: { temperament: 'peaceful', state: 'wander' },
      candidates: [{ entity: 'jogador', pos: front(AGGRO_RADIUS * 0.5) }],
    })
    expect(result.type).toBe('wait')
  })

  it('pacífica: no fim do alerta foge ou fica pela chance da espécie', () => {
    const peaceful = { temperament: 'peaceful', state: 'wander' }
    const fled = step({
      awareness: noticed(0.05),
      behavior: peaceful,
      species: { wild: { fleeChance: 1 } },
    })
    expect(fled.type).toBe('leave')
    expect(fled.fromPos).toEqual({ x: 0, z: SEEN_DISTANCE })

    expect(
      step({
        awareness: noticed(0.05),
        behavior: peaceful,
        species: { wild: { fleeChance: 0 } },
      }),
    ).toEqual({ type: 'stay' })
  })
})

describe('resolveAwarenessStep — depois de reagir', () => {
  const reacted = { state: 'reacted', target: null, timer: 0 }

  it('não percebe de novo com alguém por perto; esquece quando todos saem', () => {
    const peaceful = { temperament: 'peaceful', state: 'wander' }
    expect(step({ awareness: reacted, behavior: peaceful })).toBeNull()
    expect(
      step({
        awareness: reacted,
        behavior: peaceful,
        candidates: [{ entity: 'jogador', pos: front(FORGET_RADIUS + 1) }],
      }),
    ).toEqual({ type: 'forget' })
    expect(
      step({ awareness: reacted, behavior: peaceful, candidates: [] }),
    ).toEqual({ type: 'forget' })
  })

  it('hostil que já reagiu volta pra cima de quem chega perto demais', () => {
    expect(
      step({
        awareness: reacted,
        candidates: [{ entity: 'jogador', pos: behind(AGGRO_RADIUS * 0.5) }],
      }),
    ).toEqual({ type: 'chase' })
  })
})
