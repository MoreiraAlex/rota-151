/**
 * Garantia (Assurance) — golpe físico corpo a corpo, ver
 * `../_template/index.js` pro que cada campo significa
 * (docs/features/061-revisao-das-skills.md). Tipo Normal, como o `../bite`:
 * a tabela de tipos do jogo é a da Gen 1, sem Sombrio
 * (`core/data/types/index.js`).
 *
 * Na série o poder dobra se o alvo já apanhou no mesmo turno; aqui, se ele
 * levou dano de qualquer fonte há pouco (`damage.recentDamageBoost`,
 * `core/battle/recentDamageBoost.js` — decisão do usuário). No golpe único
 * e no canalizado (medido antes do primeiro tick em cada alvo). A IA conta o
 * bônus contra quem apanhou há pouco (`resolveAiPower`); o custo usa o
 * `power`, porque o preço é do golpe, não de um alvo.
 *
 * O Cobblemon não tem o golpe: VFX e som são os do acerto do Pursuit
 * (`view/vfx/assuranceVfx.js`) — a marca escura, o golpe e os pontos no
 * alvo, maiores no acerto com o poder maior (`visual.boostedScale`).
 */
export const ASSURANCE_SKILL = {
  id: 'assurance',
  description:
    'Golpeia o primeiro inimigo à frente, até {range:m}, causando dano físico de poder {power}. Se o alvo levou dano nos últimos {damage.recentDamageBoost.window:s}, o poder é multiplicado por {damage.recentDamageBoost.multiplier}.',
  type: 'normal',
  group: 'melee',
  duration: 1.75,
  effectAt: 0.75,
  visual: {
    effectGroup: 'assurance',
    // a marca, o golpe e os pontos (`view/vfx/assuranceVfx.js`)
    effectVisualDuration: 0.65,
    scale: 0.5,
    boostedScale: 1.5,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  audio: { group: 'assurance-target' },
  animation: { clipKey: 'attackRanged' },
  // Físico, poder de referência: o de "Assurance" nos jogos originais; o
  // bônus como na série (o dobro), com uma janela de partida.
  damage: {
    power: 60,
    category: 'physical',
    recentDamageBoost: { window: 3, multiplier: 2 },
  },
}
