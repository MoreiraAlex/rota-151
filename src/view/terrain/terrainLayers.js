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

/**
 * Camadas de COR do chão (docs/features/052-assets-do-lgpe-e-floresta.md):
 * texturas pintadas do Pokémon Let's Go, usadas como cor (não só claro e
 * escuro) pelos biomas que têm `ground.colors`. Nome da camada → arquivo
 * em public/assets/vegetation/lgpe/textures/ (scripts/lgpe/pack-lgpe.js).
 * A ORDEM é o índice no array de texturas e nos pesos por vértice.
 */
export const TERRAIN_COLOR_LAYERS = [
  ['lgpe-grass', 'grass01_com'],
  ['lgpe-grass-bright', 'grass02_com'],
  ['lgpe-forest-floor', 'floor01_forest'],
  ['lgpe-soil', 'soil01_com'],
  ['lgpe-soil-dark', 'soil08_com'],
  // Calçamento das ruas das cidades (docs/features/056-bioma-cidade.md),
  // no lugar da terra úmida, que nenhum bioma usava.
  ['lgpe-street', 'roadtile01_area02'],
  ['lgpe-rock', 'rock01_forest'],
  ['lgpe-path-stone', 'roadstone01_com'],
  // Das rotas de campo (docs/features/053-planicie-com-assets-do-lgpe.md).
  ['lgpe-route-grass', 'grass01_area02'],
  ['lgpe-trail-soil', 'soil09_com'],
  ['lgpe-sand', 'sand01_com'],
  // Penhasco de terra das rotas secas (docs/features/054-savana-lgpe-e-
  // saida-do-megakit.md).
  ['lgpe-cliff', 'cliff02_com'],
  // Mais chãos das cidades para as ruas (docs/features/056-bioma-
  // cidade.md): asfalto de Viridian e as lajotas de Pewter, Cerulean e
  // Fuchsia.
  ['lgpe-asphalt', 'asphalt01_area02'],
  ['lgpe-pewter-tile', 'tile01_01_area03'],
  ['lgpe-cerulean-tile', 'tile01_01_area04'],
  ['lgpe-fuchsia-tile', 'tile02_01_area02'],
  // As ruas dos temas de Vermilion e Lavender.
  ['lgpe-vermilion-tile', 'tile02_01_area09'],
  ['lgpe-lavender-asphalt', 'asphalt01_area08'],
]

// Os pesos das camadas de cor vão para o shader em vec4 por vértice
// (`COLOR_WEIGHT_GROUPS` deles, `groundColors0`, `groundColors1`...).
export const MAX_COLOR_LAYERS = 20
export const COLOR_WEIGHT_GROUPS = MAX_COLOR_LAYERS / 4

export const terrainColorLayerPath = (layer) =>
  `/assets/vegetation/lgpe/textures/${TERRAIN_COLOR_LAYERS.find(([name]) => name === layer)[1]}.png`

export const terrainColorLayerIndex = (layer) =>
  TERRAIN_COLOR_LAYERS.findIndex(([name]) => name === layer)
