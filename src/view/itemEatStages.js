/**
 * Mostra só o pedaço da fruta que corresponde a `eaten` (0–1, quanto já foi
 * comido) — o primeiro (`item.model.eatStages[0]`, a fruta inteira) no
 * começo, o último quase no fim (docs/features/042-itens-da-beta.md). Sem
 * pedaços, nada. Devolve o índice do pedaço visível (`-1` sem pedaços).
 */
export function setEatStage(stages, eaten) {
  if (!stages?.length) return -1
  const index = Math.min(
    stages.length - 1,
    Math.floor(Math.max(0, eaten) * stages.length),
  )
  stages.forEach((stage, i) => {
    stage.visible = i === index
  })
  return index
}
