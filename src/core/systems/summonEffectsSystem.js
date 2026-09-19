import { SummonFlash, RecallBeam } from '../traits'

/**
 * Conta o `lifetime` de todo `SummonFlash`/`RecallBeam` ativo pra baixo,
 * destruindo a entidade ao chegar a zero — mesmo padrão de
 * `consumeEffectSystem.js` (efeito puramente visual, sem posição pra
 * integrar). Os dois efeitos moram no mesmo system (não em dois
 * separados, ao contrário de audio/registries de outras features) porque
 * a lógica é idêntica e nasceram juntos, na mesma feature (ver
 * docs/features/024-esfera-de-invocar.md) — `SummonFlash` no pouso da
 * `SummonBall` (`summonBallSystem.js`), `RecallBeam` no `effectAt` da
 * ação `'recall'` (`partySummonSystem.js`).
 *
 * Headless. Fase: simulation — independente da ordem com os outros
 * systems (não lê nem escreve nada além dos próprios efeitos).
 */
export function summonEffectsSystem(context) {
  const { world, delta } = context

  world.query(SummonFlash).updateEach(([flash], entity) => {
    flash.lifetime -= delta
    if (flash.lifetime <= 0) entity.destroy()
  })

  world.query(RecallBeam).updateEach(([beam], entity) => {
    beam.lifetime -= delta
    if (beam.lifetime <= 0) entity.destroy()
  })
}
