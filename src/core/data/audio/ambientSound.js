// Defaults quando `TEST_LEVEL.ambientSound` não declara `minInterval`/
// `maxInterval` — intervalo (s) sorteado de novo a cada reprodução (mesmo
// esquema de `core/data/audio/voiceSound.js`), não um valor fixo. Maior
// que o de voz — som ambiente é mais espaçado, o ponto é textura ocasional
// de fundo, não algo constante.
export const DEFAULT_AMBIENT_MIN_INTERVAL = 15
export const DEFAULT_AMBIENT_MAX_INTERVAL = 45

/**
 * Resolve a config de som ambiente do nível — `core/data/testLevel.js`,
 * campo `ambientSound: { clips: [...], volume?, minInterval?,
 * maxInterval? }`. Ver docs/features/019-som-ambiente-e-passos.md pro
 * porquê de ser "toca uma variação de vez em quando" (mesmo mecanismo de
 * `voiceSound.js`) em vez de uma faixa única em loop contínuo: os
 * arquivos reais disponíveis são rajadas de vento de poucos segundos —
 * um clipe curto desses em loop soaria obviamente repetitivo; variações
 * tocadas esporadicamente, em intervalo também aleatório, não.
 *
 * Sem `ambientSound` no nível, `null` — o jogo fica em silêncio
 * ambiente, mesmo fallback gracioso de qualquer conteúdo que ainda não
 * existe no projeto.
 */
export function resolveAmbientSound(level) {
  return level?.ambientSound ?? null
}
