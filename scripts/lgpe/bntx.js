import { decodeBc7Block } from './bc7.js'
import { decodeAlphaBlock, decodeColorBlock } from './dds.js'

/**
 * Leitura do `.bntx` (textura do Switch — os Pokémon do Let's Go): só a
 * primeira textura do arquivo e o primeiro nível de mipmap. Os dados vêm
 * no layout de blocos da GPU do Switch (block linear) e são desembaralhados
 * antes de decodificar. Devolve `{ name, width, height, data, format }` em
 * RGBA 8 bits.
 */

// Byte alto do formato → compressão; o baixo é o tipo (UNORM, SRGB...).
const FORMATS = {
  0x0b: { name: 'RGBA8', blockSize: 4, blockPixels: 1 },
  0x1a: { name: 'BC1', blockSize: 8, blockPixels: 4 },
  0x1c: { name: 'BC3', blockSize: 16, blockPixels: 4 },
  0x20: { name: 'BC7', blockSize: 16, blockPixels: 4 },
}

const GOB_BYTES = 512

/**
 * Endereço do elemento (x, y) — bloco comprimido ou pixel — no layout block
 * linear: a imagem é dividida em GOBs de 64 bytes × 8 linhas, empilhados em
 * blocos de `blockHeight` GOBs.
 */
function blockLinearAddress(x, y, widthInBytes, bytesPerElement, blockHeight) {
  const gobsPerRow = Math.ceil(widthInBytes / 64)
  const xBytes = x * bytesPerElement
  const gob =
    Math.floor(y / (8 * blockHeight)) * GOB_BYTES * blockHeight * gobsPerRow +
    Math.floor(xBytes / 64) * GOB_BYTES * blockHeight +
    Math.floor((y % (8 * blockHeight)) / 8) * GOB_BYTES
  return (
    gob +
    Math.floor((xBytes % 64) / 32) * 256 +
    Math.floor((y % 8) / 2) * 64 +
    Math.floor((xBytes % 32) / 16) * 32 +
    (y % 2) * 16 +
    (xBytes % 16)
  )
}

function readName(buffer, at) {
  const length = buffer.readUInt16LE(at)
  return buffer.toString('utf8', at + 2, at + 2 + length)
}

export function decodeBntx(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'BNTX') throw new Error('não é BNTX')
  const info = buffer.indexOf('BRTI')
  if (info < 0) throw new Error('BNTX sem textura (BRTI)')
  const formatCode = buffer.readUInt32LE(info + 0x1c)
  const format = FORMATS[formatCode >> 8]
  if (!format) {
    throw new Error(`formato não suportado: 0x${formatCode.toString(16)}`)
  }
  const width = buffer.readUInt32LE(info + 0x24)
  const height = buffer.readUInt32LE(info + 0x28)
  const blockHeight = 1 << (buffer.readUInt32LE(info + 0x34) & 7)
  const name = readName(buffer, Number(buffer.readBigUInt64LE(info + 0x60)))
  const mipTable = Number(buffer.readBigUInt64LE(info + 0x70))
  const start = Number(buffer.readBigUInt64LE(mipTable))

  const { blockSize, blockPixels } = format
  const blocksX = Math.ceil(width / blockPixels)
  const blocksY = Math.ceil(height / blockPixels)
  const data = new Uint8Array(width * height * 4)
  const block = new Uint8Array(blockPixels * blockPixels * 4)
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const at =
        start +
        blockLinearAddress(bx, by, blocksX * blockSize, blockSize, blockHeight)
      if (format.name === 'RGBA8') block.set(buffer.subarray(at, at + 4))
      else if (format.name === 'BC1') decodeColorBlock(buffer, at, block, true)
      else if (format.name === 'BC3') {
        decodeColorBlock(buffer, at + 8, block, false)
        decodeAlphaBlock(buffer, at, block)
      } else decodeBc7Block(buffer, at, block)
      for (let py = 0; py < blockPixels; py++) {
        for (let px = 0; px < blockPixels; px++) {
          const x = bx * blockPixels + px
          const y = by * blockPixels + py
          if (x >= width || y >= height) continue
          const from = (py * blockPixels + px) * 4
          data.set(block.subarray(from, from + 4), (y * width + x) * 4)
        }
      }
    }
  }
  return { name, width, height, data, format: format.name }
}
