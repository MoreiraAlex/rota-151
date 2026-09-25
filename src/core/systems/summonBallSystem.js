import { GAME_CONFIG } from '../gameConfig'
import { castRay } from '../physics/raycast'
import { getSpecies, getPlayerSpecies } from '../data/species'
import { isPhysicsReady } from '../physics/physicsWorld'
import { createCharacterBody, verticalClearance } from '../physics/colliders'
import {
  ActionState,
  AnimationState,
  AttackCooldowns,
  CharacterController,
  HeldItem,
  IndividualValues,
  InputState,
  Mood,
  MovementStats,
  Party,
  PartyIndividualValues,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  ScanMode,
  SummonBall,
  SummonedCreature,
  SummonFlash,
  SummonPulse,
  Velocity,
  vitalsFromSpecies,
} from '../traits'

/**
 * Spawna a `SummonedCreature` de verdade (mesma composição de traits que
 * `applySummon` fazia antes da esfera existir — física, animação,
 * vitals, traits universais) na posição onde a esfera pousou. `species`
 * já vem resolvido de `resolveBall` (evita procurar a espécie duas vezes).
 *
 * `AttackCooldowns` — bug real, relatado jogando ("apertando Q depois de
 * assumir o controle... não acontece nada"): a 9ª rodada de
 * docs/features/025-ataque-comum-de-criatura.md generalizou
 * `creatureAttackSystem.js` pra exigir este trait na query, mas esqueceu
 * de adicioná-lo AQUI, no único lugar que spawna uma criatura de verdade
 * no jogo (os testes usam um helper próprio que já tinha sido
 * atualizado, por isso passavam). Sem o trait, a query nunca casava com
 * NENHUMA criatura real — não só a skill nova (Q), o ataque comum do
 * mouse também parou de disparar, só que ninguém tinha testado de novo
 * depois da mudança.
 *
 * `IndividualValues` — lê o IV já sorteado e CONGELADO pra este slot em
 * `trainer.get(PartyIndividualValues)` (`core/traits/components/
 * partyIndividualValues.js`), sorteado uma vez por `equiparCriatura`
 * (`core/actions/party.js`) quando a espécie entrou naquele slot — não
 * sorteia aqui, de novo, a cada invocação: a MESMA criatura do jogador
 * precisa ter o MESMO IV toda vez que sai da bola (pedido do usuário:
 * "congelado por criatura"), diferente da selvagem, que sorteia o
 * próprio no spawn (`wildCreatureSpawnSystem.js`). `vitalsFromSpecies`
 * recebe o mesmo `individualValues` — sem isso o HP/energy de spawn
 * ignoraria o IV de verdade desta criatura.
 */
function spawnCreature(
  world,
  trainer,
  slot,
  speciesId,
  species,
  spawnPosition,
) {
  const physicsBody = isPhysicsReady()
    ? createCharacterBody(spawnPosition, {
        radius: species.body.capsuleRadius,
        halfHeight: species.body.capsuleHalfHeight,
        axis: species.body.capsuleAxis,
      })
    : { bodyHandle: -1, colliderHandle: -1 }

  const individualValues = trainer?.get(PartyIndividualValues)?.[slot] ?? null

  world.spawn(
    Position(spawnPosition),
    Rotation,
    SummonedCreature({ slot, speciesId }),
    IndividualValues(individualValues ?? {}),
    AnimationState,
    ActionState,
    AttackCooldowns,
    Velocity,
    CharacterController(species.body),
    MovementStats(species.movement),
    vitalsFromSpecies(species, individualValues),
    PhysicsBody(physicsBody),
    PathState,
    InputState,
    HeldItem,
    Mood,
    ScanMode,
  )
}

/**
 * Resolve uma `SummonBall` que pousou (por toque OU por esgotar
 * `maxDistance`, ver docstring do trait): se o slot ainda estiver
 * equipado com a MESMA espécie que estava no disparo (o time pode ter
 * mudado enquanto a esfera voava — `InventoryPanel`, por exemplo — nesse
 * caso a esfera só some, sem efeito, mesmo espírito gracioso do
 * recolhimento automático), spawna a criatura ali, o clarão de abertura
 * (`SummonFlash` — "a esfera se abre com um clarão de luz e a criatura
 * aparece", ver docs/features/024-esfera-de-invocar.md) e dispara o pulso
 * de som (`SummonPulse`, na entidade que tem `Party` — sempre o
 * treinador).
 *
 * `touchedSurface` (true quando pousou por TOQUE — `hit` no raycast — não
 * quando pousou por esgotar `maxDistance` no ar): `pos` nesse caso é o
 * ponto exato onde o RAIO da esfera cruzou a superfície — o CENTRO da
 * cápsula da criatura, sem ajuste, nasceria exatamente ali, com metade do
 * corpo afundado dentro do chão/obstáculo (bug real, relatado jogando —
 * a esfera em si é um ponto sem volume pro raycast, mas a criatura que
 * nasce tem cápsula de verdade). Desloca a posição pra CIMA em
 * `verticalClearance` antes de criar o corpo físico, pra pousar a base
 * da cápsula na superfície, não o centro dela. Sem toque (pousou no ar,
 * por esgotar o orçamento de distância), não há superfície nenhuma pra
 * apoiar — nasce exatamente onde a esfera parou, sem ajuste.
 */
function resolveBall(world, trainer, ball, pos, touchedSurface) {
  const currentSpeciesId = trainer?.get(Party)?.[ball.slot]
  if (currentSpeciesId !== ball.speciesId) return

  const species = getSpecies(ball.speciesId)
  if (!species) return

  const spawnPosition = { x: pos.x, y: pos.y, z: pos.z }
  if (touchedSurface) {
    spawnPosition.y += verticalClearance(species.body)
  }

  spawnCreature(
    world,
    trainer,
    ball.slot,
    ball.speciesId,
    species,
    spawnPosition,
  )
  const { flashDuration } = getPlayerSpecies().actions.summon
  world.spawn(
    Position(spawnPosition),
    Rotation,
    SummonFlash({ lifetime: flashDuration }),
  )
  trainer?.add(SummonPulse)
}

/**
 * Move toda `SummonBall` (spawnada por `partySummonSystem` no `effectAt`
 * da ação `summon`, ver docs/features/024-esfera-de-invocar.md): integra
 * posição pela velocidade, com gravidade (`GAME_CONFIG.PHYSICS.GRAVITY`,
 * mesma constante que `characterPhysicsSystem.js` usa pro treinador/
 * criaturas — "o mínimo de física pra cair", pedido explícito do
 * usuário) — ao contrário de `Projectile` (`projectileSystem.js`), que é
 * reto de propósito. A esfera puxa `vel.y` pra baixo a cada tick, então a
 * trajetória curva sozinha em direção ao chão, sem esse system precisar
 * calcular uma parábola explicitamente — é só integração, igual o resto
 * do motor já faz pra personagens.
 *
 * Colisão por raycast varrido, mesma técnica de `projectileSystem.js` (do
 * `Position` atual pro `Position` que o próximo tick teria, não um
 * raycast pontual — uma esfera rápida o bastante atravessaria uma parede
 * fina sem isso; com a trajetória agora curva, o segmento varrido também
 * já reflete a curva deste tick, não uma linha reta desatualizada). Cada
 * tick anda no máximo `min(distância do segmento, maxDistance -
 * traveled)` — nunca ultrapassa o orçamento de distância (percorrida ao
 * longo do CAMINHO, não em linha reta da origem — continua válido com a
 * trajetória curva), então o caso "não tocou em nada" sempre pousa
 * exatamente quando o orçamento acaba, em vez de voar pra sempre caindo.
 *
 * Exclui a cápsula do treinador (achado por `Party` — não `InputControlled`,
 * a esfera parte dele mesmo que uma criatura esteja sendo pilotada no
 * momento, ver docs/features/018-troca-de-controle-treinador-criatura.md)
 * do raycast, mesmo motivo de `projectileSystem.js`: sem isso, uma esfera
 * nascendo perto do próprio corpo do treinador podia se autoacertar no
 * primeiro tick.
 *
 * Headless. Fase: simulation — antes de `creatureFollowSystem` (que
 * precisa da `SummonedCreature` já existir neste mesmo tick em que a
 * esfera resolve) e de `characterPhysicsSystem` (que precisa do corpo
 * físico já criado).
 */
export function summonBallSystem(context) {
  const { world, delta } = context

  const trainer = world.queryFirst(Party, PhysicsBody)
  const excludeColliderHandle = trainer?.get(PhysicsBody).colliderHandle

  world
    .query(SummonBall, Position, Velocity)
    .updateEach(([ball, pos, vel], entity) => {
      const remaining = ball.maxDistance - ball.traveled
      if (remaining <= 0) {
        resolveBall(world, trainer, ball, pos, false)
        entity.destroy()
        return
      }

      vel.y += GAME_CONFIG.PHYSICS.GRAVITY * delta

      const fullSegX = vel.x * delta
      const fullSegY = vel.y * delta
      const fullSegZ = vel.z * delta
      const fullSegLength = Math.hypot(fullSegX, fullSegY, fullSegZ)

      if (fullSegLength === 0) return

      const segLength = Math.min(fullSegLength, remaining)
      const dirX = fullSegX / fullSegLength
      const dirY = fullSegY / fullSegLength
      const dirZ = fullSegZ / fullSegLength

      const hit = castRay(pos, { x: dirX, y: dirY, z: dirZ }, segLength, {
        excludeColliderHandle,
      })

      if (hit) {
        pos.x = hit.point.x
        pos.y = hit.point.y
        pos.z = hit.point.z
        resolveBall(world, trainer, ball, pos, true)
        entity.destroy()
        return
      }

      pos.x += dirX * segLength
      pos.y += dirY * segLength
      pos.z += dirZ * segLength
      ball.traveled += segLength

      if (ball.traveled >= ball.maxDistance) {
        resolveBall(world, trainer, ball, pos, false)
        entity.destroy()
      }
    })
}
