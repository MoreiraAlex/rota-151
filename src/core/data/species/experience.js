import { GAME_CONFIG } from '../../gameConfig'

/**
 * Curvas de nível e fórmula de XP ganho — convenção clássica de Pokémon
 * (docs/features/037-experiencia-e-nivel.md). Puro: só número entra, só
 * número sai; quem guarda nível/XP de cada criatura é `CreatureLevel`/
 * `PartyProgress`, quem escreve é `core/actions/experience.js`.
 */

/**
 * XP TOTAL pra estar no nível `n`, por grupo de crescimento (`growthRate`
 * da espécie) — as seis curvas da série. Sem arredondamento aqui: o
 * `experienceForLevel` abaixo corta e nunca deixa ficar negativo (a
 * médio-lenta sai negativa no nível 1).
 */
const GROWTH_CURVES = {
  fast: (n) => (4 * n ** 3) / 5,
  'medium-fast': (n) => n ** 3,
  'medium-slow': (n) => (6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140,
  slow: (n) => (5 * n ** 3) / 4,
  erratic: (n) => {
    if (n < 50) return (n ** 3 * (100 - n)) / 50
    if (n < 68) return (n ** 3 * (150 - n)) / 100
    if (n < 98) return (n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500
    return (n ** 3 * (160 - n)) / 100
  },
  fluctuating: (n) => {
    if (n < 15) return (n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50
    if (n < 36) return (n ** 3 * (n + 14)) / 50
    return (n ** 3 * (Math.floor(n / 2) + 32)) / 50
  },
}

export const GROWTH_RATES = Object.keys(GROWTH_CURVES)

function resolveCurve(growthRate) {
  return (
    GROWTH_CURVES[growthRate] ??
    GROWTH_CURVES[GAME_CONFIG.EXPERIENCE.DEFAULT_GROWTH_RATE]
  )
}

function clampLevel(level) {
  return Math.min(GAME_CONFIG.EXPERIENCE.MAX_LEVEL, Math.max(1, level))
}

/**
 * XP total pra estar no `level` (nível 1 = 0; teto `MAX_LEVEL`): a curva do
 * grupo × `CURVE_MULTIPLIER` (o mesmo pra todo grupo — muda o ritmo do jogo
 * inteiro sem mudar o formato das curvas).
 */
export function experienceForLevel(growthRate, level) {
  const clamped = clampLevel(level)
  if (clamped <= 1) return 0
  const { CURVE_MULTIPLIER } = GAME_CONFIG.EXPERIENCE
  return Math.max(
    0,
    Math.floor(resolveCurve(growthRate)(clamped) * CURVE_MULTIPLIER),
  )
}

/** Nível de quem tem `xp` de total (inverso de `experienceForLevel`). */
export function levelForExperience(growthRate, xp) {
  let level = 1
  while (
    level < GAME_CONFIG.EXPERIENCE.MAX_LEVEL &&
    experienceForLevel(growthRate, level + 1) <= xp
  ) {
    level++
  }
  return level
}

/**
 * Fração (0-1) do caminho do nível atual até o próximo — o anel de XP do
 * HUD. No nível máximo, `1`.
 */
export function resolveLevelProgress(growthRate, level, xp) {
  if (level >= GAME_CONFIG.EXPERIENCE.MAX_LEVEL) return 1
  const start = experienceForLevel(growthRate, level)
  const end = experienceForLevel(growthRate, level + 1)
  if (end <= start) return 1
  return Math.min(1, Math.max(0, (xp - start) / (end - start)))
}

/**
 * XP ganho por UM vencedor — fórmula escalada (Gen 5):
 * `(baseXp × Nd ÷ BASE_DIVISOR ÷ participantes) × ((2·Nd + 10) ÷ (Nd + Nv
 * + 10))^SCALING_EXPONENT + 1`, Nd = nível da derrotada, Nv = nível de
 * quem ganha. Vencer nível mais alto rende mais; mais baixo, menos. A
 * divisão entre participantes vem antes da escala, como na série — cada
 * um escala pelo próprio nível.
 */
export function calculateExperienceGain({
  baseXp,
  defeatedLevel,
  winnerLevel,
  participants = 1,
}) {
  const { BASE_DIVISOR, SCALING_EXPONENT } = GAME_CONFIG.EXPERIENCE
  const share =
    (baseXp * defeatedLevel) / BASE_DIVISOR / Math.max(1, participants)
  const scale =
    ((2 * defeatedLevel + 10) / (defeatedLevel + winnerLevel + 10)) **
    SCALING_EXPONENT
  return Math.floor(share * scale) + 1
}

/** XP base de uma espécie (fallback em config). */
export function resolveBaseXp(species) {
  return species?.baseXp ?? GAME_CONFIG.EXPERIENCE.FALLBACK_BASE_XP
}

/** Grupo de crescimento de uma espécie (fallback em config). */
export function resolveGrowthRate(species) {
  return species?.growthRate ?? GAME_CONFIG.EXPERIENCE.DEFAULT_GROWTH_RATE
}

/**
 * Nível + XP de quem NASCE num nível (selvagem no spawn, criatura nova no
 * time): o XP é o começo exato do nível, anel de XP vazio.
 */
export function createLevelState(species, level) {
  const clamped = clampLevel(level)
  return {
    level: clamped,
    xp: experienceForLevel(resolveGrowthRate(species), clamped),
  }
}

/**
 * Nível sorteado de uma selvagem: a faixa da entrada de spawn
 * (`levelRange: [min, max]`) ou a padrão (`WILD_LEVEL_MIN`/`MAX`). `rng`
 * vem de fora (`gameplayRng`) — regra 3.5.
 */
export function rollWildLevel(rng, levelRange) {
  const { WILD_LEVEL_MIN, WILD_LEVEL_MAX } = GAME_CONFIG.EXPERIENCE
  const [min, max] = levelRange ?? [WILD_LEVEL_MIN, WILD_LEVEL_MAX]
  return clampLevel(Math.floor(rng() * (max - min + 1)) + min)
}
