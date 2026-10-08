import { GAME_CONFIG } from './gameConfig'

/**
 * PRNG seedado (mulberry32) — regra do projeto (docs/rules/README.md,
 * 3.5): "sem `Math.random()` em lógica de jogo... PRNG seedado e
 * nomeado (RNG de gameplay, de geração procedural, do servidor,
 * cosmético)". Esta é a primeira feature com aleatoriedade de jogo de
 * verdade (IV de criatura selvagem, ver `core/data/species/stats.js`),
 * então esta infra nasce agora, como a regra prevê.
 *
 * `createRng(seed)` é puro e testável — mesmo seed produz sempre a
 * mesma sequência, chamando o `next()` retornado repetidamente avança
 * o estado interno (cada chamada dá um número diferente).
 */
export function createRng(seed) {
  let state = seed >>> 0
  return function next() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Seed derivada de outra por um nome (`salt`) — cada uso de aleatoriedade
 * tem a própria sequência a partir da mesma seed do mundo (ex.: o relevo,
 * docs/features/045-terreno-de-um-chunk.md). Mistura FNV-1a do nome com a
 * seed; mesma entrada, mesma saída.
 */
export function deriveSeed(seed, salt) {
  let hash = (2166136261 ^ (seed >>> 0)) >>> 0
  for (let i = 0; i < salt.length; i++) {
    hash = Math.imul(hash ^ salt.charCodeAt(i), 16777619) >>> 0
  }
  return Math.imul(hash ^ (hash >>> 16), 2246822507) >>> 0
}

/** Inteiro sorteado em `[min, max]`, inclusive nos dois extremos. */
export function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

/**
 * Singleton NOMEADO de "RNG de gameplay" (distinto de um futuro RNG de
 * geração procedural/servidor/cosmético, cada um com seu próprio seed
 * quando existir — regra 3.5). Seed vem de `GAME_CONFIG.WORLD.SEED`
 * (já existia, sem consumidor até agora) — não `Date.now()` (proibido
 * em `core/`, mesma regra): sem save de estado de jogo ainda, a
 * sequência de sorteios é a MESMA a cada reinício do jogo. Efeito
 * aceito por enquanto: os IVs de cada criatura selvagem, na ordem em
 * que nascem, se repetem entre sessões (a espécie/posição de cada uma vem
 * do RNG de geração do nível, `core/data/testLevel.js`). Quando existir
 * uma fonte de seed por sessão/save de verdade, troca-se aqui, um lugar
 * só.
 */
export const gameplayRng = createRng(GAME_CONFIG.WORLD.SEED)

/**
 * RNG COSMÉTICO (regra 3.5) — sorteios que só mudam a aparência, sem efeito
 * em regra de jogo (ex.: pra onde a fruta derrubada voa, docs/features/042-
 * itens-da-beta.md). Separado do de gameplay pra um efeito visual a mais ou a
 * menos não mudar a sequência dos sorteios que importam.
 */
export const cosmeticRng = createRng(GAME_CONFIG.WORLD.SEED + 1)
