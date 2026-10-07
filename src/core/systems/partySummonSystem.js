import { getSpecies, getPlayerSpecies } from '../data/species'
import { resolveAimPoint, resolveHandOrigin } from '../aim'
import { GAME_CONFIG } from '../gameConfig'
import { destroyCharacterBody } from '../physics/colliders'
import { findOwnedCreature, hasOwnedBallInFlight } from '../actions/owner'
import { derrubarComida } from '../actions/eating'
import {
  findPartyPokemon,
  isPokemonFainted,
  resolvePokemonOf,
  resolvePokemonSpeciesId,
} from '../actions/pokemon'
import {
  ActionState,
  Fainted,
  InputControlled,
  OwnedBy,
  Party,
  PhysicsBody,
  Position,
  RecallBeam,
  RecallPulse,
  Rotation,
  StoredFaint,
  StoredVitals,
  SummonBall,
  SummonedCreature,
  SummonedFrom,
  Velocity,
  Vitals,
} from '../traits'

// Mapeia o pulso de input (`secondaryN`, ver docs/features/011-slots-de-
// acao.md) pro slot correspondente do time (`PartySlots`).
const SLOTS = [
  { input: 'secondary1', slot: 'slot1' },
  { input: 'secondary2', slot: 'slot2' },
  { input: 'secondary3', slot: 'slot3' },
]

/**
 * Se a criatura deste slot tem que ser recolhida sozinha: o Pokémon dela não
 * está mais neste slot (slot esvaziado, ou outro Pokémon no lugar —
 * docs/features/041-inventario-de-itens-e-pokemon.md), ou ela está desmaiada
 * no chão há pelo menos
 * `FAINT.PARTY_RECALL_DELAY` (docs/features/031-ia-de-combate-e-
 * desmaio.md — "pouco tempo depois tem que ser recolhida pelo trainer").
 */
function needsAutoRecall(trainer, slot, creature) {
  const pokemon = resolvePokemonOf(creature)
  if (!pokemon || findPartyPokemon(trainer, slot) !== pokemon) return true
  const fainted = creature.get(Fainted)
  return !!fainted && fainted.elapsed >= GAME_CONFIG.FAINT.PARTY_RECALL_DELAY
}

/**
 * O que apertar o botão do `slot` faz agora: `'recall'` (já tem criatura
 * em campo), `'summon'` (tem um Pokémon que pode sair) ou `null`.
 *
 * Pra invocar, confere a espécie ANTES de travar a ação — espécie inválida
 * não deve nem começar a ocupar o treinador (mesmo padrão de
 * `playerActionSystem.js`: precondições checadas antes de escrever
 * `action.current`, não só no instante de efeito). `hasOwnedBallInFlight`
 * evita uma SEGUNDA esfera pro mesmo slot enquanto a primeira ainda está em
 * voo — a esfera vive bem mais que o gesto (`duration`), e duas pousando
 * nasceriam duas criaturas do mesmo slot. Desmaiado (`StoredFaint`) não sai
 * da bola até reanimar.
 */
function resolveSlotCommand(world, trainer, slot) {
  if (findOwnedCreature(world, trainer, slot)) return 'recall'
  const pokemon = findPartyPokemon(trainer, slot)
  if (
    pokemon &&
    getSpecies(resolvePokemonSpeciesId(pokemon)) &&
    !hasOwnedBallInFlight(world, trainer, slot) &&
    !isPokemonFainted(pokemon)
  ) {
    return 'summon'
  }
  return null
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
function beginRecall(world, trainer, action, pos, rot, slot, duration) {
  action.current = 'recall'
  action.elapsed = 0
  action.pendingSlot = slot
  // Ver docstring de `ActionState.animationSpeed` — o clipe de recolher
  // toca nesta velocidade em vez de um `speed` fixo no JSON do clipe.
  action.animationSpeed = duration > 0 ? 1 / duration : 1

  const creature = findOwnedCreature(world, trainer, slot)
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
  // Ver docstring de `ActionState.animationSpeed` — o clipe de invocar
  // toca nesta velocidade em vez de um `speed` fixo no JSON do clipe.
  action.animationSpeed = SUMMON.duration > 0 ? 1 / SUMMON.duration : 1

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
 * Guarda no registro do Pokémon (`SummonedFrom`) como a criatura estava ao
 * ser recolhida: a vida (`StoredVitals`) e, se desmaiada, o que falta pra
 * reanimar (`StoredFaint`) — a entidade some, o registro continua.
 */
function storeOutOfField(creature) {
  const pokemon = resolvePokemonOf(creature)
  if (!pokemon) return

  const vitals = creature.get(Vitals)
  if (vitals) pokemon.set(StoredVitals, { vitals: { ...vitals } })

  const fainted = creature.get(Fainted)
  if (!fainted) return
  const timeLeft = Math.max(0, fainted.timeLeft)
  if (pokemon.has(StoredFaint)) pokemon.set(StoredFaint, { timeLeft })
  else pokemon.add(StoredFaint({ timeLeft }))
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
 *
 * A vida/energia dela e, se desmaiada, o que falta pra reanimar vão pro
 * registro do Pokémon (`storeOutOfField`) — a próxima invocação sai do
 * jeito que entrou (regenerando fora de campo enquanto isso,
 * `vitalsRegenSystem.js`), e desmaiado não pode ser invocado até reanimar
 * (`faintSystem.js`).
 */
function applyRecall(world, trainer, pos, rot, slot) {
  const creature = findOwnedCreature(world, trainer, slot)
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

  // Recolhida comendo: a fruta cai no chão (docs/features/042-itens-da-beta.md).
  derrubarComida(world, creature)
  storeOutOfField(creature)

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
function spawnSummonBall(
  world,
  trainer,
  pos,
  rot,
  dirX,
  dirY,
  dirZ,
  slot,
  pokemon,
) {
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
    SummonBall({
      slot,
      speciesId: resolvePokemonSpeciesId(pokemon),
      maxDistance: summonOffset,
      traveled: 0,
    }),
    // A criatura que nascer dela herda o dono e o registro
    // (`summonBallSystem.js`).
    OwnedBy(trainer),
    SummonedFrom(pokemon),
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
 * 1. **Automática**: pra toda `SummonedCreature` cujo Pokémon não está
 *    mais no slot dela (slot esvaziado ou ocupado por outro — hoje só o
 *    `InventoryPanel`) — invariante "a criatura em campo de um slot é a do
 *    Pokémon desse slot" — ou que esteja
 *    desmaiada há `FAINT.PARTY_RECALL_DELAY` (`needsAutoRecall`),
 *    verificada só quando o treinador está livre (`current === null`, não
 *    interrompe uma ação já em andamento).
 * 2. **Manual, por `secondaryN`**: se já existe uma `SummonedCreature`
 *    daquele slot, recolhe. Senão, com uma espécie equipada (e não desmaiada), invoca.
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
    // `Party` é tag (sem dados): não entra no array do `updateEach`.
    .updateEach(([pos, rot, action, body], entity) => {
      // Recolhimento automático — só quando o treinador está livre (não
      // interrompe uma ação já em andamento). Só uma por tick: se sobrar
      // mais de um slot órfão, os próximos são pegos nos ticks seguintes,
      // um de cada vez (mesma trava de "uma ação por vez" do resto).
      if (action.current === null) {
        for (const { slot } of SLOTS) {
          const creature = findOwnedCreature(world, entity, slot)
          if (creature && needsAutoRecall(entity, slot, creature)) {
            beginRecall(world, entity, action, pos, rot, slot, RECALL.duration)
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
              entity,
              pos,
              rot,
              action.dirX,
              action.dirY,
              action.dirZ,
              action.pendingSlot,
              findPartyPokemon(entity, action.pendingSlot),
            )
            // Sem SummonPulse aqui — a criatura (e o som que acompanha
            // ela nascer, ver view/systems/summonAudioSystem.js) só existe
            // de verdade quando a esfera pousa, em summonBallSystem.js.
          } else {
            applyRecall(world, entity, pos, rot, action.pendingSlot)
            entity.add(RecallPulse)
          }
        }

        if (action.elapsed >= cfg.duration) {
          action.current = null
          action.pendingSlot = null
        }
        return
      }

      // Ocupado com dash/arremesso/uso — ou comendo: invocar/recolher
      // espera acabar (docs/features/042-itens-da-beta.md).
      if (action.current !== null) return

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

        const command = resolveSlotCommand(world, entity, slot)
        if (command === 'recall') {
          beginRecall(world, entity, action, pos, rot, slot, RECALL.duration)
        } else if (command === 'summon') {
          beginSummon(world, action, pos, rot, body, slot)
        }
        break // só um secondaryN processado por tick
      }
    })
}
