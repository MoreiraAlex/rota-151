import { trait } from 'koota'

/**
 * Estado de animação resolvido a partir do movimento — o id de uma ação
 * (ver core/data/animationStates.js), usado pra buscar o clipe certo no
 * registro de espécie da entidade (core/data/species).
 *
 * `direction` (1 ou -1) diz se o clipe deve tocar pra frente ou de trás pra
 * frente — usado sempre que a `Velocity` da entidade se descola de pra
 * onde o corpo encara (`Rotation.y`), como o dot product entre as duas
 * indica (`animationStateSystem.js`). Sem clipe dedicado de "andar de
 * costas", tocar o mesmo clipe de "walk"/"run" de trás pra frente é a
 * aproximação usada — evita o efeito "moonwalk" (andar pra trás com a
 * perna animando como se fosse pra frente).
 *
 * Dono de escrita: animationStateSystem.
 * Lê: animationSystem (view), que aplica o clipe correspondente aos ossos.
 */
export const AnimationState = trait({
  id: 'idle',
  direction: 1,
})
