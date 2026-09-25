# 030 — Sistema de dano dos ataques das criaturas

## Resumo

Pedido do usuário: "implementar o sistema de dano dos ataques das
criaturas" — um cálculo e uma aplicação de dano centralizados, usados
por qualquer ataque de criatura, sem arquitetura paralela ao que já
existia. Antes desta feature, `creatureAttackSystem.js` (docs/features/
025-ataque-comum-de-criatura.md) só disparava o gesto e spawnava VFX/
som; nenhum dano era calculado nem aplicado, e `attack.damage`
(`core/data/attacks/<id>/index.js`) existia só como placeholder `null`.

Inclui também, na mesma branch/versão: a troca da esfera de debug do
alcance de ataque por um cone (ver seção `AttackRangeDebugView.jsx`
abaixo) — pedido separado do usuário, feito logo em seguida, mas
tratado como parte desta mesma feature por ainda não ter sido
commitada quando o pedido chegou.

Análise prévia (pedida explicitamente pelo usuário, antes de qualquer
código) confirmou que boa parte da base já existia e só precisava ser
conectada: `resolveCreatureStats` (`core/data/species/stats.js`) já
calculava `attack`/`defense`/`sp_atk`/`sp_def`/`speed` por indivíduo;
`applyDamage` (`core/traits/components/vitals.js`) já era o contrato
único de aplicação de dano, usado só pelo botão de debug; `attack.damage`
já era um campo reservado em toda definição de ataque. Faltava: a
fórmula de dano em si, a detecção de acerto (nenhuma existia — nem
geométrica nem física), e conectar as duas pontas dentro do instante de
impacto que `creatureAttackSystem.js` já isolava.

## Decisões confirmadas com o usuário antes de implementar

- **Hit detection geométrica**, não shape-query do Rapier: query Koota
  por `WildCreature` + distância geométrica, sem física — nenhum outro
  código do projeto usa shape-query. Primeira versão testava só uma
  esfera no `impactPoint`; na Etapa 0 (abaixo) passou a cobrir a
  trajetória inteira, por decisão do usuário.
- **Só `WildCreature` é alvo válido** nesta feature — hoje só a
  criatura CONTROLADA pelo jogador ataca (sem IA de ataque selvagem,
  sem PvP, sem conceito de time/dono no ECS), então não existe "fogo
  amigo" a evitar. `SummonedCreature` nunca é candidata.
- **Sem fila de eventos** — `core/events/` existe como pasta mas está
  vazia (scaffold nunca implementado); sem consumidor real hoje (a UI
  já observa `Vitals` via `useTrait`, não precisa de evento pra
  atualizar HP), implementar isso agora seria abstração antecipada.

## `core/battle/calculateDamage.js` — fórmula pura

Pasta nova (`core/battle/`) — dano é um domínio novo, não estende
`core/data/species/stats.js` (que calcula STATUS, não dano) nem mora
dentro de `creatureAttackSystem.js` (que é mecanismo, não fórmula).

- **`calculateDamage({ level, attack, defense, power, critical, stab,
  type1, type2, random })`** — exatamente a fórmula pedida pelo
  usuário, sem ajuste: `(((((2*level*critical)/5 + 2) * power * attack)
  / defense) / 50 + 2) * (stab * type1 * type2 * random)`. Mantida
  byte a byte — testada com valores conhecidos
  (`calculateDamage.test.js`).
- **`rollCriticalMultiplier(rng)`** — separado do cálculo (pedido
  explícito do usuário). `1/16` de chance (`GAME_CONFIG.BATTLE.
  CRITICAL_HIT_CHANCE`, mesma taxa clássica das primeiras gerações),
  devolve `1` ou `2` pronto pra `calculateDamage`.
- **`rollDamageRandomFactor(rng)`** — uniforme em `[0.85, 1]`
  (`GAME_CONFIG.BATTLE.DAMAGE_RANDOM_MIN/MAX`), mesma convenção
  clássica. Pedido do usuário era só "recebido pelo cálculo, sem
  necessariamente implementar toda a lógica" — esta é a parte mínima.
- **`resolveStab(attackType, attackerTypes)`** — `1.5` quando o tipo do
  ataque bate com um dos tipos do atacante, senão `1`.
- **`resolveTypeEffectivenessMultiplier()`** — sempre `1` (tabela de
  fraqueza/resistência/imunidade ainda não existe, pedido do usuário:
  "por enquanto podem permanecer como 1... quero deixar a estrutura
  preparada"). Aceita `(attackType, defenderType)` na prática — sem
  declarar os parâmetros pra não disparar "unused vars" enquanto não há
  tabela pra consultar.
- **`resolveCombatStats(species, individualValues)`** — chama
  `resolveCreatureStats` e cai em `GAME_CONFIG.BATTLE.
  FALLBACK_COMBAT_STAT` (`50`) quando a espécie ainda não migrou pro
  formato `stats.<key>.base` (`fox`/`wolf` e seus clones `fox-red/
  green/blue` — hoje as únicas nesse caso). Sem isso, um ataque dessas
  criaturas não causaria dano nenhum; mesmo "fallback gracioso" que
  `resolveMaxHp`/`resolveMaxStamina` já usam pras mesmas espécies.
- **`resolveDamageAmount({ attackerSpecies, attackerIndividualValues,
  defenderSpecies, defenderIndividualValues, damage, rng })`** — ponto
  único que decide `attack`/`defense` (categoria `'physical'`) vs
  `sp_atk`/`sp_def` (`'special'`) e monta os parâmetros de
  `calculateDamage` a partir de `attack.damage`.

`GAME_CONFIG.BATTLE` ganhou `CRITICAL_HIT_CHANCE`, `DAMAGE_RANDOM_MIN/
MAX` e `FALLBACK_COMBAT_STAT`, ao lado do `IV_MIN/MAX` que já existia.

## `attack.damage` — preenchido pela primeira vez

`core/data/attacks/<id>/index.js` ganhou `damage: { power, category,
type }` em vez de `damage: null`, nos 6 ataques existentes:

| ataque      | power | category   | fonte                                  |
|-------------|------:|------------|-----------------------------------------|
| scratch     |    40 | physical   | valor real de "Scratch"                 |
| punch       |    40 | physical   | soco genérico, faixa de socos reais     |
| vine-whip   |    45 | physical   | valor real de "Vine Whip"               |
| razor-leaf  |    55 | physical   | valor real de "Razor Leaf"              |
| ember       |    40 | special    | valor real de "Ember"                   |
| whirlpool   |    35 | special    | valor real de "Whirlpool"               |

`type` fica `null` nos 6 — nenhuma espécie declara `types` ainda (campo
novo, opcional, documentado em `core/data/species/_template/index.js`,
sem preencher em nenhuma espécie real), então STAB/efetividade de tipo
não têm efeito prático hoje, mas a estrutura já aceita os dois campos
sem precisar mexer em quem chama quando forem preenchidos.

## `creatureAttackSystem.js` — detecção de acerto e aplicação

No mesmo instante `effectAt` em que o `AttackEffect` (VFX) já nascia:

- **`resolveAttackTarget(world, origin, impactPoint, radius)`** — acha
  a `WildCreature` viva (`vitals.hp > 0`) atingida pela trajetória do
  golpe e o ponto de contato (ver "Etapa 0" abaixo).
- Se `ATTACK.damage` existir e um alvo for encontrado,
  `resolveDamageAmount` calcula o dano e `target.entity.set(Vitals,
  applyDamage(...))` aplica — segundo call site real de `applyDamage`
  no projeto (o primeiro era só o botão de debug).
- Sem `ATTACK.damage` configurado, nenhuma busca de alvo acontece
  (no-op gracioso, mesmo padrão de sempre).

## Etapa 0 — pontos do ataque separados e acerto pela trajetória

Veio de uma análise pedida pelo usuário pra melhorar a legibilidade dos
ataques (debug, impacto, hit/miss). A análise achou que os pontos do
ataque estavam misturados e rotulados errado. Esta etapa corrige isso
antes do debug visual (Etapa 1) e do evento de impacto (Etapa 2).

**O erro de referência:** `Position` é o CENTRO da cápsula física (o
collider é criado sem offset em `createCharacterBody`; o
`body.modelOffset` negativo das espécies é que desce o modelo até o
chão). O código tratava `Position` como pé e somava `capsuleRadius +
capsuleHalfHeight` pra achar o "meio do corpo" — o que na verdade dava
o TOPO da cápsula:
- o golpe saía do alto da cabeça (desde a feature 025);
- a primeira versão desta feature (`resolveBodyCenter`) media o alvo
  pelo topo da cápsula dele também, e os testes repetiam a mesma conta;
- em cápsula deitada (bulbasaur, `axis: 'z'`) a altura saía errada.

**`core/battle/attackGeometry.js`** (novo, puro) — um lugar só pros
pontos:

| Conceito | Onde |
|---|---|
| Posição / centro do corpo | `Position` direto |
| Chão sob a criatura | `resolveGroundPoint` (reusa `verticalClearance`, `core/physics/colliders.js`) |
| Onde o golpe começa | `resolveAttackOrigin` — centro do corpo + `species.body.attackOriginHeight` opcional (novo, documentado no `_template`) |
| Onde a área termina | `resolveAttackImpactPoint` (já existia, raycast contra obstáculo) |
| Onde tocou o alvo | `resolveContactPoint` — superfície da cápsula do alvo, na direção da trajetória |

Mais `resolveCapsuleSegment` (segmento central da cápsula no mundo,
girando com `Rotation.y` — cápsula deitada acompanha o yaw) e
`closestPointsBetweenSegments` (Ericson, "Real-Time Collision
Detection" 5.1.9).

**Acerto pela trajetória inteira** (decisão do usuário, muda gameplay):
a área efetiva virou uma cápsula de `origin` até `impactPoint` com raio
`ATTACK.radius`. Um alvo é atingido quando a distância entre o segmento
da trajetória e o segmento da cápsula dele é ≤ `radius + capsuleRadius`.
Continua **um alvo por golpe**: o primeiro ao longo da trajetória
(menor fração a partir da origem), não o mais perto da ponta.
`resolveAttackTarget` também devolve `contactPoint`, ainda sem
consumidor — é o ponto que a Etapa 2 vai levar no evento de impacto.

Efeito prático: o golpe agora sai do centro do corpo (antes saía de
`r + hh` acima, no alto da cabeça), e acerta qualquer alvo encostando
em qualquer ponto do caminho, não só na ponta.

## Mira do corpo a corpo e combate 2.5D

**Primeira tentativa (substituída):** depois da Etapa 0 o controle ficou
ruim — a direção do golpe seguia a inclinação da câmera (que olha de
cima), então todo golpe saía inclinado pro chão. A primeira correção
criou `attack.aim` (`'melee'`/`'ranged'`) e fazia o corpo a corpo mirar
na ALTURA do alvo à frente automaticamente. Funcionava, mas o usuário
decidiu por uma regra mais geral: combate 2.5D.

**Regras do usuário:** o combate é essencialmente horizontal, mesmo com
o mundo 3D; sem mira vertical livre; a altura é relativa ao terreno de
cada um (não um Y absoluto), pra funcionar em rampa e elevações; dentro
do mesmo plano de combate, range/radius/cone continuam iguais. Plano de
combate = diferença entre as elevações dos pés (cada uma medida em
relação ao terreno sob ela) até `MAX_COMBAT_HEIGHT_DIFF` (1m) — o usuário
preferiu isso a sobrepor as faixas dos corpos. Borda de terraço/
penhasco bloqueia o golpe como obstáculo físico, mesmo com os dois "no
chão".

O que mudou:

- **Direção sempre horizontal** (`resolveAttackDirection`,
  `core/battle/attackAim.js`): `'melee'` = giro da câmera puxado pro
  alvo no cone de `MELEE_AIM_HALF_ANGLE` (45°), só pra alvos no mesmo
  plano de combate e ao alcance horizontal; `'ranged'` = giro da câmera,
  sem assistência. A lógica de mirar na altura do alvo saiu.
- **Trajetória acompanha o terreno** (`resolveAttackImpactPoint`,
  `creatureAttackSystem.js`): anda `range` metros na horizontal mantendo
  a altura da origem acima do terreno, amostrando o chão a cada
  `ATTACK_PATH_SAMPLE_STEP` (0.25m). Numa rampa, não bate no próprio
  chão. Desnível maior que `PATHFINDING.MAX_CLIMB_STEP` (subindo ou
  descendo — o mesmo critério de "intransponível" do pathfinding) ou
  parede/corpo entre duas amostras encerram o golpe; subindo, um raio
  reto acha a face exata. Sem física, segue reto na horizontal.
- **Acerto no plano + mesmo plano de combate** (`resolveAttackTarget`):
  mesma conta de trajetória vs. cápsula do alvo, com Y zerado
  (`closestPointsOnGroundPlane`), mais o filtro
  `isWithinCombatHeight(elevação do atacante, elevação do alvo)`. O
  ponto de contato fica na altura da trajetória naquele trecho.
- **Terreno** (`core/battle/attackGeometry.js`): `resolveGroundY` (raio
  pra baixo) e `resolveFootElevation` (pé acima do terreno; sem chão ao
  alcance ou sem física, conta como no chão). `castRay` ganhou a opção
  `terrainOnly` (`core/physics/raycast.js`) — ignora corpos cinemáticos,
  então nenhuma criatura conta como chão.
- **VFX** orientado pela trajetória real (inclina junto numa rampa).
- **Config** (`GAME_CONFIG.BATTLE`): `MAX_COMBAT_HEIGHT_DIFF` (1.0),
  `GROUND_PROBE_DISTANCE` (20), `ATTACK_PATH_SAMPLE_STEP` (0.25).

Testes com terreno próprio (`src/test/physicsTerrain.js` — chão, rampa,
parede e terraço montados no teste, sem depender do `TEST_LEVEL`):
rampa subindo (com a premissa de que um golpe reto bateria no chão),
parede, borda de terraço subindo e descendo, alvo pulando fora do plano
(e dentro dele quando o atacante também está no ar), alvo em cima do
terraço bloqueado pela borda (com a premissa de que seria atingido sem
ela), e o filtro `terrainOnly` ignorando o corpo de um personagem.

## `AttackRangeDebugView.jsx` — leque 2D de alcance em vez de esfera

> **Removido depois** (ver "Indicador antes de lançar", abaixo): o leque
> de debug deu lugar ao indicador de verdade, que no modo debug aparece
> em todo ataque. O histórico abaixo fica como registro de como o leque
> chegou na forma atual.

Pedido do usuário, depois da detecção de acerto acima: trocar a esfera
(icosaedro wireframe) que marcava o FINAL do range por uma representação
do alcance do início ao fim do golpe. Passou por três rodadas na mesma
sessão:

1. Cone 3D de verdade (`ConeGeometry`, base circular) orientado por
   quaternion.
2. Simplificado pra um leque 2D — pedido do usuário: "o cone pode ser
   2D, é só uma representação do alcance". Um triângulo plano
   (`CONE_GEOMETRY`, `BufferGeometry` com 3 vértices) substituiu o cone
   sólido; rotação reduzida a `rotation.y = atan2(direction.x,
   direction.z)` (só o yaw, deitado no chão).
3. Orientação liberada pra 3D completo — pedido do usuário: "quero que
   esse cone ainda 2D, possa também se movimentar na diagonal, pra eu
   ter uma dimensão da altura que ele pode chegar". A FORMA continua o
   mesmo triângulo fino (nunca virou cone sólido de novo); só a
   ORIENTAÇÃO passou a acompanhar o pitch também, via `cone.lookAt(...)`
   em vez de `rotation.y` isolado.

Estado final:

- `CONE_GEOMETRY` — triângulo unitário (`BufferGeometry`, 3 vértices:
  ápice em `(0,0,0)`, base em `(-1,0,1)`/`(1,0,1)`), compartilhado
  entre os 4 slots. Base em `+Z` porque `Object3D.lookAt` aponta o eixo
  +Z local de um MESH pro alvo (o -Z vale só pra câmera/luz). Uma versão
  anterior usou `-Z` e o leque saía invertido, com a base pra trás —
  corrigido depois que o usuário viu no jogo, e conferido montando o
  mesh no Three.js e checando que a base cai no alvo.
  Escalado por `(attack.radius, 1, attack.range)` a cada frame
  (escalar em vez de recriar geometria).
- Ápice na origem real do golpe (`resolveAttackOrigin`), orientado com
  `cone.lookAt(...)` pro fim da trajetória de verdade
  (`resolveAttackDirection` + `resolveAttackImpactPoint`, as mesmas
  funções do system): horizontal, inclinando só junto com o terreno numa
  rampa. `lookAt` preserva `object.up`, então a largura do leque fica
  sempre horizontal, sem "rolar".
- `range`/`radius` vêm direto de `attack.range`/`attack.radius`
  (`core/data/attacks/<id>/index.js`) — os MESMOS valores que a lógica
  de ataque/dano já usa, nenhuma configuração duplicada. O comprimento é
  sempre o `range` nominal (pedido do usuário); só a orientação segue a
  trajetória. Puramente visual — não participa da detecção de acerto.
- Só no modo debug (F2): aparece com uma `SummonedCreature` no controle,
  um leque por slot configurado, uma cor por slot
  (`SLOT_GUIDE_COLORS`). O anel de alcance em volta da criatura foi
  removido a pedido do usuário — o range é medido pelo leque.

## Impacto: evento `attackResolved` e brilho no alvo

Pedido do usuário: "algo visual para eu entender que acertou" (citando
o jogo Farever como referência — não o conheço bem o bastante pra
copiar, então foi usado o padrão mais comum de jogo de ação: "hit
flash" no modelo atingido; o usuário pode refinar depois). Mesma rodada:
o anel de alcance em volta da criatura saiu do debug (F2) — o range é
medido só pelo leque.

**Evento tipado** (decisão anterior do usuário: evento, não pulso) —
primeiro uso real de `core/events/`, que existia vazio:
- `createEventQueue()` (`core/events/eventQueue.js`): `emit`/`drain`,
  ordem preservada.
- `attackResolved(...)` (`core/events/index.js`, `@typedef` documentado):
  `{ type, result: 'hit'|'miss', attacker, target, attackId, slot,
  origin, impactPoint, contactPoint, damage }`.
- `creatureAttackSystem.js` emite no instante `effectAt`, depois de
  aplicar o dano, acertando ou não (só quando o ataque tem `damage`).
- `GameLoop.jsx` cria a fila, passa em `context.events` pro passo fixo e
  drena UMA vez por frame, logo antes da apresentação, entregando a lista
  como `context.frameEvents`. Um evento emitido em qualquer passo fixo do
  frame é visto exatamente uma vez pelos efeitos. A fase `events` do
  passo fixo continua sem system (fica pra consumidor de gameplay).

**`view/systems/hitFlashSystem.js`** (presentation): pra cada
`attackResolved` com `hit`, acende o modelo do alvo (`material.emissive`)
e apaga ao longo de `GAME_CONFIG.FEEDBACK.HIT_FLASH.DURATION` (0.15s,
branco, intensidade 0.8 — valores de partida). Acha o modelo pelo
`viewRegistry` que já existia. Clona o material do alvo no primeiro
acerto (o `.glb` compartilha material entre instâncias — sem isso a
espécie inteira piscaria) e é dono desse clone: dá `dispose()` quando a
entidade sai de cena. Novo acerto durante o flash só reinicia o tempo,
sem recapturar a cor já acesa como "original". Não lê `Vitals` — curar
ou regenerar nunca pisca.

O evento é o ponto de encaixe pro resto do retorno de impacto (hit
stop, reação do alvo, knockback, VFX no `contactPoint`, SFX de hit/miss,
tremor de câmera), cada um como mais um consumidor.

Testes: `core/events/eventQueue.test.js` (ordem, drain esvazia, hit/
miss); `creatureAttackSystem.test.js` (acerto emite hit com alvo,
contato e o mesmo dano aplicado no `Vitals`; golpe no vazio emite miss);
`view/systems/hitFlashSystem.test.js` com materiais Three.js reais
(acende na hora, não vaza pra outra criatura com o mesmo material, volta
à cor original, reinício no novo acerto — conferido que falha sem o
reinício —, miss não acende, material sem emissive é ignorado, dispose
ao sair de cena).

## Indicador antes de lançar (`castMode`)

Pedido do usuário, com o LoL como referência: apertar o ataque (clique
ou Q/E/R) primeiro mostra o alcance num leque azulado preenchido; só o
segundo aperto lança. Configurável por ataque/habilidade — sem o
indicador, lança assim que aperta. No modo debug (F2) o indicador vale
pra todo ataque, e os leques de debug saíram (fica só o indicador).

Nota de nomenclatura: no LoL, "smart cast" é o contrário (lança sem
indicador); o fluxo pedido é o "normal cast". Por isso o campo se chama
`castMode`, não `smartCast`.

- **`attack.castMode`** (`core/data/attacks/<id>/index.js`):
  `'confirm'` (indicador primeiro) ou `'instant'`/ausente (lança na
  hora). Os 6 ataques estão em `'confirm'`; override por criatura via
  `{ id, overrides: { castMode } }`.
- **`AttackAim { slot }`** (trait novo, `attackEffect.js`): slot com o
  indicador aberto. Dono: `creatureAttackSystem.js`. Incluído no spawn
  da criatura (`summonBallSystem.js`, com teste — a mesma armadilha do
  `AttackCooldowns` na feature 025).
- **Fluxo** (`creatureAttackSystem.js`, helpers `tryStartAttack`,
  `handleAttackPress`, `resolveCastMode`):
  - apertar um ataque `'confirm'` abre o indicador dele (se não estiver
    em cooldown), sem gastar nada;
  - com o indicador aberto: clique esquerdo OU a mesma tecla de novo
    lança (clique esquerdo confirma a skill mirada, não dispara o ataque
    básico); outra tecla de ataque troca o indicador; botão direito
    cancela (como no LoL);
  - confirmar sem conseguir lançar (outra ação em andamento, cooldown,
    stamina) não faz nada e o indicador continua aberto;
  - `'instant'` continua como antes: primeiro botão que dá pra lançar,
    lança.
- **Debug**: `page.js` passa `castModeOverride = 'confirm'` pro
  `GameLoop` quando o F2 está ligado; vira `context.settings.
  castModeOverride` e ganha da definição do ataque.
- **`view/scene/AttackIndicatorView.jsx`** (novo, montado no
  `GameScene`, fora do debug): leque preenchido azul (`#3fa9ff`,
  opacidade 0.28) com contorno claro, deitado no chão sob a trajetória,
  com `range`/`radius` do ataque e a MESMA direção/trajetória do golpe
  de verdade (`resolveAttackDirection` + `resolveAttackImpactPoint`) —
  segue a câmera ao vivo até confirmar. Cores/opacidade/altura em
  `GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR`.
- `tools/debug/AttackRangeDebugView.jsx` removido; docstrings que citavam
  ele foram atualizadas.

Testes (`creatureAttackSystem.test.js`): 1º clique só abre o indicador
e o 2º lança; Q + clique confirma a skill; mesma tecla confirma; outra
tecla troca; botão direito cancela; cooldown não abre; confirmar com
outra ação em andamento mantém o indicador; `resolveCastMode` (definição,
ausente, override do debug). Os testes antigos de mecânica do golpe
passam `castModeOverride: 'instant'` (testam o golpe, não o modo de
lançamento). O indicador em si (visual) não tem teste automático — build
compilando e verificação no jogo.

## Câmera de combate (tentada e revertida)

Foi testado um perfil de câmera só pro combate (mais perto e mais alta,
enquadrando à frente da criatura) e a criatura girando pra encarar a mira
com o indicador aberto. O usuário não gostou do estilo e pediu pra voltar
ao que era — os dois foram revertidos; a câmera é a mesma pra treinador
e criatura, como antes.

**Ficou dessa rodada** (correção, não estilo): a mira da criatura
(`resolveAimDirection`, `core/aim.js`, chamada por `attackAim.js`) passa
também `species.camera.shoulderOffset`. Antes ela só repassava a altura
e caía no `SHOULDER_OFFSET` global (0.4m, com as criaturas configuradas
com 0) — a direção do golpe saía deslocada do que a câmera mostra. Com
`GAME_CONFIG.CAMERA.TARGET_HEIGHT`/`SHOULDER_OFFSET` comentados no
arquivo (mudança feita fora desta sessão), sem esse repasse a direção de
todo golpe saía `NaN` com câmera no mundo (conferido).

## Números de dano e crítico

Pedido do usuário: o dano aparecer na tela "como em jogos tipo Conquer/
Farever", e o crítico sinalizado de outro jeito. (Não conheço os
detalhes visuais desses jogos pra copiar; segue o padrão comum do gênero:
número subindo acima do alvo e sumindo.)

- **Crítico agora é informado**: `resolveDamageAmount` devolve
  `{ amount, critical }` (antes só o número; o crítico era sorteado e
  ninguém sabia). A ordem de consumo do `rng` não mudou (crítico antes do
  `random`). `attackResolved` ganhou `critical` (`false` num miss).
- **`view/vfx/damageNumberPool.js`**: pool de tamanho FIXO
  (`DAMAGE_NUMBER.POOL_SIZE`, 24) — regra de efeito visual frequente;
  cheio, reaproveita o mais antigo. Estado só da view.
- **`view/systems/damageNumberSystem.js`** (presentation): pra cada
  `attackResolved` com hit, nasce um número acima da cabeça do alvo (topo
  da cápsula + `HEAD_MARGIN`); golpes seguidos se afastam de lado
  (`SPREAD`, na direita da câmera) pra não empilhar. Texto arredondado
  (`formatDamage`, mínimo 1) — o dano no `Vitals` continua com decimais.
- **`view/scene/DamageNumbersView.jsx`**: um `<Html>` fixo por slot
  (criados uma vez), texto trocado direto no DOM quando o slot muda —
  sem re-render do React por frame. Normal: branco com contorno preto.
  Crítico: maior, amarelo com contorno vermelho, rótulo "CRÍTICO!" em
  cima, nasce 1.7x maior e "encaixa", e fica mais tempo
  (`CRIT_LIFETIME`). Sobe desacelerando (`RISE`) e some nos últimos 40%.
- Config em `GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER`.

Testes: `resolveDamageAmount` informa o crítico (e o crítico aumenta o
dano); `attackResolved` leva `critical`; pool (spawn, envelhecer/sumir,
tamanho fixo reaproveitando o mais antigo, `serial`); system (número
acima da cabeça com dano arredondado, crítico marcado e mais longo, miss
não cria, golpes seguidos se afastam de lado, some no fim da vida). A
aparência em si (view) não tem teste automático — build compilando e
verificação no jogo.

## Modo combate

Pedido do usuário: qualquer ataque põe a criatura em "modo combate"; por
enquanto o único efeito é o olho passar de `awake` pra `angry`, e depois
de 10s sem lançar ataque ela volta pro `awake`. Outros efeitos virão.

- **`CombatMode { timeLeft }`** (trait novo): presença = em combate.
- **Actions** (`core/actions/combat.js`, nomes no padrão do projeto):
  `entrarEmCombate` — na entrada, ganha o trait com o tempo cheio e
  `Mood` vira `'angry'`; já em combate, só renova o tempo (não mexe no
  `Mood`, pra não atropelar uma troca manual do `DebugPanel` a cada
  golpe). `sairDeCombate` — tira o trait e volta o `Mood` pra `'awake'`.
- **Quem entra**: `creatureAttackSystem.js` chama `entrarEmCombate` toda
  vez que um ataque é LANÇADO (`tryStartAttack`) — abrir o indicador sem
  lançar não conta. Só o atacante; quem apanha não entra (ainda).
- **`combatModeSystem.js`** (simulation, logo depois do ataque): conta
  `timeLeft` e chama `sairDeCombate` quando zera.
- Config: `GAME_CONFIG.BATTLE.COMBAT_MODE_TIMEOUT` (10s).
- Olho: `eyeBlinkSystem.js` já trocava a célula do olho pelo `Mood`. Só
  bulbasaur (e o boy) têm `angry` em `eyeStates`; charmander e squirtle
  não — neles o `eyeBlinkSystem` cai no `awake` (fallback de sempre) até
  alguém configurar a célula `angry`.

Testes: actions (entrar com tempo cheio + angry, renovar sem mexer no
humor, sair volta pra awake), system (continua antes do tempo, sai e
volta pra awake quando acaba, novo ataque renova) e integração no ataque
(lançar entra em combate; só abrir o indicador não).

**Bug de olho corrigido** (apareceu com o modo combate): o olho ficava
alternando entre bravo e normal nas piscadas. Causa: o cache de texturas
(`view/textures/textureCache.js`) devolve a MESMA `THREE.Texture` pra
toda criatura que carrega o arquivo, e o `eyeBlinkSystem.js` muda o
recorte (`offset`) nela a cada piscada — com duas criaturas da mesma
espécie em humores diferentes (a sua brava, uma selvagem normal), cada
uma escrevia a sua célula por cima da outra. Antes todo mundo era
`awake`, então não aparecia. Correção em `useAnimatedModel.js`: textura
com `eyeStates` vira uma cópia própria da entidade (`texture.clone()` —
na versão 0.185 do Three a cópia reusa a imagem e a textura na GPU é
contada por uso), descartada no cleanup. Teste
(`view/systems/eyeBlinkSystem.test.js`): com cópia, cada olho mostra o
próprio humor; com a mesma textura, reproduz o bug.

## Testes

- `core/battle/calculateDamage.test.js` — fórmula com valores
  conhecidos, crítico, faixa do random, STAB, fallback de stats pra
  espécie não migrada, categoria physical vs special.
- `core/battle/attackGeometry.test.js` — chão/origem, segmento da
  cápsula em pé e deitada (com yaw), distância entre segmentos (cruzando,
  paralelos, no meio do caminho, degenerado) e ponto de contato.
- `creatureAttackSystem.test.js` — `resolveAttackTarget` isolado (acerta
  no meio da trajetória, alvo de lado dentro/fora do alcance com ponto
  de contato na superfície, além do fim, morta, primeiro da trajetória,
  cápsula deitada girando com yaw, nunca `SummonedCreature`) e o fluxo
  completo via `creatureAttackSystem` (dano aplicado no meio da
  trajetória, nenhum fora dela, `SummonedCreature` no caminho não é
  atingida). Os testes de posição do `AttackEffect` passaram a esperar
  a origem no centro do corpo.

## Fora de escopo (consciente)

- Tabela de efetividade de tipo (fraqueza/resistência/imunidade) —
  `resolveTypeEffectivenessMultiplier` sempre `1`.
- `types` de espécie — estrutura documentada, nenhuma espécie preenche.
- Fogo amigo / PvP / conceito de time-dono no ECS.
- Morte/estado terminal ao HP chegar a `0` — dano aplicado normalmente
  (`applyDamage` já trava em `0`, nunca negativo), sem fluxo de
  respawn/captura acionado — item separado no backlog.
- Evento tipado de dano (`core/events/` continua vazio).

## Gates

- `npm test` — suíte completa passa, exceto 10 testes pré-existentes em
  4 arquivos não relacionados a ataque (`world.test.js`,
  `data/items/index.test.js`, `applyAnimationClip.test.js`,
  `characterPhysicsSystem.test.js`). `world.test.js` e
  `items/index.test.js` foram confirmados quebrados antes desta feature
  via `git stash`; os 4 arquivos e os 10 testes aparecem idênticos em
  todas as rodadas, antes e depois de cada etapa. Não tocados aqui.
  A partir da rodada da câmera, mais 10 em `orbitCamera.test.js`:
  testam o comportamento padrão com `GAME_CONFIG.CAMERA.TARGET_HEIGHT`/
  `SHOULDER_OFFSET`, que foram comentados fora desta sessão —
  conferido que passam todos (24/24) com os dois valores de volta.
- `npm run lint` — limpo em todos os arquivos desta feature.
- `npm run build` — a compilação passa (`✓ Compiled successfully`); o
  comando falha só no lint, em arquivos não tocados por esta feature
  (`core/data/species/001-bulbasaur`, `004-charmander`, `007-squirtle`,
  `bot`, `boy`, `core/data/species/stats.js`, `testLevel.js`,
  `ActionSlotHud.jsx`, `PartyHud.jsx`, `StatusHud.jsx`,
  `PokemonsTab.jsx`, `roster.js`, `StatsScreen.jsx`, `CreatureView.jsx`,
  `PunchAttackEffect.jsx`, `VineWhipAttackEffect.jsx`,
  `statusDisplay.jsx`). Uma versão anterior desta lista estava
  incompleta (só tinha lido o fim da saída do build).
