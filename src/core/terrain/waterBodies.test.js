import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { createWaterBodies, smoothMin, waterProfile } from './waterBodies'

const PARAMS = GAME_CONFIG.WATER_BODIES
const FULL = { rivers: 1, lakes: 1 }
const NONE = { rivers: 0, lakes: 0 }
const PROFILE = { depth: 2, shoreSlope: 0.3, bankSlope: 0.3 }

// Pontos longe da origem (onde não há água, `SPAWN_CLEAR_RADIUS`).
const GRID = []
for (let x = 200; x < 2200; x += 7) {
  for (let z = -1000; z < 1000; z += 7) GRID.push([x, z])
}

describe('waterProfile', () => {
  it('fora da água sobe com a distância da beira', () => {
    expect(waterProfile(-1, PROFILE)).toBeGreaterThan(0)
    expect(waterProfile(-10, PROFILE)).toBeGreaterThan(
      waterProfile(-1, PROFILE),
    )
  })

  it('dentro desce até a fundura sem passar dela e sem ficar plano', () => {
    let previous = waterProfile(0, PROFILE)
    for (let inside = 1; inside < 200; inside++) {
      const height = waterProfile(inside, PROFILE)
      expect(height).toBeLessThan(previous)
      expect(height).toBeGreaterThan(-PROFILE.depth)
      previous = height
    }
  })
})

describe('smoothMin', () => {
  it('nunca passa do mínimo e é o mínimo quando os dois estão longe', () => {
    expect(smoothMin(1, 1.2, 1)).toBeLessThanOrEqual(1)
    expect(smoothMin(1, 5, 1)).toBe(1)
    expect(smoothMin(5, -3, 1)).toBe(-3)
  })
})

describe('createWaterBodies', () => {
  it('mesma seed, mesmos lagos e rios; seed diferente, outros', () => {
    const a = createWaterBodies(3)
    const b = createWaterBodies(3)
    const c = createWaterBodies(4)
    for (const [x, z] of GRID.slice(0, 200)) {
      expect(a.carveAt(x, z, 5, FULL)).toBe(b.carveAt(x, z, 5, FULL))
    }
    expect(
      GRID.some(
        ([x, z]) => a.carveAt(x, z, 5, FULL) !== c.carveAt(x, z, 5, FULL),
      ),
    ).toBe(true)
  })

  it('onde o lugar não aceita água, o chão fica como está', () => {
    const water = createWaterBodies(3)
    for (const [x, z] of GRID.slice(0, 500)) {
      expect(water.carveAt(x, z, 5, NONE)).toBe(5)
    }
  })

  it('só cava, nunca levanta o chão', () => {
    const water = createWaterBodies(3)
    for (const [x, z] of GRID) {
      expect(water.carveAt(x, z, 4, FULL)).toBeLessThanOrEqual(4)
    }
  })

  it('dentro da beira de um rio ou lago o chão fica abaixo da água', () => {
    const water = createWaterBodies(3)
    let found = { river: false, lake: false }
    for (const [x, z] of GRID) {
      const inRiver = water.insideRiver(x, z) > 0
      const inLake = water.insideLake(x, z) > 0
      if (!inRiver && !inLake) continue
      found = { river: found.river || inRiver, lake: found.lake || inLake }
      expect(water.carveAt(x, z, 6, FULL)).toBeLessThan(0)
    }
    expect(found).toEqual({ river: true, lake: true })
  })

  it('a largura do rio é a da config', () => {
    const water = createWaterBodies(3)
    // Atravessa o mundo em linha reta e mede cada trecho dentro do rio.
    const step = 0.1
    const widths = []
    for (const z of [-300, 0, 300, 600]) {
      let start = null
      for (let x = 200; x < 3000; x += step) {
        const inside = water.insideRiver(x, z) > 0
        if (inside && start === null) start = x
        if (!inside && start !== null) {
          widths.push(x - start)
          start = null
        }
      }
    }
    expect(widths.length).toBeGreaterThan(0)
    // Cruzando em linha reta o rio parece mais largo (cruza na diagonal),
    // nunca mais estreito.
    const narrowest = Math.min(...widths)
    expect(narrowest).toBeGreaterThan(PARAMS.RIVER.WIDTH * 0.9)
  })

  it('o fundo nunca tem célula plana (docs/roadmap.md, 083)', () => {
    const water = createWaterBodies(3)
    const at = (x, z) => water.carveAt(x, z, 6, FULL)
    let cells = 0
    for (const [x, z] of GRID) {
      if (at(x, z) >= 0) continue
      cells++
      const corners = [at(x, z), at(x + 1, z), at(x, z + 1), at(x + 1, z + 1)]
      expect(new Set(corners).size).toBeGreaterThan(1)
    }
    expect(cells).toBeGreaterThan(0)
  })

  it('sem água perto da origem, onde o treinador nasce', () => {
    const water = createWaterBodies(3)
    const radius = PARAMS.SPAWN_CLEAR_RADIUS / 2
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      for (let distance = 0; distance < radius; distance += 2) {
        const x = Math.cos(angle) * distance
        const z = Math.sin(angle) * distance
        expect(water.carveAt(x, z, 3, FULL)).toBe(3)
      }
    }
  })

  it('a fração de lago fica perto da `LAKE.COVERAGE`', () => {
    const water = createWaterBodies(3)
    let lake = 0
    let count = 0
    for (let x = -6000; x < 6000; x += 40) {
      for (let z = -6000; z < 6000; z += 40) {
        count++
        if (water.insideLake(x, z) > 0) lake++
      }
    }
    expect(lake / count).toBeGreaterThan(PARAMS.LAKE.COVERAGE / 2)
    expect(lake / count).toBeLessThan(PARAMS.LAKE.COVERAGE * 2)
  })
})

describe('flowAt', () => {
  it('dentro do rio aponta ao longo dele; longe do rio é zero', () => {
    const water = createWaterBodies(3)
    let checked = 0
    for (const [x, z] of GRID) {
      const inside = water.insideRiver(x, z)
      const flow = water.flowAt(x, z)
      if (inside < -5) {
        expect(flow).toEqual({ x: 0, z: 0 })
        continue
      }
      if (inside < 1) continue
      checked++
      expect(Math.hypot(flow.x, flow.z)).toBeCloseTo(1, 5)
      // Um passo na correnteza continua no rio; um de lado, perto da beira.
      const ahead = water.insideRiver(x + flow.x, z + flow.z)
      expect(Math.abs(ahead - inside)).toBeLessThan(0.5)
    }
    expect(checked).toBeGreaterThan(0)
  })
})
