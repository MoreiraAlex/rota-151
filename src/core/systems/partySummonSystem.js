import { getSpecies, getPlayerSpecies } from '../data/species'
import { resolveCameraYaw } from '../aim'
import { isPhysicsReady } from '../physics/physicsWorld'
import { createCharacterBody, destroyCharacterBody } from '../physics/colliders'
import {
  ActionState,
  AimAnchor,
  AnimationState,
  CharacterController,
  HeldItem,
  InputControlled,
  InputState,
  MovementStats,
  Party,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
  vitalsFromSpecies,
} from '../traits'

// Mapeia o pulso de input (`secondaryN`, ver docs/features/011-slots-de-
// acao.md) pro slot correspondente do time (`Party.slotN`).
const SLOTS = [
  { input: 'secondary1', slot: 'slot1' },
  { input: 'secondary2', slot: 'slot2' },
  { input: 'secondary3', slot: 'slot3' },
]

/**
 * Acha a `SummonedCreature` de um slot, se houver. Exportado — também usado
 * por `controlSwitchSystem.js` (docs/features/018-troca-de-controle-
 * treinador-criatura.md) pra achar o alvo de uma troca de controle.
 */
export function findSummoned(world, slot) {
  return world
    .query(SummonedCreature)
    .find((entity) => entity.get(SummonedCreature).slot === slot)
}

/**
 * Dispara a ação `'recall'` no `ActionState` do treinador — não recolhe
 * nada ainda (isso só acontece no instante de efeito, ver `applyRecall`),
 * só trava a ação e gira o treinador (`rot.y`) pra encarar a CRIATURA que
 * está sendo recolhida (`atan2` até a posição dela — mesma convenção de
 * "encarar uma direção" já usada no arremesso, `Rotation.y =
 * atan2(velocity...)`, ver docs/features/016-mira-e-arremesso.md).
 * Diferente de `beginSummon` (que gira pra onde a CÂMERA aponta, porque
 * ainda não existe criatura nenhuma pra encarar) — aqui a criatura já
 * existe, num lugar concreto, então faz sentido virar pra ELA, não pra
 * onde o mouse estava apontando.
 */
function beginRecall(world, action, pos, rot, slot) {
  action.current = 'recall'
  action.elapsed = 0
  action.pendingSlot = slot

  const creature = findSummoned(world, slot)
  if (creature) {
    const creaturePos = creature.get(Position)
    rot.y = Math.atan2(creaturePos.x - pos.x, creaturePos.z - pos.z)
  }
}

/**
 * Dispara a ação `'summon'` — mesma ideia de `beginRecall`, mas também
 * trava a DIREÇÃO da câmera no instante do disparo (`action.dirX/dirZ`,
 * vetor unitário) pra reusar no instante de efeito (`applySummon`): a
 * câmera é livre pra girar durante a ação (nada trava o mouse enquanto
 * summon/recall estão em andamento, só o movimento do corpo — ver
 * `movementSystem.js`), então se o spawn recalculasse a direção da câmera
 * de novo lá no efeito, poderia divergir de pra onde o treinador acabou
 * de virar no disparo.
 */
function beginSummon(world, action, rot, slot) {
  const cameraYaw = resolveCameraYaw(world)
  action.current = 'summon'
  action.elapsed = 0
  action.pendingSlot = slot
  action.dirX = Math.sin(cameraYaw)
  action.dirZ = Math.cos(cameraYaw)
  rot.y = cameraYaw
}

/** Efeito de `'recall'`, no instante `effectAt` — desfaz o corpo físico e destrói a entidade. */
function applyRecall(world, slot) {
  const creature = findSummoned(world, slot)
  if (!creature) return
  destroyCharacterBody(creature.get(PhysicsBody).bodyHandle)
  creature.destroy()
}

/**
 * Efeito de `'summon'`, no instante `effectAt` — spawna a
 * `SummonedCreature` de verdade, com física (`createCharacterBody`, ver
 * docstring do system) e os traits que `creatureFollowSystem`/
 * `characterPhysicsSystem`/`animationStateSystem` precisam. Posição vem
 * de `pos` (o treinador não se move durante a ação — `ActionState`
 * trava o movimento, ver `movementSystem.js`) deslocada por
 * `getPlayerSpecies().party.summonOffset` na direção travada no disparo
 * (`action.dirX/dirZ`).
 */
function applySummon(world, action, party, pos, slot) {
  const speciesId = party[slot]
  if (!speciesId) return
  const species = getSpecies(speciesId)
  if (!species) return

  const { summonOffset } = getPlayerSpecies().party
  const spawnPosition = {
    x: pos.x + action.dirX * summonOffset,
    y: pos.y,
    z: pos.z + action.dirZ * summonOffset,
  }

  const physicsBody = isPhysicsReady()
    ? createCharacterBody(spawnPosition, {
        radius: species.body.capsuleRadius,
        halfHeight: species.body.capsuleHalfHeight,
        axis: species.body.capsuleAxis,
      })
    : { bodyHandle: -1, colliderHandle: -1 }

  world.spawn(
    Position(spawnPosition),
    Rotation,
    SummonedCreature({ slot, speciesId }),
    AnimationState, // default { id: 'idle' } — animationStateSystem assume dali
    ActionState, // current sempre null — só pra entrar na query de animationStateSystem
    Velocity,
    CharacterController(species.body),
    MovementStats(species.movement),
    // Vitals de verdade agora (antes era `Vitals` cru, sempre default —
    // não copiava da espécie). Passou a importar de fato: correr/pular
    // controlando a criatura (feature 018) drena/regenera pelos números
    // DELA, não um valor global (`vitalsFromSpecies`, ver
    // core/traits/components/vitals.js).
    vitalsFromSpecies(species.vitals),
    PhysicsBody(physicsBody),
    PathState, // default vazio — creatureFollowSystem calcula no 1º tick
    // InputState/AimAnchor/HeldItem: sem uso real enquanto a criatura é IA —
    // só pra ela já caber nas queries de movementSystem/playerActionSystem/
    // aimAnchorSystem no instante em que ganhar `InputControlled` (troca de
    // controle, ver controlSwitchSystem.js e docs/features/018-troca-de-
    // controle-treinador-criatura.md). `HeldItem.itemId` nunca é setado pra
    // uma criatura, então arremesso/consumo caem sozinhos no `else { return
    // }` de playerActionSystem.js — viram no-op de graça, sem precisar
    // excluir nada explicitamente; dash não depende de item nenhum, já
    // funciona assim que `InputControlled` chegar. Mirar (AimAnchor.active)
    // é bloqueado à parte, em aimAnchorSystem.js — não é um dos verbos
    // permitidos controlando uma criatura.
    InputState,
    AimAnchor,
    HeldItem,
  )
}

/**
 * Invoca/recolhe a criatura de cada slot do time (`secondary1-3`, ver
 * docs/features/011-slots-de-acao.md) e recolhe automaticamente quem for
 * desequipado do time — ver docs/features/017-locomocao-e-recolhimento-
 * de-criaturas.md.
 *
 * A query principal NÃO exige mais `InputControlled` (só `Party`, que já é
 * exclusivo do treinador — nenhuma criatura tem esse trait) — o
 * recolhimento automático (slot esvaziado pelo `InventoryPanel`) precisa
 * rodar não importa quem esteja sendo pilotado no momento (ver
 * docs/features/018-troca-de-controle-treinador-criatura.md). Só a reação
 * a `secondaryN` (Q/E/R) fica de fato restrita a `entity.has(InputControlled)`
 * — enquanto uma criatura está no controle, essas teclas são reservadas
 * pras skills dela (futuro), não devem invocar/recolher por cima.
 *
 * Invocar/recolher são AÇÕES de verdade agora, com duração
 * (`getPlayerSpecies().actions.summon`/`recall`, ver docs/features/018-
 * troca-de-controle-treinador-criatura.md — exclusivo do treinador, só
 * ele invoca/recolhe) — mesmo mecanismo
 * genérico de `ActionState` que dash/arremesso/uso já usam
 * (`playerActionSystem.js`): travam `current` no disparo, o efeito de
 * verdade (spawnar/destruir a `SummonedCreature`) só acontece depois, no
 * instante `effectAt`, e `current` volta a `null` em `duration`. As duas
 * fontes que escrevem `ActionState` (este system e `playerActionSystem.js`)
 * só iniciam uma ação nova quando `current` já está `null` — então dash/
 * arremesso/uso e invocar/recolher nunca se sobrepõem: enquanto uma
 * criatura está sendo invocada/recolhida, nenhuma outra ação (nem outra
 * invocação) pode começar, e vice-versa. `playerActionSystem.js`
 * explicitamente ignora `current` 'summon'/'recall' (não é dono dessas
 * ações) — quem avança `elapsed` e aplica o efeito delas é só aqui.
 *
 * O treinador gira no disparo de ambas as ações, mas pra alvos diferentes:
 * invocar (`beginSummon`) gira pra onde a CÂMERA está apontando (pedido
 * explícito do usuário — antes nascia "onde o jogador estava apontado";
 * não existe criatura ainda pra encarar, só o lugar onde uma vai
 * aparecer); recolher (`beginRecall`) gira pra encarar a CRIATURA de
 * verdade, que já existe num lugar concreto — não faz sentido usar a
 * câmera aí, o corpo vira pro que está sendo recolhido.
 *
 * Duas fontes disparam `beginRecall`, a mesma função pras duas:
 * 1. **Automática**: pra toda `SummonedCreature` cujo `Party[slot]`
 *    esteja vazio agora (desequipado em qualquer lugar — hoje só o
 *    `InventoryPanel`, arrastar a criatura pra fora do slot) — invariante
 *    "nenhuma criatura invocada de um slot vazio", verificada só quando o
 *    treinador está livre (`current === null`, não interrompe uma ação
 *    já em andamento).
 * 2. **Manual, por `secondaryN`**: se já existe uma `SummonedCreature`
 *    daquele slot, recolhe. Senão, com uma espécie equipada, invoca.
 *    Só um `secondaryN` processado por tick (a ação em si já impede uma
 *    segunda começar antes da primeira terminar).
 *
 * A criatura invocada ganha física de verdade — `Velocity`,
 * `CharacterController(species.body)`, `MovementStats(species.movement)`,
 * `PhysicsBody` com handles reais de `createCharacterBody` (o corpo Rapier
 * é criado NA HORA, no instante de efeito — `physicsBootstrapSystem` só
 * roda uma vez, no início do jogo, e nunca alcança uma entidade spawnada
 * depois; sem física pronta ainda, os handles ficam no default `-1`,
 * mesmo comportamento gracioso do resto do motor) — e `Vitals`/
 * `ActionState` só pra entrar nas queries de
 * `characterPhysicsSystem`/`animationStateSystem` respectivamente. Mover
 * de verdade é o `creatureFollowSystem` (produz `Velocity`/`Rotation`) +
 * o pipeline físico compartilhado; animar é `animationStateSystem` +
 * `animationSystem` (view); renderizar é `CreatureView` (view) — nenhum
 * dos três precisou de mudança pra passar a processar criaturas, já eram
 * genéricos por trait.
 *
 * Headless. Fase: simulation — antes de `creatureFollowSystem` (que
 * precisa da `SummonedCreature` já existir/ter sumido neste mesmo tick) e
 * de `characterPhysicsSystem` (que precisa do corpo físico já criado).
 */
export function partySummonSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}
  const { summon: SUMMON, recall: RECALL } = getPlayerSpecies().actions

  world
    .query(Party, Position, Rotation, ActionState)
    .updateEach(([party, pos, rot, action], entity) => {
      // Recolhimento automático — só quando o treinador está livre (não
      // interrompe uma ação já em andamento). Só uma por tick: se sobrar
      // mais de um slot órfão, os próximos são pegos nos ticks seguintes,
      // um de cada vez (mesma trava de "uma ação por vez" do resto).
      if (action.current === null) {
        for (const slot of ['slot1', 'slot2', 'slot3']) {
          if (!party[slot] && findSummoned(world, slot)) {
            beginRecall(world, action, pos, rot, slot)
            break
          }
        }
      }

      // Progride uma ação summon/recall já em andamento (inclusive a que
      // acabou de começar acima, no mesmo tick — mesmo padrão de
      // `playerActionSystem.js`, uma ação já soma `delta` no próprio tick
      // do disparo).
      if (action.current === 'summon' || action.current === 'recall') {
        const cfg = action.current === 'summon' ? SUMMON : RECALL
        const previousElapsed = action.elapsed
        action.elapsed += delta

        if (previousElapsed < cfg.effectAt && action.elapsed >= cfg.effectAt) {
          if (action.current === 'summon') {
            applySummon(world, action, party, pos, action.pendingSlot)
          } else {
            applyRecall(world, action.pendingSlot)
          }
        }

        if (action.elapsed >= cfg.duration) {
          action.current = null
          action.pendingSlot = null
        }
        return
      }

      if (action.current !== null) return // ocupado com dash/arremesso/uso

      // secondaryN (Q/E/R) só invoca/recolhe enquanto o TREINADOR está no
      // controle — `context.input` é um snapshot global (único dispositivo
      // de input), então sem essa checagem a criatura controlada (ver
      // controlSwitchSystem.js) invocaria/recolheria o time por cima, e as
      // mesmas teclas viram skills dela no futuro (docs/features/018-troca-
      // de-controle-treinador-criatura.md). O recolhimento automático acima
      // não tem essa restrição — desequipar pelo InventoryPanel deve
      // recolher a criatura não importa quem esteja sendo pilotado.
      if (!entity.has(InputControlled)) return

      for (const { input: inputKey, slot } of SLOTS) {
        if (!input[inputKey]) continue

        if (findSummoned(world, slot)) {
          beginRecall(world, action, pos, rot, slot)
        } else if (party[slot] && getSpecies(party[slot])) {
          // Confere a espécie ANTES de travar a ação — espécie inválida
          // não deve nem começar a ocupar o treinador (mesmo padrão de
          // `playerActionSystem.js`: precondições checadas antes de
          // escrever `action.current`, não só no instante de efeito).
          beginSummon(world, action, rot, slot)
        }
        break // só um secondaryN processado por tick
      }
    })
}
