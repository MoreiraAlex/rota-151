import { getAudioListener } from '@/view/audio/audioListener'

/**
 * Copia posição/orientação da câmera de verdade (`context.camera`, sempre
 * a atual do pipeline — ver `GameLoop.jsx`) pro `THREE.AudioListener`
 * (`view/audio/audioListener.js`) A CADA FRAME — é isso que faz o "ponto
 * de escuta" de qualquer som posicional (`THREE.PositionalAudio`, ver
 * `footstepAudioSystem.js`) acompanhar a câmera de verdade, sem depender
 * de parentesco no grafo de cena Three.js nem de qual componente resolveu
 * a câmera primeiro (ver docstring de `getAudioListener` pro bug real que
 * isso corrige — listener preso perto de onde o jogador nasce).
 *
 * `updateMatrixWorld(true)` força a propagação — é o que dispara o
 * `AudioListener.updateMatrixWorld` (override que empurra a posição pro
 * Web Audio de verdade); sem isso, copiar só `position`/`quaternion` não
 * teria efeito nenhum no som.
 *
 * Vive na view (mexe em nó Three de áudio). Fase: presentation, antes de
 * `footstepAudioSystem` (que dispara sons posicionais — precisam do
 * listener já no lugar certo neste frame).
 */
export function audioListenerSystem(context) {
  const { camera } = context
  if (!camera) return

  const listener = getAudioListener()
  listener.position.copy(camera.position)
  listener.quaternion.copy(camera.quaternion)
  listener.updateMatrixWorld(true)
}
