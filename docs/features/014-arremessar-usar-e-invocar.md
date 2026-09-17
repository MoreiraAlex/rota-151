# 🚀 Versão 0.0.14 — Arremessar, Usar e Invocar/Recolher

O objetivo desta versão é ligar os 4 botões de ação (v0.0.11) ao que estiver
equipado via debug (v0.0.12 item, v0.0.13 time): `primary` dispara
arremesso/uso por categoria do item; `secondary1-3` invocam/recolhem a
criatura do slot. Validado primeiro só no `DebugPanel`/console; depois de
confirmado, ganhou representação visual de verdade na cena 3D (projétil e
criatura invocada), incluindo o tint de cor por criatura de time adiado
desde a v0.0.13.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Contexto

- v0.0.11 reservou os 4 botões (log de debug só). v0.0.12 deu ao treinador
  um item em mãos (`HeldItem`/`getItem`). v0.0.13 deu um time (`Party`/
  `getSpecies`). Esta versão é a que finalmente lê essas duas peças e faz
  alguma coisa acontecer — sem elas, não dava pra saber "arremessar o quê"
  nem "invocar quem".
- Escopo combinado: a lógica de verdade (arremesso spawna projétil, uso cura,
  invocar/recolher cria/destrói a entidade da criatura, que já passa a
  seguir o jogador) é implementada agora. Renderizar o projétil e a criatura
  na cena 3D **não** é — validação fica no `DebugPanel` (números, posição) e
  console, mesmo caminho que HP/stamina/item já usaram antes de qualquer HUD
  de verdade existir.
- `actionSlotsDebugSystem` (log de debug da v0.0.11) cumpriu seu papel —
  agora que os 4 botões têm ação de verdade, ele sai (era documentado como
  temporário desde que nasceu).

## Decisões

- **`primary` estende `playerActionSystem`, não um system novo** — dash já
  usa `ActionState` (início por borda, duração, `dirX/dirZ` travados) e
  arremesso/uso são a mesma forma (ação com começo/fim, direção travada
  quando faz sentido). Vira mais dois valores de `ActionState.current`:
  `'throw'` e `'consume'`.
  - No disparo (`current === null`, `input.primary` true), lê `HeldItem` +
    `getItem`: `category === 'throwable'` → inicia `'throw'` (trava
    `dirX/dirZ` da `Rotation.y`, igual dash); `category === 'consumable'` →
    inicia `'consume'` (sem direção); sem item ou `weapon` → não inicia
    nada (mesma precondição que já bloqueia dash sem `Grounded`).
  - **Instante de liberação/efeito dentro da duração** — cada ação tem
    `DURATION` e `EFFECT_AT` (`gameConfig.PLAYER_ACTIONS.throw`/`.consume`),
    igual a nota do backlog ("spawna o projétil em t=0.4 de uma ação de
    0.6s" — o instante é config da ação, não keyframe). Detectado comparando
    o `elapsed` antes/depois do `delta` deste tick cruzar `EFFECT_AT" —
    dispara exatamente uma vez, sem precisar de um campo "já disparei" a
    mais no trait.
  - `'throw'`: no instante de liberação, `world.spawn` um `Projectile` na
    direção travada, com a velocidade de `PLAYER_ACTIONS.throw.SPEED`
    (global — não por item; só existe um `throwable` de teste hoje, migra
    pra config por item quando um segundo precisar de velocidade diferente,
    mesmo caminho já percorrido por `body`/`movement` de espécie), e limpa
    `HeldItem.itemId` (o item saiu da mão).
  - `'consume'`: no instante de efeito, aplica `applyHeal(vitals,
    item.consumable.healAmount)` e limpa `HeldItem.itemId`. `healAmount`
    **é** por item agora (não global) — cura é claramente um atributo do
    item (uma poção boa cura mais que uma fraca), diferente da velocidade
    de arremesso, que ainda não tem esse caso de uso.
- **`applyHeal(vitals, amount)` (novo, em `vitals.js`)** — soma `hp`
  (clampado em `maxHp`), simétrico a `applyDamage`. **Não** mexe em
  `hpRegenDelay` — curar não é o inverso de tomar dano pausar regen.
- **`Projectile` (trait novo) + `projectileSystem` (novo)** — `{ lifetime }`
  + `Position`/`Velocity` (traits já existentes). Sistema simples: aplica
  gravidade (`PHYSICS.GRAVITY`, mesma constante do personagem) e integra
  posição, conta `lifetime` pra baixo, destrói a entidade ao chegar a zero.
  **Sem colisão** com o mundo ou outra entidade — atravessa tudo e some por
  tempo (mesmo raciocínio já registrado no rascunho original de "mecanismo
  de item": colisão de projétil é problema próprio, só faz sentido quando
  houver algo de verdade pra acertar).
- **`SummonedCreature` (trait novo) + `partySummonSystem` (novo)** —
  `{ slot }` na entidade da criatura invocada, marca de qual slot do time
  ela veio (pra "recolher" achar a certa depois). `partySummonSystem`, fora
  do `playerActionSystem` (invocar não é uma ação com duração do próprio
  corpo do treinador, é criar/destruir outra entidade — não faz sentido
  competir pelo único `ActionState.current` do dash/item):
  - Pra cada `secondaryN` apertado: se já existe uma `SummonedCreature` com
    aquele `slot`, **recolhe** (`entity.destroy()`). Senão, lê
    `Party[slotN]`; se vazio, não faz nada; se tiver espécie, **invoca**
    (`world.spawn` com `Position` perto do treinador + `SummonedCreature
    { slot }`).
  - Cada `secondaryN` é independente — dá pra ter até 3 criaturas de fora ao
    mesmo tempo, uma por slot.
- **`creatureFollowSystem` (novo)** — toda `SummonedCreature` anda em
  direção à posição do treinador (achado via `InputControlled`, não um
  singleton importado — mesma técnica de "achar o jogador" que qualquer
  system headless já usa, funciona igual em teste e em jogo), parando a uma
  distância mínima (`PARTY.FOLLOW_MIN_DISTANCE`) pra não empilhar em cima
  dele. Sem colisão, sem rotação/animação — só a posição anda; é o que foi
  decidido na v0.0.13 ("segue o jogador"), construído agora.
- **`actionSlotsDebugSystem` removido** — cumpriu o papel de "confirma que o
  botão está mapeado" enquanto nada mais lia esses pulsos; agora que os 4
  têm ação de verdade, o log perdeu a função (documentado como temporário
  desde a v0.0.11).
- **Validação inicial no `DebugPanel`** —
  `useQuery(Projectile)`/`useQuery(SummonedCreature)` (reativos, do próprio
  koota) mostram quantos existem e onde estão; a cura já aparece na barra de
  HP que já existe. Confirmado funcionando, entrou a renderização de
  verdade (abaixo) — o texto de debug continua existindo, não é substituído.
- **Renderização: `syncTransformSystem`/`animationSystem` já são genéricos
  (por entidade registrada via `viewRegistry`/`animationRegistry`, não
  hardcoded pro jogador)** — só faltava um componente de view por entidade
  dinâmica, montado/desmontado via `useQuery` (reativo: React já
  monta/desmonta ao entrar/sair do resultado da query, sem precisar de
  infraestrutura nova de ciclo de vida).
  - `Projectile`/`SummonedCreature` passam a ser spawnados com `Rotation`
    também (default, sem uso real) — `syncTransformSystem` exige
    `Position` **e** `Rotation` na query; sem isso a entidade nunca
    aparecia registrada.
  - `SummonedCreature` ganha `speciesId` (além de `slot`) — guarda a
    espécie no instante da invocação, pra `CreatureView` saber qual modelo
    carregar sem precisar voltar no `Party` do treinador (que pode já ter
    mudado enquanto a criatura está fora).
  - Criatura invocada ganha `AnimationState({ id: 'idle' })` fixo (sem
    `animationStateSystem` — não tem `CharacterController`/`Velocity` de
    verdade, só anda por `creatureFollowSystem` mutando `Position` direto).
    Fica parada animando idle enquanto desliza até o treinador; andar de
    verdade fica pra quando o `creatureFollowSystem` também tiver
    locomoção de verdade (fora de escopo, ver abaixo).
  - **`useAnimatedModel` (hook novo, `view/hooks/`)** — extrai de
    `PlayerView.jsx` a lógica de carregar o GLTF, clonar o esqueleto,
    ligar sombra, e registrar view/ossos animados (com o cleanup no
    unmount). `PlayerView` passa a usar o mesmo hook — mesma lógica, um
    lugar só, provado por continuar funcionando pro jogador sem mudança de
    comportamento.
  - **`ProjectileView`/`ProjectilesView`** — projétil não tem esqueleto,
    então não usa `useAnimatedModel`: uma esfera simples (`meshStandardMaterial`),
    só `registerView` (sem ossos). `ProjectilesView` faz
    `useQuery(Projectile, Position)` e renderiza uma `ProjectileView` por
    entidade.
  - **`CreatureView`/`CreaturesView`** — usa `useAnimatedModel` com a
    espécie de `SummonedCreature.speciesId`. Aplica um tint de cor por
    espécie (`fox-red`/`fox-green`/`fox-blue` — mapa fica na view, não em
    `core/data/species`, porque é só cosmético dos placeholders que eu
    criei, não dado de jogo real) **clonando o material antes de colorir**
    — as 4 espécies fox compartilham o mesmo arquivo `.glb`/material via
    cache do `useGLTF`; tingir sem clonar vazaria a cor pra todas as
    instâncias (inclusive o jogador, se algum dia usar o mesmo asset).
    `CreaturesView` faz `useQuery(SummonedCreature, Position)` e renderiza
    uma `CreatureView` por entidade.
  - Ambas as views novas entram em `GameScene.jsx`, ao lado de `PlayerView`.

## Objetivos

- Com um item `throwable` equipado, `primary` spawna um projétil que se
  move, sofre gravidade e some sozinho; o item sai da mão.
- Com um item `consumable` equipado, `primary` cura o jogador (visível na
  barra de HP); o item sai da mão.
- Sem item, ou com um item `weapon` (categoria reservada, ainda sem
  conteúdo), `primary` não faz nada.
- Cada `secondaryN`: sem criatura equipada nesse slot, não faz nada; com
  criatura e nenhuma de fora ainda, invoca (cria a entidade, começa a
  seguir o treinador); com uma já de fora daquele slot, recolhe (destrói).
- `DebugPanel` mostra projéteis ativos e criaturas de fora (id/posição),
  ao vivo.
- `actionSlotsDebugSystem` removido (log obsoleto).
- Projétil arremessado aparece na cena 3D (esfera simples), se move e some.
- Criatura invocada aparece na cena 3D com o modelo da espécie, tingida por
  cor (`fox-red`/`fox-green`/`fox-blue` visualmente diferentes), animando
  idle enquanto desliza até o treinador; recolher a faz desaparecer.
- `PlayerView` continua renderizando o jogador exatamente igual (só passou
  a usar o hook compartilhado).

---

## Etapas

### 1. Cura e projétil

- [X] `traits/components/vitals.js` — `applyHeal(vitals, amount)` + export
      no barrel + teste
- [X] `traits/components/projectile.js` — `Projectile { lifetime: 0 }` +
      export no barrel
- [X] `systems/projectileSystem.js` — gravidade + integração de posição +
      destrói ao `lifetime` zerar + testes (headless)
- [X] `core/data/items/potion/index.js` — ganha `consumable: { healAmount
      }`; `_template/index.js` documenta o bloco por categoria

### 2. `primary` no `playerActionSystem`

- [X] `gameConfig.js` — `PLAYER_ACTIONS.throw: { DURATION, EFFECT_AT,
      SPEED, LIFETIME }`, `PLAYER_ACTIONS.consume: { DURATION, EFFECT_AT }`
- [X] `systems/playerActionSystem.js` — query ganha `HeldItem`/`Position`;
      disparo de `primary` decide `'throw'`/`'consume'`/nada pela
      categoria; `'throw'` spawna `Projectile` no instante de liberação;
      `'consume'` aplica `applyHeal` no instante de efeito; ambos limpam
      `HeldItem.itemId`
- [X] `playerActionSystem.test.js` — arremesso spawna projétil uma vez só;
      uso cura uma vez só; sem item não inicia nada; item some da mão nos
      dois casos (nota: `weapon` não tem item de teste no registro — sem
      necessidade de fabricar um só pra esse caso, mesmo caminho de código
      do "sem item")

### 3. `secondaryN`: invocar/recolher/seguir

- [X] `gameConfig.js` — `PARTY: { SUMMON_OFFSET, FOLLOW_SPEED,
      FOLLOW_MIN_DISTANCE }`
- [X] `traits/components/summonedCreature.js` — `SummonedCreature { slot:
      null }` + export no barrel
- [X] `systems/partySummonSystem.js` — por `secondaryN`: recolhe se já tem
      uma daquele slot fora; senão invoca a partir de `Party[slotN]`
      (no-op se vazio) + testes
- [X] `systems/creatureFollowSystem.js` — toda `SummonedCreature` anda em
      direção ao jogador (achado via `InputControlled`), parando em
      `FOLLOW_MIN_DISTANCE` + testes

### 4. Limpeza e ligação no loop

- [X] Remove `systems/actionSlotsDebugSystem.js` e seu teste
- [X] `view/loop/registerSystems.js` — remove o registro do debug system;
      registra `projectileSystem`/`partySummonSystem`/`creatureFollowSystem`
      na fase simulation

### 5. Debug

- [X] `tools/debug/DebugPanel.jsx` — `useQuery(Projectile)` (contagem +
      posição) e `useQuery(SummonedCreature)` (quais slots estão fora)

### 6. Gate e documentação

- [X] `package.json`: bump de versão `0.0.13` → `0.0.14`
- [X] `docs/backlog.md`: marca "Arremessar objeto", "Usar objeto",
      "Invocar criatura" e "Recolher criatura" como entregues
- [X] `npm run lint` e `npm test` verdes

### 7. Renderização (projétil e criatura invocada)

- [X] `traits/components/summonedCreature.js` — ganha `speciesId: null`
- [X] `systems/partySummonSystem.js` — spawna `Rotation` (default) +
      `AnimationState` (default `idle`) na criatura; preenche
      `SummonedCreature.speciesId` + testes atualizados
- [X] `systems/playerActionSystem.js` — projétil ganha `Rotation` (default)
      no spawn
- [X] `view/hooks/useAnimatedModel.js` (novo) — extrai a lógica de
      `PlayerView.jsx` (GLTF, clone de esqueleto, sombra, registro de
      view/ossos animados, cleanup)
- [X] `view/scene/PlayerView.jsx` — passa a usar `useAnimatedModel`
- [X] `view/scene/ProjectileView.jsx` + `ProjectilesView.jsx` (novos) —
      esfera simples por `Projectile`, `useQuery` reativo
- [X] `view/scene/CreatureView.jsx` + `CreaturesView.jsx` (novos) — modelo
      da espécie via `useAnimatedModel`, tint de cor por espécie (material
      clonado), `useQuery` reativo
- [X] `view/scene/GameScene.jsx` — inclui `ProjectilesView`/`CreaturesView`
- [X] `npm run lint` e `npm test` verdes; `npm run build` compila (view/
      sem cobertura automatizada, ver 005-suite-de-testes.md — confirmação
      visual em `npm run dev` fica por sua conta, não tenho como interagir
      com o canvas 3D neste ambiente)

---

## Correções feitas durante a versão

- **`playerActionSystem.test.js` estourava o limite de 16 worlds vivos do
  koota** — o arquivo já tinha 9 testes de dash, cada um com seu próprio
  `makeWorld()`; os novos testes de arremesso/uso levaram o total além do
  limite (`Koota: Too many worlds created`). Corrigido só neste arquivo:
  `spawnWorld()` (wrapper de `makeWorld()`) guarda cada world criado, e um
  `afterEach` destrói todos ao fim de cada teste, liberando o id pro
  próximo — não mexe no `makeWorld()` compartilhado (usado por outros 20+
  arquivos sem esse problema).

## Critérios de Conclusão

- Item `throwable` equipado + `primary`: projétil aparece na contagem do
  `DebugPanel`, se move e some sozinho depois de um tempo; `HeldItem` fica
  vazio.
- Item `consumable` equipado + `primary`: HP sobe (visível na barra);
  `HeldItem` fica vazio.
- Sem item ou item `weapon` (sem existir ainda de verdade): `primary` não
  faz nada, sem travar input.
- Slot de time vazio + `secondaryN`: nada acontece. Slot com criatura +
  `secondaryN`: aparece uma `SummonedCreature` daquele slot, cuja posição
  se aproxima da do jogador com o tempo. Apertar de novo o mesmo
  `secondaryN`: ela some.
- `npm run lint` e `npm test` continuam verdes; nenhum teste existente
  quebra.
- Projétil e criatura invocada aparecem de verdade na cena 3D (`npm run
  dev`); as 3 criaturas de time são visualmente diferenciáveis por cor.

---

## Fora de escopo

- **Colisão do projétil** — atravessa tudo, some por tempo.
- **Combate/captura de verdade** (o que acontece quando o projétil "acerta"
  uma criatura selvagem) — não existe criatura selvagem de verdade ainda
  (backlog "Criaturas selvagens no mundo", adiado); esta versão só
  implementa o arremesso em si.
- **Categoria `weapon`** — continua sem handler nem conteúdo.
- **Animação de arremesso/uso/invocar do treinador** — clipe é conteúdo de
  espécie, por conta do autor, mesmo espírito de sempre.
- ~~**Locomoção de verdade da criatura invocada**~~ — entregue em
  `docs/features/017-locomocao-e-recolhimento-de-criaturas.md`: física real
  (`characterPhysicsSystem`) e walk/run de verdade conforme velocidade.
- **Modelo distinto por espécie de time** — as 4 (`fox`/`fox-red`/
  `fox-green`/`fox-blue`) continuam o mesmo `.glb`, só o tint de cor muda;
  modelo de verdade por Pokémon é conteúdo a definir depois.
