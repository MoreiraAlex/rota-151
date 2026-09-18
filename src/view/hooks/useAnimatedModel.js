import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { SummonedCreature } from '@/core/traits'
import { resolveBones } from '@/core/animation/resolveBones'
import { resolveFootstepSound } from '@/core/data/audio/footstepGroups'
import {
  resolveVoiceSound,
  DEFAULT_VOICE_MIN_INTERVAL,
  DEFAULT_VOICE_MAX_INTERVAL,
} from '@/core/data/audio/voiceSound'
import { resolveDashSound } from '@/core/data/audio/dashSound'
import { resolveJumpSound } from '@/core/data/audio/jumpSound'
import { getAudioListener } from '../audio/audioListener'
import { loadAudioBuffer } from '../audio/audioBufferCache'
import { loadTexture } from '../textures/textureCache'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
} from '../registry/animationRegistry'
import {
  registerFootstepAudio,
  unregisterFootstepAudio,
  getFootstepAudioEntry,
} from '../registry/footstepAudioRegistry'
import {
  registerVoiceAudio,
  unregisterVoiceAudio,
  getVoiceAudioEntry,
} from '../registry/voiceAudioRegistry'
import {
  registerDashAudio,
  unregisterDashAudio,
  getDashAudioEntry,
} from '../registry/dashAudioRegistry'
import {
  registerJumpAudio,
  unregisterJumpAudio,
  getJumpAudioEntry,
} from '../registry/jumpAudioRegistry'

const DEFAULT_FOOTSTEP_VOLUME = 0.6
const DEFAULT_FOOTSTEP_REF_DISTANCE = 5
const DEFAULT_VOICE_VOLUME = 0.8
const DEFAULT_VOICE_REF_DISTANCE = 8
const DEFAULT_ACTION_SOUND_VOLUME = 0.6
const DEFAULT_ACTION_SOUND_REF_DISTANCE = 6

/**
 * Cria/carrega/registra um `THREE.PositionalAudio` de "um array de
 * variações só" (`{ clips, volume?, refDistance? }`) — formato
 * compartilhado por voz, dash e pulo (ver `useAnimatedModel` abaixo);
 * som de passo fica de fora (tem DOIS arrays, `walk`/`run`, não cabe
 * aqui). Devolve a função de cleanup (pra usar como retorno do
 * `useEffect` chamador).
 *
 * `registry`: `{ register, unregister, get }` — as funções nomeadas de
 * um `view/registry/<algo>AudioRegistry.js` (`registerDashAudio` etc.),
 * não a fábrica crua. `extra` (opcional) é repassado pro `register` —
 * cada som pode precisar de estado próprio além de `audio`/`buffers`
 * (ex.: `previousAction` do dash, `minInterval`/`immediate` da voz).
 */
function setupPositionalActionSound(
  entity,
  groupRef,
  config,
  defaults,
  { register, unregister, get },
  extra,
) {
  const listener = getAudioListener()
  const audio = new THREE.PositionalAudio(listener)
  audio.setVolume(config.volume ?? defaults.volume)
  audio.setRefDistance(config.refDistance ?? defaults.refDistance)
  groupRef.current.add(audio)
  register(entity, audio, extra)

  // Carrega cada variação em paralelo e preenche o registry IN PLACE
  // conforme cada uma termina — o system consumidor só passa a tocar
  // quando o array tiver pelo menos 1 buffer pronto. `cancelled` evita
  // empurrar buffer pra dentro de um registry já desregistrado (entidade
  // desmontou — ex.: criatura recolhida — antes do carregamento terminar).
  let cancelled = false
  for (const path of config.clips ?? []) {
    loadAudioBuffer(path).then((buffer) => {
      if (cancelled || !buffer) return
      get(entity)?.buffers.push(buffer)
    })
  }

  return () => {
    cancelled = true
    unregister(entity)
  }
}

/**
 * Carrega o modelo de uma espécie, clona o esqueleto (uma cópia por
 * entidade — instâncias não compartilham pose) e registra a entidade no
 * `viewRegistry` (`syncTransformSystem`) e, se houver esqueleto, no
 * `animationRegistry` (`animationSystem`). Extraído de `PlayerView.jsx`
 * (v0.0.14) pra ser reaproveitado por qualquer entidade renderizada
 * dinamicamente (`CreatureView`, ver docs/features/014-arremessar-usar-e-
 * invocar.md) — mesma lógica, um lugar só.
 *
 * **Materiais não são clonados aqui** (`SkeletonUtils.clone` os reusa por
 * referência, só geometria/esqueleto são únicos por clone) — quem precisar
 * tingir uma instância sem afetar as outras que carregam o mesmo `.glb`
 * precisa clonar o material antes de mudar a cor (ver `CreatureView.jsx`).
 * Textura por espécie (`species.model.texture`, opcional — string pra
 * modelo de material único como FOX/WOLF, ou `{ [materialIndex]: path }`
 * pra modelo com vários materiais como Bulbasaur — ver docs/features/020-
 * fox-selvagens-cena-e-texturas.md) segue o mesmo cuidado, aplicada aqui
 * mesmo (não só em `CreatureView`) porque é config de `species.model`, no
 * mesmo nível de `path`/`scale` — qualquer entidade que use este hook
 * (treinador incluso) ganha de graça se um dia configurar textura própria.
 *
 * Retorna `{ groupRef, cloned }`: `groupRef` vai no `<group ref>` que o
 * `syncTransformSystem` move; `cloned` é a cena pra renderizar via
 * `<primitive object={cloned} .../>`.
 *
 * Também registra o som de passo, vocalização periódica, dash e pulo da
 * espécie (ver docs/features/019-som-ambiente-e-passos.md), cada um se
 * houver — mesmo ciclo de vida do resto (nasce/morre junto com o modelo,
 * sem vazar nó de áudio quando uma criatura é recolhida). Cada um é um
 * `THREE.PositionalAudio` próprio, anexado ao MESMO grupo que
 * `syncTransformSystem` move, então acompanham a entidade em 3D de
 * graça, sem system de posição próprio. Os `view/systems/*AudioSystem.js`
 * correspondentes decidem QUANDO tocar cada um (ciclo de andar/correr,
 * temporizador aleatório, ou o instante do próprio evento — dash/pulo);
 * este hook só prepara os nós e carrega os buffers. Espécie sem `sounds`
 * resolvido pra um som não cria nada PRA ELE (os outros continuam
 * normais). Uma `SummonedCreature` já vocaliza (som de "voz") assim que
 * invocada, não espera o primeiro intervalo aleatório — recolher não tem
 * som especial nenhum, só some (ver `immediate` em `registerVoiceAudio`).
 */
export function useAnimatedModel(entity, species) {
  const groupRef = useRef()
  const { scene } = useGLTF(species.model.path)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])

  useEffect(() => {
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [cloned])

  useEffect(() => {
    const texture = species.model.texture
    if (!texture) return

    // Duas formas de `species.model.texture`:
    // - string: UMA textura pra TODO mesh do modelo (caso FOX/WOLF — `.glb`
    //   com um material só, a textura cobre o modelo inteiro).
    // - `{ [materialIndex]: { path, ... } }`: um objeto por material, pra
    //   modelo com vários materiais (caso Bulbasaur — corpo/folha/olhos são
    //   materiais diferentes, cada um com seu diffuse; ver
    //   `species/001-bulbasaur/index.js`). `materialIndex` é a ORDEM DE ENCONTRO
    //   dos meshes em `cloned.traverse`
    //   (0, 1, 2, ...) — não vem de metadado nenhum do `.glb` (nome de
    //   material se repete entre slots diferentes nesse arquivo), então é
    //   sensível à estrutura do modelo: se o modelo for reexportado com
    //   meshes em outra ordem, os índices no `index.js` da espécie precisam
    //   ser conferidos de novo visualmente.
    const isPerMaterial = typeof texture === 'object'
    const entries = isPerMaterial
      ? Object.entries(texture)
      : [['0', { path: texture }]]

    let cancelled = false
    const materialIndexByMesh = new Map()
    let nextMaterialIndex = 0
    cloned.traverse((child) => {
      if (child.isMesh) materialIndexByMesh.set(child, nextMaterialIndex++)
    })

    Promise.all(
      entries.map(([materialIndex, obj]) =>
        loadTexture(obj.path).then((loaded) => {
          // `loadTexture` já resolve `null` (em vez de rejeitar) numa carga
          // que falhou — precisa sair ANTES de mexer em propriedade de
          // textura, senão o `.then()` lança em cima de `null` e derruba o
          // `Promise.all` inteiro (nenhum material de NENHUM índice seria
          // aplicado, não só o que falhou).
          if (!loaded) return [Number(materialIndex), null]

          // `colorSpace`/`wrapS`/`wrapT`/`flipY` (default `true`) já vêm
          // setados por `loadTexture` (`textureCache.js`) — genéricos pra
          // QUALQUER textura carregada por ali. Só sobrescreve `flipY`
          // aqui quando a espécie parametrizar explicitamente (ex.: uma
          // textura que FOI extraída de dentro de um `.glb`, que segue a
          // convenção de UV oposta — ver `species/fox/index.js`).
          if (obj.flipY !== undefined) {
            loaded.flipY = obj.flipY
          }

          if (obj.center) {
            loaded.center.set(obj.center.x, obj.center.y)
          }

          if (obj.rotation !== undefined) {
            loaded.rotation = THREE.MathUtils.degToRad(obj.rotation)
          }

          if (obj.repeat) {
            loaded.repeat.set(
              obj.repeat.x ?? loaded.repeat.x,
              obj.repeat.y ?? loaded.repeat.y,
            )
          }

          if (obj.pan) {
            const panX = obj.pan.x ?? 0
            const panY = obj.pan.y ?? 0

            loaded.offset.set(
              (1 - loaded.repeat.x) / 2 + panX,
              (1 - loaded.repeat.y) / 2 + panY,
            )
          }

          // Sempre por ÚLTIMO — flag de reupload pro GPU, precisa vir
          // DEPOIS de qualquer mutação acima (flipY/center/rotation/repeat/
          // pan), senão uma alteração feita depois deste ponto correria o
          // risco de não pegar o próximo frame já com o valor certo.
          loaded.needsUpdate = true

          return [Number(materialIndex), loaded]
        }),
      ),
    ).then((loadedByIndex) => {
      if (cancelled) return
      const textureByIndex = new Map(
        loadedByIndex.filter(([, loaded]) => loaded),
      )
      if (textureByIndex.size === 0) return

      // Clona o material antes de mudar `.map` — `SkeletonUtils.clone` (acima)
      // reusa material por referência entre instâncias do mesmo `.glb`; sem
      // clonar, a textura vazaria pra qualquer outra entidade carregando o
      // mesmo asset (mesmo motivo do tint em `CreatureView.jsx`).
      for (const [child, materialIndex] of materialIndexByMesh) {
        // Forma string (`isPerMaterial` falso): aplica a MESMA textura em
        // todo mesh, ignorando o índice — mantém o comportamento de sempre.
        const loaded = isPerMaterial
          ? textureByIndex.get(materialIndex)
          : textureByIndex.get(0)
        if (!loaded) continue
        child.material = child.material.clone()
        child.material.map = loaded
        child.material.needsUpdate = true
      }
    })

    return () => {
      cancelled = true
    }
  }, [cloned, species])

  useEffect(() => {
    registerView(entity, groupRef.current)

    let skeleton = null
    cloned.traverse((child) => {
      if (child.isSkinnedMesh) skeleton = child.skeleton
    })
    if (skeleton) {
      registerAnimatedBones(entity, {
        bones: resolveBones(skeleton),
        clips: species.clips,
      })
    }

    return () => {
      unregisterView(entity)
      unregisterAnimatedBones(entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, entity])

  useEffect(() => {
    const footstep = resolveFootstepSound(species)
    if (!footstep) return

    const listener = getAudioListener()
    const audio = new THREE.PositionalAudio(listener)
    audio.setVolume(footstep.volume ?? DEFAULT_FOOTSTEP_VOLUME)
    audio.setRefDistance(footstep.refDistance ?? DEFAULT_FOOTSTEP_REF_DISTANCE)
    groupRef.current.add(audio)
    registerFootstepAudio(entity, audio)

    // Carrega cada variação (`walk`/`run`, array) em paralelo e preenche o
    // registry IN PLACE conforme cada uma termina — `footstepAudioSystem.js`
    // só passa a tocar quando o array correspondente tiver pelo menos um
    // buffer pronto (ver docstring de `footstepAudioRegistry.js`). `cancelled` evita
    // empurrar buffer pra dentro de um registry já desregistrado (entidade
    // desmontou — ex.: criatura recolhida — antes do carregamento terminar).
    let cancelled = false
    for (const gait of ['walk', 'run']) {
      for (const path of footstep[gait] ?? []) {
        loadAudioBuffer(path).then((buffer) => {
          if (cancelled || !buffer) return
          const entry = getFootstepAudioEntry(entity)
          entry?.buffers[gait].push(buffer)
        })
      }
    }

    return () => {
      cancelled = true
      unregisterFootstepAudio(entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  useEffect(() => {
    const voice = resolveVoiceSound(species)
    if (!voice) return

    return setupPositionalActionSound(
      entity,
      groupRef,
      voice,
      { volume: DEFAULT_VOICE_VOLUME, refDistance: DEFAULT_VOICE_REF_DISTANCE },
      {
        register: registerVoiceAudio,
        unregister: unregisterVoiceAudio,
        get: getVoiceAudioEntry,
      },
      {
        minInterval: voice.minInterval ?? DEFAULT_VOICE_MIN_INTERVAL,
        maxInterval: voice.maxInterval ?? DEFAULT_VOICE_MAX_INTERVAL,
        // Criatura invocada já vocaliza na hora (pedido explícito do
        // usuário) — o treinador (nunca "invocado", só existe desde o
        // início do jogo) continua com o primeiro intervalo sorteado
        // normalmente, ver docstring de `registerVoiceAudio`.
        immediate: entity.has(SummonedCreature),
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  useEffect(() => {
    const dash = resolveDashSound(species)
    if (!dash) return

    return setupPositionalActionSound(
      entity,
      groupRef,
      dash,
      {
        volume: DEFAULT_ACTION_SOUND_VOLUME,
        refDistance: DEFAULT_ACTION_SOUND_REF_DISTANCE,
      },
      {
        register: registerDashAudio,
        unregister: unregisterDashAudio,
        get: getDashAudioEntry,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  useEffect(() => {
    const jump = resolveJumpSound(species)
    if (!jump) return

    return setupPositionalActionSound(
      entity,
      groupRef,
      jump,
      {
        volume: DEFAULT_ACTION_SOUND_VOLUME,
        refDistance: DEFAULT_ACTION_SOUND_REF_DISTANCE,
      },
      {
        register: registerJumpAudio,
        unregister: unregisterJumpAudio,
        get: getJumpAudioEntry,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  return { groupRef, cloned }
}
