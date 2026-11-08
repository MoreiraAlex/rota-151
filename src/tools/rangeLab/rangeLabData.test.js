import { describe, expect, it } from 'vitest'
import {
  buildRangeRings,
  bearingFrom,
  createComparatorRun,
  createPlayWatcher,
  describeBearing,
  equalPowerPan,
  headingOf,
  pointAround,
  resolveSoundRange,
  rightShare,
  stepComparator,
  stepOrbit,
  stepShuttle,
  volumeChanges,
  wrapAngle,
} from './rangeLabData'

// Contas do laboratório de alcance (docs/features/062-spawn-estilo-
// cobblemon.md). Números só de teste.

const RANGE = { refDistance: 2, maxDistance: 10 }

describe('resolveSoundRange', () => {
  it('usa o do config e completa com o padrão', () => {
    expect(resolveSoundRange({ refDistance: 1 }, RANGE)).toEqual({
      refDistance: 1,
      maxDistance: RANGE.maxDistance,
    })
    expect(resolveSoundRange(null, RANGE)).toEqual(RANGE)
  })
})

describe('buildRangeRings', () => {
  it('junta limites no mesmo raio e ordena do menor para o maior', () => {
    const rings = buildRangeRings([
      { radius: 9, label: 'a', color: 'red' },
      { radius: 3, label: 'b', color: 'blue' },
      { radius: 9, label: 'c', color: 'green' },
    ])
    expect(rings.map((ring) => ring.radius)).toEqual([3, 9])
    expect(rings[1].labels).toEqual(['a', 'c'])
  })
})

describe('stepShuttle', () => {
  const path = { from: 2, to: 6, speed: 1 }

  it('anda na direção atual', () => {
    expect(stepShuttle(3, 1, path, 1)).toEqual({ distance: 4, direction: 1 })
  })

  it('vira nas duas pontas, com os limites em qualquer ordem', () => {
    expect(stepShuttle(6, 1, path, 1)).toEqual({ distance: 6, direction: -1 })
    expect(stepShuttle(2, -1, path, 1)).toEqual({ distance: 2, direction: 1 })
    expect(stepShuttle(6, 1, { ...path, from: 6, to: 2 }, 1)).toEqual({
      distance: 6,
      direction: -1,
    })
  })
})

describe('createPlayWatcher', () => {
  const threshold = 0.01
  const out = RANGE.maxDistance + 1
  const inside = RANGE.maxDistance - 1
  const watcher = () =>
    createPlayWatcher({ maxDistance: RANGE.maxDistance, threshold })

  function play(steps) {
    const watch = watcher()
    for (const step of steps) watch.update({ playing: true, ...step })
    return watch.update({ playing: false, distance: out, peak: 0 })
  }

  it('sem som tocando, não há nada a contar', () => {
    expect(
      watcher().update({ playing: false, distance: out, peak: 1 }),
    ).toBeNull()
  })

  it('fora do alcance e com som saindo é estalo', () => {
    const result = play([{ distance: out, peak: threshold * 2 }])
    expect(result.clicked).toBe(true)
    expect(result.peak).toBe(threshold * 2)
    expect(result.distance).toBe(out)
  })

  it('fora do alcance e mudo não é estalo', () => {
    expect(play([{ distance: out, peak: 0 }]).clicked).toBe(false)
  })

  it('dentro do alcance tocar é normal', () => {
    expect(play([{ distance: inside, peak: 1 }]).clicked).toBe(false)
  })

  it('guarda o pico de cada lado e de onde veio no começo', () => {
    const result = play([
      { distance: inside, peak: 0.2, left: 0.1, right: 0.2, bearing: 30 },
      { distance: inside, peak: 0.3, left: 0.3, right: 0.1, bearing: 60 },
    ])
    expect(result.left).toBe(0.3)
    expect(result.right).toBe(0.2)
    expect(result.bearing).toBe(30)
  })

  it('entrar no alcance no meio do som não é estalo', () => {
    const result = play([
      { distance: out, peak: 0 },
      { distance: inside, peak: 1 },
    ])
    expect(result.clicked).toBe(false)
  })
})

// Vista do lab ao abrir: frente em +z, direita em −x.
const FORWARD = { x: 0, z: 1 }
const RIGHT = { x: -1, z: 0 }

describe('em volta da câmera', () => {
  it('o ponto fica na distância pedida, do lado pedido', () => {
    const distance = 7
    for (const angle of [0, 45, -90, 180]) {
      const point = pointAround(distance, angle)
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(distance)
      expect(bearingFrom(FORWARD, RIGHT, point)).toBeCloseTo(
        angle === 180 ? 180 : angle,
      )
    }
  })

  it('o rumo de quem se afasta aponta para o mesmo lado do ponto', () => {
    const point = pointAround(1, 30)
    const heading = headingOf(point)
    expect(Math.sin(heading)).toBeCloseTo(point.x)
    expect(Math.cos(heading)).toBeCloseTo(point.z)
  })

  it('a volta anda no sentido da velocidade e não sai da meia volta', () => {
    expect(stepOrbit(10, 20, 1)).toBe(30)
    expect(stepOrbit(10, -20, 1)).toBe(-10)
    expect(stepOrbit(170, 20, 1)).toBe(-170)
    expect(wrapAngle(-180)).toBe(180)
    expect(wrapAngle(540)).toBe(180)
  })
})

describe('equalPowerPan', () => {
  it('à frente sai igual nos dois lados', () => {
    expect(rightShare(equalPowerPan(0))).toBeCloseTo(0.5)
  })

  it('de um lado sai só naquele lado', () => {
    expect(rightShare(equalPowerPan(90))).toBeCloseTo(1)
    expect(rightShare(equalPowerPan(-90))).toBeCloseTo(0)
  })

  it('vai para o lado aos poucos', () => {
    const shares = [0, 20, 45, 70, 90].map((b) => rightShare(equalPowerPan(b)))
    for (let i = 1; i < shares.length; i += 1) {
      expect(shares[i]).toBeGreaterThan(shares[i - 1])
    }
  })

  it('atrás espelha a frente (esse pan não separa os dois)', () => {
    expect(rightShare(equalPowerPan(180))).toBeCloseTo(0.5)
    expect(rightShare(equalPowerPan(135))).toBeCloseTo(
      rightShare(equalPowerPan(45)),
    )
  })

  it('não mexe no volume total de energia', () => {
    const { left, right } = equalPowerPan(33)
    expect(left ** 2 + right ** 2).toBeCloseTo(1)
  })
})

describe('rightShare e describeBearing', () => {
  it('sem som não há lado', () => {
    expect(rightShare({ left: 0, right: 0 })).toBeNull()
  })

  it('descreve frente, trás e cada lado', () => {
    const tolerance = 5
    expect(describeBearing(2, tolerance)).toBe('à frente')
    expect(describeBearing(-178, tolerance)).toBe('atrás')
    expect(describeBearing(45, tolerance)).toBe('à direita 45°')
    expect(describeBearing(-90, tolerance)).toBe('à esquerda 90°')
  })
})

describe('stepComparator', () => {
  const gap = 1
  const settings = (mode) => ({ mode, gap })

  it('alternando, toca A, espera o som acabar e a pausa, e toca B', () => {
    let step = stepComparator(
      createComparatorRun(),
      settings('alternate'),
      false,
      0.1,
    )
    expect(step.play).toBe('a')

    step = stepComparator(step.run, settings('alternate'), true, 0.1)
    expect(step.play).toBeNull()

    step = stepComparator(step.run, settings('alternate'), false, gap / 2)
    expect(step.play).toBeNull()
    step = stepComparator(step.run, settings('alternate'), false, gap)
    expect(step.play).toBe('b')
  })

  it('só um lado repete sempre o mesmo', () => {
    let step = stepComparator(createComparatorRun(), settings('b'), false, 0.1)
    expect(step.play).toBe('b')
    step = stepComparator(step.run, settings('b'), false, gap * 2)
    expect(step.play).toBe('b')
  })

  it('desligado não toca e recomeça pelo A', () => {
    const step = stepComparator(
      { next: 'b', wait: 5 },
      settings('off'),
      false,
      1,
    )
    expect(step.play).toBeNull()
    expect(step.run).toEqual(createComparatorRun())
  })
})

describe('volumeChanges', () => {
  it('lista só quem ficou diferente do config, na ordem das espécies', () => {
    const config = { x: 0.5, y: 0.5, z: 0.5 }
    const changes = volumeChanges(
      { z: 0.3, x: 0.5, y: 0.7 },
      (id) => config[id],
      ['x', 'y', 'z'],
    )
    expect(changes).toEqual([
      { speciesId: 'y', from: 0.5, to: 0.7 },
      { speciesId: 'z', from: 0.5, to: 0.3 },
    ])
  })
})
