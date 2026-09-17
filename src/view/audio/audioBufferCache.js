import * as THREE from 'three'

const loader = new THREE.AudioLoader()

// path → Promise<AudioBuffer|null>, pra N entidades da MESMA espécie (ou N
// variações do mesmo grupo, ver footstepGroups.js) não carregarem/
// decodificarem o mesmo arquivo várias vezes — mesmo espírito do cache
// interno de `useGLTF` pra modelos.
const cache = new Map()

/**
 * Carrega (com cache por path) um `AudioBuffer` decodificado, pronto pra
 * `THREE.Audio`/`THREE.PositionalAudio.setBuffer()`. Falha de carga —
 * hoje o caso NORMAL pro som ambiente, que ainda não tem arquivo real
 * (ver docs/features/019-som-ambiente-e-passos.md) — nunca rejeita:
 * resolve `null`, e quem chama trata "sem buffer" como no-op gracioso,
 * mesmo padrão já usado no projeto pra conteúdo que ainda não existe
 * (`HAND_BONE_BY_SPECIES`, `vitals` opcional na espécie).
 */
export function loadAudioBuffer(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      new Promise((resolve) => {
        loader.load(
          path,
          (buffer) => resolve(buffer),
          undefined,
          () => resolve(null),
        )
      }),
    )
  }
  return cache.get(path)
}
