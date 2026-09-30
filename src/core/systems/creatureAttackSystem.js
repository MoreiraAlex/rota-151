import { resolveAttackDirection } from '../battle/attackAim'
import { getPlayerSpecies, getSpecies } from '../data/species'
import { resolveCreatureAttack } from '../data/attacks'
import {
  calculateAttackDurationFactor,
  calculateStat,
} from '../data/species/stats'
import { castRay } from '../physics/raycast'
import { resolveDamageAmount } from '../battle/calculateDamage'
import {
  closestPointsOnGroundPlane,
  isWithinCombatHeight,
  resolveAttackOrigin,
  resolveCapsuleSegment,
  resolveContactPoint,
  resolveFootElevation,
  resolveGroundY,
} from '../battle/attackGeometry'
import { GAME_CONFIG } from '../gameConfig'
import { attackResolved } from '../events'
import { entrarEmCombate } from '../actions/combat'
import { isActiveCombatant } from '../battle/combatTargets'
import { gameplayRng } from '../rng'
import {
  ActionState,
  AttackAim,
  AttackCooldowns,
  AttackEffect,
  AttackPulse,
  CharacterController,
  DEFAULT_ATTACK_EFFECT_GROUP,
  Fainted,
  IndividualValues,
  InputControlled,
  Party,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Vitals,
  WantsToAttack,
  WildCreature,
  applyDamage,
  resolveCreatureSpeciesId,
} from '../traits'

const DEG_TO_RAD = Math.PI / 180

// Fração de `duration` em que o efeito de fato acontece — mesma
// proporção (0.4) que já era usada quando cada espécie calculava isto
// à mão em `attacks.primary.overrides.effectAt` (ver docs/features/029-
// *.md). Só pro ataque BÁSICO (`primary`) — skills (secondary1-3) têm
// `effectAt` PRÓPRIO na definição do ataque (`core/data/attacks/`), não
// derivado de `speed`.
const PRIMARY_EFFECT_AT_RATIO = 0.4

/**
 * `duration`/`effectAt` do ataque BÁSICO (`primary`) escalados pelo
 * status `speed` da PRÓPRIA entidade — pedido original do usuário:
 * "preciso que o status speed influencie na velocidade de ataque básico
 * da criatura".
 *
 * A duração BASE é a autorada: `attacks.primary.overrides.duration` da
 * espécie (já mesclado em `attack` por `resolveCreatureAttack`), ou a do
 * próprio ataque. O `speed` só multiplica por um fator em volta de 1
 * (`calculateAttackDurationFactor`, `GAME_CONFIG.BATTLE.ATTACK_SPEED`) —
 * assim a duração escolhida pra casar com a animação continua valendo, e
 * uma criatura mais rápida só encurta o golpe. (Antes, o `speed` gerava a
 * duração inteira, 0.05–0.5s — curto demais pros clipes embutidos, e por
 * isso o override da espécie passou a ignorá-lo; ver docs/features/032-*.)
 * `effectAt` escala junto: `overrides.effectAt`, ou 40% da duração base.
 * O corte de frames e as fases da animação acompanham sozinhos (são
 * proporcionais à duração).
 *
 * Retorna `null` pra espécie sem `stats.speed.base` (`fox`/`wolf` ainda
 * não migrados) — fica o ataque como está, mesmo fallback de sempre.
 */
function resolvePrimaryDurationOverride(species, attack, individualValues) {
  const speedStat = species?.stats?.speed
  if (!speedStat || speedStat.base == null) return null

  const speed = calculateStat({
    base: speedStat.base,
    iv: individualValues?.speed ?? 0,
    ev: speedStat.ev ?? 0,
    level: species.level ?? 1,
  })
  const { REFERENCE, MIN_FACTOR, MAX_FACTOR } = GAME_CONFIG.BATTLE.ATTACK_SPEED
  const factor = calculateAttackDurationFactor(speed, {
    reference: REFERENCE,
    minFactor: MIN_FACTOR,
    maxFactor: MAX_FACTOR,
  })

  const baseEffectAt =
    species.attacks.primary.overrides?.effectAt ??
    attack.duration * PRIMARY_EFFECT_AT_RATIO
  return {
    duration: attack.duration * factor,
    effectAt: baseEffectAt * factor,
  }
}

/**
 * Resolve a definição de ataque de verdade pro `slot` desta entidade —
 * `resolveCreatureAttack` (config estática, `core/data/attacks/`) +,
 * só pra `primary`, o `duration`/`effectAt` dinâmico calculado acima.
 * Chamada duas vezes por ataque em andamento (disparo e cada tick de
 * progresso, ver `creatureAttackSystem` abaixo) — sempre com o MESMO
 * resultado pra um dado slot/entidade, já que `IndividualValues` está
 * congelado pra aquela entidade (nunca muda entre as duas chamadas).
 */
function resolveAttackForEntity(species, slot, individualValues) {
  const attack = resolveCreatureAttack(species?.attacks?.[slot])
  if (!attack) return null
  if (slot !== 'primary') return attack

  const override = resolvePrimaryDurationOverride(
    species,
    attack,
    individualValues,
  )
  return override ? { ...attack, ...override } : attack
}

// Folga (m) da sonda de terreno — começa um pouco acima do maior degrau
// aceito, pra um degrau exatamente no limite ainda ser encontrado.
const GROUND_PROBE_MARGIN = 0.01

function castSegment(from, to, excludeColliderHandle) {
  const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  const length = Math.hypot(delta.x, delta.y, delta.z)
  if (length < 1e-6) return null

  const hit = castRay(
    from,
    { x: delta.x / length, y: delta.y / length, z: delta.z / length },
    length,
    { excludeColliderHandle },
  )
  return hit?.point ?? null
}

/**
 * Onde a trajetória do golpe termina — combate 2.5D: o golpe anda
 * `range` metros na HORIZONTAL (componente Y de `direction` é ignorado)
 * mantendo a MESMA altura acima do terreno que a origem tem. Amostra o
 * terreno a cada `ATTACK_PATH_SAMPLE_STEP`:
 *
 * - rampa/terreno suave: o golpe acompanha (não bate no próprio chão
 *   subindo uma rampa);
 * - desnível maior que `PATHFINDING.MAX_CLIMB_STEP` (subindo OU
 *   descendo — borda de terraço, penhasco): o golpe para antes dele,
 *   mesmo critério de "intransponível" do pathfinding;
 * - parede/obstáculo/corpo entre duas amostras: raycast entre elas, o
 *   golpe para no ponto de contato (um `range` grande não atravessa nada).
 *
 * Sem física carregada ou sem chão sob a origem: segue reto na horizontal,
 * parando no primeiro obstáculo (fallback gracioso, cobre testes headless).
 */
export function resolveAttackImpactPoint(
  origin,
  direction,
  range,
  excludeColliderHandle,
) {
  const { ATTACK_PATH_SAMPLE_STEP, GROUND_PROBE_DISTANCE } = GAME_CONFIG.BATTLE
  const { MAX_CLIMB_STEP } = GAME_CONFIG.PATHFINDING
  const flatLength = Math.hypot(direction.x, direction.z)
  const dirX = direction.x / flatLength
  const dirZ = direction.z / flatLength

  const originGround = resolveGroundY(
    origin.x,
    origin.y,
    origin.z,
    GROUND_PROBE_DISTANCE,
  )
  if (originGround === null) {
    const flatEnd = {
      x: origin.x + dirX * range,
      y: origin.y,
      z: origin.z + dirZ * range,
    }
    return castSegment(origin, flatEnd, excludeColliderHandle) ?? flatEnd
  }

  const heightAboveGround = origin.y - originGround
  const probeHeight = MAX_CLIMB_STEP + GROUND_PROBE_MARGIN
  let previous = origin
  let previousGround = originGround
  let travelled = 0

  while (travelled < range) {
    travelled = Math.min(travelled + ATTACK_PATH_SAMPLE_STEP, range)
    const x = origin.x + dirX * travelled
    const z = origin.z + dirZ * travelled
    // Sonda de `previousGround + probeHeight` até `previousGround -
    // probeHeight`: terreno subindo além disso começa DENTRO do
    // obstáculo (volta o próprio início → desnível); descendo além disso
    // não acha nada (`null` → desnível).
    const ground = resolveGroundY(
      x,
      previousGround + probeHeight,
      z,
      2 * probeHeight,
    )
    if (ground === null || Math.abs(ground - previousGround) > MAX_CLIMB_STEP) {
      // Desnível entre esta amostra e a anterior: se for uma parede/
      // borda subindo, um raio reto acha a face exata; descendo, não há
      // nada na frente e o golpe para na última amostra antes da borda.
      // A folga cobre a face caindo exatamente em cima da amostra.
      const flatNext = {
        x: x + dirX * GROUND_PROBE_MARGIN,
        y: previous.y,
        z: z + dirZ * GROUND_PROBE_MARGIN,
      }
      return castSegment(previous, flatNext, excludeColliderHandle) ?? previous
    }

    const next = { x, y: ground + heightAboveGround, z }
    const hit = castSegment(previous, next, excludeColliderHandle)
    if (hit) return hit

    previous = next
    previousGround = ground
  }

  return previous
}

/**
 * Percorre quem pode ser atingido, por lado: `'wild'` = selvagens (alvo
 * do golpe das criaturas do time); `'player'` = lado do jogador —
 * criaturas do time e o treinador (quem tem `Party`), alvo do golpe das
 * selvagens. Nunca o próprio lado: sem fogo amigo.
 */
function forEachTargetCandidate(world, targetSide, visit) {
  const sides =
    targetSide === 'wild' ? [WildCreature] : [SummonedCreature, Party]
  for (const side of sides) {
    world
      .query(side, Position, Rotation, CharacterController, Vitals)
      .readEach(([, pos, rot, controller, vitals], entity) =>
        visit(entity, pos, rot, controller, vitals),
      )
  }
}

/** Espécie de quem luta: a da criatura, ou a do treinador. */
function resolveCombatantSpecies(entity) {
  const speciesId = resolveCreatureSpeciesId(entity)
  return speciesId ? getSpecies(speciesId) : getPlayerSpecies()
}

/**
 * Detecção de acerto ao longo da TRAJETÓRIA inteira do golpe (pedido do
 * usuário: "trajetória inteira"), não só na esfera da ponta — a área
 * efetiva vai de `origin` até `impactPoint` com raio `radius`.
 *
 * **Combate 2.5D**: dois testes separados.
 * 1. Mesmo plano de combate — elevação dos pés de cada um relativa ao
 *    próprio terreno (`resolveFootElevation`), diferença até
 *    `MAX_COMBAT_HEIGHT_DIFF` (`isWithinCombatHeight`). Rampa, degrau ou
 *    terraço não importam; só quem está no ar (pulo) sai do plano.
 * 2. Alcance no plano HORIZONTAL — distância entre a trajetória e a
 *    pegada do corpo do alvo, com Y zerado (`closestPointsOnGroundPlane`)
 *    ≤ `radius + capsuleRadius`. Usa as medidas do corpo físico
 *    (`CharacterController` + `Rotation.y`, que gira cápsulas deitadas).
 *
 * Paredes e desníveis já cortaram a trajetória antes daqui
 * (`resolveAttackImpactPoint`) — alvo atrás deles fica fora do alcance.
 *
 * **Um alvo por golpe**: o PRIMEIRO ao longo da trajetória (menor `s`,
 * mais perto da origem); empate desempata pela menor distância. Acertar
 * todos no caminho seria mudança de gameplay à parte.
 *
 * **Só `WildCreature` é alvo** (decisão consciente): hoje só a criatura
 * controlada pelo jogador ataca, sem PvP nem conceito de time/dono no
 * ECS — `SummonedCreature` nunca é candidata, sem fogo amigo.
 *
 * Retorna também `contactPoint` (superfície da cápsula do alvo, na
 * direção da trajetória) — onde VFX/reação de acerto devem nascer.
 */
export function resolveAttackTarget(
  world,
  origin,
  impactPoint,
  radius,
  attackerElevation,
  targetSide,
) {
  let best = null

  forEachTargetCandidate(
    world,
    targetSide,
    (entity, pos, rot, controller, vitals) => {
      // Sem HP ou desmaiada (`Fainted`): não é mais alvo.
      if (vitals.hp <= 0 || entity.has(Fainted)) return
      if (
        !isWithinCombatHeight(
          attackerElevation,
          resolveFootElevation(pos, controller),
        )
      )
        return

      const capsule = resolveCapsuleSegment(pos, rot.y, controller)
      const closest = closestPointsOnGroundPlane(
        origin,
        impactPoint,
        capsule.a,
        capsule.b,
      )
      if (closest.distance > radius + controller.capsuleRadius) return

      const isEarlier =
        !best ||
        closest.s < best.s ||
        (closest.s === best.s && closest.distance < best.distance)
      if (!isEarlier) return

      // Contato na altura da trajetória naquele ponto (não no Y zerado da
      // conta no plano) — é onde um VFX de acerto deve nascer.
      const pathY = origin.y + (impactPoint.y - origin.y) * closest.s
      best = {
        s: closest.s,
        distance: closest.distance,
        entity,
        species: resolveCombatantSpecies(entity),
        vitals,
        individualValues: entity.has(IndividualValues)
          ? entity.get(IndividualValues)
          : null,
        contactPoint: resolveContactPoint(
          { ...closest.pointOnSecond, y: pathY },
          { ...closest.pointOnFirst, y: pathY },
          controller.capsuleRadius,
        ),
      }
    },
  )

  if (!best) return null
  const { entity, species, vitals, individualValues, contactPoint } = best
  return { entity, species, vitals, individualValues, contactPoint }
}

/**
 * Orientação (Euler, radianos) do VFX do ataque a partir da direção 3D
 * completa do golpe (`direction`, já resolvida por `resolveAimDirection`)
 * mais o ajuste fino em graus da própria definição do ataque
 * (`attack.visual.rotationOffset` — ver `core/data/attacks/`). Pedido
 * explícito do usuário: "o Scratch fica limitado a uma orientação
 * horizontal [só `Rotation.y`]... quero que a orientação seja
 * configurável, permitindo rotacionar o efeito livremente" — duas partes:
 *
 * 1. `yaw`/`pitch` a partir do vetor 3D (não só o componente horizontal
 *    que `rot.y` do CORPO usa — o corpo não inclina pra cima/baixo de
 *    propósito, mas o VFX pode/deve, senão um golpe mirado pra cima
 *    nasce "deitado"). `pitch` usa `atan2` (não `asin`) por robustez
 *    numérica perto de `direction.y` ±1.
 * 2. `rotationOffset` (graus) somado por cima — a malha de rip
 *    convertida não tem "forward" garantidamente alinhado com a
 *    convenção do jogo (`forward = (sin(yaw), cos(yaw))` em pitch 0);
 *    este campo é o escape-hatch pra corrigir isso por config, sem
 *    mexer em código, olhando o resultado em jogo.
 *
 * `core/` não importa Three.js (a ponte ECS → Three mora na view) — por
 * isso graus→radianos é uma multiplicação simples aqui, não
 * `THREE.MathUtils.degToRad` (esse sim usado em `tailFireSystem.js`, que
 * é view).
 *
 * Exportada — mesmo motivo de `resolveAttackImpactPoint` (testável como
 * função pura, sem precisar montar um world/entidade inteiros).
 */
export function resolveEffectRotation(direction, rotationOffset) {
  const yaw = Math.atan2(direction.x, direction.z)
  const horizontalLength = Math.hypot(direction.x, direction.z)
  const pitch = Math.atan2(-direction.y, horizontalLength)
  const offset = rotationOffset ?? { x: 0, y: 0, z: 0 }

  return {
    x: pitch + offset.x * DEG_TO_RAD,
    y: yaw + offset.y * DEG_TO_RAD,
    z: offset.z * DEG_TO_RAD,
  }
}

// Ordem de prioridade de disparo por tick — botão esquerdo do mouse
// primeiro, depois Q/E/R na ordem de sempre (mesmos rótulos de
// `resolveActionSlots`/`species.attacks.<slot>`, ver `core/data/
// actionSlots.js`). Reaproveita o padrão de `SLOTS` em
// `partySummonSystem.js` (array de `{ input, slot }`, só um processado
// por tick — segurar duas teclas juntas não empilha, só a primeira da
// lista com input+config válidos ganha).
const ATTACK_SLOTS = [
  { input: 'primary', slot: 'primary' },
  { input: 'secondary1', slot: 'secondary1' },
  { input: 'secondary2', slot: 'secondary2' },
  { input: 'secondary3', slot: 'secondary3' },
]

/**
 * Ataque do `slot` pronto pra lançar AGORA: configurado, ação livre,
 * stamina e cooldown ok. `null` se não der.
 */
function resolveCastableAttack(castContext, slot) {
  const { species, individualValues, action, vitals, cooldowns } = castContext
  if (action.current !== null) return null

  const attack = resolveAttackForEntity(species, slot, individualValues)
  if (!attack) return null
  if (vitals.stamina < attack.staminaCost) return null
  if (cooldowns[slot] > 0) return null
  return attack
}

/**
 * Direção horizontal (unitária) de `from` até `to` — a mira da IA. Alvo em
 * cima (distância ~0): mantém pra onde o corpo já está virado.
 */
function resolveDirectionTo(from, to, rot) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return { x: Math.sin(rot.y), y: 0, z: Math.cos(rot.y) }
  return { x: dx / length, y: 0, z: dz / length }
}

/**
 * Lança o ataque do `slot` se der (`resolveCastableAttack`): trava a
 * ação, desconta stamina, trava cooldown e trava a direção do golpe.
 * Devolve se lançou. `direction` (horizontal, unitária) é a mira pronta
 * da IA; sem ela, mira pela câmera (`resolveAttackDirection` — jogador).
 */
function tryStartAttack(castContext, slot, direction = null) {
  const attack = resolveCastableAttack(castContext, slot)
  if (!attack) return false

  const { world, species, action, vitals, cooldowns, pos, rot, physicsBody } =
    castContext
  action.current = 'attack'
  action.pendingSlot = slot
  action.elapsed = 0
  // Ver docstring de `ActionState.animationSpeed` — `animationSystem.js`
  // toca o clipe de ataque nesta velocidade, então o gesto sempre cabe
  // exatamente em `attack.duration`.
  action.animationSpeed = attack.duration > 0 ? 1 / attack.duration : 1
  // Corte do clipe embutido (`overrides.animationFrames`) — ver `ActionState`.
  action.animationFrames = attack.animationFrames ?? null
  vitals.stamina -= attack.staminaCost
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
  cooldowns[slot] = attack.cooldown

  // Horizontal, com assistência no corpo a corpo — ver
  // `resolveAttackDirection` (`core/battle/attackAim.js`).
  const aim =
    direction ??
    resolveAttackDirection(
      world,
      pos,
      physicsBody.colliderHandle,
      species,
      attack,
    )
  action.dirX = aim.x
  action.dirY = aim.y
  action.dirZ = aim.z
  // O corpo encara a direção do golpe (só gira em Y).
  rot.y = Math.atan2(aim.x, aim.z)

  // Todo ataque lançado põe (ou mantém) a criatura em modo combate.
  entrarEmCombate(castContext.entity)
  return true
}

/**
 * `castMode` efetivo do ataque: `castModeOverride` (`context.settings`,
 * hoje só o modo debug — F2 força `'confirm'` em tudo) ganha da definição
 * do ataque; ausente na definição = `'instant'`.
 */
export function resolveCastMode(attack, castModeOverride) {
  if (castModeOverride) return castModeOverride
  return attack.castMode === 'confirm' ? 'confirm' : 'instant'
}

/**
 * Trata os botões de ataque apertados neste tick (fora a confirmação do
 * indicador, que o system trata antes), na ordem de prioridade de
 * `ATTACK_SLOTS` — o primeiro que "pega" encerra o tick:
 * - `castMode: 'confirm'`: abre o indicador desse slot (ou troca pra ele,
 *   se outro estava aberto), se o ataque existe e não está em cooldown.
 * - `castMode: 'instant'`: lança na hora, se der; senão tenta o próximo.
 */
function handleAttackPress(castContext, aim, input, castModeOverride) {
  const { species, individualValues, cooldowns } = castContext

  for (const { input: inputKey, slot } of ATTACK_SLOTS) {
    if (!input[inputKey] || slot === aim.slot) continue

    const attack = resolveAttackForEntity(species, slot, individualValues)
    if (!attack) continue

    if (resolveCastMode(attack, castModeOverride) === 'confirm') {
      if (cooldowns[slot] > 0) continue
      aim.slot = slot
      return
    }

    if (tryStartAttack(castContext, slot)) {
      aim.slot = null
      return
    }
  }
}

/**
 * Ataques de criatura — do time E selvagens — num system só, em quatro
 * passadas por tick: (1) cooldowns de todo atacante; (2) disparo pelo
 * input da criatura controlada; (3) disparo da IA — selvagem ou criatura
 * do time fora do controle com `WantsToAttack` (posto pelo
 * `wildBehaviorSystem.js`/`partyBehaviorSystem.js`) lança o ataque básico
 * mirando no alvo do pedido (`tryStartAttack` com direção pronta — mesmo
 * caminho, stamina/cooldown/modo combate iguais); (4)
 * avanço do golpe de todo atacante. O golpe de criatura do time acerta
 * selvagens; o de selvagem acerta o lado do jogador (criaturas do time e
 * treinador) — `resolveAttackTarget`, `targetSide`.
 *
 * Disparo pelo input: dispara e avança o ataque/skill de uma criatura controlada — botão
 * ESQUERDO do mouse (`primary`, ataque comum) OU Q/E/R (`secondary1-3`,
 * skills — a partir da 9ª rodada de docs/features/025-ataque-comum-de-
 * criatura.md: "pode fazer as habilidades agora?"), sem precisar de
 * nenhum gatilho extra. A direção do golpe vem de
 * `resolveAttackDirection` (`core/battle/attackAim.js`): corpo a corpo
 * usa só o giro horizontal da câmera e resolve a altura pelo alvo à
 * frente; à distância segue a câmera com inclinação. Trava o corpo (`rot.y`, só
 * o componente horizontal — o corpo não inclina) e o centro da área
 * efetiva (3D completo, incluindo altura) — resolvida uma vez no disparo
 * (`action.dirX/dirY/dirZ`), não recalculada no `effectAt`: a câmera é
 * livre pra girar durante o gesto, mesmo motivo de sempre
 * (`beginSummon`/`resolveThrowLaunch`, docs/features/024-esfera-de-
 * invocar.md).
 *
 * **Um único slot dispara por vez** (`ATTACK_SLOTS`, acima): a cada tick
 * livre (`action.current === null`), percorre mouse→Q→E→R na ordem, e o
 * PRIMEIRO com tecla pressionada + `species.attacks.<slot>` resolvido +
 * stamina/cooldown livres ganha — os outros três nem são considerados
 * naquele tick (mesmo padrão de "só um por tick" de `partySummonSystem.js`).
 * `action.pendingSlot` (reaproveitado do mesmo campo que invocar/recolher
 * já usa, com outro significado — ver docstring de `ActionState`) grava
 * QUAL slot ganhou, porque `action.current` vira só `'attack'` pras
 * quatro fontes (mouse e as três teclas) — sem o slot, o `effectAt`/
 * `duration` no meio do gesto não saberia se deve reler
 * `attacks.primary` ou `attacks.secondary1`, por exemplo.
 *
 * **Respeita o trajeto, não só o destino** (`resolveAttackImpactPoint`,
 * acima): com um `range` grande (simulando o alcance de um golpe tipo
 * chicote), o ponto de impacto não "teleporta" através de parede/
 * obstáculo nem desnível — a trajetória acompanha o terreno e para no
 * primeiro bloqueio (ver docstring de `resolveAttackImpactPoint`). Vale pra QUALQUER
 * slot (mouse ou skill) — mecanismo genérico, sem branch nenhum por id/
 * grupo de efeito.
 *
 * **Config vem de `core/data/attacks/`, não mais inline na espécie**
 * (reorganização pedida pelo usuário — ver docs/features/025-ataque-
 * comum-de-criatura.md, seção "reorganização da config"):
 * `getSpecies(id).attacks.<slot>` é só uma REFERÊNCIA (string id, ou
 * `{ id, overrides }`); `resolveCreatureAttack` (`core/data/attacks/
 * index.js`) resolve a definição de verdade, mesclando overrides da
 * criatura por cima da base do ataque quando houver. Sem
 * `species.attacks.<slot>` configurado, ou id desconhecido, aquele slot
 * simplesmente não é candidato a disparar — mesmo fallback gracioso de
 * sempre (hoje só `primary` é universal; `secondary1` só as 3 espécies
 * iniciais configuram, `secondary2`/`secondary3` nenhuma ainda).
 *
 * **`duration`/`effectAt` do `primary` são dinâmicos, por ENTIDADE**
 * (`resolveAttackForEntity`, acima — ver docs/features/029-*.md):
 * antes, cada espécie calculava isso uma vez, no module load, com um
 * `iv` de `speed` fixo; agora que IV é sorteado por indivíduo
 * (`IndividualValues`, nunca mais um literal na espécie), esse cálculo
 * só pode acontecer aqui — duas criaturas da MESMA espécie, com
 * `speed` diferente, atacam em ritmos diferentes. Só pra `primary`;
 * skills (`secondary1-3`) mantêm `duration`/`effectAt` PRÓPRIOS da
 * definição do ataque.
 *
 * Mesmo mecanismo genérico de `ActionState` que dash/arremesso/uso/summon/
 * recall já usam: trava `current` no disparo, o efeito de verdade só
 * acontece no instante `effectAt`, e `current` volta a `null` em
 * `duration`. Não é dono de `'dash'`/`'throw'`/`'consume'`/`'summon'`/
 * `'recall'` — outros systems progridem essas; este só entende `'attack'`,
 * mesmo padrão de exclusão mútua já usado por `playerActionSystem.js`/
 * `partySummonSystem.js`. Isso também significa que os QUATRO slots
 * (mouse + Q/E/R) compartilham a MESMA `ActionState` — usar uma skill
 * (Q) trava o ataque do mouse até `duration` acabar, e vice-versa, mesma
 * exclusão mútua que dash/ataque já tinham entre si.
 *
 * `SummonedCreature` na query (não `resolveSpeciesKind`) — mesmo critério
 * já usado alhures pra "isto é uma criatura, não o treinador": só uma
 * `SummonedCreature` de verdade chega a ter
 * `InputControlled`+`ActionState`+`Position`+`Rotation` juntos por essa
 * via (o treinador nunca tem `SummonedCreature`). `attacks.<slot>` é
 * exclusivo de espécie `kind: 'pokemon'` (o treinador não tem — sem arma
 * direta no design, ver docs/backlog.md).
 *
 * **Indicador antes de lançar** (`attack.castMode`, por ataque): com
 * `'confirm'`, apertar o botão só abre o indicador (`AttackAim.slot`,
 * desenhado por `view/scene/AttackIndicatorView.jsx`); clique ou a mesma
 * tecla de novo lança, botão direito cancela, outra tecla de ataque troca
 * de indicador. Com `'instant'` (ou sem o campo), lança na hora. O modo
 * debug (F2) força `'confirm'` em todos via `context.settings.
 * castModeOverride` (`GameLoop.jsx`).
 *
 * **Dano** (docs/features/030-sistema-de-dano-de-ataques.md): no mesmo
 * instante `effectAt` em que o VFX nasce, `resolveAttackTarget` (acima)
 * acha a primeira `WildCreature` viva ao longo da trajetória do golpe,
 * no mesmo plano de combate e com alcance/raio medidos na horizontal
 * (combate 2.5D) e, se achar,
 * `resolveDamageAmount` (`core/battle/calculateDamage.js`) calcula o
 * dano a partir de `ATTACK.damage` (`power`/`category`/`type` —
 * `core/data/attacks/<id>/index.js`) e dos status de ambos
 * (`resolveCreatureStats`), aplicado via `applyDamage` (contrato único
 * de qualquer fonte de dano, `core/traits/components/vitals.js`). Sem
 * `ATTACK.damage` configurado (`null`), nenhum dano é calculado — mesmo
 * fallback gracioso de sempre. **Só `WildCreature` é alvo válido** hoje
 * (decisão consciente, não esquecimento — ver docstring de
 * `resolveAttackTarget`): sem IA de ataque selvagem, PvP ou conceito de
 * time/dono no ECS, não existe "fogo amigo" a evitar ainda.
 *
 * **Custa stamina** (`attack.staminaCost`): descontada uma vez no
 * disparo, não por segundo. Sem stamina suficiente, aquele slot
 * simplesmente não é candidato a disparar naquele tick (a próxima tecla
 * da lista ainda é tentada). Reseta `vitals.staminaRegenDelay` pro valor
 * da PRÓPRIA criatura (`staminaRegenDelayAfterUse`), mesmo princípio de
 * correr/pular/dash.
 *
 * **Cooldown** (`attack.cooldown`, segundos ALÉM da stamina —
 * `AttackCooldowns.<slot>`, `core/traits/components/attackEffect.js`):
 * decrementado TODO tick, POR SLOT, não só enquanto aquele slot está em
 * andamento — corre em paralelo a qualquer outra coisa que a criatura
 * esteja fazendo. Travado em `attack.cooldown` no disparo DAQUELE slot;
 * enquanto `> 0`, só aquele slot específico não dispara, mesmo com
 * stamina de sobra — os outros três continuam livres (pedido implícito
 * da 9ª rodada: skills de verdade configuram cooldown > 0, então um
 * campo único e compartilhado travaria o ataque do mouse pelo mesmo
 * tempo de usar uma skill, o que não faz sentido). `0` (padrão do ataque
 * comum) é um no-op — só stamina trava de verdade nesse caso.
 *
 * **Som do impacto**: `entity.add(AttackPulse)` no mesmo instante
 * `effectAt` em que o VFX nasce — pulso de um tick (`core/traits/
 * components/attackEffect.js`) consumido por `attackAudioSystem.js`
 * (view, fase presentation), mesmo mecanismo de `Jumped`/`SummonPulse`/
 * `RecallPulse`. Toca `attack.audio` (`core/data/audio/attackSound.js`)
 * — este system não sabe nada de áudio de verdade, só marca O INSTANTE.
 * **Limitação conhecida (9ª rodada)**: o pulso não carrega QUAL slot
 * disparou, e `attackAudioSystem.js`/`resolveAttackSound` ainda só
 * resolvem `attacks.primary` — uma skill nova (`vine-whip`/`ember`/
 * `whirlpool`, todas com `audio.group: null` de propósito) não tem som
 * PRÓPRIO ainda; até a rodada de áudio generalizar isso (quando o usuário
 * trouxer os arquivos), o pulso de uma skill só reaproveita o som que já
 * estiver registrado pro ataque comum da criatura, se houver.
 *
 * Headless. Fase: simulation, junto de `playerActionSystem`/
 * `partySummonSystem` (mesma família de "ações disparadas por input").
 */
export function creatureAttackSystem(context) {
  const { world, delta, events } = context
  const input = context.input ?? {}
  const castModeOverride = context.settings?.castModeOverride ?? null

  // 1. Cooldowns de TODO atacante (criatura do time ou selvagem) — correm
  // independente de qual ação está em andamento, antes de qualquer disparo.
  world.query(AttackCooldowns).updateEach(([cooldowns]) => {
    for (const { slot } of ATTACK_SLOTS) {
      if (cooldowns[slot] > 0) {
        cooldowns[slot] = Math.max(0, cooldowns[slot] - delta)
      }
    }
  })

  // 2. Disparo pelo input: a criatura que o jogador controla.
  world
    .query(
      InputControlled,
      SummonedCreature,
      ActionState,
      AttackCooldowns,
      AttackAim,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
      IndividualValues,
    )
    .updateEach(
      (
        [
          creature,
          action,
          cooldowns,
          aim,
          physicsBody,
          vitals,
          pos,
          rot,
          individualValues,
        ],
        entity,
      ) => {
        const castContext = {
          entity,
          world,
          species: getSpecies(creature.speciesId),
          individualValues,
          action,
          cooldowns,
          vitals,
          pos,
          rot,
          physicsBody,
        }

        // Botão direito cancela o indicador aberto (como no LoL).
        if (aim.slot && input.secondaryHeld) aim.slot = null

        if (aim.slot) {
          // Indicador aberto: clique ou a MESMA tecla de novo confirma.
          // Sem conseguir lançar agora (ocupado/cooldown/stamina), o
          // indicador continua aberto.
          if (input.primary || input[aim.slot]) {
            if (tryStartAttack(castContext, aim.slot)) aim.slot = null
          } else {
            handleAttackPress(castContext, aim, input, castModeOverride)
          }
        } else {
          handleAttackPress(castContext, aim, input, castModeOverride)
        }
      },
    )

  // 3. Disparo da IA: criatura (selvagem, ou do time fora do controle)
  // que pediu golpe (`WantsToAttack`, posto pelo `wildBehaviorSystem.js`/
  // `partyBehaviorSystem.js`) lança o ataque básico mirando no alvo do
  // pedido. Pedido que não dá pra atender agora (ocupada/stamina/
  // cooldown, alvo fora da luta) é descartado — o comportamento pede de
  // novo depois.
  const requested = []
  world
    .query(
      WantsToAttack,
      ActionState,
      AttackCooldowns,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
      IndividualValues,
    )
    .updateEach(
      (
        [
          request,
          action,
          cooldowns,
          physicsBody,
          vitals,
          pos,
          rot,
          individualValues,
        ],
        entity,
      ) => {
        requested.push(entity)
        const target = request.target
        if (!isActiveCombatant(target)) return
        const speciesId = resolveCreatureSpeciesId(entity)
        if (!speciesId) return

        const castContext = {
          entity,
          world,
          species: getSpecies(speciesId),
          individualValues,
          action,
          cooldowns,
          vitals,
          pos,
          rot,
          physicsBody,
        }
        tryStartAttack(
          castContext,
          'primary',
          resolveDirectionTo(pos, target.get(Position), rot),
        )
      },
    )
  // Fora do `updateEach`: remover trait muda a query iterada.
  for (const entity of requested) entity.remove(WantsToAttack)

  // 4. Avanço do golpe de TODO atacante: impacto no `effectAt`, fim em
  // `duration`. O golpe de uma criatura do time acerta selvagens; o de
  // uma selvagem acerta o lado do jogador (criaturas do time e treinador).
  world
    .query(
      ActionState,
      CharacterController,
      PhysicsBody,
      Position,
      IndividualValues,
    )
    .updateEach(
      ([action, controller, physicsBody, pos, individualValues], entity) => {
        if (action.current !== 'attack') return

        const species = getSpecies(resolveCreatureSpeciesId(entity))
        const targetSide = entity.has(WildCreature) ? 'player' : 'wild'
        const ATTACK = resolveAttackForEntity(
          species,
          action.pendingSlot,
          individualValues,
        )
        const previousElapsed = action.elapsed
        action.elapsed += delta

        if (
          previousElapsed < ATTACK.effectAt &&
          action.elapsed >= ATTACK.effectAt
        ) {
          // Trajetória do golpe: da origem (centro do corpo + altura
          // opcional da espécie, `resolveAttackOrigin`) por `range` metros
          // na horizontal travada no disparo (`action.dirX/dirZ`),
          // acompanhando o terreno e parando em parede/desnível
          // (`resolveAttackImpactPoint`, acima).
          const origin = resolveAttackOrigin(
            pos,
            species?.body?.attackOriginHeight,
          )
          const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
          const impactPoint = resolveAttackImpactPoint(
            origin,
            direction,
            ATTACK.range,
            physicsBody.colliderHandle,
          )
          // VFX orientado pela trajetória REAL (inclina junto numa rampa);
          // trajetória de comprimento ~0 (encostado na parede) usa a
          // direção travada.
          const path = {
            x: impactPoint.x - origin.x,
            y: impactPoint.y - origin.y,
            z: impactPoint.z - origin.z,
          }
          const pathLength = Math.hypot(path.x, path.y, path.z)
          const effectRotation = resolveEffectRotation(
            pathLength > 1e-6
              ? {
                  x: path.x / pathLength,
                  y: path.y / pathLength,
                  z: path.z / pathLength,
                }
              : direction,
            ATTACK.visual.rotationOffset,
          )

          // Dano — ver docstring acima ("Dano"). `ATTACK.damage: null`
          // (ataque ainda sem poder/categoria configurado) é um no-op
          // gracioso, sem procurar alvo nenhum.
          if (ATTACK.damage) {
            const target = resolveAttackTarget(
              world,
              origin,
              impactPoint,
              ATTACK.radius,
              resolveFootElevation(pos, controller),
              targetSide,
            )
            let amount = 0
            let critical = false
            if (target) {
              const resolved = resolveDamageAmount({
                attackerSpecies: species,
                attackerIndividualValues: individualValues,
                defenderSpecies: target.species,
                defenderIndividualValues: target.individualValues,
                damage: ATTACK.damage,
                rng: gameplayRng,
              })
              amount = resolved.amount
              critical = resolved.critical
              target.entity.set(
                Vitals,
                applyDamage(
                  target.vitals,
                  amount,
                  target.vitals.hpRegenDelayAfterDamage,
                ),
              )
            }

            // Impacto resolvido (acertou ou não) — efeitos de acerto
            // (brilho no alvo, número de dano, e no futuro hit stop/
            // reação/SFX/câmera) consomem isto, nunca leem o `Vitals`.
            events.emit(
              attackResolved({
                attacker: entity,
                target: target?.entity,
                attackId: ATTACK.id,
                slot: action.pendingSlot,
                origin,
                impactPoint,
                contactPoint: target?.contactPoint,
                damage: amount,
                critical,
              }),
            )
          }

          world.spawn(
            Position(impactPoint),
            Rotation(effectRotation),
            AttackEffect({
              lifetime: ATTACK.visual.effectVisualDuration,
              radius: ATTACK.radius,
              effectGroup:
                ATTACK.visual.effectGroup ?? DEFAULT_ATTACK_EFFECT_GROUP,
              revealDuration: ATTACK.visual.revealDuration ?? 0,
              visualScale: ATTACK.visual.scale ?? 1,
            }),
          )
          // Som do impacto (ver docstring acima, "Som do impacto") —
          // pulso de um tick na CRIATURA (não no `AttackEffect`),
          // consumido por `attackAudioSystem.js`. Sem `attack.audio`
          // resolvendo nada, o pulso simplesmente não tem ouvinte nenhum
          // (`useAnimatedModel.js` só registra o nó de áudio se
          // `resolveAttackSound` resolver algo) — no-op gracioso, mesmo
          // espírito de sempre.
          entity.add(AttackPulse)
        }

        if (action.elapsed >= ATTACK.duration) {
          action.current = null
          action.pendingSlot = null
          action.animationFrames = null
        }
      },
    )
}
