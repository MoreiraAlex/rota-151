import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createParticleSystem } from './particleEmitter'
import { GAME_CONFIG } from '@/core/gameConfig'
import { buildDashEmitters, DASH_EMITTERS, DASH_TEXTURE_PATHS } from './dashVfx'
import { buildJumpDustEmitters } from './jumpDustVfx'
import { buildWaterSplashEmitters } from './waterSplashVfx'

function seededRandom(seed = 1) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function buildDash(overrides = {}) {
  const system = createParticleSystem({
    emitters: DASH_EMITTERS,
    textures: {
      lines: new THREE.Texture(),
      smoke: new THREE.Texture(),
      drop: new THREE.Texture(),
    },
    length: 0,
    radius: 0,
    scale: 1,
    random: seededRandom(),
    ...overrides,
  })
  system.setFrame({ origin: [0, 0, 0], yaw: 0, height: 0.8 })
  return system
}

function run(system, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) system.update(step)
}

const live = (system) => system.group.children.filter((s) => s.visible)

describe('DASH_EMITTERS', () => {
  it('tem as texturas das linhas, das ondas de ar, da poeira e do respingo; linhas e poeira', () => {
    expect(Object.keys(DASH_TEXTURE_PATHS)).toEqual([
      'lines',
      'wave',
      'smoke',
      'drop',
    ])
    expect(DASH_EMITTERS.map((e) => e.id)).toEqual(['lines', 'dust'])
  })

  it('a poeira é a mesma do pulo (docs/features/057-lagos-e-rios.md)', () => {
    const [, dust] = DASH_EMITTERS
    const [ring] = buildJumpDustEmitters()
    expect(dust.texture).toBe(ring.texture)
    expect(dust.tint).toEqual(ring.tint)
  })

  it('na água, o respingo no lugar da poeira; as linhas continuam', () => {
    const wet = buildDashEmitters({ water: true })
    const ids = wet.map((e) => e.id)
    expect(ids[0]).toBe('lines')
    expect(ids).not.toContain('dust')
    expect(ids.slice(1)).toEqual(buildWaterSplashEmitters().map((e) => e.id))
  })

  it('as linhas são contínuas (duram o dash inteiro); a poeira é uma rajada de 12 na saída', () => {
    const [lines, dust] = DASH_EMITTERS
    expect(lines.continuous).toBe(true)
    expect(lines.facing).toBe('direction')
    expect(dust.burst).toBe(12)
    expect(dust.start).toBe(0)
  })

  it('a poeira nasce no chão (altura 0), as linhas ao redor do corpo (meia altura)', () => {
    const system = buildDash()
    run(system, 0.05)
    const dust = live(system).filter((s) => s.isSprite)
    const lines = live(system).filter((s) => s.isMesh)

    expect(dust.length).toBe(12)
    for (const puff of dust) expect(puff.position.y).toBeLessThan(0.3)
    const meanLineY =
      lines.reduce((sum, s) => sum + s.position.y, 0) / lines.length
    // meia altura do corpo (0.4) ± o raio da nuvem
    expect(meanLineY).toBeGreaterThan(0.1)
    expect(meanLineY).toBeLessThan(1)
  })

  it('as linhas disparam pra TRÁS do movimento: com a criatura correndo pra +Z, vão pra -Z', () => {
    const system = buildDash()
    system.update(1 / 60)
    run(system, 0.1)

    const lines = live(system).filter((s) => s.isMesh)
    // nasceram 1 m à frente (esfera de raio 1) e foram pra trás: a média cai
    const spawnZ = 1
    const meanZ = lines.reduce((sum, s) => sum + s.position.z, 0) / lines.length
    expect(meanZ).toBeLessThan(spawnZ)
  })

  it('a poeira se espalha em volta dos pés, como a do pulo', () => {
    const system = buildDash({ emitters: [DASH_EMITTERS[1]] })
    system.update(1 / 60)
    const spread = () =>
      live(system).reduce(
        (sum, s) => sum + Math.hypot(s.position.x, s.position.z),
        0,
      ) / live(system).length
    const start = spread()
    run(system, 0.2)
    expect(spread()).toBeGreaterThan(start)
  })

  it('a escala (GAME_CONFIG...DASH_EFFECT.SCALE) encolhe o efeito: raio e tamanho', () => {
    const spread = (scale) => {
      const system = buildDash({ scale })
      run(system, 0.1)
      const xs = live(system).map((s) => Math.abs(s.position.x))
      return Math.max(...xs)
    }
    expect(spread(0.5)).toBeLessThan(spread(1))
  })

  it('o dash acabou: terminar a emissão faz tudo sumir em ~1.3 s (a poeira é a mais longa)', () => {
    const system = buildDash()
    run(system, 0.5)
    system.endEmission()

    run(system, 1.5)
    expect(system.isDone()).toBe(true)
  })
})

describe('buildDashEmitters — quantidade e tamanho das linhas vêm da config', () => {
  function liveLines(options, seconds = 1) {
    const system = buildDash({ emitters: buildDashEmitters(options) })
    run(system, seconds)
    return live(system).filter((s) => s.isMesh)
  }

  it('o padrão é o DASH_EMITTERS (100 linhas por segundo, 12 de poeira)', () => {
    const [lines, dust] = buildDashEmitters()
    expect(lines.rate()).toBe(100)
    expect(dust.burst).toBe(12)
    expect(DASH_EMITTERS[0].rate()).toBe(100)
  })

  it('lineRate controla a quantidade: metade da taxa, ~metade das linhas na tela', () => {
    const full = liveLines({ lineRate: 100 }).length
    const half = liveLines({ lineRate: 50 }).length
    const triple = liveLines({ lineRate: 300 }).length

    expect(half).toBeLessThan(full * 0.7)
    expect(half).toBeGreaterThan(full * 0.3)
    expect(triple).toBeGreaterThan(full * 2)
  })

  it('lineRate 0 desliga as linhas (a poeira continua)', () => {
    const system = buildDash({ emitters: buildDashEmitters({ lineRate: 0 }) })
    run(system, 0.5)

    const meshes = live(system).filter((s) => s.isMesh)
    const sprites = live(system).filter((s) => s.isSprite)
    expect(meshes).toHaveLength(0)
    expect(sprites.length).toBeGreaterThan(0)
  })

  it('lineLength e lineThickness mudam o tamanho de cada linha', () => {
    const [thin] = liveLines({ lineThickness: 0.02 }, 0.3)
    const [thick] = liveLines({ lineThickness: 0.2 }, 0.3)
    expect(thin.scale.y).toBeCloseTo(0.02)
    expect(thick.scale.y).toBeCloseTo(0.2)

    const longest = (options) =>
      Math.max(...liveLines(options, 0.3).map((s) => s.scale.x))
    expect(longest({ lineLength: 1.2 })).toBeGreaterThan(
      longest({ lineLength: 0.3 }) * 2,
    )
  })

  it('dustCount controla a poeira; 0 = sem poeira', () => {
    const count = (dustCount) => {
      const system = buildDash({ emitters: buildDashEmitters({ dustCount }) })
      system.update(1 / 60)
      return live(system).filter((s) => s.isSprite).length
    }
    expect(count(12)).toBe(12)
    expect(count(30)).toBe(30)
    expect(count(0)).toBe(0)
  })

  it('a config do jogo tem os cinco ajustes, todos números não negativos', () => {
    const config = GAME_CONFIG.FEEDBACK.DASH_EFFECT
    expect(typeof config.ENABLED).toBe('boolean')
    for (const key of [
      'SCALE',
      'LINE_RATE',
      'LINE_LENGTH',
      'LINE_THICKNESS',
      'DUST_COUNT',
    ]) {
      expect(typeof config[key], key).toBe('number')
      expect(config[key], key).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('dash no ar (voo livre, 060)', () => {
  const waves = GAME_CONFIG.FEEDBACK.DASH_EFFECT.AIR_WAVES

  it('sem poeira nem respingo: as linhas e as ondas de ar', () => {
    const ids = buildDashEmitters({ air: true, airWaves: waves }).map(
      (e) => e.id,
    )
    expect(ids[0]).toBe('lines')
    expect(ids).not.toContain('dust')
    expect(ids.filter((id) => id.startsWith('gust'))).toHaveLength(waves)
  })

  it('AIR_WAVES 0: só as linhas', () => {
    expect(
      buildDashEmitters({ air: true, airWaves: 0 }).map((e) => e.id),
    ).toEqual(['lines'])
  })

  it('as ondas saem uma depois da outra e vão pra trás', () => {
    const gusts = buildDashEmitters({ air: true, airWaves: 2 }).filter((e) =>
      e.id.startsWith('gust'),
    )
    expect(gusts[1].start).toBeGreaterThan(gusts[0].start)
    for (const gust of gusts) {
      expect(gust.burst).toBe(1)
      expect(gust.direction()[2]).toBeLessThan(0)
    }
  })

  it('com o quadro inclinado pra cima, as linhas sobem junto (vão pra trás e pra baixo)', () => {
    const system = createParticleSystem({
      emitters: [buildDashEmitters({ air: true })[0]],
      textures: { lines: new THREE.Texture() },
      length: 0,
      radius: 0,
      scale: 1,
      random: seededRandom(),
    })
    system.setFrame({
      origin: [0, 0, 0],
      yaw: 0,
      pitch: Math.PI / 2,
      height: 0,
    })
    run(system, 0.1)
    const lines = live(system).filter((s) => s.isMesh)
    // dash reto pra cima: a esfera das linhas fica ACIMA (a "frente")
    const meanY = lines.reduce((sum, s) => sum + s.position.y, 0) / lines.length
    expect(meanY).toBeGreaterThan(0)
  })
})
