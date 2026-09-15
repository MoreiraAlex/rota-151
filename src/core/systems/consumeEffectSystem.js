import { ConsumeEffect } from '../traits'

/**
 * Conta o `lifetime` de todo `ConsumeEffect` ativo (spawnado por
 * `playerActionSystem` ao usar um consumível) pra baixo, destruindo a
 * entidade ao chegar a zero — mesmo padrão de `projectileSystem`, só que
 * sem posição/velocidade pra integrar (o efeito não se move).
 *
 * Headless. Fase: simulation — independente da ordem com os outros
 * systems (não lê nem escreve nada além dos próprios efeitos).
 */
export function consumeEffectSystem(context) {
  const { world, delta } = context

  world.query(ConsumeEffect).updateEach(([effect], entity) => {
    effect.lifetime -= delta
    if (effect.lifetime <= 0) {
      entity.destroy()
    }
  })
}
