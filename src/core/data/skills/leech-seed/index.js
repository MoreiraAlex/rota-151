/**
 * Semente Sanguessuga (Leech Seed) — skill de status que planta uma semente
 * no alvo: a cada `interval` ela drena `fraction` do HP máximo dele e cura
 * quem plantou o mesmo valor, por `duration` (renovável) — ver `effects`. Ver
 * docs/features/033-skills-de-combate-e-vfx.md (Parte 9) e
 * `../_template/index.js` pro que cada campo significa.
 *
 * Decisões do usuário no lançamento: uma fração do HP a cada intervalo (a
 * regra do Pokémon, com tempo no lugar do turno); tempo fixo renovável; cura do mesmo valor; orbes do alvo
 * até quem plantou a cada drenagem. As espécies ainda não têm tipo, então
 * a imunidade das plantas não existe aqui.
 *
 * Alvo único (o primeiro corpo na trajetória, como um golpe de dano), com o sorteio de
 * precisão (`accuracy`) e interrompível na carga (golpe de status).
 * O efeito (`effects`, tipo `leechSeed`) é aplicado no `effectAt` por
 * `plantarSemente`; quem drena é o `leechSeedSystem`.
 *
 * Valores de PARTIDA, sem validação em jogo.
 */
export const LEECH_SEED_SKILL = {
  id: 'leech-seed',
  type: 'grass',
  duration: 1.2,
  effectAt: 0.6,
  range: 5,
  aim: 'ranged',
  castMode: 'instant',
  radius: 0.4,
  accuracy: 90,
  damage: null,
  // Não pega em tipo Planta (regra clássica do Leech Seed).
  immuneTypes: ['grass'],
  effects: [{ type: 'leechSeed', fraction: 1 / 16, interval: 2, duration: 6 }],
  visual: {
    effectGroup: 'leech-seed',
    effectVisualDuration: 1.6,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
    positionOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/leech-seed.png',
    scale: 1,
  },
  audio: { group: 'leech-seed' },
  animation: { clipKey: 'attackRanged' },
}
