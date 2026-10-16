/**
 * Registro entidade → voo rasante (`species.body.flightHeight`, ver
 * docs/features/059-as-10-especies.md, Parte 16). Mesmo padrão de
 * `mouthSyncRegistry.js`: `useAnimatedModel.js` registra no `useEffect`,
 * desregistra no cleanup; `view/systems/flightLiftSystem.js` só lê/mexe.
 *
 * `object`: o modelo clonado (posicionado em `body.modelOffset`); `baseY`, o
 * `modelOffset.y` dele; `height`, a altura do voo; `lift`, quanto ele está
 * acima do `baseY` agora (sobe e desce suave, não salta).
 */
const entries = new Map()

export function registerFlightLift(entity, lift) {
  entries.set(entity, lift)
}

export function unregisterFlightLift(entity) {
  entries.delete(entity)
}

/** Todas as entradas registradas — `flightLiftSystem.js` itera direto. */
export function getFlightLiftEntries() {
  return entries.entries()
}
