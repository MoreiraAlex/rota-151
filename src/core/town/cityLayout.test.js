import { describe, expect, it } from 'vitest'
import { listCityLayouts } from '../data/cityLayouts'
import { getBiome } from '../data/biomes'
import { GAME_CONFIG } from '../gameConfig'
import { cliffBand } from '../terrain/terraces'
import {
  cityLayoutHeightAt,
  cityLayoutLakeAt,
  cityLayoutLakeRect,
  cityLayoutPaintAt,
  cityLayoutRoadDistanceAt,
  prepareCityLayout,
} from './cityLayout'

// O chão das cidades montadas à mão (docs/features/069-revisao-do-bioma-
// cidade.md): regras com layouts pequenos de teste e os números do config.
const CONFIG_GROUND = GAME_CONFIG.CITIES.FIRST_TOWN.GROUND
// O degrau cru (sem o borrão dos níveis): o barranco na divisa.
const GROUND = { ...CONFIG_GROUND, soften: null }
const SCALE =
  GAME_CONFIG.CITIES.FIRST_TOWN.SCALE ?? getBiome('city')?.town?.scale ?? 1
const { step, tilt } = GROUND.terraces
// Folga do declive natural que fica no topo (`tilt`) numa transição.
const TILT_SLACK = step * tilt + 1e-6
// Meia faixa do barranco (m do layout: o nível anda um por célula entre
// os meios delas) e um pouco além dela.
const HALF_BAND = cliffBand(GROUND.terraces.cliff) / 2
const PAST_BAND = Math.min(HALF_BAND + 0.01, 0.5)

const heightOf = (layout, x, z, ground = GROUND) =>
  cityLayoutHeightAt(prepareCityLayout(layout), ground, SCALE, x, z)

/** Um layout de teste com `rows` e o resto vazio. */
const layoutOf = (rows, extra = {}) => ({ id: 'teste', rows, ...extra })

// Chão à esquerda e um degrau acima à direita, com a divisa em x = 4.
const STEP_UP = layoutOf(Array(5).fill('....::::'))

describe('os degraus', () => {
  it('cada nível é um platô na altura dos degraus dele', () => {
    const layout = layoutOf([
      '-----.....:::::+++++',
      '-----.....:::::+++++',
      '-----.....:::::+++++',
    ])
    for (const [x, level] of [
      [2.5, -1],
      [7.5, 0],
      [12.5, 1],
      [17.5, 2],
    ]) {
      expect(heightOf(layout, x, 1.5)).toBeCloseTo(level * step, 6)
    }
  })

  it('o barranco fica centrado na divisa, na largura dele', () => {
    expect(heightOf(STEP_UP, 4, 2.5)).toBeCloseTo(step / 2, 6)
    expect(heightOf(STEP_UP, 4 + PAST_BAND, 2.5)).toBeGreaterThan(
      step - TILT_SLACK,
    )
    expect(heightOf(STEP_UP, 4 - PAST_BAND, 2.5)).toBeLessThan(TILT_SLACK)
  })

  it('qualquer barranco deixa cada patamar no nível dele', () => {
    for (const cliff of [0.05, 0.25, 0.5, 1]) {
      const ground = { ...GROUND, terraces: { ...GROUND.terraces, cliff } }
      expect(heightOf(STEP_UP, 1.5, 2.5, ground)).toBeCloseTo(0, 6)
      expect(heightOf(STEP_UP, 6.5, 2.5, ground)).toBeCloseTo(step, 6)
    }
  })

  it('o degrau é mais alto que o da planície se o config pedir', () => {
    const tall = { ...GROUND, terraces: { ...GROUND.terraces, step: step * 2 } }
    expect(heightOf(STEP_UP, 6.5, 2.5, tall)).toBeCloseTo(step * 2, 6)
  })

  it('caractere sem nível é erro', () => {
    expect(() => prepareCityLayout(layoutOf(['..x..', '.....']))).toThrow()
  })
})

describe('as rampas', () => {
  const layout = {
    ...STEP_UP,
    ramps: [{ from: [1.5, 2.5], to: [6.5, 2.5], width: 2 }],
  }

  it('sobem aos poucos de um nível ao outro', () => {
    const samples = 50
    let previous = heightOf(layout, 1.5, 2.5)
    let steepest = 0
    for (let i = 1; i <= samples; i++) {
      const x = 1.5 + (5 * i) / samples
      const height = heightOf(layout, x, 2.5)
      steepest = Math.max(steepest, height - previous)
      expect(height).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = height
    }
    // Sem rampa, o degrau inteiro sobe num passo só.
    expect(steepest).toBeLessThan(step / 4)
    expect(previous).toBeCloseTo(step, 6)
  })

  it('fora da largura dela o degrau é barranco de novo', () => {
    // A beira da rampa (m do layout) mais a beirada dela.
    const reach = 1 + GROUND.rampEdge / SCALE
    const onRamp = heightOf(layout, 3.8, 2.5)
    expect(onRamp).toBeGreaterThan(step * 0.3)
    expect(onRamp).toBeLessThan(step * 0.7)
    const z = 2.5 - reach - 0.1
    expect(z).toBeGreaterThan(0)
    expect(heightOf(layout, 4 - PAST_BAND, z)).toBeLessThan(TILT_SLACK)
    expect(heightOf(layout, 4 + PAST_BAND, z)).toBeGreaterThan(
      step - TILT_SLACK,
    )
  })
})

describe('o borrão dos níveis (barrancos suaves)', () => {
  // Um degrau comprido (para o borrão não ver as pontas) com a divisa em
  // x = 10, e o borrão do config (ou um, se o config não tiver).
  const LONG_STEP = layoutOf(Array(12).fill('..........::::::::::'))
  const soften = CONFIG_GROUND.soften?.radius
    ? CONFIG_GROUND.soften
    : { radius: 2, keep: 1 }
  const SOFT = { ...GROUND, soften }
  const z = 6
  const along = (ground) =>
    Array.from({ length: 81 }, (_, i) =>
      heightOf(LONG_STEP, 6 + i * 0.1, z, ground),
    )

  it('o barranco segue centrado na divisa, sobe sem voltar e é mais largo', () => {
    expect(heightOf(LONG_STEP, 10, z, SOFT)).toBeCloseTo(step / 2, 6)
    const width = (heights) =>
      heights.filter((h) => h > TILT_SLACK && h < step - TILT_SLACK).length
    const soft = along(SOFT)
    soft
      .slice(1)
      .forEach((h, i) => expect(h).toBeGreaterThanOrEqual(soft[i] - 1e-9))
    expect(width(soft)).toBeGreaterThan(width(along(GROUND)))
    // Longe da divisa, cada patamar no nível dele.
    expect(heightOf(LONG_STEP, 1.5, z, SOFT)).toBeCloseTo(0, 6)
    expect(heightOf(LONG_STEP, 18.5, z, SOFT)).toBeCloseTo(step, 6)
  })

  it('sem raio, o degrau é o cru', () => {
    const none = { ...GROUND, soften: { ...soften, radius: 0 } }
    expect(along(none)).toEqual(along(GROUND))
  })

  it('debaixo de um objeto do layout (e na folga dele) o chão é o do degrau cru', () => {
    // Um poste encostado na divisa, do lado de baixo.
    const layout = {
      ...LONG_STEP,
      props: [{ kind: 'street-prop', model: 'viridian-lamp', x: 9.5, z: 6.5 }],
    }
    for (let x = 9.05; x < 10; x += 0.1) {
      for (let zz = 6.05; zz < 7; zz += 0.1) {
        expect(heightOf(layout, x, zz, SOFT)).toBeCloseTo(
          heightOf(layout, x, zz, GROUND),
          9,
        )
      }
    }
    // Sem o objeto, o borrão desce o barranco até ali.
    expect(heightOf(LONG_STEP, 9.5, 6.5, SOFT)).toBeGreaterThan(
      heightOf(LONG_STEP, 9.5, 6.5, GROUND) + TILT_SLACK,
    )
  })
})

describe('a montanha', () => {
  const layout = layoutOf(Array(6).fill('######......'))

  it('sobe da beira para dentro, até a altura dela', () => {
    let previous = heightOf(layout, 6, 3)
    expect(previous).toBeLessThan(TILT_SLACK)
    for (let x = 5.5; x >= -20; x -= 0.5) {
      const height = heightOf(layout, x, 3)
      expect(height).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = height
    }
    // Além da borda da grade ela segue subindo, até a altura máxima.
    const { height, tilt: mountainTilt, step: mountainStep } = GROUND.mountain
    expect(previous).toBeGreaterThan(height - mountainStep)
    expect(previous).toBeLessThanOrEqual(height + mountainStep * mountainTilt)
  })

  it('o chão de fora não sente a montanha', () => {
    expect(heightOf(layout, 9.5, 3)).toBeCloseTo(0, 6)
  })
})

describe('o lago', () => {
  it('o meio dele fica no fundo, abaixo do chão', () => {
    const layout = layoutOf([
      '.......',
      '..~~~..',
      '..~~~..',
      '..~~~..',
      '.......',
    ])
    expect(heightOf(layout, 3.5, 2.5)).toBeCloseTo(-GROUND.lakeDepth, 6)
    expect(heightOf(layout, 0.5, 0.5)).toBeCloseTo(0, 6)
  })

  it('a beira desce quase reta na divisa das células (a parede da borda)', () => {
    const layoutData = prepareCityLayout(
      layoutOf(['.......', '..~~~..', '..~~~..', '..~~~..', '.......']),
    )
    expect(cityLayoutLakeAt(layoutData, 2.3, 2.5)).toBeCloseTo(1, 6)
    expect(cityLayoutLakeAt(layoutData, 1.7, 2.5)).toBeCloseTo(0, 6)
    expect(cityLayoutLakeAt(layoutData, 2, 2.5)).toBeCloseTo(0.5, 6)
  })

  it('o retângulo das células dele', () => {
    const layoutData = prepareCityLayout(
      layoutOf(['......', '..~~..', '..~~~.', '......']),
    )
    expect(cityLayoutLakeRect(layoutData)).toEqual([2, 1, 5, 3])
    expect(cityLayoutLakeRect(prepareCityLayout(STEP_UP))).toBeNull()
  })
})

describe('o desenho do chão', () => {
  const paint = {
    ground: { g: 'grama', a: 'asfalto' },
    steps: 'rocha-do-degrau',
    mountain: ['rocha-de-baixo', 'rocha-de-cima'],
  }
  const layout = layoutOf(Array(4).fill('######......'), {
    ground: Array(4).fill('ggggggggaaaa'),
    paint,
  })
  const layoutData = prepareCityLayout(layout)
  const paintAt = (x, z) =>
    cityLayoutPaintAt(
      layoutData,
      GROUND,
      SCALE,
      x,
      z,
      new Float32Array(layoutData.letters.length),
    )
  const weightOf = (result, layer) =>
    result.weights[
      layoutData.letters.findIndex((letter) => paint.ground[letter] === layer)
    ]

  it('no meio da célula, a camada dela; na divisa, metade de cada', () => {
    expect(weightOf(paintAt(6.5, 1.5), 'grama')).toBeCloseTo(1, 6)
    expect(weightOf(paintAt(9.5, 1.5), 'asfalto')).toBeCloseTo(1, 6)
    expect(weightOf(paintAt(8, 1.5), 'asfalto')).toBeCloseTo(0.5, 6)
  })

  it('os pesos somam um em todo ponto', () => {
    for (let x = -3; x < 15; x += 0.37) {
      const sum = paintAt(x, 2.2).weights.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 6)
    }
  })

  it('fora da montanha, o barranco é o dos degraus', () => {
    expect(paintAt(9.5, 1.5).cliff).toBe(paint.steps)
  })

  it('na montanha, cada barranco é a rocha do patamar dele, de baixo para cima', () => {
    const { step, rise, height } = GROUND.mountain
    // A beira da montanha (m do layout) e quanto ela sobe por m do layout.
    const edge = 6
    const perUnit = SCALE * rise
    const at = (natural) => paintAt(edge - natural / perUnit, 1.5).cliff
    expect(at(step * 0.5)).toBe(paint.mountain[0])
    if (height > step * 1.5) expect(at(step * 1.5)).toBe(paint.mountain[1])
    // Mais patamares que rochas: as de cima ficam com a última.
    expect(at(Math.min(height, step * 5))).toBe(
      height >= step ? paint.mountain[1] : paint.mountain[0],
    )
  })

  it('layout sem desenho: nada a pintar', () => {
    expect(
      cityLayoutPaintAt(prepareCityLayout(STEP_UP), GROUND, SCALE, 1, 1, []),
    ).toBeNull()
  })

  it('letra do chão sem camada é erro', () => {
    expect(() =>
      prepareCityLayout(
        layoutOf(['....'], { ground: ['ggxg'], paint: { ground: { g: 'a' } } }),
      ),
    ).toThrow()
  })
})

describe('a beira da rua', () => {
  // Rua (`a`) nas colunas 3 e 4; o resto, grama.
  const layout = layoutOf(Array(6).fill('........'), {
    ground: Array(6).fill('gggaaggg'),
    paint: { ground: { g: 'lgpe-grass', a: 'lgpe-asphalt' } },
    road: 'a',
  })
  const data = prepareCityLayout(layout)
  const reach = 2
  const distanceAt = (x, z) => cityLayoutRoadDistanceAt(data, x, z, reach)

  it('negativa dentro da rua, positiva fora, zero na beira', () => {
    expect(distanceAt(4, 3)).toBeLessThan(0)
    expect(distanceAt(1.5, 3)).toBeGreaterThan(0)
    expect(distanceAt(3, 3)).toBeCloseTo(0, 6)
    expect(distanceAt(5, 3)).toBeCloseTo(0, 6)
  })

  it('a distância até a beira reta, dos dois lados, presa no alcance', () => {
    for (const offset of [0.1, 0.4, 0.9]) {
      expect(distanceAt(3 - offset, 2.5)).toBeCloseTo(offset, 6)
      expect(distanceAt(5 + offset, 2.5)).toBeCloseTo(offset, 6)
    }
    expect(distanceAt(3.4, 2.5)).toBeCloseTo(-0.4, 6)
    expect(distanceAt(0.1, 2.5)).toBe(reach)
    expect(distanceAt(4, 2.5)).toBeGreaterThanOrEqual(-reach)
  })

  it('a rua segue além da grade (pelas saídas)', () => {
    expect(distanceAt(4, -3)).toBeLessThan(0)
    expect(distanceAt(4, 9)).toBeLessThan(0)
  })

  it('sem rua no layout, longe dela em todo ponto', () => {
    const data = prepareCityLayout(layoutOf(['....']))
    expect(cityLayoutRoadDistanceAt(data, 2, 0.5, reach)).toBe(reach)
  })
})

describe.each(listCityLayouts())('o layout $name', (layout) => {
  const { cols, rows } = prepareCityLayout(layout)

  it('a grade é retangular e só tem caracteres com nível', () => {
    for (const row of layout.rows) expect(row).toHaveLength(cols)
  })

  it('o chão cobre a grade inteira, cada letra com a camada dela', () => {
    if (!layout.ground) return
    expect(layout.ground).toHaveLength(rows)
    for (const row of layout.ground) {
      expect(row).toHaveLength(cols)
      for (const char of row) expect(layout.paint.ground[char]).toBeTruthy()
    }
  })

  it('a rua com guia é uma letra do chão, com a borda de terra', () => {
    if (!layout.road) return
    expect(layout.paint.ground[layout.road]).toBeTruthy()
    expect(layout.paint.curb).toBeTruthy()
  })

  it('a chegada fica dentro, no chão da cidade', () => {
    const { x, z } = layout.arrival
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(cols)
    expect(z).toBeGreaterThan(0)
    expect(z).toBeLessThan(rows)
    expect(layout.rows[Math.floor(z)][Math.floor(x)]).toBe('.')
    expect(heightOf(layout, x, z)).toBeCloseTo(0, 6)
  })

  it('as saídas ficam na borda', () => {
    for (const { x, z } of layout.exits) {
      const onEdge = x === 0 || x === cols || z === 0 || z === rows
      expect(onEdge).toBe(true)
    }
  })

  it('cada rampa liga dois níveis diferentes, dentro da grade', () => {
    const levelAt = ([x, z]) => layout.rows[Math.floor(z)][Math.floor(x)]
    for (const ramp of layout.ramps) {
      for (const [x, z] of [ramp.from, ramp.to]) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(cols)
        expect(z).toBeGreaterThanOrEqual(0)
        expect(z).toBeLessThan(rows)
      }
      expect(levelAt(ramp.from)).not.toBe(levelAt(ramp.to))
    }
  })
})
