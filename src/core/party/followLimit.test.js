import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  isTooFar,
  quantizeTimeLeft,
  resolveRecallCountdown,
  resolveStrayReason,
  resolveStuckStep,
  resolveTooFarWarning,
} from './followLimit'

const FAR = { recallDistance: 10, cancelMargin: 2 }
const WARNING = { warnDistance: 8, resetDistance: 6 }

describe('resolveStuckStep', () => {
  const watch = { anchorX: 0, anchorZ: 0, stuckTime: 1 }

  it('tentando seguir dentro do círculo, soma o tempo', () => {
    const step = resolveStuckStep(
      watch,
      { x: 0.1, z: 0 },
      { isTrying: true, delta: 0.5, stuckRadius: 1 },
    )
    expect(step.stuckTime).toBe(watch.stuckTime + 0.5)
    expect(step.anchorX).toBe(watch.anchorX)
  })

  it('saiu do círculo: âncora vem pra onde ele está e a conta zera', () => {
    const step = resolveStuckStep(
      watch,
      { x: 3, z: 0 },
      { isTrying: true, delta: 0.5, stuckRadius: 1 },
    )
    expect(step).toEqual({ anchorX: 3, anchorZ: 0, stuckTime: 0 })
  })

  it('sem tentar seguir, não conta', () => {
    const step = resolveStuckStep(
      watch,
      { x: 0, z: 0 },
      { isTrying: false, delta: 0.5, stuckRadius: 1 },
    )
    expect(step.stuckTime).toBe(0)
  })
})

describe('isTooFar', () => {
  it('além do limite, depois de ter chegado perto uma vez', () => {
    expect(isTooFar(11, { ...FAR, joined: true, counting: false })).toBe(true)
    expect(isTooFar(9, { ...FAR, joined: true, counting: false })).toBe(false)
  })

  it('antes de ter chegado perto do grupo, a distância não conta', () => {
    expect(isTooFar(50, { ...FAR, joined: false, counting: false })).toBe(false)
  })

  it('contando, só cancela abaixo do limite menos a folga', () => {
    const counting = { ...FAR, joined: true, counting: true }
    expect(isTooFar(FAR.recallDistance - FAR.cancelMargin / 2, counting)).toBe(
      true,
    )
    expect(isTooFar(FAR.recallDistance - FAR.cancelMargin - 1, counting)).toBe(
      false,
    )
  })
})

describe('resolveStrayReason', () => {
  it('longe → far, mesmo preso', () => {
    expect(resolveStrayReason(true, 5, { stuckTimeLimit: 2 })).toBe('far')
  })

  it('preso pelo tempo limite → stuck', () => {
    expect(resolveStrayReason(false, 2, { stuckTimeLimit: 2 })).toBe('stuck')
  })

  it('perto e andando → nada', () => {
    expect(resolveStrayReason(false, 1, { stuckTimeLimit: 2 })).toBeNull()
  })
})

describe('resolveRecallCountdown', () => {
  const options = { delta: 0.5, warningTime: 3 }

  it('um motivo novo começa a contagem cheia, sem puxar', () => {
    expect(resolveRecallCountdown(false, 0, 'far', options)).toEqual({
      reason: 'far',
      timeLeft: options.warningTime,
      fire: false,
    })
  })

  it('o motivo continuando, desce e puxa no fim', () => {
    const going = resolveRecallCountdown(true, 1, 'far', options)
    expect(going.timeLeft).toBe(1 - options.delta)
    expect(going.fire).toBe(false)
    expect(
      resolveRecallCountdown(true, options.delta, 'far', options).fire,
    ).toBe(true)
  })

  it('o motivo sumindo, cancela', () => {
    expect(resolveRecallCountdown(true, 1, null, options)).toEqual({
      reason: null,
      timeLeft: 0,
      fire: false,
    })
  })

  it('sem tempo de aviso, puxa na hora', () => {
    const now = resolveRecallCountdown(false, 0, 'stuck', {
      ...options,
      warningTime: 0,
    })
    expect(now.fire).toBe(true)
  })
})

describe('resolveTooFarWarning', () => {
  it('liga ao passar da distância de aviso', () => {
    expect(resolveTooFarWarning(9, false, WARNING)).toBe(true)
    expect(resolveTooFarWarning(7, false, WARNING)).toBe(false)
  })

  it('ligado, só apaga abaixo da folga', () => {
    expect(resolveTooFarWarning(7, true, WARNING)).toBe(true)
    expect(resolveTooFarWarning(5, true, WARNING)).toBe(false)
  })
})

describe('quantizeTimeLeft', () => {
  it('arredonda para cima no degrau, sem passar do tempo de verdade por mais de um degrau', () => {
    const step = 0.1
    for (const time of [0, 0.05, 0.1, 1.23, 2.99]) {
      const shown = quantizeTimeLeft(time, step)
      expect(shown).toBeGreaterThanOrEqual(time - 1e-9)
      expect(shown - time).toBeLessThan(step + 1e-9)
    }
  })
})

describe('FOLLOW_LIMIT (config)', () => {
  const { FOLLOW_LIMIT, LEASH_RADIUS } = GAME_CONFIG.PARTY_BEHAVIOR

  it('o limite fica acima da coleira da luta, e a folga de cancelar não passa dela', () => {
    expect(FOLLOW_LIMIT.RECALL_DISTANCE).toBeGreaterThan(LEASH_RADIUS)
    expect(
      FOLLOW_LIMIT.RECALL_DISTANCE - FOLLOW_LIMIT.CANCEL_MARGIN,
    ).toBeGreaterThan(LEASH_RADIUS)
  })

  it('o aviso vem antes do limite, e a folga antes do aviso', () => {
    expect(FOLLOW_LIMIT.WARN_DISTANCE).toBeLessThan(
      FOLLOW_LIMIT.RECALL_DISTANCE,
    )
    expect(FOLLOW_LIMIT.WARN_RESET_DISTANCE).toBeLessThan(
      FOLLOW_LIMIT.WARN_DISTANCE,
    )
  })
})
