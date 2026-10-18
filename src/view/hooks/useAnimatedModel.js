import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { SummonedCreature, Mood } from '@/core/traits'
import { resolveEyeState } from '@/view/shared/eyeState'
import { resolveBones } from '@/core/animation/resolveBones'
import {
  resolveFlightSound,
  resolveFootstepSound,
} from '@/core/data/audio/footstepGroups'
import { WATER_SOUNDS } from '@/core/data/audio/waterSounds'
import {
  resolveVoiceSound,
  DEFAULT_VOICE_MIN_INTERVAL,
  DEFAULT_VOICE_MAX_INTERVAL,
} from '@/core/data/audio/voiceSound'
import { resolveDashSound } from '@/core/data/audio/dashSound'
import { resolveJumpSound } from '@/core/data/audio/jumpSound'
import { resolveSummonSound } from '@/core/data/audio/summonSound'
import { resolveRecallSound } from '@/core/data/audio/recallSound'
import {
  resolveAttackLoopSounds,
  resolveAttackSounds,
} from '@/core/data/audio/attackSound'
import { resolveFireLight } from '@/view/systems/fireLightSystem'
import {
  createNativeAnimationPlayer,
  disposeNativeAnimationPlayer,
} from '@/view/animation/nativeAnimationPlayer'
import { getAudioListener } from '../audio/audioListener'
import { loadAudioBuffer } from '../audio/audioBufferCache'
import { loadTexture } from '../textures/textureCache'
import {
  placeAtEntity,
  registerView,
  unregisterView,
} from '../registry/viewRegistry'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
  getAnimatedBonesEntry,
} from '../registry/animationRegistry'
import {
  registerFireLight,
  unregisterFireLight,
} from '../registry/fireLightRegistry'
import {
  registerEyeBlink,
  unregisterEyeBlink,
} from '../registry/eyeBlinkRegistry'
import {
  registerMouthSync,
  unregisterMouthSync,
} from '../registry/mouthSyncRegistry'
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
import {
  registerSummonAudio,
  unregisterSummonAudio,
  getSummonAudioEntry,
} from '../registry/summonAudioRegistry'
import {
  registerRecallAudio,
  unregisterRecallAudio,
  getRecallAudioEntry,
} from '../registry/recallAudioRegistry'
import {
  registerAttackAudio,
  unregisterAttackAudio,
} from '../registry/attackAudioRegistry'

import { GAME_CONFIG } from '@/core/gameConfig'
import { applyToonLook, isOutline } from '../materials/toonMaterial'

const DEFAULT_FOOTSTEP_VOLUME = 0.6
const DEFAULT_FOOTSTEP_REF_DISTANCE = 5
const DEFAULT_VOICE_VOLUME = 0.8
const DEFAULT_VOICE_REF_DISTANCE = 8
const DEFAULT_ACTION_SOUND_VOLUME = 0.6
const DEFAULT_ACTION_SOUND_REF_DISTANCE = 6
const DEFAULT_BLINK_MIN_INTERVAL = 2
const DEFAULT_BLINK_MAX_INTERVAL = 6
const DEFAULT_BLINK_CLOSED_DURATION = 0.12

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
 * Cria/carrega/registra os sons de ataque da criatura: um
 * `THREE.PositionalAudio` PRÓPRIO por parte de som de cada slot
 * (`sounds`: `{ [slot]: [{ clips, volume?, refDistance?, delay }] }`, ver
 * `resolveAttackSounds`) — duas partes (ex.: som do atacante e do alvo)
 * podem se sobrepor no tempo, e um nó só toca um buffer por vez. Mais um nó
 * por slot com som em LOOP — carga ou ação inteira (`loopSounds`, `resolveAttackLoopSounds`).
 * Devolve a função de cleanup. Quem decide QUANDO tocar é
 * `attackAudioSystem.js`.
 */
function setupAttackAudio(entity, groupRef, sounds, loopSounds) {
  const listener = getAudioListener()
  const createVoice = (part) => {
    const audio = new THREE.PositionalAudio(listener)
    audio.setVolume(part.volume ?? DEFAULT_ACTION_SOUND_VOLUME)
    audio.setRefDistance(part.refDistance ?? DEFAULT_ACTION_SOUND_REF_DISTANCE)
    groupRef.current.add(audio)
    return { audio, delay: part.delay ?? 0, buffers: [] }
  }
  const voices = {}
  for (const [slot, parts] of Object.entries(sounds)) {
    voices[slot] = parts.map(createVoice)
  }
  const loops = {}
  for (const [slot, part] of Object.entries(loopSounds)) {
    loops[slot] = { ...createVoice(part), phase: part.phase }
  }
  registerAttackAudio(entity, voices, loops)

  // Mesmo esquema de `setupPositionalActionSound`: carrega cada variação em
  // paralelo e preenche `buffers` IN PLACE; `cancelled` evita empurrar
  // buffer pra uma entidade já desregistrada.
  let cancelled = false
  for (const [slot, parts] of Object.entries(sounds)) {
    parts.forEach((part, index) => {
      const voice = voices[slot][index]
      for (const path of part.clips ?? []) {
        loadAudioBuffer(path).then((buffer) => {
          if (cancelled || !buffer) return
          voice.buffers.push(buffer)
        })
      }
    })
  }
  for (const [slot, part] of Object.entries(loopSounds)) {
    for (const path of part.clips ?? []) {
      loadAudioBuffer(path).then((buffer) => {
        if (cancelled || !buffer) return
        loops[slot].buffers.push(buffer)
      })
    }
  }

  return () => {
    cancelled = true
    unregisterAttackAudio(entity)
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
 * modelo de material único, ou `{ [materialIndex]: path }`
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
 * Também registra o som de passo, vocalização periódica, dash, pulo,
 * invocar e recolher da espécie (ver docs/features/019-som-ambiente-e-
 * passos.md, docs/features/023-estado-de-humor-e-piscar-de-olhos.md,
 * seção "Som de invocar/recolher"), cada um se houver — mesmo ciclo de
 * vida do resto (nasce/morre junto com o modelo,
 * sem vazar nó de áudio quando uma criatura é recolhida). Cada um é um
 * `THREE.PositionalAudio` próprio, anexado ao MESMO grupo que
 * `syncTransformSystem` move, então acompanham a entidade em 3D de
 * graça, sem system de posição próprio. Os `view/systems/*AudioSystem.js`
 * correspondentes decidem QUANDO tocar cada um (ciclo de andar/correr,
 * temporizador aleatório, ou o instante do próprio evento — dash/pulo/
 * invocar/recolher); este hook só prepara os nós e carrega os buffers.
 * `invocar`/`recolher` só têm efeito de verdade no TREINADOR (única
 * espécie com `Party`) — numa criatura, `resolveSummonSound`/
 * `resolveRecallSound` sempre voltam `null` (ela nunca tem `sounds.summon`/
 * `recall` configurado), mesmo fallback gracioso de sempre, sem
 * precisar de checagem especial aqui. Espécie sem `sounds` resolvido pra
 * um som não cria nada PRA ELE (os outros continuam normais). Uma
 * `SummonedCreature` já vocaliza (som de "voz") assim que
 * invocada, não espera o primeiro intervalo aleatório — recolher não tem
 * som especial nenhum, só some (ver `immediate` em `registerVoiceAudio`).
 *
 * Luz de fogo (`species.vfx.fireLight`, opcional — ver docs/features/060-
 * ajustes-por-especie.md) segue o mesmo espírito, mas encaixada num OSSO
 * nomeado (`fireLight.bone`), não no grupo raiz — precisa seguir a pose
 * animada da cauda. O tremor e o desmaio avançam em `view/systems/
 * fireLightSystem.js`, mesma separação "hook prepara, system avança" do
 * áudio.
 *
 * Boca sincronizada com o grito (`species.clips.cry`, opcional — ver docs/
 * features/023-estado-de-humor-e-piscar-de-olhos.md, seção "Boca
 * sincronizada com o grito"): resolve um SUBCONJUNTO
 * dos ossos já registrados (só os que o clipe de grito de fato anima —
 * cabeça/queixo/antenas, tipicamente) e registra em
 * `mouthSyncRegistry.js`. `view/systems/mouthSyncSystem.js` toca o clipe
 * nesses ossos exatamente enquanto o ÁUDIO do grito (`sounds.voice`) está
 * tocando de verdade — os dois lêem o MESMO evento (`audio.isPlaying`),
 * nunca dessincronizam.
 */
export function useAnimatedModel(entity, species) {
  const groupRef = useRef()
  const { scene, animations } = useGLTF(species.model.path)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])

  useEffect(() => {
    const meshes = []
    cloned.traverse((child) => {
      if (child.isMesh) meshes.push(child)
    })

    const { TOON } = GAME_CONFIG.RENDER
    for (const mesh of meshes) {
      mesh.castShadow = true
      // toon: a luz já vem em tons chapados, sombra projetada por cima suja
      mesh.receiveShadow = !TOON
    }
    if (!TOON) return

    // Material toon + contornos (`view/materials/toonMaterial.js`), criados
    // DEPOIS do traverse (adicionar filhos durante a iteração quebraria o
    // traverse); o cleanup tira os contornos e devolve o material original.
    return applyToonLook(meshes)
  }, [cloned])

  useEffect(() => {
    const texture = species.model.texture
    if (!texture) return

    // Duas formas de `species.model.texture`:
    // - string: UMA textura pra TODO mesh do modelo (`.glb` com um
    //   material só, a textura cobre o modelo inteiro).
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
    // Cópias de textura criadas por ESTA entidade (olho animado, abaixo) —
    // dona do `dispose()` no cleanup.
    const ownedTextures = []
    const materialIndexByMesh = new Map()
    let nextMaterialIndex = 0
    cloned.traverse((child) => {
      if (child.isMesh && !isOutline(child))
        materialIndexByMesh.set(child, nextMaterialIndex++)
    })

    Promise.all(
      entries.map(([materialIndex, obj]) =>
        loadTexture(obj.path).then((cached) => {
          // `loadTexture` já resolve `null` (em vez de rejeitar) numa carga
          // que falhou — precisa sair ANTES de mexer em propriedade de
          // textura, senão o `.then()` lança em cima de `null` e derruba o
          // `Promise.all` inteiro (nenhum material de NENHUM índice seria
          // aplicado, não só o que falhou).
          if (!cached || cancelled) return [Number(materialIndex), null]

          // Olho animado (`eyeStates`): cópia PRÓPRIA da entidade. O cache
          // (`textureCache.js`) devolve a MESMA textura pra toda criatura
          // que carrega o arquivo, e o piscar mexe em `offset` a cada
          // frame — compartilhada, cada criatura escrevia a sua célula por
          // cima das outras (bug: olho alternando entre bravo e normal nas
          // piscadas quando duas criaturas da espécie tinham humores
          // diferentes). `clone()` reusa a imagem (não recarrega nem
          // duplica na GPU); só o recorte (`offset`/`repeat`) fica próprio.
          const loaded = obj.eyeStates ? cached.clone() : cached
          if (loaded !== cached) ownedTextures.push(loaded)

          // `colorSpace`/`wrapS`/`wrapT`/`flipY` (default `true`) já vêm
          // setados por `loadTexture` (`textureCache.js`) — genéricos pra
          // QUALQUER textura carregada por ali. Só sobrescreve `flipY`
          // aqui quando a espécie parametrizar explicitamente (ex.: uma
          // textura que FOI extraída de dentro de um `.glb`, que segue a
          // convenção de UV oposta).
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

          if (obj.eyeStates) {
            // Olho de múltiplos estados (ver docs/features/023-estado-de-
            // humor-e-piscar-de-olhos.md) — offset inicial vem da célula
            // "aberto" do humor ATUAL (`Mood`), não de `pan` estático
            // (mutuamente exclusivos: uma entrada usa um ou outro).
            // `eyeBlinkSystem.js` assume dali em diante; sem isso aqui, a
            // textura nasceria na célula (0,0) do atlas até o 1º tick do
            // system corrigir — um flash visível da célula errada.
            const mood = entity.get(Mood)?.state ?? 'awake'
            const state = resolveEyeState(obj.eyeStates, mood)
            if (state) {
              loaded.offset.set(
                (1 - loaded.repeat.x) / 2 + state.open.x,
                (1 - loaded.repeat.y) / 2 + state.open.y,
              )
            }
          } else if (obj.pan) {
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

          return [Number(materialIndex), loaded, obj]
        }),
      ),
    ).then((loadedByIndex) => {
      if (cancelled) return
      const textureByIndex = new Map(
        loadedByIndex
          .filter(([, loaded]) => loaded)
          .map(([materialIndex, loaded, obj]) => [
            materialIndex,
            { loaded, obj },
          ]),
      )
      if (textureByIndex.size === 0) return

      // Clona o material antes de mudar `.map` — `SkeletonUtils.clone` (acima)
      // reusa material por referência entre instâncias do mesmo `.glb`; sem
      // clonar, a textura vazaria pra qualquer outra entidade carregando o
      // mesmo asset (mesmo motivo do tint em `CreatureView.jsx`).
      for (const [child, materialIndex] of materialIndexByMesh) {
        // Forma string (`isPerMaterial` falso): aplica a MESMA textura em
        // todo mesh, ignorando o índice — mantém o comportamento de sempre.
        const entry = isPerMaterial
          ? textureByIndex.get(materialIndex)
          : textureByIndex.get(0)
        if (!entry) continue
        child.material = child.material.clone()
        child.material.map = entry.loaded
        child.material.needsUpdate = true
      }

      // Unidades de piscar — uma por textura carregada com `eyeStates`
      // (normalmente só o olho, mas sem travar em 1). `loaded` é a MESMA
      // referência atribuída como `.map` acima — a cópia própria desta
      // entidade (ver `ownedTextures`), então mutar `.offset` nela no
      // `eyeBlinkSystem.js` reflete só nesta criatura.
      const eyeBlinkUnits = []
      for (const { loaded, obj } of textureByIndex.values()) {
        if (!obj.eyeStates) continue
        const minInterval = obj.blink?.minInterval ?? DEFAULT_BLINK_MIN_INTERVAL
        const maxInterval = obj.blink?.maxInterval ?? DEFAULT_BLINK_MAX_INTERVAL
        eyeBlinkUnits.push({
          texture: loaded,
          repeat: { x: loaded.repeat.x, y: loaded.repeat.y },
          states: obj.eyeStates,
          blink: {
            minInterval,
            maxInterval,
            closedDuration:
              obj.blink?.closedDuration ?? DEFAULT_BLINK_CLOSED_DURATION,
          },
          phase: 'open',
          timer: minInterval + Math.random() * (maxInterval - minInterval),
          lastMood: entity.get(Mood)?.state ?? 'awake',
        })
      }
      if (eyeBlinkUnits.length > 0) registerEyeBlink(entity, eyeBlinkUnits)
    })

    return () => {
      cancelled = true
      unregisterEyeBlink(entity)
      for (const texture of ownedTextures) texture.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, entity, species])

  // Antes do primeiro quadro, só o grupo no lugar da entidade (senão ele
  // aparecia um instante na origem — `viewRegistry.js`). O registro e o
  // esqueleto/animações continuam no `useEffect` abaixo: eles dependem da
  // ordem com os outros efeitos do modelo (toon, textura), e adiantar eles
  // misturava as animações.
  useLayoutEffect(() => {
    placeAtEntity(groupRef.current, entity)
  }, [cloned, entity])

  useEffect(() => {
    registerView(entity, groupRef.current)

    let skeleton = null
    cloned.traverse((child) => {
      if (child.isSkinnedMesh) skeleton = child.skeleton
    })
    // Animações embutidas no `.glb` (`species.nativeAnimations`, opcional)
    // — este efeito é o dono do player: cria aqui, descarta no cleanup.
    const native =
      skeleton && species.nativeAnimations
        ? createNativeAnimationPlayer(
            cloned,
            animations,
            species.nativeAnimations,
            { blinkConfig: species.nativeBlink },
          )
        : null
    if (skeleton) {
      registerAnimatedBones(entity, {
        bones: resolveBones(skeleton),
        clips: species.clips,
        native,
      })
    }

    return () => {
      unregisterView(entity)
      unregisterAnimatedBones(entity)
      if (native) disposeNativeAnimationPlayer(native)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, entity])

  // Luz de fogo (`species.vfx.fireLight`, opcional — ver docs/features/
  // 060-ajustes-por-especie.md) — precisa do osso já registrado pelo efeito
  // ACIMA; roda depois dele na mesma árvore React (mesmo commit, ordem de
  // declaração), então o osso já está disponível aqui.
  useEffect(() => {
    if (!species.vfx?.fireLight) return
    const config = resolveFireLight(species.vfx.fireLight)
    const bone = getAnimatedBonesEntry(entity)?.bones[config.bone]?.bone
    if (!bone) return // rig sem esse osso — no-op gracioso

    const light = new THREE.PointLight(
      config.color,
      config.intensity,
      config.distance,
      config.decay,
    )
    bone.add(light)
    registerFireLight(entity, light, bone, config)

    return () => unregisterFireLight(entity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  // Boca sincronizada com o grito (`species.clips.cry`, opcional — ver
  // docs/features/023-estado-de-humor-e-piscar-de-olhos.md, seção "Boca
  // sincronizada com o grito") — mesma razão de rodar depois do efeito de
  // ossos que a luz de fogo acima: precisa do osso já registrado,
  // disponível na hora (mesmo commit React).
  useEffect(() => {
    const cryClip = species.clips?.cry
    if (!cryClip) return

    const bonesEntry = getAnimatedBonesEntry(entity)?.bones
    if (!bonesEntry) return

    // SUBCONJUNTO, não o mapa inteiro — ver docstring de
    // `mouthSyncRegistry.js` pro porquê (`applyAnimationClip` reseta pra
    // pose de descanso todo osso do mapa que recebe).
    const bones = {}
    for (const boneName of Object.keys(cryClip.bones)) {
      const bone = bonesEntry[boneName]
      if (bone) bones[boneName] = bone
    }
    if (Object.keys(bones).length === 0) return // rig sem nenhum osso do clipe — no-op gracioso

    registerMouthSync(entity, {
      bones,
      clip: cryClip,
      elapsed: 0,
      wasPlaying: false,
    })

    return () => {
      unregisterMouthSync(entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  useEffect(() => {
    const footstep = resolveFootstepSound(species)
    if (!footstep) return

    const listener = getAudioListener()
    const audio = new THREE.PositionalAudio(listener)
    const volume = footstep.volume ?? DEFAULT_FOOTSTEP_VOLUME
    const flight = resolveFlightSound(species)
    audio.setVolume(volume)
    audio.setRefDistance(footstep.refDistance ?? DEFAULT_FOOTSTEP_REF_DISTANCE)
    groupRef.current.add(audio)
    registerFootstepAudio(entity, audio, volume, flight?.volume ?? volume)

    // Carrega cada variação (`walk`/`run`, array) em paralelo e preenche o
    // registry IN PLACE conforme cada uma termina — `footstepAudioSystem.js`
    // só passa a tocar quando o array correspondente tiver pelo menos um
    // buffer pronto (ver docstring de `footstepAudioRegistry.js`). `cancelled` evita
    // empurrar buffer pra dentro de um registry já desregistrado (entidade
    // desmontou — ex.: criatura recolhida — antes do carregamento terminar).
    let cancelled = false
    // O passo no raso é o mesmo para todos (docs/features/057-lagos-e-
    // rios.md).
    const sources = { buffers: footstep, waterBuffers: WATER_SOUNDS.step }
    // O voo livre com som próprio (`sounds.flightGroup`, docs/features/060-*).
    if (flight) sources.flightBuffers = flight
    for (const [target, sound] of Object.entries(sources)) {
      for (const gait of ['walk', 'run']) {
        for (const path of sound[gait] ?? []) {
          loadAudioBuffer(path).then((buffer) => {
            if (cancelled || !buffer) return
            const entry = getFootstepAudioEntry(entity)
            entry?.[target][gait].push(buffer)
          })
        }
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

  useEffect(() => {
    const summon = resolveSummonSound(species)
    if (!summon) return

    return setupPositionalActionSound(
      entity,
      groupRef,
      summon,
      {
        volume: DEFAULT_ACTION_SOUND_VOLUME,
        refDistance: DEFAULT_ACTION_SOUND_REF_DISTANCE,
      },
      {
        register: registerSummonAudio,
        unregister: unregisterSummonAudio,
        get: getSummonAudioEntry,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  useEffect(() => {
    const recall = resolveRecallSound(species)
    if (!recall) return

    return setupPositionalActionSound(
      entity,
      groupRef,
      recall,
      {
        volume: DEFAULT_ACTION_SOUND_VOLUME,
        refDistance: DEFAULT_ACTION_SOUND_REF_DISTANCE,
      },
      {
        register: registerRecallAudio,
        unregister: unregisterRecallAudio,
        get: getRecallAudioEntry,
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  useEffect(() => {
    // Um conjunto de sons por slot de ataque (básico + habilidades), cada um
    // com uma ou mais partes (ver `core/data/audio/attackSound.js`).
    // E, à parte, o som em LOOP (carga ou ação inteira) de cada slot que tiver um.
    const sounds = resolveAttackSounds(species)
    const loopSounds = resolveAttackLoopSounds(species)
    if (
      Object.keys(sounds).length === 0 &&
      Object.keys(loopSounds).length === 0
    ) {
      return
    }

    return setupAttackAudio(entity, groupRef, sounds, loopSounds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, species])

  return { groupRef, cloned }
}
