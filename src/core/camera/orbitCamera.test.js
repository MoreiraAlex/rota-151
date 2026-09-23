import { describe, it, expect, afterEach } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  initPhysics,
  disposePhysics,
  stepPhysics,
} from '../physics/physicsWorld'
import { createStaticLevel } from '../physics/colliders'
import {
  computeOrbitOffset,
  computeCameraPosition,
  computeLookAtPoint,
  computeAimRay,
  resolveCameraCollision,
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

describe('computeCameraPosition — targetHeight por espécie (docs/features/026-preparo-do-treinador-boy.md)', () => {
  const target = { x: 1, y: 2, z: -3 }
  const orbit = { yaw: 0, pitch: 0, distance: 10 }

  it('sem targetHeight explícito, usa o default global (mesmo comportamento de antes)', () => {
    const point = computeCameraPosition(target, orbit)
    expect(point.y).toBeCloseTo(target.y + GAME_CONFIG.CAMERA.TARGET_HEIGHT)
  })

  it('targetHeight explícito substitui o default — criatura mais baixa que o padrão global', () => {
    const point = computeCameraPosition(target, orbit, 0.4)
    expect(point.y).toBeCloseTo(target.y + 0.4)
    expect(point.y).not.toBeCloseTo(target.y + GAME_CONFIG.CAMERA.TARGET_HEIGHT)
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

  it('targetHeight/shoulderOffset explícitos substituem os defaults globais (docs/features/026-preparo-do-treinador-boy.md)', () => {
    const point = computeLookAtPoint(target, orbit, 1, 0.4, 0.1)

    expect(point.x).toBeCloseTo(target.x + 0.1)
    expect(point.y).toBeCloseTo(target.y + 0.4)
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

  it('targetHeight/shoulderOffset explícitos substituem os defaults globais (docs/features/026-preparo-do-treinador-boy.md) — criatura mais baixa/sem desvio de ombro', () => {
    const orbit = { yaw: 0, pitch: 0, distance: 10 }
    const { origin, direction } = computeAimRay(
      target,
      orbit,
      undefined,
      0.4,
      0,
    )

    expect(origin.y).toBeCloseTo(target.y + 0.4)
    // shoulderOffset 0 — sem desvio, mira reto pro alvo (direção puramente
    // no eixo Z, sem componente X).
    expect(direction.x).toBeCloseTo(0)
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

describe('resolveCameraCollision', () => {
  it('sem física carregada (castRay sempre null), devolve a posição não-colidida sem alteração', () => {
    const pivot = { x: 0, y: 0, z: 0 }
    const uncollided = { x: 0, y: 0, z: 10 }

    const result = resolveCameraCollision(pivot, uncollided, undefined, {
      COLLISION_MARGIN: 0.3,
      MIN_DISTANCE_AFTER_COLLISION: 0.5,
    })

    expect(result).toEqual(uncollided)
  })

  describe('com física real', () => {
    afterEach(() => {
      disposePhysics()
    })

    it('puxa a posição pra logo antes do chão em vez de atravessar', async () => {
      await initPhysics()
      createStaticLevel() // chão com a superfície em y=0
      stepPhysics() // broad-phase só existe depois de um step (ver raycast.js)

      const pivot = { x: 0, y: 2, z: 0 }
      const uncollided = { x: 0, y: -5, z: 0 } // bem abaixo do chão

      const result = resolveCameraCollision(pivot, uncollided, undefined, {
        COLLISION_MARGIN: 0.3,
        MIN_DISTANCE_AFTER_COLLISION: 0.5,
      })

      // Bateu no chão (y=0) a 2 unidades do pivô — resultado fica a
      // (2 - COLLISION_MARGIN) = 1.7 do pivô, não nas -5 originais.
      expect(result.y).toBeCloseTo(2 - 1.7)
      expect(result.y).toBeGreaterThan(0) // acima do chão, não atravessou
    })
  })
})

describe('computeAimRay — colisão da câmera (bug real, relatado jogando)', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('pitch extremo faria a câmera IDEAL ficar dentro do chão — a origem da mira usa a posição JÁ corrigida, não a ideal', async () => {
    await initPhysics()
    createStaticLevel()
    stepPhysics()

    const target = { x: 0, y: 1, z: 0 }
    // MIN_PITCH (olhando pro céu) + distância máxima — a posição IDEAL da
    // câmera (sem colisão) fica bem abaixo do chão (y=0) com esses
    // valores, mesma configuração que causava o arremesso saindo em
    // direção completamente errada (relatado jogando).
    const orbit = {
      yaw: 0,
      pitch: GAME_CONFIG.CAMERA.MIN_PITCH,
      distance: GAME_CONFIG.CAMERA.MAX_DISTANCE,
    }

    const { origin } = computeAimRay(target, orbit)

    expect(origin.y).toBeGreaterThan(0) // corrigida — não afundada no chão
  })
})
