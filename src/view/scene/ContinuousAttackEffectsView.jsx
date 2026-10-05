import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { world } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { verticalClearance } from '@/core/physics/colliders'
import { resolveEntityAttack } from '@/core/battle/creatureAttack'
import {
  isAttackChanneling,
  isAttackCharging,
  isAttackPastEffect,
} from '@/core/battle/attackTelegraph'
import { resolveAttackOrigin } from '@/core/battle/attackGeometry'
import { resolveAttackImpactPoint } from '@/core/battle/attackTrajectory'
import { resolveEffectStart } from '@/core/battle/attackEffectPlacement'
import {
  ActionState,
  CharacterController,
  PhysicsBody,
  Position,
  Rotation,
  resolveCreatureSpeciesId,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { createFollowEffectManager } from '@/view/vfx/followEffectManager'
import {
  ABSORB_CHARGE_EMITTERS,
  ABSORB_CHARGE_TEXTURE_PATHS,
} from '@/view/vfx/absorbChargeVfx'
import {
  WATER_GUN_TEXTURE_PATHS,
  WATER_JET_EMITTERS,
} from '@/view/vfx/waterGunVfx'
import {
  TAIL_WHIP_EMITTERS,
  TAIL_WHIP_PIVOT,
  TAIL_WHIP_TEXTURE_PATHS,
} from '@/view/vfx/tailWhipVfx'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

/**
 * Grupos de efeito CONTÍNUO de golpe → emissores: os de CARGA
 * (`visual.chargeGroup`, do disparo até o `effectAt`), os de CANAL
 * (`visual.channelGroup`, do `effectAt` até a ação acabar) e os da AÇÃO
 * (`visual.actionGroup`, também do `effectAt` até a ação acabar, preso ao
 * corpo — qualquer golpe, não só canalizado). As texturas de
 * todos são carregadas juntas (as chaves não podem colidir).
 */
const EFFECTS = {
  absorb: ABSORB_CHARGE_EMITTERS,
  'water-jet': WATER_JET_EMITTERS,
  'tail-whip': TAIL_WHIP_EMITTERS,
}
// Efeitos da AÇÃO: distância (m, ×`visual.scale`) do centro do corpo, pra
// frente, até o PIVÔ do efeito — a origem do quadro dos emissores, o ponto em
// volta do qual `visual.rotationOffset.y` gira. Sem entrada = o centro.
const ACTION_PIVOTS = {
  'tail-whip': TAIL_WHIP_PIVOT,
}
const TEXTURE_PATHS = {
  ...ABSORB_CHARGE_TEXTURE_PATHS,
  ...WATER_GUN_TEXTURE_PATHS,
  ...TAIL_WHIP_TEXTURE_PATHS,
}

const DEG_TO_RAD = Math.PI / 180

/**
 * Efeitos que duram uma FASE do golpe e acompanham a criatura enquanto ela
 * dura — três por criatura, cada um com a própria chave (carga, canal e ação
 * nunca se misturam num sistema só):
 *
 * - **Carga** (`visual.chargeGroup` — ex.: o Growth com `'absorb'`): do
 *   disparo até o `effectAt` (`isAttackCharging`, a janela do aviso no chão);
 *   quadro nos pés. Acaba no efeito ou se o golpe for interrompido.
 * - **Canal** (`visual.channelGroup` — ex.: o Water Gun com `'water-jet'`):
 *   do `effectAt` até a ação acabar (`isAttackChanneling`; soltar o botão
 *   encerra); quadro na BOCA (`resolveAttackOrigin`, deslocada por
 *   `visual.positionOffset`), virado pra direção do
 *   golpe de agora (`ActionState.dir*`, que o feixe reaponta a cada tick) e com
 *   `length` = até onde a trajetória bate agora (`resolveAttackImpactPoint`,
 *   a mesma do dano) — o jato segue a mira.
 * - **Ação** (`visual.actionGroup` — ex.: o Tail Whip com `'tail-whip'`): do
 *   `effectAt` até a ação acabar (`isAttackPastEffect`; interrompida antes,
 *   não aparece); quadro no PIVÔ do efeito (`ACTION_PIVOTS`, à frente do CENTRO do
 *   corpo), virado pra onde a criatura olha — `visual.positionOffset` desloca
 *   o pivô, `visual.rotationOffset.y` gira o efeito em volta do PRÓPRIO pivô
 *   (não sai do lugar) e `visual.rotationOffset.z` gira as partículas no plano
 *   da tela (são billboards: é o único giro que muda o desenho delas).
 *
 * O som de carga é do `attackAudioSystem`. Só LÊ o ECS e deixa
 * `createFollowEffectManager` criar, acompanhar e encerrar cada efeito.
 * `useFrame` aqui é a exceção documentada de componente puramente visual,
 * igual a `DashEffectsView`.
 */
export function ContinuousAttackEffectsView() {
  const textures = useTexture(TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  useEffect(() => {
    const manager = createFollowEffectManager({
      root: rootRef.current,
      createSystem: ({ group, radius, scale }) =>
        createParticleSystem({
          emitters: EFFECTS[group],
          textures,
          length: 0,
          radius,
          scale,
        }),
    })
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [textures])

  useFrame((state, delta) => {
    const manager = managerRef.current
    if (!manager) return

    const followers = []
    world
      .query(ActionState, CharacterController, Position, Rotation)
      .forEach((entity) => {
        const action = entity.get(ActionState)
        const species =
          action.current === 'attack'
            ? getSpecies(resolveCreatureSpeciesId(entity))
            : null
        const attack = species
          ? resolveEntityAttack(entity, species, action.pendingSlot)
          : null
        followers.push(chargeFollower(entity, action, attack))
        followers.push(channelFollower(entity, action, attack, species))
        followers.push(actionFollower(entity, action, attack))
      })

    manager.update(followers, Math.min(delta, MAX_STEP), state.camera.position)
  })

  return <group ref={rootRef} />
}

function chargeFollower(entity, action, attack) {
  const group = attack?.visual?.chargeGroup
  const pos = entity.get(Position)
  const clearance = verticalClearance(entity.get(CharacterController))
  return {
    key: `${entity}:charge`,
    active: !!EFFECTS[group] && isAttackCharging(action, attack),
    group,
    radius: attack?.radius ?? 0,
    scale: attack?.visual?.scale ?? 1,
    // nos pés; o corpo se estende `2 * clearance` pra cima
    origin: [pos.x, pos.y - clearance, pos.z],
    yaw: entity.get(Rotation).y,
    height: clearance * 2,
  }
}

function channelFollower(entity, action, attack, species) {
  const key = `${entity}:channel`
  const group = attack?.visual?.channelGroup
  const active =
    !!EFFECTS[group] &&
    entity.has(PhysicsBody) &&
    isAttackChanneling(action, attack)
  if (!active) return { key, active: false }

  const origin = resolveAttackOrigin(
    entity.get(Position),
    species?.body?.attackOriginHeight,
  )
  const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
  const impact = resolveAttackImpactPoint(
    origin,
    direction,
    attack.range,
    entity.get(PhysicsBody).colliderHandle,
  )
  // Partida VISUAL do jato (`visual.positionOffset`, no referencial do golpe:
  // +Z = pra frente, +Y = pra cima) — só o jato anda; o dano e o ponto onde ele
  // bate continuam contados da boca (`origin`).
  const start = resolveEffectStart(
    origin,
    direction,
    attack.visual.positionOffset,
  )
  return {
    key,
    active,
    group,
    radius: attack.radius,
    scale: attack.visual.scale ?? 1,
    origin: [start.x, start.y, start.z],
    yaw: Math.atan2(action.dirX, action.dirZ),
    height: 0,
    length: Math.hypot(impact.x - start.x, impact.z - start.z),
  }
}

function actionFollower(entity, action, attack) {
  const key = `${entity}:action`
  const group = attack?.visual?.actionGroup
  if (!EFFECTS[group] || !isAttackPastEffect(action, attack)) {
    return { key, active: false }
  }

  const rot = entity.get(Rotation)
  const facing = { x: Math.sin(rot.y), y: 0, z: Math.cos(rot.y) }
  const scale = attack.visual.scale ?? 1
  const offset = attack.visual.positionOffset
  const rotation = attack.visual.rotationOffset
  // o pivô entra no deslocamento (referencial de quem olha, NÃO girado pelo
  // `rotationOffset`): girar não tira o efeito do lugar
  const start = resolveEffectStart(entity.get(Position), facing, {
    x: offset?.x ?? 0,
    y: offset?.y ?? 0,
    z: (offset?.z ?? 0) + (ACTION_PIVOTS[group] ?? 0) * scale,
  })
  return {
    key,
    active: true,
    group,
    radius: attack.radius,
    scale,
    origin: [start.x, start.y, start.z],
    yaw: rot.y + (rotation?.y ?? 0) * DEG_TO_RAD,
    roll: (rotation?.z ?? 0) * DEG_TO_RAD,
    height: verticalClearance(entity.get(CharacterController)) * 2,
  }
}

useTexture.preload(Object.values(TEXTURE_PATHS))
