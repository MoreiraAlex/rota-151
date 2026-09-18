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
 * Defaults genéricos, aplicados a QUALQUER textura carregada por aqui,
 * independente de quem chama:
 * - `colorSpace = SRGBColorSpace` — convenção de textura de cor base
 *   (diffuse), não dado bruto (normal map, mask, etc. precisariam de
 *   `NoColorSpace`, mas este cache só serve diffuse hoje).
 * - `wrapS`/`wrapT = RepeatWrapping` — sem isso, o default do three
 *   (`ClampToEdgeWrapping`) quebra qualquer recorte de atlas por
 *   `repeat`/`pan` que `useAnimatedModel.js` aplique por cima (a região
 *   fora de `[0,1]` simplesmente clampa na borda em vez de repetir).
 * - `flipY = true` — default do PROJETO (a maioria das texturas hoje é
 *   arquivo de rip independente, não extraído de dentro de um `.glb`).
 *   Quem precisar do oposto (ex.: uma textura que FOI extraída de um
 *   `.glb`, que segue a convenção de UV do glTF — origem no canto
 *   superior esquerdo, oposta à de uma imagem comum) sobrescreve por
 *   entrada em `species.model.texture[materialIndex].flipY`
 *   (`useAnimatedModel.js`), nunca aqui — este cache é compartilhado por
 *   path entre todo mundo que carregar o mesmo arquivo.
 *
 * Falha de carga nunca rejeita: resolve `null`, e quem chama trata "sem
 * textura" como no-op gracioso — mesmo padrão de `loadAudioBuffer`
 * (espécie sem `model.texture` configurado é o caso normal, não um erro).
 */
export function loadTexture(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      new Promise((resolve) => {
        loader.load(
          path,
          (texture) => {
            texture.flipY = true
            texture.colorSpace = THREE.SRGBColorSpace
            texture.wrapS = THREE.RepeatWrapping
            texture.wrapT = THREE.RepeatWrapping
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
