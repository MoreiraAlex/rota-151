import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { EMBER_EMITTERS } from './emberVfx'
import { FLAMETHROWER_EMITTERS } from './flamethrowerVfx'
import { TACKLE_EMITTERS } from './tackleVfx'
import { SCRATCH_EMITTERS } from './scratchVfx'
import { DASH_EMITTERS } from './dashVfx'
import { ABSORB_CHARGE_EMITTERS } from './absorbChargeVfx'
import { STATUP_EMITTERS } from './statupVfx'

// Textura sem imagem — o sistema só mexe em `offset`/`repeat`/filtros, e o
// `clone()` por sprite funciona sem WebGL.
function fakeTextures() {
  return {
    cloud: new THREE.Texture(),
    ember: new THREE.Texture(),
    powder: new THREE.Texture(),
    hit: new THREE.Texture(),
    orb: new THREE.Texture(),
    scratch: new THREE.Texture(),
    lines: new THREE.Texture(),
    smoke: new THREE.Texture(),
  }
}

// Gerador determinístico (LCG) — mesmo resultado a cada execução.
function seededRandom(seed = 1) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function build(overrides = {}) {
  return createParticleSystem({
    emitters: EMBER_EMITTERS,
    textures: fakeTextures(),
    length: 3,
    radius: 0.8,
    scale: 1,
    random: seededRandom(),
    ...overrides,
  })
}

function run(system, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) system.update(step)
}

function liveSprites(system) {
  return system.group.children.filter((sprite) => sprite.visible)
}

describe('createParticleSystem (Brasa)', () => {
  it('começa vazio e, no primeiro passo, a nuvem sai da criatura e o fogo já está no alvo', () => {
    const system = build()
    expect(system.liveCount).toBe(0)

    system.update(1 / 60)
    expect(system.liveCount).toBeGreaterThan(0)
    const zs = liveSprites(system).map((sprite) => sprite.position.z)
    // a nuvem da boca nasce na criatura (0, 0, -length)...
    expect(zs.some((z) => Math.abs(z + 3) < 0.5)).toBe(true)
    // ...e o estouro nasce no alvo (0, 0, 0), no MESMO instante
    expect(zs.some((z) => Math.abs(z) < 0.5)).toBe(true)
  })

  it('o golpe é instantâneo: as brasas cobrem o trajeto inteiro, criatura → alvo, já no primeiro instante (sem viajar)', () => {
    const system = build({ length: 3 })
    system.update(1 / 60)
    const zs = liveSprites(system).map((sprite) => sprite.position.z)

    // espalhadas por todo o trajeto (de -3 a 0), não só perto da boca
    for (const [from, to] of [
      [-3, -2],
      [-2, -1],
      [-1, 0],
    ]) {
      expect(
        zs.filter((z) => z >= from && z < to).length,
        `trecho ${from}..${to}`,
      ).toBeGreaterThan(0)
    }
  })

  it('o estouro no alvo acontece no instante do golpe, não depois', () => {
    const system = build()
    run(system, 0.1)
    const atTarget = liveSprites(system).filter(
      (sprite) => Math.hypot(sprite.position.x, sprite.position.z) < 1.5,
    )
    expect(atTarget.length).toBeGreaterThan(8)
  })

  it('nada do Brasa espera pra chegar no impacto: todo emissor começa em t = 0, exceto as brasas que sobem do alvo (0.1 s)', () => {
    const starts = Object.fromEntries(
      EMBER_EMITTERS.map((emitter) => [emitter.id, emitter.start]),
    )
    expect(starts).toEqual({
      actor: 0,
      stream: 0,
      sparks: 0,
      burst: 0,
      linger: 0.1,
    })
  })

  it('a rajada de faíscas nasce de uma vez, com a contagem do comprimento do golpe', () => {
    const sparks = EMBER_EMITTERS.find((emitter) => emitter.id === 'sparks')
    const system = build({ emitters: [sparks], length: 3 })

    system.update(1 / 60)
    expect(system.liveCount).toBe(7)
    run(system, 0.1)
    // rajada única: não repete nos passos seguintes
    expect(system.liveCount).toBeLessThanOrEqual(7)
  })

  it('a quantidade de faíscas acompanha o comprimento do golpe (rajada calculada)', () => {
    const sparks = EMBER_EMITTERS.find((emitter) => emitter.id === 'sparks')
    const count = (length) => sparks.burst({ length })
    expect(count(1)).toBe(5) // clamp(5, 10, 20) × 0.45
    expect(count(3)).toBe(7)
    expect(count(8)).toBe(9) // teto 20 × 0.45
  })

  it('termina sozinho: sem emissor ativo nem partícula viva, e reaproveita sprites', () => {
    const system = build()
    expect(system.isDone()).toBe(false)
    run(system, 0.2)
    const spritesSoFar = system.group.children.length

    run(system, 3)
    expect(system.isDone()).toBe(true)
    expect(system.liveCount).toBe(0)
    expect(liveSprites(system).length).toBe(0)
    // o pool reaproveita: o total criado não explode com o tempo
    expect(system.group.children.length).toBeLessThan(spritesSoFar + 150)
  })

  it('a escala do golpe aumenta o tamanho das partículas', () => {
    const small = build({ scale: 1 })
    const big = build({ scale: 3 })
    small.update(1 / 60)
    big.update(1 / 60)
    const sizeOf = (system) =>
      Math.max(...liveSprites(system).map((sprite) => sprite.scale.x))
    expect(sizeOf(big)).toBeGreaterThan(sizeOf(small) * 2.5)
  })

  it('dispose remove todos os sprites do grupo', () => {
    const system = build()
    run(system, 0.3)
    expect(system.group.children.length).toBeGreaterThan(0)
    system.dispose()
    expect(system.group.children.length).toBe(0)
  })
})

describe('createParticleSystem (Lança-chamas)', () => {
  const buildFlame = (overrides = {}) =>
    build({ emitters: FLAMETHROWER_EMITTERS, length: 2.5, ...overrides })

  it('o jato sai da criatura e alcança a região do alvo', () => {
    const system = buildFlame()
    run(system, 0.5)
    const zs = liveSprites(system).map((sprite) => sprite.position.z)
    // a ponta do jato passa por perto do impacto (z = 0); a base fica na boca
    expect(Math.max(...zs)).toBeGreaterThan(-1.2)
    expect(Math.min(...zs)).toBeLessThan(-2)
  })

  it('o jato escala com o comprimento do golpe (alcance maior = vai mais longe)', () => {
    const reach = (length) => {
      const system = buildFlame({ length })
      run(system, 0.5)
      // alcance medido a partir da criatura, em z = -length
      return Math.max(
        ...liveSprites(system).map((sprite) => sprite.position.z + length),
      )
    }
    expect(reach(5)).toBeGreaterThan(reach(2.5) * 1.5)
  })

  it('o fogo e o estouro do alvo começam no instante do golpe (o segundo estouro vem aos 0.9 s)', () => {
    const nearTarget = (sprite) =>
      Math.hypot(sprite.position.x, sprite.position.y) < 2 &&
      Math.abs(sprite.position.z) < 0.4

    const system = buildFlame()
    run(system, 0.05)
    // já há fogo no alvo antes de qualquer espera
    expect(liveSprites(system).filter(nearTarget).length).toBeGreaterThan(10)

    const starts = Object.fromEntries(
      FLAMETHROWER_EMITTERS.map((emitter) => [emitter.id, emitter.start]),
    )
    expect(starts.target).toBe(0)
    expect(starts.burst).toBe(0)
    expect(starts.burst2).toBe(0.9)
  })

  it('dura cerca de 2.4 s: ainda vivo aos 2 s e terminado aos 3 s', () => {
    const system = buildFlame()
    run(system, 2)
    expect(system.isDone()).toBe(false)
    run(system, 1)
    expect(system.isDone()).toBe(true)
  })

  it('density menor solta menos partículas', () => {
    const full = buildFlame({ density: 1 })
    const light = buildFlame({ density: 0.5 })
    run(full, 0.8)
    run(light, 0.8)
    expect(light.liveCount).toBeLessThan(full.liveCount * 0.7)
  })
})

describe('createParticleSystem (Tackle)', () => {
  const buildTackle = (overrides = {}) =>
    build({ emitters: TACKLE_EMITTERS, length: 1, ...overrides })

  it('o clarão e as 7 faíscas nascem de uma vez, no ponto de impacto', () => {
    const system = buildTackle()
    expect(system.liveCount).toBe(0)
    system.update(1 / 60)
    expect(system.liveCount).toBe(1 + 7)
    for (const sprite of liveSprites(system)) {
      expect(Math.hypot(sprite.position.x, sprite.position.z)).toBeLessThan(0.3)
    }
    // a rajada não repete nos passos seguintes
    run(system, 0.1)
    expect(system.liveCount).toBeLessThanOrEqual(8)
  })

  it('o clarão tem 1 m e usa o quadro de CIMA da imagem vertical no início', () => {
    const system = buildTackle()
    system.update(1 / 60)
    const flash = liveSprites(system).find((sprite) => sprite.scale.x === 1)
    expect(flash).toBeDefined()
    expect(flash.material.map.repeat.y).toBeCloseTo(1 / 5)
    // quadro 0 (topo) = offset.y 0.8 numa imagem de 5 quadros
    expect(flash.material.map.offset.y).toBeCloseTo(0.8)
  })

  it('as faíscas começam na 3ª linha do atlas de 4 e sobem até a 1ª', () => {
    const system = buildTackle()
    system.update(1 / 60)
    const spark = liveSprites(system).find((sprite) => sprite.scale.x < 0.5)
    expect(spark.material.map.offset.y).toBeCloseTo(0.25)
    run(system, 0.3)
    const later = liveSprites(system).find((sprite) => sprite.scale.x < 0.5)
    expect(later.material.map.offset.y).toBeGreaterThan(0.25)
  })

  it('as faíscas seguem um arco (a gravidade curva a trajetória) e tudo some em ~0.6 s', () => {
    const system = buildTackle()
    run(system, 0.1)
    const spark = liveSprites(system).find((sprite) => sprite.scale.x < 0.5)
    const y1 = spark.position.y
    run(system, 0.1)
    const y2 = spark.position.y
    run(system, 0.1)
    const y3 = spark.position.y
    // segunda diferença negativa = aceleração pra baixo (gravidade -9)
    expect(y3 - 2 * y2 + y1).toBeLessThan(-0.05)

    run(system, 0.5)
    expect(system.isDone()).toBe(true)
  })

  it('a escala do golpe cresce o clarão e as faíscas', () => {
    const big = buildTackle({ scale: 2 })
    big.update(1 / 60)
    expect(
      Math.max(...liveSprites(big).map((sprite) => sprite.scale.x)),
    ).toBeCloseTo(2)
  })
})

describe('createParticleSystem (Scratch)', () => {
  const buildScratch = (overrides = {}) =>
    build({ emitters: SCRATCH_EMITTERS, radius: 0.6, ...overrides })

  it('a marca nasce na hora; as faíscas só 0.05 s depois', () => {
    const system = buildScratch()
    system.update(1 / 60)
    expect(system.liveCount).toBe(1)

    run(system, 0.06)
    expect(system.liveCount).toBe(1 + 7)
  })

  it('a marca fica 0.2 m acima do impacto e meio raio golpe adentro', () => {
    const system = buildScratch({ radius: 0.6 })
    system.update(1 / 60)
    const [mark] = liveSprites(system)
    expect(mark.scale.x).toBeCloseTo(1)
    expect(mark.position.y).toBeCloseTo(0.2, 1)
    expect(mark.position.z).toBeCloseTo(0.3, 1)
    // 7 quadros na vertical: o primeiro é o de cima (offset.y = 1 - 1/7)
    expect(mark.material.map.repeat.y).toBeCloseTo(1 / 7)
    expect(mark.material.map.offset.y).toBeCloseTo(1 - 1 / 7)
  })

  it('o deslocamento para dentro do alvo para em 1 m', () => {
    const system = buildScratch({ radius: 10 })
    system.update(1 / 60)
    const [mark] = liveSprites(system)
    expect(mark.position.z).toBeCloseTo(1, 1)
  })

  it('o giro da marca é 0° ou -90°, e tudo some em ~0.6 s', () => {
    const rotations = new Set()
    for (let seed = 1; seed <= 12; seed++) {
      const system = buildScratch({ random: seededRandom(seed) })
      system.update(1 / 60)
      rotations.add(
        Math.round(liveSprites(system)[0].material.rotation * 1000) / 1000,
      )
      run(system, 0.7)
      expect(system.isDone()).toBe(true)
    }
    expect([...rotations].every((r) => r === 0 || r === -1.571)).toBe(true)
    expect(rotations.size).toBe(2)
  })
})

describe('createParticleSystem — rajada com 0 partículas', () => {
  it('burst: 0 não solta nada e não quebra (não é tratada como emissor de taxa)', () => {
    const empty = {
      ...DASH_EMITTERS[1], // a poeira
      id: 'empty',
      burst: 0,
    }
    const system = build({ emitters: [empty] })

    expect(() => run(system, 0.3)).not.toThrow()
    expect(system.liveCount).toBe(0)
    expect(system.isDone()).toBe(true)
  })
})

describe('createParticleSystem — efeito que acompanha quem se move (dash)', () => {
  const FRAME = { origin: [0, 0, 0], yaw: 0, height: 0.8 }
  const linesOnly = DASH_EMITTERS.filter((emitter) => emitter.id === 'lines')

  function buildDash(overrides = {}) {
    const system = build({
      emitters: DASH_EMITTERS,
      length: 0,
      radius: 0,
      scale: 1,
      ...overrides,
    })
    system.setFrame(FRAME)
    return system
  }

  it('emissor contínuo solta enquanto a emissão não termina, e só então o sistema pode acabar', () => {
    const system = buildDash({ emitters: linesOnly })

    run(system, 0.5)
    expect(system.isDone()).toBe(false)
    const flowing = system.liveCount
    expect(flowing).toBeGreaterThan(10)

    run(system, 1)
    // segue soltando: não esvazia
    expect(system.liveCount).toBeGreaterThan(10)
    expect(system.emissionEnded).toBe(false)
  })

  it('endEmission para de soltar; o que existe termina sozinho (~0.2 s) e aí o sistema acaba', () => {
    const system = buildDash({ emitters: linesOnly })
    run(system, 0.5)

    system.endEmission()
    expect(system.emissionEnded).toBe(true)
    expect(system.isDone()).toBe(false) // ainda tem linha viva

    run(system, 0.3)
    expect(system.liveCount).toBe(0)
    expect(system.isDone()).toBe(true)
  })

  it('a taxa é ~100 linhas por segundo (vida de 0.2 s → ~20 vivas)', () => {
    const system = buildDash({ emitters: linesOnly })
    run(system, 1)

    expect(system.liveCount).toBeGreaterThan(15)
    expect(system.liveCount).toBeLessThan(26)
  })

  it('setFrame: as partículas novas nascem na origem NOVA e as antigas ficam no mundo, pra trás', () => {
    const system = buildDash({ emitters: linesOnly })
    run(system, 0.1)

    // a criatura anda 10 m pra +Z (yaw 0 = +Z)
    system.setFrame({ origin: [0, 0, 10], yaw: 0, height: 0.8 })
    run(system, 0.05)

    const zs = liveSprites(system).map((sprite) => sprite.position.z)
    // há partículas perto da origem velha E perto da nova
    expect(zs.some((z) => Math.abs(z) < 3)).toBe(true)
    expect(zs.some((z) => z > 7)).toBe(true)
  })

  it('o yaw do quadro gira a nuvem: correr pra +X põe as linhas em volta de x, não de z', () => {
    const system = buildDash({ emitters: linesOnly })
    system.setFrame({ origin: [0, 0, 0], yaw: Math.PI / 2, height: 0.8 })
    run(system, 0.3)

    const sprites = liveSprites(system)
    const meanX =
      sprites.reduce((sum, s) => sum + s.position.x, 0) / sprites.length
    const meanZ =
      sprites.reduce((sum, s) => sum + s.position.z, 0) / sprites.length
    // as linhas disparam pra trás (-X, a criatura corre pra +X)
    expect(meanX).toBeLessThan(0.5)
    expect(Math.abs(meanZ)).toBeLessThan(1)
  })

  it('as linhas são quadros esticados (Mesh), não sprites; a poeira é sprite', () => {
    const system = buildDash()
    run(system, 0.1)

    const beams = liveSprites(system).filter((s) => s.isMesh)
    const sprites = liveSprites(system).filter((s) => s.isSprite)
    expect(beams.length).toBeGreaterThan(0)
    expect(sprites.length).toBe(12) // a rajada de poeira
  })

  it('a linha é esticada ao longo do movimento: escala X = comprimento, Y = espessura', () => {
    const system = buildDash({ emitters: linesOnly })
    run(system, 0.1)

    const beam = liveSprites(system)[0]
    expect(beam.scale.x).toBeGreaterThan(beam.scale.y)
    expect(beam.scale.y).toBeCloseTo(0.05)
  })

  it('a face da linha vira pra câmera: mudar a posição da câmera muda a orientação', () => {
    const orientationFor = (cameraPosition) => {
      const system = buildDash({ emitters: linesOnly, random: seededRandom(3) })
      system.setCameraPosition(cameraPosition)
      run(system, 0.1)
      const beam = liveSprites(system)[0]
      return beam.quaternion.clone()
    }

    const fromAbove = orientationFor({ x: 0, y: 10, z: 0 })
    const fromSide = orientationFor({ x: 10, y: 0, z: 0 })

    expect(fromAbove.angleTo(fromSide)).toBeGreaterThan(0.3)
  })

  it('dispose remove tudo, inclusive as linhas', () => {
    const system = buildDash()
    run(system, 0.3)
    system.dispose()
    expect(system.group.children.length).toBe(0)
  })
})

describe('createParticleSystem — statup (atributo subiu, Growth)', () => {
  // nos pés em (0, 0, 0); raio 0.5 = largura 1, igual ao original
  function buildStatup(scale = 1) {
    return build({ emitters: STATUP_EMITTERS, length: 0, radius: 0.5, scale })
  }

  it('nada antes dos 0.1 s (o delay do boost); depois, orbes e riscos', () => {
    const system = buildStatup()
    run(system, 0.08)
    expect(system.liveCount).toBe(0)

    run(system, 0.15)
    const sprites = liveSprites(system)
    expect(sprites.some((s) => s.isSprite)).toBe(true) // orbes
    expect(sprites.some((s) => s.isMesh)).toBe(true) // riscos
  })

  it('os orbes ficam num anel em volta do corpo (até ~0.7 m do centro), acima do chão', () => {
    const system = buildStatup()
    run(system, 0.3)

    const orbs = liveSprites(system).filter((s) => s.isSprite)
    expect(orbs.length).toBeGreaterThan(3)
    for (const orb of orbs) {
      expect(Math.hypot(orb.position.x, orb.position.z)).toBeLessThan(1.0)
      expect(orb.position.y).toBeGreaterThan(-0.2)
    }
  })

  it('termina sozinho em ~1 s (cabe no effectVisualDuration do Growth)', () => {
    const system = buildStatup()
    run(system, 1)
    expect(system.isDone()).toBe(true)
  })

  it('a escala encolhe o efeito inteiro: os riscos sobem menos', () => {
    const highest = (scale) => {
      const system = buildStatup(scale)
      let top = -Infinity
      for (let t = 0; t < 0.6; t += 1 / 60) {
        system.update(1 / 60)
        for (const s of liveSprites(system)) top = Math.max(top, s.position.y)
      }
      return top
    }
    expect(highest(0.5)).toBeLessThan(highest(1) * 0.7)
  })
})

describe('createParticleSystem — carga "absorb" (orbes se fechando no corpo)', () => {
  // pés em (0, 0, 0), corpo de 0.8 m; raio 0.5 = anel de 0.75 m, igual ao original
  function buildAbsorb() {
    const system = build({
      emitters: ABSORB_CHARGE_EMITTERS,
      length: 0,
      radius: 0.5,
      scale: 1,
    })
    system.setFrame({ origin: [0, 0, 0], yaw: 0, height: 0.8 })
    return system
  }

  it('solta orbes enquanto a carga dura, na meia altura do corpo, dentro do anel', () => {
    const system = buildAbsorb()
    run(system, 0.5)

    const orbs = liveSprites(system)
    expect(orbs.length).toBeGreaterThan(5)
    for (const orb of orbs) {
      expect(orb.position.y).toBeCloseTo(0.4)
      expect(Math.hypot(orb.position.x, orb.position.z)).toBeLessThan(1.1)
    }
  })

  it('o anel se fecha: os orbes mais velhos estão mais perto do centro', () => {
    const system = buildAbsorb()
    run(system, 0.05)
    const young = liveSprites(system).map((s) =>
      Math.hypot(s.position.x, s.position.z),
    )
    run(system, 0.55)
    // os nascidos no começo agora têm ~0.6 s: quase no centro
    const radii = liveSprites(system).map((s) =>
      Math.hypot(s.position.x, s.position.z),
    )
    expect(Math.min(...radii)).toBeLessThan(Math.min(...young))
  })

  it('para de soltar no fim da carga (endEmission) e termina sozinho em ~0.7 s', () => {
    const system = buildAbsorb()
    run(system, 1)
    system.endEmission()
    run(system, 0.8)
    expect(system.isDone()).toBe(true)
  })

  it('cada emissor usa a sua linha do atlas (2 linhas): offset.y diferente', () => {
    const system = buildAbsorb()
    run(system, 0.3)
    const offsets = new Set(
      liveSprites(system).map((s) => s.material.map.offset.y),
    )
    expect([...offsets].sort()).toEqual([0, 0.5])
  })
})
