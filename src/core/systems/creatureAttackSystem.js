import { resolveAimDirection } from '../aim'
import { getSpecies } from '../data/species'
import { resolveCreatureAttack } from '../data/attacks'
import { castRay } from '../physics/raycast'
import {
  ActionState,
  AttackCooldowns,
  AttackEffect,
  AttackPulse,
  CharacterController,
  DEFAULT_ATTACK_EFFECT_GROUP,
  InputControlled,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Vitals,
} from '../traits'

const DEG_TO_RAD = Math.PI / 180

/**
 * Resolve o ponto de impacto de verdade — `origin + direction * range`, OU
 * o ponto de colisão mais próximo no caminho até lá (`castRay`), o que vier
 * primeiro. Pedido explícito do usuário: um `range` grande (simulando o
 * alcance de um chicote, por exemplo) não pode "teleportar" o efeito
 * atravessando parede/obstáculo no meio do caminho — o ataque precisa
 * respeitar o TRAJETO, não só o destino final. Mesmo raciocínio de
 * `resolveAimPoint` (`core/aim.js`, arremesso do treinador), só que sem o
 * `aimRange`/lógica exclusiva de treinador — aqui `range` já vem
 * resolvido por quem chama.
 *
 * Exportada — `AttackRangeDebugView.jsx` reusa a MESMA fórmula pro guia de
 * debug mostrar onde o golpe vai acertar de VERDADE (já considerando
 * obstáculo no caminho), não um destino desatualizado que ignoraria a
 * mesma parede que o ataque de verdade vai respeitar.
 *
 * Sem física carregada ainda (`castRay` sempre `null`), cai no ponto
 * cheio — mesmo fallback gracioso de `resolveAimPoint`.
 */
export function resolveAttackImpactPoint(
  origin,
  direction,
  range,
  excludeColliderHandle,
) {
  const hit = castRay(origin, direction, range, { excludeColliderHandle })
  if (hit) return hit.point

  return {
    x: origin.x + direction.x * range,
    y: origin.y + direction.y * range,
    z: origin.z + direction.z * range,
  }
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
 * Dispara e avança o ataque/skill de uma criatura controlada — botão
 * ESQUERDO do mouse (`primary`, ataque comum) OU Q/E/R (`secondary1-3`,
 * skills — a partir da 9ª rodada de docs/features/025-ataque-comum-de-
 * criatura.md: "pode fazer as habilidades agora?"), sem precisar segurar
 * o botão direito (`input.aiming`) — diferente do arremesso do
 * treinador, a criatura não mira com âncora (`aimAnchorSystem.js`
 * continua ignorando `SummonedCreature`), mas o golpe em si respeita pra
 * onde a CÂMERA aponta (`resolveAimDirection`, `core/aim.js` — já com a
 * inclinação/pitch, não só o giro horizontal). Trava o corpo (`rot.y`, só
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
 * obstáculo — um raycast (`castRay`) do corpo até `range` metros na
 * direção resolvida para no primeiro toque, exatamente como
 * `resolveAimPoint` já faz pro arremesso do treinador. Vale pra QUALQUER
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
 * que `aimAnchorSystem.js` já usa pra "isto é uma criatura, não o
 * treinador": só uma `SummonedCreature` de verdade chega a ter
 * `InputControlled`+`ActionState`+`Position`+`Rotation` juntos por essa
 * via (o treinador nunca tem `SummonedCreature`). `attacks.<slot>` é
 * exclusivo de espécie `kind: 'pokemon'` (o treinador não tem — sem arma
 * direta no design, ver docs/backlog.md).
 *
 * **Sem dano/detecção de acerto nesta feature** — só o mecanismo de ação,
 * o VFX (`AttackEffect`/`AttackEffectView.jsx`, escolhido por
 * `attack.visual.effectGroup`) e a visualização de debug do alcance/área
 * (`AttackRangeDebugView.jsx`). Aplicar dano de verdade a um alvo dentro
 * da área é trabalho futuro (`attack.damage`, hoje sempre `null`), quando
 * o sistema de batalha for desenhado.
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
  const { world, delta } = context
  const input = context.input ?? {}

  world
    .query(
      InputControlled,
      SummonedCreature,
      ActionState,
      AttackCooldowns,
      CharacterController,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
    )
    .updateEach(
      (
        [
          creature,
          action,
          cooldowns,
          controller,
          physicsBody,
          vitals,
          pos,
          rot,
        ],
        entity,
      ) => {
        // Cooldown de cada slot corre INDEPENDENTE de qual ação está em
        // andamento (ou se nenhuma está), e independente um do outro —
        // por isso decrementados aqui, antes de qualquer guard clause
        // abaixo, um de cada vez.
        for (const { slot } of ATTACK_SLOTS) {
          if (cooldowns[slot] > 0) {
            cooldowns[slot] = Math.max(0, cooldowns[slot] - delta)
          }
        }

        if (action.current === null) {
          for (const { input: inputKey, slot } of ATTACK_SLOTS) {
            if (!input[inputKey]) continue

            const CANDIDATE = resolveCreatureAttack(
              getSpecies(creature.speciesId)?.attacks?.[slot],
            )
            if (!CANDIDATE) continue
            if (vitals.stamina < CANDIDATE.staminaCost) continue
            if (cooldowns[slot] > 0) continue

            action.current = 'attack'
            action.pendingSlot = slot
            action.elapsed = 0
            // Ver docstring de `ActionState.animationSpeed` —
            // `animationSystem.js` toca o clipe de ataque nesta
            // velocidade em vez de um `speed` fixo no JSON, então o
            // gesto sempre cabe exatamente em `CANDIDATE.duration`.
            action.animationSpeed =
              CANDIDATE.duration > 0 ? 1 / CANDIDATE.duration : 1
            vitals.stamina -= CANDIDATE.staminaCost
            vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
            cooldowns[slot] = CANDIDATE.cooldown

            // Altura do "olho" pra esta ESPÉCIE (docs/features/026-camera-
            // por-especie.md) — sem isso, a direção do golpe seria
            // calculada como se toda criatura tivesse a altura do
            // treinador (default global), errado pra corpo pequeno/
            // quadrúpede.
            const targetHeight = getSpecies(creature.speciesId)?.camera
              ?.targetHeight
            const direction = resolveAimDirection(
              world,
              pos,
              physicsBody.colliderHandle,
              targetHeight,
            )
            action.dirX = direction.x
            action.dirY = direction.y
            action.dirZ = direction.z
            // Encara o componente horizontal de pra onde a câmera aponta —
            // mesma convenção de `resolveThrowLaunch`/`beginSummon` (o corpo
            // só gira em Y, não inclina pra cima/baixo).
            rot.y = Math.atan2(direction.x, direction.z)
            break // só um slot processado por tick
          }
        }

        if (action.current !== 'attack') return

        const ATTACK = resolveCreatureAttack(
          getSpecies(creature.speciesId)?.attacks?.[action.pendingSlot],
        )
        const previousElapsed = action.elapsed
        action.elapsed += delta

        if (
          previousElapsed < ATTACK.effectAt &&
          action.elapsed >= ATTACK.effectAt
        ) {
          // Centro da área efetiva: `range` metros na direção do golpe
          // (`action.dirX/dirY/dirZ`, travada no disparo — 3D completo,
          // inclui a altura), a partir da altura aproximada do meio do
          // corpo (`CharacterController`, já copiado da espécie no spawn —
          // mesma cápsula que `DebugPanel.jsx` usa pra "altura total") —
          // MENOS que algo esteja no caminho antes disso
          // (`resolveAttackImpactPoint`, acima): um `range` grande
          // (chicote) não atravessa parede/obstáculo.
          const origin = {
            x: pos.x,
            y: pos.y + controller.capsuleRadius + controller.capsuleHalfHeight,
            z: pos.z,
          }
          const direction = { x: action.dirX, y: action.dirY, z: action.dirZ }
          const impactPoint = resolveAttackImpactPoint(
            origin,
            direction,
            ATTACK.range,
            physicsBody.colliderHandle,
          )
          const effectRotation = resolveEffectRotation(
            direction,
            ATTACK.visual.rotationOffset,
          )
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
        }
      },
    )
}
