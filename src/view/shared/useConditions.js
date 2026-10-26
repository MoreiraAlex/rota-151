import { useEffect, useState } from 'react'
import { listActiveConditions } from '@/core/actions/conditions'
import { getCondition } from '@/core/data/conditions'

const NONE = []
const POLL_MS = 100

/**
 * Condições ativas de uma entidade que mostram selo (`feedback.badge`), na
 * ordem em que entraram (`['burn']`...).
 */
export function listConditions(entity) {
  if (!entity?.isAlive?.()) return NONE
  const conditions = listActiveConditions(entity).filter(
    (id) => getCondition(id)?.feedback?.badge,
  )
  return conditions.length ? conditions : NONE
}

function sameConditions(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

/**
 * Condições ativas de uma entidade (queimadura...), pra HUD mostrar
 * o selo (docs/features/039-tipos-e-combate-classico.md, Parte 4). Mesmo esquema de
 * `useStatStages`: lê o ECS a cada `POLL_MS` e só atualiza quando a LISTA
 * muda — o tempo da condição decresce a todo tick, e assinar o trait faria o
 * componente re-renderizar a cada frame. `entity` pode ser `undefined`.
 */
export function useConditions(entity) {
  const [conditions, setConditions] = useState(NONE)

  useEffect(() => {
    const read = () => {
      const next = listConditions(entity)
      setConditions((current) =>
        sameConditions(current, next) ? current : next,
      )
    }
    read()
    const id = setInterval(read, POLL_MS)
    return () => clearInterval(id)
  }, [entity])

  return conditions
}
