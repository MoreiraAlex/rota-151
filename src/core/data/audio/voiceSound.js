// Defaults quando a espécie declara `sounds.voice` sem `minInterval`/
// `maxInterval` — intervalo (s) sorteado de novo a cada vocalização (ver
// docstring de `view/systems/voiceAudioSystem.js`), não um valor fixo.
export const DEFAULT_VOICE_MIN_INTERVAL = 10
export const DEFAULT_VOICE_MAX_INTERVAL = 25

/**
 * Resolve a config de "voz" de uma espécie — som periódico (grito/
 * vocalização, tipo "cry" de Pokémon), independente de andar/correr, ver
 * docs/features/019-som-ambiente-e-passos.md. Vem de `core/data/species/
 * <id>/index.js`, bloco `sounds.voice: { clips: [...], volume?,
 * refDistance?, minInterval?, maxInterval? }`.
 *
 * Ao contrário do som de passo (`footstepGroups.js`), SEM conceito de
 * grupo compartilhado ainda — cada espécie declara a própria config, ou
 * nenhuma (sem `sounds.voice`, a espécie simplesmente não vocaliza, mesmo
 * fallback gracioso de qualquer conteúdo que ainda não existe no
 * projeto). Adicionar grupo aqui, se um dia fizer falta, é o mesmo
 * desenho já usado pra passo — não precisa mudar quem chama isto.
 */
export function resolveVoiceSound(species) {
  return species?.sounds?.voice ?? null
}
