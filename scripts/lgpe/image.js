import { deflateSync, inflateSync } from 'node:zlib'

/**
 * Imagens RGBA de 8 bits em memória (`{ width, height, data }`): ler e
 * gravar PNG e reduzir o tamanho — sem dependência (o projeto não tem
 * biblioteca de imagem no Node).
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

export function decodePng(file) {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('não é PNG')
  let at = 8
  let header = null
  let palette = null
  let transparency = null
  const chunks = []
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.toString('ascii', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colorType: body[9],
        interlace: body[12],
      }
    } else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') transparency = body
    else if (type === 'IDAT') chunks.push(body)
    else if (type === 'IEND') break
    at += 12 + length
  }
  const { width, height, depth, colorType, interlace } = header
  if (interlace) throw new Error('PNG entrelaçado não suportado')
  if (depth !== 8 && depth !== 16) throw new Error(`profundidade ${depth}`)
  const channels = CHANNELS[colorType]
  const bytesPerPixel = (channels * depth) / 8
  const rowLength = width * bytesPerPixel
  const raw = inflateSync(Buffer.concat(chunks))
  const pixels = Buffer.alloc(rowLength * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowLength + 1)]
    const source = y * (rowLength + 1) + 1
    const target = y * rowLength
    for (let x = 0; x < rowLength; x++) {
      const left = x >= bytesPerPixel ? pixels[target + x - bytesPerPixel] : 0
      const up = y > 0 ? pixels[target + x - rowLength] : 0
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? pixels[target + x - rowLength - bytesPerPixel]
          : 0
      const value = raw[source + x]
      const predicted = [
        0,
        left,
        up,
        (left + up) >> 1,
        paeth(left, up, upLeft),
      ][filter]
      pixels[target + x] = (value + predicted) & 0xff
    }
  }
  const data = new Uint8Array(width * height * 4)
  const step = depth / 8
  for (let i = 0; i < width * height; i++) {
    const read = (channel) => pixels[(i * channels + channel) * step]
    let rgba
    if (colorType === 6) rgba = [read(0), read(1), read(2), read(3)]
    else if (colorType === 2) rgba = [read(0), read(1), read(2), 255]
    else if (colorType === 4) rgba = [read(0), read(0), read(0), read(1)]
    else if (colorType === 0) rgba = [read(0), read(0), read(0), 255]
    else {
      const index = read(0)
      rgba = [
        palette[index * 3],
        palette[index * 3 + 1],
        palette[index * 3 + 2],
        transparency && index < transparency.length ? transparency[index] : 255,
      ]
    }
    data.set(rgba, i * 4)
  }
  return { width, height, data }
}

function chunk(type, body) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))
  return Buffer.concat([length, typed, crc])
}

/** PNG RGBA (ou RGB, se `opaque`). */
export function encodePng({ width, height, data }, { opaque = false } = {}) {
  const channels = opaque ? 3 : 4
  const rowLength = width * channels
  const raw = Buffer.alloc((rowLength + 1) * height)
  for (let y = 0; y < height; y++) {
    // Filtro "sub" em toda linha: comprime bem textura, sem custo.
    raw[y * (rowLength + 1)] = 1
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        const at = y * (rowLength + 1) + 1 + x * channels + c
        const value = data[(y * width + x) * 4 + c]
        const left = x > 0 ? data[(y * width + x - 1) * 4 + c] : 0
        raw[at] = (value - left) & 0xff
      }
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = opaque ? 2 : 6
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Metade do tamanho (média de 2×2) até o lado maior caber em `maxSide`. */
export function shrinkTo(image, maxSide) {
  let current = image
  while (Math.max(current.width, current.height) > maxSide) {
    const width = Math.max(1, current.width >> 1)
    const height = Math.max(1, current.height >> 1)
    const data = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const sx = Math.min(current.width - 1, x * 2 + dx)
              const sy = Math.min(current.height - 1, y * 2 + dy)
              sum += current.data[(sy * current.width + sx) * 4 + c]
            }
          }
          data[(y * width + x) * 4 + c] = (sum + 2) >> 2
        }
      }
    }
    current = { width, height, data }
  }
  return current
}

/** Se a imagem usa transparência de verdade (recorte). */
export function hasAlpha({ data }) {
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++
  return transparent / (data.length / 4) > 0.005
}
