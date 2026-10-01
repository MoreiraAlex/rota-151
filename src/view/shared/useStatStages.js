import { useEffect, useState } from 'react'
import { listActiveStatStages } from '@/core/battle/statStages'

const NONE = []
const POLL_MS = 100

function sameStages(a, b) {
  return (
    a.length === b.length &&
    a.every((item, i) => item.stat === b[i].stat && item.stage === b[i].stage)
  )
}

/**
 * Estágios de atributo ativos de uma entidade (`[{ stat, stage }]`, vazio =
 * nada alterado), pra HUD mostrar o indicador de status. Lê o ECS a cada
 * `POLL_MS` e só atualiza o estado quando os ESTÁGIOS mudam — o tempo de cada
 * estágio decresce a todo tick (`statStageSystem`), e assinar o trait faria o
 * componente re-renderizar 60 vezes por segundo enquanto houver um efeito.
 * `entity` pode ser `undefined` (criatura sem corpo em campo): devolve vazio.
 */
export function useStatStages(entity) {
  const [stages, setStages] = useState(NONE)

  useEffect(() => {
    const read = () => {
      const next =
        entity && entity.isAlive() ? listActiveStatStages(entity) : NONE
      setStages((current) => (sameStages(current, next) ? current : next))
    }
    read()
    const id = setInterval(read, POLL_MS)
    return () => clearInterval(id)
  }, [entity])

  return stages
}
