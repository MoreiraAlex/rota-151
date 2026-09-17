import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from './gameConfig'
import { findPath, inspectCell } from './pathfinding'

describe('findPath', () => {
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

  it('"ramp-backing" (reforço físico sob a rampa) não afeta a elevação — a rampa de verdade sempre vence', () => {
    // ramp-backing é uma cópia mais grossa da rampa, só pra fechar o vão
    // físico embaixo dela (ver testLevel.js) — processada ANTES da rampa
    // fina no bake de elevação, então a rampa (declarada depois no
    // array) sempre sobrescreve por cima. Se a ordem estivesse errada, a
    // elevação aqui bateria com a posição da backing (mais baixa), não da
    // rampa de verdade.
    const { elevation } = inspectCell(6.5, 0)
    expect(elevation).toBeCloseTo(0.716, 2) // topo da rampa ali, não da backing
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
