import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  computeOrbitOffset,
  computeLookAtPoint,
  computeAimRay,
} from './orbitCamera'

describe('computeOrbitOffset', () => {
  it('yaw=0, pitch=0 — câmera atrás no eixo +Z (frente do mundo é -Z)', () => {
    const offset = computeOrbitOffset({ yaw: 0, pitch: 0, distance: 10 })
    expect(offset.x).toBeCloseTo(0)
    expect(offset.y).toBeCloseTo(0)
    expect(offset.z).toBeCloseTo(10)
  })

  it('yaw=π/2, pitch=0 — câmera desloca pro eixo +X', () => {
    const offset = computeOrbitOffset({
      yaw: Math.PI / 2,
      pitch: 0,
      distance: 10,
    })
    expect(offset.x).toBeCloseTo(10)
    expect(offset.y).toBeCloseTo(0)
    expect(offset.z).toBeCloseTo(0)
  })

  it('pitch=π/2 — câmera sobe (offset todo em Y), independente do yaw', () => {
    const offset = computeOrbitOffset({
      yaw: 1.2,
      pitch: Math.PI / 2,
      distance: 5,
    })
    expect(offset.x).toBeCloseTo(0)
    expect(offset.y).toBeCloseTo(5)
    expect(offset.z).toBeCloseTo(0)
  })

  it('módulo do deslocamento é sempre igual à distância, pra qualquer ângulo', () => {
    const cases = [
      { yaw: 0.3, pitch: 0.2, distance: 8 },
      { yaw: -1.7, pitch: 0.6, distance: 20 },
      { yaw: Math.PI, pitch: -0.4, distance: 3 },
    ]
    for (const orbit of cases) {
      const offset = computeOrbitOffset(orbit)
      const magnitude = Math.hypot(offset.x, offset.y, offset.z)
      expect(magnitude).toBeCloseTo(orbit.distance)
    }
  })
})

describe('computeLookAtPoint', () => {
  const target = { x: 1, y: 2, z: -3 }
  const orbit = { yaw: 0, pitch: 0, distance: 10 }

  it('aimBlend: 1 (mira completa), yaw=0 — desloca pro eixo +X (direita da câmera), altura de mira em Y', () => {
    const point = computeLookAtPoint(target, orbit, 1)
    const { TARGET_HEIGHT, SHOULDER_OFFSET } = GAME_CONFIG.CAMERA

    expect(point.x).toBeCloseTo(target.x + SHOULDER_OFFSET)
    expect(point.y).toBeCloseTo(target.y + TARGET_HEIGHT)
    expect(point.z).toBeCloseTo(target.z)
  })

  it('aimBlend: 0 (sem mirar), olha direto pro alvo — sem desvio de ombro', () => {
    const point = computeLookAtPoint(target, orbit, 0)
    const { TARGET_HEIGHT } = GAME_CONFIG.CAMERA

    expect(point.x).toBeCloseTo(target.x)
    expect(point.y).toBeCloseTo(target.y + TARGET_HEIGHT)
    expect(point.z).toBeCloseTo(target.z)
  })

  it('aimBlend intermediário (transição suave) aplica uma fração do desvio de ombro', () => {
    const point = computeLookAtPoint(target, orbit, 0.5)
    const { SHOULDER_OFFSET } = GAME_CONFIG.CAMERA

    expect(point.x).toBeCloseTo(target.x + SHOULDER_OFFSET * 0.5)
  })

  it('mirando, não depende da distância nem do pitch — só do yaw (direção horizontal)', () => {
    const a = computeLookAtPoint(
      target,
      { yaw: 0.7, pitch: 0.1, distance: 5 },
      1,
    )
    const b = computeLookAtPoint(
      target,
      { yaw: 0.7, pitch: 0.6, distance: 30 },
      1,
    )

    expect(a).toEqual(b)
  })
})

describe('computeAimRay', () => {
  const target = { x: 1, y: 2, z: -3 }

  it('origem é o alvo + altura de mira + deslocamento da órbita', () => {
    const orbit = { yaw: 0, pitch: 0, distance: 10 }
    const { origin } = computeAimRay(target, orbit)

    expect(origin.x).toBeCloseTo(target.x)
    expect(origin.y).toBeCloseTo(target.y + GAME_CONFIG.CAMERA.TARGET_HEIGHT)
    expect(origin.z).toBeCloseTo(target.z + 10)
  })

  it('direção aponta pro ponto de mira, não pro alvo em si — o desvio de ombro puxa a mira pra fora do personagem', () => {
    const orbit = { yaw: 0, pitch: 0, distance: 10 }
    const { direction } = computeAimRay(target, orbit)
    const { SHOULDER_OFFSET } = GAME_CONFIG.CAMERA
    const length = Math.hypot(SHOULDER_OFFSET, 10)

    expect(direction.x).toBeCloseTo(SHOULDER_OFFSET / length)
    expect(direction.y).toBeCloseTo(0)
    expect(direction.z).toBeCloseTo(-10 / length)
  })

  it('pitch positivo (olhando pra baixo) dá direção com Y negativo', () => {
    const orbit = { yaw: 0, pitch: 0.4, distance: 10 }
    const { direction } = computeAimRay(target, orbit)

    expect(direction.y).toBeLessThan(0)
  })

  it('a direção é sempre um vetor unitário, pra qualquer órbita/distância', () => {
    const cases = [
      { yaw: 0.3, pitch: 0.2, distance: 8 },
      { yaw: -1.7, pitch: 0.6, distance: 20 },
      { yaw: Math.PI, pitch: -0.4, distance: 3 },
    ]
    for (const orbit of cases) {
      const { direction } = computeAimRay(target, orbit)
      const magnitude = Math.hypot(direction.x, direction.y, direction.z)
      expect(magnitude).toBeCloseTo(1)
    }
  })

  it('quanto maior a distância da câmera, menor o efeito do desvio de ombro (converge pro paralelo à câmera)', () => {
    // SHOULDER_OFFSET é fixo, mas a origem se afasta com a distância — o
    // desvio (em ângulo) que ele causa na direção encolhe conforme a
    // câmera se afasta, ao contrário de antes (v0.0.16 original, sem
    // ombro), quando a direção não dependia da distância nenhuma.
    // Fixado aqui (em vez de usar o valor ao vivo de GAME_CONFIG) porque
    // o teste só faz sentido com um desvio de ombro não-nulo — o valor
    // "de produção" é ajustável ao vivo pelo painel de configurações e já
    // chegou a ficar em 0 (sem desvio nenhum), o que quebraria esta
    // asserção por motivo nenhum ligado à própria fórmula testada.
    const original = GAME_CONFIG.CAMERA.SHOULDER_OFFSET
    GAME_CONFIG.CAMERA.SHOULDER_OFFSET = 0.4

    try {
      const near = computeAimRay(target, {
        yaw: 0,
        pitch: 0,
        distance: 5,
      }).direction
      const far = computeAimRay(target, {
        yaw: 0,
        pitch: 0,
        distance: 50,
      }).direction

      expect(Math.abs(far.x)).toBeLessThan(Math.abs(near.x))
    } finally {
      GAME_CONFIG.CAMERA.SHOULDER_OFFSET = original
    }
  })
})
