import { trait } from 'koota'

/**
 * Estado de animação resolvido a partir do movimento — o id de uma ação
 * (ver core/data/animationStates.js), usado pra buscar o clipe certo no
 * registro de espécie da entidade (core/data/species).
 *
 * Dono de escrita: animationStateSystem.
 * Lê: animationSystem (view), que aplica o clipe correspondente aos ossos.
 */
export const AnimationState = trait({
  id: 'idle',
})
