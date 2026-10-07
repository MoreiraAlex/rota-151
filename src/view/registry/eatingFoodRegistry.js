/**
 * Registro quem come → visual da fruta na mão/no chão
 * (docs/features/042-itens-da-beta.md). Mesmo padrão de `viewRegistry.js`:
 * `EatingFoodView.jsx` registra no `useEffect` e desregistra no cleanup;
 * `view/systems/eatingFoodViewSystem.js` posiciona todo frame.
 *
 * - `group` — o grupo de fora: vai pra âncora (mão, boca, chão).
 * - `spherePivotRef` — ref do pivô da esfera (quem não tem modelo, ou
 *   enquanto ele carrega).
 * - `model` — `{ stages, pivot }` do modelo da fruta quando carregou
 *   (`ItemModel.jsx`): os pedaços (`item.model.eatStages`) e o pivô, o
 *   grupo no centro do corpo da fruta — é nele que ela gira e aperta. O
 *   modelo pode avisar antes do `group` ser registrado (efeito do filho roda
 *   antes do pai), por isso a entrada nasce de quem chegar primeiro.
 * - `groundPoint` — onde a fruta ficou no chão (âncora `ground`), fixada no
 *   primeiro frame, pra ela não escorregar com a cabeça mastigando.
 * - `motion` — mola da mordida e relógio das mordidas (`view/foodMotion.js`).
 * - `handStart` — rotação da mão quando a fruta apareceu (âncora `hands`): a
 *   fruta gira o quanto a mão girou desde então, a partir de `baseRotation`
 *   (de frente pra quem come).
 */
const entries = new Map()

function entryOf(eater) {
  if (!entries.has(eater)) {
    entries.set(eater, {
      group: null,
      spherePivotRef: null,
      model: null,
      groundPoint: null,
      motion: null,
      handStart: null,
      baseRotation: null,
    })
  }
  return entries.get(eater)
}

export function registerEatingFood(eater, group, spherePivotRef = null) {
  const entry = entryOf(eater)
  entry.group = group
  entry.spherePivotRef = spherePivotRef
}

export function setEatingFoodModel(eater, model) {
  if (!model && !entries.has(eater)) return
  entryOf(eater).model = model
}

export function unregisterEatingFood(eater) {
  entries.delete(eater)
}

export function getEatingFood(eater) {
  return entries.get(eater)
}

/**
 * Onde a fruta gira e aperta: o pivô do modelo, o da esfera, ou (nada
 * carregado ainda) o grupo de fora.
 */
export function resolveFoodPivot(entry) {
  return entry.model?.pivot ?? entry.spherePivotRef?.current ?? entry.group
}
