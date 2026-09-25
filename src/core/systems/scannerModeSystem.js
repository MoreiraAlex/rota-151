import { getItem } from '../data/items'
import { getPlayerSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { computeOrbitForward } from '../camera/orbitCamera'
import { castRay } from '../physics/raycast'
import { registrarScan } from '../actions/scanning'
import {
  HeldItem,
  InputControlled,
  OrbitCamera,
  PhysicsBody,
  Position,
  ScanMode,
  Scanned,
  SummonedCreature,
  Targeting,
  WildCreature,
} from '../traits'

/**
 * Acha a criatura (selvagem OU do time, ver docstring de `Targeting`,
 * `core/traits/components/targeting.js`) dona do collider atingido pelo
 * raycast — Rapier só devolve um HANDLE de collider (`hit.colliderHandle`,
 * ver `core/physics/raycast.js`), não a entidade koota; comparar contra
 * `PhysicsBody.colliderHandle` é o mesmo "de volta pra entidade" que o
 * resto do projeto ainda não precisava fazer (toda detecção de acerto
 * até agora — `resolveAttackImpactPoint`, `projectileSystem` — só usava
 * o PONTO de impacto, nunca precisou saber QUEM foi atingido).
 *
 * Duas queries em vez de uma só (`WildCreature`/`SummonedCreature` nunca
 * coexistem na mesma entidade) — poucas criaturas de cada vez no jogo
 * (o nível de teste tem só alguns selvagens, o time é só 3), então uma
 * busca linear é suficiente, sem precisar de um registro handle→entidade
 * dedicado.
 */
function resolveCreatureAt(world, colliderHandle) {
  const wild = world
    .query(WildCreature, PhysicsBody)
    .find((entity) => entity.get(PhysicsBody).colliderHandle === colliderHandle)
  if (wild) return wild

  return world
    .query(SummonedCreature, PhysicsBody)
    .find((entity) => entity.get(PhysicsBody).colliderHandle === colliderHandle)
}

/**
 * Olho/direção/alcance do raio do Scan — extraída do corpo do system
 * (era inline) e exportada pra `tools/debug/ScanRangeDebugView.jsx`
 * poder desenhar EXATAMENTE o mesmo raio usado pra detectar de verdade
 * (pedido do usuário: "quero que o valor usado pela visualização seja
 * exatamente o mesmo valor utilizado pela lógica real de alcance do
 * Scan", docs/features/033-*.md) — mesmo padrão de
 * `resolveAttackImpactPoint` (`creatureAttackSystem.js`), já reusada
 * por `AttackIndicatorView.jsx` pelo mesmo motivo. `item` pode ser
 * `null` (sem item scanner válido) — cai no alcance global
 * (`GAME_CONFIG.SCANNER.RANGE`), mesmo fallback de sempre.
 */
export function resolveScanRay(pos, rig, item) {
  const TARGET_HEIGHT =
    getPlayerSpecies().camera?.targetHeight ?? GAME_CONFIG.CAMERA.TARGET_HEIGHT
  const eye = { x: pos.x, y: pos.y + TARGET_HEIGHT, z: pos.z }
  const direction = computeOrbitForward(rig.get(OrbitCamera))
  const range = item?.scanner?.range ?? GAME_CONFIG.SCANNER.RANGE
  return { eye, direction, range }
}

/**
 * Liga/desliga o modo scanner, rastreia/confirma o alvo embaixo do
 * retículo e sinaliza a abertura do menu principal da Pokédex — pedido
 * do usuário: "verificar como os controles atuais tratam os cliques e
 * os estados de interface, evitando conflitos entre a navegação, o scan
 * e os menus" (ver docs/features/033-*.md, seção 1). Botão DIREITO
 * (`secondaryHeld`/`secondaryReleased`) é só do fluxo de scan (abrir/
 * fechar o visor, confirmar); botão ESQUERDO (`primary`) abre o menu
 * principal, e só faz isso — nunca confirma scan. Gatilho de categoria
 * (`item.category === 'scanner'`) — mesmo mecanismo de `core/data/items/
 * _template/index.js`, docs/features/031-*.md; `playerActionSystem.js`
 * já ignora `primary` pra item de categoria `scanner` (não é
 * `throwable`/`consumable`), então não existe conflito entre "abrir o
 * menu" e "arremessar/usar" no mesmo clique.
 *
 * **Botão direito é SEGURAR, não clicar (docs/features/033-*.md)** —
 * bug relatado pelo usuário, confirmado com log próprio: com o clique
 * de confirmação num SEGUNDO clique direito (versão anterior desta
 * rodada), `input.secondary` (pulso, borda de subida do `mousedown`)
 * nunca coincidia com "já estava ativo" de um jeito confiável na
 * prática — "o que podemos fazer, ao invés do modo scan ser por
 * clique, ele seja por holding, eu tenho que manter o clique enquanto
 * uso". Agora `ScanMode.active` reflete DIRETAMENTE
 * `input.secondaryHeld` (contínuo, true do `mousedown` até o
 * `mouseup` — ver `platform/input/pointerInput.js`) — sem toggle.
 *
 * **Confirmação virou clique esquerdo ENQUANTO segura o direito**
 * (ajuste do próprio usuário em cima da versão anterior, que confirmava
 * ao SOLTAR) — segurar o direito só abre/rastreia; um clique esquerdo
 * nesse meio tempo confirma o scan sem soltar o direito (a câmera
 * continua em primeira pessoa); soltar o direito, com ou sem ter
 * confirmado antes, sempre desliga o modo — nunca confirma de novo
 * (exige `input.primary` no mesmo tick, que soltar sozinho não tem).
 *
 * Três responsabilidades, todas do mesmo item equipado, por isso no
 * mesmo system (evita fontes de escrita competindo pelo mesmo
 * `ScanMode`):
 * 1. **Abrir o menu** (`primary`, só FORA do modo scanner — clicar
 *    esquerdo enquanto mira não teria como "sinalizar navegação" sem
 *    atrapalhar o visor) — incrementa `ScanMode.menuOpenRequests`
 *    (contador reativo, ver docstring do trait,
 *    `core/traits/components/scanMode.js`); `src/app/(auth)/page.js`
 *    observa a mudança e abre `PokedexMenu` na aba padrão.
 * 2. **Segurar liga + rastreia** (todo tick em que `secondaryHeld` é
 *    true, inclusive o primeiro) — `ScanMode.active` passa a `true` e
 *    faz o raycast na direção pura da câmera (`computeOrbitForward`,
 *    mesma conta que
 *    `cameraFollowSystem.js` usa pra POSICIONAR a câmera em primeira
 *    pessoa — aqui só a direção, sem tocar em nada visual, este system
 *    é headless) a partir dos "olhos" do treinador, até
 *    `item.scanner.range` (alcance por ITEM, sem esse campo no item,
 *    cai em `GAME_CONFIG.SCANNER.RANGE`), escreve `Targeting`. Sem nada
 *    no caminho dentro do alcance (ou o que tem não é criatura), limpa
 *    `Targeting` — o retículo (`PokedexVisorHud.jsx`) só mostra
 *    "travado" quando há alvo de verdade.
 * 3. **Confirmação** (`primary` + `secondaryHeld` no mesmo tick, com
 *    `wasActive` — ou seja, clique esquerdo enquanto já estava
 *    segurando o direito) — com `Targeting` válido e vivo, grava
 *    `Scanned` (frozen, ver docstring do trait) e registra o scan no
 *    treinador (`registrarScan`, `core/actions/scanning.js` — alimenta
 *    `PokedexEntries`/`ScanHistory`, ver docs/features/033-*.md). Não
 *    desliga `ScanMode.active` sozinha — quem desliga é `scan.active =
 *    held` (mais abaixo, todo tick), no tick em que o direito for
 *    solto de verdade.
 *
 * Headless. Fase: simulation, depois de `cameraControlSystem` (precisa
 * do `OrbitCamera.yaw/pitch` já atualizado neste tick) e antes de
 * `cameraFollowSystem` (presentation — só lê `ScanMode`, não depende de
 * `Targeting`/`Scanned`).
 */
export function scannerModeSystem(context) {
  const { world } = context
  const input = context.input ?? {}
  const rig = world.queryFirst(OrbitCamera)

  world
    .query(InputControlled, HeldItem, Position, PhysicsBody, ScanMode)
    .updateEach(([heldItem, pos, body, scan], entity) => {
      const item = heldItem.itemId ? getItem(heldItem.itemId) : null
      const isScanner = item?.category === 'scanner'

      if (!isScanner) {
        if (scan.active) scan.active = false
        return
      }

      const wasActive = scan.active
      const held = !!input.secondaryHeld

      if (input.primary && !held) scan.menuOpenRequests += 1

      scan.active = held

      if (held && rig) {
        const { eye, direction, range } = resolveScanRay(pos, rig, item)

        const hit = castRay(eye, direction, range, {
          excludeColliderHandle: body.colliderHandle,
        })
        const target = hit ? resolveCreatureAt(world, hit.colliderHandle) : null

        if (target) {
          entity.add(Targeting(target))
        } else {
          entity.remove(Targeting('*'))
        }
      }

      if (input.primary && input.secondaryHeld && wasActive) {
        // `confirmed` pode ser um entity id "morto" (`targetFor` não
        // valida vivacidade, ver docstring de `Targeting`) se a
        // criatura foi destruída ENQUANTO ainda era o alvo travado (ex.:
        // recolher uma criatura do time por Q/E/R no meio da mira) —
        // `.isAlive?.()` evita `registrarScan` ler trait de uma
        // entidade que não existe mais.
        const confirmed = entity.targetFor(Targeting)
        if (confirmed && confirmed.isAlive?.() !== false) {
          entity.add(Scanned(confirmed))
          registrarScan(entity, confirmed)
        }
        entity.remove(Targeting('*'))
      }
    })
}
