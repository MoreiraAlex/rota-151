/**
 * Leitor mínimo de FlatBuffers (só leitura, campo pelo índice no schema):
 * o bastante para o `.gfbmdl` (gfbmdl.js). O campo `i` de uma tabela fica
 * no voffset `4 + 2i` da vtable dela.
 */
export class Table {
  constructor(buffer, position) {
    this.buffer = buffer
    this.position = position
    this.vtable = position - buffer.readInt32LE(position)
    this.vtableLength = buffer.readUInt16LE(this.vtable)
  }

  offset(field) {
    const voffset = 4 + 2 * field
    if (voffset >= this.vtableLength) return 0
    const relative = this.buffer.readUInt16LE(this.vtable + voffset)
    return relative ? this.position + relative : 0
  }

  u32(field, fallback = 0) {
    const at = this.offset(field)
    return at ? this.buffer.readUInt32LE(at) : fallback
  }

  i32(field, fallback = 0) {
    const at = this.offset(field)
    return at ? this.buffer.readInt32LE(at) : fallback
  }

  u8(field, fallback = 0) {
    const at = this.offset(field)
    return at ? this.buffer.readUInt8(at) : fallback
  }

  f32(field, fallback = 0) {
    const at = this.offset(field)
    return at ? this.buffer.readFloatLE(at) : fallback
  }

  // Struct de `count` floats guardado no lugar.
  floats(field, count) {
    const at = this.offset(field)
    if (!at) return null
    return Array.from({ length: count }, (_, i) =>
      this.buffer.readFloatLE(at + 4 * i),
    )
  }

  reference(field) {
    const at = this.offset(field)
    return at ? at + this.buffer.readUInt32LE(at) : 0
  }

  string(field) {
    const at = this.reference(field)
    if (!at) return null
    return readString(this.buffer, at)
  }

  table(field) {
    const at = this.reference(field)
    return at ? new Table(this.buffer, at) : null
  }

  vector(field) {
    const at = this.reference(field)
    if (!at) return { start: 0, length: 0 }
    return { start: at + 4, length: this.buffer.readUInt32LE(at) }
  }

  tables(field) {
    const { start, length } = this.vector(field)
    return Array.from({ length }, (_, i) => {
      const at = start + 4 * i
      return new Table(this.buffer, at + this.buffer.readUInt32LE(at))
    })
  }

  strings(field) {
    const { start, length } = this.vector(field)
    return Array.from({ length }, (_, i) => {
      const at = start + 4 * i
      return readString(this.buffer, at + this.buffer.readUInt32LE(at))
    })
  }

  bytes(field) {
    const { start, length } = this.vector(field)
    return this.buffer.subarray(start, start + length)
  }

  u16s(field) {
    const { start, length } = this.vector(field)
    return Uint16Array.from({ length }, (_, i) =>
      this.buffer.readUInt16LE(start + 2 * i),
    )
  }
}

function readString(buffer, at) {
  const length = buffer.readUInt32LE(at)
  return buffer.toString('utf8', at + 4, at + 4 + length)
}

export const rootTable = (buffer) => new Table(buffer, buffer.readUInt32LE(0))
