/**
 * Semente Sanguessuga (Leech Seed) — skill de status que planta uma semente
 * no alvo (a condição `core/data/conditions/leech-seed/`): a cada intervalo
 * ela drena uma fração do HP máximo dele e cura quem plantou o mesmo valor.
 * Ver docs/features/033-skills-de-combate-e-vfx.md (Parte 9) e
 * `../_template/index.js` pro que cada campo significa.
 *
 * Decisões do usuário no lançamento: uma fração do HP a cada intervalo (a
 * regra do Pokémon, com tempo no lugar do turno); tempo fixo renovável; cura do mesmo valor; orbes do alvo
 * até quem plantou a cada drenagem. As espécies ainda não têm tipo, então
 * a imunidade das plantas não existe aqui.
 *
 * Alvo único (o primeiro corpo na trajetória, como um golpe de dano), com o sorteio de
 * precisão (`accuracy`) e interrompível na carga (golpe de status).
 * O efeito (`effects`, tipo `condition`) é aplicado no `effectAt` por
 * `aplicarCondicao`; quem drena é o `conditionSystem`.
 *
 * Valores de PARTIDA, sem validação em jogo.
 */
export const LEECH_SEED_SKILL = {
  id: 'leech-seed',
  description:
    'Lança uma semente no primeiro inimigo à frente, até {range:m}. A semente drena {effects.0.tick.fraction:%} da vida máxima dele a cada {effects.0.tick.interval:s}, por {effects.0.duration:s}, e cura quem plantou o mesmo tanto. Não pega em Pokémon do tipo Planta.',
  type: 'grass',
  group: 'ranged',
  duration: 1.2,
  effectAt: 0.5,
  accuracy: 90,
  damage: null,
  // Não pega em tipo Planta (regra clássica do Leech Seed).
  immuneTypes: ['grass'],
  effects: [{ type: 'condition', condition: 'leech-seed' }],
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
