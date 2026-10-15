import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import * as THREE from 'three'
import {
  buildBackdropLayer,
  fogColorOf,
  mountainColor,
} from './backdropGeometry'

const { BACKDROP } = GAME_CONFIG
const options = { radius: BACKDROP.RADIUS, segments: BACKDROP.SEGMENTS }

// Ângulo (graus) acima do horizonte de cada coluna: pé e crista.
function columns(geometry) {
  const positions = geometry.getAttribute('position')
  const list = []
  for (let i = 0; i < positions.count; i += 2) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const distance = Math.hypot(x, z)
    const degrees = (y) => (Math.atan2(y, distance) * 180) / Math.PI
    list.push({
      distance,
      foot: degrees(positions.getY(i)),
      crest: degrees(positions.getY(i + 1)),
    })
  }
  return list
}

// docs/features/058-ajuste-dos-biomas.md
describe.each(BACKDROP.LAYERS.map((layer, index) => [index, layer]))(
  'serras do fundo, camada %i',
  (index, layer) => {
    const geometry = buildBackdropLayer(151, index, layer, options)

    it('mesma seed, mesma serra', () => {
      const again = buildBackdropLayer(151, index, layer, options)
      expect(again.getAttribute('position').array).toEqual(
        geometry.getAttribute('position').array,
      )
    })

    it('a crista fica na faixa de ângulo e o pé abaixo do horizonte', () => {
      for (const column of columns(geometry)) {
        expect(column.distance).toBeCloseTo(BACKDROP.RADIUS, 3)
        expect(column.crest).toBeGreaterThanOrEqual(layer.minAngle - 1e-3)
        expect(column.crest).toBeLessThanOrEqual(layer.maxAngle + 1e-3)
        expect(column.foot).toBeCloseTo(-layer.belowAngle, 3)
      }
    })

    it('fecha a volta sem emenda', () => {
      const list = columns(geometry)
      expect(list.at(-1).crest).toBeCloseTo(list[0].crest, 6)
    })

    it('a serra varia (não é uma faixa reta)', () => {
      const crests = columns(geometry).map(({ crest }) => crest)
      expect(Math.max(...crests) - Math.min(...crests)).toBeGreaterThan(
        (layer.maxAngle - layer.minAngle) / 4,
      )
    })
  },
)

describe('cor das serras e da névoa', () => {
  const horizon = new THREE.Color(0.6, 0.7, 0.85)
  const luma = ({ r, g, b }) => r * 0.2126 + g * 0.7152 + b * 0.0722
  const withBackdrop = (enabled, run) => {
    const original = BACKDROP.ENABLED
    BACKDROP.ENABLED = enabled
    try {
      return run()
    } finally {
      BACKDROP.ENABLED = original
    }
  }

  it.each(BACKDROP.LAYERS)(
    'a camada tem o brilho do horizonte escurecido',
    (layer) => {
      const color = mountainColor(horizon, layer)
      expect(luma(color)).toBeCloseTo(luma(horizon) * layer.shade, 6)
    },
  )

  it('sem força de tom, é só o horizonte escurecido', () => {
    const layer = { ...BACKDROP.LAYERS[0], tintAmount: 0 }
    const color = mountainColor(horizon, layer)
    expect(color.r).toBeCloseTo(horizon.r * layer.shade, 6)
    expect(color.b).toBeCloseTo(horizon.b * layer.shade, 6)
  })

  it('com as serras, a névoa é a cor da camada da frente', () => {
    const fog = withBackdrop(true, () => fogColorOf(horizon))
    expect(fog.equals(mountainColor(horizon, BACKDROP.LAYERS.at(-1)))).toBe(
      true,
    )
  })

  it('sem as serras, a névoa é a cor do horizonte', () => {
    const fog = withBackdrop(false, () => fogColorOf(horizon))
    expect(fog.equals(horizon)).toBe(true)
  })
})
