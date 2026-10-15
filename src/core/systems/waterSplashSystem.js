import { WaterSplash } from '../traits'

/**
 * Conta o tempo de todo `WaterSplash` e destrói ao chegar na `duration`
 * (docs/features/057-lagos-e-rios.md) — mesmo padrão de
 * `summonEffectsSystem.js`.
 *
 * Headless. Fase: simulation — independente da ordem com os outros
 * systems.
 */
export function waterSplashSystem(context) {
  const { world, delta } = context
  world.query(WaterSplash).updateEach(([splash], entity) => {
    splash.elapsed += delta
    if (splash.elapsed >= splash.duration) entity.destroy()
  })
}
