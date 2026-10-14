/**
 * Leitura do `.dds` dos mapas do Let's Go (só o primeiro nível de mipmap):
 * BC1 e BC3 (sRGB ou não, cabeçalho DX10) e o RGBA cru de 32 bits das
 * tabelas de toon. Devolve `{ width, height, data }` em RGBA 8 bits.
 */

const DXGI = {
  71: 'BC1',
  72: 'BC1',
  77: 'BC3',
  78: 'BC3',
  98: 'BC7',
  99: 'BC7',
}

function color565(value) {
  const r = (value >> 11) & 31
  const g = (value >> 5) & 63
  const b = value & 31
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]
}

// Bloco de cor do BC1/BC3: 4×4 pixels em `out` (RGBA).
function decodeColorBlock(buffer, at, out, allowPunchThrough) {
  const c0 = buffer.readUInt16LE(at)
  const c1 = buffer.readUInt16LE(at + 2)
  const bits = buffer.readUInt32LE(at + 4)
  const a = color565(c0)
  const b = color565(c1)
  const mix = (t) => a.map((value, i) => Math.round(value + (b[i] - value) * t))
  const palette =
    c0 > c1 || !allowPunchThrough
      ? [
          [...a, 255],
          [...b, 255],
          [...mix(1 / 3), 255],
          [...mix(2 / 3), 255],
        ]
      : [
          [...a, 255],
          [...b, 255],
          [...mix(1 / 2), 255],
          [0, 0, 0, 0],
        ]
  for (let i = 0; i < 16; i++) out.set(palette[(bits >> (2 * i)) & 3], i * 4)
}

function decodeAlphaBlock(buffer, at, out) {
  const a0 = buffer[at]
  const a1 = buffer[at + 1]
  const values = [a0, a1]
  if (a0 > a1) {
    for (let i = 1; i < 7; i++) values.push(((7 - i) * a0 + i * a1) / 7)
  } else {
    for (let i = 1; i < 5; i++) values.push(((5 - i) * a0 + i * a1) / 5)
    values.push(0, 255)
  }
  let bits = 0n
  for (let i = 0; i < 6; i++)
    bits |= BigInt(buffer[at + 2 + i]) << BigInt(8 * i)
  for (let i = 0; i < 16; i++) {
    out[i * 4 + 3] = Math.round(values[Number((bits >> BigInt(3 * i)) & 7n)])
  }
}

export function decodeDds(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'DDS ') throw new Error('não é DDS')
  const height = buffer.readUInt32LE(12)
  const width = buffer.readUInt32LE(16)
  const fourCC = buffer.toString('ascii', 84, 88)
  let format
  let start = 128
  if (fourCC === 'DX10') {
    format =
      DXGI[buffer.readUInt32LE(128)] ?? `DXGI ${buffer.readUInt32LE(128)}`
    start = 148
  } else if (fourCC === 'DXT1') format = 'BC1'
  else if (fourCC === 'DXT5') format = 'BC3'
  else if (buffer.readUInt32LE(88) === 32) format = 'RGBA32'
  else format = `FourCC ${fourCC}`

  const data = new Uint8Array(width * height * 4)
  if (format === 'RGBA32') {
    const masks = [92, 96, 100, 104].map((at) => buffer.readUInt32LE(at))
    const shiftOf = (mask) => (mask ? 31 - Math.clz32(mask & -mask) : 0)
    for (let i = 0; i < width * height; i++) {
      const pixel = buffer.readUInt32LE(start + i * 4)
      for (let c = 0; c < 4; c++) {
        data[i * 4 + c] = masks[c]
          ? (pixel & masks[c]) >>> shiftOf(masks[c])
          : 255
      }
    }
    return { width, height, data, format }
  }
  if (format !== 'BC1' && format !== 'BC3') {
    throw new Error(`formato não suportado: ${format}`)
  }
  const blockSize = format === 'BC1' ? 8 : 16
  const block = new Uint8Array(64)
  const blocksX = Math.max(1, Math.ceil(width / 4))
  const blocksY = Math.max(1, Math.ceil(height / 4))
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const at = start + (by * blocksX + bx) * blockSize
      if (format === 'BC1') decodeColorBlock(buffer, at, block, true)
      else {
        decodeColorBlock(buffer, at + 8, block, false)
        decodeAlphaBlock(buffer, at, block)
      }
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const x = bx * 4 + px
          const y = by * 4 + py
          if (x >= width || y >= height) continue
          data.set(
            block.subarray((py * 4 + px) * 4, (py * 4 + px) * 4 + 4),
            (y * width + x) * 4,
          )
        }
      }
    }
  }
  return { width, height, data, format }
}
