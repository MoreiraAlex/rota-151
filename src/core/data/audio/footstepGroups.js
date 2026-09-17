/**
 * Sons de passo agrupados por "estilo" (peso/superfície aproximados), pra
 * várias espécies compartilharem o mesmo som (e as mesmas config de
 * volume/alcance) sem repetir dado — ver docs/features/019-som-ambiente-
 * e-passos.md. Cada grupo tem `walk`/`run` como ARRAY de variações (não
 * um path só): a cada passo, `view/systems/footstepAudioSystem.js` toca
 * uma escolhida ao acaso, pra não ficar óbvio o mesmo clique repetindo.
 *
 * Arquivos em `public/assets/audio/footsteps/<grupo>/{walk,run}-0N.ogg` —
 * amostra real (não placeholder) de `.exemple/Steps/Steps/`, biblioteca de
 * SFX de passo indicada pelo usuário; escolha de qual arquivo virou qual
 * grupo é arbitrária por enquanto (`heavy` = `ConcreteFootStepWalk/Run`,
 * `light` = `MetalFootStepWalkChild/RunChild`) — troca fácil, é só apontar
 * outro arquivo aqui.
 *
 * `volume`/`refDistance` (distância de referência do falloff espacial do
 * `THREE.PositionalAudio`) moram no GRUPO — "as outras configs" que
 * viajam junto com o som escolhido: um grupo pra criaturas grandes já
 * embute volume mais alto/alcance maior, sem cada espécie repetir número.
 */
export const FOOTSTEP_GROUPS = {
  // Passo pesado, batida cheia — treinador (bipede, humanoide).
  medium: {
    volume: 0.02,
    refDistance: 6,
    walk: [
      '/assets/audio/footsteps/medium/walk-01.ogg',
      '/assets/audio/footsteps/medium/walk-02.ogg',
      '/assets/audio/footsteps/medium/walk-03.ogg',
      '/assets/audio/footsteps/medium/walk-04.ogg',
    ],
    run: [
      '/assets/audio/footsteps/medium/run-01.ogg',
      '/assets/audio/footsteps/medium/run-02.ogg',
      '/assets/audio/footsteps/medium/run-03.ogg',
      '/assets/audio/footsteps/medium/run-04.ogg',
    ],
  },
  // Passo leve, mais metálico/curto — criaturas pequenas (fox e variantes).
  light: {
    volume: 0.05,
    refDistance: 4,
    walk: [
      '/assets/audio/footsteps/light/walk-01.ogg',
      '/assets/audio/footsteps/light/walk-02.ogg',
      '/assets/audio/footsteps/light/walk-03.ogg',
      '/assets/audio/footsteps/light/walk-04.ogg',
      '/assets/audio/footsteps/light/walk-05.ogg',
    ],
    run: [
      '/assets/audio/footsteps/light/run-01.ogg',
      '/assets/audio/footsteps/light/run-02.ogg',
      '/assets/audio/footsteps/light/run-03.ogg',
      '/assets/audio/footsteps/light/run-04.ogg',
      '/assets/audio/footsteps/light/run-05.ogg',
    ],
  },
}

export function getFootstepGroup(id) {
  return FOOTSTEP_GROUPS[id] ?? null
}

/**
 * Resolve a config de som de passo de uma espécie (`core/data/species/
 * <id>/index.js`, bloco `sounds`) — individual (`sounds.footstep`, já no
 * formato `{ walk, run, volume?, refDistance? }`) vence se declarado;
 * senão cai no grupo compartilhado (`sounds.footstepGroup`, um id de
 * `FOOTSTEP_GROUPS`); sem nenhum dos dois (ou sem `sounds` na espécie),
 * `null` — a espécie simplesmente não tem som de passo ainda, mesmo
 * fallback gracioso usado em todo o resto do projeto pra conteúdo que
 * ainda não existe.
 */
export function resolveFootstepSound(species) {
  const sounds = species?.sounds
  if (!sounds) return null
  if (sounds.footstep) return sounds.footstep
  if (sounds.footstepGroup) return getFootstepGroup(sounds.footstepGroup)
  return null
}
