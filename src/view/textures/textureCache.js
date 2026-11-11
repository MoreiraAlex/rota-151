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
 * A imagem já vem decodificada (`image.decode()`), para o envio à placa
 * de vídeo não decodificar dentro do quadro.
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
            // Decodifica a imagem fora do quadro antes de entregar: sem
            // isso, o navegador decodifica no envio para a placa de vídeo,
            // dentro do quadro em que ela aparece (docs/features/066-
            // revisao-dos-biomas.md, desempenho). Sem `decode` (ou com
            // erro), entrega como está.
            const decoded = texture.image?.decode?.()
            Promise.resolve(decoded)
              .catch(() => {})
              .then(() => resolve(texture))
          },
          undefined,
          () => resolve(null),
        )
      }),
    )
  }
  return cache.get(path)
}

/**
 * Cópia de `texture` com recorte próprio (`offset`, `repeat`, `center`,
 * `rotation` — os quadros de um flipbook, o olho que pisca) que reaproveita
 * a imagem já enviada à placa de vídeo. O `clone()` do three marca a imagem
 * compartilhada para subir de novo (`needsUpdate` mexe na versão dela): cada
 * cópia reenviava a imagem inteira, uma travada a cada criatura ou
 * partícula nova (docs/features/066-revisao-dos-biomas.md, desempenho).
 * Só a versão da imagem volta ao que era; a cópia em si fica marcada, para
 * ser montada no primeiro desenho.
 */
export function cloneTexture(texture) {
  const imageVersion = texture.source.version
  const copy = texture.clone()
  copy.source.version = imageVersion
  return copy
}
