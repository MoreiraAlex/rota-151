# 🚀 Versão 0.0.18 — Troca de controle entre treinador e criatura

Até aqui o jogador só controlava o treinador; toda `SummonedCreature` era
sempre IA, seguindo ele (docs/features/013-criaturas-de-time.md e
docs/features/017-locomocao-e-recolhimento-de-criaturas.md). Esta feature
permite assumir o controle de uma criatura já invocada pelo teclado — o
treinador vira "o bot" e passa a ser seguido pela IA no lugar dela.
Controlando uma criatura, por enquanto só valem 4 verbos: andar, correr,
pular, dash — mirar, arremessar, consumir e invocar/recolher ficam de fora.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Visão geral

O motor já era surpreendentemente genérico por TRAIT, não por identidade
fixa ("é o treinador?"): `characterPhysicsSystem` já restringia o pulo a
`entity.has(InputControlled)` (não a "é o jogador"), e `movementSystem`/
`playerActionSystem`/`aimAnchorSystem`/`creatureFollowSystem` já processam
qualquer entidade com a combinação de traits certa. Isso significa que
"trocar de controle" é, no fundo, só **mover as tags `InputControlled`/
`CameraTarget` de uma entidade pra outra** — os systems que já existiam
passam a agir sobre quem estiver segurando a tag, sem saber ou se importar
qual entidade é. O trabalho desta feature foi, principalmente, preencher
as lacunas que impediam essa generalização de valer também para uma
criatura (traits que faltavam nela) e para o treinador virar seguidor
(idem).

## Troca de controle (`controlSwitchSystem.js`)

Novo system, `core/systems/controlSwitchSystem.js`. Mapeamento de teclas
(`platform/input/keyboardInput.js`):

- **Bot no controle**: `Q`/`E`/`R` continuam invocando/recolhendo os
  slots 1/2/3 (`secondary1-3`, inalterado desde a
  docs/features/011-slots-de-acao.md). `1`/`2`/`3` (`switchSlot1-3`, novo)
  trocam o controle pra criatura daquele slot, SE ela já estiver invocada
  — mesma correspondência de slot que `Q`/`E`/`R`, numa tecla diferente
  (evita a mesma tecla significar duas coisas ao mesmo tempo).
- **Criatura no controle**: `Q`/`E`/`R` ficam reservados pras futuras
  skills da criatura — não fazem nada ainda (`partySummonSystem.js` só
  reage a `secondaryN` quando `entity.has(InputControlled)` é o
  treinador, ver abaixo). `1`/`2`/`3` continuam significando "troque pro
  controle desse slot" — dá pra pular direto de uma criatura pra outra,
  sem passar pelo treinador no meio. `4` (`returnToBot`, novo) devolve o
  controle pro treinador.
- Trocar de controle nunca invoca nem recolhe nada, nem mexe em `Party` —
  só troca quem está sendo pilotado. Slot vazio ou sem criatura invocada:
  tecla de troca é no-op.

`switchControlTo(world, target)` move as duas tags juntas (`InputControlled`
+ `CameraTarget` sempre viajam para a mesma entidade — controlar e ver pela
mesma entidade) e é no-op se `target` já é quem está no controle. Acha "o
treinador" por `world.queryFirst(Party)` (trait exclusivo dele, nenhuma
criatura tem) — não importa `playerEntity` de `core/world/world.js`
diretamente, isso quebraria os testes headless (`makeWorld()` cria sua
própria entidade, sem relação com o singleton do jogo real). Registrado no
início da fase `simulation`, logo depois do bootstrap de física e ANTES de
todo o resto (`cameraControlSystem`, `movementSystem`, `aimAnchorSystem`,
`partySummonSystem`, `playerActionSystem`, `creatureFollowSystem`,
`characterPhysicsSystem`) — precisam ver a troca já aplicada no mesmo tick
em que ela acontece.

## O que faltava pra generalizar

1. **A criatura precisa caber nas queries** que hoje exigem
   `InputState`/`AimAnchor`/`HeldItem` (`movementSystem`,
   `playerActionSystem`, `aimAnchorSystem`) — `partySummonSystem.js`
   (`applySummon`) passou a dar esses três traits a toda criatura
   invocada, mesmo padrão já usado pra `Vitals`/`ActionState` ("sem uso
   real, só pra entrar na query"). Como `HeldItem.itemId` nunca é setado
   pra uma criatura, arremesso/consumo caem sozinhos no `else { return }`
   de `playerActionSystem.js` — viram no-op de graça, sem precisar
   excluir nada explicitamente. Dash não depende de item nenhum, já
   funciona assim que a criatura ganha `InputControlled`.
2. **Mirar fica de fora explicitamente** — não é um dos 4 verbos
   permitidos. `aimAnchorSystem.js` ignora qualquer entidade com
   `SummonedCreature`, mesmo segurando o botão direito; a criatura ainda
   carrega o trait `AimAnchor` (só pra entrar na query de
   `movementSystem`), mas nunca ativa `active`.
3. **`creatureFollowSystem.js` generalizado**: a query de seguidores
   trocou de `SummonedCreature` pra `CharacterController` (trait que
   treinador e toda criatura têm os dois) + pula quem tem
   `InputControlled` agora (é quem está sendo pilotado, não segue
   ninguém). Isso faz o TREINADOR virar seguidor automaticamente quando
   perde o controle — sem código dedicado pra "o bot segue a criatura", é
   a mesma lógica de sempre agindo sobre quem quer que não esteja no
   controle. A lista de "outros personagens" pra evasão proativa também
   simplificou: uma única `world.query(CharacterController, Position)`
   (era "o controlado" + "toda `SummonedCreature`" reconstruídos à parte,
   o que duplicava a própria criatura controlada na lista — contando
   repulsão dela 2x pros outros personagens).
4. **Treinador ganhou `PathState`** no spawn (`world.js`/
   `test/makeWorld.js`) — só existia em criaturas invocadas; sem isso,
   `entity.get(PathState)`/`entity.set(...)` (AoS, fora da query, mesmo
   padrão de sempre) não teria o que ler/escrever quando o treinador vira
   seguidor.
5. **Recolhimento automático desacoplado de `InputControlled`**: a query
   principal de `partySummonSystem.js` exigia `InputControlled` só porque
   era uma forma conveniente de achar "o treinador" — mas `Party` já é
   exclusivo dele. Trocando a query pra exigir só `Party` (não mais
   `InputControlled`) e movendo a checagem pra dentro, só ao redor da
   reação a `secondaryN`, o recolhimento automático (desequipar pelo
   `InventoryPanel`) volta a funcionar não importa quem esteja sendo
   pilotado no momento — só a reação MANUAL a `Q`/`E`/`R` fica de fato
   restrita a "o treinador está no controle".

## Ferramentas de debug respeitam a troca

As duas ferramentas de debug (`F2`) que existiam desde a
docs/features/017-locomocao-e-recolhimento-de-criaturas.md ainda estavam
fixas na ideia de "só existe o jogador" — corrigido nesta rodada:

- **`DebugPanel.jsx`**: posição/velocidade/animação/chão/cápsula/
  movimento/vitals liam sempre de `playerEntity`, fixo — passaram a ler de
  quem está com `InputControlled` AGORA (`useQueryFirst(InputControlled,
  Position)`, mesma técnica headless de achar "quem está sendo pilotado").
  Isso importa de verdade, não só visualmente: pular/dashar controlando
  uma criatura drena a STAMINA DELA (`characterPhysicsSystem.js`/
  `playerActionSystem.js` já eram gatiados por `InputControlled`, não por
  identidade), então o painel agora mostra o número certo. O botão de
  dano de debug também passou a aplicar em quem está controlado, não
  sempre no treinador. `heldItem`/`party` continuam fixos no treinador de
  propósito — são dados PRÓPRIOS dele (`Party`, item de arremesso
  equipado), sem sentido nenhum "pertencerem" à criatura enquanto ela é
  pilotada. Uma linha nova no topo ("controlando: treinador" ou
  "controlando: `<espécie>` (`<slot>`)") deixa explícito quem o resto do
  painel está descrevendo. A lista de status de caminho por criatura
  também parou de mostrar a criatura que está sendo controlada agora (o
  `PathState` dela ficou congelado no valor de antes da troca —
  `creatureFollowSystem.js` não toca mais nela — mostrar seria enganoso)
  e ganhou uma linha pro treinador quando ELE é quem virou o bot.
- **`PathfindingDebugView.jsx`** (linha ciano do caminho, na cena 3D):
  desenhava por `SummonedCreature`, fixo — a mesma generalização de
  `creatureFollowSystem.js` (por `CharacterController` menos quem tem
  `InputControlled` agora) resolve os dois sintomas relatados jogando de
  uma vez: a criatura controlada parava de ser movida por
  `creatureFollowSystem.js` mas a linha continuava desenhando o caminho
  velho e congelado dela, e o treinador nunca desenhava linha nenhuma
  mesmo quando ele é quem estava de fato seguindo (virou "o bot"). Agora a
  linha sempre corresponde exatamente a quem está se movendo sozinho no
  momento — some da criatura controlada, aparece no treinador quando for
  o caso.

## Arquivos-chave

- `core/systems/controlSwitchSystem.js` (novo) — decide a troca a partir
  de `switchSlot1-3`/`returnToBot`.
- `platform/input/keyboardInput.js` — `Digit1-3` → `switchSlot1-3`,
  `Digit4` → `returnToBot`. Também corrigido um bug real encontrado nesta
  rodada: `EDGE_KEY_MAP.KeyE` tinha duas entradas (`'dash'` e depois
  `'secondary2'`) — a segunda sobrescrevia a primeira silenciosamente
  (chave duplicada de objeto), deixando a linha de dash em `KeyE` morta;
  removida (dash já tinha `AltLeft`).
- `core/systems/partySummonSystem.js` — `applySummon` dá
  `InputState`/`AimAnchor`/`HeldItem` à criatura; `findSummoned` exportado
  (usado por `controlSwitchSystem.js`); query principal não exige mais
  `InputControlled`.
- `core/systems/aimAnchorSystem.js` — ignora entidades com
  `SummonedCreature`.
- `core/systems/creatureFollowSystem.js` — segue por `CharacterController`
  menos `InputControlled`, não mais por `SummonedCreature`; `others`
  (evasão) numa query só.
- `core/world/world.js`/`test/makeWorld.js` — treinador ganha `PathState`.
- `tools/debug/DebugPanel.jsx` — readouts seguem `InputControlled` (não
  mais `playerEntity` fixo); linha "controlando: ..."; status de caminho
  também pro treinador quando ele é o bot.
- `tools/debug/PathfindingDebugView.jsx` — desenha por `CharacterController`
  menos `InputControlled`, não mais por `SummonedCreature`.
- Não muda: `movementSystem.js`, `playerActionSystem.js`,
  `characterPhysicsSystem.js`, `animationStateSystem.js` (já genéricos
  por trait), `PlayerView.jsx`/`CreatureView.jsx` (renderizam por
  entidade/trait fixo, não por `InputControlled`), `heldItemViewSystem.js`
  (já tratava espécies sem osso de mão, como o `fox`, como "não mostra
  nada, não quebra" — seguro dar `HeldItem` pra criatura).

## Testes

- `core/systems/controlSwitchSystem.test.js` (novo) — troca do bot pra
  criatura de um slot invocado move as tags corretas; slot sem criatura
  invocada é no-op; troca direto de uma criatura controlada pra outra
  (sem passar pelo bot); `returnToBot` devolve o controle, e é no-op sem
  estar numa criatura; trocar pro próprio slot já controlado é no-op; não
  mexe em `Party` nem cria/destrói entidade nenhuma; sem treinador no
  world não quebra.
- `platform/input/keyboardInput.test.js` — atualizado pro remapeamento
  (dash só em `AltLeft`, `Q`/`E`/`R` como `secondary1-3`) e novos testes
  de `Digit1-4` (`switchSlot1-3`/`returnToBot`), incluindo auto-repeat e
  perda de foco.
- `core/systems/creatureFollowSystem.test.js` — `spawnCreature` (helper)
  ganhou `CharacterController` (query mudou de `SummonedCreature`); novo
  teste: com o treinador sem `InputControlled` e uma criatura com
  `InputControlled` (simulando pós-troca), o TREINADOR se move em direção
  à criatura, e a `Velocity` da criatura controlada não é tocada por este
  system.
- `core/systems/partySummonSystem.test.js` — novo teste: recolhimento
  automático dispara mesmo com o treinador fora do controle; novo teste:
  `secondaryN` não invoca/recolhe nesse estado. Também ganhou o padrão de
  limpeza `spawnWorld`/`afterEach(world.destroy)` já usado em
  `aimAnchorSystem.test.js`/`movementSystem.test.js`/
  `playerActionSystem.test.js` — o arquivo criava um world por teste sem
  nunca destruir, e bateu no teto de 16 worlds vivos do Koota ao ganhar
  mais dois testes nesta rodada.
- `core/systems/aimAnchorSystem.test.js` — novo teste: uma
  `SummonedCreature` com `InputControlled` nunca ativa `AimAnchor`, mesmo
  mirando.

## Fora de escopo

- Mirar, arremessar, consumir e invocar/recolher controlando uma
  criatura — só os 4 verbos citados.
- Skills próprias de criatura em `Q`/`E`/`R` — as teclas já estão
  reservadas, o comportamento em si é feature futura.
- Qualquer ação do jogador cancelar a troca automaticamente — só `4`
  devolve o controle pro treinador.
- HUD/crosshair/held item se ajustarem visualmente ao controlar uma
  criatura — continuam do jeito que já eram (inertes, já que a criatura
  nunca tem `HeldItem.itemId` setado).
