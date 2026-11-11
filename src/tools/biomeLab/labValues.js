/**
 * "Copiar valores" do laboratório de biomas (docs/features/066-revisao-dos-
 * biomas.md): compara o config e os dados dos biomas com uma cópia tirada
 * ao abrir o lab e leva só o que mudou — o que foi mexido no painel do lab
 * e nos do F2.
 */

/** Cópia funda de dados simples (números, textos, listas e objetos). */
export const snapshotOf = (value) => JSON.parse(JSON.stringify(value))

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * O que mudou de `before` para `after`: `{ path, value }` com o caminho de
 * chaves até o valor novo. Listas contam inteiras (mudou um item, vai a
 * lista toda); objetos descem campo a campo.
 *
 * @returns {{ path: string[], value: unknown }[]}
 */
export function changedValues(before, after, path = []) {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...keys].flatMap((key) =>
      changedValues(before[key], after[key], [...path, key]),
    )
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  return [{ path, value: after }]
}

/**
 * O texto para colar: um valor por linha, `CAMINHO.ATÉ.O.CAMPO: valor`,
 * no formato do config (JSON nos valores). Vazio quando nada mudou.
 */
export function formatChangedValues(changes) {
  return changes
    .map(({ path, value }) => `${path.join('.')}: ${JSON.stringify(value)}`)
    .join('\n')
}
