import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem } from '@/core/data/items'
import { PLAYER_SPECIES_ID } from '@/core/data/species'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { THROWABLE_RADIUS, THROWABLE_COLOR } from '@/view/scene/throwableVisual'
import {
  InputControlled,
  HeldItem,
  ActionState,
  AimAnchor,
} from '@/core/traits'

// Nome do osso da mão, por espécie — puramente visual (nomes vêm do rig
// 3D, não faz sentido core saber disso), por isso mora aqui, não em
// core/data/species/<id>/. Só espécies com mão (hoje só o treinador,
// PLAYER_SPECIES_ID) entram aqui — sem entrada, o sistema não mostra nada
// e não quebra (ex.: o Fox de teste, quadrúpede, não tem mão nenhuma).
const HAND_BONE_BY_SPECIES = {
  bot: 'mixamorig_RightHand',
}

// Estado do módulo (não trait) — só existe um item-na-mão renderizado por
// vez (só o jogador arremessa hoje), mesmo raciocínio de `aimBlend` em
// cameraFollowSystem.js: é estado de TELA, recriado só quando o osso muda
// (ex.: hot-reload do modelo), não a cada frame.
let mesh = null
let attachedBone = null
// Vetor reaproveitado pra não alocar um THREE.Vector3 novo a cada tick só
// pra ler a escala (ver correção de escala, abaixo).
const worldScale = new THREE.Vector3()

/**
 * Mostra o item equipado (`HeldItem`) encaixado na mão do jogador enquanto
 * mira — sem isso, o objeto "aparece do nada" só no instante do arremesso.
 * Sem modelo 3D próprio por item ainda (ver core/data/items/pebble/
 * index.js), então é a mesma esfera cinza do projétil em voo
 * (`throwableVisual.js`) — muda de "na mão" pra "voando" sem trocar de
 * aparência.
 *
 * A esfera é filha de verdade do osso (`bone.add(mesh)`, Three.js puro) —
 * uma vez encaixada, acompanha a mão sozinha em qualquer pose (inclusive
 * durante o próprio gesto de arremesso), sem esse system precisar
 * recalcular posição nenhuma quadro a quadro; só liga/desliga
 * `mesh.visible`.
 *
 * Visível enquanto: item equipado é `throwable` E a mira está travada
 * (`AimAnchor.active`) E ainda não passou do instante de liberação
 * (`PLAYER_ACTIONS.throw.EFFECT_AT` — o mesmo instante em que
 * `playerActionSystem.js` spawna o `Projectile` de verdade). Depois da
 * liberação, some daqui — o objeto "virou" o projétil voando.
 *
 * Fase: presentation, sem ordem específica com `animationSystem`/
 * `cameraFollowSystem` (o encaixe no osso é responsabilidade do próprio
 * Three.js ao atualizar as matrizes da cena no render, não deste system).
 */
export function heldItemViewSystem(context) {
  const { world } = context
  const handBoneName = HAND_BONE_BY_SPECIES[PLAYER_SPECIES_ID]
  if (!handBoneName) return hide()

  const entity = world.queryFirst(
    InputControlled,
    HeldItem,
    ActionState,
    AimAnchor,
  )
  if (!entity) return hide()

  const heldItem = entity.get(HeldItem)
  const item = heldItem.itemId ? getItem(heldItem.itemId) : null
  const anchor = entity.get(AimAnchor)
  const action = entity.get(ActionState)

  const alreadyReleased =
    action.current === 'throw' &&
    action.elapsed >= GAME_CONFIG.PLAYER_ACTIONS.throw.EFFECT_AT

  const shouldShow =
    item?.category === 'throwable' && !!anchor.active && !alreadyReleased
  if (!shouldShow) return hide()

  const bone = getAnimatedBonesEntry(entity)?.bones[handBoneName]?.bone
  if (!bone) return hide() // modelo ainda não carregou — tenta de novo no próximo frame

  if (bone !== attachedBone) {
    detach()
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(THROWABLE_RADIUS, 12, 12),
      new THREE.MeshStandardMaterial({ color: THROWABLE_COLOR }),
    )
    mesh.castShadow = true
    bone.add(mesh)
    attachedBone = bone
  }

  // O osso vive dentro da hierarquia do modelo inteiro, que é renderizado
  // bem menor que 1:1 (`PLAYER_SPECIES.model.scale`, ~0.015 pro bot, além
  // de qualquer escala já embutida no próprio rig/armature do .glb) — um
  // filho comum herdaria essa escala composta e ficaria minúsculo demais
  // pra aparecer (foi o que estava acontecendo: a esfera existia, só
  // renderizava com um raio efetivo perto de zero). `getWorldScale` lê a
  // escala composta de verdade, direto da matriz do osso — sem precisar
  // saber o número exato nem se ele muda entre espécies/versões do
  // modelo —, e a escala LOCAL da esfera vira o inverso disso, cancelando
  // a composição e deixando o raio configurado (`THROWABLE_RADIUS`) valer
  // em unidades de mundo de verdade.
  bone.getWorldScale(worldScale)
  mesh.scale.set(1 / worldScale.x, 1 / worldScale.y, 1 / worldScale.z)

  mesh.visible = true
}

function hide() {
  if (mesh) mesh.visible = false
}

function detach() {
  if (attachedBone && mesh) attachedBone.remove(mesh)
  mesh = null
  attachedBone = null
}
