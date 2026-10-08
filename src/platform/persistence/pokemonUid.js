/**
 * Id único de um Pokémon novo (`Pokemon.uid`, docs/features/044-salvar-o-
 * jogo.md) — injetado no core por `definirGeradorDeUid`. UUID v4 do
 * navegador; sem `randomUUID` (página fora de HTTPS, ex.: acesso pela rede
 * local), monta o mesmo formato com `getRandomValues`.
 */
export function createPokemonUid(crypto = globalThis.crypto) {
  if (crypto?.randomUUID) return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}
