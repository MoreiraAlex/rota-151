# 026 — Preparo do treinador `boy`

## Contexto

Depois da 025 (ataque comum de criatura), o usuário passou a implementar
o `boy` — um modelo de treinador de verdade, substituindo o antigo `bot`
placeholder (`PLAYER_SPECIES_ID = 'boy'`, `core/data/species/index.js`).
Este doc consolida as quatro rodadas de acerto que saíram dessa migração
— cada uma um problema concreto encontrado testando o `boy` de verdade,
não um plano fechado desde o início:

1. Osso da mão (arremesso/recall não seguia o `boy` de verdade).
2. Posicionamento da câmera por espécie (mecanismo + desvio de ombro
   sempre ativo).
3. Textura da íris/pupila do olho (tentativa — revertida depois, ver
   nota no fim da seção).
4. Estados de animação de dash/queda.

Renomeado de `026-camera-por-especie.md` — o nome original só cobria o
item 2; o usuário pediu pra consolidar tudo e ajustar o nome pra refletir
o escopo de verdade.

## 1. Osso da mão (`HAND_BONE_BY_SPECIES`)

Pedido: "Para a nova feature estou implementando o boy. E mesmo eu
configurando para ele lançar os objetos no bone do boy, não tá
respeitando."

Investigado: `heldItemViewSystem.js`/`RecallBeamView.jsx` (o item
encaixado na mão antes de soltar, e a ponta do feixe de recall) resolvem
o osso de verdade via `HAND_BONE_BY_SPECIES[PLAYER_SPECIES_ID]`
(`view/handBoneBySpecies.js`) — esse mapa só tinha `bot: 'RHand'`. Sem
entrada pra `boy`, o lookup devolvia `undefined`, e os dois caíam no
fallback silencioso de "sem osso" (item nunca anexado a nada) — os
campos que o usuário estava mexendo (`actions.throw.handForwardOffset`/
etc., em `boy/index.js`) são a origem da TRAJETÓRIA (cálculo `core/`,
sem acesso a osso nenhum), uma coisa DIFERENTE do encaixe visual — por
isso não "respeitavam" nada, eram config certa resolvendo o problema
errado.

Nome do osso conferido direto no `.glb` (nós do glTF, sem navegador —
`boy.glb` usa a MESMA convenção que `bot.glb`, `RHand`/`LHand`, não
`mixamorig_RightHand` como um comentário antigo em `boy/index.js`/
`bot/index.js` especulava — corrigido também). Fix: `boy: 'RHand'`
adicionado em `HAND_BONE_BY_SPECIES`.

## 2. Câmera por espécie

Pedido: "preciso que eu possa configurar o posicionamento da câmera em
relação ao model jogável, isso para cada espécie, pois em tese vou poder
controlar todas." Não é "ajustar a câmera pro boy" — é uma CAPACIDADE:
qualquer espécie (treinador ou criatura) pode, em tese, acabar sendo
pilotada (troca de controle, docs/features/018), então o enquadramento
não podia continuar sendo um conjunto único de constantes globais
pensado só pra um corpo humanoide (`TARGET_HEIGHT: 1.5` foi calibrado
pro `bot` antigo — capsuleRadius 0.4/capsuleHalfHeight 0.95 —, e o `boy`,
bem menor — 0.3/0.7 —, herdou o mesmo valor sem recalibrar).

### Mecanismo (1ª rodada)

Novo campo opcional `camera` por espécie (`core/data/species/<id>/
index.js`, documentado em `_template/index.js`):

```js
camera: {
  targetHeight: 1.5,   // altura (m, acima de Position.y) do ponto de foco
  shoulderOffset: 0.4, // desvio lateral (m) do enquadramento
}
```

Opcional — sem declarar, cai exatamente no comportamento de antes
(`GAME_CONFIG.CAMERA.TARGET_HEIGHT`/`.SHOULDER_OFFSET`, agora DEFAULTS,
não mais valores fixos). Só o MECANISMO foi entregue nessa rodada —
nenhuma espécie ganhou override ainda (sem navegador neste sandbox pra
calibrar número nenhum por espécie, seria só adivinhação).

`computeCameraPosition`/`computeLookAtPoint`/`computeAimRay`
(`core/camera/orbitCamera.js`) passaram a RECEBER `targetHeight`/
`shoulderOffset` como parâmetros opcionais (default nos globais de
sempre) em vez de ler `GAME_CONFIG.CAMERA` internamente — são geometria
pura, sem acesso a `core/data/species`; quem resolve a espécie certa é
cada CHAMADOR:

- **`cameraFollowSystem.js`** (câmera renderizada, qualquer
  `CameraTarget`): nova `resolveControlledSpecies(entity)` — criatura
  (`SummonedCreature` presente) ou treinador (`getPlayerSpecies()`),
  mesmo critério que `creatureAttackSystem.js`/`aimAnchorSystem.js` já
  usavam.
- **`resolveAimPoint`** (`core/aim.js`, mira do arremesso/esfera) —
  SEMPRE o treinador (mira é exclusiva dele); resolve
  `getPlayerSpecies().camera` internamente, assinatura inalterada.
- **`resolveAimDirection`** (`core/aim.js`, mira genérica — usada pelo
  ATAQUE DE CRIATURA) — ganhou um 4º parâmetro opcional (`targetHeight`);
  `creatureAttackSystem.js`/`AttackRangeDebugView.jsx` resolvem
  `species.camera.targetHeight` da criatura atacante e passam.

**Bug adicional achado no processo**: nem `computeCameraPosition` nem
`computeLookAtPoint` recebiam o `TARGET_HEIGHT` já resolvido localmente
em `cameraFollowSystem.js` — caíam direto no global por dentro mesmo
assim. Ou seja, o enquadramento LIVRE (sem mirar) nunca teria respeitado
um `targetHeight` por espécie, só o TRAVADO (mirando) teria. Corrigido
threading o valor resolvido em TODAS as chamadas.

### `shoulderOffset` sempre ativo (2ª rodada)

Pedido: "agora eu preciso que a config de shoulderOffset esteja sempre
ativa, não só quando mirar." Antes, o desvio "sobre o ombro" só aparecia
com `AimAnchor` travado (botão direito segurado); o enquadramento padrão
sempre centralizava o personagem.

- **Posição**: `if (anchor?.active && SHOULDER_OFFSET)` virou só
  `if (SHOULDER_OFFSET)` — aplicado incondicionalmente.
- **Enquadramento**: `freeLookAt` (renomeado `framedLookAt`) passou de
  `computeLookAtPoint(pos, orbit, 0, ...)` (sem desvio) pra
  `computeLookAtPoint(pos, orbit, 1, ...)` (desvio COMPLETO sempre).
- **Precisão da mira preservada**: travado, a câmera continua olhando
  EXATAMENTE pro `AimAnchor` (`lockedLookAt`), não pro `framedLookAt` —
  o `aimBlend` (0↔1, suavizado) interpola do enquadramento padrão (já
  com desvio) até o ponto travado exato; só os dois extremos da
  interpolação mudaram ("sem desvio ↔ travado" virou "sempre desviado ↔
  travado"). O retículo continua batendo com o arremesso (`computeAimRay`
  já usava `aimBlend: 1` internamente pra isso, independente do estado
  visual de mirar).

**Teste quebrado por sintonia do usuário, não pelo código**: depois
dessa mudança, `playerActionSystem.test.js`/`partySummonSystem.test.js`
(2 testes) começaram a falhar — efeito colateral da 1ª rodada: o usuário
configurou `boy.camera.targetHeight: 1.2` (diferente do default global,
uso pretendido da feature), mas os dois testes reproduziam
`computeAimRay(pos, orbit)` SEM passar `targetHeight`/`shoulderOffset`,
caindo nos globais hardcoded — divergindo do que o sistema de verdade
calcula agora. Corrigido lendo `getPlayerSpecies().camera` de verdade
nos dois lugares que reproduzem a fórmula pra comparação.

## 3. Estados de animação: dash e queda

Pedido: "vou implementar as animações de dash e falling no boy, consegue
verificar se só preciso alimentar a pasta clips?"

- **`dash`**: JÁ estava pronto — `core/data/animationStates.js` já
  resolve `'dash'` por `ActionState.current === 'dash'`, já é `oneShot`
  (reinicia o relógio), já vence locomoção. `animationSystem.js` já cai
  no fallback de pose de descanso quando o clipe não existe, mesmo
  princípio de `throw`/`recall`. Confirmado: é só conteúdo — autorar
  `boy/clips/dash.json` (`speed = 1/GAME_CONFIG.PLAYER_ACTIONS.dash.
  DURATION = 1/0.25 = 4`, mesma convenção de `throw.json`), importar e
  referenciar `dash: DASH_CLIP` em `boy/index.js`.
- **`fall`**: NÃO estava pronto — `ctx.grounded` já existia (trait
  `Grounded`, calculado em `characterPhysicsSystem.js`), mas
  `ANIMATION_STATES` não tinha NENHUMA entrada pra "no ar": caía direto
  no fallback `idle`. Adicionada `{ id: 'fall', when: (ctx) =>
  !ctx.grounded }`, CÍCLICA (não `oneShot` — tempo no ar é variável,
  sem "fase certa" de início, mesmo grupo de walk/run/idle), logo antes
  do fallback `idle`. A partir daqui, mesma situação do dash: só falta
  `boy/clips/fall.json` + `fall: FALL_CLIP` em `boy/index.js`.

## Fora de escopo (de propósito)

- **Valores de `camera` por espécie** — só o mecanismo; nenhuma espécie
  ganhou override calculado por mim (sem navegador pra calibrar).
- **Distância/pitch/zoom por espécie** — ficam GLOBAIS de propósito
  (preferência de controle do jogador, não posicionamento relativo ao
  modelo).
- **Clipes de verdade pra `dash`/`fall`** — o usuário vai autorar; esta
  rodada só confirmou/completou o MECANISMO.
- **Distinguir "subindo" de "caindo"** (`fall` hoje é um estado só pro ar
  inteiro) — `vel.y` já está disponível em `animationStateSystem.js` se
  um dia precisar separar os dois, não implementado por não ter sido
  pedido.

## Arquivos

- **Seção 1 (osso da mão)**: `view/handBoneBySpecies.js` (`boy: 'RHand'`
  adicionado); `core/data/species/boy/index.js`/`bot/index.js`
  (comentário `mixamorig_RightHand` corrigido pra `RHand`);
  `view/scene/RecallBeamView.jsx` (mesma correção de comentário).
- **Seção 2 (câmera), 1ª rodada**: `core/camera/orbitCamera.js` (+
  teste); `core/aim.js`; `view/systems/cameraFollowSystem.js`;
  `core/systems/creatureAttackSystem.js`/`tools/debug/
  AttackRangeDebugView.jsx`; `core/data/species/_template/index.js`.
- **Seção 2 (câmera), 2ª rodada**: `view/systems/cameraFollowSystem.js`;
  `core/systems/playerActionSystem.test.js`/`core/systems/
  partySummonSystem.test.js`.
- **Seção 3 (animações)**: `core/data/animationStates.js` (+ teste);
  `core/systems/animationStateSystem.test.js`; `core/data/species/
  _template/index.js` (documenta `dash`/`fall` opcionais em `clips`).

## Testes

- `core/camera/orbitCamera.test.js` — `computeCameraPosition` (novo
  describe: sem `targetHeight` usa o default global, com substitui);
  `computeLookAtPoint`/`computeAimRay` (um teste cada confirmando
  override). Testes pré-existentes (sem os parâmetros novos) continuam
  passando — defaults preservam o comportamento de antes.
- `playerActionSystem.test.js`/`partySummonSystem.test.js` — fórmula de
  mira esperada corrigida pra ler `getPlayerSpecies().camera` real.
- `core/data/animationStates.test.js` — "no ar → fall, não importa a
  velocidade horizontal" (substituiu o teste antigo de "no ar → idle");
  "dash"/"throw" continuam vencendo `fall`; `fall` confirmado não-`oneShot`.
- `core/systems/animationStateSystem.test.js` — "no ar (sem Grounded) →
  fall" (idem, substituiu a expectativa de `idle`).
- Sem teste pra `cameraFollowSystem.js`/`resolveControlledSpecies`/osso
  da mão (systems de view, mesmo precedente de sempre — sem malha/câmera
  real pra verificar visualmente neste sandbox).
- Suíte completa conferida depois de cada rodada (`nvm exec 20.20.2 npx
  vitest run` — este ambiente roda em Node 18, incompatível com o
  `rolldown` instalado pelo Vitest/Vite; Node 20.20.2, já disponível via
  `nvm`, funciona): mesma baseline pré-existente de sempre (9 falhas — 8
  determinísticas + `wildCreatureSpawnSystem` ocasionalmente flaky),
  nenhuma nova em nenhuma rodada.