/**
 * Registro entidade → luz de fogo presa num osso (`species.vfx.fireLight`,
 * docs/features/060-ajustes-por-especie.md). Mesmo padrão de
 * `viewRegistry.js`: `useAnimatedModel.js` cria a
 * `THREE.PointLight`, encaixa no osso (`bone.add`) e registra no
 * `useEffect`; desregistra no cleanup. `view/systems/fireLightSystem.js`
 * só lê e mexe na luz.
 *
 * Por entidade: vários Charmander (invocado e os do nível de teste) podem
 * existir ao mesmo tempo, cada um com a própria luz.
 *
 * `bone` fica junto porque o system lê a escala dele todo frame (o
 * deslocamento da luz é em metros e precisa cancelar a escala do rig).
 * `config` é o `fireLight` já resolvido com os padrões
 * (`resolveFireLight`).
 */
const entries = new Map()

export function registerFireLight(entity, light, bone, config) {
  // `fade` (0-1): 0 desmaiada, 1 acordada — o system enfraquece a luz com a
  // criatura desmaiada e volta ao acordar. `elapsed` é o relógio do tremor.
  entries.set(entity, { light, bone, config, fade: 1, elapsed: 0 })
}

export function unregisterFireLight(entity) {
  const entry = entries.get(entity)
  if (!entry) return
  entry.bone.remove(entry.light)
  entry.light.dispose()
  entries.delete(entity)
}

export function getFireLightEntry(entity) {
  return entries.get(entity)
}

export function getFireLightEntries() {
  return entries.entries()
}
