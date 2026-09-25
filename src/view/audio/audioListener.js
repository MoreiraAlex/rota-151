import * as THREE from 'three'

// Estado de TELA, não de jogo (mesmo raciocínio de `mesh` em
// heldItemViewSystem.js) — só existe uma câmera de verdade no jogo
// (`GameScene.jsx`, nunca troca), então um `AudioListener` por processo
// basta.
let listener = null

/**
 * Devolve o `THREE.AudioListener` do jogo, criando na primeira chamada.
 * NÃO anexa a nenhuma câmera (`camera.add(listener)`) de propósito —
 * `view/systems/audioListenerSystem.js` copia posição/orientação da
 * câmera pra dentro do listener EXPLICITAMENTE todo frame, a partir de
 * `context.camera` (sempre a câmera de verdade do pipeline). Anexar como
 * filho parecia mais simples, mas dependia de qual componente chamasse
 * `getAudioListener` primeiro já ter a câmera CERTA em mãos — `useAnimatedModel.js`
 * chama isso dentro de um efeito sem `camera` nas dependências, então se
 * essa primeira chamada corresse antes do `<PerspectiveCamera makeDefault>`
 * (drei) trocar a câmera implícita inicial do R3F pela de verdade, o
 * listener ficava preso pra sempre na câmera implícita abandonada — bug
 * real, relatado jogando (o ponto de volume alto do som posicional
 * congelado perto de onde o jogador nasce, não acompanhando a câmera).
 */
export function getAudioListener() {
  if (!listener) listener = new THREE.AudioListener()
  return listener
}
