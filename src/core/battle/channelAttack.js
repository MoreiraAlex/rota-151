import { rollDamageRandomFactor } from './calculateDamage'

/**
 * Ataque CANALIZADO (`damageMode: 'channel'` na definição — ex.: `ember`,
 * `razor-leaf`): em vez de um impacto único no fim da trajetória, aplica
 * dano em TODOS os alvos dentro do cone a cada `damageInterval` segundos,
 * do `effectAt` até o fim da `duration`. Exige segurar o botão do slot o
 * tempo todo — soltar cancela (`creatureAttackSystem.js`). Ver
 * docs/features/033-skills-de-combate-e-vfx.md.
 */
export function isChannelAttack(attack) {
  return attack?.damageMode === 'channel'
}

/**
 * O ataque atinge um CONE (todos os alvos dentro dele) em vez de uma
 * cápsula (o primeiro corpo no caminho)? Todo canalizado é cone; um golpe de
 * impacto único também pode ser, com `area: 'cone'` (ex.: Growl, que baixa o
 * ataque de TODOS os inimigos à frente). Decide a forma do indicador e do
 * aviso (`AttackShape.jsx`) e quem é atingido (`resolveConeTargets`).
 */
export function isConeAttack(attack) {
  return isChannelAttack(attack) || attack?.area === 'cone'
}

/**
 * O golpe age em QUEM USOU (`area: 'self'` — ex.: Growth, que sobe o ataque da
 * própria criatura)? Sem trajetória e sem alvo: os `effects` vão no atacante,
 * sem sorteio de precisão, e não há indicador nem aviso no chão
 * (`resolveAttackTelegraphProgress`, `AttackIndicatorView`).
 */
export function isSelfAttack(attack) {
  return attack?.area === 'self'
}

/**
 * Quantos ticks de dano do canal caem em `(previousElapsed, elapsed]` —
 * instantes `effectAt + k * damageInterval` (k = 0, 1, ...) que não passam
 * da `duration`. Normalmente 0 ou 1 por tick fixo; mais de 1 só com
 * `damageInterval` menor que o passo. `damageInterval` ausente/≤ 0 = um
 * tick só, no `effectAt`.
 */
export function countChannelTicks(
  previousElapsed,
  elapsed,
  { effectAt, damageInterval, duration },
) {
  const end = Math.min(elapsed, duration)
  if (end < effectAt) return 0

  if (!(damageInterval > 0)) {
    return previousElapsed < effectAt && elapsed >= effectAt ? 1 : 0
  }

  const ticksUpTo = (time) =>
    time < effectAt
      ? 0
      : Math.floor((time - effectAt) / damageInterval + 1e-9) + 1
  return ticksUpTo(end) - ticksUpTo(Math.min(previousElapsed, duration))
}

/**
 * Quantos ticks de dano o canal INTEIRO tem (segurando até o fim) — os
 * mesmos instantes de `countChannelTicks`, de `effectAt` a `duration`.
 */
export function resolveChannelTickCount(attack) {
  return countChannelTicks(-1, attack.duration, attack)
}

/**
 * Frações do dano total, uma por tick, sorteadas no disparo (dano
 * canalizado, `resolveChannelTickDamage`): cada uma com o mesmo sorteio
 * do fator aleatório de um golpe (`rollDamageRandomFactor`, 85%-100%),
 * normalizadas pra somar 1 — os ticks variam entre si, mas o total do
 * canal inteiro é exato.
 */
export function rollChannelWeights(count, rng) {
  if (!(count > 0)) return []
  const raw = Array.from({ length: count }, () => rollDamageRandomFactor(rng))
  const total = raw.reduce((sum, value) => sum + value, 0)
  return raw.map((value) => value / total)
}
