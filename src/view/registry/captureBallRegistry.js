/**
 * Registro Pokébola de captura → as partes que a view anima
 * (`CaptureBallView.jsx` → `captureBallViewSystem.js`, docs/features/043-
 * captura.md): `spinRef` (o grupo do modelo, que gira/balança/encolhe),
 * `glowRef` (o brilho da absorção) e `sparksRef` (estrelinhas do
 * "Capturado!" e pedaços da bola quebrando). Também guarda o que só a view
 * precisa lembrar entre frames: a última balançada vista, o tempo da
 * balançada atual, o giro pra encarar quem arremessou e os clipes do `.glb`
 * (o modelo carregado, o mixer dele e o clipe tocando). Mesmo padrão de
 * `droppedFoodRegistry.js`.
 *
 * O modelo (`setCaptureBallModel`, do `ItemModel` filho) pode chegar ANTES
 * do registro das refs (efeito do filho roda antes do do pai) — por isso
 * as duas entradas criam a entrada se ainda não existe.
 */
const entries = new Map()

function entryOf(entity) {
  if (!entries.has(entity)) {
    entries.set(entity, {
      spinRef: null,
      glowRef: null,
      sparksRef: null,
      lastShakes: 0,
      wobbleTime: Infinity,
      yaw: null,
      model: null,
      mixer: null,
      clip: null,
    })
  }
  return entries.get(entity)
}

export function registerCaptureBall(entity, refs) {
  Object.assign(entryOf(entity), refs)
}

/** O modelo carregado (`root` + clipes `animations`), ou `null`. */
export function setCaptureBallModel(entity, model) {
  if (!model && !entries.has(entity)) return
  const entry = entryOf(entity)
  entry.mixer?.stopAllAction()
  entry.model = model
  entry.mixer = null
  entry.clip = null
}

export function unregisterCaptureBall(entity) {
  entries.get(entity)?.mixer?.stopAllAction()
  entries.delete(entity)
}

export function getCaptureBall(entity) {
  return entries.get(entity)
}
