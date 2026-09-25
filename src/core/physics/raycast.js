import { getRapier, getRapierWorld } from './physicsWorld'

/**
 * Raycast contra o mundo físico (chão/obstáculos/cápsulas) — usado tanto
 * pra mirar (`playerActionSystem`, a partir da câmera) quanto pra detectar
 * o impacto de um projétil em voo (`projectileSystem`).
 *
 * `direction` deve ser um vetor unitário — o `timeOfImpact` que o Rapier
 * devolve já é a distância real até o impacto nesse caso (ver docstring de
 * `Ray` do rapier3d-compat). `excludeColliderHandle` tira um collider
 * específico da consideração (ex.: a própria cápsula de quem está mirando,
 * pra não se autoacertar).
 *
 * Sem física carregada ainda (WASM não terminou, ou em teste headless sem
 * `initPhysics()`), devolve `null` — quem chama trata isso como "nada no
 * caminho", nunca como erro.
 *
 * Gotcha do Rapier (descoberto testando isolado): um collider recém-criado
 * só entra na consideração do `castRay` depois de pelo menos um
 * `world.step()` — a broad-phase que o raycast consulta só é construída no
 * step, não na criação do collider. Não é problema pro jogo real: quem
 * chama esta função (`playerActionSystem`/`projectileSystem`) roda todo
 * tick, sempre depois de já ter havido pelo menos um `physicsStepSystem`
 * anterior (o nível estático nunca se move, então a broad-phase "de um
 * tick atrás" continua válida pra ele) — só testes que criam collider e
 * chamam `castRay` na sequência, sem nunca ter dado `step()`, precisam
 * simular isso explicitamente (ver `raycast.test.js`).
 */
export function castRay(origin, direction, maxDistance, options = {}) {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  if (!RAPIER || !world || maxDistance <= 0) return null

  const { excludeColliderHandle, terrainOnly = false } = options
  const excludeCollider =
    excludeColliderHandle != null && excludeColliderHandle >= 0
      ? world.getCollider(excludeColliderHandle)
      : undefined
  // `terrainOnly`: só a geometria FIXA do nível (chão/obstáculos) — todo
  // personagem é corpo cinemático (`createCharacterBody`), então fica de
  // fora. Pra consultar a altura do terreno sem bater em criatura nenhuma.
  const filterFlags = terrainOnly
    ? RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC |
      RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC
    : undefined

  const ray = new RAPIER.Ray(origin, direction)
  const hit = world.castRay(
    ray,
    maxDistance,
    true,
    filterFlags,
    undefined,
    excludeCollider,
  )
  if (!hit) return null

  return {
    distance: hit.timeOfImpact,
    point: {
      x: origin.x + direction.x * hit.timeOfImpact,
      y: origin.y + direction.y * hit.timeOfImpact,
      z: origin.z + direction.z * hit.timeOfImpact,
    },
    // Handle do collider atingido (`hit.collider.handle`, Rapier) — quem
    // chama pode achar A ENTIDADE dona dele comparando contra
    // `PhysicsBody.colliderHandle` (ex.: `scannerModeSystem.js`, achar
    // qual criatura está embaixo do retículo). Sem uso até esta rodada —
    // `playerActionSystem`/`projectileSystem` só precisavam do ponto de
    // impacto, nunca de QUEM foi atingido.
    colliderHandle: hit.collider.handle,
  }
}
