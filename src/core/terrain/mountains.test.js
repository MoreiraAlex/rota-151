import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import {
  baseRadiusAt,
  chunkMountainPaths,
  cellSizeOf,
  createMountainSites,
  dryShareAt,
  isDryAround,
  mountainAt,
  pathStartOf,
  rampAngleOf,
  trailsOffMountains,
} from './mountains'

const { MAX_SLOPE_CLIMB } = GAME_CONFIG.PHYSICS.CHARACTER
const PARAMS = {
  spacing: 300,
  chance: 1,
  radius: 100,
  height: 24,
  sizeJitter: 0.2,
  wobble: 0.15,
  step: 4,
  cliff: 0.95,
  tilt: 0.1,
  pathWidth: 5,
  turn: 0.3,
}
const SEED = 151

/** Uma montanha da seed (longe da origem). */
function someSite(params = PARAMS) {
  const sites = createMountainSites(SEED, 'forest', params)
  return sites.sitesAround(10 * cellSizeOf(params), 0, 0)[0]
}

/** Raio (m) em que o morro liso de `site` passa de `natural` m. */
function radiusAtNatural(site, angle, natural, params = PARAMS) {
  const base = baseRadiusAt(site, angle, params.wobble)
  let low = 0
  let high = base
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    const at = mountainAt(
      site,
      site.x + Math.cos(angle) * mid,
      site.z + Math.sin(angle) * mid,
      params,
    )
    if (at.natural > natural) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/** A maior inclinação ao longo de uma linha radial em `angle`. */
function steepestAlong(site, angle, from, to, params = PARAMS) {
  const heightAt = (r) =>
    mountainAt(
      site,
      site.x + Math.cos(angle) * r,
      site.z + Math.sin(angle) * r,
      params,
    ).height
  let steepest = 0
  const step = 0.1
  for (let r = from; r < to; r += step) {
    steepest = Math.max(
      steepest,
      Math.abs(heightAt(r + step) - heightAt(r)) / step,
    )
  }
  return steepest
}

describe('montanhas com caminho até o topo (066)', () => {
  it('mesma seed, mesmas montanhas; outra seed, outras', () => {
    const a = createMountainSites(SEED, 'forest', PARAMS).sitesAround(0, 0, 3)
    const b = createMountainSites(SEED, 'forest', PARAMS).sitesAround(0, 0, 3)
    const c = createMountainSites(SEED + 1, 'forest', PARAMS).sitesAround(
      0,
      0,
      3,
    )
    expect(a).toEqual(b)
    expect(c).not.toEqual(a)
  })

  it('cada montanha cabe inteira na célula dela (nunca se encostam)', () => {
    const sites = createMountainSites(SEED, 'forest', PARAMS)
    const cell = cellSizeOf(PARAMS)
    for (const site of sites.sitesAround(0, 0, 4)) {
      const cx = Math.floor(site.x / cell)
      const cz = Math.floor(site.z / cell)
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2
        const r = baseRadiusAt(site, angle, PARAMS.wobble)
        const x = site.x + Math.cos(angle) * r
        const z = site.z + Math.sin(angle) * r
        expect(Math.floor(x / cell)).toBe(cx)
        expect(Math.floor(z / cell)).toBe(cz)
      }
    }
  })

  it('na borda da célula, a montanha não chega (nem tira a água)', () => {
    const sites = createMountainSites(SEED, 'forest', PARAMS)
    const cell = cellSizeOf(PARAMS)
    for (const site of sites.sitesAround(0, 0, 3)) {
      const minX = Math.floor(site.x / cell) * cell
      const minZ = Math.floor(site.z / cell) * cell
      for (let i = 0; i <= 32; i++) {
        const along = (i / 32) * cell
        for (const [x, z] of [
          [minX + along, minZ],
          [minX + along, minZ + cell],
          [minX, minZ + along],
          [minX + cell, minZ + along],
        ]) {
          expect(dryShareAt(site, x, z, PARAMS)).toBe(0)
          expect(mountainAt(site, x, z, PARAMS).height).toBe(0)
        }
      }
    }
  })

  it('debaixo da montanha, a água some; longe, fica', () => {
    const site = someSite()
    expect(dryShareAt(site, site.x, site.z, PARAMS)).toBe(1)
    expect(dryShareAt(site, site.x + site.radius * 3, site.z, PARAMS)).toBe(0)
  })

  it('sem chance, nenhuma montanha; nenhuma no nascimento (origem)', () => {
    const none = createMountainSites(SEED, 'forest', { ...PARAMS, chance: 0 })
    expect(none.sitesAround(0, 0, 4)).toEqual([])
    for (let seed = 0; seed < 50; seed++) {
      const sites = createMountainSites(seed, 'forest', PARAMS)
      expect(mountainAt(sites.siteAt(0, 0), 0, 0, PARAMS).height).toBe(0)
    }
  })

  it('fora da base não soma nada; no meio, sobe até a altura do topo', () => {
    const site = someSite()
    const far = mountainAt(site, site.x + site.radius * 3, site.z, PARAMS)
    expect(far).toEqual({ natural: 0, height: 0, path: 0 })
    const top = mountainAt(site, site.x, site.z, PARAMS)
    expect(top.natural).toBeCloseTo(site.height, 6)
    expect(top.height).toBeGreaterThan(site.height - PARAMS.step)
  })

  it('a rampa de cada patamar sobe dentro do limite do personagem', () => {
    const site = someSite()
    const topLevel = Math.floor(site.height / PARAMS.step)
    for (let level = 0; level < topLevel; level++) {
      const angle = rampAngleOf(site, level, PARAMS.turn)
      const outer = radiusAtNatural(site, angle, level * PARAMS.step)
      const inner = radiusAtNatural(site, angle, (level + 1) * PARAMS.step)
      const steepest = steepestAlong(site, angle, inner, outer)
      expect(steepest).toBeLessThan(Math.tan(MAX_SLOPE_CLIMB))
      // A rampa é caminho.
      const mid = (inner + outer) / 2
      const at = mountainAt(
        site,
        site.x + Math.cos(angle) * mid,
        site.z + Math.sin(angle) * mid,
        PARAMS,
      )
      expect(at.path).toBe(1)
    }
  })

  it('longe das rampas, o barranco barra a subida', () => {
    const site = someSite()
    // Meio caminho entre duas rampas seguidas, do lado oposto.
    const angle =
      rampAngleOf(site, 0, PARAMS.turn) + site.dir * Math.PI * PARAMS.turn
    const opposite = angle + Math.PI
    const base = baseRadiusAt(site, opposite, PARAMS.wobble)
    expect(steepestAlong(site, opposite, 0, base)).toBeGreaterThan(
      Math.tan(MAX_SLOPE_CLIMB),
    )
  })

  it('no patamar, o caminho liga a rampa de baixo à de cima', () => {
    const site = someSite()
    const level = 1
    const from = rampAngleOf(site, level - 1, PARAMS.turn)
    const to = rampAngleOf(site, level, PARAMS.turn)
    // Um ponto no meio do trecho, rente à beirada de fora do patamar.
    const mid = from + (to - from) / 2
    const edge = radiusAtNatural(site, mid, level * PARAMS.step)
    let best = 0
    for (let r = edge - PARAMS.pathWidth * 3; r < edge; r += 0.25) {
      const at = mountainAt(
        site,
        site.x + Math.cos(mid) * r,
        site.z + Math.sin(mid) * r,
        PARAMS,
      )
      best = Math.max(best, at.path)
    }
    expect(best).toBe(1)
    // Do outro lado da montanha, fora do trecho, não há caminho.
    const away = mid + Math.PI
    const awayEdge = radiusAtNatural(site, away, level * PARAMS.step)
    const off = mountainAt(
      site,
      site.x + Math.cos(away) * (awayEdge - PARAMS.pathWidth),
      site.z + Math.sin(away) * (awayEdge - PARAMS.pathWidth),
      PARAMS,
    )
    expect(off.path).toBe(0)
  })

  it('o caminho começa fora da base, no rumo da primeira rampa', () => {
    const site = someSite()
    const foot = pathStartOf(site, PARAMS)
    const distance = Math.hypot(foot.x - site.x, foot.z - site.z)
    expect(distance).toBeGreaterThan(
      baseRadiusAt(site, site.start, PARAMS.wobble),
    )
    expect(mountainAt(site, foot.x, foot.z, PARAMS).height).toBe(0)
  })

  it('água no centro recusa a montanha; longe, aceita', () => {
    const site = someSite()
    const dry = () => -Infinity
    const wetAtCenter = (x, z) =>
      Math.hypot(x - site.x, z - site.z) < 1 ? 1 : -Infinity
    expect(isDryAround(site, PARAMS, dry)).toBe(true)
    expect(isDryAround(site, PARAMS, wetAtCenter)).toBe(false)
  })
})

describe('trilhas e caminho no chunk (066)', () => {
  const chunk = {
    resolution: 2,
    size: 2,
    minX: 0,
    minZ: 0,
    heights: new Float32Array(9).fill(5),
  }

  it('em cima da montanha a trilha some; fora, fica', () => {
    const trails = new Float32Array(9).fill(1)
    const covered = { hasMountains: true, mountainCoverAt: () => 1 }
    expect([...trailsOffMountains(chunk, trails.slice(), covered)]).toEqual(
      new Array(9).fill(0),
    )
    const none = { hasMountains: false, mountainCoverAt: () => 1 }
    expect(trailsOffMountains(chunk, trails, none)).toBe(trails)
  })

  it('o caminho entra no chunk só acima da água', () => {
    const sampler = { hasMountains: true, mountainPathAt: () => 1 }
    expect([...chunkMountainPaths(chunk, sampler, 0)]).toEqual(
      new Array(9).fill(1),
    )
    expect(chunkMountainPaths(chunk, sampler, 10)).toBeNull()
  })
})
