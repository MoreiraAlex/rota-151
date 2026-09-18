import * as THREE from 'three'

const loader = new THREE.TextureLoader()

// path → Promise<Texture|null>, pra N entidades da MESMA espécie não
// carregarem/decodificarem o mesmo arquivo várias vezes — mesmo espírito de
// `view/audio/audioBufferCache.js` (áudio) e do cache interno de `useGLTF`
// (modelo).
const cache = new Map()

/**
 * Carrega (com cache por path) uma `THREE.Texture`, pronta pra virar
 * `material.map`. Falha de carga nunca rejeita: resolve `null`, e quem
 * chama trata "sem textura" como no-op gracioso — mesmo padrão de
 * `loadAudioBuffer` (espécie sem `model.texture` configurado é o caso
 * normal, não um erro).
 *
 * `flipY = false` e `colorSpace = SRGBColorSpace` são setados na mão: a
 * textura foi extraída de dentro de um `.glb` (ver docs/features/020-fox-
 * selvagens-cena-e-texturas.md), onde o `GLTFLoader` já aplicava os dois
 * ajustes por baixo dos panos pra bater com a convenção de UV do glTF
 * (origem no canto superior esquerdo) e a codificação sRGB de uma textura
 * de cor base. Carregando o mesmo arquivo "cru" por fora do glTF (`THREE.
 * TextureLoader` puro, sem passar pelo parser), os defaults dele não batem
 * com isso — sem replicar os dois ajustes, a textura aparece de cabeça pra
 * baixo e/ou lavada em cima da MESMA geometria/UV que antes vinha correta
 * pelo pipeline do glTF.
 */
export function loadTexture(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      new Promise((resolve) => {
        loader.load(
          path,
          (texture) => {
            texture.flipY = false
            texture.colorSpace = THREE.SRGBColorSpace
            resolve(texture)
          },
          undefined,
          () => resolve(null),
        )
      }),
    )
  }
  return cache.get(path)
}
