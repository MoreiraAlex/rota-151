import { getSpecies, getPlayerSpecies } from '../data/species'
import { resolveAimPoint, resolveHandOrigin } from '../aim'
import { destroyCharacterBody } from '../physics/colliders'
import {
  ActionState,
  InputControlled,
  Party,
  PhysicsBody,
  Position,
  RecallBeam,
  RecallPulse,
  Rotation,
  SummonBall,
  SummonedCreature,
  Velocity,
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
 * Se já existe uma `SummonBall` em voo pra este slot (ver
 * docs/features/024-esfera-de-invocar.md) — a criatura ainda não nasceu
 * (`findSummoned` não a acharia ainda), mas já tem uma esfera resolvendo
 * esse slot. Sem esta checagem, apertar `secondaryN` de novo assim que a
 * ação `summon` destrava (`duration`, que termina bem antes da esfera
 * pousar — a esfera pode levar bem mais tempo que o gesto) disparava uma
 * SEGUNDA esfera pro mesmo slot, resultando em duas criaturas nascendo da
 * mesma espécie/slot quando as duas pousassem.
 */
function hasPendingBall(world, slot) {
  return world
    .query(SummonBall)
    .some((entity) => entity.get(SummonBall).slot === slot)
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
 * trava a DIREÇÃO do arremesso no instante do disparo (`action.dirX/dirY/
 * dirZ`, vetor unitário 3D) pra reusar no instante de efeito
 * (`spawnSummonBall`, que mira a esfera nessa direção): a câmera é livre
 * pra girar durante a ação (nada trava o mouse enquanto summon/recall
 * estão em andamento, só o movimento do corpo — ver `movementSystem.js`),
 * então se a esfera recalculasse a direção de novo lá no efeito, poderia
 * divergir de pra onde o treinador acabou de virar no disparo.
 *
 * Mesmo mecanismo do arremesso (`playerActionSystem.js`, ver
 * docs/features/016-mira-e-arremesso.md) — não só o yaw da câmera, o
 * ponto de mira de VERDADE (`resolveAimPoint`, um raycast a partir da
 * câmera, que já respeita a inclinação/pitch, não só o giro horizontal)
 * menos a origem da mão (`resolveHandOrigin`, `core/aim.js` — mesma
 * aproximação de "mão" que o item arremessado usa, evita a esfera nascer
 * no centro do corpo). `body.colliderHandle` exclui a própria cápsula do
 * treinador do raycast de mira (mesmo motivo de `resolveAimPoint` em
 * `playerActionSystem.js`).
 */
function beginSummon(world, action, pos, rot, body, slot) {
  const SUMMON = getPlayerSpecies().actions.summon
  const handOrigin = resolveHandOrigin(pos, rot.y, SUMMON)
  const aimPoint = resolveAimPoint(world, pos, body.colliderHandle)

  action.current = 'summon'
  action.elapsed = 0
  action.pendingSlot = slot

  const dx = aimPoint.x - handOrigin.x
  const dy = aimPoint.y - handOrigin.y
  const dz = aimPoint.z - handOrigin.z
  const distance = Math.hypot(dx, dy, dz)

  if (distance === 0) {
    action.dirX = 0
    action.dirY = 0
    action.dirZ = 1
  } else {
    action.dirX = dx / distance
    action.dirY = dy / distance
    action.dirZ = dz / distance
  }

  // Encara a direção do lançamento (só o componente horizontal — o corpo
  // não inclina pra cima/baixo, só gira em Y), mesma convenção de
  // `resolveThrowLaunch`/`Rotation.y` no arremesso.
  rot.y = Math.atan2(action.dirX, action.dirZ)
}

/**
 * Efeito de `'recall'`, no instante `effectAt` — desfaz o corpo físico e
 * destrói a entidade. Spawna um `RecallBeam` (ver docs/features/024-
 * esfera-de-invocar.md — "o feixe de luz vermelha puxa a criatura de
 * volta pra dentro da esfera") indo da MÃO do treinador até onde a
 * criatura estava — não um ponto único; `RecallBeamView.jsx` desenha o
 * "raio" deformado entre os dois.
 *
 * A ponta de saída usa `resolveHandOrigin` (`core/aim.js`), mesmo
 * mecanismo do arremesso/da `SummonBall` — não a `Position` crua do
 * treinador (centro da cápsula), que faria o raio sair de dentro do
 * corpo em vez de "da mão". `rot.y` aqui já é o valor que `beginRecall`
 * girou pra encarar a CRIATURA (não a câmera) — a mão "aponta" pra ela.
 *
 * Guarda `speciesId` (lido de `SummonedCreature` ANTES de destruí-la,
 * linha abaixo) no `RecallBeam` — `RecallBeamView.jsx` usa isso pra
 * dimensionar o "envelope" genérico que cobre a criatura quando o feixe
 * chega nela.
 */
function applyRecall(world, pos, rot, slot) {
  const creature = findSummoned(world, slot)
  if (!creature) return

  const creaturePos = creature.get(Position)
  const { speciesId } = creature.get(SummonedCreature)
  const RECALL = getPlayerSpecies().actions.recall
  const handOrigin = resolveHandOrigin(pos, rot.y, RECALL)
  world.spawn(
    Position({ x: creaturePos.x, y: creaturePos.y, z: creaturePos.z }),
    Rotation,
    RecallBeam({
      lifetime: RECALL.beamDuration,
      fromX: handOrigin.x,
      fromY: handOrigin.y,
      fromZ: handOrigin.z,
      speciesId,
    }),
  )

  destroyCharacterBody(creature.get(PhysicsBody).bodyHandle)
  creature.destroy()
}

/**
 * Efeito de `'summon'`, no instante `effectAt` — não spawna mais a
 * criatura direto (ver docs/features/024-esfera-de-invocar.md): lança uma
 * `SummonBall` na direção travada no disparo (`dirX/dirY/dirZ`, vetor
 * unitário 3D — mesma direção que `beginSummon` já travava, agora só
 * reaproveitada pra mirar a esfera em vez de deslocar a criatura direto),
 * nascendo na mesma aproximação de "mão" do arremesso (`resolveHandOrigin`,
 * não o centro do corpo). A criatura só nasce de verdade quando a esfera
 * resolve — por toque em algo ou por esgotar `summonOffset` — em
 * `summonBallSystem.js` (que também aplica gravidade à esfera em voo,
 * `GAME_CONFIG.PHYSICS.GRAVITY` — mesma constante que o resto do jogo),
 * que é quem efetivamente monta a `SummonedCreature` (física, animação,
 * vitals — a mesma composição de traits que existia aqui antes da
 * esfera).
 */
function spawnSummonBall(world, pos, rot, dirX, dirY, dirZ, slot, speciesId) {
  const SUMMON = getPlayerSpecies().actions.summon
  const { summonOffset, summonBallSpeed } = getPlayerSpecies().party
  const spawnPosition = resolveHandOrigin(pos, rot.y, SUMMON)

  world.spawn(
    Position(spawnPosition),
    Rotation,
    Velocity({
      x: dirX * summonBallSpeed,
      y: dirY * summonBallSpeed,
      z: dirZ * summonBallSpeed,
    }),
    SummonBall({ slot, speciesId, maxDistance: summonOffset, traveled: 0 }),
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
 * invocar (`beginSummon`) gira pro componente horizontal de pra onde a
 * MIRA aponta de verdade — não só o yaw da câmera, o ponto resolvido por
 * `resolveAimPoint` (que já respeita a inclinação/pitch, ver
 * docs/features/024-esfera-de-invocar.md) — não existe criatura ainda pra
 * encarar, só o lugar onde uma vai aparecer; recolher (`beginRecall`)
 * gira pra encarar a CRIATURA de verdade, que já existe num lugar
 * concreto — não faz sentido usar a mira aí, o corpo vira pro que está
 * sendo recolhido.
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
 * Invocar não spawna mais a criatura direto no `effectAt` — lança uma
 * `SummonBall` (ver docs/features/024-esfera-de-invocar.md,
 * `spawnSummonBall`/`summonBallSystem.js`) na direção travada no disparo;
 * a criatura só nasce de verdade quando a esfera pousa (por toque em algo
 * ou por esgotar `party.summonOffset`, respeitado como distância MÁXIMA
 * de voo, não posição fixa). Recolher continua instantâneo no `effectAt`,
 * sem esfera — a criatura já existe num lugar concreto, não há "onde
 * pousar" pra resolver.
 *
 * Headless. Fase: simulation — antes de `summonBallSystem` (que precisa
 * da `SummonBall` já existir neste mesmo tick em que nasce, se o
 * `effectAt` cair no mesmo tick do disparo) e de `creatureFollowSystem`
 * (que precisa da `SummonedCreature` já ter sumido neste mesmo tick, no
 * caso do recall).
 */
export function partySummonSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}
  const { summon: SUMMON, recall: RECALL } = getPlayerSpecies().actions

  world
    .query(Party, Position, Rotation, ActionState, PhysicsBody)
    .updateEach(([party, pos, rot, action, body], entity) => {
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
            spawnSummonBall(
              world,
              pos,
              rot,
              action.dirX,
              action.dirY,
              action.dirZ,
              action.pendingSlot,
              party[action.pendingSlot],
            )
            // Sem SummonPulse aqui — a criatura (e o som que acompanha
            // ela nascer, ver view/systems/summonAudioSystem.js) só existe
            // de verdade quando a esfera pousa, em summonBallSystem.js.
          } else {
            applyRecall(world, pos, rot, action.pendingSlot)
            entity.add(RecallPulse)
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
        } else if (
          party[slot] &&
          getSpecies(party[slot]) &&
          !hasPendingBall(world, slot)
        ) {
          // Confere a espécie ANTES de travar a ação — espécie inválida
          // não deve nem começar a ocupar o treinador (mesmo padrão de
          // `playerActionSystem.js`: precondições checadas antes de
          // escrever `action.current`, não só no instante de efeito).
          // `hasPendingBall` evita uma SEGUNDA esfera pro mesmo slot
          // enquanto a primeira ainda está em voo (ver docstring dela).
          beginSummon(world, action, pos, rot, body, slot)
        }
        break // só um secondaryN processado por tick
      }
    })
}
