import { trait } from 'koota'

/**
 * Respingo na água (docs/features/057-lagos-e-rios.md): efeito passageiro
 * no ponto da superfície — `Position` diz onde. `size` é o tamanho
 * relativo (1 = um objeto arremessado afundando); `elapsed` conta em
 * segundos até `duration`, e a entidade some.
 *
 * Dono de escrita: quem acaba na água funda spawna (`summonBallSystem`,
 * `captureBallSystem`, `droppedFoodSystem`, `projectileSystem`);
 * `waterSplashSystem` conta e destrói. A view desenha e toca o som.
 */
export const WaterSplash = trait({
  size: 1,
  elapsed: 0,
  duration: 0,
})
