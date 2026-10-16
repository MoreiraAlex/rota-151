/**
 * Decodificador de bloco BC7 (16 bytes → 4×4 pixels RGBA), pela
 * especificação do Direct3D 11. Usado pelas texturas `.bntx` dos Pokémon do
 * Let's Go e pelos `.dds` em BC7.
 */

// Por modo: subconjuntos, bits de partição, de rotação, de seleção de
// índice, de cor, de alfa, P-bit por ponta, P-bit por subconjunto, bits do
// índice principal e do secundário.
const MODES = [
  [3, 4, 0, 0, 4, 0, 1, 0, 3, 0],
  [2, 6, 0, 0, 6, 0, 0, 1, 3, 0],
  [3, 6, 0, 0, 5, 0, 0, 0, 2, 0],
  [2, 6, 0, 0, 7, 0, 1, 0, 2, 0],
  [1, 0, 2, 1, 5, 6, 0, 0, 2, 3],
  [1, 0, 2, 0, 7, 8, 0, 0, 2, 2],
  [1, 0, 0, 0, 7, 7, 1, 0, 4, 0],
  [2, 6, 0, 0, 5, 5, 1, 0, 2, 0],
]

const WEIGHTS = {
  2: [0, 21, 43, 64],
  3: [0, 9, 18, 27, 37, 46, 55, 64],
  4: [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64],
}

// Partições de 2 subconjuntos: bit i = subconjunto do pixel i.
const PARTITIONS_2 = [
  0xcccc, 0x8888, 0xeeee, 0xecc8, 0xc880, 0xfeec, 0xfec8, 0xec80, 0xc800,
  0xffec, 0xfe80, 0xe800, 0xffe8, 0xff00, 0xfff0, 0xf000, 0xf710, 0x008e,
  0x7100, 0x08ce, 0x008c, 0x7310, 0x3100, 0x8cce, 0x088c, 0x3110, 0x6666,
  0x366c, 0x17e8, 0x0ff0, 0x718e, 0x399c, 0xaaaa, 0xf0f0, 0x5a5a, 0x33cc,
  0x3c3c, 0x55aa, 0x9696, 0xa55a, 0x73ce, 0x13c8, 0x324c, 0x3bdc, 0x6996,
  0xc33c, 0x9966, 0x0660, 0x0272, 0x04e4, 0x4e40, 0x2720, 0xc936, 0x936c,
  0x39c6, 0x639c, 0x9336, 0x9cc6, 0x817e, 0xe718, 0xccf0, 0x0fcc, 0x7744,
  0xee22,
].map((mask) => Array.from({ length: 16 }, (_, i) => (mask >> i) & 1))

// Partições de 3 subconjuntos: o subconjunto de cada pixel.
const PARTITIONS_3 = [
  '0011001102212222',
  '0001001122112221',
  '0000200122112211',
  '0222002200110111',
  '0000000011221122',
  '0011001100220022',
  '0022002211111111',
  '0011001122112211',
  '0000000011112222',
  '0000111111112222',
  '0000111122222222',
  '0012001200120012',
  '0112011201120112',
  '0122012201220122',
  '0011011211221222',
  '0011200122002220',
  '0001001101121122',
  '0111001120012200',
  '0000112211221122',
  '0022002200221111',
  '0111011102220222',
  '0001000122212221',
  '0000001101220122',
  '0000110022102210',
  '0122012200110000',
  '0012001211222222',
  '0110122112210110',
  '0000011012211221',
  '0022110211020022',
  '0110011020022222',
  '0011012201220011',
  '0000200022112221',
  '0000000211221222',
  '0222002200120011',
  '0011001200220222',
  '0120012001200120',
  '0000111122220000',
  '0120120120120120',
  '0120201212010120',
  '0011220011220011',
  '0011112222000011',
  '0101010122222222',
  '0000000021212121',
  '0022112200221122',
  '0022001100220011',
  '0220122102201221',
  '0101222222220101',
  '0000212121212121',
  '0101010101012222',
  '0222011102220111',
  '0002111200021112',
  '0000211221122112',
  '0222011101110222',
  '0002111211120002',
  '0110011001102222',
  '0000000021122112',
  '0110011022222222',
  '0022001100110022',
  '0022112211220022',
  '0000000000002112',
  '0002000100020001',
  '0222122202221222',
  '0101222222222222',
  '0111201122012220',
].map((row) => [...row].map(Number))

// Pixel-âncora (o índice dele tem um bit a menos) de cada subconjunto
// além do primeiro, cuja âncora é sempre o pixel 0.
const ANCHOR_2 = [
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2, 8, 2,
  2, 8, 8, 15, 2, 8, 2, 2, 8, 8, 2, 2, 15, 15, 6, 8, 2, 8, 15, 15, 2, 8, 2, 2,
  2, 15, 15, 6, 6, 2, 6, 8, 15, 15, 2, 2, 15, 15, 15, 15, 15, 2, 2, 15,
]
const ANCHOR_3A = [
  3, 3, 15, 15, 8, 3, 15, 15, 8, 8, 6, 6, 6, 5, 3, 3, 3, 3, 8, 15, 3, 3, 6, 10,
  5, 8, 8, 6, 8, 5, 15, 15, 8, 15, 3, 5, 6, 10, 8, 15, 15, 3, 15, 5, 15, 15, 15,
  15, 3, 15, 5, 5, 5, 8, 5, 10, 5, 10, 8, 13, 15, 12, 3, 3,
]
const ANCHOR_3B = [
  15, 8, 8, 3, 15, 15, 3, 8, 15, 15, 15, 15, 15, 15, 15, 8, 15, 8, 15, 3, 15, 8,
  15, 8, 3, 15, 6, 10, 15, 15, 10, 8, 15, 3, 15, 10, 10, 8, 9, 10, 6, 15, 8, 15,
  3, 6, 6, 8, 15, 3, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 3, 15, 15, 8,
]

export const BC7_TABLES = {
  PARTITIONS_2,
  PARTITIONS_3,
  ANCHOR_2,
  ANCHOR_3A,
  ANCHOR_3B,
}

function anchorsOf(subsets, partition) {
  if (subsets === 1) return [0]
  if (subsets === 2) return [0, ANCHOR_2[partition]]
  return [0, ANCHOR_3A[partition], ANCHOR_3B[partition]]
}

const expand = (value, bits) =>
  bits >= 8 ? value : (value << (8 - bits)) | (value >> (2 * bits - 8))

const interpolate = (a, b, weight) => ((64 - weight) * a + weight * b + 32) >> 6

/** Decodifica o bloco de `buffer` em `at` para `out` (64 bytes, RGBA). */
export function decodeBc7Block(buffer, at, out) {
  let position = 0
  const read = (count) => {
    let value = 0
    for (let i = 0; i < count; i++, position++) {
      value |= ((buffer[at + (position >> 3)] >> (position & 7)) & 1) << i
    }
    return value
  }

  let mode = 0
  while (mode < 8 && !read(1)) mode++
  if (mode === 8) {
    out.fill(0)
    return
  }
  const [subsets, pb, rb, isb, cb, ab, epb, spb, ib, ib2] = MODES[mode]
  const partition = read(pb)
  const rotation = read(rb)
  const indexSelection = read(isb)

  const ends = subsets * 2
  const endpoints = Array.from({ length: ends }, () => [0, 0, 0, 255])
  for (let c = 0; c < 3; c++) {
    for (let e = 0; e < ends; e++) endpoints[e][c] = read(cb)
  }
  if (ab) for (let e = 0; e < ends; e++) endpoints[e][3] = read(ab)

  const pbits = epb
    ? Array.from({ length: ends }, () => read(1))
    : spb
      ? Array.from({ length: subsets }, () => read(1)).flatMap((p) => [p, p])
      : null
  for (let e = 0; e < ends; e++) {
    const extra = pbits ? 1 : 0
    for (let c = 0; c < 4; c++) {
      if (c === 3 && !ab) continue
      const bits = (c === 3 ? ab : cb) + extra
      const value = pbits ? (endpoints[e][c] << 1) | pbits[e] : endpoints[e][c]
      endpoints[e][c] = expand(value, bits)
    }
  }

  const subsetOf =
    subsets === 1
      ? () => 0
      : (i) => (subsets === 2 ? PARTITIONS_2 : PARTITIONS_3)[partition][i]
  const anchors = anchorsOf(subsets, partition)
  const readIndices = (bits, anchorList) =>
    Array.from({ length: 16 }, (_, i) =>
      read(anchorList.includes(i) ? bits - 1 : bits),
    )
  const primary = readIndices(ib, anchors)
  const secondary = ib2 ? readIndices(ib2, [0]) : null

  for (let i = 0; i < 16; i++) {
    const subset = subsetOf(i)
    const e0 = endpoints[subset * 2]
    const e1 = endpoints[subset * 2 + 1]
    let colorIndex = primary[i]
    let colorBits = ib
    let alphaIndex = secondary ? secondary[i] : primary[i]
    let alphaBits = secondary ? ib2 : ib
    if (indexSelection) {
      ;[colorIndex, alphaIndex] = [alphaIndex, colorIndex]
      ;[colorBits, alphaBits] = [alphaBits, colorBits]
    }
    const pixel = [0, 1, 2].map((c) =>
      interpolate(e0[c], e1[c], WEIGHTS[colorBits][colorIndex]),
    )
    pixel.push(interpolate(e0[3], e1[3], WEIGHTS[alphaBits][alphaIndex]))
    if (rotation) {
      ;[pixel[3], pixel[rotation - 1]] = [pixel[rotation - 1], pixel[3]]
    }
    out.set(pixel, i * 4)
  }
}
