/**
 * Quando a silhueta atrás das plantas aparece (docs/features/066-revisao-
 * dos-biomas.md, `createSilhouette`): a do seu lado (treinador e time),
 * sempre; a das selvagens (`wild`), só com o nameplate dela à mostra —
 * sem nameplate (longe, na névoa, dentro da Pokébola), sem silhueta — e
 * nunca à noite com `hideAtNight` (`RENDER.SILHOUETTE.WILD_AT_NIGHT`): de
 * noite batalha e captura ficam mais difíceis.
 *
 * O nameplate avisa a cada quadro se está à mostra (`setNameplateShown`,
 * `NameplateView`); quem lê o relógio aplica (`updateSilhouettes`,
 * `DayNightView`). Só visual.
 */

// Entidade → o nameplate está à mostra.
const shownPlates = new Map()
// Silhueta → { entity, wild, hideAtNight }.
const tracked = new Map()

/** O nameplate de `entity` está (ou não) à mostra neste quadro. */
export function setNameplateShown(entity, shown) {
  shownPlates.set(entity, shown)
}

/** O nameplate de `entity` saiu de cena. */
export function clearNameplate(entity) {
  shownPlates.delete(entity)
}

/**
 * Passa a decidir a visibilidade das `silhouettes` de `entity` (nascem
 * escondidas até o próximo `updateSilhouettes`). Devolve a função que
 * para.
 */
export function trackSilhouettes(
  entity,
  silhouettes,
  { wild = false, hideAtNight = false } = {},
) {
  for (const silhouette of silhouettes) {
    silhouette.visible = false
    tracked.set(silhouette, { entity, wild, hideAtNight })
  }
  return () => {
    for (const silhouette of silhouettes) tracked.delete(silhouette)
  }
}

/**
 * Mostra as do seu lado sempre; as das selvagens, com o nameplate à mostra
 * (e, à noite, não as que somem).
 */
export function updateSilhouettes(isNight) {
  for (const [silhouette, { entity, wild, hideAtNight }] of tracked) {
    silhouette.visible =
      !wild || (shownPlates.get(entity) === true && !(hideAtNight && isNight))
  }
}
