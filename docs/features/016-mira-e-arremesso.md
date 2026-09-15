# 🚀 Versão 0.0.16 — Mira e Arremesso

Mira em terceira pessoa com retículo fixo no centro da tela, arremesso que
converge de verdade no que está sob a mira (com alcance e trajetória
configuráveis), lock-on estilo Zelda pra circular um ponto travado,
colisão de câmera e de projétil contra o mundo, e o item equipado visível
na mão do jogador antes de sair da mão de fato.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Visão geral

Segurar o botão direito trava a mira num ponto do mundo (`AimAnchor`) e
muda três coisas ao mesmo tempo: a câmera passa a orbitar esse ponto
sozinha (sem precisar de mouse), o movimento do jogador passa a ser
relativo a ele (radial/tangencial, "circular ao redor"), e o botão
esquerdo passa a valer (arremessar ou usar o item equipado). Soltar o
botão devolve tudo ao normal.

## Mira e câmera

### Retículo

`tools/hud/Crosshair.jsx` — um ponto fixo (CSS) no centro da tela.
Puramente decorativo, não lê nenhum trait. Visível só enquanto o botão
direito está de fato segurado (rastreia `mousedown`/`mouseup` do botão
direito por conta própria — soltar o botão, perder o Pointer Lock ou o
foco da janela escondem na hora).

### Câmera livre (sem mirar)

Órbita padrão em torno do jogador (`OrbitCamera`: `yaw`/`pitch`/
`distance`) — mouse controla `yaw`/`pitch` (`cameraControlSystem.js`),
scroll controla `distance`. A câmera sempre olha direto pro jogador (mais
`TARGET_HEIGHT`), sem nenhum desvio.

### Lock-on ao mirar

Segurar o botão direito trava um ponto (`AimAnchor`, resolvido por
raycast a partir da câmera — `core/aim.js#resolveAimPoint`, mesmo alcance
`AIM_RANGE` do arremesso) **uma única vez**, no instante em que o botão é
apertado — enquanto segurado, o ponto não recalcula, nem com o jogador se
movendo, nem com o mouse mexendo. Soltar libera o ponto (`AimAnchor.active
= false`; as coordenadas continuam nos campos, só não devem mais ser
lidas).

Travado:

- **`cameraControlSystem.js`** para de aplicar deltas de mouse em
  `orbit.yaw`/`pitch` (fica congelado); o zoom (scroll) continua livre.
- **`cameraFollowSystem.js`** passa a calcular `yaw`/`pitch` de
  posicionamento sozinho, a cada frame, a partir do vetor 3D entre o
  ponto travado e o "olho" do jogador (`Position` + `TARGET_HEIGHT`) — a
  câmera sempre fica do lado OPOSTO ao alvo em relação ao jogador,
  acompanhando conforme ele circula o ponto (radial ou tangencialmente).
  `distance` continua vindo do `orbit` normalmente (scroll).
- **Desvio de ombro** (`SHOULDER_OFFSET`) desloca a POSIÇÃO da câmera pro
  lado (`computeCameraRight`), nunca pra onde ela olha — o retículo
  continua sempre exatamente em cima do `AimAnchor`, então o arremesso
  (que mira nesse mesmo ponto) nunca diverge do que a tela mostra, não
  importa o quanto a câmera se deslocou lateralmente.
- **Transição suave** (`aimBlend`, 0–1, estado de tela em
  `cameraFollowSystem.js`, desliza via `AIM_BLEND_SMOOTHING`): o ponto que
  a câmera de fato olha é a interpolação entre "olhar pro jogador" (livre)
  e "olhar pro `AimAnchor`" (travado) — evita o salto de rotação instantâneo
  que `camera.lookAt` daria trocando de alvo de uma vez. Funciona nos dois
  sentidos (entrando e saindo da mira) porque as coordenadas do
  `AimAnchor` continuam disponíveis mesmo depois de `active` virar falso.
- Ao **soltar**, o mouse retoma o controle de `orbit.yaw`/`pitch` a partir
  de onde estavam ANTES da mira começar (não sincroniza com a direção que
  a câmera travada tinha alcançado) — a câmera pode reajustar
  visivelmente se o jogador circulou bastante o alvo, mas a transição de
  olhar em si (`aimBlend`) continua suave.

### Colisão da câmera

`cameraFollowSystem.js#resolveCameraCollision` — sempre ativa, mirando ou
não: um raycast do pivô (jogador + `TARGET_HEIGHT`) até a posição
desejada da câmera; batendo em algo antes da distância cheia, a câmera
aproxima pra logo antes do ponto de impacto (`COLLISION_MARGIN` de folga,
nunca menos que `MIN_DISTANCE_AFTER_COLLISION` — piso independente do
`MIN_DISTANCE` do zoom manual). Exclui a própria cápsula do jogador.

## Movimento durante a mira

Com `AimAnchor.active`, `movementSystem.js` troca só o REFERENCIAL do
input: em vez do yaw da câmera, "frente"/"trás" (radial) aproxima/afasta
do ponto travado, "esquerda"/"direita" (tangencial) circula ao redor dele.
A ROTAÇÃO do personagem continua seguindo o próprio movimento resultante
(`atan2` da direção que ele está de fato andando) — não encara o ponto
travado; quem cuida de manter o alvo em vista é só a câmera (acima).
Parado, não gira.

Outras regras, independentes da mira:

- Uma ação em andamento (`ActionState.current` não-nulo — arremesso, uso,
  dash) trava o movimento por completo (`vel.x/z = 0`, sem girar).
- Mirando, correr não vale — a velocidade cai pra `walkSpeed` mesmo
  segurando o modificador de corrida com stamina de sobra. Soltar o botão
  direito devolve a corrida no tick seguinte.

## Arremesso

### Disparo

`playerActionSystem.js` — botão esquerdo (`input.primary`) só faz efeito
enquanto mirando (`input.aiming`); sem isso, clicar não faz nada. Precisa
de um item `throwable` equipado (`HeldItem`) e stamina suficiente
(`STAMINA_COST`) — sem stamina, o arremesso simplesmente não dispara. O
mesmo gatilho (`primary` + `aiming`) também cobre o uso de um item
`consumable` (ver docs/features/014-arremessar-usar-e-invocar.md) — as
duas ações compartilham a condição de entrada, cada uma com sua própria
`DURATION`/`EFFECT_AT`.

### Trajetória

Reto, sem arco nem gravidade (`resolveThrowLaunch`): normaliza o vetor da
origem até o ponto de mira e multiplica por `THROW.SPEED`. O ponto de
mira é o `AimAnchor` travado quando ativo (o mesmo que a câmera está
mostrando — não recalcula por conta própria) ou, sem ancoragem, resolvido
na hora (`resolveAimPoint`, raycast da câmera até `AIM_RANGE` — sem nada
no caminho, mira no limite do alcance mesmo, nunca no infinito). O raio de
mira/trajetória exclui a própria cápsula de quem arremessa.

A origem (de onde a trajetória sai, e onde o `Projectile` de fato nasce)
é uma aproximação da mão (`resolveHandOrigin(pos, rotY)`): desloca a
partir de `Position` na direção que o corpo encara (`HAND_FORWARD_OFFSET`)
e à direita dele (`HAND_SIDE_OFFSET`), numa altura fixa
(`HAND_HEIGHT_OFFSET`) — o motor headless não tem acesso ao osso da mão de
verdade (isso é só visual, ver "Item na mão" abaixo), então é "mais ou
menos" por design, não pixel-perfeito.

O corpo gira pra encarar a direção do arremesso no instante do disparo
(`Rotation.y`, só o componente horizontal — sem transição suave, é um
snap).

### Timing da ação

`GAME_CONFIG.PLAYER_ACTIONS.throw.DURATION`/`EFFECT_AT` precisam bater com
o clipe de animação de verdade (`core/data/species/<id>/clips/throw.json`):
clipes de AÇÃO (não cíclicos) usam `speed` como `1/duração` (ver a skill
`procedural-rig-animation`, referência `animations/one-shot-actions.md`)
— `DURATION` tem que ser exatamente `1/clip.speed`. Errar pra mais faz o
gesto reiniciar do começo antes de cortar pro idle (nada no motor trava o
clipe no fim; ele só repete o mesmo gesto fechado). `EFFECT_AT` (o
instante em que o `Projectile` de fato nasce) devia coincidir com o frame
em que a mão solta o objeto — isso está embutido na FORMA da curva, não
dá pra derivar só do `speed`; ajusta-se olhando o jogo.

### Projétil

`projectileSystem.js` — colisão real contra o mundo: um raycast varrido a
cada tick (da posição atual até onde a integração levaria no próximo
tick, não um raycast pontual — sem isso um projétil rápido atravessaria
paredes finas). Ao colidir, `Position` para exatamente no ponto de
impacto, `Velocity` zera, `Projectile.hit` vira `true` — a partir daí só
conta `LIFETIME` pra baixo (não é destruído na hora, some sozinho depois).
`LIFETIME` sempre conta a partir do lançamento, atingindo algo ou não.
Exclui a cápsula de quem arremessou. `tools/debug/DebugPanel.jsx` lista
cada projétil ativo como "voando" ou "atingiu em x, y, z".

## Item na mão

`view/systems/heldItemViewSystem.js` — mostra o item equipado encaixado
de verdade no osso da mão (`bone.add(mesh)`, Three.js puro — o osso vira
pai da esfera, então ela acompanha qualquer pose, inclusive o próprio
gesto de arremesso, sem esse system recalcular posição nenhuma). Nome do
osso por espécie fica num mapa só nesse arquivo
(`HAND_BONE_BY_SPECIES` — hoje só `bot`: `mixamorig_RightHand`), não em
`core/data/species/<id>/` (nome de osso é conteúdo de rig 3D, preocupação
de view). Sem modelo 3D próprio por item ainda, usa a mesma esfera cinza
do projétil em voo (`view/scene/throwableVisual.js`).

Visível enquanto: item equipado é `throwable` E a mira está travada E
ainda não passou do instante de liberação (`EFFECT_AT`) da ação atual —
depois disso, some (virou o `Projectile` de verdade).

A esfera compensa a escala composta da hierarquia do modelo (o modelo
inteiro renderiza bem menor que 1:1 — `PLAYER_SPECIES.model.scale`, além
de qualquer escala embutida no próprio `.glb`): lê a escala mundial de
verdade do osso (`bone.getWorldScale`) e aplica o inverso como escala
local, então `THROWABLE_RADIUS` vale em unidades de mundo de verdade, não
importa quanto o modelo esteja escalado por baixo.

## Animação

`core/data/animationStates.js` — cada estado pode ser marcado
`oneShot: true` (hoje `dash` e `throw`). `view/systems/animationSystem.js`
reinicia o relógio do clipe (`entry.elapsed = 0`) sempre que entra num
estado `oneShot` — sem isso, o relógio (compartilhado entre qualquer
clipe que a entidade toque) continuaria de onde estava, fazendo a ação
recomeçar NO MEIO do próprio gesto se disparada de novo antes do relógio
dar uma volta. Estados cíclicos (`idle`/`walk`/`run`) nunca reiniciam —
não existe "fase certa" de início pra um ciclo de passada.

`AnimationState.direction` (1 ou -1) inverte o sentido de progressão do
relógio quando o movimento é contrário à direção que o corpo encara
(produto escalar entre velocidade e o vetor de frente) — evita o efeito
"moonwalk" nesse caso. Não existe marcha lateral dedicada ainda: andando
puramente de lado, o clipe de andar pra frente continua tocando enquanto
o corpo desliza — exigiria autoria de curvas novas por osso.

## Configuração

Todos os campos abaixo são ajustáveis ao vivo pelo menu de Configurações
(v0.0.15) — os valores atuais em `core/gameConfig.js` podem já ter mudado
desde que este texto foi escrito; o que importa aqui é o papel de cada um,
não o número corrente.

**`GAME_CONFIG.CAMERA`**: `MIN_PITCH`/`MAX_PITCH` (limites do ângulo
vertical livre), `MIN_DISTANCE`/`MAX_DISTANCE` (limites do zoom manual),
`MOUSE_SENSITIVITY`, `ZOOM_SPEED`, `SMOOTHING` (rigidez do
acompanhamento de posição), `AIM_BLEND_SMOOTHING` (rigidez da transição
de olhar ao entrar/sair da mira), `TARGET_HEIGHT` (altura do ponto de
mira acima da origem do alvo), `SHOULDER_OFFSET` (desvio lateral da
câmera travada — `0` desativa), `COLLISION_MARGIN`/
`MIN_DISTANCE_AFTER_COLLISION` (folga e piso da colisão de órbita).

**`GAME_CONFIG.PLAYER_ACTIONS.throw`**: `DURATION`/`EFFECT_AT` (timing da
ação, precisa bater com o clipe — ver acima), `HAND_FORWARD_OFFSET`/
`HAND_SIDE_OFFSET`/`HAND_HEIGHT_OFFSET` (aproximação da origem na mão),
`SPEED` (velocidade do projétil), `LIFETIME` (segundos até desaparecer
sozinho), `AIM_RANGE` (alcance do raycast de mira), `STAMINA_COST`.

## Arquivos-chave

- `tools/hud/Crosshair.jsx` — retículo.
- `core/camera/orbitCamera.js` — geometria pura da órbita
  (`computeOrbitOffset`, `computeCameraPosition`, `computeCameraRight`,
  `computeLookAtPoint`, `computeAimRay`).
- `core/systems/cameraControlSystem.js` — mouse/scroll → `OrbitCamera`.
- `view/systems/cameraFollowSystem.js` — `OrbitCamera` → câmera Three de
  verdade (posição, colisão, `aimBlend`, olhar).
- `core/systems/aimAnchorSystem.js` — captura/libera `AimAnchor`.
- `core/aim.js` — `resolveAimPoint`, compartilhado entre a âncora e o
  arremesso sem ancoragem.
- `core/physics/raycast.js` — único ponto que chama `world.castRay` do
  Rapier.
- `core/systems/movementSystem.js` — referencial radial/tangencial.
- `core/systems/playerActionSystem.js` — disparo, trajetória,
  `resolveHandOrigin`, custo de stamina, spawn do `Projectile`.
- `core/systems/projectileSystem.js` — colisão varrida, congelamento no
  impacto.
- `view/systems/heldItemViewSystem.js` — item encaixado no osso da mão.
- `view/scene/throwableVisual.js` — aparência compartilhada (esfera) entre
  o item na mão e o projétil em voo.
- `core/data/animationStates.js` / `view/systems/animationSystem.js` —
  estados `oneShot`, direção do relógio de animação.
- `tools/debug/DebugPanel.jsx` — status de cada projétil ativo.

## Testes

Cobertos por suíte automatizada: `core/camera/orbitCamera.test.js`,
`core/physics/raycast.test.js`, `core/systems/cameraControlSystem.test.js`,
`core/systems/aimAnchorSystem.test.js`, `core/systems/movementSystem.test.js`
(suíte "com AimAnchor travado"), `core/systems/playerActionSystem.test.js`,
`core/systems/projectileSystem.test.js`, `core/data/animationStates.test.js`
(`isOneShotAnimationState`), `core/systems/animationStateSystem.test.js`.

Sem suíte própria (view systems — dependem de `THREE.Skeleton`/câmera de
verdade, sem como simular sem física/GLTF real): `cameraFollowSystem.js`,
`view/systems/animationSystem.js`, `heldItemViewSystem.js`. Validação
desses é manual, no `npm run dev`.

## Fora de escopo

- Colisão do projétil com outras entidades (criaturas, o próprio jogador)
  — só contra o mundo estático por enquanto.
- Indicador visual 3D de onde o raio de mira acerta (ex.: marcador no
  chão) — o retículo 2D é o único feedback.
- `AIM_RANGE`/`THROW.SPEED`/offsets de mão — continuam globais, não por
  item/espécie.
- Marcha lateral (strafe) dedicada na animação — ver "Animação" acima.
- Modelo 3D próprio por item — todo throwable usa a mesma esfera cinza
  (item na mão e projétil em voo).
