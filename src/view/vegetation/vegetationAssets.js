/**
 * Modelos da vegetação (docs/features/049-vegetacao-e-floresta.md). A
 * grama vem do repositório stylized-scene (código MIT, uso liberado pelo
 * usuário); todo o resto, do Stylized Nature MegaKit da Quaternius (CC0),
 * empacotado por `scripts/pack-forest-assets.py` em
 * `public/assets/vegetation/megakit/`.
 */
export const GRASS_BLADES_PATH = '/assets/vegetation/grass-blades.glb'

const MEGAKIT_DIR = '/assets/vegetation/megakit'

export const megakitPath = (name) => `${MEGAKIT_DIR}/${name}.glb`

/**
 * Casca da folhosa e da árvore antiga — também a do tronco caído (feito em
 * código).
 */
export const BARK_TEXTURE_PATH = `${MEGAKIT_DIR}/bark-twisted.jpg`

const numbered = (prefix, numbers) => numbers.map((n) => `${prefix}-${n}`)

/**
 * Os modelos de cada tipo de vegetação (`kind` do `vegetation` dos
 * biomas): cada planta ou pedra sorteia um deles.
 */
export const VEGETATION_MODELS = {
  'broadleaf-tree': numbered('tree', [1, 2, 3, 4, 5]),
  'ancient-tree': numbered('ancient', [1, 2, 3, 4, 5]),
  'pine-tree': numbered('pine', [1, 2, 3, 4, 5]),
  'dead-tree': numbered('dead', [1, 2, 4]),
  bush: ['bush-1', 'bush-2'],
  flower: ['flower-1', 'flower-2'],
  fern: ['fern'],
  'leafy-plant': ['plant-1', 'plant-2'],
  mushroom: ['mushroom'],
  rock: ['rock-1', 'rock-2', 'rock-3'],
  pebble: numbered('pebble', [1, 2, 3, 4]),
}

/**
 * Como cada parte de um modelo do MegaKit é desenhada, pelo nome do
 * material dela (o script dá um nome por espécie):
 * - `canopy`: copa das árvores e dos arbustos (vento da copa, volume e
 *   normal esférica, sombra recortada);
 * - `foliage`: planta baixa (vento da grama);
 * - `bark`: casca (sem vento, clareada na sombra);
 * - `rock`: pedra (musgo no topo);
 * - `solid`: como veio (cogumelo, seixo).
 */
export const PART_KINDS = {
  Leaves_Broadleaf: 'canopy',
  Leaves_Ancient: 'canopy',
  Leaves_Pine: 'canopy',
  Leaves_Bush: 'canopy',
  Leaves_BushFlowers: 'canopy',
  Bark_Broadleaf: 'bark',
  Bark_Ancient: 'bark',
  Bark_Pine: 'bark',
  Bark_Dead: 'bark',
  Leaves: 'foliage',
  Flowers: 'foliage',
  Mushrooms: 'solid',
  Rocks: 'rock',
  PathRocks: 'solid',
}

/**
 * Cor que multiplica a textura de algumas partes, pelo nome do material —
 * as folhas (brancas no pacote, para tingir) e a casca de cada espécie.
 * Lida do `GAME_CONFIG` a cada quadro (o debug mexe).
 */
export const PART_COLORS = {
  Leaves_Broadleaf: (config) => config.TREES.LEAF_COLOR,
  Leaves_Ancient: (config) => config.ANCIENT_TREES.LEAF_COLOR,
  Leaves_Pine: (config) => config.PINES.LEAF_COLOR,
  Leaves_Bush: (config) => config.BUSHES.LEAF_COLOR,
  Leaves_BushFlowers: (config) => config.BUSHES.LEAF_COLOR,
  Bark_Broadleaf: (config) => config.TREES.BARK_COLOR,
  Bark_Ancient: (config) => config.TREES.BARK_COLOR,
  Bark_Pine: (config) => config.PINES.BARK_COLOR,
  Bark_Dead: (config) => config.DEAD_TREES.BARK_COLOR,
}
