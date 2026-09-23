import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import * as THREE from 'three'
import { RecallBeam, Position, Rotation } from '@/core/traits'
import {
  PLAYER_SPECIES_ID,
  getPlayerSpecies,
  getSpecies,
} from '@/core/data/species'
import { resolveHandOrigin } from '@/core/aim'
import { playerEntity } from '@/core/world/world'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { HAND_BONE_BY_SPECIES } from '@/view/handBoneBySpecies'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { SUMMON_BALL_RADIUS, SUMMON_BALL_COLOR } from './summonBallVisual'

const HAND_BONE_NAME = HAND_BONE_BY_SPECIES[PLAYER_SPECIES_ID]
// Base "zero" reaproveitada em `resolveHandOrigin` só pra extrair o
// DESLOCAMENTO puro (forward/side/height) sem nenhuma posição somada —
// ver uso no `useFrame`, abaixo.
const ORIGIN = { x: 0, y: 0, z: 0 }

// Mesmo valor de `actions.recall.beamDuration` (core/data/species/bot/
// index.js) — ver docstring de `SummonFlashView.jsx` pro porquê da
// animação de fade não ler o `lifetime` do trait a cada frame.
const BEAM_DURATION = 0.35
const BEAM_COLOR = '#ff2d2d'
// Segmentos entre treinador e criatura — mais segmentos, mais mudanças
// de direção no raio (valores ímpares ajudam o padrão a ficar mais
// irregular, evita simetria óbvia com o alternar de eixo em
// `buildLightningGeometry`, abaixo).
const BEAM_SEGMENTS = 7
const BEAM_TUBE_SEGMENTS = BEAM_SEGMENTS * 3
const BEAM_RADIAL_SEGMENTS = 6
// Intervalo (s) entre re-sorteios da deformidade — o raio não fica
// parado numa curva só, ele treme/pisca enquanto ativo, mesmo efeito de
// relâmpago de verdade. Mais curto = treme mais rápido.
const REFRESH_INTERVAL = 0.05

// Raio de cápsula usado quando `RecallBeam.speciesId` não resolve nenhuma
// espécie (não devia acontecer — só uma rede de segurança pra não
// desenhar um envelope de tamanho zero).
const DEFAULT_ENVELOPE_RADIUS = 0.4

// Nível de subdivisão do icosaedro base do envelope — baixo de propósito
// (poucas facetas grandes), pra reforçar a leitura de "cristal"/forma
// abstrata, não uma esfera lisa nem nada que lembre a cápsula física
// (cilíndrico) — pedido explícito do usuário depois de ver a primeira
// versão (um elipsoide seguindo os eixos da cápsula): "não queria algo
// cilíndrico, pode ser uma forma abstrata".
const ENVELOPE_DETAIL = 1
// Fração do raio que cada vértice pode desviar pra dentro/fora — mesmo
// papel de `beamJitter` no raio, só que aqui é uma constante local (não
// exposta em `bot/index.js`): é um efeito genérico da VIEW, não algo que
// o usuário pediu pra parametrizar por espécie.
const ENVELOPE_JITTER = 0.35

/**
 * Hash determinístico (mesmo estilo "GLSL noise hash" clássico) de uma
 * direção 3D + semente — usado pra deslocar cada vértice do envelope
 * (`buildEnvelopeGeometry`, abaixo) de um jeito que treme a cada refresh
 * (`seed` novo) mas NUNCA rasga a malha: vértices que `PolyhedronGeometry`
 * já deduplica (compartilhados entre facetas adjacentes) têm a mesma
 * direção exata, então caem no mesmo hash e recebem o MESMO deslocamento
 * — sem isso, um vértice de aresta compartilhada podia ganhar dois
 * deslocamentos diferentes (um por face) e abrir uma fresta visível.
 */
function hashDirection(x, y, z, seed) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Raio de uma esfera de volume EQUIVALENTE ao da cápsula física da
 * espécie (`species.body`, ver `_template/index.js`) — "respeita o
 * tamanho" da criatura (pedido do usuário) sem copiar a PROPORÇÃO da
 * cápsula (a primeira versão esticava uma esfera no eixo da cápsula,
 * resultando numa forma parecida com... um cilindro, exatamente o que o
 * usuário NÃO queria). Volume da cápsula = cilindro (`π·r²·2h`) + esfera
 * completa (as duas calotas, `4/3·π·r³`); igualando a `4/3·π·R³` e
 * isolando `R`: `R = cbrt(r³ + 1.5·h·r²)`. Isotrópico de propósito — o
 * envelope abstrato (`buildEnvelopeGeometry`) parte de uma esfera igual
 * em qualquer direção, a deformidade de "cristal" é aleatória, não
 * alinhada a eixo nenhum do corpo.
 */
function resolveEnvelopeRadius(body) {
  const radius = body?.capsuleRadius ?? DEFAULT_ENVELOPE_RADIUS
  const halfHeight = body?.capsuleHalfHeight ?? 0
  return Math.cbrt(radius ** 3 + 1.5 * halfHeight * radius ** 2)
}

/**
 * Gera a geometria do envelope: um icosaedro de baixa subdivisão
 * (`ENVELOPE_DETAIL`) com cada vértice empurrado pra dentro/fora ao longo
 * da própria direção (`hashDirection`, determinístico por direção+`seed`
 * — sem frestas, ver docstring dela) — um "cristal"/blob irregular, não
 * uma esfera lisa nem um elipsoide alinhado ao corpo. Regenerada a cada
 * `REFRESH_INTERVAL` com um `seed` novo (mesmo `useFrame`, junto do raio)
 * — mesmo espírito do "treme/pisca" do relâmpago, aplicado aqui à forma
 * do envelope em vez da curva do tubo.
 */
function buildEnvelopeGeometry(radius, seed) {
  const geometry = new THREE.IcosahedronGeometry(radius, ENVELOPE_DETAIL)
  const position = geometry.attributes.position
  const vertex = new THREE.Vector3()

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    const direction = vertex.clone().normalize()
    const noise =
      hashDirection(direction.x, direction.y, direction.z, seed) * 2 - 1
    vertex.multiplyScalar(1 + noise * ENVELOPE_JITTER)
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Gera uma geometria de tubo em ZIGUEZAGUE entre `from` e `to` (ambos em
 * espaço LOCAL do grupo, ver componente abaixo) — segmentos RETOS
 * (`THREE.LineCurve3` encadeados num `THREE.CurvePath`), não uma curva
 * suave (`CatmullRomCurve3`) — pedido explícito do usuário: "deformidade
 * como se fosse um raio", com mudanças bruscas de direção, não uma linha
 * ondulada:
 *
 *      ┌──────
 *      │
 * ─────┘
 *           ┌────
 *           │
 *           └────────
 *
 * Cada ponto intermediário desvia da linha reta treinador→criatura na
 * direção de UM dos dois vetores perpendiculares ao segmento (`perpA`/
 * `perpB`, alternados por índice — dá o ziguezague acima em vez de um
 * desvio aleatório em qualquer direção, que pareceria mais "tremido" que
 * "raio"), com sinal sorteado. `jitter` (fração do comprimento de CADA
 * segmento, não metros absolutos — o mesmo valor então parece
 * proporcional em recalls curtos e longos) e `thickness` (raio do tubo,
 * em metros) vêm de `actions.recall.beamJitter`/`beamThickness`
 * (`bot/index.js`), parametrizáveis pelo usuário.
 *
 * As pontas (`from`/`to`) nunca são deslocadas — o raio sempre começa
 * exatamente na mão do treinador e termina exatamente na criatura, só o
 * MEIO ziguezagueia.
 */
function buildLightningGeometry(from, to, jitter, thickness) {
  const start = new THREE.Vector3(from.x, from.y, from.z)
  const end = new THREE.Vector3(to.x, to.y, to.z)
  const length = start.distanceTo(end)

  if (length === 0 || thickness <= 0) {
    // Treinador e criatura no mesmo ponto (ou espessura zerada) — tubo
    // degenerado não renderiza nada, evita dividir por zero a seguir.
    return new THREE.BufferGeometry()
  }

  const forward = new THREE.Vector3().subVectors(end, start).normalize()
  // Dois vetores perpendiculares a `forward` pra jitter lateral em
  // qualquer direção (não só num plano) — mesma técnica de "referência
  // arbitrária, troca se quase paralela" já usada em `flameParticles.js`.
  const reference =
    Math.abs(forward.y) < 0.99
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
  const perpA = new THREE.Vector3().crossVectors(forward, reference).normalize()
  const perpB = new THREE.Vector3().crossVectors(forward, perpA).normalize()

  const segmentLength = length / BEAM_SEGMENTS
  const jitterAmount = jitter * segmentLength

  const points = [start]
  for (let i = 1; i < BEAM_SEGMENTS; i++) {
    const point = new THREE.Vector3().lerpVectors(start, end, i / BEAM_SEGMENTS)
    const axis = i % 2 === 0 ? perpA : perpB
    const sign = Math.random() > 0.5 ? 1 : -1
    point.addScaledVector(axis, sign * jitterAmount)
    points.push(point)
  }
  points.push(end)

  const curve = new THREE.CurvePath()
  for (let i = 0; i < points.length - 1; i++) {
    curve.add(new THREE.LineCurve3(points[i], points[i + 1]))
  }

  return new THREE.TubeGeometry(
    curve,
    BEAM_TUBE_SEGMENTS,
    thickness,
    BEAM_RADIAL_SEGMENTS,
    false,
  )
}

/**
 * Visual de um `RecallBeam` (ver docs/features/024-esfera-de-invocar.md
 * — "o feixe de luz vermelha puxa a criatura de volta pra dentro da
 * esfera"): um "raio" em ziguezague (`buildLightningGeometry`) saindo da
 * MÃO do treinador até a criatura (`Position` do grupo, ponta local
 * `(0,0,0)`), MAIS uma esfera parada bem na ponta "mão" — pedido
 * explícito do usuário: a esfera de invocar (mesmo visual de
 * `SummonBallView.jsx`, `SUMMON_BALL_RADIUS`/`SUMMON_BALL_COLOR`
 * reaproveitados) deve "aparecer na mão do bot" durante o recall, não só
 * o feixe sozinho — como se fosse ELA puxando a criatura de volta pra
 * dentro.
 *
 * A ponta "mão" segue o OSSO DE VERDADE (`RHand`, resolvido por
 * `HAND_BONE_BY_SPECIES`, mesmo osso de `heldItemViewSystem.js`) todo
 * frame, via `bone.getWorldPosition` + `groupRef.current.worldToLocal` —
 * NÃO a aproximação geométrica congelada (`RecallBeam.fromX/Y/Z`,
 * `resolveHandOrigin` em `partySummonSystem.js`). Bug real, relatado
 * jogando: antes de existir uma animação de `'recall'` de verdade
 * (`clips/recall.json`), o treinador ficava em T-pose durante a ação, e a
 * aproximação geométrica calhava de parecer certa por coincidência (T-pose
 * tem os braços abertos pros lados, perto de onde qualquer offset lateral
 * fixo aponta); assim que uma animação de gesto de verdade passou a
 * tocar, a mão real do rig se move pra uma pose bem diferente, e a
 * aproximação fixa (que não sabe nada sobre poses de animação — "o motor
 * headless não tem acesso ao osso de verdade") ficou visivelmente errada.
 * `RecallBeam.fromX/Y/Z` continua existindo como FALLBACK — usado no
 * instante do disparo e sempre que o osso ainda não foi resolvido (ver
 * `useFrame`, abaixo).
 *
 * `actions.recall.handForwardOffset`/`handSideOffset`/`handHeightOffset`
 * (`bot/index.js`) têm papel DUPLO, dependendo de qual dos dois caminhos
 * acima está ativo: no FALLBACK, são a posição inteira (via
 * `resolveHandOrigin(pos, rot.y, RECALL)` em `applyRecall`); com o osso
 * resolvido, viram um AJUSTE FINO somado em cima da posição real da mão
 * (`resolveHandOrigin(ORIGIN, rot.y, RECALL)` — zerar a posição de base
 * extrai só o vetor de deslocamento). Pedido do usuário depois de notar
 * que os offsets "pararam de fazer efeito" assim que a mão passou a
 * seguir o osso — sem esse ajuste, eles ficariam mortos (só valendo no
 * frame antes do osso resolver, imperceptível).
 *
 * O raio treme (regenera a deformidade a cada `REFRESH_INTERVAL`); os
 * dois (raio e esfera) esvaem juntos (`opacity`) até `BEAM_DURATION`,
 * mesmo espírito de `SummonFlashView.jsx`.
 *
 * TERCEIRO elemento — o "envelope": pedido do usuário pra o feixe também
 * aparecer NA CRIATURA, "no formato dela" (inviável genericamente — sem
 * malha específica por espécie pronta pra isso) mas "respeitando o
 * tamanho" dela. PRIMEIRA versão tentou um elipsoide esticado no eixo da
 * cápsula física — rejeitada pelo usuário: "não queria algo cilíndrico,
 * pode ser uma forma abstrata". Versão atual: um "cristal"/blob irregular
 * (`buildEnvelopeGeometry` — icosaedro de baixa subdivisão com vértices
 * deslocados por um ruído determinístico, `hashDirection`), de raio
 * ISOTRÓPICO (`resolveEnvelopeRadius` — esfera de volume equivalente ao
 * da cápsula da espécie, `RecallBeam.speciesId` → `getSpecies().body`,
 * sem seguir a proporção/eixo dela) — "respeita o tamanho" sem parecer
 * cilíndrico feito a cápsula de origem. Fixo na ponta "criatura" (origem
 * local do grupo), a forma treme a cada `REFRESH_INTERVAL` (mesmo raciocínio
 * do raio) enquanto ENCOLHE até sumir (`1 - t`, mesmo `t` do fade do raio/
 * da esfera) — "encobre e recolhe", como se a criatura estivesse sendo
 * sugada pra dentro do próprio ponto onde ela estava. O RAIO é calculado
 * uma ÚNICA vez no mount (o corpo da espécie não muda em runtime); a
 * FORMA (geometria) é regenerada com esse mesmo raio a cada refresh.
 *
 * Geometria do raio gerenciada IMPERATIVAMENTE (não via `<bufferGeometry>`
 * declarativo) — trocada a cada refresh, disposta a cada troca e no
 * desmonte, pra não vazar memória de GPU a cada regeneração. A esfera
 * NÃO é filha do osso (`bone.add()`, como o item na mão) — ficaria presa
 * na escala minúscula do rig (~0.015, ver `heldItemViewSystem.js`) e
 * precisaria da mesma correção de escala; em vez disso, lê a posição
 * MUNDIAL do osso todo frame e converte pro espaço local do grupo (que
 * já vive em escala de mundo normal, via `syncTransformSystem`) — mais
 * simples, sem herdar rotação/escala nenhuma do rig (a esfera não
 * precisa "virar junto" com a mão, só acompanhar a posição).
 *
 * Lê `RecallBeam`/`Position` uma ÚNICA vez, via `entity.get()` direto
 * (não `useTrait`, que re-renderizaria o componente a CADA TICK — o
 * `lifetime` do trait muda todo tick, em `summonEffectsSystem.js`, mas
 * `fromX/Y/Z`/a posição da criatura são congelados no disparo e nunca
 * mudam depois; só a animação em si — fade, deformidade, posição da mão —
 * precisa rodar todo frame, e isso já é `useFrame`, fora do ciclo de
 * render do React).
 */
export function RecallBeamView({ entity }) {
  const groupRef = useRef()
  const meshRef = useRef()
  const ballRef = useRef()
  const envelopeRef = useRef()
  const elapsedRef = useRef(0)
  const refreshTimerRef = useRef(0)
  const localFromRef = useRef({ x: 0, y: 0, z: 0 })
  // Raio "cheio" (t=0) do envelope, derivado uma vez no mount a partir do
  // corpo da espécie — `useFrame` regenera a FORMA com esse raio a cada
  // refresh, e escala o resultado por `(1 - t)` a cada frame (encolhe),
  // nunca recalcula o raio em si.
  const envelopeRadiusRef = useRef(DEFAULT_ENVELOPE_RADIUS)
  // Vetor reaproveitado pra não alocar um THREE.Vector3 novo a cada frame
  // só pra ler a posição do osso — mesmo raciocínio de `worldScale` em
  // heldItemViewSystem.js.
  const worldHandPositionRef = useRef(new THREE.Vector3())

  useEffect(() => {
    const mesh = meshRef.current
    const envelopeMesh = envelopeRef.current
    registerView(entity, groupRef.current)
    mesh.geometry = new THREE.BufferGeometry()

    const beam = entity.get(RecallBeam)
    const pos = entity.get(Position)
    // O grupo já está na posição da CRIATURA (Position, via
    // syncTransformSystem) — em espaço local, a ponta "criatura" é
    // sempre a origem; a ponta "mão do treinador" é `from` menos essa
    // posição.
    localFromRef.current = {
      x: beam.fromX - pos.x,
      y: beam.fromY - pos.y,
      z: beam.fromZ - pos.z,
    }
    ballRef.current.position.set(
      localFromRef.current.x,
      localFromRef.current.y,
      localFromRef.current.z,
    )

    const body = getSpecies(beam.speciesId)?.body
    envelopeRadiusRef.current = resolveEnvelopeRadius(body)
    envelopeMesh.geometry = buildEnvelopeGeometry(
      envelopeRadiusRef.current,
      Math.random() * 1000,
    )

    return () => {
      unregisterView(entity)
      mesh.geometry?.dispose()
      envelopeMesh.geometry?.dispose()
    }
  }, [entity])

  useFrame((_state, delta) => {
    if (!meshRef.current) return

    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / BEAM_DURATION, 1)
    const opacity = 1 - t
    meshRef.current.material.opacity = opacity
    ballRef.current.material.opacity = opacity

    // Envelope encolhe (escala UNIFORME, isotrópica — a forma em si não
    // se alonga em eixo nenhum, só fica pequena) de "cheio" (cobrindo a
    // criatura) até sumir, acompanhando o mesmo `t` do fade do raio/da
    // esfera — "encobre e recolhe" num só gesto, ver docstring do
    // componente.
    envelopeRef.current.scale.setScalar(1 - t)
    envelopeRef.current.material.opacity = opacity

    // Osso de VERDADE da mão, se já resolvido (ver docstring do
    // componente) — sem ordem garantida com o registro de ossos do
    // treinador (feito em `useAnimatedModel.js`, outro componente), tenta
    // de novo a cada frame até achar; até lá, `localFromRef`/a posição da
    // esfera continuam no fallback geométrico setado no mount. Achado uma
    // vez, o osso não desaparece — não precisa parar de tentar depois.
    const bone = HAND_BONE_NAME
      ? getAnimatedBonesEntry(playerEntity)?.bones[HAND_BONE_NAME]?.bone
      : null
    if (bone && groupRef.current) {
      const worldHandPosition = worldHandPositionRef.current
      bone.getWorldPosition(worldHandPosition)

      // Ajuste fino EM CIMA da posição real da mão — mesmos campos
      // (`actions.recall.handForwardOffset`/`handSideOffset`/
      // `handHeightOffset`) que antes definiam a posição inteira (sem
      // osso, ver docstring); agora que o osso resolve a posição de
      // verdade, eles viraram um pequeno deslocamento por cima dela, na
      // direção que o treinador encara AGORA (`Rotation.y` ao vivo do
      // treinador, não travado no disparo) — pedido do usuário depois de
      // notar que os offsets "pararam de fazer efeito": zerar `pos` em
      // `resolveHandOrigin` extrai só o vetor de deslocamento, sem somar
      // posição nenhuma.
      const RECALL = getPlayerSpecies().actions.recall
      const trainerRotY = playerEntity.get(Rotation).y
      const fineTune = resolveHandOrigin(ORIGIN, trainerRotY, RECALL)
      worldHandPosition.x += fineTune.x
      worldHandPosition.y += fineTune.y
      worldHandPosition.z += fineTune.z

      groupRef.current.worldToLocal(worldHandPosition)
      localFromRef.current = {
        x: worldHandPosition.x,
        y: worldHandPosition.y,
        z: worldHandPosition.z,
      }
      ballRef.current.position.copy(worldHandPosition)
    }

    refreshTimerRef.current -= delta
    if (refreshTimerRef.current > 0) return
    refreshTimerRef.current = REFRESH_INTERVAL

    const { beamThickness, beamJitter } = getPlayerSpecies().actions.recall
    const newGeometry = buildLightningGeometry(
      localFromRef.current,
      { x: 0, y: 0, z: 0 },
      beamJitter,
      beamThickness,
    )
    meshRef.current.geometry.dispose()
    meshRef.current.geometry = newGeometry

    // Forma do envelope treme junto (novo `seed`, mesmo raio já fixado no
    // mount) — mesma cadência do raio, mesmo espírito de "relâmpago"
    // aplicado à forma abstrata em vez da curva do tubo.
    const newEnvelopeGeometry = buildEnvelopeGeometry(
      envelopeRadiusRef.current,
      Math.random() * 1000,
    )
    envelopeRef.current.geometry.dispose()
    envelopeRef.current.geometry = newEnvelopeGeometry
  })

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <meshBasicMaterial color={BEAM_COLOR} transparent opacity={1} />
      </mesh>
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[SUMMON_BALL_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color={SUMMON_BALL_COLOR}
          transparent
          opacity={1}
        />
      </mesh>
      {/* Envelope genérico ("cristal" abstrato, não uma forma que lembre
          a cápsula física) na ponta "criatura" (origem local do grupo) —
          geometria gerenciada IMPERATIVAMENTE (mount + useFrame, ver
          acima), mesmo padrão do raio (`meshRef`). */}
      <mesh ref={envelopeRef}>
        <meshBasicMaterial color={BEAM_COLOR} transparent opacity={1} />
      </mesh>
    </group>
  )
}

/**
 * Renderiza uma `RecallBeamView` por `RecallBeam` ativo — mesmo padrão de
 * `SummonFlashesView`/`ConsumeEffectsView`.
 */
export function RecallBeamsView() {
  const beams = useQuery(RecallBeam, Position, Rotation)

  return (
    <>
      {beams.map((entity) => (
        <RecallBeamView key={entity} entity={entity} />
      ))}
    </>
  )
}
