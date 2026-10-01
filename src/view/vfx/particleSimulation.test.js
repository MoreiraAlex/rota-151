import { describe, expect, it } from 'vitest'
import {
  compileGradient,
  consumeSpawns,
  frameAt,
  hexToRgb,
  particleSize,
  resolveBeamBasis,
  rotateY,
  sampleCurve,
  sampleGradient,
  spawnParticle,
  stepParticle,
  stepPathParticle,
} from './particleSimulation'

const constant = (value) => () => value

describe('hexToRgb', () => {
  it('converte #rrggbb em 0..1', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0])
  })
})

describe('sampleGradient', () => {
  const gradient = compileGradient([
    { at: 0.2, color: '#000000' },
    { at: 0.6, color: '#ffffff' },
  ])

  it('segura a cor da ponta antes do 1º e depois do último stop', () => {
    expect(sampleGradient(gradient, 0)).toEqual([0, 0, 0])
    expect(sampleGradient(gradient, 1)).toEqual([1, 1, 1])
  })

  it('interpola linearmente entre dois stops', () => {
    const [r, g, b] = sampleGradient(gradient, 0.4)
    expect(r).toBeCloseTo(0.5)
    expect(g).toBeCloseTo(0.5)
    expect(b).toBeCloseTo(0.5)
  })
})

describe('sampleCurve', () => {
  it('interpola nós igualmente espaçados e trava em 0..1', () => {
    const nodes = [1, 1, 0]
    expect(sampleCurve(nodes, 0)).toBe(1)
    expect(sampleCurve(nodes, 0.5)).toBe(1)
    expect(sampleCurve(nodes, 0.75)).toBeCloseTo(0.5)
    expect(sampleCurve(nodes, 1)).toBe(0)
    expect(sampleCurve(nodes, 2)).toBe(0)
    expect(sampleCurve(nodes, -1)).toBe(1)
  })
})

describe('frameAt', () => {
  const frames = { first: 3, count: 7, fps: 20 }

  it('avança fps quadros por segundo a partir do primeiro', () => {
    expect(frameAt(0, frames)).toBe(3)
    expect(frameAt(0.05, frames)).toBe(4)
  })

  it('segura no último quadro em vez de repetir', () => {
    expect(frameAt(10, frames)).toBe(9)
  })
})

describe('frameAt (stretch e step)', () => {
  it('stretch distribui os quadros ao longo da vida, não por fps', () => {
    const frames = { first: 0, count: 5, step: 1, stretch: true }
    expect(frameAt(0, frames, 0.2)).toBe(0)
    expect(frameAt(0.05, frames, 0.2)).toBe(1)
    expect(frameAt(0.19, frames, 0.2)).toBe(4)
    // além da vida, segura no último
    expect(frameAt(1, frames, 0.2)).toBe(4)
  })

  it('step negativo percorre a sequência de trás pra frente', () => {
    const frames = { first: 2, count: 3, step: -1, stretch: true }
    expect(frameAt(0, frames, 0.3)).toBe(2)
    expect(frameAt(0.11, frames, 0.3)).toBe(1)
    expect(frameAt(0.29, frames, 0.3)).toBe(0)
  })
})

describe('consumeSpawns', () => {
  it('acumula a fração que sobra entre passos', () => {
    let carry = 0
    let total = 0
    for (let i = 0; i < 10; i++) {
      const step = consumeSpawns(carry, 25, 1 / 60)
      carry = step.carry
      total += step.count
    }
    // 25/s por 10 passos de 1/60 s ≈ 4.17 partículas
    expect(total).toBe(4)
    expect(carry).toBeCloseTo(0.1667, 3)
  })
})

describe('spawnParticle / stepParticle', () => {
  const spec = {
    anchor: 'origin',
    direction: () => [0, 0, 2],
    speed: constant(3),
    accel: () => [0, 0, 0],
    drag: constant(0),
    lifetime: constant(1),
    size: (t) => 1 - t,
  }
  const ctx = { age: 0, progress: 0, length: 4, scale: 2, radius: 1 }

  it('nasce na origem do golpe (a criatura), voando na direção normalizada', () => {
    const particle = spawnParticle(spec, ctx, () => 0.5)
    expect([particle.x, particle.y, particle.z]).toEqual([0, 0, -4])
    expect([particle.vx, particle.vy, particle.vz]).toEqual([0, 0, 3])
  })

  it("a âncora 'path' anda da criatura até o impacto conforme o progresso", () => {
    const path = { ...spec, anchor: 'path' }
    expect(spawnParticle(path, { ...ctx, progress: 0 }, () => 0.5).z).toBe(-4)
    expect(spawnParticle(path, { ...ctx, progress: 0.5 }, () => 0.5).z).toBe(-2)
    expect(spawnParticle(path, { ...ctx, progress: 1 }, () => 0.5).z).toBe(0)
  })

  it("a âncora 'line' sorteia o ponto em TODO o trajeto, criatura → impacto (o efeito já nasce espalhado)", () => {
    const line = { ...spec, anchor: 'line' }
    // `ctx.length` = 4: 0 → no impacto, 1 → na criatura
    expect(spawnParticle(line, ctx, () => 0).z).toBeCloseTo(0)
    expect(spawnParticle(line, ctx, () => 0.25).z).toBeCloseTo(-1)
    expect(spawnParticle(line, ctx, () => 0.75).z).toBeCloseTo(-3)
  })

  it('o raio da casca respeita a escala', () => {
    const shell = { ...spec, anchor: 'impact', shellRadius: constant(0.5) }
    const particle = spawnParticle(shell, ctx, () => 0.3)
    expect(Math.hypot(particle.x, particle.y, particle.z)).toBeCloseTo(
      0.5 * ctx.scale,
    )
  })

  it('stepParticle move, aplica aceleração e arrasto, e avisa quando a vida acaba', () => {
    const particle = spawnParticle(spec, ctx, () => 0.5)
    expect(stepParticle(particle, 0.5)).toBe(true)
    expect(particle.z).toBeCloseTo(-4 + 3 * 0.5)

    const dragged = spawnParticle(
      { ...spec, drag: constant(2) },
      ctx,
      () => 0.5,
    )
    stepParticle(dragged, 0.1)
    expect(dragged.vz).toBeCloseTo(3 * (1 - 2 * 0.1))

    const accelerated = spawnParticle(
      { ...spec, speed: constant(0), accel: () => [0, 10, 0] },
      ctx,
      () => 0.5,
    )
    stepParticle(accelerated, 0.1)
    expect(accelerated.vy).toBeCloseTo(1)

    expect(stepParticle(particle, 0.6)).toBe(false)
  })

  it('offset fixo (metros) soma ao ponto de nascimento e cresce com a escala', () => {
    const withOffset = {
      ...spec,
      anchor: 'impact',
      offset: () => [0, 0.2, 0.5],
    }
    const particle = spawnParticle(withOffset, ctx, () => 0.5)
    expect(particle.x).toBeCloseTo(0)
    expect(particle.y).toBeCloseTo(0.2 * ctx.scale)
    expect(particle.z).toBeCloseTo(0.5 * ctx.scale)
  })

  it('spin: true sorteia 0..3 quartos de volta; uma função devolve o valor (inclusive negativo)', () => {
    expect(spawnParticle({ ...spec, spin: true }, ctx, () => 0.99).spin).toBe(3)
    expect(spawnParticle({ ...spec, spin: false }, ctx, () => 0.99).spin).toBe(
      0,
    )
    expect(
      spawnParticle({ ...spec, spin: () => -1 }, ctx, () => 0.5).spin,
    ).toBe(-1)
  })

  it('particleSize aplica a curva do spec e multiplica pela escala', () => {
    const particle = spawnParticle(spec, ctx, () => 0.5)
    expect(particleSize(spec, particle)).toBeCloseTo(1 * 2)
    stepParticle(particle, 0.5)
    expect(particleSize(spec, particle)).toBeCloseTo(0.5 * 2)
  })

  it('particleSize nunca fica negativo', () => {
    const particle = spawnParticle(
      { ...spec, size: () => -0.3 },
      ctx,
      () => 0.5,
    )
    expect(particleSize({ size: () => -0.3 }, particle)).toBe(0)
  })
})

describe('rotateY', () => {
  it('+Z vira a frente (sin yaw, 0, cos yaw); +X vira (cos yaw, 0, -sin yaw)', () => {
    const forward = rotateY([0, 0, 1], Math.PI / 2)
    expect(forward[0]).toBeCloseTo(1)
    expect(forward[2]).toBeCloseTo(0)
    const side = rotateY([1, 0, 0], Math.PI / 2)
    expect(side[0]).toBeCloseTo(0)
    expect(side[2]).toBeCloseTo(-1)
    expect(rotateY([0, 3, 0], 1.2)[1]).toBe(3)
  })
})

describe('spawnParticle com quadro (efeito que acompanha a criatura)', () => {
  const spec = {
    anchor: 'impact',
    offset: () => [0, 0, 1],
    direction: () => [0, 0, 1],
    speed: () => 2,
    accel: () => [0, 0, 3],
    drag: () => 0,
    lifetime: () => 1,
    size: () => 1,
  }
  const base = { age: 0, progress: 0, length: 0, scale: 1, radius: 0 }

  it('sem quadro, tudo fica no referencial local (como sempre)', () => {
    const particle = spawnParticle(spec, base, () => 0.5)
    expect([particle.x, particle.y, particle.z]).toEqual([0, 0, 1])
    expect([particle.vx, particle.vy, particle.vz]).toEqual([0, 0, 2])
  })

  it('com quadro, nasce no MUNDO: origem + posição girada pelo yaw; velocidade e aceleração giram junto', () => {
    const frame = { origin: [10, 0.5, -4], yaw: Math.PI / 2, height: 1 }
    const particle = spawnParticle(spec, { ...base, frame }, () => 0.5)

    // local (0,0,1) girado 90° vira (1,0,0); soma a origem
    expect(particle.x).toBeCloseTo(11)
    expect(particle.y).toBeCloseTo(0.5)
    expect(particle.z).toBeCloseTo(-4)
    expect(particle.vx).toBeCloseTo(2)
    expect(particle.vz).toBeCloseTo(0)
    expect(particle.ax).toBeCloseTo(3)
    expect(particle.az).toBeCloseTo(0)
  })

  it('o offset do spec recebe os randoms da partícula (rnd) e a escala', () => {
    let received
    const withRnd = {
      ...spec,
      offset: (ctx, rnd) => {
        received = rnd
        return [rnd[4], 0, 0]
      },
    }
    const particle = spawnParticle(withRnd, { ...base, scale: 2 }, () => 0.25)

    expect(received).toHaveLength(10)
    expect(particle.x).toBeCloseTo(0.25 * 2)
  })
})

describe('particleSize — linha de velocidade', () => {
  it('um spec que devolve [comprimento, espessura] volta as duas medidas, com a escala', () => {
    const spec = { size: () => [0.6, 0.05] }
    const particle = { age: 0, life: 1, rnd: [], scale: 2 }
    expect(particleSize(spec, particle)).toEqual([1.2, 0.1])
  })

  it('nunca negativo, em nenhuma das medidas', () => {
    const spec = { size: () => [-1, 0.05] }
    const particle = { age: 0, life: 1, rnd: [], scale: 1 }
    expect(particleSize(spec, particle)).toEqual([0, 0.05])
  })
})

describe('resolveBeamBasis (linha de velocidade, `lookat_direction`)', () => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

  it('o eixo X vai ao longo do movimento, a face (Z) olha pra câmera, e os três são ortonormais', () => {
    const basis = resolveBeamBasis([0, 0, -2], [3, 1, 4])

    expect(basis.x).toEqual([0, 0, -1])
    // Z = parte de toCamera perpendicular ao movimento (3, 1, 0), normalizada
    expect(basis.z[0]).toBeCloseTo(3 / Math.hypot(3, 1))
    expect(basis.z[1]).toBeCloseTo(1 / Math.hypot(3, 1))
    expect(basis.z[2]).toBeCloseTo(0)
    expect(dot(basis.x, basis.y)).toBeCloseTo(0)
    expect(dot(basis.x, basis.z)).toBeCloseTo(0)
    expect(dot(basis.y, basis.z)).toBeCloseTo(0)
    for (const axis of [basis.x, basis.y, basis.z]) {
      expect(Math.hypot(...axis)).toBeCloseTo(1)
    }
  })

  it('movimento alinhado com a visão não degenera: cai num eixo perpendicular qualquer', () => {
    const basis = resolveBeamBasis([0, 0, 1], [0, 0, 5])

    expect(dot(basis.x, basis.z)).toBeCloseTo(0)
    expect(Math.hypot(...basis.z)).toBeCloseTo(1)
    expect(Math.hypot(...basis.y)).toBeCloseTo(1)
  })
})

describe('spawnParticle / stepPathParticle — movimento por trajetória (path)', () => {
  // Sobe 1 m por segundo de idade e anda `radius` pra frente (+Z).
  const SPEC = {
    anchor: 'impact',
    path: (age, particle) => [0, age, particle.emitter.radius],
    lifetime: () => 1,
    size: () => 0.1,
  }
  const CTX = {
    age: 0,
    progress: 0,
    length: 0,
    radius: 0.5,
    scale: 2,
    height: 1,
    frame: { origin: [10, 0, 0], yaw: Math.PI / 2, height: 1 },
  }

  it('nasce em anchor + path(0), girado pelo yaw e multiplicado pela escala', () => {
    const particle = spawnParticle(SPEC, CTX, () => 0.5)
    // path(0) = [0, 0, 0.5] → ×2 = 1 m pra frente; yaw 90° → frente = +X
    expect(particle.x).toBeCloseTo(11)
    expect(particle.y).toBeCloseTo(0)
    expect(particle.z).toBeCloseTo(0)
  })

  it('a posição segue a função da idade, sem velocidade nem gravidade', () => {
    const particle = spawnParticle(SPEC, CTX, () => 0.5)
    expect(stepPathParticle(SPEC, particle, 0.5)).toBe(true)
    expect(particle.y).toBeCloseTo(1) // 0.5 s × 1 m/s × escala 2
    expect(particle.x).toBeCloseTo(11)

    expect(stepPathParticle(SPEC, particle, 0.6)).toBe(false) // passou da vida
  })
})
