/** Volume padrão dos sons de uma criatura, para quem não traz o próprio. */
export const DEFAULT_FOOTSTEP_VOLUME = 0.6
export const DEFAULT_VOICE_VOLUME = 0.25
export const DEFAULT_ACTION_SOUND_VOLUME = 0.6

/**
 * Alcance (m) padrão dos sons de uma criatura, para quem não traz o próprio
 * no config: `REF` = até onde o volume é cheio, `MAX` = onde some de vez
 * (`spatialAudio.js`).
 */
export const DEFAULT_FOOTSTEP_REF_DISTANCE = 5
export const DEFAULT_FOOTSTEP_MAX_DISTANCE = 20
export const DEFAULT_VOICE_REF_DISTANCE = 8
export const DEFAULT_VOICE_MAX_DISTANCE = 40
export const DEFAULT_ACTION_SOUND_REF_DISTANCE = 6
export const DEFAULT_ACTION_SOUND_MAX_DISTANCE = 30

/**
 * Como o volume cai entre `REF` e `MAX`: o que falta do caminho, elevado a
 * `CURVE`. Com expoente um é a reta, que o ouvido sente quase igual por boa
 * parte do caminho e então corta perto do fim (o ouvido mede volume em
 * escala de razão, não de diferença). Com expoente maior, cai desde o começo
 * e chega ao fim já baixinho: soa gradual. Objeto mutável para o laboratório
 * de alcance ajustar ao vivo.
 */
export const SOUND_FALLOFF = { CURVE: 2 }

/** Quanto a distância deixa do volume (0–1). */
export function distanceGain(
  distance,
  { refDistance, maxDistance },
  curve = SOUND_FALLOFF.CURVE,
) {
  if (distance <= refDistance) return 1
  if (distance >= maxDistance) return 0
  const left = 1 - (distance - refDistance) / (maxDistance - refDistance)
  return left ** curve
}
