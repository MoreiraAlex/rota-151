import { rollDamageRandomFactor } from './calculateDamage'

/**
 * Ataque CANALIZADO (`execution: 'channel'` — ex.: Water Gun, Razor Leaf): em
 * vez de um impacto único, aplica dano a cada `damageInterval` segundos, do
 * `effectAt` até o fim da `duration` — no cone, em todos dentro; na cápsula,
 * no primeiro corpo (`isBeamAttack`). Exige segurar o botão do slot o tempo
 * todo — soltar encerra (`creatureAttackSystem.js`). Ver docs/features/
 * 033-skills-de-combate-e-vfx.md e 061-revisao-das-skills.md.
 */
export function isChannelAttack(attack) {
  return attack?.execution === 'channel'
}

/**
 * Golpe de CARGA (`execution: 'charge'` — o padrão do grupo `'self'`, ex.:
 * Growth): o botão fica segurado até o `effectAt` (soltar antes cancela) e
 * é o único que o dano interrompe na carga (`attackInterrupt.js`).
 */
export function isChargeAttack(attack) {
  return attack?.execution === 'charge'
}

/**
 * O ataque atinge um CONE (todos os alvos dentro dele) em vez de uma
 * cápsula (o primeiro corpo no caminho)? `area: 'cone'`, que vem do grupo
 * `'cone'` (`applySkillGroup`, ex.: Growl, Razor Leaf). Decide a forma do
 * indicador e do aviso (`AttackShape.jsx`) e quem é atingido
 * (`resolveConeTargets`).
 */
export function isConeAttack(attack) {
  return attack?.area === 'cone'
}

/**
 * O ataque atinge um CÍRCULO em volta de quem usa (todos os alvos dentro
 * dele)? `area: 'circle'`, do grupo `'circle'` (ex.: o Rapid Spin). O centro
 * é o corpo de quem ataca e o raio é a borda do trigger dele + o `range`
 * (`resolveCircleRadius`) — não depende da mira.
 */
export function isCircleAttack(attack) {
  return attack?.area === 'circle'
}

/**
 * Golpe de ÁREA — cone ou círculo: acerta TODOS os alvos dentro, no golpe
 * único e no canalizado (a cápsula pega só o primeiro).
 */
export function isAreaAttack(attack) {
  return isConeAttack(attack) || isCircleAttack(attack)
}

/**
 * Canalizado em FEIXE (o canalizado da cápsula — ex.: Water Gun): a cada tick
 * só o PRIMEIRO corpo na linha (a mesma cápsula do golpe normal,
 * `resolveAttackTarget`) leva a fração do tick; e a criatura controlada
 * continua mirando com a câmera durante o canal inteiro, não só na carga. O
 * resto é o canalizado de sempre: segurar o botão, soltar corta, o canal
 * inteiro vale o dano de um golpe.
 */
export function isBeamAttack(attack) {
  return (
    isChannelAttack(attack) && !isAreaAttack(attack) && !isSelfAttack(attack)
  )
}

/**
 * O golpe age em QUEM USOU (`area: 'self'`, do grupo `'self'` — ex.: Growth,
 * que sobe o ataque da própria criatura)? Sem trajetória e sem alvo: os
 * `effects` vão no atacante, sem sorteio de precisão, e não há indicador nem
 * aviso no chão (`resolveAttackTelegraphProgress`, `AttackIndicatorView`).
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
