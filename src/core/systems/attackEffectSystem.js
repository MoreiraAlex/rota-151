import { AttackEffect } from '../traits'

/**
 * Conta o `lifetime` de todo `AttackEffect` ativo (spawnado por
 * `creatureAttackSystem` no instante de efeito do ataque comum, ver
 * docs/features/025-ataque-comum-de-criatura.md) pra baixo, destruindo a
 * entidade ao chegar a zero — mesmo padrão de `consumeEffectSystem`, sem
 * posição/velocidade pra integrar (o efeito não se move).
 *
 * Headless. Fase: simulation — independente da ordem com os outros
 * systems (não lê nem escreve nada além dos próprios efeitos).
 */
export function attackEffectSystem(context) {
  const { world, delta } = context

  world.query(AttackEffect).updateEach(([effect], entity) => {
    effect.lifetime -= delta
    if (effect.lifetime <= 0) {
      entity.destroy()
    }
  })
}
