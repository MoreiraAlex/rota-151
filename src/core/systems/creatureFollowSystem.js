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
 * Gira em direção ao próprio movimento (`atan2`, suavizado por
 * `turnSpeed`) — mesma fórmula de `movementSystem.js`. Parada (dentro de
 * `FOLLOW_MIN_DISTANCE`), não gira — congela na última direção.
 *
 * ## Evasão local (`MovementBlocked`)
 *
 * O heightmap não modela toda geometria física com 100% de fidelidade
 * (ex.: o vão embaixo de uma rampa tombada) — em vez de tentar prever
 * todo jeito possível de uma geometria futura enganar a grade, a criatura
 * reage a um sinal físico direto: `MovementBlocked`
 * (`characterPhysicsSystem.js`), presente quando o deslocamento de fato
 * aplicado no tick ANTERIOR ficou bem abaixo do que a `Velocity` pediu —
 * tem algo sólido na frente que o pathfinding não previu. Com a tag
 * presente: força um recálculo de caminho já no próximo tick
 * (`repathTimer = 0`, ignora o `REPATH_INTERVAL` normal) e, só NESTE
 * tick, ignora o waypoint e usa `castRay` (`core/physics/raycast.js`) nas
 * duas perpendiculares da direção travada — segue pela que tiver mais
 * espaço livre, deslizando de lado até destravar, em vez de continuar
 * empurrando reto contra o obstáculo. Autocorretivo: assim que o
 * deslocamento real voltar a bater com o pedido, a tag some e a criatura
 * volta a seguir o waypoint normalmente, sem precisar de temporizador de
 * "tentando há muito tempo". Ver docs/features/017-locomocao-e-
 * recolhimento-de-criaturas.md.
 *
 * Headless. Fase: simulation, antes de `characterPhysicsSystem` (que
 * integra a `Velocity` resultante contra o mundo).
 */
export function creatureFollowSystem(context) {
  const { world, delta } = context
  // Lido a cada tick pra manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  const { FOLLOW_MIN_DISTANCE, RUN_DISTANCE } = GAME_CONFIG.PARTY
  const {
    REPATH_INTERVAL,
    WAYPOINT_ARRIVAL_DISTANCE,
    AVOIDANCE_PROBE_DISTANCE,
  } = GAME_CONFIG.PATHFINDING

  const player = world.queryFirst(InputControlled, Position)
  if (!player) return
  const playerPos = player.get(Position)

  world
    .query(SummonedCreature, MovementStats, Velocity, Rotation, Position)
    .updateEach(([, stats, vel, rot, pos], entity) => {
      const dx = playerPos.x - pos.x
      const dz = playerPos.z - pos.z
      const distance = Math.hypot(dx, dz)

      if (distance <= FOLLOW_MIN_DISTANCE) {
        vel.x = 0
        vel.z = 0
        return
      }

      const isBlocked = entity.has(MovementBlocked)

      // `PathState` de propósito NÃO está na query acima — é AoS (ver
      // docstring do trait), e ler/escrever por `entity.get`/`entity.set`
      // enquanto o mesmo trait também está listado na query ativa faz a
      // escrita não persistir de verdade (bug real, achado rodando os
      // testes desta função: `repathTimer` voltava pra `0` todo tick em
      // vez de manter o valor setado). Mesmo padrão que `Inventory` já usa
      // em `playerActionSystem.js` — AoS lido/escrito por fora da query.
      const path = entity.get(PathState)
      let { waypoints, waypointIndex, repathTimer } = path
      repathTimer -= delta

      if (repathTimer <= 0) {
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

      // Travada: força recalcular já no próximo tick — se o A* tinha um
      // jeito melhor de chegar lá, reconsidera cedo em vez de esperar o
      // intervalo normal.
      entity.set(PathState, {
        waypoints,
        waypointIndex,
        repathTimer: isBlocked ? 0 : repathTimer,
      })

      let dirX = targetX - pos.x
      let dirZ = targetZ - pos.z
      let dirLength = Math.hypot(dirX, dirZ) || 1

      if (isBlocked) {
        const nx = dirX / dirLength
        const nz = dirZ / dirLength
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
        dirLength = 1
      }

      const speed = distance > RUN_DISTANCE ? stats.runSpeed : stats.walkSpeed
      vel.x = (dirX / dirLength) * speed
      vel.z = (dirZ / dirLength) * speed

      const facing = Math.atan2(vel.x, vel.z)
      rot.y = lerpAngle(rot.y, facing, stats.turnSpeed * delta)
    })
}
