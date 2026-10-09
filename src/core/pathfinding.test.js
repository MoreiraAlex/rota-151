import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { GAME_CONFIG } from './gameConfig'
import { carregarChunk, descarregarTodosOsChunks } from './actions/chunks'
import { chunkKey } from './terrain/terrainChunk'
import { makeFlatTestLevel } from '@/test/flatTestLevel'
import {
  createNavigation,
  findPath as findLevelPath,
  hasLevelNavigationRegion,
  isWalkableAt as isLevelWalkableAt,
} from './pathfinding'

// Regras de obstáculo/rampa/terraço/penhasco no nível plano de antes do
// relevo (parede, degrau, bloco, rampa, plataforma, trilha de 4 terraços).
const { findPath, inspectCell } = createNavigation(makeFlatTestLevel())

describe('findPath (nível de teste plano)', () => {
  it('sem obstáculo relevante no meio, retorna só o alvo exato (fallback pra linha reta)', () => {
    const from = { x: 20, y: 1, z: -20 }
    const to = { x: 20, y: 1, z: -19 }

    const path = findPath(from, to)

    expect(path).toEqual([{ x: to.x, y: to.y, z: to.z }])
  })

  it('origem e destino na mesma célula da grade retornam []', () => {
    const from = { x: 20.1, y: 1, z: 20.1 }
    const to = { x: 20.4, y: 1, z: 20.4 }

    expect(findPath(from, to)).toEqual([])
  })

  it('alvo dentro de um obstáculo bloqueado (inatingível) retorna []', () => {
    const from = { x: 0, y: 1, z: -15 }
    const to = { x: 0, y: 1, z: -7 } // dentro da "wall"

    expect(findPath(from, to)).toEqual([])
  })

  it('contorna a "wall" (parede sólida) em vez de atravessar', () => {
    // wall: position [0, 1, -7], size [10, 2, 0.5] — bloqueia x em
    // aproximadamente [-5.4, 5.4] na altura z da parede.
    const from = { x: 0, y: 1, z: -15 }
    const to = { x: 0, y: 1, z: 5 }

    const path = findPath(from, to)

    expect(path.length).toBeGreaterThan(1)
    expect(path.some((wp) => Math.abs(wp.x) > 5)).toBe(true)
    // último waypoint sempre é o alvo exato, mesmo com desvio no meio.
    expect(path[path.length - 1]).toEqual({ x: to.x, y: to.y, z: to.z })
  })

  it('"step-low" (degrau baixo) não bloqueia — física já sobe sozinha', () => {
    // step-low: position [-6, 0.15, 1], size [3, 0.3, 3] — topo (0.3) abaixo
    // do AUTOSTEP_HEIGHT (0.4). Destino fica antes de "block-high" (z ~3.5),
    // pra não bloquear por outro obstáculo sem querer. Sem suavização, o
    // caminho tem um waypoint por célula — não desvia (fica em x=-6 o
    // tempo todo) e termina no alvo exato.
    const from = { x: -6, y: 1, z: -3 }
    const to = { x: -6, y: 1, z: 2 }

    const path = findPath(from, to)

    expect(path.length).toBeGreaterThan(0)
    expect(path[path.length - 1]).toEqual({ x: to.x, y: to.y, z: to.z })
  })

  it('sobe a "ramp" reta, sem desviar (chão até o meio da rampa)', () => {
    // ramp: position [6, 0.55, 0], size [5, 0.3, 3] — topo (0.7) > AUTOSTEP_HEIGHT,
    // mas o tipo 'ramp' é excluído do bloqueio por altura. Andar do chão até
    // um ponto NO MEIO da rampa (não atravessando as laterais dela, ver
    // teste de penhasco abaixo) continua indo direto, sem desvio.
    const from = { x: 2, y: 0, z: 0 }
    const to = { x: 6, y: 0.72, z: 0 }

    const path = findPath(from, to)

    expect(path.length).toBeGreaterThan(0)
    expect(path[path.length - 1]).toEqual({ x: to.x, y: to.y, z: to.z })
  })

  it('não atravessa a lateral da rampa (penhasco: elevação da rampa contra o chão do lado)', () => {
    // A rampa só tem 3m de largura (z: [-1.5, 1.5]) — subir de lado (não
    // pela extremidade baixa) exigiria um salto de elevação grande demais
    // numa única célula, exatamente a regra de penhasco que impede rotas
    // fantasma por cima de paredes que o grid não enxerga como parede.
    expect(inspectCell(6.5, 0).walkable).toBe(true) // no meio da rampa
    expect(inspectCell(6.5, 3).walkable).toBe(true) // fora, chão comum
    expect(inspectCell(6.5, 1.5).walkable).toBe(false) // lateral da rampa
  })

  it('"platform" (type: floor) deixa de ser inatingível — alcançável pela rampa original', () => {
    // platform: position [10.5, 0.9, 0], size [4, 1.8, 3] — antes bloqueava
    // sempre (type: 'box'); agora é terreno andável (type: 'floor'),
    // contribuindo elevação (topo constante) em vez de bloquear.
    const from = { x: 0, y: 1, z: 0 }
    const to = { x: 10.5, y: 1.8, z: 0 }

    const path = findPath(from, to)

    expect(path.length).toBeGreaterThan(0)
    expect(path[path.length - 1]).toEqual({ x: to.x, y: to.y, z: to.z })
  })

  describe('elevação (heightmap) — trilha de teste de 4 terraços', () => {
    it('rampa interpola elevação suavemente entre o chão (0) e o terraço (1.8)', () => {
      // ramp0: liga o chão (elevação 0, x<-28.2) ao tier1 (elevação 1.8,
      // x>-24.27), lane z:[13,17]. No meio do próprio comprimento, a
      // elevação deve estar estritamente entre as duas pontas — nem 0, nem
      // 1.8 — confirmando que é uma rampa (interpolada), não um degrau.
      const { elevation } = inspectCell(-26.137, 15)
      expect(elevation).toBeGreaterThan(0.3)
      expect(elevation).toBeLessThan(1.5)
    })

    it('cada terraço só é andável vindo da rampa — a lateral sem rampa é um penhasco', () => {
      // tier2 (elevação 3.6) só conecta ao resto pelas lanes de ramp1/ramp2
      // (z:[13,17] e z:[23,27]). Fora dessas lanes (z:[17,23], onde fica a
      // "espinha" de rocha) ou pela borda sul (z=13, sem rampa nenhuma —
      // ramp1 está no x de ramp1, não no de tier2), não dá pra subir direto.
      expect(inspectCell(-13.047, 10).walkable).toBe(true) // chão, longe da borda
      expect(inspectCell(-13.047, 13).walkable).toBe(false) // borda de tier2, sem rampa aqui
      expect(inspectCell(-13.047, 20).walkable).toBe(true) // interior do terraço
    })

    it('sobe a trilha inteira do chão até o topo do 4º terraço', () => {
      const from = { x: -30, y: 0, z: 15 }
      const to = { x: 4.405, y: 7.2, z: 20 } // topo do tier4

      const path = findPath(from, to)

      expect(path.length).toBeGreaterThan(0)
      expect(path[path.length - 1]).toEqual({ x: to.x, y: to.y, z: to.z })
    })

    it('nenhum salto suavizado passa de MAX_SHORTCUT_DISTANCE — sem atalho diagonal por cima da trilha inteira', () => {
      // Bug real jogando: sem limite de distância, um trecho reto e
      // andável célula a célula (Bresenham confirma) podia virar UM
      // waypoint só a 20-30m — a trilha de teste inteira (várias rampas/
      // terraços em sequência) cabe numa lane de só ~4m de largura, longe
      // demais pra criatura manter a lane até lá sem desviar (giro
      // suavizado por `turnSpeed`, física) — ela acabava esbarrando de
      // lado numa rampa ou passando por baixo dela em vez de subir.
      // `boundedSmoothPath` limita cada salto a
      // `PATHFINDING.MAX_SHORTCUT_DISTANCE`.
      const from = { x: -30, y: 0, z: 15 }
      const to = { x: 4.405, y: 7.2, z: 20 }
      const { MAX_SHORTCUT_DISTANCE } = GAME_CONFIG.PATHFINDING

      const path = findPath(from, to)
      // Só entre waypoints de verdade (centro de célula) — nem `from`
      // (ponto exato de consulta, não centralizado numa célula) nem o
      // último waypoint (sempre substituído pela posição EXATA do alvo,
      // ver docstring de `findPath`) são centros de célula, então a
      // distância até eles pode passar do limite sem indicar bug nenhum.
      const points = path.slice(0, -1)

      expect(points.length).toBeGreaterThan(1) // a trilha É longa o bastante pra precisar de mais de 1 salto
      for (let i = 1; i < points.length; i++) {
        const dist = Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].z - points[i - 1].z,
        )
        expect(dist).toBeLessThanOrEqual(MAX_SHORTCUT_DISTANCE + 0.01)
      }
    })
  })
})

describe('relevo (terrain)', () => {
  const { MAX_CLIMB_STEP, CELL_SIZE } = GAME_CONFIG.PATHFINDING
  const { AUTOSTEP_HEIGHT } = GAME_CONFIG.PHYSICS.CHARACTER
  const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }

  // Encosta ao longo de X a partir de x = 0, com subida (m por m) `rise`.
  const slopeLevel = (rise) => ({
    bounds,
    obstacles: [],
    terrain: { heightAt: (x) => Math.max(0, x) * rise },
  })

  it('a célula começa com a altura do relevo', () => {
    const rise = (MAX_CLIMB_STEP / CELL_SIZE) * 0.5
    const nav = createNavigation(slopeLevel(rise))
    const cell = nav.inspectCell(10.5, 0)
    expect(cell.elevation).toBeCloseTo(10.5 * rise, 4)
  })

  it('encosta suave é andável; íngreme demais vira penhasco', () => {
    const gentle = createNavigation(
      slopeLevel((MAX_CLIMB_STEP / CELL_SIZE) * 0.5),
    )
    const steep = createNavigation(slopeLevel((MAX_CLIMB_STEP / CELL_SIZE) * 2))

    expect(gentle.inspectCell(10, 0).walkable).toBe(true)
    expect(
      gentle.findPath({ x: -10, z: 0 }, { x: 15, z: 0 }).at(-1),
    ).toMatchObject({ x: 15, z: 0 })
    expect(steep.inspectCell(10, 0).walkable).toBe(false)
    expect(steep.findPath({ x: -10, z: 0 }, { x: 15, z: 0 })).toEqual([])
  })

  it('caixa baixa em cima de um planalto não bloqueia; alta bloqueia', () => {
    const plateau = AUTOSTEP_HEIGHT * 10
    const box = (id, x, height) => ({
      id,
      type: 'box',
      position: [x, plateau + height / 2, 0],
      size: [2, height, 2],
    })
    const nav = createNavigation({
      bounds,
      terrain: { heightAt: () => plateau },
      obstacles: [
        box('low', -10, AUTOSTEP_HEIGHT * 0.5),
        box('high', 10, AUTOSTEP_HEIGHT * 3),
      ],
    })

    expect(nav.inspectCell(-10, 0).walkable).toBe(true)
    expect(nav.inspectCell(10, 0).walkable).toBe(false)
  })
})

describe('regiões (uma grade por chunk)', () => {
  const { MAX_CLIMB_STEP } = GAME_CONFIG.PATHFINDING
  // Degrau alto em x = 0 (bem na emenda das duas regiões) e uma rampa
  // suave ao longo de z.
  const level = {
    obstacles: [],
    terrain: {
      heightAt: (x, z) => (x < 0 ? 0 : MAX_CLIMB_STEP * 4) + z * 0.1,
    },
  }
  const left = { minX: -10, maxX: 0, minZ: -10, maxZ: 10 }
  const right = { minX: 0, maxX: 10, minZ: -10, maxZ: 10 }

  it('duas regiões vizinhas dão a mesma grade que uma região só', () => {
    const split = createNavigation(level)
    split.addRegion('left', left)
    split.addRegion('right', right)
    const whole = createNavigation({
      ...level,
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    })

    for (let x = -9.5; x < 10; x += 1) {
      for (let z = -9.5; z < 10; z += 1) {
        expect(split.inspectCell(x, z)).toEqual(whole.inspectCell(x, z))
      }
    }
    // O degrau da emenda é penhasco dos dois lados.
    expect(split.inspectCell(-0.5, 0).walkable).toBe(false)
    expect(split.inspectCell(0.5, 0).walkable).toBe(false)
  })

  it('o caminho atravessa a emenda de duas regiões', () => {
    const flat = createNavigation({
      obstacles: [],
      terrain: { heightAt: () => 0 },
    })
    flat.addRegion('left', left)
    flat.addRegion('right', right)
    const to = { x: 8, z: 3 }
    expect(flat.findPath({ x: -8, z: -3 }, to).at(-1)).toMatchObject(to)
  })

  it('fora de toda região não é andável e não tem caminho', () => {
    const nav = createNavigation(level)
    nav.addRegion('left', left)
    expect(nav.inspectCell(5, 0)).toBeNull()
    expect(nav.isWalkableAt(5, 0)).toBe(false)
    expect(nav.findPath({ x: -5, z: 0 }, { x: 5, z: 0 })).toEqual([])
  })

  it('removeRegion libera a grade', () => {
    const nav = createNavigation(level)
    nav.addRegion('left', left)
    nav.removeRegion('left')
    expect(nav.hasRegion('left')).toBe(false)
    expect(nav.isWalkableAt(-5, 0)).toBe(false)
  })
})

// docs/features/049-vegetacao-e-floresta.md
describe('objetos sólidos da vegetação (pegadas)', () => {
  const tree = { x: 0.5, z: 0.5, radius: 0.5 }
  const nav = createNavigation({
    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    obstacles: [],
    terrain: { heightAt: () => 0, footprintsIn: () => [tree] },
  })

  it('a célula da pegada fica bloqueada; longe dela, andável', () => {
    expect(nav.inspectCell(tree.x, tree.z).walkable).toBe(false)
    expect(nav.inspectCell(tree.x + 5, tree.z).walkable).toBe(true)
  })

  it('o caminho contorna a pegada', () => {
    const path = nav.findPath({ x: -6, z: 0.5 }, { x: 6, z: 0.5 })
    expect(path.length).toBeGreaterThan(1)
    for (const point of path) {
      expect(nav.isWalkableAt(point.x, point.z)).toBe(true)
    }
  })
})

describe('nível do jogo (TEST_LEVEL)', () => {
  beforeAll(() => carregarChunk(0, 0))
  afterAll(() => descarregarTodosOsChunks())

  it('o chunk carregado ganha grade: a origem é andável', () => {
    expect(hasLevelNavigationRegion(chunkKey(0, 0))).toBe(true)
    expect(isLevelWalkableAt(0, 0)).toBe(true)
  })

  it('fora dos chunks carregados não é andável', () => {
    expect(isLevelWalkableAt(GAME_CONFIG.TERRAIN.CHUNK_SIZE * 2, 0)).toBe(false)
  })

  it('acha caminho da origem até um ponto andável por perto', () => {
    const candidates = Array.from({ length: 16 }, (_, i) => ({
      x: 8 * Math.cos((i * Math.PI) / 8),
      z: 8 * Math.sin((i * Math.PI) / 8),
    }))
    const to = candidates.find(({ x, z }) => isLevelWalkableAt(x, z))
    expect(to).toBeDefined()
    expect(findLevelPath({ x: 0, z: 0 }, to).at(-1)).toMatchObject(to)
  })
})
