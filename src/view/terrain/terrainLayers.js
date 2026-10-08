/**
 * Camadas de desenho do chão (docs/features/047-biomas.md): cada uma é um
 * JPEG empacotado por `scripts/pack-terrain-textures.py` (R = claro e
 * escuro em volta do brilho médio, G/B = x/y do mapa de normal). Os biomas
 * escolhem as camadas pelo nome (`ground`, core/data/biomes/). A ORDEM é o
 * índice no array de texturas e nos pesos por vértice — tem que bater com o
 * script.
 */
export const TERRAIN_LAYERS = [
  'grass',
  'forest-floor',
  'sand',
  'snow',
  'dry-ground',
  'mud',
  'rock',
  'volcanic-rock',
]

// Os pesos vão para o shader em dois vec4 por vértice.
export const MAX_TERRAIN_LAYERS = 8

export const terrainLayerPath = (layer) =>
  `/assets/textures/terrain/${layer}.jpg`

export const terrainLayerIndex = (layer) => TERRAIN_LAYERS.indexOf(layer)
