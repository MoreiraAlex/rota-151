import { clamp } from '@/core/math/clamp'

// Até onde (m da câmera) a etiqueta aparece — pedido do usuário
// (docs/features/062-spawn-estilo-cobblemon.md): com o mundo povoado, as
// etiquetas das selvagens longe ficavam boiando no horizonte. Some aos
// poucos nos últimos `NAMEPLATE_FADE_DISTANCE` metros antes do limite.
export const NAMEPLATE_SHOW_DISTANCE = 40
export const NAMEPLATE_FADE_DISTANCE = 5

/** Opacidade pelo alcance: cheia até perto do limite, some no limite. */
export function nameplateRangeOpacity(distance) {
  return clamp(
    (NAMEPLATE_SHOW_DISTANCE - distance) / NAMEPLATE_FADE_DISTANCE,
    0,
    1,
  )
}
