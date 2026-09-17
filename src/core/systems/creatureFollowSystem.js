import { GAME_CONFIG } from '../gameConfig'
import { lerpAngle } from '../math'
import { findPath } from '../pathfinding'
import { castRay } from '../physics/raycast'
import {
  InputControlled,
  MovementBlocked,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Velocity,
} from '../traits'

/**
 * Toda `SummonedCreature` anda em direção à posição do treinador — decidido
 * em docs/features/013-criaturas-de-time.md ("segue o jogador"). Acha o
 * treinador via `InputControlled` (não um singleton importado), mesma
 * técnica que qualquer system headless já usa pra achar "o jogador" —
 * funciona igual em teste (`makeWorld`) e no jogo real.
 *
 * Produz `Velocity`/`Rotation` (intenção) em vez de mexer em `Position`
 * direto — mesmo desenho de `movementSystem.js` pro jogador. Quem de fato
 * move `Position` é o pipeline físico compartilhado
 * (`characterPhysicsSystem` → `physicsStepSystem` → `syncPhysicsSystem`,
 * já registrados nessa ordem em `registerSystems.js`) — dá colisão de
 * verdade contra o mundo de graça, e a `Velocity` resultante já alimenta
 * `animationStateSystem` (idle/walk/run a partir da velocidade, sem
 * mudança nenhuma lá).
 *
 * Desde que a criatura ganhou física de verdade (docs/features/017-
 * locomocao-e-recolhimento-de-criaturas.md), ir direto em linha reta até o
 * treinador faz ela esbarrar/deslizar contra paredes e obstáculos em vez
 * de contornar. A direção de movimento agora vem de `core/pathfinding.js`
 * (A* numa grade baqueada de `TEST_LEVEL`, ver docstring de lá) — o
 * caminho calculado fica cacheado em `PathState` (trait AoS própria da
 * criatura) e só é recalculado a cada `PATHFINDING.REPATH_INTERVAL`
 * segundos (`repathTimer`), não todo tick: a grade não muda, o treinador
 * não anda tão rápido a ponto de precisar de um caminho nervoso, e
 * recalcular menos evita zigue-zague na trajetória. Sem waypoints (nenhum
 * obstáculo relevante no meio, ou nenhum caminho encontrado) cai de volta
 * na linha reta até o treinador — mesmo fallback gracioso usado no resto
 * do motor quando um recurso não está disponível.
 *
 * Velocidade vem de `MovementStats` da própria criatura (por espécie, ver
 * `core/data/species/<id>/index.js`), não de um valor global único: dentro
 * de `FOLLOW_MIN_DISTANCE`, parada; além de `RUN_DISTANCE`, corre
 * (`runSpeed`) pra alcançar; entre os dois, anda (`walkSpeed`) — é essa
 * transição de velocidade que dá o walk/run de verdade (`animationStateSystem`
 * já decide o clipe a partir de `WALK_MIN_SPEED`/`RUN_MIN_SPEED`, sem
 * precisar de um limiar próprio aqui). A decisão anda/corre usa a
 * distância até o TREINADOR, não até o waypoint atual — só a direção do
 * movimento muda com o pathfinding, o ritmo de aproximação continua igual
 * ao de antes.
 *
 * ## `Velocity` segue `Rotation`, não o contrário
 *
 * O destino muda com frequência — o treinador anda, o caminho recalcula
 * (`PATHFINDING.REPATH_INTERVAL`), o waypoint atual é alcançado — e cada
 * troca podia mudar a direção alvo (`atan2` do waypoint/repulsão) de um
 * jeito abrupto de um tick pro outro. Antes, `Velocity` virava direto pra
 * essa direção NOVA (instantânea) e só a `Rotation` visual é que suavizava
 * atrás (`lerpAngle`/`turnSpeed`) — dava pra ver o corpo apontando um
 * jeito enquanto já se movia por outro, e a troca abrupta de `Velocity`
 * contra a física (KCC) podia parecer uma travada (bug real, relatado
 * jogando). Agora é ao contrário: só a `Rotation` gira suavemente rumo à
 * direção alvo (`lerpAngle`/`turnSpeed`, mesma fórmula de
 * `movementSystem.js`), e `Velocity` é DERIVADA da `Rotation` já suavizada
 * (`sin`/`cos` dela vezes a velocidade) — a criatura sempre se move pra
 * onde já está de fato encarando, então mudar de destino faz ela curvar
 * gradualmente pra lá em vez de virar/deslizar de repente. Em regime
 * (perseguindo o mesmo alvo por um tempo, `Rotation` já convergiu),
 * o resultado é idêntico a antes — só a TRANSIÇÃO fica suave.
 *
 * Parada (dentro de `FOLLOW_MIN_DISTANCE` e sem ninguém perto, ver
 * "Evasão entre personagens" abaixo), não gira — congela na última
 * direção.
 *
 * ## Evasão entre personagens
 *
 * Personagens colidem fisicamente de verdade entre si (`characterPhysicsSystem.js`
 * não filtra outros personagens — pedido explícito do usuário: não se
 * atravessam). Sem mais nada, isso faria criaturas se esbarrarem/
 * empurrarem ao convergir todas pro treinador — em vez disso, cada
 * criatura soma um vetor de REPULSÃO de qualquer outro personagem
 * (treinador ou outra criatura) mais perto que `PARTY.AVOIDANCE_RADIUS`
 * (mais forte quanto mais perto) na direção de movimento ANTES de virar
 * `Velocity`, desviando proativamente do caminho de quem está por perto em
 * vez de precisar esbarrar de verdade pra reagir. Mesmo dentro de
 * `FOLLOW_MIN_DISTANCE` (perto o bastante do treinador pra "chegar"), uma
 * criatura ainda usa só a repulsão (sem perseguir mais o treinador) se
 * outro personagem estiver perto demais — sem isso, duas criaturas
 * "estacionadas" na mesma distância do treinador podiam acabar sobrepostas
 * sem nenhuma delas se mexer pra desfazer isso.
 *
 * ## Evasão local (`MovementBlocked`)
 *
 * O heightmap não modela toda geometria física com 100% de fidelidade
 * (ex.: o vão embaixo de uma rampa tombada) — em vez de tentar prever
 * todo jeito possível de uma geometria futura enganar a grade, a criatura
 * reage a um sinal físico direto: `MovementBlocked`
 * (`characterPhysicsSystem.js`), presente quando o deslocamento de fato
 * aplicado no tick ANTERIOR ficou bem abaixo do que a `Velocity` pediu —
 * tem algo sólido na frente que o pathfinding não previu. Na BORDA DE
 * SUBIDA da tag (ficou travada agora, não já estava — `PathState.
 * wasBlocked`), força um recálculo de caminho já no próximo tick
 * (`repathTimer = 0`, ignora o `REPATH_INTERVAL` normal) — só uma vez por
 * episódio de bloqueio, não todo tick enquanto a tag persiste (refazer o
 * A* com `grid.clone()` 60x/s seria puro desperdício, achado no code
 * review desta feature). Enquanto travada, ignora o waypoint e usa
 * `castRay` (`core/physics/raycast.js`) nas duas perpendiculares da
 * direção travada — segue pela que tiver mais espaço livre, deslizando de
 * lado até destravar, em vez de continuar empurrando reto contra o
 * obstáculo. Autocorretivo: assim que o deslocamento real voltar a bater
 * com o pedido, a tag some e a criatura volta a seguir o waypoint
 * normalmente. Ver docs/features/017-locomocao-e-recolhimento-de-
 * criaturas.md.
 *
 * Headless. Fase: simulation, antes de `characterPhysicsSystem` (que
 * integra a `Velocity` resultante contra o mundo).
 */
export function creatureFollowSystem(context) {
  const { world, delta } = context
  // Lido a cada tick pra manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  const {
    FOLLOW_MIN_DISTANCE,
    RUN_DISTANCE,
    AVOIDANCE_RADIUS,
    AVOIDANCE_STRENGTH,
  } = GAME_CONFIG.PARTY
  const {
    REPATH_INTERVAL,
    WAYPOINT_ARRIVAL_DISTANCE,
    AVOIDANCE_PROBE_DISTANCE,
  } = GAME_CONFIG.PATHFINDING

  const player = world.queryFirst(InputControlled, Position)
  if (!player) return
  const playerPos = player.get(Position)

  // Todo personagem (treinador + toda SummonedCreature), lido uma vez por
  // tick — usado pela evasão entre personagens abaixo pra achar quem está
  // perto de cada criatura. Leitura simples (nunca escrita por aqui), então
  // `entity.get(Position)` fora da query principal é seguro (a ressalva de
  // SoA/query ativa é só sobre ESCRITA não persistir, ver docstring de
  // `PathState` mais abaixo).
  const others = [
    { entity: player, pos: playerPos },
    ...world
      .query(SummonedCreature, Position)
      .map((e) => ({ entity: e, pos: e.get(Position) })),
  ]

  world
    .query(SummonedCreature, MovementStats, Velocity, Rotation, Position)
    .updateEach(([, stats, vel, rot, pos], entity) => {
      const dx = playerPos.x - pos.x
      const dz = playerPos.z - pos.z
      const distance = Math.hypot(dx, dz)

      // Repulsão de qualquer outro personagem mais perto que
      // AVOIDANCE_RADIUS — soma um vetor por vizinho próximo, mais forte
      // quanto mais perto (0 na borda do raio, 1 encostado).
      let avoidX = 0
      let avoidZ = 0
      for (const other of others) {
        if (other.entity === entity) continue
        const ox = pos.x - other.pos.x
        const oz = pos.z - other.pos.z
        const oDist = Math.hypot(ox, oz)
        if (oDist > 0 && oDist < AVOIDANCE_RADIUS) {
          const push = (AVOIDANCE_RADIUS - oDist) / AVOIDANCE_RADIUS
          avoidX += (ox / oDist) * push
          avoidZ += (oz / oDist) * push
        }
      }
      const isCrowded = avoidX !== 0 || avoidZ !== 0

      if (distance <= FOLLOW_MIN_DISTANCE && !isCrowded) {
        vel.x = 0
        vel.z = 0
        return
      }

      let dirX
      let dirZ
      let speed

      if (distance <= FOLLOW_MIN_DISTANCE) {
        // Perto o bastante do treinador pra "chegar", mas outro
        // personagem está perto demais — só desvia, sem perseguir mais o
        // treinador (já não precisa).
        dirX = avoidX
        dirZ = avoidZ
        speed = stats.walkSpeed
      } else {
        const isBlocked = entity.has(MovementBlocked)

        // `PathState` de propósito NÃO está na query acima — é AoS (ver
        // docstring do trait), e ler/escrever por `entity.get`/`entity.set`
        // enquanto o mesmo trait também está listado na query ativa faz a
        // escrita não persistir de verdade (bug real, achado rodando os
        // testes desta função: `repathTimer` voltava pra `0` todo tick em
        // vez de manter o valor setado). Mesmo padrão que `Inventory` já
        // usa em `playerActionSystem.js` — AoS lido/escrito por fora da
        // query.
        const path = entity.get(PathState)
        let { waypoints, waypointIndex, repathTimer, wasBlocked } = path
        repathTimer -= delta

        const blockedRisingEdge = isBlocked && !wasBlocked
        if (repathTimer <= 0 || blockedRisingEdge) {
          waypoints = findPath(pos, playerPos)
          waypointIndex = 0
          repathTimer = REPATH_INTERVAL
        }

        let targetX = playerPos.x
        let targetZ = playerPos.z
        if (waypointIndex < waypoints.length) {
          const waypoint = waypoints[waypointIndex]
          if (
            Math.hypot(waypoint.x - pos.x, waypoint.z - pos.z) <=
            WAYPOINT_ARRIVAL_DISTANCE
          ) {
            waypointIndex += 1
          }
          if (waypointIndex < waypoints.length) {
            targetX = waypoints[waypointIndex].x
            targetZ = waypoints[waypointIndex].z
          }
        }

        entity.set(PathState, {
          waypoints,
          waypointIndex,
          repathTimer,
          wasBlocked: isBlocked,
        })

        const baseDirX = targetX - pos.x
        const baseDirZ = targetZ - pos.z
        const baseLength = Math.hypot(baseDirX, baseDirZ) || 1

        if (isBlocked) {
          const nx = baseDirX / baseLength
          const nz = baseDirZ / baseLength
          const { colliderHandle } = entity.get(PhysicsBody)
          const origin = { x: pos.x, y: pos.y, z: pos.z }
          const probe = (dx2, dz2) => {
            const hit = castRay(
              origin,
              { x: dx2, y: 0, z: dz2 },
              AVOIDANCE_PROBE_DISTANCE,
              {
                excludeColliderHandle: colliderHandle,
              },
            )
            return hit ? hit.distance : AVOIDANCE_PROBE_DISTANCE
          }
          const left = { x: -nz, z: nx }
          const right = { x: nz, z: -nx }
          const chosen =
            probe(left.x, left.z) >= probe(right.x, right.z) ? left : right
          dirX = chosen.x
          dirZ = chosen.z
        } else if (isCrowded) {
          // Mistura a repulsão na direção principal (já normalizada) —
          // desvia proativamente de quem está perto em vez de esperar
          // esbarrar de verdade pra reagir.
          dirX = baseDirX / baseLength + avoidX * AVOIDANCE_STRENGTH
          dirZ = baseDirZ / baseLength + avoidZ * AVOIDANCE_STRENGTH
        } else {
          dirX = baseDirX
          dirZ = baseDirZ
        }

        speed = distance > RUN_DISTANCE ? stats.runSpeed : stats.walkSpeed
      }

      const dirLength = Math.hypot(dirX, dirZ) || 1
      const facing = Math.atan2(dirX / dirLength, dirZ / dirLength)
      rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)

      // Velocity SEGUE a Rotation já suavizada (não o contrário) — ver
      // docstring da função ("Velocity segue Rotation, não o contrário").
      // Mudar de destino de repente só muda PRA ONDE a criatura está
      // girando, não teleporta a direção de movimento em si.
      vel.x = Math.sin(rot.y) * speed
      vel.z = Math.cos(rot.y) * speed
    })
}
