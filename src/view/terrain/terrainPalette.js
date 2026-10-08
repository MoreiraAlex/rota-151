// Cores do relevo (docs/features/045-terreno-de-um-chunk.md) — provisórias,
// até os biomas (047) definirem as próprias. Alturas em metros relativas ao
// nível da água (`GAME_CONFIG.TERRAIN.WATER_LEVEL`).
export const TERRAIN_PALETTE = {
  // Fundo dos lagos (abaixo da água).
  lakeBed: '#6b5a3e',
  // Margem: da água até SHORE_HEIGHT acima dela.
  shore: '#c2b280',
  // Grama: de lowGrass (logo acima da margem) até highGrass em
  // GRASS_TOP_HEIGHT acima da água.
  lowGrass: '#4f8a3c',
  highGrass: '#7a9a4a',
  // Encosta: mistura até slope quando a inclinação passa de SLOPE_START
  // (normal.y abaixo dele) e chega cheia em SLOPE_FULL.
  slope: '#7d6a52',
  SHORE_HEIGHT: 0.6,
  GRASS_TOP_HEIGHT: 8,
  SLOPE_START: 0.9,
  SLOPE_FULL: 0.75,
}
