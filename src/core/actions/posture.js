import { isPosture } from '../party/posture'
import { Pokemon } from '../traits'

/**
 * Troca a postura do `pokemon` (o registro,
 * docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2). A criatura em
 * campo lê dali a cada tick, então muda na hora. Postura desconhecida é
 * ignorada. Devolve se trocou.
 */
export function definirPostura(pokemon, posture) {
  if (!pokemon?.isAlive?.() || !pokemon.has(Pokemon)) return false
  if (!isPosture(posture)) return false
  if (pokemon.get(Pokemon).posture === posture) return false
  pokemon.set(Pokemon, { posture })
  return true
}
