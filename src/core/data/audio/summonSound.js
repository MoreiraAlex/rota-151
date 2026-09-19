/**
 * Som de invocar uma criatura (ver docs/features/023-estado-de-humor-e-
 * piscar-de-olhos.md, seção "Som de invocar/recolher") — exclusivo do
 * treinador, só ele tem `Party`/invoca de verdade (`partySummonSystem.js`).
 * Sem conceito de grupo (ao contrário
 * de `dashSound.js`/`jumpSound.js`): só existe uma espécie `kind:
 * 'trainer'` hoje (`bot`), não há o que compartilhar entre espécies —
 * mesmo espírito simples de `voiceSound.js`. Se um dia isso mudar,
 * adicionar grupo aqui é o mesmo desenho já usado pros outros, não
 * precisa mudar quem chama isto.
 *
 * Vem de `core/data/species/bot/index.js`, bloco `sounds.summon: {
 * clips: [...], volume?, refDistance? }`.
 */
export function resolveSummonSound(species) {
  return species?.sounds?.summon ?? null
}
