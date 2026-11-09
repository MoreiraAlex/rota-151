import { readFileSync } from 'node:fs'

/**
 * Duração (s) de um `.ogg` Vorbis lido do disco, sem decodificar: a taxa de
 * amostragem vem do cabeçalho de identificação (primeiro pacote) e o total
 * de amostras, da posição da última página. Só pra testes que conferem
 * dado de som contra o arquivo de verdade.
 */
export function oggDuration(path) {
  const data = readFileSync(path)
  const header = data.indexOf(Buffer.from('\x01vorbis', 'latin1'))
  if (header < 0) throw new Error(`Não é Vorbis: ${path}`)
  const sampleRate = data.readUInt32LE(header + 12)
  const lastPage = data.lastIndexOf(Buffer.from('OggS', 'latin1'))
  const samples = Number(data.readBigInt64LE(lastPage + 6))
  return samples / sampleRate
}
