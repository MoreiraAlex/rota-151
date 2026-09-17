/**
 * Estado do som ambiente esporádico — só existe UM no jogo inteiro (não é
 * por entidade, diferente de passo/voz — não há "quem" no mundo pra esse
 * som, é o ambiente do nível), por isso é um objeto de módulo só, não um
 * registry (`Map`) como `footstepAudioRegistry.js`/`voiceAudioRegistry.js`.
 *
 * `view/audio/AmbientAudio.jsx` monta o `THREE.Audio`, carrega os buffers
 * e preenche este estado (no `useEffect`, desfaz no cleanup);
 * `view/systems/ambientAudioSystem.js` só lê/decrementa o `timer` e toca.
 * `buffers` começa vazio e é preenchido IN PLACE conforme cada variação
 * termina de carregar — mesmo motivo de sempre: o system lê o array mais
 * recente sem precisar reconsultar nada.
 */
const state = {
  audio: null,
  buffers: [],
  minInterval: 0,
  maxInterval: 0,
  timer: 0,
}

export function getAmbientAudioState() {
  return state
}

export function resetAmbientAudioState() {
  state.audio = null
  state.buffers = []
  state.minInterval = 0
  state.maxInterval = 0
  state.timer = 0
}
