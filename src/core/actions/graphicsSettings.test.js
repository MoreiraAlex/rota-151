import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { GAME_CONFIG } from '../gameConfig'
import { GraphicsSettings } from '../traits'
import {
  ASPECT_LEVELS,
  SHADOW_LEVELS,
  aspectRatioOf,
  canvasScaleOf,
  canvasSizeOf,
  definirDistanciaDeVisao,
  definirProporcao,
  definirSombra,
  definirTamanhoDaTela,
  shadowLevelOf,
  viewDistanceOf,
} from './graphicsSettings'

// Gráficos do jogador (docs/features/066-revisao-dos-biomas.md).
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return player
}

describe('definirSombra', () => {
  it('o treinador nasce com a sombra padrão', () => {
    expect(setup().get(GraphicsSettings).shadow).toBe(
      GAME_CONFIG.GRAPHICS.SHADOW.DEFAULT,
    )
  })

  it('os níveis são os do config, e o padrão é um deles', () => {
    expect(SHADOW_LEVELS).toEqual(
      Object.keys(GAME_CONFIG.GRAPHICS.SHADOW.LEVELS),
    )
    expect(SHADOW_LEVELS).toContain(GAME_CONFIG.GRAPHICS.SHADOW.DEFAULT)
  })

  it('muda para qualquer nível', () => {
    const player = setup()
    for (const level of SHADOW_LEVELS) {
      const before = player.get(GraphicsSettings).shadow
      expect(definirSombra(player, level)).toBe(before !== level)
      expect(player.get(GraphicsSettings).shadow).toBe(level)
    }
  })

  it('nível desconhecido não muda nada', () => {
    const player = setup()
    const before = player.get(GraphicsSettings)

    expect(definirSombra(player, 'ultra-raytracing')).toBe(false)

    expect(player.get(GraphicsSettings)).toEqual(before)
  })

  it('sem o trait (outra entidade), não muda nada', () => {
    expect(definirSombra(null, SHADOW_LEVELS[0])).toBe(false)
  })
})

describe('níveis de sombra no config', () => {
  it('só o primeiro desliga; a área à frente cabe na área; o redesenho é a cada quadro ou mais', () => {
    const levels = Object.values(GAME_CONFIG.GRAPHICS.SHADOW.LEVELS)
    expect(levels[0].ENABLED).toBe(false)
    for (const level of levels.slice(1)) expect(level.ENABLED).toBe(true)
    for (const level of levels) {
      expect(level.AHEAD).toBeLessThan(level.AREA / 2)
      expect(Number.isInteger(level.UPDATE_EVERY)).toBe(true)
      expect(level.UPDATE_EVERY).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('shadowLevelOf', () => {
  it('devolve os números do nível; desconhecido ou ausente, os do padrão', () => {
    const { LEVELS, DEFAULT } = GAME_CONFIG.GRAPHICS.SHADOW
    for (const level of SHADOW_LEVELS)
      expect(shadowLevelOf(level)).toBe(LEVELS[level])
    expect(shadowLevelOf('ultra-raytracing')).toBe(LEVELS[DEFAULT])
    expect(shadowLevelOf(undefined)).toBe(LEVELS[DEFAULT])
  })
})

describe('definirProporcao', () => {
  it('o treinador nasce com a proporção padrão, que é um dos níveis', () => {
    const { DEFAULT, LEVELS } = GAME_CONFIG.GRAPHICS.ASPECT
    expect(setup().get(GraphicsSettings).aspect).toBe(DEFAULT)
    expect(ASPECT_LEVELS).toEqual(Object.keys(LEVELS))
  })

  it('muda para qualquer nível sem mexer no resto', () => {
    const player = setup()
    const others = player.get(GraphicsSettings)
    for (const level of ASPECT_LEVELS) {
      const before = player.get(GraphicsSettings).aspect
      expect(definirProporcao(player, level)).toBe(before !== level)
      expect(player.get(GraphicsSettings)).toEqual({
        ...others,
        aspect: level,
      })
    }
  })

  it('nível desconhecido não muda nada', () => {
    const player = setup()
    const before = player.get(GraphicsSettings)

    expect(definirProporcao(player, 'tela-de-cinema-curva')).toBe(false)

    expect(player.get(GraphicsSettings)).toEqual(before)
  })
})

describe('aspectRatioOf', () => {
  const { LEVELS, DEFAULT } = GAME_CONFIG.GRAPHICS.ASPECT

  it('é a proporção do nível; desconhecido ou ausente, a do padrão', () => {
    for (const [level, { RATIO }] of Object.entries(LEVELS)) {
      expect(aspectRatioOf(level)).toBe(RATIO)
    }
    expect(aspectRatioOf('tela-de-cinema-curva')).toBe(LEVELS[DEFAULT].RATIO)
    expect(aspectRatioOf(undefined)).toBe(LEVELS[DEFAULT].RATIO)
  })

  it('toda proporção fixa é positiva', () => {
    for (const { RATIO } of Object.values(LEVELS)) {
      if (RATIO !== null) expect(RATIO).toBeGreaterThan(0)
    }
  })
})

describe('definirTamanhoDaTela', () => {
  const { DEFAULT, MIN, STEP } = GAME_CONFIG.GRAPHICS.CANVAS_SIZE

  it('o treinador nasce com o tamanho padrão', () => {
    expect(setup().get(GraphicsSettings).canvasScale).toBe(DEFAULT)
  })

  it('muda o tamanho sem mexer no resto', () => {
    const player = setup()
    const others = player.get(GraphicsSettings)
    const target = canvasScaleOf(MIN + STEP)

    expect(definirTamanhoDaTela(player, target)).toBe(target !== DEFAULT)
    expect(player.get(GraphicsSettings)).toEqual({
      ...others,
      canvasScale: target,
    })
    expect(definirTamanhoDaTela(player, target)).toBe(false)
  })

  it('valor que não é número não muda nada', () => {
    const player = setup()
    const before = player.get(GraphicsSettings)

    expect(definirTamanhoDaTela(player, Number.NaN)).toBe(false)
    expect(definirTamanhoDaTela(player, 'metade')).toBe(false)

    expect(player.get(GraphicsSettings)).toEqual(before)
  })
})

describe('canvasScaleOf', () => {
  const { DEFAULT, MIN, STEP } = GAME_CONFIG.GRAPHICS.CANVAS_SIZE

  it('fica entre o mínimo e a janela toda', () => {
    expect(canvasScaleOf(MIN / 2)).toBe(MIN)
    expect(canvasScaleOf(0)).toBe(MIN)
    expect(canvasScaleOf(2)).toBe(1)
    expect(canvasScaleOf(1)).toBe(1)
    expect(canvasScaleOf(MIN)).toBe(MIN)
  })

  it('cai no passo mais perto', () => {
    const between = MIN + STEP * 1.4
    expect(canvasScaleOf(between)).toBeCloseTo(MIN + STEP, 9)
  })

  it('o padrão é um tamanho válido; não número volta a ele', () => {
    expect(canvasScaleOf(DEFAULT)).toBe(DEFAULT)
    expect(canvasScaleOf(undefined)).toBe(DEFAULT)
    expect(canvasScaleOf(Number.NaN)).toBe(DEFAULT)
  })
})

describe('canvasSizeOf', () => {
  const { MIN } = GAME_CONFIG.GRAPHICS.CANVAS_SIZE
  const SPACE = [1600, 900]

  it('sem proporção e no tamanho cheio, é o espaço todo', () => {
    expect(canvasSizeOf(...SPACE, null, 1)).toEqual({
      width: SPACE[0],
      height: SPACE[1],
    })
  })

  it('com proporção, cabe no espaço, encosta num dos lados e segue a razão', () => {
    for (const { RATIO } of Object.values(GAME_CONFIG.GRAPHICS.ASPECT.LEVELS)) {
      if (!RATIO) continue
      const { width, height } = canvasSizeOf(...SPACE, RATIO, 1)
      expect(width).toBeLessThanOrEqual(SPACE[0])
      expect(height).toBeLessThanOrEqual(SPACE[1])
      expect(width === SPACE[0] || height === SPACE[1]).toBe(true)
      expect(width / height).toBeCloseTo(RATIO, 1)
    }
  })

  it('o tamanho reduz os dois lados na mesma fração', () => {
    const full = canvasSizeOf(...SPACE, null, 1)
    const small = canvasSizeOf(...SPACE, null, MIN)
    expect(small.width).toBe(Math.round(full.width * MIN))
    expect(small.height).toBe(Math.round(full.height * MIN))
  })
})

describe('definirDistanciaDeVisao', () => {
  const { DEFAULT, MIN, MAX } = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE

  it('o treinador nasce com a distância padrão', () => {
    expect(setup().get(GraphicsSettings).viewDistance).toBe(DEFAULT)
  })

  it('muda a distância sem mexer no resto', () => {
    const player = setup()
    const others = player.get(GraphicsSettings)
    const target = DEFAULT === MIN ? MAX : MIN

    expect(definirDistanciaDeVisao(player, target)).toBe(true)
    expect(player.get(GraphicsSettings)).toEqual({
      ...others,
      viewDistance: target,
    })
    expect(definirDistanciaDeVisao(player, target)).toBe(false)
  })

  it('valor que não é número não muda nada', () => {
    const player = setup()
    const before = player.get(GraphicsSettings)

    expect(definirDistanciaDeVisao(player, Number.NaN)).toBe(false)
    expect(definirDistanciaDeVisao(player, 'longe')).toBe(false)

    expect(player.get(GraphicsSettings)).toEqual(before)
  })
})

describe('viewDistanceOf', () => {
  const { DEFAULT, MIN, MAX } = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE

  it('fica entre o mínimo e o máximo, em chunks inteiros', () => {
    expect(viewDistanceOf(MIN - 1)).toBe(MIN)
    expect(viewDistanceOf(MAX + 1)).toBe(MAX)
    expect(viewDistanceOf(MIN + 0.4)).toBe(MIN)
    expect(Number.isInteger(viewDistanceOf((MIN + MAX) / 2 + 0.3))).toBe(true)
  })

  it('o padrão está na faixa; não número volta a ele', () => {
    expect(viewDistanceOf(DEFAULT)).toBe(DEFAULT)
    expect(viewDistanceOf(undefined)).toBe(DEFAULT)
    expect(viewDistanceOf(Number.NaN)).toBe(DEFAULT)
  })
})
