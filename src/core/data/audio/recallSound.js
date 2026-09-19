/**
 * Som de recolher uma criatura — mesmo espírito de `summonSound.js`
 * (exclusivo do treinador, sem grupo, ver docs/features/023-estado-de-
 * humor-e-piscar-de-olhos.md, seção "Som de invocar/recolher").
 *
 * Vem de `core/data/species/bot/index.js`, bloco `sounds.recall: {
 * clips: [...], volume?, refDistance? }`.
 */
export function resolveRecallSound(species) {
  return species?.sounds?.recall ?? null
}
