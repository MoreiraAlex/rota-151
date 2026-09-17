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
import { getAudioListener } from '../audio/audioListener'
import { loadAudioBuffer } from '../audio/audioBufferCache'
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

const DEFAULT_FOOTSTEP_VOLUME = 0.6
const DEFAULT_FOOTSTEP_REF_DISTANCE = 5
const DEFAULT_VOICE_VOLUME = 0.8
const DEFAULT_VOICE_REF_DISTANCE = 8

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
 *
 * Retorna `{ groupRef, cloned }`: `groupRef` vai no `<group ref>` que o
 * `syncTransformSystem` move; `cloned` é a cena pra renderizar via
 * `<primitive object={cloned} .../>`.
 *
 * Também registra o som de passo (`resolveFootstepSound`) e a
 * vocalização periódica (`resolveVoiceSound`) da espécie, ver
 * docs/features/019-som-ambiente-e-passos.md, se houver — mesmo ciclo de
 * vida do resto (nasce/morre junto com o modelo, sem vazar nó de áudio
 * quando uma criatura é recolhida). Cada um é um `THREE.PositionalAudio`
 * próprio, anexado ao MESMO grupo que `syncTransformSystem` move, então
 * acompanha a entidade em 3D de graça, sem system de posição próprio.
 * `view/systems/footstepAudioSystem.js`/`voiceAudioSystem.js` decidem
 * QUANDO tocar cada um (sincronizado com o ciclo de andar/correr, ou por
 * temporizador aleatório, respectivamente); este hook só prepara os nós e
 * carrega os buffers. Espécie sem `sounds` resolvido não cria nada. Uma
 * `SummonedCreature` já vocaliza (som de "voz") assim que invocada, não
 * espera o primeiro intervalo aleatório — recolher não tem som especial
 * nenhum, só some (ver `immediate` em `registerVoiceAudio`).
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

    const listener = getAudioListener()
    const audio = new THREE.PositionalAudio(listener)
    audio.setVolume(voice.volume ?? DEFAULT_VOICE_VOLUME)
    audio.setRefDistance(voice.refDistance ?? DEFAULT_VOICE_REF_DISTANCE)
    groupRef.current.add(audio)
    registerVoiceAudio(entity, audio, {
      minInterval: voice.minInterval ?? DEFAULT_VOICE_MIN_INTERVAL,
      maxInterval: voice.maxInterval ?? DEFAULT_VOICE_MAX_INTERVAL,
      // Criatura invocada já vocaliza na hora (pedido explícito do
      // usuário) — o treinador (nunca "invocado", só existe desde o
      // início do jogo) continua com o primeiro intervalo sorteado
      // normalmente, ver docstring de `registerVoiceAudio`.
      immediate: entity.has(SummonedCreature),
    })

    // Mesmo esquema do som de passo acima — carrega cada variação em
    // paralelo e preenche o registry IN PLACE conforme cada uma termina.
    let cancelled = false
    for (const path of voice.clips ?? []) {
      loadAudioBuffer(path).then((buffer) => {
        if (cancelled || !buffer) return
        const entry = getVoiceAudioEntry(entity)
        entry?.buffers.push(buffer)
      })
    }

    return () => {
      cancelled = true
      unregisterVoiceAudio(entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  return { groupRef, cloned }
}
