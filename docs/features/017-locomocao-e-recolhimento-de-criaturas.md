# 🚀 Versão 0.0.17 — Locomoção, recolhimento e pathfinding de criaturas de time

Criaturas invocadas do time (`SummonedCreature`) ganham física de verdade e
andam/correm de verdade (não deslizam mais animando idle fixo). Invocar e
recolher são AÇÕES de verdade agora — parecido com o arremesso
(docs/features/016-mira-e-arremesso.md): têm duração, travam movimento e
qualquer outra ação enquanto executam, e o treinador gira pra encarar a
direção que a CÂMERA está apontando no disparo (não `Rotation.y` de antes).
Desequipar uma criatura já invocada dispara o recolhimento automaticamente.

Depois de ganhar física de verdade, uma criatura esbarrava/deslizava
contra paredes e obstáculos em vez de contornar — `creatureFollowSystem.js`
mandava ela em linha reta até o treinador, sem noção nenhuma de obstáculo.
A mesma feature também entrega um pathfinding de verdade (A* numa grade,
biblioteca `pathfinding`), com uma grade que sabe de ELEVAÇÃO (heightmap —
dá pra subir terrenos com altura real, rampas e terraços, não só desviar
de paredes no plano) e uma camada de evasão local que reage quando a
física reporta que o movimento pedido não está de fato acontecendo.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Visão geral

Boa parte da infraestrutura de física/animação já existia de forma
genérica (por combinação de traits, não amarrada ao jogador) — a base
desta feature é principalmente fiação: dar à criatura os mesmos traits
que o jogador já usa pra se mover fisicamente, e um pequeno ajuste em
dois sistemas existentes que assumiam implicitamente "só existe o
jogador". Em cima disso, a criatura ganha uma direção de movimento vinda
de pathfinding de verdade em vez de uma linha reta até o treinador.

## Locomoção

`core/systems/creatureFollowSystem.js` não mexe mais em `Position` direto
— produz `Velocity`/`Rotation` (intenção), igual `movementSystem.js` já
faz pro jogador. Quem de fato move `Position` é o pipeline físico
compartilhado (`characterPhysicsSystem` → `physicsStepSystem` →
`syncPhysicsSystem`, já registrados nessa ordem) — dá colisão real contra
o mundo de graça.

- Velocidade vem de `MovementStats` da própria criatura (por espécie):
  dentro de `PARTY.FOLLOW_MIN_DISTANCE`, parada; além de
  `PARTY.RUN_DISTANCE`, corre (`runSpeed`) pra alcançar o treinador; entre
  os dois, anda (`walkSpeed`).
- `Velocity` SEGUE `Rotation`, não o contrário: só a `Rotation` gira
  suavemente rumo à direção alvo (`atan2`, `lerpAngle`/`turnSpeed` — mesma
  fórmula do jogador), e `Velocity` é derivada dela já suavizada (`sin`/
  `cos` da `Rotation` vezes a velocidade). O destino muda com frequência
  (o treinador anda, o caminho recalcula, um waypoint é alcançado) — antes,
  `Velocity` virava direto pra cada direção NOVA (instantânea) e só a
  `Rotation` visual suavizava atrás, dando pra ver o corpo apontando um
  jeito enquanto já se movia por outro, e a troca abrupta de `Velocity`
  contra a física podia parecer uma travada (bug real, relatado jogando).
  Invertendo a dependência, mudar de destino faz a criatura curvar
  gradualmente pra lá em vez de virar/deslizar de repente — em regime
  (perseguindo o mesmo alvo por um tempo), o resultado é idêntico a antes,
  só a transição fica suave. Parada, não gira (congela na última direção).
- A `Velocity` resultante já alimenta `core/systems/animationStateSystem.js`
  sem nenhuma mudança nele — ele já resolve idle/walk/run a partir só de
  `Velocity`/`Grounded`/`ActionState.current` pra qualquer entidade com
  esses traits. `view/scene/CreatureView.jsx` (já usa `useAnimatedModel`,
  mesmo hook do `PlayerView`) já toca o clipe certo sozinho assim que
  `AnimationState.id` passa a mudar de verdade.

### Corpo físico dinâmico

`core/systems/physicsBootstrapSystem.js` só roda UMA VEZ, no instante em
que o WASM do Rapier termina de carregar — só alcança entidades que já
existem naquele momento (hoje, só o jogador). Uma `SummonedCreature`,
spawnada bem depois via input, nunca passaria por ali. Por isso,
`core/systems/partySummonSystem.js` cria o corpo Rapier na hora da
invocação (`createCharacterBody`, `core/physics/colliders.js` — a mesma
função que o bootstrap já usa) e desfaz (`destroyCharacterBody`, novo, no
mesmo arquivo) no recolhimento — sem isso, cada ciclo invocar/recolher
vazaria um rigid body no world do Rapier. Sem física pronta ainda na
invocação, os handles ficam no default `-1`, mesmo comportamento gracioso
que o resto do motor já tem.

`core/systems/characterPhysicsSystem.js` passou a ser genérico de
verdade: gravidade/KCC/`Grounded` valem pra qualquer entidade com
`CharacterController`/`PhysicsBody` (criatura incluída). Pular continua
exclusivo do jogador — gatiado por `entity.has(InputControlled)`, porque
`context.input` é um snapshot GLOBAL (um único dispositivo de input);
sem esse filtro, toda criatura pularia junto sempre que o jogador
apertasse pular.

A criatura ganha `Vitals`/`ActionState` mesmo sem uso real algum — só pra
entrar nas queries de `characterPhysicsSystem` (`Vitals`, restrita ao
bloco de pulo — mesma decisão que manter esses campos garante que mutar
`vitals.stamina` persista: `entity.get()` fora de uma query ativa devolve
um retrato, não a referência com escrita de volta que `updateEach` dá pra
quem está na query) e `animationStateSystem` (`ActionState.current`
sempre `null` — a criatura não tem ações próprias).

### Personagens colidem de verdade, mas se evitam proativamente

Bug real, jogando com o time cheio: com mais de uma criatura invocada,
elas ficavam se esbarrando/empurrando entre si (e empurrando o jogador
junto) — o `KinematicCharacterController` do Rapier trata QUALQUER
collider no caminho como obstáculo por padrão, personagem ou não, se nada
disser o contrário.

Uma primeira versão desta rodada fazia personagens simplesmente se
IGNORAREM entre si na física (`InteractionGroups` do Rapier, atravessava
um pelo outro) — revertida a pedido do usuário: passar direto por cima de
outro personagem não é aceitável, mesmo que resolva o esbarrão. A colisão
física entre personagens continua real e sem filtro nenhum
(`createCharacterBody`/`computeColliderMovement`, sem mudança) — o
controle de não esbarrar vem de EVASÃO PROATIVA, não de fingir que a
colisão não existe.

`creatureFollowSystem.js` soma, pra cada criatura, um vetor de REPULSÃO
de qualquer outro personagem (treinador ou outra criatura) mais perto que
`PARTY.AVOIDANCE_RADIUS` — mais forte quanto mais perto, zero na borda do
raio — e mistura isso na direção de movimento (waypoint/treinador) ANTES
de virar `Velocity`, com peso `PARTY.AVOIDANCE_STRENGTH`. Isso desvia do
caminho de quem está por perto antes mesmo de chegar a colidir de
verdade. Vale mesmo dentro de `FOLLOW_MIN_DISTANCE` (perto o bastante do
treinador pra "chegar"): se outro personagem estiver perto demais, a
criatura usa só a repulsão (sem perseguir mais o treinador) em vez de
travar Velocity em zero — sem isso, duas criaturas "estacionadas" na
mesma distância do treinador podiam ficar sobrepostas sem nenhuma se
mexer pra desfazer isso.

## Invocar e recolher são ações

`core/systems/partySummonSystem.js` usa o mesmo mecanismo genérico de
`ActionState` que dash/arremesso/uso já usam (`playerActionSystem.js`,
ver docs/features/007-sistema-de-acoes-do-jogador.md): trava `current`
(`'summon'`/`'recall'`) no disparo, o efeito de verdade (spawnar/destruir
a `SummonedCreature`) só acontece depois, no instante `EFFECT_AT`, e
`current` volta a `null` sozinho em `DURATION`. Enquanto uma invocação/
recolhimento está em andamento, nenhuma outra ação pode começar — nem
dash/arremesso/uso, nem outra invocação — e vice-versa: uma ação do
jogador em andamento também impede invocar/recolher.

Essa exclusão mútua é automática porque as DUAS fontes (`playerActionSystem.js`
e `partySummonSystem.js`) escrevem o MESMO `ActionState` e só iniciam uma
ação nova quando `current` já está `null`. A única peça que precisou de
ajuste explícito: `playerActionSystem.js` incrementava `elapsed`
incondicionalmente sempre que `current` não era `null` — sem saber nada
de `'summon'`/`'recall'`, ele dobraria a velocidade dessas ações (as duas
incrementando o mesmo campo no mesmo tick). Agora ele ignora
explicitamente qualquer `current` que não seja `'dash'`/`'throw'`/
`'consume'` — quem avança/aplica o efeito de invocar/recolher é só
`partySummonSystem.js`.

No disparo, o treinador gira, mas pra alvos DIFERENTES em cada ação:

- **`beginSummon`** — gira pra onde a CÂMERA está apontando agora
  (`resolveCameraYaw`, novo em `core/aim.js`) — não a direção que o corpo
  já estava encarando, e não existe criatura ainda pra encarar (só o
  lugar onde uma vai nascer). Essa direção (`action.dirX`/`dirZ`, vetor
  unitário) fica travada no `ActionState` até o instante de efeito,
  porque o mouse continua livre durante a ação (só o movimento do corpo
  é travado) — sem isso, a posição de nascimento poderia divergir de pra
  onde o treinador acabou de virar.
- **`beginRecall`** — gira pra encarar a CRIATURA de verdade
  (`atan2` até a posição dela), não a câmera — ela já existe num lugar
  concreto, então o corpo vira pro que está sendo recolhido. (Uma
  primeira versão desta rodada usava a câmera pras duas ações — errado
  pro recolhimento: o usuário confirmou que o treinador precisa virar
  pra criatura de verdade, não pra onde o mouse está apontando.)

`resolveCameraYaw` não é `orbit.yaw` cru — `orbit.yaw` é o ângulo do
vetor ALVO→CÂMERA (onde a câmera fica posicionada, atrás do alvo,
`computeOrbitOffset`), então a direção que a câmera de fato MOSTRA na
tela é o oposto (`orbit.yaw + π`). Usar o valor cru foi um bug real desta
rodada: a criatura nascia atrás do campo de visão, no sentido contrário
de pra onde o jogador estava olhando.

Animação: invocar reusa o MESMO clipe/id do arremesso (`'throw'`, ver
docs/features/016-mira-e-arremesso.md) — pedido explícito do usuário, sem
autoria de clipe novo (`core/data/animationStates.js`: o `when` do estado
`'throw'` passa a bater também com `ctx.action === 'summon'`). Recolher
ganhou seu próprio id (`'recall'`, também `oneShot`), preparado pro
mecanismo (reinício do relógio, resolução por `ActionState.current`) mas
ainda sem clipe autorado — até existir `core/data/species/<id>/clips/
recall.json`, toca a pose de descanso (mesmo fallback gracioso de
qualquer estado sem clipe, ver `animationSystem.js`).

Duas fontes disparam o recolhimento, a mesma lógica (`beginRecall`) pras
duas:

1. **Manual** — apertar de novo o `secondaryN` de um slot já invocado.
2. **Automático** — a cada tick (só quando o treinador está livre — não
   interrompe uma ação em andamento), pra toda `SummonedCreature` cujo
   `Party[slot]` esteja vazio (desequipado em qualquer lugar — hoje só o
   `InventoryPanel.jsx`, arrastar a criatura pra fora do slot). Se mais de
   um slot ficar órfão ao mesmo tempo, são recolhidos um de cada vez,
   nos ticks seguintes — a própria exclusão mútua vira uma fila natural.

## Pathfinding (`core/pathfinding.js`)

Em vez de implementar A* do zero, o projeto usa a lib pronta `pathfinding`
(npm, a.k.a. PathFinding.js) — grade + `AStarFinder`, MIT, sem pipeline de
asset novo. Foi comparada com `three-pathfinding` (navmesh, mais moderna):
essa exige AUTORAR a malha de navegação fora do jogo (Blender/Recast) e
exportar como OBJ/glTF — sem caminho nenhum de `TEST_LEVEL` (boxes/rampa
declarativos) até um navmesh sem inventar esse pipeline de autoria do
zero. Com o nível ainda em geometria simples e sem ferramenta de autoria,
o grid venceu por ser uma integração de um dia, direto da mesma fonte de
dados que já gera os colliders físicos.

`getNavGrid()` baka, de forma preguiçosa e cacheada (o nível é estático —
mesma premissa de `createStaticLevel`), um `PF.Grid` a partir de
`TEST_LEVEL.ground`/`obstacles`. Cada célula tem `GAME_CONFIG.PATHFINDING.
CELL_SIZE` metros; obstáculos bloqueiam o footprint XZ deles inflado por
`OBSTACLE_MARGIN` (evita a cápsula da criatura raspar quina).

Três tipos de obstáculo NÃO bloqueiam a grade (`type: 'box'` continua
sendo parede de verdade, sempre bloqueando acima do auto-step):

- `type: 'ramp'` — rampa subível, contribui ELEVAÇÃO interpolada (ver
  seção seguinte).
- `type: 'floor'` — terraço elevado, contribui elevação CONSTANTE (o
  topo da caixa).
- Obstáculo `'box'` cujo topo fica na altura do auto-step
  (`GAME_CONFIG.PHYSICS.CHARACTER.AUTOSTEP_HEIGHT`) ou abaixo — a física
  já sobe sozinha (`step-low`), sem contribuir elevação (é baixo demais
  pra importar).

### Elevação (heightmap)

A grade guarda uma ELEVAÇÃO por célula, não só um bit walkable/bloqueado
— sem isso, marcar um terreno elevado como "sempre andável" (do jeito que
`'ramp'` era antes) deixaria o A* traçar uma rota reta por CIMA da
lateral sólida de um terraço, que fisicamente é uma parede — a criatura
ficaria presa nela de novo (mesmo bug que a locomoção física já tinha
resolvido, só que realocado). Precisa saber QUANTO um vizinho é mais
alto, não só se está livre.

- `'ramp'`: elevação varia ao longo do eixo de inclinação, pela mesma
  rotação de eixo único que `quaternionFromAxisAngle` usa (`axis: 'z'`
  inclina ao longo de X, `axis: 'x'` ao longo de Z).
- `'floor'`: elevação constante (o topo da caixa).
- Onde os footprints de uma rampa e um terraço vizinho se tocam (sempre
  sobra ~1 célula de sobreposição no rasterizador), a rampa vence — sua
  curva dá um valor intermediário na fronteira; deixar o terraço (valor
  constante) vencer criava um salto artificial ali.

**Regra de "penhasco"**: depois do bloqueio duro, toda célula ainda livre
é comparada com as 8 vizinhas (incluindo diagonais) que também estão
livres; se a diferença de elevação passar de `PATHFINDING.MAX_CLIMB_STEP`,
a célula vira bloqueada. Uma rampa (elevação mudando aos poucos célula a
célula) nunca dispara isso nela mesma — só a borda entre dois terraços SEM
rampa entre eles dispara, bloqueando os dois lados dessa borda (um
pequeno "fosso" de 1 célula) e forçando o desvio pela rampa de verdade.
Continua usando só `PF.Grid`/`AStarFinder` sem mudar a lib — a regra só
decide o walkable de cada célula antes de passar pro finder.

**Limitação assumida**: uma elevação por célula X/Z — não modela dois
andares literalmente empilhados no mesmo X/Z (só existe "um em cima do
outro" se estiverem em posições X/Z diferentes, nunca sobrepostos). Pra
terreno que sobe (morro, montanha, trilha em espiral, terraços em
sequência — ver a trilha de teste abaixo) isso não é problema, já que
nenhum trecho do caminho passa por baixo de si mesmo; um prédio com
andares de verdade empilhados exigiria uma grade "por nível" (várias
grades conectadas por rampas) — fora de escopo aqui.

### Trilha de teste (4 terraços)

`testLevel.js` tem uma trilha subindo ao longo de +X (longe do resto do
nível, z:[13,27]), 4 terraços de 1.8m cada (7.2m no topo). Cada transição
tem DUAS rampas paralelas (lanes em z:[13,17] e z:[23,27]) — pelo menos 2
caminhos pra alcançar cada terraço — separadas por uma "espinha" de rocha
sólida no meio, senão o vão entre as lanes ficaria sem collider nem
elevação definida. Serve pra testar visualmente o algoritmo escolhendo
livremente qual das duas lanes usar em cada subida.

**Reforço físico sob cada rampa** (`ramp{n}-{a,b}-backing`, e
`ramp-backing` pra rampa original): toda rampa é uma caixa FINA (0.3 de
espessura) tombada — sobra um vão físico em cunha embaixo dela (cresce
conforme a rampa sobe), sem collider nenhum ali. Uma criatura conseguia
fisicamente entrar nesse vão e ficar presa — o pathfinding nem enxerga
isso (a grade só sabe da elevação no TOPO da rampa, não do vazio por
baixo), então nem tentava desviar dali (bug real, jogando contra a
trilha). Cada rampa ganhou uma "backing": cópia mais grossa dela mesma
(mesma rotação/X/Z), deslocada pra baixo até a própria face de baixo
encostar exatamente na face de baixo da rampa fina — fecha o vão com
collider sólido. `type: 'ramp'` de propósito (não `'box'`): sempre
declarada ANTES da rampa fina de verdade no array, então o bake de
elevação (`core/pathfinding.js`) sempre sobrescreve com o valor certo —
a backing nunca contribui elevação nem bloqueia, é só reforço físico.

> ⚠️ Nota do estado atual do arquivo: as entradas `*-backing` estão
> comentadas em `testLevel.js` no momento (desativadas manualmente depois
> de escritas) — o mecanismo acima descreve a intenção/o código que existe,
> mas com elas desligadas o vão físico sob cada rampa volta a existir.
> Confirmar se isso foi proposital antes de reativar ou remover de vez.

`findPath(fromWorld, toWorld)` roda `AStarFinder` numa CÓPIA da grade
(`grid.clone()` — `finder.findPath` muta a grade recebida) e suaviza o
caminho bruto com `boundedSmoothPath` — mesma técnica de "string pulling"
de `PF.Util.smoothenPath` (do ponto atual, acha o mais distante com linha
de visão livre, célula a célula via Bresenham, e pula direto pra lá), MAS
limitando cada salto a `PATHFINDING.MAX_SHORTCUT_DISTANCE`.

O limite existe por um bug real, achado jogando contra a trilha de teste:
sem ele (o que `PF.Util.smoothenPath` sozinho faz), um trecho reto e
andável célula a célula — verdade, Bresenham confirma cada uma — ainda
podia virar UM waypoint só a 20-30m de distância, porque uma lane de rampa
só tem ~4m de largura e a trilha inteira (várias rampas/terraços em
sequência) é uma reta desse tipo. "Andável célula a célula" não é o mesmo
que "seguro mirar de tão longe": entre um recálculo e o próximo, a
criatura anda reto na direção daquele waypoint distante, e qualquer
imprecisão real (giro suavizado por `turnSpeed`, física) desvia da lane
estreita antes da próxima correção — ela acabava esbarrando de lado numa
rampa (ou passando por baixo dela, pelo vão físico sob a parte inclinada)
em vez de subir. Limitar o salto mantém trechos abertos eficientes (poucos
waypoints, poucas células precisam de correção) sem permitir um atalho tão
comprido quanto o do bug.

O último waypoint é sempre substituído pela posição EXATA do alvo (não o
centro da célula), senão a chegada final fica deslocada em até meia
célula mesmo sem obstáculo nenhum no caminho. Retorna `[]` quando origem/
destino caem na mesma célula ou não existe caminho (alvo bloqueado/
inatingível, incluindo do lado errado de um penhasco) — tratado como "sem
obstáculo relevante", segue em linha reta. Cada waypoint carrega `y`
também (elevação da própria célula, do heightmap) — não é necessário pro
movimento (a física já sobe rampa/degrau sozinha a partir só da direção
horizontal), mas alimenta a visualização de debug (ver abaixo).

### `creatureFollowSystem.js` — seguir waypoints

A direção de movimento passou a vir do waypoint atual (`PathState.
waypoints[waypointIndex]`) em vez de ir direto pro treinador. O caminho
fica cacheado na própria criatura (`PathState`, trait nova) e só é
recalculado a cada `PATHFINDING.REPATH_INTERVAL` segundos
(`repathTimer`), não todo tick — a grade não muda e recalcular menos evita
uma trajetória nervosa. Ao chegar perto do waypoint atual
(`WAYPOINT_ARRIVAL_DISTANCE`), avança pro próximo. Sem waypoints (aberto,
sem obstáculo no meio, ou sem caminho encontrado) cai de volta na linha
reta até o treinador.

Andar/correr continua decidido pela distância até o TREINADOR (não até o
waypoint) — só a direção mudou, o ritmo de aproximação continua igual.

### Evasão local (`MovementBlocked`)

O heightmap não modela toda geometria física com 100% de fidelidade — o
vão em cunha embaixo de uma rampa tombada (ver "Reforço físico sob cada
rampa" acima) é um exemplo, mas o jogo vai crescer e vão existir outros. Em
vez de tentar prever de antemão todo jeito possível de uma geometria
enganar a grade, a criatura reage a um sinal físico direto:
`characterPhysicsSystem.js` já chama `controller.computedMovement()`
depois de resolver a colisão contra o mundo — o deslocamento REAL. Comparar
isso com o deslocamento PEDIDO (`Velocity * delta`, plano XZ) é mais
confiável que qualquer heurística de grade: se a razão real/pedido cai
abaixo de `PHYSICS.CHARACTER.BLOCKED_MOVEMENT_RATIO`, tem algo sólido na
frente que o pathfinding não previu, seja lá o que for — a tag
`MovementBlocked` marca isso (mesmo padrão de `Grounded`, calculada por
tick).

`creatureFollowSystem.js` reage: na BORDA DE SUBIDA da tag (ficou travada
agora, não já estava — `PathState.wasBlocked`), força `repathTimer = 0`
(recalcula já no próximo tick, sem esperar `REPATH_INTERVAL`) — só uma vez
por episódio de bloqueio, não todo tick enquanto a tag persiste (achado no
code review desta feature: forçar `repathTimer = 0` incondicionalmente
refazia o A* — com `grid.clone()`, ~7 mil alocações de nó pra uma grade de
60×60 — a até 60x/s enquanto a criatura ficasse travada, puro desperdício
de GC pra um sinal que só precisa disparar uma vez por episódio). Enquanto
travada, ignora o waypoint — usa `castRay` (`core/physics/raycast.js`) nas
duas perpendiculares da direção travada e segue pela que tiver mais
espaço livre, deslizando de lado até destravar em vez de continuar
empurrando reto contra o obstáculo. Autocorretivo: assim que o
deslocamento real voltar a bater com o pedido, a tag some e a criatura
volta a seguir o waypoint normalmente — sem temporizador de "tentando há
muito tempo".

## Configuração

`GAME_CONFIG.PARTY`: `SUMMON_OFFSET` (distância do treinador ao nascer, na
direção da câmera travada no disparo), `FOLLOW_MIN_DISTANCE` (distância
mínima do treinador — parada dentro dela), `RUN_DISTANCE` (além dela,
corre em vez de andar), `AVOIDANCE_RADIUS`/`AVOIDANCE_STRENGTH` (evasão
entre personagens, ver seção acima). `FOLLOW_SPEED` (velocidade única,
global) foi removido — cada espécie usa sua própria `walkSpeed`/
`runSpeed` agora.

`GAME_CONFIG.PLAYER_ACTIONS.summon`/`recall`: `DURATION`/`EFFECT_AT`,
mesmo formato de `dash`/`throw`/`consume` — `partySummonSystem.js` é
quem lê e aplica, não `playerActionSystem.js`.

`GAME_CONFIG.PATHFINDING` (novo):

- `CELL_SIZE`: tamanho (m) de cada célula da grade.
- `OBSTACLE_MARGIN`: margem (m) inflada no contorno de cada obstáculo.
- `REPATH_INTERVAL`: segundos entre recálculos de caminho por criatura.
- `WAYPOINT_ARRIVAL_DISTANCE`: distância (m) pra considerar um waypoint
  alcançado.
- `MAX_CLIMB_STEP`: diferença de elevação (m) entre células vizinhas
  acima da qual vira penhasco intransponível sem rampa.
- `MAX_SHORTCUT_DISTANCE`: distância máxima (m) de um salto suavizado do
  caminho (`boundedSmoothPath`) — maior que distâncias comuns em campo
  aberto (mantém o de sempre, um waypoint só até o alvo), bem menor que um
  atalho perigoso atravessando vários terraços/rampas.
- `AVOIDANCE_PROBE_DISTANCE`: distância (m) dos dois raycasts laterais de
  evasão local (`MovementBlocked`, ver seção acima).

`GAME_CONFIG.PHYSICS.CHARACTER` também ganhou dois novos:
`MIN_BLOCKED_CHECK_DISTANCE` (deslocamento pedido mínimo (m) pra sequer
considerar a checagem) e `BLOCKED_MOVEMENT_RATIO` (razão real/pedido
abaixo da qual marca `MovementBlocked`).

## Depuração (`F2`)

`PathfindingDebugView.jsx` desenha, por criatura invocada, uma linha
(ciano) do caminho que ela está seguindo agora — cada ponto na altura real
do heightmap, então a linha sobe acompanhando rampa/terraço de verdade em
vez de flutuar reta. `DebugPanel.jsx` lista, por criatura, quantos
waypoints faltam e quanto falta pro próximo recálculo.

## Arquivos-chave

- `core/systems/creatureFollowSystem.js` — Velocity/Rotation, walk/run,
  segue waypoints do pathfinding, evasão entre personagens (repulsão
  proativa), reage a `MovementBlocked`.
- `core/systems/partySummonSystem.js` — `beginSummon`/`beginRecall`
  (disparo: trava `ActionState`, gira o treinador pra câmera/criatura) e
  `applySummon`/`applyRecall` (efeito, no `EFFECT_AT`: física + spawn/
  destroy), recolhimento automático ao desequipar.
- `core/systems/playerActionSystem.js` — ignora explicitamente `current`
  fora de `'dash'`/`'throw'`/`'consume'`, pra não dobrar o `elapsed` de
  uma ação de invocar/recolher em andamento.
- `core/aim.js` — `resolveCameraYaw(world)` (novo), compartilhado por
  `beginSummon`/`beginRecall` — devolve `orbit.yaw + π` (a direção que a
  câmera mostra), não o `orbit.yaw` cru (ângulo alvo→câmera).
- `core/data/animationStates.js` — `'summon'` reusa o id/clipe `'throw'`;
  `'recall'` ganhou id próprio (`oneShot`, sem clipe ainda).
- `core/traits/components/action.js` — `ActionState` ganhou `pendingSlot`
  (qual slot uma invocação/recolhimento em andamento diz respeito).
- `core/systems/characterPhysicsSystem.js` — genérico, pulo restrito a
  `InputControlled`, calcula `MovementBlocked`. Colide contra qualquer
  personagem sem filtro (não filtra mais outros personagens — ver
  "Personagens colidem de verdade" acima).
- `core/physics/colliders.js` — `createCharacterBody` (já existia),
  `destroyCharacterBody` (novo). Sem grupo de interação especial — uma
  tentativa anterior marcava personagens pra se ignorarem entre si
  (revertida).
- `core/traits/components/physics.js` — `PhysicsBody`/`CharacterController`
  (docstring atualizada, dono de escrita não é mais só o bootstrap),
  `MovementBlocked` (nova tag).
- `core/pathfinding.js` — grade de navegação, heightmap, `findPath`,
  `boundedSmoothPath`.
- `core/traits/components/pathfinding.js` — `PathState` (caminho
  cacheado por criatura, inclui `wasBlocked` pra detectar a borda de
  subida de `MovementBlocked`).
- `core/data/testLevel.js` — trilha de teste (4 terraços), reforço físico
  sob cada rampa.
- `core/physics/raycast.js` — `castRay` (já existia, usado agora também
  pela evasão local).
- `tools/debug/PathfindingDebugView.jsx` — visualização do caminho no F2.
- Não muda: `view/scene/CreatureView.jsx`, `view/systems/animationSystem.js`,
  `core/systems/animationStateSystem.js`, `core/systems/syncPhysicsSystem.js`,
  `core/systems/movementSystem.js` (já travava movimento pra qualquer
  `ActionState.current` não-nulo, sem precisar saber quais valores
  existem), `view/loop/registerSystems.js` (ordem já estava certa).

## Testes

- `core/systems/creatureFollowSystem.test.js` — testa `Velocity`/
  `Rotation` resultantes (parada/anda/corre conforme distância, gira em
  direção ao movimento, parada não gira), desvio de obstáculo via
  pathfinding, throttle de recálculo (`repathTimer`), reação a
  `MovementBlocked` (desvia lateralmente em vez de ir reto, força
  recálculo só na borda de subida — não todo tick enquanto travada), e
  evasão entre personagens (desvia de outra criatura próxima mesmo indo
  em direção ao treinador; usa só repulsão, sem congelar, se estiver perto
  demais de outra criatura mesmo já dentro de `FOLLOW_MIN_DISTANCE`; sem
  ninguém por perto continua parando normalmente). Testes de direção
  rodam vários ticks até convergir (`Velocity` segue `Rotation`
  suavizada, não bate com o alvo já no 1º tick de propósito — mesmo
  padrão do teste de rotação); o teste de config ao vivo confere pela
  MAGNITUDE de `Velocity` (`hypot(vel.x, vel.z)`, que reflete `speed`
  desde o 1º tick, já que `sin²+cos²=1` independe da rotação ainda não
  ter convergido) em vez de esperar a direção também.
- `core/systems/partySummonSystem.test.js` — reescrito pro modelo de ação
  com duração (mesmo padrão de `playerActionSystem.test.js`: dispara,
  confere que trava `ActionState`/gira o treinador SEM efeito ainda,
  ticka até o instante de efeito, confere o efeito exatamente uma vez).
  Cobre: espécie/slot vazios não iniciam ação nenhuma; rotação pra
  direção da câmera/criatura no disparo; criatura só nasce/some no
  `EFFECT_AT`; ação encerra sozinha em `DURATION`; recolhimento
  automático ao desequipar (inclusive esperando uma ação em andamento
  terminar antes); exclusão mútua nos dois sentidos; invocar as 3
  criaturas do time precisa ser sequencial agora (uma ação de cada vez).
- `core/systems/characterPhysicsSystem.test.js` — entidade sem
  `InputControlled` (ex.: uma criatura) não pula mesmo com
  `input.jump: true`; `MovementBlocked` marca ao empurrar reto contra uma
  parede e desmarca ao soltar o input; jogador é barrado por uma criatura
  parada no meio do caminho (colisão real entre personagens, não se
  atravessam), e a criatura não se move sozinha (corpo cinemático não é
  empurrado por colisão).
- `core/data/animationStates.test.js` — `resolveAnimationState`:
  `action: 'summon'` resolve pra `'throw'`; `action: 'recall'` resolve
  pra `'recall'`. `isOneShotAnimationState('recall')` também `true`.
- `core/pathfinding.test.js` (novo) — bake de elevação (rampa interpola,
  terraço é constante), regra de penhasco (célula sem rampa fica
  bloqueada), desvio de obstáculos sólidos, alcança o topo da trilha de
  teste, e o salto suavizado nunca passa de `MAX_SHORTCUT_DISTANCE`
  (regressão do bug do atalho de 20-30m).

## Fora de escopo

- Criatura pular — só o jogador tem essa ação.
- Colisão da criatura com o jogador/outras criaturas invocadas (só contra
  o mundo estático, mesmo raciocínio do jogador).
- Combate/captura de criaturas selvagens — não existe criatura selvagem
  de verdade ainda (backlog "Criaturas selvagens no mundo", separado).
- Modelo 3D distinto por espécie de time — continuam o mesmo `.glb`, só o
  tint de cor muda (decisão de `013-criaturas-de-time.md`, inalterada).
- Navegação com andares literalmente empilhados no mesmo X/Z (uma
  elevação por célula não modela isso — ver "Limitação assumida" acima).
- Recálculo de caminho reativo a mudança de nível em runtime — o nível
  (`TEST_LEVEL`) é estático hoje, a grade nunca precisa ser invalidada.
