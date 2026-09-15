import { trait } from 'koota'

/**
 * Efeito visual passageiro de "usei um consumível" (ver
 * docs/features/014-arremessar-usar-e-invocar.md pro `'consume'` em si) —
 * `Position`/`Rotation` (traits já existentes, esta última só por exigência
 * do `syncTransformSystem`) cuidam de onde aparece; `lifetime` é quanto
 * tempo (segundos) falta até desaparecer sozinho. Sem movimento, sem
 * gravidade — fica parado no lugar em que nasceu.
 *
 * Dono de escrita: `playerActionSystem` (spawna, no instante de efeito da
 * ação `'consume'`); `consumeEffectSystem` (conta `lifetime` pra baixo,
 * destrói a entidade ao chegar a zero).
 */
export const ConsumeEffect = trait({
  lifetime: 0,
})
