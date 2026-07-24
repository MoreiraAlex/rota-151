const entityViews = new Map()

export function registerView(entity, mesh) {
  entityViews.set(entity, mesh)
}

export function unregisterView(entity) {
  entityViews.delete(entity)
}

export function getView(entity) {
  return entityViews.get(entity)
}
