import { GAME_CONFIG } from '../gameConfig'
import { Pokemon, SummonedFrom } from '../traits'

/**
 * Posturas da criatura do time fora do controle
 * (docs/features/064-revisao-da-ia-do-parceiro.md, Parte 2):
 * - `'aggressive'`: ataca toda selvagem que vê (`PARTY_BEHAVIOR.PERCEPTION`)
 *   e tudo que a defensiva atacaria;
 * - `'defensive'`: entra quando uma selvagem acerta alguém do grupo ou parte
 *   para cima dele;
 * - `'neutral'`: só luta contra quem a acertou.
 */
export const POSTURES = ['aggressive', 'defensive', 'neutral']

/** Se `value` é uma postura conhecida. */
export function isPosture(value) {
  return POSTURES.includes(value)
}

/** A postura, ou a padrão (`PARTY_BEHAVIOR.DEFAULT_POSTURE`) se não for uma. */
export function normalizePosture(value) {
  return isPosture(value) ? value : GAME_CONFIG.PARTY_BEHAVIOR.DEFAULT_POSTURE
}

/** A postura do `pokemon` (o registro). */
export function resolvePokemonPosture(pokemon) {
  return normalizePosture(pokemon?.get?.(Pokemon)?.posture)
}

/**
 * A postura da criatura em campo — a do registro de onde ela veio
 * (`SummonedFrom`). Sem registro, a padrão.
 */
export function resolveCreaturePosture(creature) {
  const pokemon = creature?.isAlive?.()
    ? creature.targetFor(SummonedFrom)
    : null
  return resolvePokemonPosture(pokemon?.isAlive?.() ? pokemon : null)
}

/**
 * Se uma criatura nesta postura entra na luta quando uma selvagem acerta
 * alguém do grupo: a neutra só quando foi ELA (`self`).
 */
export function joinsOnHit(posture, { self }) {
  return posture !== 'neutral' || self
}

/**
 * Se a postura luta pelo grupo (contra quem persegue alguém dele e por quem
 * mira o treinador). A neutra só cuida de si.
 */
export function defendsGroup(posture) {
  return posture !== 'neutral'
}

/** Se a postura procura briga com a selvagem que vê. */
export function seeksWilds(posture) {
  return posture === 'aggressive'
}
