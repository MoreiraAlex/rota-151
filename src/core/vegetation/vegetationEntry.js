/**
 * A entrada de um tipo no `vegetation` de um bioma, só quando ela diz os
 * modelos do Let's Go dela (`models`, docs/features/054-savana-lgpe-e-
 * saida-do-megakit.md): sem modelo, o tipo não nasce — nem a planta, nem o
 * colisor. É o que deixa vazios os biomas ainda não refinados (vistos só
 * pelo F2), sem objeto invisível no caminho.
 */
export function vegetationEntryOf(biome, kind) {
  const entry = biome?.vegetation.find((item) => item.kind === kind)
  return entry?.models?.length ? entry : null
}
