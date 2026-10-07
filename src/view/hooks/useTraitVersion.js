'use client'

import { useEffect, useState } from 'react'
import { useWorld } from 'koota/react'

/**
 * Um número que muda toda vez que `trait` é adicionado, removido ou
 * alterado em QUALQUER entidade do world. Pra tela que lê vários registros
 * de uma vez (a grade do Inventário lendo o `InventoryCell` de cada
 * Pokémon) re-renderizar sem um `useTrait` por entidade.
 */
export function useTraitVersion(trait) {
  const world = useWorld()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const bump = () => setVersion((value) => value + 1)
    const unsubscribers = [
      world.onAdd(trait, bump),
      world.onRemove(trait, bump),
      world.onChange(trait, bump),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [world, trait])

  return version
}
